import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { sendManagedTemplateEmail } from "../email";
import { commissioningMachines, fieldPlanHours, projectPmIds, ticketNumber } from "../domain/projectHelpers.js";
import { Btn, Card, Field, Icon, iStyle, lStyle } from "./primitives.jsx";
import { STATUS_COLORS as S, daysDiff, delayLvl } from "./status.jsx";
import { DEFAULT_EMAIL_TEMPLATES, renderManagedTemplate, resolveEmailTemplates, resolveTenantProfile } from "../../server/services/emailTemplate.js";

const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "?";
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const reportThemeStyle = `
:root{
  --r-bg:#f1f5f6;
  --r-surface:#ffffff;
  --r-surface-soft:#f6fafb;
  --r-text:#112327;
  --r-muted:#5b6f74;
  --r-accent:#0b8a94;
  --r-ok:#19835c;
  --r-warn:#bf7a12;
  --r-danger:#b93f33;
  --r-border:#cfe0e3;
  --r-ink:#def5f8;
}
*{box-sizing:border-box}
body{margin:0;font-family:Manrope,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:linear-gradient(145deg,#f1f7f8 0%,var(--r-bg) 55%,#edf4f7);color:var(--r-text);line-height:1.45;padding:22px}
.r-wrap{max-width:1240px;margin:0 auto}
.r-header{border:1px solid color-mix(in srgb, var(--r-border) 72%, transparent);border-radius:20px;padding:24px;background:linear-gradient(135deg,#0b8a94,#1f9cad 54%,#7bcad1);color:#fff;display:flex;gap:18px;justify-content:space-between;align-items:flex-start;position:relative;overflow:hidden}
.r-title{margin:0;font-size:30px;letter-spacing:-0.02em;word-break:break-word;max-width:70%}
.r-sub{margin:10px 0 0;opacity:.95}
.r-sub,.r-meta{font-size:12px;color:#d8f4f8}
.r-print{background:#fff;color:#0b8a94;border:0;border-radius:12px;padding:9px 14px;font-weight:900;cursor:pointer}
.r-body{margin-top:18px;display:grid;gap:14px}
.r-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.r-kpi{background:linear-gradient(145deg,var(--r-surface),#f8fcfd);border:1px solid var(--r-border);border-top:4px solid var(--r-accent);border-radius:14px;padding:15px;box-shadow:0 18px 46px -36px rgba(17,35,39,.34)}
.r-kpi:nth-child(3n+2){border-top-color:var(--r-ok)}
.r-kpi:nth-child(3n+3){border-top-color:var(--r-warn)}
.r-kpi:nth-child(5n){border-top-color:var(--r-danger)}
.r-kpi small{font-size:11px;color:var(--r-muted)}
.r-kpi b{display:block;font-size:27px;margin-top:2px}
.r-card{background:linear-gradient(145deg,var(--r-surface),#f8fcfd);border:1px solid var(--r-border);border-radius:18px;padding:18px;box-shadow:0 18px 46px -38px rgba(17,35,39,.32)}
.r-card-title{margin:0 0 10px}
.r-table{width:100%;border-collapse:collapse;overflow:auto}
.r-table th,.r-table td{padding:8px 10px;text-align:left;border-bottom:1px solid #e4eef0;font-size:12px}
.r-table th{color:#4f5f64;font-size:11px;font-weight:700;background:#f8fbfc}
.r-table tr:hover td{background:color-mix(in srgb, var(--r-accent) 8%, transparent)}
.r-pills{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
.r-pill{display:inline-block;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:800;color:#0b2930;background:color-mix(in srgb, var(--r-accent) 16%, transparent)}
.r-pill.warn{color:#8a4e0c;background:#fff3dc}
.r-pill.danger{color:#a61f2e;background:#ffe6ea}
.r-pill.ok{color:#105e43;background:#dff4eb}
td.danger,.danger{color:var(--r-danger)!important;font-weight:850}
tr:has(.r-pill.danger) td{background:#fff8f9}
tr:has(.r-pill.ok) td{background:#f7fffb}
.r-section{display:flex;justify-content:space-between;gap:10px}
.r-section h3{margin:0;font-size:16px}
.r-foot{margin-top:14px;color:var(--r-muted);font-size:11px}
.r-log-badge{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:7px}
@media print{
  body{background:#fff;padding:0}
  .r-print{display:none}
  .r-kpi,.r-card{box-shadow:none!important}
}
`;

const buildThemeReport = ({title, subtitle, accent = "#0b8a94", content}) => `<!doctype html><html lang="tr"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width">
  <title>${escapeHtml(title)}</title>
  <style>${reportThemeStyle}</style>
</head><body>
  <div class="r-wrap">
    <header class="r-header" style="--r-accent:${accent}">
      <div>
        <h1 class="r-title">${escapeHtml(title)}</h1>
        <div class="r-sub">${escapeHtml(subtitle || "")}</div>
      </div>
      <button class="r-print" onclick="window.print()">Yazdır / PDF</button>
    </header>
    <main class="r-body">${content}</main>
    <div class="r-foot">Tarih: ${new Date().toLocaleString("tr-TR")}</div>
  </div>
</body></html>`;

const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const commissioningRows=(sectors=[])=>sectors.flatMap(sector=>(sector.productionCenters||[]).flatMap(center=>(center.workplaces||[]).flatMap(workplace=>(workplace.lines||[]).flatMap(line=>(line.machines||[]).map(machine=>({sector:sector.name,productionCenter:center.name,workplace:workplace.name,line:line.name,machine}))))));
const LOG_META = {
  task_done:{ icon:"?", color:"var(--r-ok)", bg:"#dff4eb", label:"Tamamland?" },
  task_add:{ icon:"+", color:"var(--r-accent)", bg:"#def5f8", label:"Görev Eklendi" },
  task_delete:{ icon:"?", color:"var(--r-danger)", bg:"#ffe6ea", label:"Görev Silindi" },
  status_change:{ icon:"?", color:"var(--r-warn)", bg:"#fff3dc", label:"Durum Değişti" },
  milestone_add:{ icon:"?", color:"var(--r-accent)", bg:"var(--r-surface-soft)", label:"Milestone" },
  project_create:{ icon:"?", color:"var(--r-accent)", bg:"#def5f8", label:"Proje" },
  risk_add:{ icon:"!", color:"var(--r-danger)", bg:"#ffe6ea", label:"Risk" },
  import:{ icon:"?", color:"var(--muted)", bg:"var(--r-surface-soft)", label:"Import" },
  person_add:{ icon:"?", color:"var(--r-accent)", bg:"#def5f8", label:"Ekip" },
  general:{ icon:"?", color:"var(--muted)", bg:"var(--r-surface-soft)", label:"Genel" },
};

