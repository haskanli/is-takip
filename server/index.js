import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getEmailConfig, getServerConfig } from "./config.js";
import { logger } from "./logger.js";
import {
  saveJiraIssueToTicket,
  loadState,
  updateTicketStatusByJiraKey,
} from "./repositories/appState.js";
import {
  sendOverdueReminderEmail,
  sendTicketAssignedEmail,
} from "./services/email.js";
import { createJiraIssue, getJiraIssue } from "./services/jira.js";
import { parseJiraWebhook, verifyWebhookSignature } from "./webhook.js";

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

const handleCreateIssue = async (request, response) => {
  const body = parseJson(await readBody(request));
  validateTicketRequest(body);

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

const handleTicketAssignedEmail = async (request, response) => {
  const body = parseJson(await readBody(request));
  if (!body?.projectId || !body?.ticket?.assignedTo) {
    throw Object.assign(new Error("projectId and ticket.assignedTo are required"), { status: 400 });
  }
  const state = await loadState();
  const project = state.projects?.find((item) => item.id === body.projectId);
  const assignee = state.people?.find((item) => item.id === body.ticket.assignedTo);
  if (!project || !assignee) {
    throw Object.assign(new Error("Project or assignee not found"), { status: 404 });
  }
  if (!assignee.email) {
    json(response, 202, { sent: false, reason: "Assignee has no email address" });
    return;
  }
  const result = await sendTicketAssignedEmail({ assignee, ticket: body.ticket, project });
  json(response, 200, { sent: !result.skipped, skipped: Boolean(result.skipped) });
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

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { status: "ok" });
    } else if (
      request.method === "GET" &&
      url.pathname.startsWith("/jira/issues/")
    ) {
      await handleGetIssue(
        decodeURIComponent(url.pathname.slice("/jira/issues/".length)),
        response,
      );
    } else if (request.method === "POST" && url.pathname === "/jira/issues") {
      await handleCreateIssue(request, response);
    } else if (request.method === "POST" && url.pathname === "/jira/webhook") {
      await handleWebhook(request, response);
    } else if (request.method === "POST" && url.pathname === "/email/ticket-assigned") {
      await handleTicketAssignedEmail(request, response);
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
});
