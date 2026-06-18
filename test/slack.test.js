import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSlackDueDate,
  sendCustomerTicketCreatedSlack,
  sendTaskAssignedSlack,
} from "../server/services/slack.js";

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
        title: "M\u00fc\u015fteri g\u00f6r\u00fc\u015fmesi",
        notes: "Plan\u0131 g\u00f6zden ge\u00e7ir",
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

  assert.match(
    String(requests[0].url),
    /users\.lookupByEmail\?email=user%40example\.com/,
  );
  const message = JSON.parse(requests[1].options.body);
  assert.equal(message.channel, "U123");
  assert.equal(message.blocks[0].text.text, "Yeni g\u00f6rev atamas\u0131");
  assert.equal(
    message.blocks[1].fields[1].text,
    "*Termin:*\n15 Haziran 2026 Pazartesi",
  );
  assert.equal(
    message.blocks[2].elements[0].text.text,
    "G\u00f6revi A\u00e7",
  );
  assert.match(message.text, /g\u00f6rev atad\u0131/);
  assert.match(message.blocks[2].elements[0].url, /task=task-1/);
  assert.doesNotMatch(requests[1].options.body, /xoxb-test-token/);
  assert.equal(result.id, "171234.567");
});

test("formatSlackDueDate formats valid dates without timezone shifts", () => {
  assert.equal(
    formatSlackDueDate("2026-06-17"),
    "17 Haziran 2026 \u00c7ar\u015famba",
  );
  assert.equal(formatSlackDueDate(""), "Belirtilmedi");
  assert.equal(formatSlackDueDate("2026-02-31"), "2026-02-31");
});

test("sendTaskAssignedSlack skips users without email", async () => {
  const result = await sendTaskAssignedSlack({
    assignee: { id: "person-1", email: "" },
    assigner: { name: "Hakan" },
    task: { id: "task-1", title: "Test" },
  });
  assert.equal(result.skipped, true);
});

test("sendCustomerTicketCreatedSlack sends project PM a customer ticket DM", async () => {
  const requests = [];
  const result = await sendCustomerTicketCreatedSlack(
    {
      recipient: { id: "pm-1", email: "pm@example.com" },
      customer: { name: "Acme MES" },
      project: { id: "project-1", name: "MES Rollout" },
      ticket: {
        id: "ticket-1",
        ticketNo: "CJT-1042",
        title: "Operatör ekranı açılmıyor",
        description: "Vardiya başlangıcında ekran beyaz kalıyor.",
        priority: "Yüksek",
        status: "Açık",
      },
    },
    {
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        const body = String(url).includes("users.lookupByEmail")
          ? { ok: true, user: { id: "UPM1" } }
          : { ok: true, ts: "171235.789" };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  assert.match(
    String(requests[0].url),
    /users\.lookupByEmail\?email=pm%40example\.com/,
  );
  const message = JSON.parse(requests[1].options.body);
  assert.equal(message.channel, "UPM1");
  assert.equal(message.blocks[0].text.text, "Müşteri ticket açtı");
  assert.equal(message.blocks[1].fields[0].text, "*Müşteri:*\nAcme MES");
  assert.equal(message.blocks[1].fields[1].text, "*Proje:*\nMES Rollout");
  assert.equal(message.blocks[2].elements[0].text.text, "Ticketı Aç");
  assert.match(message.text, /Acme MES yeni bir ticket açtı/);
  assert.match(message.blocks[2].elements[0].url, /ticket=ticket-1/);
  assert.doesNotMatch(requests[1].options.body, /xoxb-test-token/);
  assert.equal(result.id, "171235.789");
});
