import assert from "node:assert/strict";
import test from "node:test";
import { sendEmail, userTaskUrl, userTicketUrl } from "../server/services/email.js";
import { assignTasksWithNotification, createTicketWithNotification, notifyTicketAssignment } from "../src/email.js";

process.env.RESEND_API_KEY = "resend-test-key";
process.env.EMAIL_FROM = "Corject <test@example.com>";
process.env.APP_BASE_URL = "https://corject.example.com";

test("userTaskUrl creates a direct My Tasks link", () => {
  assert.equal(
    userTaskUrl("person-1"),
    "https://corject.example.com/?user=person-1&view=mytasks",
  );
  assert.equal(
    userTaskUrl("person-1", "task-1"),
    "https://corject.example.com/?user=person-1&view=mytasks&task=task-1",
  );
});

test("userTicketUrl creates a direct ticket link", () => {
  assert.equal(
    userTicketUrl("person-1", "project-1", "ticket-1"),
    "https://corject.example.com/?user=person-1&view=tickets&project=project-1&ticket=ticket-1",
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
