import { getSlackConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";
import { userTaskUrl } from "./email.js";

const slackRequest = async (method, body, token, fetchImpl) => {
  const response = await withRetry(
    () =>
      fetchImpl(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(body),
      }),
    {
      retries: 3,
      shouldRetry: (error) =>
        !error?.status || error.status === 429 || error.status >= 500,
    },
  );
  if (!response.ok) {
    const message = await response.text();
    throw Object.assign(
      new Error(`Slack request failed (${response.status}): ${message}`),
      { status: response.status },
    );
  }
  const result = await response.json();
  if (!result.ok) {
    throw Object.assign(new Error(`Slack ${method} failed: ${result.error}`), {
      status: result.error === "ratelimited" ? 429 : 400,
    });
  }
  return result;
};

const lookupSlackUserByEmail = async (email, token, fetchImpl) => {
  const url = new URL("https://slack.com/api/users.lookupByEmail");
  url.searchParams.set("email", email);
  const response = await withRetry(
    () =>
      fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    {
      retries: 3,
      shouldRetry: (error) =>
        !error?.status || error.status === 429 || error.status >= 500,
    },
  );
  if (!response.ok) {
    throw Object.assign(
      new Error(`Slack user lookup failed (${response.status})`),
      { status: response.status },
    );
  }
  const result = await response.json();
  if (!result.ok) {
    throw Object.assign(
      new Error(`Slack users.lookupByEmail failed: ${result.error}`),
      { status: result.error === "ratelimited" ? 429 : 400 },
    );
  }
  return result.user;
};

export const sendTaskAssignedSlack = async (
  { assignee, task, assigner },
  { fetchImpl = fetch } = {},
) => {
  const { botToken } = getSlackConfig();
  if (!botToken || !assignee?.email) {
    logger.warn("slack.skipped.not-configured", { userId: assignee?.id });
    return { skipped: true };
  }

  const user = await lookupSlackUserByEmail(
    assignee.email.trim().toLowerCase(),
    botToken,
    fetchImpl,
  );
  const link = userTaskUrl(assignee.id, task.id);
  const fields = [
    { type: "mrkdwn", text: `*Atayan:*\n${assigner.name}` },
    { type: "mrkdwn", text: `*Termin:*\n${task.dueDate || "Belirtilmedi"}` },
  ];
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "Yeni görev ataması", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${task.title}*\n${task.notes || "Açıklama girilmedi."}`,
      },
      fields,
    },
  ];
  if (link) {
    blocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "Görevi Aç", emoji: true },
        url: link,
        style: "primary",
      }],
    });
  }

  const message = await slackRequest(
    "chat.postMessage",
    {
      channel: user.id,
      text: `${assigner.name} size bir görev atadı: ${task.title}`,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    },
    botToken,
    fetchImpl,
  );
  logger.info("slack.task-assignment.sent", {
    userId: assignee.id,
    slackUserId: user.id,
    messageId: message.ts,
  });
  return { id: message.ts, slackUserId: user.id };
};