const safeFileName=(value)=>String(value||"rapor").replace(/[^a-zA-Z0-9_-]/g,"_");
const downloadTextFile=(content,fileName,type="text/plain;charset=utf-8")=>{
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
const allProjectTasks=(state)=>state.projects.flatMap(project=>project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({project,milestone,task}))));
export const downloadXlsx=(rows,fileName,sheetName="Rapor")=>{
  const ws=XLSX.utils.aoa_to_sheet(rows);
  const widths=rows.reduce((acc,row)=>row.map((cell,i)=>Math.max(acc[i]||10,String(cell??"").length+2)),[]);
  ws["!cols"]=widths.map(w=>({wch:Math.min(w,45)}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName.slice(0,31));
  XLSX.writeFile(wb,fileName);
};

export function downloadDelayReport(state,people){
  const rows=[["Proje","Milestone","Görev","Sorumlu","Durum","Öncelik","Termin","Gecikme Günü","Seviye","Bekleme Kaynağı"]];
  allProjectTasks(state).filter(({task})=>delayLvl(task.dueDate,task.status)).forEach(({project,milestone,task})=>{
    rows.push([project.name,milestone.name,task.title,people.find(p=>p.id===task.assignee)?.name||"Atanmamış",task.status,task.priority,task.dueDate,daysDiff(task.dueDate),delayLvl(task.dueDate,task.status)==="critical"?"Kritik":"Gecikmiş",task.waitSource||""]);
  });
  downloadXlsx(rows,`gecikme-raporu-${todayStr()}.xlsx`,"Gecikmeler");
}

export function downloadEffortReport(state,people){
  const rows=[["Proje","Milestone","Görev","Sorumlu","Planlanan Saat","Gerçekleşen Saat","Fark","Kayıt Tarihi","Girişi Yapan","Açıklama"]];
  allProjectTasks(state).forEach(({project,milestone,task})=>{
    const entries=task.timeEntries||[];
    const actual=entries.reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
    if(!entries.length)rows.push([project.name,milestone.name,task.title,people.find(p=>p.id===task.assignee)?.name||"Atanmamış",task.estimatedHours||0,actual,actual-(parseFloat(task.estimatedHours)||0),"","",""]);
    entries.forEach(entry=>rows.push([project.name,milestone.name,task.title,people.find(p=>p.id===task.assignee)?.name||"Atanmamış",task.estimatedHours||0,actual,actual-(parseFloat(task.estimatedHours)||0),entry.date||"",entry.user||"",entry.note||""]));
  });
  (state.fieldPlans||[]).filter(plan=>plan.status==="completed"||plan.completedAt).forEach(plan=>{
    const project=state.projects.find(item=>item.id===plan.projectId);
    const person=people.find(item=>item.id===plan.userId);
    const workLabel=plan.workType==="remote"?"Uzaktan Çalışma":"Saha Ziyareti";
    rows.push([project?.name||"Silinmiş proje",workLabel,`${workLabel} · ${plan.date}`,person?.name||"Atanmamış","",fieldPlanHours(plan),"",plan.date||"",person?.name||"",plan.visitNotes||""]);
  });
  Object.entries(state.projectActions||{}).forEach(([projectId,actions])=>{
    const project=state.projects.find(item=>item.id===projectId);
    (actions||[]).filter(action=>Number(action.effortHours)>0).forEach(action=>{
      rows.push([project?.name||"Silinmiş proje","Proje Aksiyonu",action.text||"Aksiyon",action.authorName||"","",Number(action.effortHours),"",action.actionAt||action.createdAt||"",action.authorName||"",action.text||""]);
    });
  });
  downloadXlsx(rows,`efor-raporu-${todayStr()}.xlsx`,"Efor");
}

export function downloadMachineReport(state){
  const rows=[["Proje","Sektör","Üretim Merkezi","İşyeri","Hat","Makine Kodu","Makine Adı","Tip","Devreye Alındı","Devreye Alma Tarihi","Açıklama"]];
  state.projects.forEach(project=>{
    (project.machines||[]).forEach(machine=>rows.push([project.name,"","","","",machine.code||"",machine.name,machine.type==="virtual"?"Sanal":"Fiziksel",machine.commissioned?"Evet":"Hayır",machine.commissionedAt||"",machine.note||""]));
    commissioningRows(project.commissioningTree||[]).forEach(row=>rows.push([project.name,row.sector,row.productionCenter,row.workplace,row.line,row.machine.code||"",row.machine.name,row.machine.type==="virtual"?"Sanal":"Fiziksel",row.machine.commissioned?"Evet":"Hayır",row.machine.commissionedAt||"",row.machine.note||""]));
  });
  downloadXlsx(rows,`makine-devreye-alma-${todayStr()}.xlsx`,"Makineler");
}

export function generateSummaryReport(project,people,{customer=false}={}){
  const tasks=project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name})));
  const done=tasks.filter(t=>t.status==="Tamamlandı").length;
  const delayed=tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const allMachines=(project.machines||[]).concat(commissioningRows(project.commissioningTree||[]).map(r=>r.machine));
  const commissioned=allMachines.filter(m=>m.commissioned).length;
  const hours=tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const taskRows=tasks.map(task=>{
    const assigneeName=people.find(p=>p.id===task.assignee)?.name||"Atanmamış";
    const effort=(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
    const pillClass=task.status==="Tamamlandı"?"ok":delayLvl(task.dueDate,task.status)?"danger":"warn";
    return `<tr><td>${escapeHtml(task.milestone)}</td><td>${escapeHtml(task.title)}</td><td><span class="r-pill ${pillClass}">${escapeHtml(task.status)}</span></td><td>${escapeHtml(fmt(task.dueDate))}</td>${customer?"":`<td>${escapeHtml(assigneeName)}</td><td>${effort} saat</td>`}</tr>`;
  }).join("");
  const machineRows=allMachines.map(m=>`<tr><td>${escapeHtml(m.code||"-")}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.type==="virtual"?"Sanal":"Fiziksel")}</td><td>${escapeHtml(m.commissioned?"Devrede":"Bekliyor")}</td><td>${escapeHtml(m.commissioned?fmt(m.commissionedAt):(customer?"Planlanıyor":m.note||"-"))}</td></tr>`).join("");
  const delays=delayed.map(t=>`<li><b>${escapeHtml(t.title)}</b> · ${daysDiff(t.dueDate)} gün · ${escapeHtml(t.waitSource||"Neden belirtilmedi")}</li>`).join("");
  const content=`
    <section class="r-grid">
      <div class="r-kpi"><small>Genel İlerleme</small><b>${tasks.length?Math.round(done/tasks.length*100):0}%</b></div>
      <div class="r-kpi"><small>Tamamlanan / Toplam</small><b>${done}/${tasks.length}</b></div>
      <div class="r-kpi"><small>Devreye Alınan</small><b>${commissioned}/${allMachines.length}</b></div>
      <div class="r-kpi"><small>Gecikme</small><b>${delayed.length}</b></div>
      ${customer?"":`<div class="r-kpi"><small>Toplam Efor</small><b>${hours} saat</b></div>`}
    </section>
    <section class="r-card">
      <h3 class="r-card-title">Görev Durumu</h3>
      <div style="overflow:auto">
        <table class="r-table">
          <thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Termin</th>${customer?"":"<th>Sorumlu</th><th>Efor</th>"}</tr></thead>
          <tbody>${taskRows||"<tr><td colspan='6'>Kayıt yok.</td></tr>"}</tbody>
        </table>
      </div>
    </section>
    <section class="r-card">
      <h3 class="r-card-title">Makine Devreye Alma</h3>
      <div style="overflow:auto">
        <table class="r-table">
          <thead><tr><th>Kod</th><th>Makine</th><th>Tip</th><th>Durum</th><th>${customer?"Plan":"Açıklama"}</th></tr></thead>
          <tbody>${machineRows||"<tr><td colspan='5'>Makine kaydı yok.</td></tr>"}</tbody>
        </table>
      </div>
    </section>
    ${!customer&&delayed.length?`<section class="r-card"><h3 class="r-card-title">Gecikme Gerekçeleri</h3><ul>${delays}</ul></section>`:""}
  `;
  const html=buildThemeReport({
    title:`${project.name} - ${customer?"Müşteri":"İç"} Rapor`,
    subtitle:`${customer?"Müşteri İlerleme Raporu":"İç Operasyon Raporu"} · ${new Date().toLocaleDateString("tr-TR")}`,
    content,
    accent: project.color || "#0b8a94"
  });
  downloadTextFile(html,`${safeFileName(project.name)}-${customer?"musteri":"ic"}-rapor.html`,`text/html;charset=utf-8`);
}

