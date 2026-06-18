import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { sendManagedTemplateEmail } from "../email";
import { commissioningMachines, fieldPlanHours, projectPmIds, ticketNumber } from "../domain/projectHelpers.js";
import { Btn, Card, Field, Icon, iStyle, lStyle } from "./primitives.jsx";
import { STATUS_COLORS as S, daysDiff, delayLvl } from "./status.jsx";
import { DEFAULT_EMAIL_TEMPLATES, renderManagedTemplate, resolveEmailTemplates, resolveTenantProfile } from "../../server/services/emailTemplate.js";

const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "?";
const todayStr = () => new Date().toISOString().slice(0, 10);
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const commissioningRows=(sectors=[])=>sectors.flatMap(sector=>(sector.productionCenters||[]).flatMap(center=>(center.workplaces||[]).flatMap(workplace=>(workplace.lines||[]).flatMap(line=>(line.machines||[]).map(machine=>({sector:sector.name,productionCenter:center.name,workplace:workplace.name,line:line.name,machine}))))));
const LOG_META = {
  task_done:{ icon:"?", color:"#059669", bg:"#ECFDF5", label:"Tamamland?" },
  task_add:{ icon:"+", color:"#4A6CF7", bg:"#F1F5FF", label:"G?rev Eklendi" },
  task_delete:{ icon:"?", color:"#E11D48", bg:"#FFF1F2", label:"G?rev Silindi" },
  status_change:{ icon:"?", color:"#EA6C00", bg:"#FFF7ED", label:"Durum De?i?ti" },
  milestone_add:{ icon:"?", color:"#7C3AED", bg:"#F5F3FF", label:"Milestone" },
  project_create:{ icon:"?", color:"#0EA5E9", bg:"#F0F9FF", label:"Proje" },
  risk_add:{ icon:"!", color:"#E11D48", bg:"#FFF1F2", label:"Risk" },
  import:{ icon:"?", color:"#64748B", bg:"#F8FAFC", label:"Import" },
  person_add:{ icon:"?", color:"#4A6CF7", bg:"#F1F5FF", label:"Ekip" },
  general:{ icon:"?", color:"#64748B", bg:"#F8FAFC", label:"Genel" },
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
  const machines=project.machines||[];
  const commissioned=machines.filter(m=>m.commissioned).length;
  const hours=tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const rows=tasks.map(t=>`<tr><td>${t.milestone}</td><td>${t.title}</td><td>${t.status}</td><td>${fmt(t.dueDate)}</td>${customer?"":`<td>${people.find(p=>p.id===t.assignee)?.name||"Atanmamış"}</td><td>${(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)} sa</td>`}</tr>`).join("");
  const machineRows=machines.map(m=>`<tr><td>${m.code||"-"}</td><td>${m.name}</td><td>${m.type==="virtual"?"Sanal":"Fiziksel"}</td><td>${m.commissioned?"Devrede":"Bekliyor"}</td><td>${m.commissioned?fmt(m.commissionedAt):(customer?"Planlanıyor":m.note||"-")}</td></tr>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${project.name} - ${customer?"Müşteri":"İç"} Rapor</title><style>body{font-family:Arial,sans-serif;color:#1e293b;padding:32px}h1{margin-bottom:4px}.meta{color:#64748b;margin-bottom:24px}.stats{display:flex;gap:12px;margin:20px 0}.stat{border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px}.stat b{display:block;font-size:24px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f8fafc}button{float:right;padding:8px 14px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Yazdır / PDF</button><h1>${project.name}</h1><div class="meta">${customer?"Müşteri İlerleme Raporu":"İç Operasyon Raporu"} · ${new Date().toLocaleDateString("tr-TR")}</div><div class="stats"><div class="stat"><b>${tasks.length?Math.round(done/tasks.length*100):0}%</b>İlerleme</div><div class="stat"><b>${done}/${tasks.length}</b>Görev</div><div class="stat"><b>${commissioned}/${machines.length}</b>Makine</div><div class="stat"><b>${delayed.length}</b>Gecikme</div>${customer?"":`<div class="stat"><b>${hours}</b>Saat</div>`}</div><h2>Görev Durumu</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Termin</th>${customer?"":"<th>Sorumlu</th><th>Efor</th>"}</tr></thead><tbody>${rows}</tbody></table><h2>Makine Devreye Alma</h2><table><thead><tr><th>Kod</th><th>Makine</th><th>Tip</th><th>Durum</th><th>${customer?"Plan":"Açıklama"}</th></tr></thead><tbody>${machineRows||"<tr><td colspan='5'>Makine kaydı yok.</td></tr>"}</tbody></table>${!customer&&delayed.length?`<h2>Gecikmeler</h2><ul>${delayed.map(t=>`<li>${t.title} · ${daysDiff(t.dueDate)} gün · ${t.waitSource||"Neden belirtilmedi"}</li>`).join("")}</ul>`:""}</body></html>`;
  downloadTextFile(html,`${safeFileName(project.name)}-${customer?"musteri":"ic"}-rapor.html`,"text/html;charset=utf-8");
}

export function generateVisualReport(project,people,{customer=false,fieldHours=0}={}){
  const tasks=project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name})));
  const count=(status)=>tasks.filter(t=>t.status===status).length;
  const done=count("Tamamlandı"), active=count("Devam Ediyor"), waiting=count("Bekliyor");
  const delayed=tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const machines=project.machines||[];
  const commissioned=machines.filter(m=>m.commissioned).length;
  const hours=tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0)+fieldHours;
  const progress=tasks.length?Math.round(done/tasks.length*100):0;
  const taskRows=tasks.map(t=>`<tr><td>${t.milestone}</td><td><b>${t.title}</b></td><td><span class="pill ${t.status==="Tamamlandı"?"green":t.status==="Devam Ediyor"?"blue":"orange"}">${t.status}</span></td><td>${fmt(t.dueDate)}</td>${customer?"":`<td>${people.find(p=>p.id===t.assignee)?.name||"Atanmamış"}</td><td>${(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)} sa</td>`}</tr>`).join("");
  const machineRows=machines.map(m=>`<tr><td>${m.code||"-"}</td><td><b>${m.name}</b></td><td>${m.type==="virtual"?"Sanal":"Fiziksel"}</td><td><span class="pill ${m.commissioned?"green":"orange"}">${m.commissioned?"Devrede":"Bekliyor"}</span></td><td>${m.commissioned?fmt(m.commissionedAt):(customer?"Planlanıyor":m.note||"-")}</td></tr>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${project.name} Raporu</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:linear-gradient(135deg,#eef2ff,#f8fafc 55%,#f5f3ff);font-family:Inter,Segoe UI,Arial;color:#172033}.wrap{max-width:1180px;margin:auto}.hero{background:linear-gradient(125deg,#172554,#4338ca,#7c3aed);color:#fff;border-radius:24px;padding:30px;box-shadow:0 20px 45px #312e8130}.hero h1{margin:0 0 6px;font-size:29px}.hero p{margin:0;color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800;cursor:pointer}.overview{display:grid;grid-template-columns:1fr 2fr;gap:18px;margin:18px 0}.card{background:#fff;border-radius:18px;padding:21px;border:1px solid #e2e8f0;box-shadow:0 8px 24px #33415512}.donut{width:150px;height:150px;border-radius:50%;margin:auto;display:grid;place-items:center;background:conic-gradient(#4f46e5 0 ${progress}%,#e2e8f0 ${progress}% 100%)}.donut:after{content:"${progress}%";width:108px;height:108px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:27px;font-weight:900;color:#4338ca}.stats{display:grid;grid-template-columns:repeat(${customer?4:5},1fr);gap:10px}.stat{border-radius:14px;padding:16px;color:#fff;min-height:92px}.stat b{font-size:25px;display:block}.s1{background:linear-gradient(135deg,#2563eb,#4f46e5)}.s2{background:linear-gradient(135deg,#059669,#10b981)}.s3{background:linear-gradient(135deg,#dc2626,#f43f5e)}.s4{background:linear-gradient(135deg,#ea580c,#f59e0b)}.s5{background:linear-gradient(135deg,#7c3aed,#a855f7)}.bar{display:flex;height:13px;border-radius:8px;overflow:hidden;background:#e2e8f0;margin-top:18px}.legend{display:flex;gap:13px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#64748b}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}h2{font-size:17px;margin:0 0 14px}.table{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #eef2f7;font-size:12px}th{background:#f8fafc;color:#64748b}.pill{display:inline-block;border-radius:99px;padding:3px 8px;font-size:10px;font-weight:800}.pill.green{background:#d1fae5;color:#047857}.pill.blue{background:#dbeafe;color:#1d4ed8}.pill.orange{background:#ffedd5;color:#c2410c}@media(max-width:760px){body{padding:14px}.overview{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.hero{padding:20px}}@media print{body{padding:0;background:#fff}.print{display:none}.hero,.card{box-shadow:none}}
</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>${project.name}</h1><p>${customer?"Müşteri İlerleme Raporu":"İç Operasyon Raporu"} · ${new Date().toLocaleDateString("tr-TR")} · ${fmt(project.startDate)} - ${fmt(project.endDate)}</p></div><div class="overview"><div class="card"><h2>Genel İlerleme</h2><div class="donut"></div><div class="bar"><span style="width:${tasks.length?done/tasks.length*100:0}%;background:#10b981"></span><span style="width:${tasks.length?active/tasks.length*100:0}%;background:#3b82f6"></span><span style="width:${tasks.length?waiting/tasks.length*100:0}%;background:#f59e0b"></span></div><div class="legend"><span><i class="dot" style="background:#10b981"></i>Tamamlandı ${done}</span><span><i class="dot" style="background:#3b82f6"></i>Devam ${active}</span><span><i class="dot" style="background:#f59e0b"></i>Bekliyor ${waiting}</span></div></div><div class="stats"><div class="stat s1"><b>${done}/${tasks.length}</b>Görev</div><div class="stat s2"><b>${commissioned}/${machines.length}</b>Makine</div><div class="stat s3"><b>${delayed.length}</b>Gecikme</div><div class="stat s4"><b>${project.milestones.length}</b>Milestone</div>${customer?"":`<div class="stat s5"><b>${hours}</b>Efor Saati</div>`}</div></div><div class="card"><h2>Görev Durumu</h2><div class="table"><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Termin</th>${customer?"":"<th>Sorumlu</th><th>Efor</th>"}</tr></thead><tbody>${taskRows||"<tr><td colspan='6'>Görev kaydı yok.</td></tr>"}</tbody></table></div></div><div class="card" style="margin-top:18px"><h2>Makine Devreye Alma</h2><div class="table"><table><thead><tr><th>Kod</th><th>Makine</th><th>Tip</th><th>Durum</th><th>${customer?"Plan":"Açıklama"}</th></tr></thead><tbody>${machineRows||"<tr><td colspan='5'>Makine kaydı yok.</td></tr>"}</tbody></table></div></div>${!customer&&delayed.length?`<div class="card" style="margin-top:18px;border-left:5px solid #ef4444"><h2 style="color:#dc2626">Gecikme Analizi</h2>${delayed.map(t=>`<div style="padding:8px 0;border-bottom:1px solid #fee2e2"><b>${t.title}</b><span style="float:right;color:#dc2626;font-weight:800">${daysDiff(t.dueDate)} gün</span><div style="font-size:11px;color:#64748b">${t.waitSource||"Neden belirtilmedi"}</div></div>`).join("")}</div>`:""}</div></body></html>`;
  downloadTextFile(html,`${safeFileName(project.name)}-${customer?"musteri":"ic"}-rapor.html`,"text/html;charset=utf-8");
}

