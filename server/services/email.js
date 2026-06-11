import { getEmailConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const userTaskUrl = (userId) => {
  const { appBaseUrl } = getEmailConfig();
  if (!appBaseUrl) return "";
  const url = new URL(appBaseUrl);
  url.searchParams.set("user", userId);
  url.searchParams.set("view", "mytasks");
  return url.toString();
};

export const sendEmail = async ({ to, subject, html }, { fetchImpl = fetch } = {}) => {
  const config = getEmailConfig();
  if (!config.apiKey || !config.from) {
    logger.warn("email.skipped.not-configured", { to, subject });
    return { skipped: true };
  }

  const response = await withRetry(
    () =>
      fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: config.from, to: [to], subject, html }),
      }),
    {
      retries: 3,
      shouldRetry: (error) => !error?.status || error.status === 429 || error.status >= 500,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw Object.assign(new Error(`Email could not be sent (${response.status}): ${message}`), {
      status: response.status,
    });
  }

  const result = await response.json();
  logger.info("email.sent", { id: result.id, to, subject });
  return result;
};

export const sendTicketAssignedEmail = ({ assignee, ticket, project }) => {
  const link = userTaskUrl(assignee.id);
  return sendEmail({
    to: assignee.email,
    subject: `[Corject] Yeni ticket atandı: ${ticket.title}`,
    html: `<div style="font-family:Arial,sans-serif;color:#172033">
      <h2 style="color:#4338ca">Yeni ticket ataması</h2>
      <p><b>${escapeHtml(project.name)}</b> projesinde size bir ticket atandı.</p>
      <div style="padding:14px;border-left:4px solid #4A6CF7;background:#f8fafc">
        <b>${escapeHtml(ticket.title)}</b>
        <p>${escapeHtml(ticket.description || "Açıklama girilmedi.")}</p>
        <small>Öncelik: ${escapeHtml(ticket.priority)} · Durum: ${escapeHtml(ticket.status)}</small>
      </div>
      ${link ? `<p><a href="${link}" style="display:inline-block;background:#4A6CF7;color:#fff;padding:10px 15px;border-radius:8px;text-decoration:none">Görevlerimi Aç</a></p>` : ""}
    </div>`,
  });
};

export const sendOverdueReminderEmail = ({ assignee, tasks }) => {
  const link = userTaskUrl(assignee.id);
  const rows = tasks
    .map(
      ({ title, projectName, dueDate, days }) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(title)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(projectName)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(dueDate)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#dc2626;font-weight:bold">${days} gün</td></tr>`,
    )
    .join("");
  return sendEmail({
    to: assignee.email,
    subject: `[Corject] ${tasks.length} geciken göreviniz var`,
    html: `<div style="font-family:Arial,sans-serif;color:#172033">
      <h2 style="color:#dc2626">Geciken görev hatırlatması</h2>
      <p>Aşağıdaki görevlerin termin tarihi geçti:</p>
      <table style="width:100%;border-collapse:collapse"><thead><tr><th>Görev</th><th>Proje</th><th>Termin</th><th>Gecikme</th></tr></thead><tbody>${rows}</tbody></table>
      ${link ? `<p><a href="${link}" style="display:inline-block;background:#4A6CF7;color:#fff;padding:10px 15px;border-radius:8px;text-decoration:none">Görevlerimi Aç</a></p>` : ""}
    </div>`,
  });
};