export function generateVisualReport(project,people,{customer=false,fieldHours=0}={}){
  const tasks = project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name})));
  const totalTasks = tasks.length;
  const done = tasks.filter(t=>t.status === "Tamamlandı").length;
  const active = tasks.filter(t=>t.status === "Devam Ediyor").length;
  const waiting = tasks.filter(t=>t.status === "Bekliyor").length;
  const delayed = tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const progress = totalTasks ? Math.round((done/totalTasks) * 100) : 0;
  const machines = project.milestones && project.milestones.length ? project.commissioningTracking ? commissioningMachines(project.commissioningTree||[]) : (project.machines||[]) : (project.machines||[]);
  const allMachines = machines.map(item=>item);
  const commissioned = allMachines.filter(m=>m.commissioned).length;
  const effort = tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0)+fieldHours;

  const taskRows = tasks.map(task=>{
    const assigneeName = people.find(p=>p.id===task.assignee)?.name || "Atanmamış";
    const eff = (task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
    const statusClass = task.status === "Tamamlandı" ? "ok" : task.status === "Devam Ediyor" ? "warn" : "warn";
    return `<tr><td>${escapeHtml(task.milestone)}</td><td>${escapeHtml(task.title)}</td><td><span class="r-pill ${statusClass}">${escapeHtml(task.status)}</span></td><td>${fmt(task.dueDate)}</td>${customer ? "" : `<td>${escapeHtml(assigneeName)}</td><td>${eff} saat</td>`}<td>${task.estimatedHours || 0} saat</td></tr>`;
  }).join("");

  const machineRows = allMachines.map(machine => {
    const statusLabel = machine.commissioned ? "Devrede" : "Bekliyor";
    const statusClass = machine.commissioned ? "ok" : "warn";
    return `<tr><td>${escapeHtml(machine.code || "-")}</td><td>${escapeHtml(machine.name || "-")}</td><td>${escapeHtml(machine.type==="virtual"?"Sanal":"Fiziksel")}</td><td><span class="r-pill ${statusClass}">${statusLabel}</span></td><td>${machine.commissioned ? fmt(machine.commissionedAt) : customer ? "Planlanıyor" : escapeHtml(machine.note || "-")}</td></tr>`;
  }).join("");

  const taskWarnings = delayed.map(task=>`<li><b>${escapeHtml(task.title)}</b> · ${daysDiff(task.dueDate)} gün gecikme · ${escapeHtml(task.waitSource || "Neden belirtilmedi")}</li>`).join("");

  const content = `
    <section class="r-grid">
      <div class="r-kpi"><small>Genel İlerleme</small><b>${progress}%</b></div>
      <div class="r-kpi"><small>Tamamlanan / Toplam</small><b>${done}/${totalTasks}</b></div>
      <div class="r-kpi"><small>Beklemede</small><b>${waiting}</b></div>
      <div class="r-kpi"><small>Devreye Alınan</small><b>${commissioned}/${allMachines.length}</b></div>
      <div class="r-kpi"><small>Gecikme</small><b>${delayed.length}</b></div>
      ${customer ? "" : `<div class="r-kpi"><small>Toplam Efor</small><b>${effort} saat</b></div>`}
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Görev Durumu</h3>
      <div style="overflow:auto">
        <table class="r-table">
          <thead>
            <tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Tarih</th>${customer?"":"<th>Sorumlu</th><th>Girilen Saat</th>"}<th>Plan Saat</th></tr>
          </thead>
          <tbody>${taskRows || "<tr><td colspan='6'>Görev kaydı yok.</td></tr>"}</tbody>
        </table>
      </div>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Makine Devreye Alma</h3>
      <div style="overflow:auto">
        <table class="r-table">
          <thead>
            <tr><th>Kod</th><th>Makine</th><th>Tip</th><th>Durum</th><th>Not</th></tr>
          </thead>
          <tbody>${machineRows || "<tr><td colspan='5'>Makine kaydı yok.</td></tr>"}</tbody>
        </table>
      </div>
    </section>

    ${delayed.length ? `<section class="r-card"><h3 class="r-card-title">Gecikme Uyarıları</h3><ul>${taskWarnings}</ul></section>` : ""}
  `;

  const html = buildThemeReport({
    title: `${project.name} - ${customer ? "Müşteri" : "İç"} Raporu`,
    subtitle: customer ? "Müşteri İlerleme Raporu" : "İç Operasyon Raporu",
    accent: project.color || "#0b8a94",
    content,
  });

  downloadTextFile(html, `${safeFileName(project.name)}-${customer ? "musteri" : "ic"}-rapor.html`, "text/html;charset=utf-8");
}
export function generatePortfolioReport(state,people){
  const data = state.projects.map(project=>{
    const tasks = project.milestones.flatMap(ms=>ms.tasks || []);
    const done = tasks.filter(t=>t.status === "Tamamlandı").length;
    const delayed = tasks.filter(t=>delayLvl(t.dueDate,t.status)).length;
    const fieldHours = (state.fieldPlans||[])
      .filter(plan=>plan.projectId === project.id && (plan.status === "completed" || plan.completedAt))
      .reduce((sum,plan)=>sum+fieldPlanHours(plan),0);
    const actionHours = ((state.projectActions||{})[project.id]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
    const taskHours = tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
    return {
      project,
      tasks: tasks.length,
      done,
      delayed,
      progress: tasks.length ? Math.round(done / tasks.length * 100) : 0,
      hours: taskHours + fieldHours + actionHours,
      machines: project.milestones && project.commissioningTracking ? commissioningMachines(project.commissioningTree||[]) : (project.machines || []),
      pmNames: projectPmIds(project).map(id => people.find(p=>p.id===id)?.name).filter(Boolean).join(", "),
    };
  });

  const totalTasks = data.reduce((sum,item)=>sum+item.tasks,0);
  const totalDone = data.reduce((sum,item)=>sum+item.done,0);
  const totalDelayed = data.reduce((sum,item)=>sum+item.delayed,0);
  const totalHours = data.reduce((sum,item)=>sum+item.hours,0);

  const projectCards = data.map(item => `
    <div style="padding:13px;border:1px solid #d8ebef;border-radius:12px;background:#fff;margin-bottom:8px;">
      <div class="r-section">
        <h3 style="font-size:13px;margin:0">${escapeHtml(item.project.name)}</h3>
        <span class="r-pill ${item.progress >= 80 ? "ok" : item.progress >= 40 ? "warn" : "danger"}">${item.progress}%</span>
      </div>
      <div style="height:7px;background:#e8f4f6;border-radius:999px;overflow:hidden;margin:9px 0 10px"><i style="display:block;height:100%;width:${item.progress}%;background:${item.project.color || "#0b8a94"}"></i></div>
      <div style="font-size:11px;color:#5b6f74;display:flex;gap:12px;flex-wrap:wrap">
        <span>PM: ${escapeHtml(item.pmNames || "Atanmamış")}</span>
        <span>Görev: ${item.done}/${item.tasks}</span>
        <span>Gecikme: <b>${item.delayed}</b></span>
        <span>Makine: ${item.machines.filter(machine=>machine.commissioned).length}/${item.machines.length}</span>
      </div>
    </div>`
  ).join("");

  const tableRows = data.map(item => {
    return `<tr>
      <td>${escapeHtml(item.project.name)}</td>
      <td>${escapeHtml(item.pmNames || "Atanmamış")}</td>
      <td><span class="r-pill ${item.project.status === "Aktif" ? "ok" : "warn"}">${escapeHtml(item.project.status || "-")}</span></td>
      <td>${item.progress}%</td>
      <td>${item.done} / ${item.tasks}</td>
      <td>${item.delayed}</td>
      <td>${item.machines.filter(machine=>machine.commissioned).length}/${item.machines.length}</td>
      <td>${item.hours}</td>
    </tr>`;
  }).join("");

  const html = buildThemeReport({
    title: "Corject Genel Durum Raporu",
    subtitle: `${state.projects.length} projelik portföy özeti`,
    accent: "#0b8a94",
    content: `
      <section class="r-grid">
        <div class="r-kpi"><small>Toplam Proje</small><b>${state.projects.length}</b></div>
        <div class="r-kpi"><small>Tamamlanan Görev</small><b>${totalDone}/${totalTasks}</b></div>
        <div class="r-kpi"><small>Gecikmiş Görev</small><b>${totalDelayed}</b></div>
        <div class="r-kpi"><small>Toplam Efor</small><b>${Math.round(totalHours)} saat</b></div>
      </section>
      <section class="r-card">
        <h3 class="r-card-title">Proje Özeti</h3>
        ${projectCards || "<p>Proje verisi bulunmuyor.</p>"}
      </section>
      <section class="r-card">
        <h3 class="r-card-title">Karşılaştırmalı Tablo</h3>
        <div style="overflow:auto">
          <table class="r-table">
            <thead>
              <tr><th>Proje</th><th>PM</th><th>Durum</th><th>İlerleme</th><th>Görev</th><th>Gecikme</th><th>Makine</th><th>Efor</th></tr>
            </thead>
            <tbody>${tableRows || "<tr><td colspan='8'>Proje yok.</td></tr>"}</tbody>
          </table>
        </div>
      </section>
    `,
  });

  downloadTextFile(html, `corject-genel-durum-${todayStr()}.html`, "text/html;charset=utf-8");
}
// ─── HTML Report ─────────────────────────────────────────────────────────────
export function generateHTMLReport(project, people, logs) {
  const findName = (id)=>people.find(p=>p.id===id)?.name || "Atanmamış";
  const tasks = project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name, msDue:ms.dueDate})));
  const done = tasks.filter(t=>t.status === "Tamamlandı");
  const active = tasks.filter(t=>t.status === "Devam Ediyor");
  const waiting = tasks.filter(t=>t.status === "Bekliyor");
  const delayed = tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const progress = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
  const pmNames = projectPmIds(project).map(id => people.find(p=>p.id === id)?.name).filter(Boolean).join(", ") || "Atanmamış";

  const milestoneBars = (project.milestones || []).map(milestone => {
    const start = new Date(milestone.startDate || project.startDate);
    const end = new Date(milestone.dueDate || project.endDate);
    const total = new Date(project.endDate || project.startDate || new Date()).getTime() - new Date(project.startDate || new Date()).getTime() || 1;
    const left = Math.max(0, Math.min(100, ((start - new Date(project.startDate || start)) / total) * 100));
    const width = Math.max(1, Math.min(100, ((end - start) / total) * 100));
    const statusClass = milestone.status === "Tamamlandı" ? "ok" : delayLvl(milestone.dueDate,milestone.status) ? "danger" : "warn";
    const doneCount = milestone.tasks?.filter(task=>task.status === "Tamamlandı").length || 0;
    const totalCount = milestone.tasks?.length || 0;

    return `<div style="display:grid;grid-template-columns:120px 1fr 90px;gap:10px;align-items:center;margin:8px 0;font-size:11px">
      <span style="color:#5b6f74;">${escapeHtml(milestone.name)}</span>
      <div style="height:18px;background:#e7f2f4;border-radius:999px;position:relative;overflow:hidden">
        <i style="position:absolute;left:${left}%;width:${width}%;top:0;bottom:0;background:${milestone.status === "Tamamlandı" ? "#19835c" : "#0b8a94"};"></i>
      </div>
      <span><span class="r-pill ${statusClass}">${doneCount}/${totalCount}</span></span>
    </div>`;
  }).join("");

  const taskRows = tasks.map(task=>{
    const badge = delayLvl(task.dueDate,task.status) ? "danger" : task.status === "Tamamlandı" ? "ok" : task.status === "Devam Ediyor" ? "warn" : "warn";
    return `<tr><td>${escapeHtml(task.milestone)}</td><td>${escapeHtml(task.title)}</td><td><span class="r-pill ${badge}">${escapeHtml(task.status)}</span></td><td>${escapeHtml(task.priority || "-")}</td><td>${escapeHtml(findName(task.assignee))}</td><td>${fmt(task.dueDate)}</td></tr>`;
  }).join("");

  const projectLogs = logs.filter(log=>log.project===project.name).slice(0, 12);
  const logRows = projectLogs.map(log => {
    const meta = LOG_META[log.action] || LOG_META.general;
    const ts = log.ts ? new Date(log.ts).toLocaleString("tr-TR") : "-";
    return `<tr><td>${ts}</td><td><span class="r-pill" style="background:${meta.bg};color:${meta.color}">${meta.label}</span></td><td>${escapeHtml(log.user||"-")}</td><td>${escapeHtml(log.detail||"")}</td></tr>`;
  }).join("");

  const content = `
    <section class="r-grid">
      <div class="r-kpi"><small>İlerleme</small><b>${progress}%</b></div>
      <div class="r-kpi"><small>Tamamlanan</small><b>${done.length}</b></div>
      <div class="r-kpi"><small>Devam Eden</small><b>${active.length}</b></div>
      <div class="r-kpi"><small>Bekleyen</small><b>${waiting.length}</b></div>
      <div class="r-kpi"><small>Gecikmiş</small><b>${delayed.length}</b></div>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Proje Özeti</h3>
      <p>PM: ${escapeHtml(pmNames)} · ${fmt(project.startDate)} / ${fmt(project.endDate)} · ${project.status || "Durum belirtilmemiş"}</p>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Gantt Görünümü</h3>
      ${milestoneBars || "<p>Milestone planı eksik.</p>"}
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Görev Listesi</h3>
      <div style="overflow:auto">
        <table class="r-table">
          <thead>
            <tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th></tr>
          </thead>
          <tbody>${taskRows || "<tr><td colspan='6'>Görev kaydı yok.</td></tr>"}</tbody>
        </table>
      </div>
    </section>

    ${projectLogs.length ? `<section class="r-card"><h3 class="r-card-title">Son Değişiklikler</h3><div style="overflow:auto"><table class="r-table"><thead><tr><th>Zaman</th><th>Tip</th><th>Kullanıcı</th><th>Detay</th></tr></thead><tbody>${logRows || "<tr><td colspan='4'>Kayıt yok.</td></tr>"}</tbody></table></div></section>` : ""}
  `;

  const html = buildThemeReport({
    title: `${project.name} - Yönetici Raporu`,
    subtitle: "Görev, Gantt ve geçmiş notları birleştirilmiş görünüm",
    accent: project.color || "#0b8a94",
    content,
  });

  downloadTextFile(html, `${safeFileName(project.name)}-rapor.html`, "text/html;charset=utf-8");
}

