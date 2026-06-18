const clone = (value) => structuredClone(value);

const stripSensitiveState = (state) => {
  const safe = clone(state);
  delete safe.remoteAccessSecrets;
  safe.projects = (safe.projects || []).map((project) => ({
    ...project,
    remoteAccess: (project.remoteAccess || []).map((record) => {
      const metadata = { ...record };
      delete metadata.password;
      return metadata;
    }),
  }));
  return safe;
};

const safeAvatarUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const projectManagerIds = (project) =>
  [...new Set([...(project.pmIds || []), project.pm].filter(Boolean))];

export const canAccessProject = (project, legacyId) =>
  projectManagerIds(project).includes(legacyId) ||
  (project.members || []).includes(legacyId) ||
  (project.stakeholders || []).some((item) => item.userId === legacyId) ||
  (project.milestones || []).some((milestone) =>
    (milestone.tasks || []).some((task) => task.assignee === legacyId),
  );

const canManageProject = (project, legacyId) =>
  projectManagerIds(project).includes(legacyId);

const filterRecordByProjectIds = (record, projectIds) =>
  Object.fromEntries(
    Object.entries(record || {}).filter(([projectId]) => projectIds.has(projectId)),
  );

const isCustomerProfile = (profile, person) =>
  profile?.role_key === "customer_viewer" ||
  profile?.userType === "customer" ||
  person?.userType === "customer" ||
  person?.roleKey === "customer_viewer";

const profileCustomerId = (profile, person) =>
  profile?.customer_id || profile?.customerId || person?.customerId || "";

const sanitizeCustomerProject = (project) => ({
  id: project.id,
  name: project.name,
  description: project.description || "",
  color: project.color,
  status: project.status || "",
  startDate: project.startDate || "",
  endDate: project.endDate || "",
  customerId: project.customerId || "",
  customerName: project.customerName || "",
  customerProfile: clone(project.customerProfile || {}),
  customerContacts: clone(project.customerContacts || []),
  location: clone(project.location || {}),
  activeModules: clone(project.activeModules || []),
  connectedSupplier: Boolean(project.connectedSupplier),
  commissioningTracking: Boolean(project.commissioningTracking),
  commissioningTree: clone(project.commissioningTree || []),
  milestones: clone(project.milestones || []),
  machines: clone(project.machines || []),
  readinessChecklist: clone(project.readinessChecklist || []),
  readinessThreshold: project.readinessThreshold || 80,
  trainings: clone(project.trainings || []),
  raciContacts: clone(project.raciContacts || []),
});

const filterCustomerTickets = (tickets, customerId) =>
  (tickets || []).filter(
    (ticket) =>
      ticket.source === "customer" ||
      ticket.customerVisible === true ||
      (customerId && ticket.customerId === customerId),
  );

