const baseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
const secret = process.env.REMINDER_CRON_SECRET;

if (!baseUrl || !secret) {
  throw new Error("APP_BASE_URL and REMINDER_CRON_SECRET are required");
}

for (const path of ["/tasks/recurring/run", "/email/reminders", "/reports/scheduled/run"]) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  }
  console.log(path, await response.text());
}