export function generatePortfolioReport(state,people){
  const data=state.projects.map(project=>{
    const tasks=project.milestones.flatMap(ms=>ms.tasks), done=tasks.filter(t=>t.status==="Tamamlandı").length;
    const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0);
    const actionHours=((state.projectActions||{})[project.id]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
    return {project,tasks,done,progress:tasks.length?Math.round(done/tasks.length*100):0,delayed:tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,hours:tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0)+fieldHours+actionHours,machines:project.machines||[]};
  });
  const totalTasks=data.reduce((a,r)=>a+r.tasks.length,0), totalDone=data.reduce((a,r)=>a+r.done,0), totalDelayed=data.reduce((a,r)=>a+r.delayed,0), totalHours=data.reduce((a,r)=>a+r.hours,0);
  const tableRows=data.map(r=>`<tr><td><b>${r.project.name}</b></td><td>${projectPmIds(r.project).map(id=>people.find(p=>p.id===id)?.name).filter(Boolean).join(", ")||"Atanmamış"}</td><td>${r.project.status}</td><td><span class="track"><i style="width:${r.progress}%;background:${r.project.color}"></i></span><b>${r.progress}%</b></td><td>${r.done}/${r.tasks.length}</td><td class="${r.delayed?"danger":""}">${r.delayed}</td><td>${r.machines.filter(m=>m.commissioned).length}/${r.machines.length}</td><td>${r.hours} sa</td></tr>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Corject Genel Durum Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1250px;margin:auto}.hero{background:linear-gradient(120deg,#172554,#4338ca,#7c3aed);color:#fff;border-radius:24px;padding:30px;box-shadow:0 20px 45px #312e8130}.hero h1{margin:0}.hero p{color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat{padding:18px;border-radius:16px;color:#fff}.stat b{font-size:28px;display:block}.blue{background:linear-gradient(135deg,#2563eb,#4f46e5)}.green{background:linear-gradient(135deg,#059669,#10b981)}.red{background:linear-gradient(135deg,#dc2626,#f43f5e)}.purple{background:linear-gradient(135deg,#7c3aed,#a855f7)}.portfolio{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px}.project,.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:17px}.project h3{margin:0 0 10px}.ring,.track{display:inline-block;background:#e2e8f0;border-radius:8px;overflow:hidden}.ring{display:block;height:8px}.ring i,.track i{display:block;height:100%;border-radius:8px}.track{width:80px;height:7px;margin-right:7px}.card{box-shadow:0 8px 24px #33415510}.table{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #eef2f7;font-size:12px}th{background:#f8fafc;color:#64748b}.danger{color:#dc2626;font-weight:800}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:1fr 1fr}.hero{padding:20px}}@media print{body{padding:0;background:#fff}.print{display:none}.hero,.card{box-shadow:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Corject Genel Durum Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · ${state.projects.length} proje portföyü</p></div><div class="stats"><div class="stat blue"><b>${state.projects.length}</b>Toplam Proje</div><div class="stat green"><b>${totalDone}/${totalTasks}</b>Tamamlanan Görev</div><div class="stat red"><b>${totalDelayed}</b>Geciken Görev</div><div class="stat purple"><b>${totalHours}</b>Toplam Efor</div></div><div class="portfolio">${data.map(r=>`<div class="project" style="border-top:4px solid ${r.project.color}"><h3>${r.project.name}</h3><div class="ring"><i style="width:${r.progress}%;background:${r.project.color}"></i></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#64748b"><span>${r.progress}% tamamlandı</span><span style="color:${r.delayed?"#dc2626":"#059669"}">${r.delayed} gecikme</span></div></div>`).join("")}</div><div class="card"><h2>Proje Karşılaştırması</h2><div class="table"><table><thead><tr><th>Proje</th><th>PM</th><th>Durum</th><th>İlerleme</th><th>Görev</th><th>Gecikme</th><th>Makine</th><th>Efor</th></tr></thead><tbody>${tableRows||"<tr><td colspan='8'>Proje yok.</td></tr>"}</tbody></table></div></div></div></body></html>`;
  downloadTextFile(html,`corject-genel-durum-${todayStr()}.html`,"text/html;charset=utf-8");
}

