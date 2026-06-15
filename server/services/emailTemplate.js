export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const safeUrl = (value) => {
  const source = String(value || "");
  if (/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source)) {
    return source;
  }
  try {
    const url = new URL(source);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const safeColor = (value, fallback = "#5b4df7") =>
  /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;

export const DEFAULT_TENANT_PROFILE = {
  name: "Corject",
  logoUrl: "",
  accentColor: "#5b4df7",
  replyTo: "",
};

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: "task_assignment",
    name: "Görev Ataması",
    category: "Bildirim",
    subject: "{{assigner_name}} size bir görev atadı: {{task_title}}",
    eyebrow: "YENİ GÖREV ATAMASI",
    title: "Yeni bir göreviniz var",
    intro: "{{assigner_name}} tarafından size yeni bir görev atandı.",
    body: "Merhaba {{recipient_name}},\n\n{{task_title}}\n{{task_description}}\n\nTermin: {{due_date}}",
    buttonLabel: "Görevi Aç",
    accentColor: "#22c55e",
    enabled: true,
  },
  {
    id: "ticket_assignment",
    name: "Ticket Ataması",
    category: "Bildirim",
    subject: "Yeni ticket atandı: {{ticket_title}}",
    eyebrow: "YENİ TICKET ATAMASI",
    title: "Yeni bir ticket size atandı",
    intro: "{{project_name}} projesindeki ticket için aksiyonunuz bekleniyor.",
    body: "Merhaba {{recipient_name}},\n\n{{ticket_title}}\n{{ticket_description}}\n\nÖncelik: {{priority}}\nDurum: {{status}}",
    buttonLabel: "Ticket'ı Aç",
    accentColor: "#f97316",
    enabled: true,
  },
  {
    id: "overdue_reminder",
    name: "Termin Hatırlatması",
    category: "Hatırlatma",
    subject: "{{task_count}} geciken göreviniz var",
    eyebrow: "TERMİN UYARISI",
    title: "{{task_count}} görevinizin termini geçti",
    intro: "Aksiyon bekleyen gecikmiş görevleriniz aşağıda listelenmiştir.",
    body: "Merhaba {{recipient_name}},\n\nTermin tarihi geçen {{task_count}} göreviniz bulunuyor.\n\n{{task_list}}",
    buttonLabel: "Görevlerimi Aç",
    accentColor: "#e11d48",
    enabled: true,
  },
  {
    id: "project_report",
    name: "Proje Durum Raporu",
    category: "Rapor",
    subject: "{{project_name}} otomatik durum raporu",
    eyebrow: "OTOMATİK PROJE RAPORU",
    title: "{{project_name}}",
    intro: "Projenin güncel ilerleme, termin ve risk özeti.",
    body: "Bu şablon otomatik proje raporu içeriğini ve görsel KPI kartlarını kullanır.",
    buttonLabel: "",
    accentColor: "#06b6d4",
    enabled: true,
  },
  {
    id: "jira_newsletter",
    name: "Haftalık Geliştirme Bülteni",
    category: "Bülten",
    subject: "{{project_name}} haftalık geliştirmeler",
    eyebrow: "HAFTALIK GELİŞTİRMELER",
    title: "{{project_name}} Geliştirme Bülteni",
    intro: "Jira üzerinde son yedi günde tamamlanan çalışmalar.",
    body: "Bu şablon Jira üzerinde tamamlanan geliştirmeleri dergi görünümünde listeler.",
    buttonLabel: "",
    accentColor: "#f59e0b",
    enabled: true,
  },
];

export const resolveTenantProfile = (profile = {}) => ({
  ...DEFAULT_TENANT_PROFILE,
  ...profile,
  name: String(profile.name || DEFAULT_TENANT_PROFILE.name).trim(),
  logoUrl: safeUrl(profile.logoUrl),
  accentColor: safeColor(profile.accentColor, DEFAULT_TENANT_PROFILE.accentColor),
  replyTo: String(profile.replyTo || "").trim(),
});

export const resolveEmailTemplates = (templates = []) =>
  DEFAULT_EMAIL_TEMPLATES.map((fallback) => ({
    ...fallback,
    ...(templates.find((item) => item.id === fallback.id) || {}),
  })).concat(
    templates.filter(
      (item) => !DEFAULT_EMAIL_TEMPLATES.some((fallback) => fallback.id === item.id),
    ),
  );

