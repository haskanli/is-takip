import { getEmailConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";
import {
  renderManagedTemplate,
  resolveEmailTemplates,
} from "./emailTemplate.js";

const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export const normalizeReplyTo = (value) => {
  const replyTo = String(value || "").trim();
  if (!replyTo) return "";
  if (EMAIL_ADDRESS_PATTERN.test(replyTo)) return replyTo;
  const named = replyTo.match(/^([^<>\r\n]+)\s*<([^<>]+)>$/);
  if (!named || !EMAIL_ADDRESS_PATTERN.test(named[2].trim())) return "";
  const name = named[1].replace(/["\r\n]/g, "").trim();
  return name ? `${name} <${named[2].trim()}>` : named[2].trim();
};

export const userTaskUrl = (userId, taskId = "") => {
  const { appBaseUrl } = getEmailConfig();
  if (!appBaseUrl) return "";
  const url = new URL(appBaseUrl);
  url.pathname = "/my-tasks";
  url.searchParams.set("user", userId);
  if (taskId) url.searchParams.set("task", taskId);
  return url.toString();
};

export const userTicketUrl = (userId, projectId, ticketId) => {
  const { appBaseUrl } = getEmailConfig();
  if (!appBaseUrl) return "";
  const url = new URL(appBaseUrl);
  url.pathname = "/ticketlar";
  url.searchParams.set("user", userId);
  url.searchParams.set("project", projectId);
  url.searchParams.set("ticket", ticketId);
  return url.toString();
};

export const sendEmail = async (
  { to, subject, html, replyTo = "", senderName = "" },
  { fetchImpl = fetch } = {},
) => {
  const config = getEmailConfig();
  if (!config.apiKey || !config.from) {
    logger.warn("email.skipped.not-configured", { to, subject });
    return { skipped: true };
  }
  const senderAddress =
    config.from.match(/<([^>]+)>/)?.[1] || config.from;
  const safeSenderName = String(senderName || "")
    .replace(/[\r\n<>"]/g, "")
    .trim();
  const from = safeSenderName
    ? `${safeSenderName} via Corject <${senderAddress}>`
    : config.from;
  const validReplyTo = normalizeReplyTo(replyTo);
  if (replyTo && !validReplyTo) {
    logger.warn("email.reply-to.invalid-skipped", { replyTo: String(replyTo) });
  }
  const response = await withRetry(
    () => fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(validReplyTo ? { reply_to: validReplyTo } : {}),
      }),
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

export const sendTaskAssignedEmail = ({
  assignee,
  task,
  assigner,
  tenantProfile,
  emailTemplates,
}) => {
  const link = userTaskUrl(assignee.id, task.id);
  const template = resolveEmailTemplates(emailTemplates).find(
    (item) => item.id === "task_assignment",
  );
  const rendered = renderManagedTemplate({
    template,
    tenantProfile,
    actionUrl: link,
    variables: {
      recipient_name: assignee.name,
      assigner_name: assigner.name,
      task_title: task.title,
      task_description: task.notes || "Açıklama girilmedi.",
      due_date: task.dueDate || "Belirtilmedi",
    },
  });
  return sendEmail({
    to: assignee.email,
    ...rendered,
    replyTo: tenantProfile?.replyTo,
    senderName: tenantProfile?.name,
  });
};

export const sendTicketAssignedEmail = ({
  assignee,
  ticket,
  project,
  tenantProfile,
  emailTemplates,
}) => {
  const link = userTicketUrl(assignee.id, project.id, ticket.id);
  const template = resolveEmailTemplates(emailTemplates).find(
    (item) => item.id === "ticket_assignment",
  );
  const rendered = renderManagedTemplate({
    template,
    tenantProfile,
    actionUrl: link,
    variables: {
      recipient_name: assignee.name,
      project_name: project.name,
      ticket_title: ticket.title,
      ticket_description: ticket.description || "Açıklama girilmedi.",
      priority: ticket.priority || "-",
      status: ticket.status || "-",
    },
  });
  return sendEmail({
    to: assignee.email,
    ...rendered,
    replyTo: tenantProfile?.replyTo,
    senderName: tenantProfile?.name,
  });
};

export const sendOverdueReminderEmail = ({
  assignee,
  tasks,
  tenantProfile,
  emailTemplates,
}) => {
  const link = userTaskUrl(assignee.id);
  const template = resolveEmailTemplates(emailTemplates).find(
    (item) => item.id === "overdue_reminder",
  );
  const taskList = tasks
    .map(
      ({ title, projectName, dueDate, days }) =>
        `• ${title} · ${projectName} · ${dueDate} · ${days} gün gecikme`,
    )
    .join("\n");
  const rendered = renderManagedTemplate({
    template,
    tenantProfile,
    actionUrl: link,
    variables: {
      recipient_name: assignee.name,
      task_count: tasks.length,
      task_list: taskList,
    },
  });
  return sendEmail({
    to: assignee.email,
    ...rendered,
    replyTo: tenantProfile?.replyTo,
    senderName: tenantProfile?.name,
  });
};
