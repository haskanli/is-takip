import assert from "node:assert/strict";
import test from "node:test";
import { createJiraIssue, getJiraIssue } from "../server/services/jira.js";

process.env.JIRA_BASE_URL = "https://example.atlassian.net";
process.env.JIRA_EMAIL = "test@example.com";
process.env.JIRA_API_TOKEN = "test-token";
process.env.JIRA_PROJECT_KEY = "TEST";
process.env.JIRA_RETRY_COUNT = "0";

test("createJiraIssue sends Jira REST v3 fields and returns id/key", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return new Response(
      JSON.stringify({ id: "10001", key: "TEST-1", self: `${url}/10001` }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  };

  const issue = await createJiraIssue(
    {
      title: "Test issue",
      description: "First line\nSecond line",
      issueType: "Görev",
      priority: "Yüksek",
    },
    { fetchImpl },
  );

  const payload = JSON.parse(request.options.body);
  assert.equal(request.url, "https://example.atlassian.net/rest/api/3/issue");
  assert.equal(payload.fields.project.key, "TEST");
  assert.equal(payload.fields.issuetype.name, "Task");
  assert.equal(payload.fields.priority.name, "High");
  assert.equal(payload.fields.description.type, "doc");
  assert.deepEqual(issue, {
    id: "10001",
    key: "TEST-1",
    self: "https://example.atlassian.net/rest/api/3/issue/10001",
  });
  assert.match(request.options.headers.Authorization, /^Basic /);
  assert.doesNotMatch(request.options.headers.Authorization, /test-token/);
});

test("getJiraIssue returns current Jira task details", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        id: "10042",
        key: "TEST-42",
        fields: {
          summary: "Linked task",
          status: { name: "In Progress" },
          issuetype: { name: "Task" },
          priority: { name: "High" },
          assignee: { displayName: "Hakan" },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  assert.deepEqual(await getJiraIssue("test-42", { fetchImpl }), {
    id: "10042",
    key: "TEST-42",
    summary: "Linked task",
    status: "In Progress",
    issueType: "Task",
    priority: "High",
    assignee: "Hakan",
    url: "https://example.atlassian.net/browse/TEST-42",
  });
});