// ─── Risk Panel ──────────────────────────────────────────────────────────────


export function generateTeamCapacityReport(state,people){
  const tasks = state.projects.flatMap(project => project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({task,project}))));
  const rows = people.map(person => {
    const assigned = tasks.filter(({task})=>task.assignee === person.id);
    const active = assigned.filter(({task})=>task.status !== "Tamamlandı");
    const delayed = active.filter(({task})=>delayLvl(task.dueDate,task.status));
    const hours = assigned.reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0)
      + (state.fieldPlans || []).filter(plan=>plan.userId===person.id && (plan.status === "completed" || plan.completedAt)).reduce((total,plan)=>total+fieldPlanHours(plan),0);
    return {person, assigned: assigned.length, active: active.length, delayed: delayed.length, hours};
  }).filter(item=>item.assigned || item.hours).sort((a,b)=>b.active-a.active || b.hours-a.hours);

  const max = Math.max(1, ...rows.map(item=>item.assigned));
  const cards = rows.map(item => `
    <div class="r-card" style="margin-bottom:10px">
      <div class="r-section">
        <div>
          <b>${escapeHtml(item.person.name)}</b>
          <div style="font-size:11px;color:#5b6f74">${escapeHtml(item.person.role || "")}</div>
        </div>
        <span class="r-pill ${item.delayed ? "danger" : "ok"}">${item.active} aktif</span>
      </div>
      <div style="height:8px;background:#e8f4f6;border-radius:999px;overflow:hidden"><i style="display:block;height:100%;width:${Math.min(100,(item.assigned/max)*100)}%;background:${item.delayed ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#0b8a94,#1f9cad)"}"></i></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#5b6f74;margin-top:8px">
        <span>Toplam Görev ${item.assigned}</span>
        <span class="${item.delayed ? "danger" : ""}">Gecikmiş ${item.delayed}</span>
        <span>Toplam Efor ${item.hours} saat</span>
      </div>
    </div>`
  ).join("");

  const html = buildThemeReport({
    title: "Ekip Kapasite Raporu",
    subtitle: `${state.projects.length} proje · ${tasks.length} görev dağılımı`,
    accent: "#0b8a94",
    content: `
      <section class="r-grid">
        <div class="r-kpi"><small>Takım Üyesi</small><b>${rows.length}</b></div>
        <div class="r-kpi"><small>Atanmış Görev</small><b>${rows.reduce((sum,item)=>sum+item.assigned,0)}</b></div>
        <div class="r-kpi"><small>Aktif Görev</small><b>${rows.reduce((sum,item)=>sum+item.active,0)}</b></div>
        <div class="r-kpi"><small>Toplam Efor</small><b>${rows.reduce((sum,item)=>sum+item.hours,0)} saat</b></div>
      </section>
      <section class="r-card">
        <h3 class="r-card-title">Kişi Bazlı Kapasite</h3>
        ${cards || "<p>Kullanıcı verisi bulunmuyor.</p>"}
      </section>
    `,
  });

  downloadTextFile(html, `ekip-kapasite-raporu-${todayStr()}.html`, "text/html;charset=utf-8");
}

