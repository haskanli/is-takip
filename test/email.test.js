import assert from "node:assert/strict";
import test from "node:test";
import {
  sendEmail,
  sendTaskAssignedEmail,
  normalizeReplyTo,
  userTaskUrl,
  userTicketUrl,
} from "../server/services/email.js";
import { renderManagedTemplate } from "../server/services/emailTemplate.js";
import { assignTasksWithNotification, createTicketWithNotification, notifyTicketAssignment } from "../src/email.js";

process.env.RESEND_API_KEY = "resend-test-key";
process.env.EMAIL_FROM = "Corject <test@example.com>";
process.env.APP_BASE_URL = "https://corject.example.com";

test("userTaskUrl creates a direct My Tasks link", () => {
  assert.equal(
    userTaskUrl("person-1"),
    "https://corject.example.com/my-tasks?user=person-1",
  );
  assert.equal(
    userTaskUrl("person-1", "task-1"),
    "https://corject.example.com/my-tasks?user=person-1&task=task-1",
  );
});

test("userTicketUrl creates a direct ticket link", () => {
  assert.equal(
    userTicketUrl("person-1", "project-1", "ticket-1"),
    "https://corject.example.com/ticketlar?user=person-1&project=project-1&ticket=ticket-1",
  );
});

test("sendEmail calls Resend without exposing the API key in the body", async () => {
  let request;
  const result = await sendEmail(
    { to: "user@example.com", subject: "Test", html: "<b>Hello</b>" },
    {
      fetchImpl: async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({ id: "email-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.Authorization, "Bearer resend-test-key");
  assert.doesNotMatch(request.options.body, /resend-test-key/);
  assert.equal(result.id, "email-1");
});

test("reply-to accepts valid formats and skips invalid values", async () => {
  assert.equal(normalizeReplyTo("info@example.com"), "info@example.com");
  assert.equal(
    normalizeReplyTo("Örnek Firma <info@example.com>"),
    "Örnek Firma <info@example.com>",
  );
  assert.equal(normalizeReplyTo("info@example"), "");
  assert.equal(normalizeReplyTo("firma adı"), "");

  let payload;
  await sendEmail(
    {
      to: "user@example.com",
      subject: "Reply test",
      html: "<b>Test</b>",
      replyTo: "geçersiz adres",
    },
    {
      fetchImpl: async (_url, options) => {
        payload = JSON.parse(options.body);
        return new Response(JSON.stringify({ id: "email-reply" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  );
  assert.equal(payload.reply_to, undefined);
});

test("task email preserves Turkish text and uses the branded frame", async () => {
  const originalFetch = global.fetch;
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "email-2" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await sendTaskAssignedEmail({
      assignee: { id: "person-1", name: "Çağrı Şen", email: "user@example.com" },
      assigner: { name: "Hakan Haskanlı" },
      task: {
        id: "task-1",
        title: "Üretim görüşmesi",
        notes: "Çözüm önerisini görüş.",
        dueDate: "2026-06-20",
      },
      tenantProfile: { name: "A Firması", accentColor: "#22c55e" },
    });
    assert.match(payload.subject, /görev atadı/);
    assert.equal(payload.from, "A Firması via Corject <test@example.com>");
    assert.match(payload.html, /Çağrı Şen/);
    assert.match(payload.html, /Üretim görüşmesi/);
    assert.match(payload.html, /charset=UTF-8/i);
    assert.match(payload.html, /A Firması/);
    assert.match(payload.html, /Sent by/);
    assert.match(payload.html, /width="22"/);
    assert.doesNotMatch(payload.html, /�|Ã|Å/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("managed template uses tenant branding and escapes dynamic values", () => {
  const rendered = renderManagedTemplate({
    tenantProfile: {
      name: "Örnek Sanayi",
      logoUrl: "https://example.com/logo.png",
      accentColor: "#123456",
    },
    template: {
      subject: "{{project_name}} bilgilendirmesi",
      eyebrow: "DUYURU",
      title: "{{project_name}}",
      intro: "Güncel bilgi",
      body: "Merhaba {{recipient_name}}",
      buttonLabel: "Aç",
      accentColor: "#123456",
    },
    variables: {
      project_name: "MES <Pilot>",
      recipient_name: "<script>alert(1)</script>",
    },
    actionUrl: "https://example.com",
  });
  assert.equal(rendered.subject, "MES <Pilot> bilgilendirmesi");
  assert.match(rendered.html, /Örnek Sanayi/);
  assert.match(rendered.html, /example\.com\/logo\.png/);
  assert.match(rendered.html, /Sent by/);
  assert.doesNotMatch(rendered.html, /<script>/);
});

test("createTicketWithNotification creates the ticket through the server endpoint", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      ticket: { id: "ticket-1" },
      notification: { sent: true, emailId: "email-1" },
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await createTicketWithNotification("project-1", {
      id: "ticket-1",
      title: "Test ticket",
      assignedTo: "person-1",
    });
    assert.equal(request.url, "/tickets");
    assert.equal(JSON.parse(request.options.body).projectId, "project-1");
    assert.equal(result.notification.sent, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("notifyTicketAssignment rejects skipped email responses", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(
    JSON.stringify({ sent: false, reason: "Assignee has no email address" }),
    { status: 202, headers: { "Content-Type": "application/json" } },
  );
  try {
    await assert.rejects(
      notifyTicketAssignment("project-1", { id: "ticket-1", assignedTo: "person-1" }),
      /no email address/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("assignTasksWithNotification sends multi-assignee tasks through the server endpoint", async () => {
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      tasks: [{ id: "group-1-0" }, { id: "group-1-1" }],
      notifications: [{ sent: true }, { sent: true }],
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await assignTasksWithNotification({
      task: { title: "Takip" },
      assignerId: "admin-1",
      assigneeIds: ["person-1", "person-2"],
    });
    assert.equal(request.url, "/tasks/assign");
    assert.deepEqual(JSON.parse(request.options.body).assigneeIds, ["person-1", "person-2"]);
    assert.equal(result.tasks.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
