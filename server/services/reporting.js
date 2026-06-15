import { emailFrame, escapeHtml } from "./emailTemplate.js";

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

export const createProjectStatusReport = ({ project }) => {
  const stats = taskStats(project);
  const risks = (project.risks || []).filter((risk) => !String(risk.status).includes("Kapal"));
  const cards = [
    ["İLERLEME", `%${stats.progress}`, `${stats.done}/${stats.total} görev tamamlandı`, "#4f46e5", "#eef2ff"],
    ["GECİKEN GÖREV", stats.overdue, "Termin tarihi geçen açık işler", "#e11d48", "#fff1f2"],
    ["AÇIK RİSK", risks.length, "Takip gerektiren proje riskleri", "#7c3aed", "#faf5ff"],
  ].map(([label, value, note, color, background]) => `
    <td width="33.33%" valign="top" style="padding:5px">
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${background}" style="border:1px solid ${color};border-radius:15px">
        <tr><td align="center" style="padding:18px 10px">
          <div style="font-size:10px;line-height:15px;color:${color};font-weight:900;letter-spacing:.7px">${label}</div>
          <div style="font-size:29px;line-height:36px;color:${color};font-weight:900;margin:5px 0">${value}</div>
          <div style="font-size:10px;line-height:15px;color:#64748b">${note}</div>
        </td></tr>
      </table>
    </td>`).join("");
  const milestones = (project.milestones || []).map((milestone, index) => {
    const data = taskStats({ milestones: [milestone] });
    return `<tr bgcolor="${index % 2 ? "#ffffff" : "#f8fafc"}">
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:800;color:#172033">${escapeHtml(milestone.name)}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">${data.done}/${data.total}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:800;color:#4f46e5">%${data.progress}</td>
      <td style="padding:12px;border-bottom:1px solid #e2e8f0">${escapeHtml(milestone.dueDate || "-")}</td>
    </tr>`;
  }).join("");

  return emailFrame({
    eyebrow: "OTOMATİK PROJE RAPORU",
    title: project.name,
    intro: "Projenin güncel ilerleme, termin ve risk özeti.",
    accent: "#06b6d4",
    content: `
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>${cards}</tr></table>
      <h2 style="font-size:19px;line-height:26px;color:#172033;margin:28px 0 12px">Milestone Özeti</h2>
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;font-size:12px">
        <thead><tr bgcolor="#172554">
          <th align="left" style="padding:12px;color:#ffffff">Milestone</th>
          <th align="left" style="padding:12px;color:#ffffff">Görev</th>
          <th align="left" style="padding:12px;color:#ffffff">İlerleme</th>
          <th align="left" style="padding:12px;color:#ffffff">Termin</th>
        </tr></thead>
        <tbody>${milestones || '<tr><td colspan="4" style="padding:18px;color:#64748b">Milestone bulunmuyor.</td></tr>'}</tbody>
      </table>`,
  });
};

export const createJiraNewsletter = ({ project, tickets }) => {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const done = (tickets || []).filter((ticket) => {
    const status = `${ticket.jiraStatus || ""} ${ticket.status || ""}`.toLocaleLowerCase("tr-TR");
    const changedAt = new Date(ticket.jiraUpdatedAt || ticket.updatedAt || ticket.createdAt || 0).getTime();
    return (status.includes("done") || status.includes("tamamland")) && changedAt >= since;
  });
  const stories = done.map((ticket, index) => {
    const colors = [
      ["#eef2ff", "#4f46e5"],
      ["#ecfeff", "#0891b2"],
      ["#f0fdf4", "#16a34a"],
      ["#fff7ed", "#ea580c"],
    ][index % 4];
    return `
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${colors[0]}" style="margin-bottom:14px;border:1px solid ${colors[1]};border-left:6px solid ${colors[1]};border-radius:16px">
        <tr><td style="padding:20px">
          <div style="font-size:10px;line-height:15px;color:${colors[1]};font-weight:900;letter-spacing:1px">${escapeHtml(ticket.jiraKey || ticket.ticketNo || "GELİŞTİRME")}</div>
          <h2 style="font-size:19px;line-height:26px;color:#172033;margin:6px 0 8px">${escapeHtml(ticket.title)}</h2>
          <p style="font-size:13px;line-height:21px;color:#475569;margin:0">${escapeHtml(ticket.description || "Bu geliştirme tamamlandı ve kullanıma hazır.")}</p>
        </td></tr>
      </table>`;
  }).join("");

  return emailFrame({
    eyebrow: "HAFTALIK GELİŞTİRMELER",
    title: `${project.name} Geliştirme Bülteni`,
    intro: "Jira üzerinde son yedi günde tamamlanan çalışmalar.",
    accent: "#f59e0b",
    content: stories || '<div style="padding:28px;text-align:center;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px">Bu hafta tamamlanan Jira geliştirmesi bulunmuyor.</div>',
  });
};

export const nextScheduledRun = (schedule, from = new Date()) => {
  const next = new Date(from);
  if (schedule.frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
};
