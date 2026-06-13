const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (name) => process.env[name]?.trim() || "";

export const getJiraConfig = () => ({
  baseUrl: required("JIRA_BASE_URL").replace(/\/+$/, ""),
  email: required("JIRA_EMAIL"),
  apiToken: required("JIRA_API_TOKEN"),
  projectKey: optional("JIRA_PROJECT_KEY"),
  webhookSecret: optional("JIRA_WEBHOOK_SECRET"),
});

export const getSupabaseConfig = () => ({
  url: optional("SUPABASE_URL") || required("VITE_SUPABASE_URL"),
  key:
    optional("SUPABASE_SERVICE_ROLE_KEY") ||
    required("VITE_SUPABASE_ANON_KEY"),
});

export const getServerConfig = () => ({
  port: Number(process.env.PORT || 3001),
  requestTimeoutMs: Number(process.env.JIRA_REQUEST_TIMEOUT_MS || 10000),
  retryCount: Number(process.env.JIRA_RETRY_COUNT || 3),
  allowedOrigins: [
    optional("APP_ORIGIN"),
    "https://corject.com",
    "https://www.corject.com",
  ].filter(Boolean),
  requireAuth: optional("REQUIRE_AUTH").toLowerCase() === "true",
  dataModel: optional("DATA_MODEL") || "legacy",
});

export const getEmailConfig = () => ({
  apiKey: optional("RESEND_API_KEY"),
  from: optional("EMAIL_FROM"),
  appBaseUrl: optional("APP_BASE_URL").replace(/\/+$/, ""),
  reminderSecret: optional("REMINDER_CRON_SECRET"),
});

export const getWhatsAppConfig = () => ({
  accessToken: optional("WHATSAPP_ACCESS_TOKEN"),
  phoneNumberId: optional("WHATSAPP_PHONE_NUMBER_ID"),
  templateName: optional("WHATSAPP_TASK_TEMPLATE") || "corject_task_assignment",
  templateLanguage: optional("WHATSAPP_TEMPLATE_LANGUAGE") || "tr",
  graphVersion: optional("WHATSAPP_GRAPH_VERSION") || "v26.0",
});

export const getSlackConfig = () => ({
  botToken: optional("SLACK_BOT_TOKEN"),
});

export const getVaultConfig = () => ({
  encryptionKey:
    optional("ACCESS_VAULT_KEY") ||
    required("SUPABASE_SERVICE_ROLE_KEY"),
});
