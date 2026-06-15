const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const taskStats = (project) => {
  const tasks = (project.milestones || []).flatMap((milestone) => milestone.tasks || []);
  const done = tasks.filter((task) => String(task.status).includes("Tamamland")).length;
  const overdue = tasks.filter((task) => {
    if (!task.dueDate || String(task.status).includes("Tamamland")) return false;
    return new Date(`${task.dueDate}T23:59:59`) < new Date();
  }).length;
  return {
    total: tasks.length,
    done,
    overdue,
    progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
};

const frame = ({ eyebrow, title, intro, content }) => `
  <div style="margin:0;background:#eef2ff;padding:30px 12px;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:720px;margin:auto;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 16px 38px rgba(49,46,129,.14)">
      <div style="background:linear-gradient(135deg,#172554,#4338ca 55%,#7c3aed);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;color:#c7d2fe;font-weight:800">${escapeHtml(eyebrow)}</div>
        <h1 style="font-size:25px;margin:8px 0">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#e0e7ff;line-height:1.55">${escapeHtml(intro)}</p>
      </div>
      <div style="padding:26px">${content}</div>
    </div>
  </div>`;

export const createProjectStatusReport = ({ project }) => {
  const stats = taskStats(project);
  const risks = (project.risks || []).filter((risk) => !String(risk.status).includes("Kapal"));
  const cards = [
    ["İlerleme", `%${stats.progress}`, `${stats.done}/${stats.total} görev tamamlandı`, "#4A6CF7"],
    ["Geciken Görev", stats.overdue, "Termin tarihi geçen açık işler", "#E11D48"],
    ["Açık Risk", risks.length, "Takip gerektiren proje riskleri", "#7C3AED"],
  ].map(([label, value, note, color]) => `
    <td style="width:33%;padding:6px"><div style="border:1px solid #e2e8f0;border-top:4px solid ${color};border-radius:14px;padding:16px;text-align:center">
      <div style="font-size:10px;color:#64748b;font-weight:800">${label}</div><div style="font-size:28px;color:${color};font-weight:900;margin:5px 0">${value}</div><div style="font-size:10px;color:#94a3b8">${note}</div>
    </div></td>`).join("");
  const milestones = (project.milestones || []).map((milestone) => {
    const data = taskStats({ milestones: [milestone] });
    return `<tr><td style="padding:9px;border-bottom:1px solid #e2e8f0;font-weight:700">${escapeHtml(milestone.name)}</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${data.done}/${data.total}</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">%${data.progress}</td><td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(milestone.dueDate || "-")}</td></tr>`;
  }).join("");
  return frame({
    eyebrow: "CORJECT · OTOMATİK PROJE RAPORU",
    title: project.name,
    intro: "Projenin güncel ilerleme, termin ve risk özeti.",
    content: `<table style="width:100%;table-layout:fixed;border-spacing:0"><tr>${cards}</tr></table><h2 style="font-size:15px;margin:24px 0 9px">Milestone Özeti</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left;padding:9px;background:#f8fafc">Milestone</th><th style="text-align:left;padding:9px;background:#f8fafc">Görev</th><th style="text-align:left;padding:9px;background:#f8fafc">İlerleme</th><th style="text-align:left;padding:9px;background:#f8fafc">Termin</th></tr></thead><tbody>${milestones || '<tr><td colspan="4" style="padding:16px;color:#94a3b8">Milestone bulunmuyor.</td></tr>'}</tbody></table>`,
  });
};

export const createJiraNewsletter = ({ project, tickets }) => {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const done = (tickets || []).filter((ticket) => {
    const status = `${ticket.jiraStatus || ""} ${ticket.status || ""}`.toLocaleLowerCase("tr-TR");
    const changedAt = new Date(ticket.jiraUpdatedAt || ticket.updatedAt || ticket.createdAt || 0).getTime();
    return (status.includes("done") || status.includes("tamamland")) && changedAt >= since;
  });
  const stories = done.map((ticket) => `
    <div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin-bottom:12px;background:linear-gradient(145deg,#fff,#f8fafc)">
      <div style="font-size:10px;color:#4f46e5;font-weight:900;letter-spacing:1px">${escapeHtml(ticket.jiraKey || ticket.ticketNo || "GELİŞTİRME")}</div>
      <h2 style="font-size:18px;margin:7px 0">${escapeHtml(ticket.title)}</h2>
      <p style="font-size:12px;color:#64748b;line-height:1.65;margin:0">${escapeHtml(ticket.description || "Bu geliştirme tamamlandı ve kullanıma hazır.")}</p>
    </div>`).join("");
  return frame({
    eyebrow: "CORJECT · HAFTALIK GELİŞTİRMELER",
    title: `${project.name} Geliştirme Bülteni`,
    intro: "Jira üzerinde son yedi günde tamamlanan çalışmalar.",
    content: stories || '<div style="padding:28px;text-align:center;color:#64748b;background:#f8fafc;border-radius:14px">Bu hafta tamamlanan Jira geliştirmesi bulunmuyor.</div>',
  });
};

export const nextScheduledRun = (schedule, from = new Date()) => {
  const next = new Date(from);
  if (schedule.frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
};
