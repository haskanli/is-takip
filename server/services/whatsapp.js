import { getWhatsAppConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";
import { userTaskUrl } from "./email.js";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

export const sendTaskAssignedWhatsApp = async (
  { assignee, task, assigner },
  { fetchImpl = fetch } = {},
) => {
  const config = getWhatsAppConfig();
  const to = normalizePhone(assignee.phone);
  if (!config.accessToken || !config.phoneNumberId || !to || assignee.whatsappEnabled === false) {
    logger.warn("whatsapp.skipped.not-configured", { userId: assignee.id });
    return { skipped: true };
  }

  const link = userTaskUrl(assignee.id, task.id);
  const response = await withRetry(
    () =>
      fetchImpl(
        `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: config.templateName,
              language: { code: config.templateLanguage },
              components: [{
                type: "body",
                parameters: [
                  { type: "text", text: assigner.name },
                  { type: "text", text: task.title },
                  { type: "text", text: task.dueDate || "Belirtilmedi" },
                  { type: "text", text: link || "Corject uygulaması" },
                ],
              }],
            },
          }),
        },
      ),
    {
      retries: 3,
      shouldRetry: (error) => !error?.status || error.status === 429 || error.status >= 500,
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw Object.assign(new Error(`WhatsApp message could not be sent (${response.status}): ${message}`), {
      status: response.status,
    });
  }
  const result = await response.json();
  const messageId = result.messages?.[0]?.id || null;
  logger.info("whatsapp.sent", { messageId, userId: assignee.id });
  return { id: messageId };
};