export const filterStateForProfile = (state, profile) => {
  const safeState = stripSensitiveState(state);
  if (!profile || profile.is_admin) return safeState;

  const legacyId = profile.legacy_id;
  const person = safeState.people?.find((item) => item.id === legacyId);
  if (isCustomerProfile(profile, person)) {
    const customerId = profileCustomerId(profile, person);
    const projects = (safeState.projects || [])
      .filter((project) => project.customerId === customerId)
      .map(sanitizeCustomerProject);
    const projectIds = new Set(projects.map((project) => project.id));
    return {
      ...safeState,
      people: clone((safeState.people || []).filter((item) => item.id === legacyId)),
      customers: clone((safeState.customers || []).filter((item) => item.id === customerId)),
      projects,
      personalTasks: [],
      fieldPlans: [],
      userNotes: {},
      notifications: clone(
        (safeState.notifications || []).filter((item) => item.userId === legacyId),
      ),
      recurringTasks: [],
      projectTickets: Object.fromEntries(
        Object.entries(filterRecordByProjectIds(safeState.projectTickets, projectIds)).map(
          ([projectId, tickets]) => [projectId, clone(filterCustomerTickets(tickets, customerId))],
        ),
      ),
      projectActions: {},
      projectNotes: {},
      logs: [],
      reportSchedules: [],
      emailTemplates: [],
    };
  }
  const ticketOnly = Boolean(
    person?.ticketOnly,
  );
  if (ticketOnly) {
    return {
      ...safeState,
      projects: (safeState.projects || []).map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
        milestones: [],
        members: [],
        pmIds: [],
        stakeholders: [],
      })),
      personalTasks: [],
      fieldPlans: [],
      userNotes: {},
      notifications: clone(
        (safeState.notifications || []).filter(
          (item) => item.userId === legacyId,
        ),
      ),
      recurringTasks: [],
      projectTickets: clone(safeState.projectTickets || {}),
      projectActions: {},
      logs: [],
    };
  }
  const projects = (safeState.projects || []).filter((project) =>
    canAccessProject(project, legacyId),
  );
  const projectIds = new Set(projects.map((project) => project.id));
  const managedProjectIds = new Set(
    projects
      .filter((project) => canManageProject(project, legacyId))
      .map((project) => project.id),
  );
  const ownTask = (task) =>
    task.assignee === legacyId || task.createdBy === legacyId;

  return {
    ...safeState,
    projects: clone(projects),
    personalTasks: clone((state.personalTasks || []).filter(ownTask)),
    fieldPlans: clone(
      (state.fieldPlans || []).filter(
        (plan) =>
          plan.userId === legacyId || managedProjectIds.has(plan.projectId),
      ),
    ),
    userNotes: state.userNotes?.[legacyId]
      ? { [legacyId]: clone(state.userNotes[legacyId]) }
      : {},
    notifications: clone(
      (state.notifications || []).filter((item) => item.userId === legacyId),
    ),
    recurringTasks: clone(
      (state.recurringTasks || []).filter(
        (item) =>
          item.createdBy === legacyId ||
          (item.assigneeIds || []).includes(legacyId),
      ),
    ),
    projectTickets: clone(
      filterRecordByProjectIds(state.projectTickets, projectIds),
    ),
    projectActions: clone(
      filterRecordByProjectIds(state.projectActions, projectIds),
    ),
    logs: clone(
      (state.logs || []).filter(
        (item) =>
          item.userId === legacyId ||
          !item.project ||
          projects.some((project) => project.name === item.project),
      ),
    ),
  };
};

const replaceOwnedItems = (current, incoming, owns) => [
  ...(current || []).filter((item) => !owns(item)),
  ...(incoming || []).filter(owns).map(clone),
];

const mergeAssignedTask = (currentTask, incomingTask) => {
  if (!incomingTask) return currentTask;
  return {
    ...currentTask,
    status: incomingTask.status ?? currentTask.status,
    comments: clone(incomingTask.comments || currentTask.comments || []),
    timeEntries: clone(incomingTask.timeEntries || currentTask.timeEntries || []),
    updatedAt: incomingTask.updatedAt || new Date().toISOString(),
  };
};

const mergeMemberProject = (currentProject, incomingProject, legacyId) => ({
  ...currentProject,
  milestones: (currentProject.milestones || []).map((milestone) => {
    const incomingMilestone = (incomingProject?.milestones || []).find(
      (item) => item.id === milestone.id,
    );
    return {
      ...milestone,
      tasks: (milestone.tasks || []).map((task) =>
        task.assignee === legacyId
          ? mergeAssignedTask(
              task,
              (incomingMilestone?.tasks || []).find((item) => item.id === task.id),
            )
          : task,
      ),
    };
  }),
});

const canEditTicket = (ticket, profile) =>
  ticket.assignedTo === profile.legacy_id ||
  ticket.createdBy === profile.legacy_id ||
  ticket.author === profile.name;

const mergeProjectTickets = (current, incoming, projects, profile) => {
  const result = clone(current || {});
  for (const project of projects) {
    const currentTickets = current?.[project.id] || [];
    const incomingTickets = incoming?.[project.id] || [];
    if (canManageProject(project, profile.legacy_id)) {
      result[project.id] = clone(incomingTickets);
      continue;
    }

    const currentById = new Map(currentTickets.map((ticket) => [ticket.id, ticket]));
    const merged = currentTickets.map((ticket) => {
      const next = incomingTickets.find((item) => item.id === ticket.id);
      return next && canEditTicket(ticket, profile) ? clone(next) : ticket;
    });
    for (const ticket of incomingTickets) {
      if (currentById.has(ticket.id)) continue;
      merged.push({
        ...clone(ticket),
        author: profile.name,
        createdBy: profile.legacy_id,
      });
    }
    result[project.id] = merged;
  }
  return result;
};

