import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getEmailConfig, getServerConfig } from "./config.js";
import { logger } from "./logger.js";
import {
  createTicket,
  createAssignedTasks,
  generateRecurringTasks,
  saveJiraIssueToTicket,
  loadState,
  loadStateRecord,
  saveStateRecord,
  checkDatabase,
  updateTicketStatusByJiraKey,
  markReportScheduleSent,
  getRemoteAccessRecords,
  upsertRemoteAccessRecord,
  deleteRemoteAccessRecord,
} from "./repositories/appState.js";
import {
  sendOverdueReminderEmail,
  sendTaskAssignedEmail,
  sendTicketAssignedEmail,
  sendEmail,
} from "./services/email.js";
import {
  createJiraNewsletter,
  createProjectStatusReport,
  nextScheduledRun,
} from "./services/reporting.js";
import { sendTaskAssignedWhatsApp } from "./services/whatsapp.js";
import { sendTaskAssignedSlack } from "./services/slack.js";
import { createJiraIssue, getJiraIssue } from "./services/jira.js";
import { askProjectAI } from "./services/projectAI.js";
import { parseJiraWebhook, verifyWebhookSignature } from "./webhook.js";
import { authenticateRequest } from "./auth.js";
import {
  filterStateForProfile,
  mergeStateForProfile,
} from "./stateAccess.js";

const MAX_BODY_BYTES = 1024 * 1024;
const DIST_DIRECTORY = fileURLToPath(new URL("../dist/", import.meta.url));
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const json = (response, status, body) => {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
};

const rateBuckets = new Map();
const enforceRateLimit = (request) => {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= 60_000) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > 180) {
    throw Object.assign(new Error("Too many requests"), { status: 429 });
  }
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });

const parseJson = (rawBody) => {
  try {
    return JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
  }
};

const validateTicketRequest = (body) => {
  if (!body?.projectId || !body?.ticket?.id || !body.ticket.title?.trim()) {
    throw Object.assign(
      new Error("projectId, ticket.id and ticket.title are required"),
      { status: 400 },
    );
  }
};

const canAccessProject = (state, profile, projectId) => {
  if (!profile || profile.is_admin) return true;
  const project = state.projects?.find((item) => item.id === projectId);
  if (!project) return false;
  if ([...(project.pmIds || []), project.pm].filter(Boolean).includes(profile.legacy_id)) return true;
  if ((project.members || []).includes(profile.legacy_id)) return true;
  if ((project.stakeholders || []).some((item) => item.userId === profile.legacy_id)) return true;
  return (project.milestones || []).some((milestone) =>
    (milestone.tasks || []).some((task) => task.assignee === profile.legacy_id),
  );
};

const assertProjectAccess = (state, auth, projectId) => {
  if (!canAccessProject(state, auth?.profile, projectId)) {
    throw Object.assign(new Error("Project access denied"), { status: 403 });
  }
};

const assertProjectManagement = (state, auth, projectId) => {
  if (auth?.profile?.is_admin) return;
  const project = state.projects?.find((item) => item.id === projectId);
  const managers = [...(project?.pmIds || []), project?.pm].filter(Boolean);
  if (!project || !managers.includes(auth?.profile?.legacy_id)) {
    throw Object.assign(new Error("Project management permission required"), {
      status: 403,
    });
  }
};

const handleGetApplicationState = async (auth, response) => {
  const record = await loadStateRecord();
  json(response, 200, {
    ...record,
    state: filterStateForProfile(record.state, auth?.profile),
    currentProfile: auth?.profile || null,
  });
};

const handleSaveApplicationState = async (request, auth, response) => {
  const body = parseJson(await readBody(request));
  if (!body?.state || !Number.isFinite(Number(body.version))) {
    throw Object.assign(new Error("state and version are required"), { status: 400 });
  }
  const current = await loadStateRecord();
  if (current.version !== Number(body.version)) {
    throw Object.assign(new Error("State changed by another user"), { status: 409 });
  }
  const incoming = { ...body.state };
  delete incoming.currentUserId;
  const shared = mergeStateForProfile(current.state, incoming, auth?.profile);
  const saved = await saveStateRecord({
    state: shared,
    expectedVersion: Number(body.version),
  });
  logger.info("application.state.saved", {
    actorId: auth?.profile?.id || null,
    version: saved.version,
  });
  json(response, 200, saved);
};

