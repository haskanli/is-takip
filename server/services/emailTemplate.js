export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const emailButton = (label, href) =>
  href
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:24px">
        <tr><td bgcolor="#5b4df7" style="border-radius:12px">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(label)}</a>
        </td></tr>
      </table>`
    : "";

export const emailFrame = ({
  eyebrow = "CORJECT BİLDİRİMİ",
  title,
  intro = "",
  content = "",
  accent = "#5b4df7",
}) => `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eef2ff;color:#172033;font-family:Arial,'Helvetica Neue',sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(intro || title)}</div>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#eef2ff">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width:720px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 45px rgba(49,46,129,.16)">
          <tr><td bgcolor="#172554" style="padding:30px 34px;border-bottom:6px solid ${accent}">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td width="86" valign="middle">
                  <table role="presentation" width="76" height="76" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:20px">
                    <tr><td align="center" valign="middle">
                      <img src="https://www.corject.com/corject-logo.png" width="66" height="66" alt="Corject" style="display:block;width:66px;height:66px;border:0">
                    </td></tr>
                  </table>
                </td>
                <td valign="middle" style="padding-left:16px">
                  <div style="font-size:31px;line-height:34px;font-weight:900;letter-spacing:-.5px;color:#ffffff">Corject</div>
                  <div style="margin-top:5px;font-size:11px;line-height:15px;font-weight:800;letter-spacing:2px;color:#c7d2fe">PROJECT INTELLIGENCE</div>
                </td>
              </tr>
            </table>
            <div style="margin-top:28px;font-size:11px;line-height:16px;font-weight:900;letter-spacing:1.6px;color:#a5b4fc">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:8px 0 0;font-size:30px;line-height:38px;font-weight:900;letter-spacing:-.5px;color:#ffffff">${escapeHtml(title)}</h1>
            ${intro ? `<p style="margin:12px 0 0;font-size:15px;line-height:24px;color:#e0e7ff">${escapeHtml(intro)}</p>` : ""}
          </td></tr>
          <tr><td style="padding:30px 34px">${content}</td></tr>
          <tr><td bgcolor="#f8fafc" style="padding:18px 34px;border-top:1px solid #e2e8f0">
            <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:11px;line-height:17px;color:#64748b"><strong style="color:#4338ca">Corject</strong> · Proje ve operasyon yönetim platformu</td>
                <td align="right" style="font-size:11px;line-height:17px;color:#94a3b8">info@corject.com</td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
