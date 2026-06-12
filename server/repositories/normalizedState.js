import { getDatabaseClient } from "../database.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";

const clean = (value) => String(value || "").trim().toLowerCase();
const dateOnly = (value) => {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};
const dateTime = (value) => {
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
};

const upsert = async (client, table, rows, options = {}) => {
  if (!rows.length) return;
  const { error } = await client.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
};

const removeStale = async (client, table, column, ids) => {
  const { data, error } = await client.from(table).select(column);
  if (error) throw new Error(`${table}: ${error.message}`);
  const keep = new Set(ids);
  const stale = (data || []).map((item) => item[column]).filter((id) => !keep.has(id));
  if (!stale.length) return;
  const { error: deleteError } = await client.from(table).delete().in(column, stale);
  if (deleteError) throw new Error(`${table}: ${deleteError.message}`);
};

const buildRows = (state, profiles) => {
  const profileByLegacy = new Map(profiles.map((item) => [item.legacy_id, item.id]));
  const profileByName = new Map(profiles.map((item) => [clean(item.name), item.id]));
  const now = new Date().toISOString();
  const rows = {
    projects: [],
    project_members: [],
    milestones: [],
    tasks: [],
    task_comments: [],
    time_entries: [],
    tickets: [],
    project_actions: [],
    field_plans: [],
    commissioning_nodes: [],
    user_notes: [],
    notifications: [],
    recurring_tasks: [],
    audit_logs: [],
  };

  const addMember = (projectId, legacyId, membershipRole, stakeholderRole = "") => {
    const profileId = profileByLegacy.get(legacyId);
    if (profileId) {
      rows.project_members.push({
        project_id: projectId,
        profile_id: profileId,
        membership_role: membershipRole,
        stakeholder_role: stakeholderRole,
      });
    }
  };
  const addTask = (task, context) => {
    rows.tasks.push({
      id: task.id,
      project_id: context.projectId || null,
      milestone_id: context.milestoneId || null,
      task_kind: context.kind,
      title: task.title,
      status: task.status || "Bekliyor",
      priority: task.priority || "Orta",
      assignee_id: profileByLegacy.get(task.assignee) || null,
      created_by: profileByLegacy.get(task.createdBy) || null,
      start_date: dateOnly(task.startDate),
      due_date: dateOnly(task.dueDate),
      position: context.position || 0,
      payload: { ...task, comments: undefined, timeEntries: undefined },
      created_at: dateTime(task.createdAt || task.ts),
      updated_at: dateTime(task.updatedAt || task.createdAt || task.ts),
    });
    for (const comment of task.comments || []) {
      rows.task_comments.push({
        id: comment.id,
        task_id: task.id,
        author_id: profileByLegacy.get(comment.userId) || null,
        body: comment.text || "",
        created_at: dateTime(comment.ts),
        payload: comment,
      });
    }
    for (const [position, entry] of (task.timeEntries || []).entries()) {
      rows.time_entries.push({
        id: entry.id || `${task.id}-time-${position}`,
        task_id: task.id,
        profile_id: profileByLegacy.get(entry.userId) || null,
        hours: Number(entry.hours) || 0,
        entry_date: dateOnly(entry.date),
        note: entry.note || "",
        payload: entry,
        created_at: dateTime(entry.createdAt || entry.date),
      });
    }
  };

  for (const project of state.projects || []) {
    rows.projects.push({
      id: project.id,
      name: project.name,
      description: project.description || "",
      status: project.status || "Bekliyor",
      color: project.color || "#4A6CF7",
      start_date: dateOnly(project.startDate),
      end_date: dateOnly(project.endDate),
      commissioning_tracking: Boolean(project.commissioningTracking),
      payload: { ...project, milestones: undefined, commissioningTree: undefined },
      updated_at: now,
    });
    for (const id of [...new Set([...(project.pmIds || []), project.pm].filter(Boolean))]) {
      addMember(project.id, id, "project_manager");
    }
    for (const id of project.members || []) addMember(project.id, id, "member");
    for (const item of project.stakeholders || []) {
      addMember(project.id, item.userId, "stakeholder", item.role || "");
    }
    for (const [position, milestone] of (project.milestones || []).entries()) {
      rows.milestones.push({
        id: milestone.id,
        project_id: project.id,
        name: milestone.name,
        status: milestone.status || "Bekliyor",
        start_date: dateOnly(milestone.startDate),
        due_date: dateOnly(milestone.dueDate),
        position,
        payload: { ...milestone, tasks: undefined },
        updated_at: now,
      });
      for (const [taskPosition, task] of (milestone.tasks || []).entries()) {
        addTask(task, {
          projectId: project.id,
          milestoneId: milestone.id,
          kind: "project",
          position: taskPosition,
        });
        addMember(project.id, task.assignee, "member");
      }
    }
  }
  for (const [position, task] of (state.personalTasks || []).entries()) {
    addTask(task, { kind: "personal", position });
  }

  rows.project_members = [...new Map(rows.project_members.map((item) => [
    `${item.project_id}:${item.profile_id}:${item.membership_role}:${item.stakeholder_role}`,
    item,
  ])).values()];

  for (const [projectId, tickets] of Object.entries(state.projectTickets || {})) {
    for (const ticket of tickets) {
      rows.tickets.push({
        id: ticket.id,
        project_id: projectId,
        title: ticket.title,
        status: ticket.status || "Açık",
        priority: ticket.priority || "Orta",
        assigned_to: profileByLegacy.get(ticket.assignedTo) || null,
        author_id:
          profileByLegacy.get(ticket.createdBy) ||
          profileByName.get(clean(ticket.author)) ||
          null,
        jira_key: ticket.jiraKey || ticket.jiraId || null,
        payload: ticket,
        created_at: dateTime(ticket.createdAt || ticket.ts),
        updated_at: dateTime(ticket.updatedAt || ticket.createdAt || ticket.ts),
      });
    }
  }
  for (const [projectId, actions] of Object.entries(state.projectActions || {})) {
    for (const action of actions) {
      rows.project_actions.push({
        id: action.id,
        project_id: projectId,
        author_id: profileByLegacy.get(action.authorId) || null,
        body: action.text || "",
        action_at: dateTime(action.actionAt || action.createdAt),
        payload: action,
        created_at: dateTime(action.createdAt),
        updated_at: dateTime(action.updatedAt || action.createdAt),
      });
    }
  }
  rows.field_plans = (state.fieldPlans || []).map((plan) => ({
    id: plan.id,
    profile_id: profileByLegacy.get(plan.userId),
    project_id: plan.projectId || null,
    plan_date: dateOnly(plan.date || plan.planDate),
    payload: plan,
    created_at: dateTime(plan.createdAt),
    updated_at: dateTime(plan.updatedAt || plan.createdAt),
  })).filter((item) => item.profile_id && item.plan_date);

  const children = {
    sector: ["productionCenters", "production_center"],
    production_center: ["workplaces", "workplace"],
    workplace: ["lines", "line"],
    line: ["machines", "machine"],
  };
  const walk = (projectId, nodes, nodeType, parentId = null) => {
    for (const [position, node] of (nodes || []).entries()) {
      rows.commissioning_nodes.push({
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
        updated_at: now,
      });
      const child = children[nodeType];
      if (child) walk(projectId, node[child[0]], child[1], node.id);
    }
  };
  for (const project of state.projects || []) {
    walk(project.id, project.commissioningTree || [], "sector");
  }

  rows.user_notes = Object.entries(state.userNotes || {}).map(([legacyId, value]) => ({
    profile_id: profileByLegacy.get(legacyId),
    notes: value.notes || "",
    todos: value.todos || [],
    updated_at: now,
  })).filter((item) => item.profile_id);
  rows.notifications = (state.notifications || []).map((item) => ({
    id: item.id,
    profile_id: profileByLegacy.get(item.userId),
    message: item.msg || item.message || "",
    read: Boolean(item.read),
    payload: item,
    created_at: dateTime(item.ts || item.createdAt),
  })).filter((item) => item.profile_id);
  rows.recurring_tasks = (state.recurringTasks || []).map((item) => ({
    id: item.id,
    created_by: profileByLegacy.get(item.createdBy) || null,
    active: item.active !== false,
    frequency: item.frequency || "weekly",
    next_run_date: dateOnly(item.nextRunDate),
    assignee_ids: (item.assigneeIds || []).map((id) => profileByLegacy.get(id)).filter(Boolean),
    payload: item,
    updated_at: now,
  }));
  rows.audit_logs = (state.logs || []).map((item) => ({
    id: item.id,
    actor_id:
      profileByLegacy.get(item.userId) ||
      profileByName.get(clean(item.user)) ||
      null,
    action: item.action || "general",
    entity_type: item.milestone ? "milestone" : item.project ? "project" : "",
    entity_id: "",
    project_id:
      (state.projects || []).find((project) => project.name === item.project)?.id ||
      null,
    detail: item.detail || "",
    payload: item,
    created_at: dateTime(item.ts),
  }));
  return rows;
};

