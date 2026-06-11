import { getJiraConfig, getServerConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";

const ISSUE_TYPE_MAP = {
  bug: "Bug",
  hata: "Bug",
  görev: "Task",
  gorev: "Task",
  task: "Task",
  iyileştirme: "Improvement",
  iyilestirme: "Improvement",
  improvement: "Improvement",
  soru: "Task",
  bilgi: "Task",
};

const PRIORITY_MAP = {
  kritik: "Highest",
  highest: "Highest",
  yüksek: "High",
  yuksek: "High",
  high: "High",
  orta: "Medium",
  medium: "Medium",
  düşük: "Low",
  dusuk: "Low",
  low: "Low",
};

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");

const toAdf = (description) => ({
  type: "doc",
  version: 1,
  content: String(description || "")
    .split(/\r?\n/)
    .map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
});

export class JiraRequestError extends Error {
  constructor(message, { status, retryAfter, responseBody } = {}) {
    super(message);
    this.name = "JiraRequestError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.responseBody = responseBody;
  }
}

const isRetryable = (error) =>
  error?.name === "AbortError" ||
  error instanceof TypeError ||
  error?.status === 429 ||
  error?.status >= 500;

const jiraRequest = async (
  path,
  { method = "GET", body, fetchImpl = fetch, event },
) => {
  const jira = getJiraConfig();
  const server = getServerConfig();

  return withRetry(
    async () => {
      const response = await fetchImpl(`${jira.baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(
            `${jira.email}:${jira.apiToken}`,
          ).toString("base64")}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(server.requestTimeoutMs),
      });

      const text = await response.text();
      let responseBody;
      try {
        responseBody = text ? JSON.parse(text) : {};
      } catch {
        responseBody = { message: text.slice(0, 500) };
      }

      if (!response.ok) {
        throw new JiraRequestError(`Jira request failed: ${method} ${path}`, {
          status: response.status,
          retryAfter: response.headers.get("retry-after"),
          responseBody,
        });
      }

      return responseBody;
    },
    {
      retries: server.retryCount,
      shouldRetry: isRetryable,
      onRetry: (error, attempt, delayMs) =>
        logger.warn(`${event}.retry`, {
          attempt,
          delayMs,
          status: error?.status,
        }),
    },
  );
};

export const createJiraIssue = async (
  { title, description, issueType, priority },
  { fetchImpl = fetch } = {},
) => {
  if (!title?.trim()) throw new Error("Jira issue title is required");

  const jira = getJiraConfig();
  if (!jira.projectKey) {
    throw new Error("Missing required environment variable: JIRA_PROJECT_KEY");
  }
  const fields = {
    project: { key: jira.projectKey },
    summary: title.trim(),
    description: toAdf(description),
    issuetype: {
      name: ISSUE_TYPE_MAP[normalize(issueType)] || issueType || "Task",
    },
  };

  const mappedPriority = PRIORITY_MAP[normalize(priority)] || priority;
  if (mappedPriority) fields.priority = { name: mappedPriority };

  const result = await jiraRequest("/rest/api/3/issue", {
    method: "POST",
    body: { fields },
    fetchImpl,
    event: "jira.issue.create",
  });

  if (!result.id || !result.key) {
    throw new JiraRequestError("Jira returned an invalid issue response");
  }

  logger.info("jira.issue.created", { issueId: result.id, issueKey: result.key });
  return { id: String(result.id), key: result.key, self: result.self };
};

export const getJiraIssue = async (issueKey, { fetchImpl = fetch } = {}) => {
  const key = String(issueKey || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(key)) {
    throw Object.assign(new Error("Invalid Jira issue key"), { status: 400 });
  }

  const jira = getJiraConfig();
  const issue = await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,status,issuetype,priority,assignee`,
    { fetchImpl, event: "jira.issue.get" },
  );

  const result = {
    id: String(issue.id),
    key: issue.key,
    summary: issue.fields?.summary || "",
    status: issue.fields?.status?.name || "",
    issueType: issue.fields?.issuetype?.name || "",
    priority: issue.fields?.priority?.name || "",
    assignee: issue.fields?.assignee?.displayName || "",
    url: `${jira.baseUrl}/browse/${encodeURIComponent(issue.key)}`,
  };
  logger.info("jira.issue.fetched", {
    issueId: result.id,
    issueKey: result.key,
    status: result.status,
  });
  return result;
};