const handleCreateIssue = async (request, response, auth) => {
  const body = parseJson(await readBody(request));
  validateTicketRequest(body);
  assertProjectAccess(await loadState(), auth, body.projectId);

  const issue = await createJiraIssue({
    title: body.ticket.title,
    description: body.ticket.description,
    issueType: body.ticket.type,
    priority: body.ticket.priority,
  });
  const ticket = await saveJiraIssueToTicket({
    projectId: body.projectId,
    ticket: body.ticket,
    issue,
  });
  json(response, 201, { issue, ticket });
};

const handleGetIssue = async (issueKey, response) => {
  const issue = await getJiraIssue(issueKey);
  json(response, 200, { issue });
};

const handleRemoteAccess = async ({
  request,
  response,
  auth,
  projectId,
  recordId,
}) => {
  const state = await loadState();
  assertProjectManagement(state, auth, projectId);
  if (request.method === "GET") {
    json(response, 200, { records: await getRemoteAccessRecords(projectId) });
    return;
  }
  if (request.method === "DELETE") {
    const result = await deleteRemoteAccessRecord({ projectId, recordId });
    json(response, 200, result);
    return;
  }
  const body = parseJson(await readBody(request));
  if (!body?.record?.name?.trim()) {
    throw Object.assign(new Error("record.name is required"), { status: 400 });
  }
  const result = await upsertRemoteAccessRecord({
    projectId,
    record: {
      ...body.record,
      id: recordId || body.record.id,
      name: body.record.name.trim(),
    },
    actor: auth?.profile,
  });
  json(response, recordId ? 200 : 201, result);
};

const handleWebhook = async (request, response) => {
  const rawBody = await readBody(request);
  if (
    !verifyWebhookSignature(rawBody, request.headers["x-hub-signature"])
  ) {
    logger.warn("jira.webhook.signature-invalid");
    json(response, 401, { error: "Invalid webhook signature" });
    return;
  }

  const event = parseJiraWebhook(parseJson(rawBody));
  if (!event) {
    json(response, 202, { received: true, updated: false });
    return;
  }

  const result = await updateTicketStatusByJiraKey({
    ...event,
    deliveryId:
      request.headers["x-atlassian-webhook-identifier"] ||
      request.headers["x-request-id"],
  });
  json(response, 200, { received: true, ...result });
};

const handleTicketAssignedEmail = async (request, response, auth) => {
  const body = parseJson(await readBody(request));
  if (!body?.projectId || !body?.ticket?.assignedTo) {
    throw Object.assign(new Error("projectId and ticket.assignedTo are required"), { status: 400 });
  }
  const state = await loadState();
  assertProjectAccess(state, auth, body.projectId);
  const project = state.projects?.find((item) => item.id === body.projectId);
  const assignee = state.people?.find((item) => item.id === body.ticket.assignedTo);
  if (!project || !assignee) {
    throw Object.assign(new Error("Project or assignee not found"), { status: 404 });
  }
  if (!assignee.email) {
    logger.warn("email.ticket-assignment.skipped.no-address", {
      projectId: project.id,
      ticketId: body.ticket.id,
      assigneeId: assignee.id,
    });
    json(response, 202, { sent: false, reason: "Assignee has no email address" });
    return;
  }
  const result = await sendTicketAssignedEmail({ assignee, ticket: body.ticket, project });
  logger.info("email.ticket-assignment.completed", {
    projectId: project.id,
    ticketId: body.ticket.id,
    assigneeId: assignee.id,
    emailId: result.id,
  });
  json(response, 200, {
    sent: !result.skipped,
    skipped: Boolean(result.skipped),
    emailId: result.id || null,
  });
};