export const fillTemplate = (value, variables = {}) =>
  String(value || "").replace(/\{\{([a-z0-9_]+)\}\}/gi, (_match, key) =>
    String(variables[key] ?? ""),
  );

export const templateBodyHtml = (value, variables = {}) =>
  fillTemplate(value, variables)
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:23px;color:#475569">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");

export const emailButton = (label, href, accent = "#5b4df7") =>
  href && label
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:24px">
        <tr><td bgcolor="${safeColor(accent)}" style="border-radius:12px">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(label)}</a>
        </td></tr>
      </table>`
    : "";

export const emailFrame = ({
  tenantProfile,
  eyebrow = "BİLDİRİM",
  title,
  intro = "",
  content = "",
  accent,
}) => {
  const tenant = resolveTenantProfile(tenantProfile);
  const accentColor = safeColor(accent, tenant.accentColor);
  const logo = tenant.logoUrl
    ? `<img src="${escapeHtml(tenant.logoUrl)}" width="58" height="58" alt="${escapeHtml(tenant.name)}" style="display:block;max-width:58px;max-height:58px;border:0;object-fit:contain">`
    : `<div style="font-size:25px;line-height:58px;font-weight:900;color:${accentColor}">${escapeHtml(tenant.name.slice(0, 2).trim().toUpperCase())}</div>`;
  const attribution = tenant.name.toLocaleLowerCase("tr-TR") === "corject"
    ? "Powered by <strong style=\"color:#64748b\">Corject</strong>"
    : `Sent by <strong style="color:#64748b">Corject</strong> for <strong style="color:#64748b">${escapeHtml(tenant.name)}</strong>`;
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;color:#172033;font-family:Arial,'Helvetica Neue',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(intro || title)}</div>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:720px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 16px 40px rgba(15,23,42,.12)">
          <tr><td bgcolor="#ffffff" style="padding:26px 32px;border-bottom:5px solid ${accentColor}">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="72" valign="middle">
                  <table role="presentation" width="62" height="62" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="border:1px solid #e2e8f0;border-radius:16px">
                    <tr><td align="center" valign="middle">${logo}</td></tr>
                  </table>
                </td>
                <td valign="middle" style="padding-left:14px">
                  <div style="font-size:26px;line-height:31px;font-weight:900;letter-spacing:-.3px;color:#172033">${escapeHtml(tenant.name)}</div>
                  <div style="margin-top:4px;font-size:10px;line-height:15px;font-weight:800;letter-spacing:1.5px;color:${accentColor}">${escapeHtml(eyebrow)}</div>
                </td>
              </tr>
            </table>
            <h1 style="margin:24px 0 0;font-size:29px;line-height:37px;font-weight:900;letter-spacing:-.4px;color:#172033">${escapeHtml(title)}</h1>
            ${intro ? `<p style="margin:10px 0 0;font-size:15px;line-height:24px;color:#64748b">${escapeHtml(intro)}</p>` : ""}
          </td></tr>
          <tr><td style="padding:30px 32px">${content}</td></tr>
          <tr><td bgcolor="#f8fafc" style="padding:16px 32px;border-top:1px solid #e2e8f0">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:10px;line-height:16px;color:#94a3b8">${attribution}</td>
                <td align="right"><img src="https://www.corject.com/corject-logo.png" width="22" height="22" alt="Corject" style="display:block;width:22px;height:22px;border:0;opacity:.72"></td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
};

export const renderManagedTemplate = ({
  template,
  tenantProfile,
  variables = {},
  actionUrl = "",
}) => {
  const tenant = resolveTenantProfile(tenantProfile);
  const accent = safeColor(template.accentColor, tenant.accentColor);
  return {
    subject: fillTemplate(template.subject, variables),
    html: emailFrame({
      tenantProfile: tenant,
      eyebrow: fillTemplate(template.eyebrow, variables),
      title: fillTemplate(template.title, variables),
      intro: fillTemplate(template.intro, variables),
      accent,
      content: `${templateBodyHtml(template.body, variables)}${emailButton(
        fillTemplate(template.buttonLabel, variables),
        actionUrl,
        accent,
      )}`,
    }),
  };
};
