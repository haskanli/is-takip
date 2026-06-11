const baseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
const secret = process.env.REMINDER_CRON_SECRET;

if (!baseUrl || !secret) {
  throw new Error("APP_BASE_URL and REMINDER_CRON_SECRET are required");
}

const response = await fetch(`${baseUrl}/email/reminders`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

if (!response.ok) {
  throw new Error(`Reminder job failed (${response.status}): ${await response.text()}`);
}

console.log(await response.text());