export function generateRiskPortfolioReport(state){
  const risks = state.projects.flatMap(project => (project.risks || []).map(risk => ({risk, project})));
  const open = risks.filter(({risk}) => !["Kapalı", "Kapanmış"].includes(risk.status));
  const high = open.filter(({risk}) => ["Yüksek", "Kritik"].includes(risk.level));

  const riskByProject = state.projects.map(project => {
    const openCount = (project.risks || []).filter(risk => !["Kapalı", "Kapanmış"].includes(risk.status)).length;
    const criticalCount = (project.risks || []).filter(risk => ["Yüksek", "Kritik"].includes(risk.level) && !["Kapalı", "Kapanmış"].includes(risk.status)).length;
    const total = Math.max(1, (project.risks || []).length);
    return `<div style="margin-bottom:10px">
      <div class="r-section"><strong>${escapeHtml(project.name)}</strong><span class="r-pill ${criticalCount ? "danger" : "ok"}">${openCount} açık risk</span></div>
      <div style="height:8px;background:#e8f4f6;border-radius:999px;overflow:hidden"><i style="display:block;height:100%;width:${(openCount/total)*100}%;background:${criticalCount ? "#b93f33" : "#bf7a12"}"></i></div>
      <div style="font-size:11px;color:#5b6f74">Yüksek/Kritik: ${criticalCount}</div>
    </div>`;
  }).join("");

  const rows = risks.map(({risk,project}) => `<tr><td><b>${escapeHtml(risk.title)}</b><small>${escapeHtml(risk.note || "")}</small></td><td>${escapeHtml(project.name)}</td><td><span class="r-pill ${["Yüksek","Kritik"].includes(risk.level) ? "danger" : risk.level === "Orta" ? "warn" : "ok"}">${escapeHtml(risk.level || "- ")}</span></td><td>${escapeHtml(risk.status || "Açık")}</td></tr>`).join("");

  const html = buildThemeReport({
    title: "Risk Portföyü Raporu",
    subtitle: `${risks.length} risk kaydı analizi`,
    accent: "#f59e0b",
    content: `
      <section class="r-grid">
        <div class="r-kpi"><small>Toplam Risk</small><b>${risks.length}</b></div>
        <div class="r-kpi"><small>Açık Risk</small><b>${open.length}</b></div>
        <div class="r-kpi"><small>Yüksek / Kritik</small><b>${high.length}</b></div>
      </section>
      <section class="r-card">
        <h3 class="r-card-title">Proje Bazlı Risk Yoğunluğu</h3>
        ${riskByProject || "<p>Risk kaydı yok.</p>"}
      </section>
      <section class="r-card">
        <h3 class="r-card-title">Risk Envanteri</h3>
        <div style="overflow:auto">
          <table class="r-table">
            <thead><tr><th>Risk</th><th>Proje</th><th>Seviye</th><th>Durum</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='4'>Risk bulunmuyor.</td></tr>"}</tbody>
          </table>
        </div>
      </section>
    `,
  });

  downloadTextFile(html, `risk-portfoyu-raporu-${todayStr()}.html`, "text/html;charset=utf-8");
}
export function generateSteercoReport(project,state,people){
  if(!project) return;
  const tasks = project.milestones.flatMap(milestone => milestone.tasks.map(task=>({task,milestone})));
  const done = tasks.filter(({task})=>task.status === "Tamamlandı").length;
  const progress = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const delayed = tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const risks = (project.risks || []).filter(risk => !["Kapalı", "Kapanmış"].includes(risk.status));
  const criticalRisks = risks.filter(risk=>["Yüksek", "Kritik"].includes(risk.level));
  const actions = ((state.projectActions || {})[project.id] || []).slice().sort((a,b)=>String(b.actionAt||b.createdAt||"").localeCompare(String(a.actionAt||a.createdAt||""))).slice(0, 8);
  const tickets = ((state.projectTickets || {})[project.id] || []);
  const openTickets = tickets.filter(ticket => !["Tamamlandı", "İptal Edildi", "Done"].includes(ticket.status));
  const machines = project.commissioningTracking ? commissioningMachines(project.commissioningTree || []) : (project.machines || []);
  const commissioned = machines.filter(machine => machine.commissioned).length;
  const machineProgress = machines.length ? Math.round(commissioned/machines.length*100) : 0;
  const fieldHours = (state.fieldPlans || []).filter(plan=>plan.projectId === project.id && (plan.status === "completed" || plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0);
  const taskHours = tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((total,entry)=>total+(parseFloat(entry.hours)||0),0),0);
  const actionHours = actions.reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
  const totalHours = Math.round((fieldHours + taskHours + actionHours) * 10) / 10;
  const health = progress>=75 && criticalRisks.length===0 && delayed.length < 3 ? "Sağlıklı" : (criticalRisks.length || delayed.length>5 ? "Yönetici Aksiyonu Gerekli" : "Dikkat");

  const nextTasks = tasks.filter(({task})=>task.status !== "Tamamlandı").sort((a,b)=>String(a.task.dueDate || "9999").localeCompare(String(b.task.dueDate || "9999"))).slice(0, 8);
  const rows = nextTasks.map(({task,milestone}) => `<tr><td><b>${escapeHtml(task.title)}</b><small>${escapeHtml(milestone.name)}</small></td><td>${escapeHtml(people.find(person=>person.id===task.assignee)?.name||"-")}</td><td>${fmt(task.dueDate)}</td><td>${escapeHtml(task.status || "-")}</td></tr>`).join("");
  const actionRows = actions.map(action=>`<li><b>${fmt(action.actionAt || action.createdAt)}</b><span>${escapeHtml(action.text || "")}</span></li>`).join("");
  const riskRows = risks.slice(0,6).map(risk=>`<li><b>${escapeHtml(risk.level || "Risk")}</b><span>${escapeHtml(risk.title || "")} ${risk.note ? `<small>${escapeHtml(risk.note)}</small>` : ""}</span></li>`).join("");

  const content = `
    <section class="r-grid">
      <div class="r-kpi"><small>Genel İlerleme</small><b>${progress}%</b></div>
      <div class="r-kpi"><small>Devreye Alma</small><b>${machineProgress}%</b></div>
      <div class="r-kpi"><small>Geciken Görev</small><b>${delayed.length}</b></div>
      <div class="r-kpi"><small>Açık Ticket</small><b>${openTickets.length}</b></div>
      <div class="r-kpi"><small>Toplam Efor</small><b>${totalHours} saat</b></div>
      <div class="r-kpi"><small>Durum</small><b>${health}</b></div>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Proje İlerleme Özeti</h3>
      <p>${escapeHtml(project.name)} için hedefleme, kalite durumu ve yönetici bakış; tamamlanan görev ${done}/${tasks.length}.</p>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Karar / Dikkat Noktaları</h3>
      <ul>
        ${riskRows || "<li><b>Risk</b><span>Açık kritik risk bulunmuyor.</span></li>"}
        ${delayed.length ? `<li><b>Termin</b><span>${delayed.length} geciken görev için aksiyon gerekli.</span></li>` : ""}
      </ul>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">İş ve Sonraki Plan</h3>
      <div style="overflow:auto">
        <table class="r-table">
          <thead><tr><th>İş</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='4'>Açık iş bulunmuyor.</td></tr>"}</tbody>
        </table>
      </div>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Son Aksiyonlar</h3>
      <ul>${actionRows || "<li><b>Aksiyon</b><span>Henüz aksiyon kaydı yok.</span></li>"}</ul>
    </section>

    <section class="r-card">
      <h3 class="r-card-title">Ticket ve Ürün Takibi</h3>
      <ul>
        <li><b>Açık Ticket</b><span>${openTickets.length} kayıt beklemede.</span></li>
        <li><b>Jira</b><span>${tickets.filter(ticket=>ticket.jiraKey).length} ticket ile eşleşme.</span></li>
        <li><b>Müşteri Onayı</b><span>${tickets.filter(ticket=>String(ticket.status||"").toLocaleLowerCase("tr-TR").includes("müşteri")).length} kayıt müşteri onayı bekliyor.</span></li>
      </ul>
    </section>
  `;

  const html = buildThemeReport({
    title: `Steerco Proje Durum Raporu - ${project.name}`,
    subtitle: `${new Date().toLocaleDateString("tr-TR")} · Yönetim karar toplantısı özeti`,
    accent: project.color || "#0b8a94",
    content,
  });

  downloadTextFile(html, `steerco-raporu-${safeFileName(project.name)}-${todayStr()}.html`, "text/html;charset=utf-8");
}

export function downloadProjectActionsReport(state){
  const rows=[["Proje","Aksiyon Tarihi","Aksiyon","Efor (Saat)","Girişi Yapan"]];
  Object.entries(state.projectActions||{}).forEach(([projectId,actions])=>{
    const project=state.projects.find(item=>item.id===projectId);
    (actions||[]).forEach(action=>rows.push([project?.name||"Silinmiş proje",action.actionAt||action.createdAt||"",action.text||"",action.effortHours||0,action.authorName||""]));
  });
  downloadXlsx(rows,`proje-aksiyonlari-${todayStr()}.xlsx`,"Aksiyonlar");
}

export function downloadFieldVisitsReport(state,people){
  const rows=[["Proje","Ziyaret Tarihi","Sorumlu","Başlangıç","Bitiş","Efor (Saat)","Ziyaret Notu"]];
  (state.fieldPlans||[]).filter(plan=>plan.status==="completed"||plan.completedAt).forEach(plan=>{
    rows.push([state.projects.find(project=>project.id===plan.projectId)?.name||"Silinmiş proje",plan.date||"",people.find(person=>person.id===plan.userId)?.name||"",plan.actualStartTime||plan.startTime||"",plan.actualEndTime||plan.endTime||"",fieldPlanHours(plan),plan.visitNotes||""]);
  });
  downloadXlsx(rows,`saha-ziyaretleri-${todayStr()}.xlsx`,"Saha Ziyaretleri");
}

