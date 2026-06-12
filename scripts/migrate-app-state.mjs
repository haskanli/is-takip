import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const migrationName = "app_state_to_normalized_v1";
const { data: applied } = await client
  .from("data_migrations")
  .select("name")
  .eq("name", migrationName)
  .maybeSingle();
if (applied) {
  console.log(`${migrationName} was already applied.`);
  process.exit(0);
}

const { data: source, error: sourceError } = await client
  .from("app_state")
  .select("data,updated_at")
  .eq("id", 1)
  .single();
if (sourceError) throw sourceError;
const state = source.data || {};

const cleanEmail = (value) => String(value || "").trim().toLowerCase();
const dateOnly = (value) => {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};
const dateTime = (value) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const upsert = async (table, rows, options = {}) => {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length}`);
};

const profileIdByLegacy = new Map();
const profileIdByName = new Map();
const { data: existingUsers, error: listUsersError } = await client.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listUsersError) throw listUsersError;
for (const person of state.people || []) {
  const email = cleanEmail(person.email);
  if (!email) throw new Error(`User ${person.name || person.id} has no email address`);

  let authUser = existingUsers.users.find((user) => cleanEmail(user.email) === email);
  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { name: person.name, legacy_id: person.id },
    });
    if (error) throw new Error(`Auth user ${email}: ${error.message}`);
    authUser = data.user;
    existingUsers.users.push(authUser);
  }
  profileIdByLegacy.set(person.id, authUser.id);
  profileIdByName.set(String(person.name || "").trim().toLowerCase(), authUser.id);
  await upsert("profiles", [{
    id: authUser.id,
    legacy_id: person.id,
    email,
    name: person.name,
    role_title: person.role || "",
    phone: person.phone || "",
    avatar: person.avatar || "",
    is_admin: Boolean(person.isAdmin),
    whatsapp_enabled: person.whatsappEnabled !== false,
    active: true,
    payload: person,
    updated_at: new Date().toISOString(),
  }], { onConflict: "id" });
}

const projects = (state.projects || []).map((project) => ({
  id: project.id,
  name: project.name,
  description: project.description || "",
  status: project.status || "Bekliyor",
  color: project.color || "#4A6CF7",
  start_date: dateOnly(project.startDate),
  end_date: dateOnly(project.endDate),
  commissioning_tracking: Boolean(project.commissioningTracking),
  payload: { ...project, milestones: undefined, commissioningTree: undefined },
  updated_at: new Date().toISOString(),
}));
await upsert("projects", projects, { onConflict: "id" });

const memberRows = [];
const addMember = (projectId, legacyId, membershipRole, stakeholderRole = "") => {
  const profileId = profileIdByLegacy.get(legacyId);
  if (!profileId) return;
  memberRows.push({
    project_id: projectId,
    profile_id: profileId,
    membership_role: membershipRole,
    stakeholder_role: stakeholderRole,
  });
};
for (const project of state.projects || []) {
  for (const id of [...new Set([...(project.pmIds || []), project.pm].filter(Boolean))]) {
    addMember(project.id, id, "project_manager");
  }
  for (const id of project.members || []) addMember(project.id, id, "member");
  for (const item of project.stakeholders || []) {
    addMember(project.id, item.userId, "stakeholder", item.role || "");
  }
  for (const milestone of project.milestones || []) {
    for (const task of milestone.tasks || []) addMember(project.id, task.assignee, "member");
  }
}
const uniqueMembers = [...new Map(memberRows.map((row) => [
  `${row.project_id}:${row.profile_id}:${row.membership_role}:${row.stakeholder_role}`,
  row,
])).values()];
await upsert("project_members", uniqueMembers, {
  onConflict: "project_id,profile_id,membership_role,stakeholder_role",
});

const milestoneRows = [];
const taskRows = [];
const commentRows = [];
const timeRows = [];
const addTask = (task, context) => {
  taskRows.push({
    id: task.id,
    project_id: context.projectId || null,
    milestone_id: context.milestoneId || null,
    task_kind: context.kind,
    title: task.title,
    status: task.status || "Bekliyor",
    priority: task.priority || "Orta",
    assignee_id: profileIdByLegacy.get(task.assignee) || null,
    created_by: profileIdByLegacy.get(task.createdBy) || null,
    start_date: dateOnly(task.startDate),
    due_date: dateOnly(task.dueDate),
    position: context.position || 0,
    payload: { ...task, comments: undefined, timeEntries: undefined },
    created_at: dateTime(task.createdAt || task.ts),
    updated_at: dateTime(task.updatedAt || task.createdAt || task.ts),
  });
  for (const comment of task.comments || []) {
    commentRows.push({
      id: comment.id,
      task_id: task.id,
      author_id: profileIdByLegacy.get(comment.userId) || null,
      body: comment.text || "",
      created_at: dateTime(comment.ts),
      payload: comment,
    });
  }
  for (const [position, entry] of (task.timeEntries || []).entries()) {
    timeRows.push({
      id: entry.id || `${task.id}-time-${position}`,
      task_id: task.id,
      profile_id: profileIdByLegacy.get(entry.userId) || null,
      hours: Number(entry.hours) || 0,
      entry_date: dateOnly(entry.date),
      note: entry.note || "",
      payload: entry,
      created_at: dateTime(entry.createdAt || entry.date),
    });
  }
};
for (const project of state.projects || []) {
  for (const [position, milestone] of (project.milestones || []).entries()) {
    milestoneRows.push({
      id: milestone.id,
      project_id: project.id,
      name: milestone.name,
      status: milestone.status || "Bekliyor",
      start_date: dateOnly(milestone.startDate),
      due_date: dateOnly(milestone.dueDate),
      position,
      payload: { ...milestone, tasks: undefined },
      updated_at: new Date().toISOString(),
    });
    for (const [taskPosition, task] of (milestone.tasks || []).entries()) {
      addTask(task, {
        projectId: project.id,
        milestoneId: milestone.id,
        kind: "project",
        position: taskPosition,
      });
    }
  }
}
for (const [position, task] of (state.personalTasks || []).entries()) {
  addTask(task, { kind: "personal", position });
}
await upsert("milestones", milestoneRows, { onConflict: "id" });
await upsert("tasks", taskRows, { onConflict: "id" });
await upsert("task_comments", commentRows, { onConflict: "id" });
await upsert("time_entries", timeRows, { onConflict: "id" });

const ticketRows = [];
for (const [projectId, tickets] of Object.entries(state.projectTickets || {})) {
  for (const ticket of tickets) {
    ticketRows.push({
      id: ticket.id,
      project_id: projectId,
      title: ticket.title,
      status: ticket.status || "Açık",
      priority: ticket.priority || "Orta",
      assigned_to: profileIdByLegacy.get(ticket.assignedTo) || null,
      author_id: profileIdByName.get(String(ticket.author || "").trim().toLowerCase()) || null,
      jira_key: ticket.jiraKey || ticket.jiraId || null,
      payload: ticket,
      created_at: dateTime(ticket.createdAt || ticket.ts),
      updated_at: dateTime(ticket.updatedAt || ticket.createdAt || ticket.ts),
    });
  }
}
await upsert("tickets", ticketRows, { onConflict: "id" });

const actionRows = [];
for (const [projectId, actions] of Object.entries(state.projectActions || {})) {
  for (const action of actions) {
    actionRows.push({
      id: action.id,
      project_id: projectId,
      author_id: profileIdByLegacy.get(action.authorId) || null,
      body: action.text || "",
      action_at: dateTime(action.actionAt || action.createdAt),
      payload: action,
      created_at: dateTime(action.createdAt),
      updated_at: dateTime(action.updatedAt || action.createdAt),
    });
  }
}
await upsert("project_actions", actionRows, { onConflict: "id" });

await upsert("field_plans", (state.fieldPlans || []).map((plan) => ({
  id: plan.id,
  profile_id: profileIdByLegacy.get(plan.userId),
  project_id: plan.projectId || null,
  plan_date: dateOnly(plan.date) || dateOnly(plan.planDate),
  payload: plan,
  created_at: dateTime(plan.createdAt),
  updated_at: dateTime(plan.updatedAt || plan.createdAt),
})).filter((row) => row.profile_id && row.plan_date), { onConflict: "id" });

const commissioningRows = [];
const walkCommissioning = (projectId, nodes, nodeType, parentId = null) => {
  const childConfig = {
    sector: ["productionCenters", "production_center"],
    production_center: ["workplaces", "workplace"],
    workplace: ["lines", "line"],
    line: ["machines", "machine"],
  };
  for (const [position, node] of (nodes || []).entries()) {
    commissioningRows.push({
      id: node.id,
      project_id: projectId,
      parent_id: parentId,
      node_type: nodeType,
      name: node.name,
      code: node.code || "",
      machine_type: nodeType === "machine" ? (node.type || "physical") : null,
      commissioned: nodeType === "machine" && Boolean(node.commissioned),
      commissioned_at: nodeType === "machine" ? dateOnly(node.commissionedAt) : null,
      note: node.note || "",
      position,
      payload: node,
      updated_at: new Date().toISOString(),
    });
    const child = childConfig[nodeType];
    if (child) walkCommissioning(projectId, node[child[0]], child[1], node.id);
  }
};
for (const project of state.projects || []) {
  walkCommissioning(project.id, project.commissioningTree || [], "sector");
}
await upsert("commissioning_nodes", commissioningRows, { onConflict: "id" });

await upsert("user_notes", Object.entries(state.userNotes || {}).map(([legacyId, value]) => ({
  profile_id: profileIdByLegacy.get(legacyId),
  notes: value.notes || "",
  todos: value.todos || [],
  updated_at: new Date().toISOString(),
})).filter((row) => row.profile_id), { onConflict: "profile_id" });

await upsert("notifications", (state.notifications || []).map((item) => ({
  id: item.id,
  profile_id: profileIdByLegacy.get(item.userId),
  message: item.msg || item.message || "",
  read: Boolean(item.read),
  payload: item,
  created_at: dateTime(item.ts || item.createdAt),
})).filter((row) => row.profile_id), { onConflict: "id" });

await upsert("recurring_tasks", (state.recurringTasks || []).map((item) => ({
  id: item.id,
  created_by: profileIdByLegacy.get(item.createdBy) || null,
  active: item.active !== false,
  frequency: item.frequency || "weekly",
  next_run_date: dateOnly(item.nextRunDate),
  assignee_ids: (item.assigneeIds || []).map((id) => profileIdByLegacy.get(id)).filter(Boolean),
  payload: item,
  updated_at: new Date().toISOString(),
})), { onConflict: "id" });

await upsert("audit_logs", (state.logs || []).map((item) => ({
  id: item.id,
  actor_id: profileIdByLegacy.get(item.userId) || profileIdByName.get(String(item.user || "").trim().toLowerCase()) || null,
  action: item.action || "general",
  entity_type: item.milestone ? "milestone" : item.project ? "project" : "",
  entity_id: "",
  project_id: (state.projects || []).find((project) => project.name === item.project)?.id || null,
  detail: item.detail || "",
  payload: item,
  created_at: dateTime(item.ts),
})), { onConflict: "id" });

await client.from("app_meta").upsert({
  id: 1,
  state_version: 1,
  migrated_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});
await client.from("data_migrations").insert({
  name: migrationName,
  detail: {
    source_updated_at: source.updated_at,
    profiles: profileIdByLegacy.size,
    projects: projects.length,
    milestones: milestoneRows.length,
    tasks: taskRows.length,
    tickets: ticketRows.length,
  },
});

console.log("Migration completed successfully.");
