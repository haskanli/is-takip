import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  parseJiraWebhook,
  verifyWebhookSignature,
} from "../server/webhook.js";

process.env.JIRA_BASE_URL = "https://example.atlassian.net";
process.env.JIRA_EMAIL = "test@example.com";
process.env.JIRA_API_TOKEN = "test-token";
process.env.JIRA_PROJECT_KEY = "TEST";
process.env.JIRA_WEBHOOK_SECRET = "test-secret";

test("verifyWebhookSignature accepts a valid Jira HMAC", () => {
  const body = Buffer.from('{"webhookEvent":"jira:issue_updated"}');
  const digest = createHmac("sha256", "test-secret").update(body).digest("hex");

  assert.equal(verifyWebhookSignature(body, `sha256=${digest}`), true);
  assert.equal(verifyWebhookSignature(body, "sha256=bad"), false);
});

test("parseJiraWebhook extracts issue key and status", () => {
  assert.deepEqual(
    parseJiraWebhook({
      issue: { key: "TEST-42", fields: { status: { name: "Done" } } },
    }),
    { issueKey: "TEST-42", status: "Done" },
  );
  assert.equal(parseJiraWebhook({ issue: { key: "TEST-42" } }), null);
});