// ─── HTML Report ─────────────────────────────────────────────────────────────
export function generateHTMLReport(project, people, logs) {
  const findName=(id)=>people.find(p=>p.id===id)?.name||"Atanmamış";
  const allTasks=project.milestones.flatMap(ms=>ms.tasks.map(t=>({...t,msName:ms.name,msDue:ms.dueDate})));
  const done=allTasks.filter(t=>t.status==="Tamamland\u0131");
  const active=allTasks.filter(t=>t.status==="Devam Ediyor");
  const waiting=allTasks.filter(t=>t.status==="Bekliyor");
  const delayed=allTasks.filter(t=>delayLvl(t.dueDate,t.status));
  const progress=allTasks.length?Math.round((done.length/allTasks.length)*100):0;
  const pmNames=projectPmIds(project).map(id=>people.find(p=>p.id===id)?.name).filter(Boolean).join(", ");
  const projLogs=logs.filter(l=>l.project===project.name).slice(0,10);

  const taskRows=(tasks)=>tasks.map(t=>{
    const dl=delayLvl(t.dueDate,t.status);
    const dlCell=dl==="critical"?`<span style="background:#FFF1F2;color:#E11D48;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">Kritik</span>`:dl==="normal"?`<span style="background:#FFF7ED;color:#EA6C00;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">Gecikti</span>`:"";
    const stColor=S[t.status]?.text||"#64748B";
    return `<tr><td>${t.msName}</td><td><strong>${t.title}</strong></td><td style="color:${stColor}">${t.status}</td><td>${t.priority}</td><td>${findName(t.assignee)}</td><td>${fmt(t.dueDate)}</td><td>${dlCell}</td></tr>`;
  }).join("");

  const logRows=projLogs.map(l=>{
    const meta=LOG_META[l.action]||LOG_META.general;
    return `<tr><td style="color:#64748B;font-size:12px">${new Date(l.ts).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"})}</td><td><span style="background:${meta.bg};color:${meta.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${meta.label}</span></td><td><strong>${l.user}</strong></td><td style="color:#64748B">${l.detail}</td></tr>`;
  }).join("");

  // Simple Gantt as HTML table
  const ms=project.milestones;
  const starts=ms.map(m=>m.startDate||project.startDate).filter(Boolean);
  const ends=ms.map(m=>m.dueDate).filter(Boolean);
  let ganttHTML="<p style=\"color:#94A3B8;font-size:12px\">Tarih bilgisi eksik.</p>";
  if(starts.length&&ends.length){
    const minDate=new Date(Math.min(...starts.map(d=>new Date(d))));
    const maxDate=new Date(Math.max(...ends.map(d=>new Date(d))));
    const total=Math.max(1,(maxDate-minDate)/86400000)+4;
    const pct=(d)=>Math.max(0,Math.min(100,((new Date(d)-minDate)/86400000)/total*100));
    const wPct=(s,e)=>Math.max(1,(new Date(e)-new Date(s))/86400000/total*100);
    const todayOff=Math.max(0,(new Date()-minDate)/86400000);
    const todayPct=Math.min(100,todayOff/total*100);
    const ganttRows=ms.map(m=>{
      const s=m.startDate||project.startDate,e=m.dueDate;
      if(!s||!e)return"";
      const dl=delayLvl(e,m.status);
      const barC=m.status==="Tamamland\u0131"?"#059669":dl==="critical"?"#E11D48":dl==="normal"?"#EA6C00":project.color;
      return `<div style="display:flex;align-items:center;margin-bottom:8px"><div style="width:140px;flex-shrink:0;font-size:11px;font-weight:600;padding-right:8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${m.name}</div><div style="flex:1;position:relative;height:22px;background:#F1F5FF;border-radius:4px"><div style="position:absolute;left:${pct(s)}%;width:${wPct(s,e)}%;top:2px;height:18px;background:${barC};border-radius:3px;display:flex;align-items:center;justify-content:center;min-width:16px"><span style="font-size:9px;color:#fff;padding:0 3px">${fmt(e)}</span></div><div style="position:absolute;left:${todayPct}%;top:0;bottom:0;width:2px;background:#E11D48;z-index:2"></div></div><div style="width:70px;text-align:right;padding-left:6px;font-size:10px;color:#94A3B8">${m.tasks.filter(t=>t.status==="Tamamland\u0131").length}/${m.tasks.length}</div></div>`;
    }).join("");
    ganttHTML=ganttRows;
  }

  const html=`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${project.name} - Yönetici Raporu</title>
<style>
body{font-family:Inter,Segoe UI,sans-serif;margin:0;padding:32px;color:#1E293B;background:#F8FAFC}
h1{font-size:24px;font-weight:800;margin:0 0 4px}
h2{font-size:16px;font-weight:700;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #E2E8F0}
.meta{font-size:13px;color:#64748B;margin-bottom:24px}
.card{background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:20px;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stat{background:#fff;border-radius:10px;padding:14px;border:1px solid #E2E8F0;text-align:center}
.stat-num{font-size:26px;font-weight:800;margin:0}
.stat-lbl{font-size:11px;color:#64748B;margin-top:2px}
.prog{height:10px;background:#E2E8F0;border-radius:10px;overflow:hidden;margin:10px 0}
.prog-bar{height:100%;background:${project.color};border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#F8FAFC;padding:8px 10px;text-align:left;font-weight:600;color:#64748B;border-bottom:1px solid #E2E8F0}
td{padding:8px 10px;border-bottom:1px solid #F1F5FF}
tr:last-child td{border-bottom:none}
@media print{body{padding:16px;background:#fff}.card{box-shadow:none;border:1px solid #E2E8F0}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="float:right;background:#4A6CF7;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-weight:600;font-size:13px">Yazdır / PDF</button>
<h1>${project.name}</h1>
<div class="meta">Rapor tarihi: ${new Date().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})} &nbsp;|&nbsp; PM: ${pmNames||"Atanmamış"} &nbsp;|&nbsp; ${fmt(project.startDate)} - ${fmt(project.endDate)}</div>

<div class="stats">
  <div class="stat"><div class="stat-num" style="color:#4A6CF7">${progress}%</div><div class="stat-lbl">İlerleme</div></div>
  <div class="stat"><div class="stat-num" style="color:#059669">${done.length}</div><div class="stat-lbl">Tamamlandı</div></div>
  <div class="stat"><div class="stat-num" style="color:#EA6C00">${active.length}</div><div class="stat-lbl">Devam Ediyor</div></div>
  <div class="stat"><div class="stat-num" style="color:#E11D48">${delayed.length}</div><div class="stat-lbl">Gecikmiş</div></div>
</div>

<div class="card">
  <h2>Proje Planı</h2>
  <div class="prog"><div class="prog-bar" style="width:${progress}%"></div></div>
  <div style="font-size:12px;color:#64748B;margin-bottom:16px">${done.length}/${allTasks.length} görev tamamlandı</div>
  ${ganttHTML}
  <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
    ${[[project.color,"Devam Ediyor"],["#059669","Tamamlandı"],["#EA6C00","Gecikmiş"],["#E11D48","Kritik"]].map(([c,l])=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:8px;border-radius:2px;background:${c}"></div><span style="font-size:11px;color:#64748B">${l}</span></div>`).join("")}
  </div>
