import assert from "node:assert/strict";
import test from "node:test";
import { sendTaskAssignedSlack } from "../server/services/slack.js";

process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
process.env.APP_BASE_URL = "https://www.corject.com";

test("sendTaskAssignedSlack finds the user by email and sends a task DM", async () => {
  const requests = [];
  const result = await sendTaskAssignedSlack(
    {
      assignee: { id: "person-1", email: "user@example.com" },
      assigner: { name: "Hakan" },
      task: {
        id: "task-1",
        title: "Müşteri görüşmesi",
        notes: "Planı gözden geçir",
        dueDate: "2026-06-15",
      },
    },
    {
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        const body = String(url).includes("users.lookupByEmail")
          ? { ok: true, user: { id: "U123" } }
          : { ok: true, ts: "171234.567" };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  assert.match(String(requests[0].url), /users\.lookupByEmail\?email=user%40example\.com/);
  const message = JSON.parse(requests[1].options.body);
  assert.equal(message.channel, "U123");
  assert.equal(message.blocks[0].text.text, "Yeni görev ataması");
  assert.equal(message.blocks[2].elements[0].text.text, "Görevi Aç");
  assert.match(message.text, /görev atadı/);
  assert.match(message.blocks[2].elements[0].url, /task=task-1/);
  assert.doesNotMatch(requests[1].options.body, /xoxb-test-token/);
  assert.equal(result.id, "171234.567");
});

test("sendTaskAssignedSlack skips users without email", async () => {
  const result = await sendTaskAssignedSlack({
    assignee: { id: "person-1", email: "" },
    assigner: { name: "Hakan" },
    task: { id: "task-1", title: "Test" },
  });
  assert.equal(result.skipped, true);
});