const handleCreateTicket = async (request, response, auth) => {
  const body = parseJson(await readBody(request));
  validateTicketRequest(body);
  const state = await loadState();
  assertProjectAccess(state, auth, body.projectId);
  const project = state.projects?.find((item) => item.id === body.projectId);
  if (!project) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }
  const ticket = await createTicket({
    projectId: body.projectId,
    ticket: auth?.profile
      ? { ...body.ticket, author: auth.profile.name, authorId: auth.profile.legacy_id }
      : body.ticket,
  });
  let notification = { sent: false, reason: "Ticket is not assigned" };
  if (ticket.assignedTo) {
    const assignee = state.people?.find((item) => item.id === ticket.assignedTo);
    if (!assignee) {
      notification = { sent: false, reason: "Assignee not found" };
    } else if (!assignee.email) {
      notification = { sent: false, reason: "Assignee has no email address" };
    } else {
      try {
        const result = await sendTicketAssignedEmail({ assignee, ticket, project });
        notification = { sent: !result.skipped, emailId: result.id || null };
      } catch (error) {
        logger.error("email.ticket-assignment.failed", error, {
          projectId: project.id,
          ticketId: ticket.id,
          assigneeId: assignee.id,
        });
        notification = { sent: false, reason: error.message };
      }
    }
  }
  json(response, 201, { ticket, notification });
};

const notifyTaskAssignee = async ({ assignee, task, assigner }) => {
  let slackError = "";
  try {
    const slack = await sendTaskAssignedSlack({ assignee, task, assigner });
    if (!slack.skipped) {
      return {
        sent: true,
        channel: "slack",
        messageId: slack.id || null,
      };
    }
  } catch (error) {
    slackError = error.message;
    logger.error("slack.task-assignment.failed", error, {
      taskId: task.id,
      userId: assignee?.id,
    });
  }

  let whatsappError = "";
  try {
    const whatsapp = await sendTaskAssignedWhatsApp({ assignee, task, assigner });
    if (!whatsapp.skipped) return { sent: true, channel: "whatsapp", messageId: whatsapp.id || null };
  } catch (error) {
    whatsappError = error.message;
    logger.error("whatsapp.task-assignment.failed", error, { taskId: task.id, userId: assignee?.id });
  }

  if (!assignee?.email) {
    return {
      sent: false,
      channel: "none",
      reason:
        slackError ||
        whatsappError ||
        "Assignee has no Slack email, WhatsApp phone or email address",
    };
  }
  try {
    const email = await sendTaskAssignedEmail({ assignee, task, assigner });
    return {
      sent: !email.skipped,
      channel: email.skipped ? "none" : "email",
      emailId: email.id || null,
      reason:
        email.skipped
          ? "Email is not configured"
          : slackError || whatsappError || undefined,
    };
  } catch (error) {
    return {
      sent: false,
      channel: "none",
      reason: error.message,
      slackError,
      whatsappError,
    };
  }
};

const handleAssignTasks = async (request, response, auth) => {
  const body = parseJson(await readBody(request));
  const assignerId = auth?.profile?.legacy_id || body?.assignerId;
  if (!body?.task?.title?.trim() || !assignerId || !body.assigneeIds?.length) {
    throw Object.assign(new Error("task.title, assignerId and assigneeIds are required"), { status: 400 });
  }
  const state = await loadState();
  const assigner = state.people?.find((person) => person.id === assignerId);
  if (!assigner?.isAdmin) {
    throw Object.assign(new Error("Only administrators can assign tasks"), { status: 403 });
  }
  const groupId = body.groupId || `${Date.now()}`;
  const tasks = body.assigneeIds.map((assignee, index) => ({
    ...body.task,
    id: `${groupId}-${index}`,
    assignee,
    createdBy: assigner.id,
    createdByName: assigner.name,
    assignmentGroupId: groupId,
    createdAt: new Date().toISOString(),
    comments: [],
  }));
  const recurringTemplate = body.recurrence?.enabled ? {
    id: `rec-${groupId}`,
    active: true,
    assigneeIds: body.assigneeIds,
    frequency: body.recurrence.frequency,
    nextRunDate: body.recurrence.nextRunDate,
    createdBy: assigner.id,
    task: { ...body.task, createdBy: assigner.id, createdByName: assigner.name },
  } : null;
  const created = await createAssignedTasks({ tasks, recurringTemplate });
  const notifications = [];
  for (const task of created) {
    const assignee = state.people?.find((person) => person.id === task.assignee);
    notifications.push({ taskId: task.id, ...await notifyTaskAssignee({ assignee, task, assigner }) });
  }
  json(response, 201, { tasks: created, notifications, recurringTemplate });
};