export function generateFieldManagementReport(state,people){
  const plans=(state.fieldPlans||[]).map(plan=>({
    ...plan,
    projectName: state.projects.find(p=>p.id===plan.projectId)?.name || "Silinmiş proje",
    userName: people.find(p=>p.id===plan.userId)?.name || "Bilinmiyor",
  }));
  const completed=plans.filter(plan=>plan.status==="completed"||plan.completedAt);
  const inField=completed.filter(plan=> (plan.workType||"field")==="field");
  const remote=completed.filter(plan=>plan.workType==="remote");
  const groupedByDay=completed.reduce((acc,plan)=>{
    const key=plan.date || "Belirsiz";
    acc[key]=(acc[key]||0)+1;
    return acc;
  },{});
  const max=Math.max(1,...Object.values(groupedByDay));
  const list=completed
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
    .map(plan=>`<tr>
      <td>${escapeHtml(plan.date||"-")}</td>
      <td>${escapeHtml(plan.projectName)}</td>
      <td>${escapeHtml(plan.userName)}</td>
      <td>${plan.workType==="remote"?"Uzaktan":"Saha"}</td>
      <td>${escapeHtml(fmt(plan.date))}</td>
      <td>${fieldPlanHours(plan)} saat</td>
      <td>${escapeHtml(plan.visitNotes||"-")}</td>
    </tr>`)
    .join("");
  const stats=[["Toplam Plan",plans.length,"#6f7f84"],["Gerçekleşen",completed.length,"var(--success)"],["Saha",inField.length,"#0b8a94"],["Uzaktan",remote.length,"#bf7a12"]]
    .map(([label,value,color])=>`<div class="r-kpi"><small>${escapeHtml(label)}</small><b style="color:${color}">${value}</b></div>`).join("");
  const heat=Object.entries(groupedByDay).map(([day,count])=>`<div><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--r-muted)"><span>${escapeHtml(day)}</span><span>${count}</span></div><div class="r-table"><div style="height:8px;background:var(--r-surface-soft);border-radius:8px;overflow:hidden"><span style="display:block;height:100%;width:${Math.max(8,(count/max)*100)}%;background:var(--r-accent)"/></div></div>`).join("");
  const html=buildThemeReport({
    title:"Saha Yönetim Raporu",
    subtitle:`${state.projects.length} proje · Son saha faaliyetleri`,
    content:`
      <section class="r-grid">${stats}</section>
      <section class="r-card">
        <h3 class="r-card-title">Günlük Gerçekleşme Dağılımı</h3>
        ${heat||"<p>Veri bulunmuyor.</p>"}
      </section>
      <section class="r-card">
        <h3 class="r-card-title">Ziyaret ve Çalışma Listesi</h3>
        <div style="overflow:auto">
          <table class="r-table">
            <thead><tr><th>Tarih</th><th>Proje</th><th>Sorumlu</th><th>Tip</th><th>Başlangıç</th><th>Çalışma</th><th>Not</th></tr></thead>
            <tbody>${list||"<tr><td colspan='7'>Kayıt yok.</td></tr>"}</tbody>
          </table>
        </div>
      </section>`,
    accent:"#19835c"
  });
  downloadTextFile(html,`saha-yonetim-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

const EMAIL_SAMPLE_VARIABLES = {
  recipient_name:"Ayşe Yılmaz",
  assigner_name:"Proje Yöneticisi",
  task_title:"Haftalık proje durumunu güncelle",
  task_description:"Güncel riskleri, eforları ve tamamlanan işleri rapora ekleyin.",
  due_date:"20.06.2026",
  project_name:"A Müşterisi MES Projesi",
  ticket_title:"Üretim ekranında veri gecikmesi",
  ticket_description:"Operatör ekranındaki üretim verileri geç güncelleniyor.",
  priority:"Yüksek",
  status:"Devam Ediyor",
  task_count:"3",
  task_list:"• Haftalık rapor · 2 gün gecikme\n• Sunucu kontrolü · 1 gün gecikme",
};

const EMAIL_VARIABLE_CATALOG = [
  ["recipient_name","Alıcı adı"],["assigner_name","Atayan kişi"],["project_name","Proje adı"],
  ["task_title","Görev başlığı"],["task_description","Görev açıklaması"],["due_date","Termin"],
  ["ticket_title","Ticket başlığı"],["ticket_description","Ticket açıklaması"],["priority","Öncelik"],
  ["status","Durum"],["task_count","Görev sayısı"],["task_list","Görev listesi"],
];

export function MailCenterPage({state,setState}) {
  const tenant=resolveTenantProfile(state.tenantProfile);
  const templates=resolveEmailTemplates(state.emailTemplates);
  const [selectedId,setSelectedId]=useState(templates[0]?.id||"");
  const [draft,setDraft]=useState(templates.find(item=>item.id===selectedId)||templates[0]);
  const [recipient,setRecipient]=useState("");
  const [variablesText,setVariablesText]=useState(JSON.stringify(EMAIL_SAMPLE_VARIABLES,null,2));
  const [variableTarget,setVariableTarget]=useState("body");
  const [selectedVariable,setSelectedVariable]=useState("recipient_name");
  const [sendStatus,setSendStatus]=useState({loading:false,message:"",error:false});
  const fileInput=useRef();
  const selected=templates.find(item=>item.id===selectedId)||templates[0];
  const selectTemplate=(item)=>{setSelectedId(item.id);setDraft(item);setSendStatus({loading:false,message:"",error:false});};
  const variables=(()=>{try{return JSON.parse(variablesText||"{}");}catch{return EMAIL_SAMPLE_VARIABLES;}})();
  const preview=renderManagedTemplate({template:draft||selected,tenantProfile:tenant,variables,actionUrl:"https://www.corject.com"});
  const insertVariable=()=>{
    if(!draft)return;
    const token=`{{${selectedVariable}}}`;
    setDraft({...draft,[variableTarget]:`${draft[variableTarget]||""}${draft[variableTarget]?" ":""}${token}`});
  };
  const updateTenant=(patch)=>setState(current=>({...current,tenantProfile:{...resolveTenantProfile(current.tenantProfile),...patch}}));
  const saveTemplate=()=>{
    if(!draft?.name?.trim())return;
    setState(current=>{
      const currentTemplates=resolveEmailTemplates(current.emailTemplates);
      const exists=currentTemplates.some(item=>item.id===draft.id);
      return {...current,emailTemplates:exists?currentTemplates.map(item=>item.id===draft.id?draft:item):[...currentTemplates,draft]};
    });
    setSendStatus({loading:false,message:"Şablon kaydedildi.",error:false});
  };
  const addTemplate=()=>{
    const item={id:`custom_${uid()}`,name:"Yeni Şablon",category:"Özel",subject:"{{project_name}} bilgilendirmesi",eyebrow:"BİLGİLENDİRME",title:"{{project_name}} hakkında",intro:"Güncel bilgilendirme",body:"Merhaba {{recipient_name}},\n\nMesajınızı buraya yazın.",buttonLabel:"Detayı Aç",accentColor:tenant.accentColor,enabled:true};
    setState(current=>({...current,emailTemplates:[...resolveEmailTemplates(current.emailTemplates),item]}));
    selectTemplate(item);
  };
  const removeTemplate=()=>{
    if(DEFAULT_EMAIL_TEMPLATES.some(item=>item.id===draft.id)){setSendStatus({loading:false,message:"Sistem şablonları silinemez; pasif hale getirebilirsiniz.",error:true});return;}
    setState(current=>({...current,emailTemplates:resolveEmailTemplates(current.emailTemplates).filter(item=>item.id!==draft.id)}));
    const fallback=resolveEmailTemplates(state.emailTemplates).find(item=>item.id==="task_assignment");
    selectTemplate(fallback);
  };
  const uploadLogo=(file)=>{
    if(!file)return;
    if(file.size>150*1024){setSendStatus({loading:false,message:"Logo dosyası 150 KB'dan küçük olmalı.",error:true});return;}
    const reader=new FileReader();
    reader.onload=()=>updateTenant({logoUrl:String(reader.result||"")});
    reader.readAsDataURL(file);
  };
  const send=async()=>{
    if(!recipient.trim()){setSendStatus({loading:false,message:"Alıcı e-posta adresini girin.",error:true});return;}
    let parsed;
    try{parsed=JSON.parse(variablesText||"{}");}catch{setSendStatus({loading:false,message:"Değişkenler geçerli JSON olmalı.",error:true});return;}
    setSendStatus({loading:true,message:"Gönderiliyor...",error:false});
    try{
      const result=await sendManagedTemplateEmail({to:recipient.trim(),templateId:draft.id,template:draft,variables:parsed,actionUrl:"https://www.corject.com"});
      setSendStatus({loading:false,message:`Mail gönderildi${result.emailId?` · ${result.emailId}`:""}`,error:false});
    }catch(error){setSendStatus({loading:false,message:error.message,error:true});}
  };
  return <div className="project-workspace" style={{padding:"22px 26px",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap",marginBottom:18}}>
      <div><h1 style={{margin:0,fontSize:22}}>Mail Merkezi</h1><p style={{margin:"5px 0 0",fontSize:12,color:"var(--muted)"}}>Firma markası, dinamik şablonlar, önizleme ve manuel gönderim.</p></div>
      <Btn onClick={addTemplate}>+ Yeni Şablon</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(280px,.8fr) minmax(380px,1.25fr)",gap:16,alignItems:"start"}} className="admin-main-grid">
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:12}}>Satın Alan Firma</div>
          <Field label="Firma Adı"><input style={iStyle} value={tenant.name} onChange={e=>updateTenant({name:e.target.value})} placeholder="A Firması"/></Field>
          <Field label="Logo">
            <div style={{display:"flex",gap:9,alignItems:"center"}}>
              <div style={{width:58,height:58,border:"1px solid var(--border)",borderRadius:13,display:"grid",placeItems:"center",overflow:"hidden",background:"#F8FAFC",flexShrink:0}}>{tenant.logoUrl?<img src={tenant.logoUrl} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:<b style={{color:tenant.accentColor}}>{tenant.name.slice(0,2).toUpperCase()}</b>}</div>
              <div style={{flex:1}}><input style={iStyle} value={tenant.logoUrl.startsWith("data:")?"":tenant.logoUrl} onChange={e=>updateTenant({logoUrl:e.target.value})} placeholder="https://firma.com/logo.png"/><button onClick={()=>fileInput.current?.click()} style={{border:0,background:"transparent",color:"var(--r-accent)",fontSize:10,fontWeight:800,cursor:"pointer",padding:"6px 0 0"}}>veya dosya yükle</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>uploadLogo(e.target.files?.[0])}/></div>
            </div>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <Field label="Marka Rengi"><input type="color" style={{...iStyle,padding:4,height:39}} value={tenant.accentColor} onChange={e=>updateTenant({accentColor:e.target.value})}/></Field>
            <Field label="Yanıt Adresi"><input type="email" style={iStyle} value={tenant.replyTo} onChange={e=>updateTenant({replyTo:e.target.value})} placeholder="info@firma.com"/></Field>
          </div>
          <div style={{fontSize:10,color:"var(--muted)",background:"#F8FAFC",borderRadius:9,padding:10}}>Gönderici teknik olarak <b>info@corject.com</b> kalır. Görünen marka firma olur; yanıtlar belirlediğiniz adrese yönlenir.</div>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Şablonlar</div>
          <div style={{display:"grid",gap:7}}>{templates.map(item=><button key={item.id} onClick={()=>selectTemplate(item)} style={{border:`1px solid ${selectedId===item.id?item.accentColor:"var(--border)"}`,borderLeft:`5px solid ${item.accentColor}`,borderRadius:10,background:selectedId===item.id?item.accentColor+"0D":"#fff",padding:"10px 11px",textAlign:"left",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:11}}>{item.name}</b><span style={{fontSize:8,color:item.enabled===false?"var(--danger)":"var(--success)",fontWeight:850}}>{item.enabled===false?"PASİF":"AKTİF"}</span></div><div style={{fontSize:9,color:"var(--muted)",marginTop:3}}>{item.category}</div></button>)}</div>
        </Card>
      </div>
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12}}><b style={{fontSize:14}}>Şablon Düzenleyici</b><label style={{fontSize:10,fontWeight:800,color:"var(--muted)"}}><input type="checkbox" checked={draft?.enabled!==false} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/> Aktif</label></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><Field label="Şablon Adı"><input style={iStyle} value={draft?.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Kategori"><input style={iStyle} value={draft?.category||""} onChange={e=>setDraft({...draft,category:e.target.value})}/></Field></div>
          <Field label="Konu"><input style={iStyle} value={draft?.subject||""} onChange={e=>setDraft({...draft,subject:e.target.value})}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><Field label="Üst Etiket"><input style={iStyle} value={draft?.eyebrow||""} onChange={e=>setDraft({...draft,eyebrow:e.target.value})}/></Field><Field label="Vurgu Rengi"><input type="color" style={{...iStyle,padding:4,height:39}} value={draft?.accentColor||tenant.accentColor} onChange={e=>setDraft({...draft,accentColor:e.target.value})}/></Field></div>
          <Field label="Başlık"><input style={iStyle} value={draft?.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
          <Field label="Giriş"><input style={iStyle} value={draft?.intro||""} onChange={e=>setDraft({...draft,intro:e.target.value})}/></Field>
          <Field label="İçerik"><textarea style={{...iStyle,minHeight:120,resize:"vertical"}} value={draft?.body||""} onChange={e=>setDraft({...draft,body:e.target.value})}/></Field>
          <Field label="Buton Metni"><input style={iStyle} value={draft?.buttonLabel||""} onChange={e=>setDraft({...draft,buttonLabel:e.target.value})}/></Field>
          <div style={{background:"#F8FAFC",border:"1px solid var(--border)",padding:10,borderRadius:10}}><div style={{fontSize:10,fontWeight:850,color:"var(--muted)",marginBottom:7}}>Dinamik alan ekle</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:7}}><select style={iStyle} value={selectedVariable} onChange={event=>setSelectedVariable(event.target.value)}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select style={iStyle} value={variableTarget} onChange={event=>setVariableTarget(event.target.value)}>{[["subject","Konu"],["eyebrow","Üst etiket"],["title","Başlık"],["intro","Giriş"],["body","İçerik"],["buttonLabel","Buton"]].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><Btn small variant="secondary" onClick={insertVariable}>Ekle</Btn></div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><button key={key} onClick={()=>{setSelectedVariable(key);setDraft({...draft,[variableTarget]:`${draft[variableTarget]||""}${draft[variableTarget]?" ":""}{{${key}}}`});}} style={{border:0,background:"var(--accent-ink)",color:"var(--r-accent)",borderRadius:7,padding:"4px 7px",fontSize:8,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div></div>
          <div style={{display:"flex",gap:8,marginTop:12}}><Btn onClick={saveTemplate}>Şablonu Kaydet</Btn><Btn variant="secondary" onClick={removeTemplate}>Sil</Btn></div>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Canlı Önizleme</div>
          <iframe title="Mail önizleme" srcDoc={preview.html} style={{width:"100%",height:560,border:"1px solid var(--border)",borderRadius:12,background:"var(--surface-soft)"}}/>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Manuel Gönderim</div>
          <Field label="Alıcı"><input type="email" style={iStyle} value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="alici@firma.com"/></Field>
          <Field label="Önizleme ve test verileri"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:7}}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><label key={key} style={{fontSize:9,color:"var(--muted)"}}>{label}<input style={{...iStyle,marginTop:3}} value={variables[key]||""} onChange={event=>setVariablesText(JSON.stringify({...variables,[key]:event.target.value},null,2))}/></label>)}</div><details style={{marginTop:8}}><summary style={{fontSize:9,color:"var(--muted)",cursor:"pointer"}}>Gelişmiş JSON görünümü</summary><textarea style={{...iStyle,minHeight:150,marginTop:6,fontFamily:"Consolas,monospace",fontSize:10}} value={variablesText} onChange={e=>setVariablesText(e.target.value)}/></details></Field>
          <Btn onClick={send} disabled={sendStatus.loading}>Gönder</Btn>
          {sendStatus.message&&<div style={{marginTop:9,fontSize:10,color:sendStatus.error?"var(--danger)":"var(--success)"}}>{sendStatus.message}</div>}
        </Card>
      </div>
    </div>
  </div>;
}

export function ReportsPage({ state, people, isAdmin, projectId: controlledProjectId, onProjectIdChange, group: controlledGroup, onGroupChange }) {
  const [localProjectId,setLocalProjectId]=useState(state.projects[0]?.id||"");
  const [localGroup,setLocalGroup]=useState("operations");
  const projectId=controlledProjectId||localProjectId;
  const setProjectId=onProjectIdChange||setLocalProjectId;
  const group=controlledGroup??localGroup;
  const setGroup=onGroupChange||setLocalGroup;
  const project=state.projects.find(p=>p.id===projectId);
  const tasks=project?project.milestones.flatMap(m=>m.tasks.map(task=>({task,project,milestone:m}))):[];
  const delayed=tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const taskHours=tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===projectId&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0)
    +((state.projectActions||{})[projectId]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
  const hours=taskHours+fieldHours;
  const machines=project?(project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[]):[];
  const cards=[
    {group:"operations",title:"Gecikme Raporu",desc:"Gecikme yaşını, nedeni ve sorumluları tek bakışta özetler.",color:"var(--r-danger)",action:()=>downloadDelayReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Efor Raporu",desc:"Görevler, saha ziyaretleri ve proje aksiyonlarından saat dağılımı.",color:"var(--r-ok)",action:()=>downloadEffortReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Proje Aksiyonları",desc:"Atanan aksiyonların tarih, sahip ve efor bazlı listesi.",color:"var(--r-accent)",action:()=>downloadProjectActionsReport(state),label:"XLSX İndir"},
    {group:"operations",title:"Saha Ziyaretleri",desc:"Gerçekleşen ziyaretler ve notlarla saha operasyon takibi.",color:"var(--r-ok)",action:()=>downloadFieldVisitsReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Saha Yönetim Raporu",desc:"Planlanan/gerçekleşen saha saatleri, kişi ve proje bazlı saha görünümü.",color:"var(--r-accent)",action:()=>generateFieldManagementReport(state,people),label:"HTML / PDF"},
    {group:"technical",title:"Makine Devreye Alma",desc:"Fiziksel/sanal makinelerin devre durumu ve ilerleme durumu.",color:"var(--r-accent)",action:()=>downloadMachineReport(state),label:"XLSX İndir"},
    {group:"project",title:"İç Operasyon Raporu",desc:"Grafik ve tabloyla görev bazlı yönetim özeti.",color:"var(--chart-4)",action:()=>project&&generateVisualReport(project,people,{fieldHours}),label:"HTML / PDF"},
    {group:"project",title:"Müşteri İlerleme Raporu",desc:"Müşteri görünümüne uygun sade ilerleme özeti.",color:"var(--r-warn)",action:()=>project&&generateVisualReport(project,people,{customer:true,fieldHours}),label:"HTML / PDF"},
    {group:"project",title:"Steerco Toplantı Raporu",desc:"Yönetim toplantısı için karar noktaları ve kritik takip maddeleri.",color:"var(--r-warn)",action:()=>project&&generateSteercoReport(project,state,people),label:"HTML / PDF"},
    ...(isAdmin?[{group:"management",title:"Genel Durum Raporu",desc:"Portföy bazında ilerleme, gecikme ve kapasite karşılaştırması.",color:"var(--chart-1)",action:()=>generatePortfolioReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Ticket Durum Raporu",desc:"Ticket yaş, son aksiyon ve Jira eşleştirmesi.",color:"var(--r-danger)",action:()=>generateTicketStatusReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Ekip Kapasite Raporu",desc:"Kişi bazlı aktif iş ve efor odaklı kapasite görünümü.",color:"var(--chart-2)",action:()=>generateTeamCapacityReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Risk Portföyü Raporu",desc:"Açık riskleri önem seviyesine göre filtreleyerek izler.",color:"var(--chart-5)",action:()=>generateRiskPortfolioReport(state),label:"HTML / PDF"}]:[]),
  ];
  return <div className="project-workspace theme-work-page reports-theme-page" style={{padding:"clamp(16px, 4vw, 28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:20,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:21,display:"flex",alignItems:"center",gap:8}}><Icon name="reports" size={21}/>Raporlar</h2><p style={{margin:"4px 0 0",fontSize:12,color:"var(--muted)"}}>İç operasyon ve müşteri paylaşımı için güncel proje çıktıları.</p></div><div style={{minWidth:"min(240px,100%)",flex:"0 1 280px"}}><label style={lStyle}>Rapor Projesi</label><select style={iStyle} value={projectId} onChange={e=>setProjectId(e.target.value)}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10,marginBottom:20}}>{[["Geciken Görev",delayed.length,"var(--danger)"],["Toplam Efor",`${hours} sa`,"var(--chart-2)"],["Makine",machines.length,"var(--chart-1)"],["Devrede",machines.filter(m=>m.commissioned).length,"var(--success)"]].map(([label,value,color])=><div key={label} className="soft-panel" style={{borderTop:`4px solid ${color}`,padding:14}}><div style={{fontSize:11,color:"var(--muted)"}}>{label}</div><div style={{fontSize:24,fontWeight:800,color,marginTop:3}}>{value}</div></div>)}</div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>{[["operations","Operasyon"],["project","Proje ve Müşteri"],["technical","Teknik"],...(isAdmin?[["management","Yönetici"]]:[])].map(([id,label])=><button key={id} onClick={()=>setGroup(id)} style={{border:"1px solid var(--glass-border)",borderRadius:999,padding:"7px 12px",background:group===id?"var(--accent)":"#fff",color:group===id?"#fff":"var(--text)",fontSize:11,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>{cards.filter(card=>card.group===group).map(card=><div key={card.title} className="soft-panel" style={{borderRadius:14,padding:18,borderLeft:`4px solid ${card.color}`,minHeight:196}}><div style={{fontWeight:800,fontSize:14,marginBottom:6}}>{card.title}</div><div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5,minHeight:54}}>{card.desc}</div><Btn style={{marginTop:12,background:card.color,borderRadius:999}} disabled={!project&&card.title.includes("Rapor")} onClick={card.action}>{card.label}</Btn></div>)}</div>
  </div>;
}

export function generateTicketStatusReport(state,people){
  const tickets = Object.entries(state.projectTickets || {}).flatMap(([projectId,list]) => {
    const project = state.projects.find(p=>p.id===projectId);
    return (list || []).map(ticket => ({ticket,project}));
  });

  const open = tickets.filter(({ticket}) => !["Tamamlandı", "İptal Edildi"].includes(ticket.status)).length;
  const acted = tickets.filter(({ticket}) => (ticket.updatedAt && ticket.updatedAt !== ticket.ts) || !!ticket.jiraStatus).length;

  const rows = tickets.map(({ticket,project}) => {
    const age = Math.max(0, daysDiff(ticket.ts));
    const assignee = people.find(p => p.id === ticket.assignedTo);
    return `<tr><td><b>${ticketNumber(ticket)}</b><br>${escapeHtml(ticket.title)}</td><td>${escapeHtml(project?.name || "Silinmiş proje")}</td><td>${escapeHtml(ticket.status || "Açık")}</td><td>${escapeHtml(ticket.priority || "-")}</td><td>${escapeHtml(assignee?.name || "Atanmamış")}</td><td>${ticket.ts ? new Date(ticket.ts).toLocaleDateString("tr-TR") : "-"}</td><td class="${age >= 7 ? "danger" : ""}">${age} gün</td><td>${ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString("tr-TR") : "Aksiyon yok"}</td><td>${escapeHtml(ticket.jiraStatus || "-")}</td></tr>`;
  }).join("");

  const html = buildThemeReport({
    title: "Ticket Durum Raporu",
    subtitle: "Tüm projeler ve son durumu",
    accent: "#0b8a94",
    content: `
      <section class="r-grid">
        <div class="r-kpi"><small>Toplam Ticket</small><b>${tickets.length}</b></div>
        <div class="r-kpi"><small>Açık Ticket</small><b>${open}</b></div>
        <div class="r-kpi"><small>Kapanan Ticket</small><b>${tickets.length - open}</b></div>
        <div class="r-kpi"><small>Durum Güncelleme</small><b>${acted}</b></div>
      </section>

      <section class="r-card">
        <h3 class="r-card-title">Ticket Listesi</h3>
        <div style="overflow:auto">
          <table class="r-table">
            <thead><tr><th>Ticket</th><th>Proje</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Açılış</th><th>Geçen Süre</th><th>Son Aksiyon</th><th>Jira</th></tr></thead>
            <tbody>${rows || "<tr><td colspan='9'>Ticket yok.</td></tr>"}</tbody>
          </table>
        </div>
      </section>
    `,
  });

  downloadTextFile(html, `ticket-durum-raporu-${todayStr()}.html`, "text/html;charset=utf-8");
}






