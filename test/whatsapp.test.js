import assert from "node:assert/strict";
import test from "node:test";
import { sendTaskAssignedWhatsApp } from "../server/services/whatsapp.js";

process.env.WHATSAPP_ACCESS_TOKEN = "whatsapp-test-token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
process.env.WHATSAPP_TASK_TEMPLATE = "corject_task_assignment";
process.env.WHATSAPP_TEMPLATE_LANGUAGE = "tr";
process.env.WHATSAPP_GRAPH_VERSION = "v26.0";
process.env.APP_BASE_URL = "https://corject.example.com";

test("sendTaskAssignedWhatsApp sends the approved task template", async () => {
  let request;
  const result = await sendTaskAssignedWhatsApp(
    {
      assignee: { id: "person-1", phone: "+90 (555) 123 45 67", whatsappEnabled: true },
      assigner: { name: "Hakan" },
      task: { id: "task-1", title: "Müşteri görüşmesi", dueDate: "2026-06-15" },
    },
    {
      fetchImpl: async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({ messages: [{ id: "wamid-1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://graph.facebook.com/v26.0/123456789/messages");
  assert.equal(request.options.headers.Authorization, "Bearer whatsapp-test-token");
  assert.equal(body.to, "905551234567");
  assert.equal(body.template.name, "corject_task_assignment");
  assert.match(body.template.components[0].parameters[3].text, /task=task-1/);
  assert.doesNotMatch(request.options.body, /whatsapp-test-token/);
  assert.equal(result.id, "wamid-1");
});

test("sendTaskAssignedWhatsApp skips users who disabled WhatsApp", async () => {
  const result = await sendTaskAssignedWhatsApp({
    assignee: { id: "person-1", phone: "905551234567", whatsappEnabled: false },
    assigner: { name: "Hakan" },
    task: { id: "task-1", title: "Test" },
  });
  assert.equal(result.skipped, true);
});
