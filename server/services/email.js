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

export const userTicketUrl = (userId, projectId, ticketId) => {
  const { appBaseUrl } = getEmailConfig();
  if (!appBaseUrl) return "";
  const url = new URL(appBaseUrl);
  url.searchParams.set("user", userId);
  url.searchParams.set("view", "tickets");
  url.searchParams.set("project", projectId);
  url.searchParams.set("ticket", ticketId);
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
  const link = userTicketUrl(assignee.id, project.id, ticket.id);
  const { appBaseUrl } = getEmailConfig();
  const logoUrl = appBaseUrl ? `${appBaseUrl}/corject-logo.png` : "";
  return sendEmail({
    to: assignee.email,
    subject: `[Corject] Yeni ticket atandı: ${ticket.title}`,
    html: `<div style="margin:0;background:#eef2ff;padding:28px 12px;font-family:Arial,sans-serif;color:#172033">
      <div style="max-width:620px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(49,46,129,.12)">
        <div style="background:linear-gradient(135deg,#172554,#4338ca 60%,#7c3aed);padding:24px 28px;color:#fff">
          <div style="display:flex;align-items:center;gap:12px">
            ${logoUrl ? `<img src="${logoUrl}" width="52" height="52" alt="Corject" style="display:block">` : ""}
            <div><div style="font-size:12px;letter-spacing:2px;color:#c7d2fe">CORJECT</div><div style="font-size:22px;font-weight:800;margin-top:3px">Yeni ticket ataması</div></div>
          </div>
        </div>
        <div style="padding:26px 28px">
          <p style="margin:0 0 18px;color:#475569">Merhaba ${escapeHtml(assignee.name)}, <b>${escapeHtml(project.name)}</b> projesinde size yeni bir ticket atandı.</p>
          <div style="padding:18px;border:1px solid #e2e8f0;border-left:5px solid #4A6CF7;border-radius:12px;background:#f8fafc">
            <div style="font-size:17px;font-weight:800">${escapeHtml(ticket.title)}</div>
            <p style="color:#64748b;line-height:1.6;margin:9px 0 14px">${escapeHtml(ticket.description || "Açıklama girilmedi.")}</p>
            <span style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700">Öncelik: ${escapeHtml(ticket.priority)}</span>
            <span style="display:inline-block;background:#eef2ff;color:#4338ca;border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700;margin-left:5px">Durum: ${escapeHtml(ticket.status)}</span>
          </div>
          ${link ? `<p style="margin:22px 0 4px"><a href="${link}" style="display:inline-block;background:#4A6CF7;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Ticketı Aç</a></p>` : ""}
          <p style="font-size:11px;color:#94a3b8;margin-top:22px">Bu bildirim Corject proje yönetim sistemi tarafından gönderildi.</p>
        </div>
      </div>
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