const runRecurringTaskCycle = async () => {
  const created = await generateRecurringTasks(new Date().toISOString().slice(0, 10));
  const state = await loadState();
  const notifications = [];
  for (const task of created) {
    const assignee = state.people?.find((person) => person.id === task.assignee);
    const assigner = state.people?.find((person) => person.id === task.createdBy) || { name: task.createdByName || "Yönetici" };
    notifications.push({ taskId: task.id, ...await notifyTaskAssignee({ assignee, task, assigner }) });
  }
  logger.info("tasks.recurring.completed", {
    created: created.length,
    notificationsSent: notifications.filter((item) => item.sent).length,
  });
  return { created: created.length, tasks: created, notifications };
};

const handleRecurringTasks = async (request, response) => {
  const config = getEmailConfig();
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!config.reminderSecret || token !== config.reminderSecret) {
    json(response, 401, { error: "Invalid reminder secret" });
    return;
  }
  json(response, 200, await runRecurringTaskCycle());
};

const runScheduledReportCycle = async () => {
  const state = await loadState();
  const current = new Date();
  const results = [];
  for (const project of state.projects || []) {
    for (const schedule of project.reportSchedules || []) {
      if (!schedule.enabled || !schedule.nextRunAt || new Date(schedule.nextRunAt) > current) continue;
      const tickets = state.projectTickets?.[project.id] || [];
      const html = schedule.reportType === "jira_newsletter"
        ? createJiraNewsletter({ project, tickets })
        : createProjectStatusReport({ project });
      try {
        for (const recipient of schedule.recipients || []) {
          await sendEmail({
            to: recipient,
            subject: schedule.reportType === "jira_newsletter"
              ? `[Corject] ${project.name} haftalık geliştirmeler`
              : `[Corject] ${project.name} otomatik durum raporu`,
            html,
          });
        }
        await markReportScheduleSent({
          projectId: project.id,
          scheduleId: schedule.id,
          sentAt: current.toISOString(),
          nextRunAt: nextScheduledRun(schedule, current),
        });
        results.push({ projectId: project.id, scheduleId: schedule.id, sent: true });
      } catch (error) {
        await markReportScheduleSent({
          projectId: project.id,
          scheduleId: schedule.id,
          sentAt: current.toISOString(),
          nextRunAt: schedule.nextRunAt,
          error: error.message,
        });
        logger.error("reports.scheduled.failed", error, {
          projectId: project.id,
          scheduleId: schedule.id,
        });
        results.push({ projectId: project.id, scheduleId: schedule.id, sent: false });
      }
    }
  }
  logger.info("reports.scheduled.completed", {
    attempted: results.length,
    sent: results.filter((item) => item.sent).length,
  });
  return results;
};

const handleScheduledReports = async (request, response) => {
  const config = getEmailConfig();
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!config.reminderSecret || token !== config.reminderSecret) {
    json(response, 401, { error: "Invalid reminder secret" });
    return;
  }
  json(response, 200, { reports: await runScheduledReportCycle() });
};