export const syncNormalizedState = async (state) =>
  withRetry(async () => {
    const client = getDatabaseClient();
    const { data: profiles, error } = await client
      .from("profiles")
      .select("id,legacy_id,name");
    if (error) throw error;
    const rows = buildRows(state, profiles || []);

    await upsert(client, "projects", rows.projects, { onConflict: "id" });
    await upsert(client, "milestones", rows.milestones, { onConflict: "id" });
    await upsert(client, "tasks", rows.tasks, { onConflict: "id" });
    await upsert(client, "task_comments", rows.task_comments, { onConflict: "id" });
    await upsert(client, "time_entries", rows.time_entries, { onConflict: "id" });
    await upsert(client, "tickets", rows.tickets, { onConflict: "id" });
    await upsert(client, "project_actions", rows.project_actions, { onConflict: "id" });
    await upsert(client, "field_plans", rows.field_plans, { onConflict: "id" });
    await upsert(client, "commissioning_nodes", rows.commissioning_nodes, { onConflict: "id" });
    await upsert(client, "user_notes", rows.user_notes, { onConflict: "profile_id" });
    await upsert(client, "notifications", rows.notifications, { onConflict: "id" });
    await upsert(client, "recurring_tasks", rows.recurring_tasks, { onConflict: "id" });
    await upsert(client, "audit_logs", rows.audit_logs, { onConflict: "id" });

    for (const table of [
      "task_comments",
      "time_entries",
      "tickets",
      "project_actions",
      "field_plans",
      "commissioning_nodes",
      "notifications",
      "recurring_tasks",
      "audit_logs",
      "tasks",
      "milestones",
      "projects",
    ]) {
      await removeStale(client, table, "id", rows[table].map((item) => item.id));
    }
    await removeStale(
      client,
      "user_notes",
      "profile_id",
      rows.user_notes.map((item) => item.profile_id),
    );

    const projectIds = rows.projects.map((item) => item.id);
    if (projectIds.length) {
      const { error: memberDeleteError } = await client
        .from("project_members")
        .delete()
        .in("project_id", projectIds);
      if (memberDeleteError) throw memberDeleteError;
    }
    await upsert(client, "project_members", rows.project_members, {
      onConflict: "project_id,profile_id,membership_role,stakeholder_role",
    });
  }, {
    retries: 2,
    onRetry: (error, attempt, delayMs) =>
      logger.warn("database.normalized-sync.retry", {
        message: error.message,
        attempt,
        delayMs,
      }),
  });
