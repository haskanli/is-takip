import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { getServerConfig } from "./config.js";
import { logger } from "./logger.js";
import {
  saveJiraIssueToTicket,
  updateTicketStatusByJiraKey,
} from "./repositories/appState.js";
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
