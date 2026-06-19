import { useState } from "react";
import { Avatar, Btn, Field, Icon, Modal, iStyle } from "./primitives.jsx";
import { Badge, DelayBadge, daysDiff, delayLvl } from "./status.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const LOG_META = {
  task_done: { icon: "✓", color: "#059669", bg: "#ECFDF5", label: "Tamamlandı" },
  task_add: { icon: "+", color: "#4A6CF7", bg: "#F1F5FF", label: "Görev Eklendi" },
  task_delete: { icon: "×", color: "#E11D48", bg: "#FFF1F2", label: "Görev Silindi" },
  status_change: { icon: "↻", color: "#EA6C00", bg: "#FFF7ED", label: "Durum Değişti" },
  milestone_add: { icon: "◆", color: "#7C3AED", bg: "#F5F3FF", label: "Milestone" },
  project_create: { icon: "▦", color: "#0EA5E9", bg: "#F0F9FF", label: "Proje" },
  risk_add: { icon: "!", color: "#E11D48", bg: "#FFF1F2", label: "Risk" },
  import: { icon: "⬆", color: "#64748B", bg: "#F8FAFC", label: "Import" },
  person_add: { icon: "👤", color: "#4A6CF7", bg: "#F1F5FF", label: "Ekip" },
  general: { icon: "·", color: "#64748B", bg: "#F8FAFC", label: "Genel" },
};
const isNotificationForUser = (notification, user) => {
  if (!notification || !user) return false;
  if (notification.userId && notification.userId === user.id) return true;
  const noticeEmail = String(notification.userEmail || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();
  return Boolean(noticeEmail && userEmail && noticeEmail === userEmail);
};
export function TodoPage({state,setState,currentUser}) {
  const todos=((state.userNotes||{})[currentUser.id]?.todos)||[];
  const empty={projectId:"",customer:"",dueDate:todayStr(),action:""};
  const [form,setForm]=useState(empty);
  const [editingId,setEditingId]=useState(null);
  const saveTodos=next=>setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:next}}}));
  const save=()=>{if(!form.action.trim())return;const item={id:editingId||uid(),done:false,createdAt:now(),...form,action:form.action.trim(),text:form.action.trim()};saveTodos(editingId?todos.map(t=>t.id===editingId?{...t,...item}:t):[...todos,item]);setForm(empty);setEditingId(null);};
  const edit=t=>{setEditingId(t.id);setForm({projectId:t.projectId||"",customer:t.customer||"",dueDate:t.dueDate||"",action:t.action||t.text||""});};
  const toggle=id=>saveTodos(todos.map(t=>t.id===id?{...t,done:!t.done}:t));
  const remove=id=>saveTodos(todos.filter(t=>t.id!==id));
  const active=todos.filter(t=>!t.done).sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const done=todos.filter(t=>t.done);
  return <div className="theme-work-page todos-theme-page" style={{padding:"clamp(20px,4vw,32px)",flex:1,overflow:"auto",maxWidth:1200,width:"100%",margin:"0 auto"}}>
    <div className="unified-page-header todos-page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:18,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:22,display:"flex",alignItems:"center",gap:8}}><Icon name="ticket" size={21}/>To-Do</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Yalnızca size özel müşteri aksiyonları.</p></div><span style={{fontSize:12,fontWeight:800,color:"#4A6CF7"}}>{active.length} açık aksiyon</span></div>
    <div className="glass-form-panel" style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:17,marginBottom:16,boxShadow:"0 6px 20px #0f172a0a"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:11}}><Field label="Müşteri / Proje"><select style={iStyle} value={form.projectId} onChange={e=>{const p=state.projects.find(x=>x.id===e.target.value);setForm({...form,projectId:e.target.value,customer:p?.name||form.customer});}}><option value="">Proje seçin veya müşteri yazın</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Müşteri"><input style={iStyle} value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} placeholder="Müşteri adı"/></Field><Field label="Termin"><input type="date" style={iStyle} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field></div>
      <Field label="Aksiyon"><input style={iStyle} value={form.action} onChange={e=>setForm({...form,action:e.target.value})} onKeyDown={e=>e.key==="Enter"&&save()} placeholder="Yapılacak aksiyon"/></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId(null);setForm(empty);}}>İptal</Btn>}<Btn onClick={save}>{editingId?"Güncelle":"To-Do Ekle"}</Btn></div>
    </div>
    <div className="todo-columns" style={{display:"grid",gridTemplateColumns:"minmax(0,2fr) minmax(260px,1fr)",gap:15}}><div><div style={{fontSize:11,fontWeight:800,color:"#64748B",marginBottom:8,textTransform:"uppercase"}}>Açık Aksiyonlar</div>{active.map(t=>{const p=state.projects.find(x=>x.id===t.projectId);const late=t.dueDate&&daysDiff(t.dueDate)>0;return <div key={t.id} style={{background:"#fff",border:`1.5px solid ${late?"#FCA5A5":"#E2E8F0"}`,borderRadius:12,padding:13,marginBottom:8,display:"flex",gap:11,alignItems:"flex-start"}}><input type="checkbox" checked={false} onChange={()=>toggle(t.id)} style={{marginTop:3,accentColor:"#059669"}}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:800}}>{t.action||t.text}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5,fontSize:10}}><span style={{color:p?.color||"#4A6CF7",fontWeight:700}}>{t.customer||p?.name||"Genel"}</span>{t.dueDate&&<span style={{color:late?"#E11D48":"#64748B",fontWeight:late?800:600}}>Termin: {fmt(t.dueDate)}{late?` · ${daysDiff(t.dueDate)} gün geçti`:""}</span>}</div></div><button onClick={()=>edit(t)} style={{border:0,background:"transparent",color:"#4A6CF7",cursor:"pointer"}}><Icon name="edit" size={15}/></button><button onClick={()=>confirm("To-Do silinsin mi?")&&remove(t.id)} style={{border:0,background:"transparent",color:"#E11D48",cursor:"pointer"}}><Icon name="trash" size={15}/></button></div>})}{!active.length&&<div style={{padding:35,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Açık To-Do yok.</div>}</div><div><div style={{fontSize:11,fontWeight:800,color:"#64748B",marginBottom:8,textTransform:"uppercase"}}>Tamamlananlar</div>{done.map(t=><button key={t.id} onClick={()=>toggle(t.id)} style={{width:"100%",border:"1px solid #E2E8F0",background:"#F8FAFC",borderRadius:9,padding:10,marginBottom:6,textAlign:"left",fontSize:11,color:"#94A3B8",textDecoration:"line-through",cursor:"pointer"}}>{t.action||t.text}</button>)}{!done.length&&<div style={{fontSize:11,color:"#CBD5E1"}}>Tamamlanan kayıt yok.</div>}</div></div>
  </div>;
}



export function DeadlinePage({warnings,people,onOpenTask,onOpenTodos}) {
  const [filter,setFilter]=useState("all");
  const shown=filter==="all"?warnings:warnings.filter(w=>w.level===filter);
  return <div className="theme-work-page deadlines-theme-page" style={{padding:"clamp(18px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div className="unified-page-header deadlines-page-header" style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:18}}><div><h2 style={{margin:0,fontSize:20,display:"flex",alignItems:"center",gap:8}}><Icon name="clock" size={21}/>Termin Uyarıları</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>{warnings.length} geciken görev</p></div><div className="unified-filter-row" style={{display:"flex",gap:5}}>{[["all","Tümü"],["critical","Kritik"],["normal","Geciken"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontSize:11,fontWeight:700,background:filter===id?"#4A6CF7":"#F1F5FF",color:filter===id?"#fff":"#64748B"}}>{label}</button>)}</div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{shown.map(t=>{const person=people.find(p=>p.id===t.assignee);return <button key={`${t.projectId||"todo"}-${t.id}`} onClick={()=>t.kind==="todo"?onOpenTodos():onOpenTask(t.id)} style={{border:`1.5px solid ${t.level==="critical"?"#FCA5A5":"#FED7AA"}`,borderRadius:12,background:"#fff",padding:13,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"}}><div style={{width:42,height:42,borderRadius:11,background:t.level==="critical"?"#FFF1F2":"#FFF7ED",display:"grid",placeItems:"center",color:t.level==="critical"?"#E11D48":"#EA6C00",fontWeight:850,fontSize:12}}>{t.days}g</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{t.title}</div><div style={{fontSize:11,color:"#64748B",marginTop:3}}><span style={{color:t.kind==="todo"?"#DB2777":t.projectColor,fontWeight:800}}>{t.kind==="todo"?"TO-DO":t.projectName}</span>{person?` · ${person.name}`:""} · Termin {fmt(t.dueDate)}</div></div>{t.kind==="todo"?<span style={{background:"#FDF2F8",color:"#DB2777",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:800}}>TO-DO</span>:<Badge label={t.status}/>}</button>})}{!shown.length&&<div style={{padding:40,textAlign:"center",color:"#94A3B8",border:"1.5px dashed #CBD5E1",borderRadius:13}}>Bu filtrede termin uyarısı yok.</div>}</div>
  </div>;
}

// ─── Login ──────────────────────────────────────────────────────────────────


export function PersonDetailModal({ person, projects, personalTasks, onClose }) {
  const [showDone,setShowDone]=useState(false);
  const projTasks=projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===person.id).map(t=>({...t,projectName:proj.name,projectColor:proj.color,msName:ms.name}))));
  const pTasks=(personalTasks||[]).filter(t=>t.assignee===person.id);
  const all=[...projTasks,...pTasks];
  const active=all.filter(t=>t.status!=="Tamamland\u0131");
  const done=all.filter(t=>t.status==="Tamamland\u0131");
  const delayed=all.filter(t=>delayLvl(t.dueDate,t.status)==="normal").length;
  const critical=all.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length;
  const Stat=({label,count,color})=><div style={{ background:color+"15", border:`1.5px solid ${color}30`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color }}>{count}</div><div style={{ fontSize:10, color:"#64748B", marginTop:1 }}>{label}</div></div>;
  const Row=({t})=>{const dl=delayLvl(t.dueDate,t.status);return <div style={{ background:"#F8FAFC", borderRadius:8, padding:"9px 13px", border:"1.5px solid #E2E8F0", display:"flex", gap:9, alignItems:"center", marginBottom:5 }}>
    {t.projectColor&&<span style={{ width:7, height:7, borderRadius:"50%", background:t.projectColor, flexShrink:0 }} />}
    <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, textDecoration:t.status==="Tamamland\u0131"?"line-through":"none", color:t.status==="Tamamland\u0131"?"#94A3B8":"#1E293B" }}>{t.title}</div><div style={{ fontSize:10, color:"#94A3B8" }}>{t.projectName||"Genel"}{t.msName?` — ${t.msName}`:""}</div></div>
    <Badge label={t.status} />{dl&&<DelayBadge dateStr={t.dueDate} status={t.status} />}<span style={{ fontSize:11, color:"#94A3B8" }}>{fmt(t.dueDate)}</span>
  </div>;};
  return <Modal title={`${person.name} Detay`} onClose={onClose} wide>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
      <Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={44} color={person.isAdmin?"#E11D48":"#4A6CF7"} />
      <div><div style={{ fontWeight:800, fontSize:15 }}>{person.name}</div><div style={{ color:"#64748B", fontSize:12 }}>{person.role}</div>{person.email&&<div style={{color:"#4A6CF7",fontSize:11,marginTop:2}}>{person.email}</div>}</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:18 }}>
      <Stat label="Aktif" count={active.filter(t=>t.status==="Devam Ediyor").length} color="#4A6CF7" />
      <Stat label="Beklemede" count={active.filter(t=>t.status==="Bekliyor").length} color="#94A3B8" />
      <Stat label="Gecikmiş" count={delayed} color="#EA6C00" />
      <Stat label="Kritik" count={critical} color="#E11D48" />
    </div>
    {active.length>0&&<div style={{ marginBottom:14 }}><div style={{ fontWeight:700, fontSize:11, color:"#64748B", marginBottom:7, textTransform:"uppercase", letterSpacing:1 }}>Aktif ({active.length})</div>{active.map(t=><Row key={t.id} t={t} />)}</div>}
    {done.length>0&&<div>
      <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, padding:"0 0 7px", display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({done.length})</button>
      {showDone&&done.map(t=><Row key={t.id} t={t} />)}
    </div>}
    {all.length===0&&<div style={{ textAlign:"center", color:"#94A3B8", padding:20 }}>Görev atanmamis.</div>}
  </Modal>;
}

