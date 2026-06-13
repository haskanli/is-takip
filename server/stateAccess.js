const clone = (value) => structuredClone(value);

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

export const filterStateForProfile = (state, profile) => {
  if (!profile || profile.is_admin) return clone(state);

  const legacyId = profile.legacy_id;
  const projects = (state.projects || []).filter((project) =>
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
    ...clone(state),
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
  if (profile.is_admin) return clone(incoming);

  const legacyId = profile.legacy_id;
  const accessibleProjects = (current.projects || []).filter((project) =>
    canAccessProject(project, legacyId),
  );
  const incomingByProject = new Map(
    (incoming.projects || []).map((project) => [project.id, project]),
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
      incoming.personalTasks,
      ownsTask,
    ),
    fieldPlans: replaceOwnedItems(
      current.fieldPlans,
      incoming.fieldPlans,
      ownsPlan,
    ),
    notifications: replaceOwnedItems(
      current.notifications,
      incoming.notifications,
      ownsNotification,
    ),
    recurringTasks: replaceOwnedItems(
      current.recurringTasks,
      incoming.recurringTasks,
      ownsRecurring,
    ),
    userNotes: {
      ...(current.userNotes || {}),
      ...(incoming.userNotes?.[legacyId]
        ? { [legacyId]: clone(incoming.userNotes[legacyId]) }
        : {}),
    },
    projectTickets: mergeProjectTickets(
      current.projectTickets,
      incoming.projectTickets,
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
            clone(incoming.projectActions?.[project.id] || []),
          ]),
      ),
    },
  };
};