const handleProjectAI = async (request, response, auth) => {
  const body = await readBody(request);
  if (!body.projectId || !String(body.question || "").trim()) {
    throw Object.assign(new Error("projectId and question are required"), { status: 400 });
  }
  const state = await loadState();
  assertProjectAccess(state, auth, body.projectId);
  const project = state.projects?.find((item) => item.id === body.projectId);
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
  const answer = await askProjectAI({
    project,
    tickets: state.projectTickets?.[project.id] || [],
    question: String(body.question).slice(0, 1200),
  });
  logger.info("ai.project-insight.completed", {
    projectId: project.id,
    profileId: auth?.profile?.id,
  });
  json(response, 200, { answer });
};

const dateOnly = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const handleOverdueReminders = async (request, response) => {
  const config = getEmailConfig();
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!config.reminderSecret || token !== config.reminderSecret) {
    json(response, 401, { error: "Invalid reminder secret" });
    return;
  }
  const state = await loadState();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const grouped = new Map();
  const addTask = (task, projectName) => {
    if (!task.assignee || !task.dueDate || task.status === "Tamamlandı") return;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    const days = Math.floor((today - due) / 86400000);
    if (days <= 0) return;
    const tasks = grouped.get(task.assignee) || [];
    tasks.push({ title: task.title, projectName, dueDate: dateOnly(task.dueDate), days });
    grouped.set(task.assignee, tasks);
  };
  for (const project of state.projects || []) {
    for (const milestone of project.milestones || []) {
      for (const task of milestone.tasks || []) addTask(task, project.name);
    }
  }
  for (const task of state.personalTasks || []) addTask(task, "Genel Görev");

  let sent = 0;
  let skipped = 0;
  for (const [userId, tasks] of grouped) {
    const assignee = state.people?.find((person) => person.id === userId);
    if (!assignee?.email) {
      skipped += 1;
      continue;
    }
    const result = await sendOverdueReminderEmail({ assignee, tasks });
    if (result.skipped) skipped += 1;
    else sent += 1;
  }
  json(response, 200, { sent, skipped, usersWithOverdueTasks: grouped.size });
};

const sendFile = async (response, path) => {
  const file = await readFile(path);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(path)] || "application/octet-stream",
    "Cache-Control": extname(path) === ".html"
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  response.end(file);
};

const handleStatic = async (url, response) => {
  const relativePath = normalize(decodeURIComponent(url.pathname))
    .replace(/^([/\\])+/, "");
  const requestedPath = join(DIST_DIRECTORY, relativePath || "index.html");

  if (!requestedPath.startsWith(DIST_DIRECTORY)) {
    json(response, 400, { error: "Invalid path" });
    return;
  }

  try {
    const fileStat = await stat(requestedPath);
    if (fileStat.isFile()) {
      await sendFile(response, requestedPath);
      return;
    }
  } catch {
    // SPA routes fall back to index.html.
  }

  await sendFile(response, join(DIST_DIRECTORY, "index.html"));
};