// ─── My Tasks + Notes ────────────────────────────────────────────────────────


export function LogPage({ logs, projects }) {
  const [filter,setFilter]=useState("all");
  const projNames=[...new Set(logs.map(l=>l.project).filter(Boolean))];
  const filtered=filter==="all"?logs:logs.filter(l=>l.project===filter);
  const grouped={};
  filtered.forEach(l=>{
    const day=l.ts.slice(0,10);
    if(!grouped[day])grouped[day]=[];
    grouped[day].push(l);
  });
  const days=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  return <div style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Aktivite Günlüğü</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{filtered.length} kayıt</p></div>
      <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ ...iStyle, width:"auto", minWidth:160 }}>
        <option value="all">Tum Projeler</option>
        {projNames.map(n=><option key={n} value={n}>{n}</option>)}
      </select>
    </div>
    {days.length===0&&<div style={{ textAlign:"center", padding:40, color:"#94A3B8" }}>Kayıt yok.</div>}
    {days.map(day=><div key={day} style={{ marginBottom:24 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
        <span>{new Date(day).toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}</span>
        <div style={{ flex:1, height:1, background:"#E2E8F0" }} />
        <span>{grouped[day].length} işlem</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {grouped[day].map(l=>{
          const meta=LOG_META[l.action]||LOG_META.general;
          return <div key={l.id} style={{ background:"#fff", borderRadius:12, padding:"12px 16px", border:"1.5px solid #E2E8F0", display:"flex", gap:12, alignItems:"flex-start", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:meta.bg, border:`1.5px solid ${meta.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, color:meta.color, fontWeight:700 }}>{meta.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                <span style={{ background:meta.bg, color:meta.color, borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{meta.label}</span>
                {l.project&&<span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{l.project}</span>}
                {l.milestone&&<span style={{ background:"#F5F3FF", color:"#7C3AED", borderRadius:8, padding:"2px 8px", fontSize:11 }}>{l.milestone}</span>}
              </div>
              <div style={{ fontSize:13, color:"#1E293B" }}><strong>{l.user}</strong> {l.detail}</div>
            </div>
            <div style={{ fontSize:11, color:"#94A3B8", flexShrink:0, paddingTop:2 }}>{new Date(l.ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>;
        })}
      </div>
    </div>)}
  </div>;
}

// ─── Milestone Task Panel ────────────────────────────────────────────────────


export function NotificationsPage({ notifications, currentUser, setState, onOpenTask, dateChangeRequests = [], onResolveDateChange }) {
  const mine=(notifications||[]).filter(n=>isNotificationForUser(n,currentUser));
  const markRead=(id)=>setState(s=>({...s,notifications:(s.notifications||[]).map(n=>n.id===id?{...n,read:true}:n)}));
  const deleteNotif=(id)=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>n.id!==id)}));
  return <div style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Bildirimler</h2>
        <p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{mine.filter(n=>!n.read).length} okunmamış</p>
      </div>
      {mine.length>0&&<button onClick={()=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>!isNotificationForUser(n,currentUser))}))} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", fontSize:12 }}>Tümünü Temizle</button>}
    </div>
    {mine.length===0&&<div style={{ textAlign:"center", padding:"50px", background:"#fff", borderRadius:16, border:"1.5px dashed #E2E8F0" }}>
      <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
      <div style={{ color:"#94A3B8" }}>Bildirim yok</div>
    </div>}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {mine.map(n=>{const request=dateChangeRequests.find(item=>item.id===n.requestId);return <div key={n.id} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:`1.5px solid ${n.read?"#E2E8F0":"#4A6CF7"}`, display:"flex", gap:12, alignItems:"flex-start", boxShadow:n.read?"none":"0 2px 8px rgba(74,108,247,0.1)", cursor:n.taskId?"pointer":"default" }} onClick={()=>{markRead(n.id);if(n.taskId)onOpenTask?.(n.taskId);}}>
        <div style={{ width:36, height:36, borderRadius:"50%", background:n.read?"#F1F5FF":"#EEF2FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📋</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:n.read?400:600, color:"#1E293B" }}>{n.msg}</div>
          {n.projectName&&<div style={{ fontSize:11, color:"#4A6CF7", marginTop:3 }}>{n.projectName}</div>}
          {request&&request.status==="pending"&&<div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"8px 10px",marginTop:8,fontSize:11,color:"#334155"}}><b>{request.kind==="milestone"?"Milestone":"Görev"} tarih değişikliği</b><div style={{marginTop:4}}>{Object.entries(request.data||{}).map(([key,value])=>`${key}: ${request.oldValues?.[key]||"-"} → ${value||"-"}`).join(" · ")}</div><div style={{display:"flex",gap:7,marginTop:8}}><button onClick={event=>{event.stopPropagation();onResolveDateChange?.(request.id,true);}} style={{border:0,borderRadius:8,background:"#ECFDF5",color:"#047857",padding:"6px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>Onayla</button><button onClick={event=>{event.stopPropagation();onResolveDateChange?.(request.id,false);}} style={{border:0,borderRadius:8,background:"#FFF1F2",color:"#BE123C",padding:"6px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>Reddet</button></div></div>}
          {request&&request.status!=="pending"&&<div style={{fontSize:10,fontWeight:800,color:request.status==="approved"?"#047857":"#BE123C",marginTop:6}}>Talep {request.status==="approved"?"onaylandı":"reddedildi"}.</div>}
          <div style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>{new Date(n.ts).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"})}</div>
        </div>
        {!n.read&&<span style={{ width:8,height:8,borderRadius:"50%",background:"#4A6CF7",flexShrink:0,marginTop:4 }} />}
        <button onClick={e=>{e.stopPropagation();deleteNotif(n.id);}} style={{ background:"none",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:16,padding:0 }}>×</button>
      </div>})}
    </div>
  </div>;
}
// ─── Modals ──────────────────────────────────────────────────────────────────
