const readError = async (response) => {
  try {
    const body = await response.json();
    return body.error || `Jira istegi basarisiz (${response.status})`;
  } catch {
    return `Jira istegi basarisiz (${response.status})`;
  }
};

export const createJiraTicket = async (projectId, ticket) => {
  const response = await fetch("/jira/issues", {
    method: "POST",
    headers: await apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ projectId, ticket }),
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
};

export const getJiraIssue = async (issueKey) => {
  const response = await fetch(
    `/jira/issues/${encodeURIComponent(issueKey.trim().toUpperCase())}`,
    { headers: await apiHeaders() },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.issue;
};
import { apiHeaders } from "./api.js";
