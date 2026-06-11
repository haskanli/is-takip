import assert from "node:assert/strict";
import test from "node:test";
import { sendEmail, userTaskUrl, userTicketUrl } from "../server/services/email.js";

process.env.RESEND_API_KEY = "resend-test-key";
process.env.EMAIL_FROM = "Corject <test@example.com>";
process.env.APP_BASE_URL = "https://corject.example.com";

test("userTaskUrl creates a direct My Tasks link", () => {
  assert.equal(
    userTaskUrl("person-1"),
    "https://corject.example.com/?user=person-1&view=mytasks",
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
