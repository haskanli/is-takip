import { getEmailConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";
import { emailButton, emailFrame, escapeHtml } from "./emailTemplate.js";

export const userTaskUrl = (userId, taskId = "") => {
  const { appBaseUrl } = getEmailConfig();
  if (!appBaseUrl) return "";
  const url = new URL(appBaseUrl);
  url.searchParams.set("user", userId);
  url.searchParams.set("view", "mytasks");
  if (taskId) url.searchParams.set("task", taskId);
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
    () => fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
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

export const sendTaskAssignedEmail = ({ assignee, task, assigner }) => {
  const link = userTaskUrl(assignee.id, task.id);
  return sendEmail({
    to: assignee.email,
    subject: `[Corject] ${assigner.name} size bir görev atadı: ${task.title}`,
    html: emailFrame({
      eyebrow: "YENİ GÖREV ATAMASI",
      title: "Yeni bir göreviniz var",
      intro: `${assigner.name} tarafından size yeni bir görev atandı.`,
      accent: "#22c55e",
      content: `
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#475569">Merhaba <strong style="color:#172033">${escapeHtml(assignee.name)}</strong>, görevinizin ayrıntıları aşağıdadır.</p>
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f0fdf4" style="border:1px solid #bbf7d0;border-left:6px solid #22c55e;border-radius:16px">
          <tr><td style="padding:22px">
            <div style="font-size:20px;line-height:27px;font-weight:900;color:#172033">${escapeHtml(task.title)}</div>
            <p style="margin:10px 0 18px;font-size:14px;line-height:23px;color:#475569">${escapeHtml(task.notes || "Açıklama girilmedi.")}</p>
            <span style="display:inline-block;padding:7px 11px;background:#ffffff;border-radius:9px;font-size:12px;font-weight:800;color:#166534">Termin: ${escapeHtml(task.dueDate || "Belirtilmedi")}</span>
          </td></tr>
        </table>
        ${emailButton("Görevi Aç", link)}`,
    }),
  });
};

export const sendTicketAssignedEmail = ({ assignee, ticket, project }) => {
  const link = userTicketUrl(assignee.id, project.id, ticket.id);
  return sendEmail({
    to: assignee.email,
    subject: `[Corject] Yeni ticket atandı: ${ticket.title}`,
    html: emailFrame({
      eyebrow: "YENİ TICKET ATAMASI",
      title: "Yeni bir ticket size atandı",
      intro: `${project.name} projesindeki ticket için aksiyonunuz bekleniyor.`,
      accent: "#f97316",
      content: `
        <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:#475569">Merhaba <strong style="color:#172033">${escapeHtml(assignee.name)}</strong>, ticket ayrıntıları aşağıdadır.</p>
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#fff7ed" style="border:1px solid #fed7aa;border-left:6px solid #f97316;border-radius:16px">
          <tr><td style="padding:22px">
            <div style="font-size:12px;font-weight:900;letter-spacing:1px;color:#c2410c">${escapeHtml(project.name)}</div>
            <div style="margin-top:6px;font-size:20px;line-height:27px;font-weight:900;color:#172033">${escapeHtml(ticket.title)}</div>
            <p style="margin:10px 0 18px;font-size:14px;line-height:23px;color:#475569">${escapeHtml(ticket.description || "Açıklama girilmedi.")}</p>
            <span style="display:inline-block;padding:7px 11px;background:#ffffff;border-radius:9px;font-size:12px;font-weight:800;color:#c2410c">Öncelik: ${escapeHtml(ticket.priority || "-")}</span>
            <span style="display:inline-block;margin-left:6px;padding:7px 11px;background:#ffffff;border-radius:9px;font-size:12px;font-weight:800;color:#4338ca">Durum: ${escapeHtml(ticket.status || "-")}</span>
          </td></tr>
        </table>
        ${emailButton("Ticket'ı Aç", link)}`,
    }),
  });
};

export const sendOverdueReminderEmail = ({ assignee, tasks }) => {
  const link = userTaskUrl(assignee.id);
  const rows = tasks.map(({ title, projectName, dueDate, days }, index) => `
    <tr bgcolor="${index % 2 ? "#ffffff" : "#fff1f2"}">
      <td style="padding:12px 10px;border-bottom:1px solid #fecdd3;font-weight:700;color:#172033">${escapeHtml(title)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #fecdd3;color:#475569">${escapeHtml(projectName)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #fecdd3;color:#475569">${escapeHtml(dueDate)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #fecdd3;color:#be123c;font-weight:900">${escapeHtml(days)} gün</td>
    </tr>`).join("");
  return sendEmail({
    to: assignee.email,
    subject: `[Corject] ${tasks.length} geciken göreviniz var`,
    html: emailFrame({
      eyebrow: "TERMİN UYARISI",
      title: `${tasks.length} görevinizin termini geçti`,
      intro: "Aksiyon bekleyen gecikmiş görevleriniz aşağıda listelenmiştir.",
      accent: "#e11d48",
      content: `
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #fecdd3;border-radius:14px;overflow:hidden;font-size:12px">
          <thead><tr bgcolor="#be123c">
            <th align="left" style="padding:12px 10px;color:#ffffff">Görev</th>
            <th align="left" style="padding:12px 10px;color:#ffffff">Proje</th>
            <th align="left" style="padding:12px 10px;color:#ffffff">Termin</th>
            <th align="left" style="padding:12px 10px;color:#ffffff">Gecikme</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${emailButton("Görevlerimi Aç", link)}`,
    }),
  });
};