export const mergeStateForProfile = (current, incoming, profile) => {
  if (!profile) {
    throw Object.assign(new Error("Authentication required"), { status: 401 });
  }
  const safeIncoming = stripSensitiveState(incoming);
  if (profile.is_admin) {
    return {
      ...safeIncoming,
      remoteAccessSecrets: clone(current.remoteAccessSecrets || {}),
    };
  }

  const legacyId = profile.legacy_id;
  const person = current.people?.find((item) => item.id === legacyId);
  if (isCustomerProfile(profile, person)) {
    const customerId = profileCustomerId(profile, person);
    const customerProjectIds = new Set(
      (current.projects || [])
        .filter((project) => project.customerId === customerId)
        .map((project) => project.id),
    );
    const resultTickets = clone(current.projectTickets || {});
    for (const projectId of customerProjectIds) {
      const currentTickets = resultTickets[projectId] || [];
      const currentById = new Map(currentTickets.map((ticket) => [ticket.id, ticket]));
      const incomingTickets = safeIncoming.projectTickets?.[projectId] || [];
      const nextTickets = [...currentTickets];
      for (const ticket of incomingTickets) {
        if (currentById.has(ticket.id)) continue;
        nextTickets.push({
          ...clone(ticket),
          source: "customer",
          customerVisible: true,
          customerId,
          author: profile.name,
          createdBy: legacyId,
          assignedTo: "",
        });
      }
      resultTickets[projectId] = nextTickets;
    }
    return {
      ...clone(current),
      projectTickets: resultTickets,
      notifications: replaceOwnedItems(
        current.notifications,
        safeIncoming.notifications,
        (item) => item.userId === legacyId,
      ),
    };
  }
  const ticketOnly = Boolean(
    person?.ticketOnly,
  );
  if (ticketOnly) {
    return {
      ...clone(current),
      projectTickets: clone(safeIncoming.projectTickets || {}),
      notifications: clone(
        (safeIncoming.notifications || []).filter(
          (item) => item.userId === legacyId,
        ),
      ),
    };
  }
  const accessibleProjects = (current.projects || []).filter((project) =>
    canAccessProject(project, legacyId),
  );
  const incomingByProject = new Map(
    (safeIncoming.projects || []).map((project) => [project.id, project]),
  );
  const projects = (current.projects || []).map((project) => {
    if (!canAccessProject(project, legacyId)) return project;
    const next = incomingByProject.get(project.id);
    if (!next) return project;
    return canManageProject(project, legacyId)
      ? clone(next)
      : mergeMemberProject(project, next, legacyId);
  });
  const ownsTask = (task) =>
    task.assignee === legacyId || task.createdBy === legacyId;
  const ownsPlan = (plan) => plan.userId === legacyId;
  const ownsNotification = (item) => item.userId === legacyId;
  const ownsRecurring = (item) =>
    item.createdBy === legacyId || (item.assigneeIds || []).includes(legacyId);
  const incomingPerson = (incoming.people || []).find(
    (person) => person.id === legacyId,
  );
  const ownAvatarUrl = safeAvatarUrl(incomingPerson?.avatarUrl);

  return {
    ...clone(current),
    people: (current.people || []).map((person) =>
      person.id === legacyId && ownAvatarUrl
        ? { ...clone(person), avatarUrl: ownAvatarUrl }
        : clone(person),
    ),
    projects,
    personalTasks: replaceOwnedItems(
      current.personalTasks,
      safeIncoming.personalTasks,
      ownsTask,
    ),
    fieldPlans: replaceOwnedItems(
      current.fieldPlans,
      safeIncoming.fieldPlans,
      ownsPlan,
    ),
    notifications: replaceOwnedItems(
      current.notifications,
      safeIncoming.notifications,
      ownsNotification,
    ),
    recurringTasks: replaceOwnedItems(
      current.recurringTasks,
      safeIncoming.recurringTasks,
      ownsRecurring,
    ),
    userNotes: {
      ...(current.userNotes || {}),
      ...(safeIncoming.userNotes?.[legacyId]
        ? { [legacyId]: clone(safeIncoming.userNotes[legacyId]) }
        : {}),
    },
    projectTickets: mergeProjectTickets(
      current.projectTickets,
      safeIncoming.projectTickets,
      accessibleProjects,
      profile,
    ),
    projectActions: {
      ...(current.projectActions || {}),
      ...Object.fromEntries(
        accessibleProjects
          .filter((project) => canManageProject(project, legacyId))
          .map((project) => [
            project.id,
            clone(safeIncoming.projectActions?.[project.id] || []),
          ]),
      ),
    },
  };
};