</div>

${active.length>0?`<div class="card"><h2>Devam Eden Görevler (${active.length})</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th><th>Gecikme</th></tr></thead><tbody>${taskRows(active)}</tbody></table></div>`:""}

${delayed.length>0?`<div class="card" style="border-left:4px solid #E11D48"><h2 style="color:#E11D48">Gecikmiş / Kritik Görevler (${delayed.length})</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th><th>Gecikme</th></tr></thead><tbody>${taskRows(delayed)}</tbody></table></div>`:""}

${(()=>{
  const timeByPerson={};
  let grandTotal=0;
  allTasks.forEach(t=>(t.timeEntries||[]).forEach(e=>{
    const h=parseFloat(e.hours)||0;
    timeByPerson[e.user]=(timeByPerson[e.user]||0)+h;
    grandTotal+=h;
  }));
  if(grandTotal===0)return"";
  const personRows=Object.entries(timeByPerson).sort((a,b)=>b[1]-a[1]).map(([name,h])=>`<tr><td><strong>${name}</strong></td><td>${h} saat</td><td>${Math.round(h/grandTotal*100)}%</td></tr>`).join("");
  const taskRows2=allTasks.filter(t=>(t.timeEntries||[]).length>0).map(t=>{
    const th=(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
    return `<tr><td>${t.msName}</td><td><strong>${t.title}</strong></td><td>${findName(t.assignee)}</td><td>${th} saat</td></tr>`;
  }).join("");
  return `<div class="card"><h2>Harcanan Süre Raporu (Toplam: ${grandTotal} saat)</h2>
    <table style="margin-bottom:16px"><thead><tr><th>Kisi</th><th>Toplam Saat</th><th>Oran</th></tr></thead><tbody>${personRows}</tbody></table>
    <table><thead><tr><th>Milestone</th><th>Görev</th><th>Sorumlu</th><th>Sure</th></tr></thead><tbody>${taskRows2}</tbody></table></div>`;
})()}

<div class="card"><h2>Tamamlanan Görevler (${done.length})</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th><th></th></tr></thead><tbody>${taskRows(done)}</tbody></table></div>

${projLogs.length>0?`<div class="card"><h2>Son Aktiviteler</h2><table><thead><tr><th>Tarih</th><th>Tip</th><th>Kullanici</th><th>Detay</th></tr></thead><tbody>${logRows}</tbody></table></div>`:""}

</body></html>`;
  const uri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
  const a = document.createElement("a");
  a.href = uri;
  a.download = project.name.replace(/[^a-zA-Z0-9]/g,"_") + "-rapor.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


// ─── Risk Panel ──────────────────────────────────────────────────────────────


export function generateTeamCapacityReport(state,people){
  const tasks=state.projects.flatMap(project=>project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({task,project}))));
  const rows=people.map(person=>{
    const assigned=tasks.filter(({task})=>task.assignee===person.id);
    const active=assigned.filter(({task})=>task.status!=="Tamamland\u0131");
    const delayed=active.filter(({task})=>delayLvl(task.dueDate,task.status));
    const hours=assigned.reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0)
      +(state.fieldPlans||[]).filter(plan=>plan.userId===person.id&&(plan.status==="completed"||plan.completedAt)).reduce((total,plan)=>total+fieldPlanHours(plan),0);
    return {person,assigned:assigned.length,active:active.length,delayed:delayed.length,hours};
  }).filter(item=>item.assigned||item.hours).sort((a,b)=>b.active-a.active||b.hours-a.hours);
  const max=Math.max(1,...rows.map(item=>item.active));
  const cards=rows.map(item=>`<div class="person"><div class="head"><div class="avatar">${item.person.avatar||"?"}</div><div><b>${item.person.name}</b><small>${item.person.role||""}</small></div><strong>${item.active} aktif</strong></div><div class="track"><i style="width:${item.active/max*100}%;background:${item.delayed?"linear-gradient(90deg,#f59e0b,#ef4444)":"linear-gradient(90deg,#4f46e5,#7c3aed)"}"></i></div><div class="meta"><span>${item.assigned} toplam görev</span><span class="${item.delayed?"danger":""}">${item.delayed} gecikmiş</span><span>${item.hours} saat efor</span></div></div>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ekip Kapasite Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#eef2ff;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1100px;margin:auto}.hero{background:linear-gradient(125deg,#172554,#4338ca,#7c3aed);color:#fff;padding:28px;border-radius:22px;margin-bottom:18px}.hero h1{margin:0}.hero p{color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.person{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:17px}.head{display:flex;gap:10px;align-items:center}.head>div:nth-child(2){flex:1}.head small{display:block;color:#94a3b8;margin-top:2px}.head strong{color:#4338ca}.avatar{width:38px;height:38px;border-radius:50%;background:#eef2ff;color:#4338ca;display:grid;place-items:center;font-weight:900}.track{height:8px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin:14px 0 8px}.track i{display:block;height:100%;border-radius:10px}.meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#64748b}.danger{color:#dc2626;font-weight:800}@media(max-width:700px){body{padding:14px}.grid{grid-template-columns:1fr}}@media print{body{background:#fff;padding:0}.print{display:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Ekip Kapasite Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · ${state.projects.length} proje · ${tasks.length} görev</p></div><div class="grid">${cards||"<div class='person'>Atanmış görev bulunmuyor.</div>"}</div></div></body></html>`;
  downloadTextFile(html,`ekip-kapasite-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

export function generateRiskPortfolioReport(state){
  const risks=state.projects.flatMap(project=>(project.risks||[]).map(risk=>({risk,project})));
  const open=risks.filter(({risk})=>!["Kapal\u0131","Kapalı"].includes(risk.status));
  const high=open.filter(({risk})=>["Y\u00fcksek","Kritik"].includes(risk.level));
  const rows=risks.map(({risk,project})=>`<tr><td><b>${risk.title}</b><small>${risk.note||""}</small></td><td>${project.name}</td><td><span class="pill ${["Y\u00fcksek","Kritik"].includes(risk.level)?"red":risk.level==="Orta"?"orange":"green"}">${risk.level||"-"}</span></td><td>${risk.status||"Açık"}</td></tr>`).join("");
  const projectBars=state.projects.map(project=>{const count=(project.risks||[]).filter(risk=>!["Kapal\u0131","Kapalı"].includes(risk.status)).length;const critical=(project.risks||[]).filter(risk=>["Y\u00fcksek","Kritik"].includes(risk.level)&&!["Kapal\u0131","Kapalı"].includes(risk.status)).length;return `<div class="bar"><div><b>${project.name}</b><span>${count} açık · ${critical} yüksek</span></div><i><em style="width:${Math.min(100,count*20)}%;background:${critical?"#ef4444":count?"#f59e0b":"#10b981"}"></em></i></div>`}).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Risk Portföyü Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#fff7ed;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1200px;margin:auto}.hero{background:linear-gradient(125deg,#7c2d12,#ea580c,#f59e0b);color:#fff;padding:28px;border-radius:22px}.hero h1{margin:0}.hero p{color:#ffedd5}.print{float:right;border:0;border-radius:10px;background:#fff;color:#c2410c;padding:9px 15px;font-weight:800}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.stat{background:#fff;border-radius:15px;padding:17px;border:1px solid #fed7aa}.stat b{display:block;font-size:28px;color:#c2410c}.layout{display:grid;grid-template-columns:1fr 1.5fr;gap:14px}.card{background:#fff;border:1px solid #fed7aa;border-radius:17px;padding:19px}.bar{margin-bottom:13px}.bar div{display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px}.bar span{color:#64748b}.bar i{display:block;height:8px;background:#f1f5f9;border-radius:10px;overflow:hidden}.bar em{display:block;height:100%;border-radius:10px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ffedd5;text-align:left;font-size:11px}th{color:#64748b;background:#fffaf5}td small{display:block;color:#94a3b8;margin-top:3px}.pill{padding:3px 7px;border-radius:8px;font-weight:800}.red{background:#fff1f2;color:#dc2626}.orange{background:#fff7ed;color:#ea580c}.green{background:#ecfdf5;color:#059669}@media(max-width:760px){body{padding:14px}.stats,.layout{grid-template-columns:1fr}}@media print{body{background:#fff;padding:0}.print{display:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Risk Portföyü Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · Yönetici risk görünümü</p></div><div class="stats"><div class="stat"><b>${risks.length}</b>Toplam Risk</div><div class="stat"><b>${open.length}</b>Açık Risk</div><div class="stat"><b>${high.length}</b>Yüksek / Kritik</div></div><div class="layout"><div class="card"><h3>Proje Risk Yoğunluğu</h3>${projectBars||"Proje bulunmuyor."}</div><div class="card"><h3>Risk Envanteri</h3><div style="overflow:auto"><table><thead><tr><th>Risk</th><th>Proje</th><th>Seviye</th><th>Durum</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Risk bulunmuyor.</td></tr>"}</tbody></table></div></div></div></div></body></html>`;
  downloadTextFile(html,`risk-portfoyu-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

export function generateSteercoReport(project,state,people){
  if(!project)return;
  const tasks=project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({task,milestone})));
  const done=tasks.filter(({task})=>task.status==="Tamamlandı").length;
  const progress=tasks.length?Math.round(done/tasks.length*100):0;
  const delayed=tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const risks=(project.risks||[]).filter(risk=>!["Kapalı","Kapal\u0131"].includes(risk.status));
  const criticalRisks=risks.filter(risk=>["Yüksek","Kritik"].includes(risk.level));
  const actions=((state.projectActions||{})[project.id]||[]).slice().sort((a,b)=>String(b.actionAt||b.createdAt||"").localeCompare(String(a.actionAt||a.createdAt||""))).slice(0,8);
  const tickets=((state.projectTickets||{})[project.id]||[]);
  const openTickets=tickets.filter(ticket=>!["Tamamlandı","İptal Edildi","Done"].includes(ticket.status));
  const machines=project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[];
  const commissioned=machines.filter(machine=>machine.commissioned).length;
  const machineProgress=machines.length?Math.round(commissioned/machines.length*100):0;
  const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0);
  const taskHours=tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((total,entry)=>total+(parseFloat(entry.hours)||0),0),0);
  const actionHours=actions.reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
  const totalHours=Math.round((fieldHours+taskHours+actionHours)*10)/10;
  const health=progress>=75&&criticalRisks.length===0&&delayed.length<3?"Sağlıklı":criticalRisks.length||delayed.length>5?"Yönetici Aksiyonu Gerekli":"Dikkat";
  const statusColor=health==="Sağlıklı"?"#059669":health==="Dikkat"?"#EA6C00":"#E11D48";
  const nextTasks=tasks.filter(({task})=>task.status!=="Tamamlandı").sort((a,b)=>String(a.task.dueDate||"9999").localeCompare(String(b.task.dueDate||"9999"))).slice(0,8);
  const rows=nextTasks.map(({task,milestone})=>`<tr><td><b>${escapeHtml(task.title)}</b><small>${escapeHtml(milestone.name)}</small></td><td>${escapeHtml(people.find(person=>person.id===task.assignee)?.name||"-")}</td><td>${fmt(task.dueDate)}</td><td>${escapeHtml(task.status||"-")}</td></tr>`).join("");
  const actionRows=actions.map(action=>`<li><b>${fmt(action.actionAt||action.createdAt)}</b><span>${escapeHtml(action.text||"")}</span></li>`).join("");
  const riskRows=risks.slice(0,6).map(risk=>`<li><b>${escapeHtml(risk.level||"Risk")}</b><span>${escapeHtml(risk.title||"")} ${risk.note?`<small>${escapeHtml(risk.note)}</small>`:""}</span></li>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Steerco Raporu - ${escapeHtml(project.name)}</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#eef2ff;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1180px;margin:auto}.hero{background:linear-gradient(125deg,#0f172a,#4338ca,#06b6d4);color:#fff;padding:30px;border-radius:24px;margin-bottom:16px;box-shadow:0 24px 60px rgba(30,41,59,.18)}.hero h1{margin:0;font-size:32px}.hero p{color:#dbeafe;margin:8px 0 0}.print{float:right;border:0;border-radius:12px;background:#fff;color:#4338ca;padding:10px 16px;font-weight:900}.badge{display:inline-block;background:${statusColor};color:#fff;border-radius:999px;padding:7px 12px;font-weight:900;margin-bottom:14px}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px}.stat{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.stat b{display:block;font-size:25px;color:#4338ca}.stat span{font-size:11px;color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:19px}.card h2{font-size:16px;margin:0 0 12px}.bar{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4f46e5,#06b6d4)}ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}li{display:flex;gap:10px;font-size:12px;line-height:1.45}li b{min-width:92px;color:#4338ca}li small{display:block;color:#94a3b8;margin-top:3px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px}th{background:#f8fafc;color:#64748b}td small{display:block;color:#94a3b8;margin-top:3px}.wide{grid-column:1/-1}@media(max-width:820px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.hero h1{font-size:24px}}@media print{body{background:#fff;padding:0}.print{display:none}.hero{box-shadow:none}}</style></head><body><div class="wrap"><section class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><span class="badge">${health}</span><h1>Steerco Proje Durum Raporu</h1><p>${escapeHtml(project.name)} · ${new Date().toLocaleDateString("tr-TR")} · Yönetici karar toplantısı çıktısı</p></section><section class="stats"><div class="stat"><span>Genel İlerleme</span><b>%${progress}</b></div><div class="stat"><span>Devreye Alma</span><b>%${machineProgress}</b></div><div class="stat"><span>Geciken İş</span><b>${delayed.length}</b></div><div class="stat"><span>Açık Risk</span><b>${risks.length}</b></div><div class="stat"><span>Açık Ticket</span><b>${openTickets.length}</b></div><div class="stat"><span>Toplam Efor</span><b>${totalHours} sa</b></div></section><section class="grid"><div class="card"><h2>Proje İlerleme Özeti</h2><div class="bar"><i style="width:${progress}%"></i></div><p style="font-size:12px;color:#64748b;line-height:1.6">Tamamlanan görev sayısı ${done}/${tasks.length}. Makine/devreye alma kapsamı ${commissioned}/${machines.length||0}. Yönetim odağı: ${health}.</p></div><div class="card"><h2>Karar / Dikkat Gerektiren Konular</h2><ul>${riskRows||"<li><b>Risk</b><span>Açık kritik risk bulunmuyor.</span></li>"}${delayed.length?`<li><b>Termin</b><span>${delayed.length} geciken görev için aksiyon gerekli.</span></li>`:""}</ul></div><div class="card"><h2>Son Aksiyonlar</h2><ul>${actionRows||"<li><b>Aksiyon</b><span>Henüz aksiyon kaydı yok.</span></li>"}</ul></div><div class="card"><h2>Ticket ve Ürün Takibi</h2><ul><li><b>Açık</b><span>${openTickets.length} ticket açık durumda.</span></li><li><b>Jira</b><span>${tickets.filter(ticket=>ticket.jiraKey).length} ticket Jira ile ilişkilendirilmiş.</span></li><li><b>Müşteri Onayı</b><span>${tickets.filter(ticket=>String(ticket.status||"").toLocaleLowerCase("tr-TR").includes("müşteri")).length} kayıt müşteri aksiyonu bekliyor.</span></li></ul></div><div class="card wide"><h2>Yaklaşan / Açık İşler</h2><table><thead><tr><th>İş</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Açık görev bulunmuyor.</td></tr>"}</tbody></table></div></section></div></body></html>`;
  downloadTextFile(html,`steerco-raporu-${safeFileName(project.name)}-${todayStr()}.html`,"text/html;charset=utf-8");
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
  return <div style={{padding:"22px 26px",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap",marginBottom:18}}>
      <div><h1 style={{margin:0,fontSize:22}}>Mail Merkezi</h1><p style={{margin:"5px 0 0",fontSize:12,color:"#64748B"}}>Firma markası, dinamik şablonlar, önizleme ve manuel gönderim.</p></div>
      <Btn onClick={addTemplate}>+ Yeni Şablon</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(280px,.8fr) minmax(380px,1.25fr)",gap:16,alignItems:"start"}} className="admin-main-grid">
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:12}}>Satın Alan Firma</div>
          <Field label="Firma Adı"><input style={iStyle} value={tenant.name} onChange={e=>updateTenant({name:e.target.value})} placeholder="A Firması"/></Field>
          <Field label="Logo">
            <div style={{display:"flex",gap:9,alignItems:"center"}}>
              <div style={{width:58,height:58,border:"1px solid #E2E8F0",borderRadius:13,display:"grid",placeItems:"center",overflow:"hidden",background:"#F8FAFC",flexShrink:0}}>{tenant.logoUrl?<img src={tenant.logoUrl} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:<b style={{color:tenant.accentColor}}>{tenant.name.slice(0,2).toUpperCase()}</b>}</div>
              <div style={{flex:1}}><input style={iStyle} value={tenant.logoUrl.startsWith("data:")?"":tenant.logoUrl} onChange={e=>updateTenant({logoUrl:e.target.value})} placeholder="https://firma.com/logo.png"/><button onClick={()=>fileInput.current?.click()} style={{border:0,background:"transparent",color:"#4338CA",fontSize:10,fontWeight:800,cursor:"pointer",padding:"6px 0 0"}}>veya dosya yükle</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>uploadLogo(e.target.files?.[0])}/></div>
            </div>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <Field label="Marka Rengi"><input type="color" style={{...iStyle,padding:4,height:39}} value={tenant.accentColor} onChange={e=>updateTenant({accentColor:e.target.value})}/></Field>
            <Field label="Yanıt Adresi"><input type="email" style={iStyle} value={tenant.replyTo} onChange={e=>updateTenant({replyTo:e.target.value})} placeholder="info@firma.com"/></Field>
          </div>
          <div style={{fontSize:10,color:"#64748B",background:"#F8FAFC",borderRadius:9,padding:10}}>Gönderici teknik olarak <b>info@corject.com</b> kalır. Görünen marka firma olur; yanıtlar belirlediğiniz adrese yönlenir.</div>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Şablonlar</div>
          <div style={{display:"grid",gap:7}}>{templates.map(item=><button key={item.id} onClick={()=>selectTemplate(item)} style={{border:`1px solid ${selectedId===item.id?item.accentColor:"#E2E8F0"}`,borderLeft:`5px solid ${item.accentColor}`,borderRadius:10,background:selectedId===item.id?item.accentColor+"0D":"#fff",padding:"10px 11px",textAlign:"left",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:11}}>{item.name}</b><span style={{fontSize:8,color:item.enabled===false?"#E11D48":"#059669",fontWeight:850}}>{item.enabled===false?"PASİF":"AKTİF"}</span></div><div style={{fontSize:9,color:"#94A3B8",marginTop:3}}>{item.category}</div></button>)}</div>
        </Card>
      </div>
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12}}><b style={{fontSize:14}}>Şablon Düzenleyici</b><label style={{fontSize:10,fontWeight:800,color:"#64748B"}}><input type="checkbox" checked={draft?.enabled!==false} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/> Aktif</label></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><Field label="Şablon Adı"><input style={iStyle} value={draft?.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Kategori"><input style={iStyle} value={draft?.category||""} onChange={e=>setDraft({...draft,category:e.target.value})}/></Field></div>
          <Field label="Konu"><input style={iStyle} value={draft?.subject||""} onChange={e=>setDraft({...draft,subject:e.target.value})}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><Field label="Üst Etiket"><input style={iStyle} value={draft?.eyebrow||""} onChange={e=>setDraft({...draft,eyebrow:e.target.value})}/></Field><Field label="Vurgu Rengi"><input type="color" style={{...iStyle,padding:4,height:39}} value={draft?.accentColor||tenant.accentColor} onChange={e=>setDraft({...draft,accentColor:e.target.value})}/></Field></div>
          <Field label="Başlık"><input style={iStyle} value={draft?.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
          <Field label="Giriş"><input style={iStyle} value={draft?.intro||""} onChange={e=>setDraft({...draft,intro:e.target.value})}/></Field>
          <Field label="İçerik"><textarea style={{...iStyle,minHeight:120,resize:"vertical"}} value={draft?.body||""} onChange={e=>setDraft({...draft,body:e.target.value})}/></Field>
          <Field label="Buton Metni"><input style={iStyle} value={draft?.buttonLabel||""} onChange={e=>setDraft({...draft,buttonLabel:e.target.value})}/></Field>
          <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",padding:10,borderRadius:10}}><div style={{fontSize:10,fontWeight:850,color:"#475569",marginBottom:7}}>Dinamik alan ekle</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:7}}><select style={iStyle} value={selectedVariable} onChange={event=>setSelectedVariable(event.target.value)}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select style={iStyle} value={variableTarget} onChange={event=>setVariableTarget(event.target.value)}>{[["subject","Konu"],["eyebrow","Üst etiket"],["title","Başlık"],["intro","Giriş"],["body","İçerik"],["buttonLabel","Buton"]].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><Btn small variant="secondary" onClick={insertVariable}>Ekle</Btn></div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><button key={key} onClick={()=>{setSelectedVariable(key);setDraft({...draft,[variableTarget]:`${draft[variableTarget]||""}${draft[variableTarget]?" ":""}{{${key}}}`});}} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"4px 7px",fontSize:8,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div></div>
          <div style={{display:"flex",gap:8,marginTop:12}}><Btn onClick={saveTemplate}>Şablonu Kaydet</Btn><Btn variant="secondary" onClick={removeTemplate}>Sil</Btn></div>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Canlı Önizleme</div>
          <iframe title="Mail önizleme" srcDoc={preview.html} style={{width:"100%",height:560,border:"1px solid #E2E8F0",borderRadius:12,background:"#F1F5F9"}}/>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Manuel Gönderim</div>
          <Field label="Alıcı"><input type="email" style={iStyle} value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="alici@firma.com"/></Field>
          <Field label="Önizleme ve test verileri"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:7}}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><label key={key} style={{fontSize:9,color:"#64748B"}}>{label}<input style={{...iStyle,marginTop:3}} value={variables[key]||""} onChange={event=>setVariablesText(JSON.stringify({...variables,[key]:event.target.value},null,2))}/></label>)}</div><details style={{marginTop:8}}><summary style={{fontSize:9,color:"#64748B",cursor:"pointer"}}>Gelişmiş JSON görünümü</summary><textarea style={{...iStyle,minHeight:150,marginTop:6,fontFamily:"Consolas,monospace",fontSize:10}} value={variablesText} onChange={e=>setVariablesText(e.target.value)}/></details></Field>
          <Btn onClick={send} disabled={sendStatus.loading}>Gönder</Btn>
          {sendStatus.message&&<div style={{marginTop:9,fontSize:10,color:sendStatus.error?"#E11D48":"#059669"}}>{sendStatus.message}</div>}
        </Card>
      </div>
    </div>
  </div>;
}