const server = createServer(async (request, response) => {
  const startedAt = Date.now();
  const url = new URL(request.url, "http://localhost");
  const config = getServerConfig();
  const origin = request.headers.origin;
  if (origin && config.allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  try {
    if (request.method === "OPTIONS") {
      if (origin && !config.allowedOrigins.includes(origin)) {
        throw Object.assign(new Error("Origin not allowed"), { status: 403 });
      }
      response.writeHead(204);
      response.end();
      return;
    }
    enforceRateLimit(request);
    const protectedPath =
      url.pathname.startsWith("/api/") ||
      url.pathname === "/tickets" ||
      url.pathname === "/tasks/assign" ||
      url.pathname === "/email/ticket-assigned" ||
      url.pathname === "/jira/issues" ||
      url.pathname.startsWith("/jira/issues/");
    const auth = config.requireAuth && protectedPath
      ? await authenticateRequest(request)
      : null;
    const remoteAccessMatch = url.pathname.match(
      /^\/api\/projects\/([^/]+)\/remote-access(?:\/([^/]+))?$/,
    );
    if (request.method === "GET" && url.pathname === "/health") {
      const database = await checkDatabase();
      json(response, 200, {
        status: "ok",
        database,
        dataModel: config.dataModel,
        authenticationRequired: config.requireAuth,
      });
    } else if (request.method === "GET" && url.pathname === "/api/session") {
      if (!config.requireAuth) throw Object.assign(new Error("Not found"), { status: 404 });
      json(response, 200, { profile: auth?.profile || null });
    } else if (request.method === "GET" && url.pathname === "/api/state") {
      if (!config.requireAuth) throw Object.assign(new Error("Not found"), { status: 404 });
      await handleGetApplicationState(auth, response);
    } else if (request.method === "PUT" && url.pathname === "/api/state") {
      if (!config.requireAuth) throw Object.assign(new Error("Not found"), { status: 404 });
      await handleSaveApplicationState(request, auth, response);
    } else if (request.method === "POST" && url.pathname === "/api/ai/project-insight") {
      if (!config.requireAuth) throw Object.assign(new Error("Not found"), { status: 404 });
      await handleProjectAI(request, response, auth);
    } else if (
      remoteAccessMatch &&
      ["GET", "POST", "PUT", "DELETE"].includes(request.method)
    ) {
      if (!config.requireAuth) throw Object.assign(new Error("Not found"), { status: 404 });
      await handleRemoteAccess({
        request,
        response,
        auth,
        projectId: decodeURIComponent(remoteAccessMatch[1]),
        recordId: remoteAccessMatch[2]
          ? decodeURIComponent(remoteAccessMatch[2])
          : "",
      });
    } else if (
      request.method === "GET" &&
      url.pathname.startsWith("/jira/issues/")
    ) {
      await handleGetIssue(
        decodeURIComponent(url.pathname.slice("/jira/issues/".length)),
        response,
      );
    } else if (request.method === "POST" && url.pathname === "/jira/issues") {
      await handleCreateIssue(request, response, auth);
    } else if (request.method === "POST" && url.pathname === "/jira/webhook") {
      await handleWebhook(request, response);
    } else if (request.method === "POST" && url.pathname === "/email/ticket-assigned") {
      await handleTicketAssignedEmail(request, response, auth);
    } else if (request.method === "POST" && url.pathname === "/tickets") {
      await handleCreateTicket(request, response, auth);
    } else if (request.method === "POST" && url.pathname === "/tasks/assign") {
      await handleAssignTasks(request, response, auth);
    } else if (request.method === "POST" && url.pathname === "/tasks/recurring/run") {
      await handleRecurringTasks(request, response);
    } else if (request.method === "POST" && url.pathname === "/reports/scheduled/run") {
      await handleScheduledReports(request, response);
    } else if (request.method === "POST" && url.pathname === "/email/reminders") {
      await handleOverdueReminders(request, response);
    } else if (request.method === "GET") {
      await handleStatic(url, response);
    } else {
      json(response, 404, { error: "Not found" });
    }
  } catch (error) {
    logger.error("http.request.failed", error, {
      method: request.method,
      path: url.pathname,
    });
    const status =
      error?.status >= 400 && error.status < 600 ? error.status : 500;
    json(response, status, {
      error: status === 500 ? "Internal server error" : error.message,
    });
  } finally {
    logger.info("http.request.completed", {
      method: request.method,
      path: url.pathname,
      durationMs: Date.now() - startedAt,
      status: response.statusCode,
    });
  }
});

const { port } = getServerConfig();
server.listen(port, () => {
  logger.info("server.started", { port });
  runRecurringTaskCycle().catch((error) => logger.error("tasks.recurring.failed", error));
  runScheduledReportCycle().catch((error) => logger.error("reports.scheduled.failed", error));
});

const recurringTimer = setInterval(
  () => runRecurringTaskCycle().catch((error) => logger.error("tasks.recurring.failed", error)),
  60 * 60 * 1000,
);
recurringTimer.unref();

const reportTimer = setInterval(
  () => runScheduledReportCycle().catch((error) => logger.error("reports.scheduled.failed", error)),
  60 * 60 * 1000,
);
reportTimer.unref();