export function ReportsPage({ state, people, isAdmin }) {
  const [projectId,setProjectId]=useState(state.projects[0]?.id||"");
  const [group,setGroup]=useState("operations");
  const project=state.projects.find(p=>p.id===projectId);
  const tasks=project?project.milestones.flatMap(m=>m.tasks.map(task=>({task,project,milestone:m}))):[];
  const delayed=tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const taskHours=tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===projectId&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0)
    +((state.projectActions||{})[projectId]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
  const hours=taskHours+fieldHours;
  const machines=project?(project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[]):[];
  const cards=[
    {group:"operations",title:"Gecikme Raporu",desc:"Geciken görevler, gecikme günleri, sorumlu ve bekleme nedeni.",color:"#E11D48",action:()=>downloadDelayReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Efor Raporu",desc:"Görev, saha ziyareti ve proje aksiyonlarından oluşan saat analizi.",color:"#7C3AED",action:()=>downloadEffortReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Proje Aksiyonları",desc:"Tüm proje aksiyonları, tarihleri, sahipleri ve girilen eforlar.",color:"#0F766E",action:()=>downloadProjectActionsReport(state),label:"XLSX İndir"},
    {group:"operations",title:"Saha Ziyaretleri",desc:"Gerçekleşen ziyaretler, ziyaret notları ve proje eforları.",color:"#059669",action:()=>downloadFieldVisitsReport(state,people),label:"XLSX İndir"},
    {group:"technical",title:"Makine Devreye Alma",desc:"Fiziksel/sanal makineler, devre durumu ve devreye alınamama açıklamaları.",color:"#059669",action:()=>downloadMachineReport(state),label:"XLSX İndir"},
    {group:"project",title:"İç Operasyon Raporu",desc:"Grafikler, efor, gecikme, sorumlu, görev ve makine detaylarını içeren yönetim raporu.",color:"#0369A1",action:()=>project&&generateVisualReport(project,people,{fieldHours}),label:"HTML / PDF"},
    {group:"project",title:"Müşteri İlerleme Raporu",desc:"Renkli ilerleme grafikleri, teslim tarihleri ve makine durumunu sade müşteri görünümünde sunar.",color:"#EA6C00",action:()=>project&&generateVisualReport(project,people,{customer:true,fieldHours}),label:"HTML / PDF"},
    {group:"project",title:"Steerco Toplantı Raporu",desc:"Yönetim toplantısı için karar, risk, gecikme, ticket, efor ve sonraki adımları high-level özetler.",color:"#0F766E",action:()=>project&&generateSteercoReport(project,state,people),label:"HTML / PDF"},
    ...(isAdmin?[{group:"management",title:"Genel Durum Raporu",desc:"Tüm projeleri ilerleme, gecikme, makine ve efor göstergeleriyle karşılaştırır.",color:"#4338CA",action:()=>generatePortfolioReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Ticket Durum Raporu",desc:"Ticket yaşı, son aksiyon, sorumlu, proje ve Jira durumlarını tüm portföyde gösterir.",color:"#BE123C",action:()=>generateTicketStatusReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Ekip Kapasite Raporu",desc:"Kişi bazlı aktif iş yükü, gecikme yoğunluğu ve gerçekleşen eforu görselleştirir.",color:"#4F46E5",action:()=>generateTeamCapacityReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Risk Portföyü Raporu",desc:"Açık riskleri proje ve önem seviyesine göre karşılaştırmalı gösterir.",color:"#C2410C",action:()=>generateRiskPortfolioReport(state),label:"HTML / PDF"}]:[]),
  ];
  return <div style={{padding:"clamp(16px, 4vw, 28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:20,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:21,display:"flex",alignItems:"center",gap:8}}><Icon name="reports" size={21}/>Raporlar</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>İç operasyon ve müşteri paylaşımı için güncel proje çıktıları.</p></div><div style={{minWidth:"min(240px,100%)",flex:"0 1 280px"}}><label style={lStyle}>Rapor Projesi</label><select style={iStyle} value={projectId} onChange={e=>setProjectId(e.target.value)}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10,marginBottom:20}}>{[["Geciken Görev",delayed.length,"#E11D48"],["Toplam Efor",`${hours} sa`,"#7C3AED"],["Makine",machines.length,"#0369A1"],["Devrede",machines.filter(m=>m.commissioned).length,"#059669"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:14}}><div style={{fontSize:11,color:"#64748B"}}>{label}</div><div style={{fontSize:24,fontWeight:800,color,marginTop:3}}>{value}</div></div>)}</div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>{[["operations","Operasyon"],["project","Proje ve Müşteri"],["technical","Teknik"],...(isAdmin?[["management","Yönetici"]]:[])].map(([id,label])=><button key={id} onClick={()=>setGroup(id)} style={{border:0,borderRadius:9,padding:"8px 12px",background:group===id?"#4338CA":"#F1F5F9",color:group===id?"#fff":"#64748B",fontSize:11,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>{cards.filter(card=>card.group===group).map(card=><div key={card.title} style={{background:"#fff",borderRadius:14,padding:18,border:"1.5px solid #E2E8F0",borderTop:`4px solid ${card.color}`,boxShadow:"0 2px 6px rgba(0,0,0,.04)"}}><div style={{fontWeight:800,fontSize:14,marginBottom:6}}>{card.title}</div><div style={{fontSize:12,color:"#64748B",lineHeight:1.5,minHeight:54}}>{card.desc}</div><Btn style={{marginTop:12,background:card.color}} disabled={!project&&card.title.includes("Raporu")} onClick={card.action}>{card.label}</Btn></div>)}</div>
  </div>;
}

export function generateTicketStatusReport(state,people){
  const tickets=Object.entries(state.projectTickets||{}).flatMap(([projectId,list])=>{
    const project=state.projects.find(p=>p.id===projectId);
    return (list||[]).map(ticket=>({ticket,project}));
  });
  const open=tickets.filter(({ticket})=>!["Tamamlandı","İptal Edildi"].includes(ticket.status)).length;
  const acted=tickets.filter(({ticket})=>(ticket.updatedAt&&ticket.updatedAt!==ticket.ts)||ticket.jiraStatus).length;
  const rows=tickets.map(({ticket,project})=>{
    const age=Math.max(0,daysDiff(ticket.ts));
    const assignee=people.find(p=>p.id===ticket.assignedTo);
    return `<tr><td><b>${ticketNumber(ticket)}</b><br>${ticket.title}</td><td>${project?.name||"Silinmiş proje"}</td><td>${ticket.status||"Açık"}</td><td>${ticket.priority||"-"}</td><td>${assignee?.name||"Atanmamış"}</td><td>${new Date(ticket.ts).toLocaleDateString("tr-TR")}</td><td class="${age>=7?"danger":""}">${age} gün</td><td>${ticket.updatedAt?new Date(ticket.updatedAt).toLocaleString("tr-TR"):"Aksiyon yok"}</td><td>${ticket.jiraStatus||"-"}</td></tr>`;
  }).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ticket Durum Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1250px;margin:auto}.hero{background:linear-gradient(125deg,#172554,#4338ca,#7c3aed);color:#fff;padding:28px;border-radius:22px}.hero h1{margin:0}.hero p{color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat{color:#fff;border-radius:15px;padding:17px}.stat b{font-size:27px;display:block}.blue{background:linear-gradient(135deg,#2563eb,#4f46e5)}.orange{background:linear-gradient(135deg,#ea580c,#f59e0b)}.green{background:linear-gradient(135deg,#059669,#10b981)}.purple{background:linear-gradient(135deg,#7c3aed,#a855f7)}.card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:20px}.table{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #eef2f7;text-align:left;font-size:12px}th{background:#f8fafc;color:#64748b}.danger{color:#dc2626;font-weight:800}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:1fr 1fr}}@media print{body{padding:0;background:#fff}.print{display:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Ticket Durum Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · Tüm projeler</p></div><div class="stats"><div class="stat blue"><b>${tickets.length}</b>Toplam Ticket</div><div class="stat orange"><b>${open}</b>Açık Ticket</div><div class="stat green"><b>${tickets.length-open}</b>Kapanan Ticket</div><div class="stat purple"><b>${acted}</b>Aksiyon Alınan</div></div><div class="card"><div class="table"><table><thead><tr><th>Ticket</th><th>Proje</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Açılış</th><th>Geçen Süre</th><th>Son Aksiyon</th><th>Jira</th></tr></thead><tbody>${rows||"<tr><td colspan='9'>Ticket yok.</td></tr>"}</tbody></table></div></div></div></body></html>`;
  downloadTextFile(html,`ticket-durum-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

