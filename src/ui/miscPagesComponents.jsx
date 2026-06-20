import { useState } from "react";
import { Avatar, Btn, Field, Icon, Modal, iStyle } from "./primitives.jsx";
import { Badge, DelayBadge, daysDiff, delayLvl } from "./status.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const LOG_META = {
  task_done: { icon: "✓", color: "var(--success)", bg: "color-mix(in srgb, var(--success) 10%, white 90%)", label: "Tamamlandı" },
  task_add: { icon: "+", color: "var(--accent)", bg: "var(--accent-ink)", label: "Görev Eklendi" },
  task_delete: { icon: "×", color: "var(--danger)", bg: "color-mix(in srgb, var(--danger) 9%, white 91%)", label: "Görev Silindi" },
  status_change: { icon: "↻", color: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 10%, white 90%)", label: "Durum Değişti" },
  milestone_add: { icon: "◆", color: "var(--accent)", bg: "var(--surface-soft)", label: "Milestone" },
  project_create: { icon: "▦", color: "#0EA5E9", bg: "var(--accent-ink)", label: "Proje" },
  risk_add: { icon: "!", color: "var(--danger)", bg: "color-mix(in srgb, var(--danger) 9%, white 91%)", label: "Risk" },
  import: { icon: "⬆", color: "var(--muted)", bg: "var(--surface-soft)", label: "Import" },
  person_add: { icon: "👤", color: "var(--accent)", bg: "var(--accent-ink)", label: "Ekip" },
  general: { icon: "·", color: "var(--muted)", bg: "var(--surface-soft)", label: "Genel" },
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
    <div className="unified-page-header todos-page-header" style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:18,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:22,display:"flex",alignItems:"center",gap:8}}><Icon name="ticket" size={21}/>To-Do</h2><p style={{margin:"4px 0 0",fontSize:12,color:"var(--muted)"}}>Yalnızca size özel müşteri aksiyonları.</p></div><span style={{fontSize:12,fontWeight:800,color:"var(--accent)"}}>{active.length} açık aksiyon</span></div>
    <div className="glass-form-panel ui-section-card todo-form-card" style={{background:"#fff",border:"1.5px solid var(--border)",borderRadius:15,padding:17,marginBottom:16,boxShadow:"0 6px 20px #0f172a0a"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:11}}><Field label="Müşteri / Proje"><select style={iStyle} value={form.projectId} onChange={e=>{const p=state.projects.find(x=>x.id===e.target.value);setForm({...form,projectId:e.target.value,customer:p?.name||form.customer});}}><option value="">Proje seçin veya müşteri yazın</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Müşteri"><input style={iStyle} value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} placeholder="Müşteri adı"/></Field><Field label="Termin"><input type="date" style={iStyle} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field></div>
      <Field label="Aksiyon"><input style={iStyle} value={form.action} onChange={e=>setForm({...form,action:e.target.value})} onKeyDown={e=>e.key==="Enter"&&save()} placeholder="Yapılacak aksiyon"/></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId(null);setForm(empty);}}>İptal</Btn>}<Btn onClick={save}>{editingId?"Güncelle":"To-Do Ekle"}</Btn></div>
    </div>
    <div className="todo-columns" style={{display:"grid",gridTemplateColumns:"minmax(0,2fr) minmax(260px,1fr)",gap:15}}><div><div style={{fontSize:11,fontWeight:800,color:"var(--muted)",marginBottom:8,textTransform:"uppercase"}}>Açık Aksiyonlar</div>{active.map(t=>{const p=state.projects.find(x=>x.id===t.projectId);const late=t.dueDate&&daysDiff(t.dueDate)>0;return <div className={`todo-list-card ui-section-card ${late?"is-danger":""}`} key={t.id} style={{background:"#fff",border:`1.5px solid ${late?"var(--danger)":"var(--border)"}`,borderRadius:12,padding:13,marginBottom:8,display:"flex",gap:11,alignItems:"flex-start"}}><input type="checkbox" checked={false} onChange={()=>toggle(t.id)} style={{marginTop:3,accentColor:"var(--success)"}}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:800}}>{t.action||t.text}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5,fontSize:10}}><span className="ui-chip ui-chip-accent" style={{color:p?.color||"var(--accent)",fontWeight:700}}>{t.customer||p?.name||"Genel"}</span>{t.dueDate&&<span className={`ui-chip ${late?"ui-chip-danger":"ui-chip-muted"}`} style={{color:late?"var(--danger)":"var(--muted)",fontWeight:late?800:600}}>Termin: {fmt(t.dueDate)}{late?` · ${daysDiff(t.dueDate)} gün geçti`:""}</span>}</div></div><button className="icon-soft-action" onClick={()=>edit(t)} style={{border:0,background:"transparent",color:"var(--accent)",cursor:"pointer"}}><Icon name="edit" size={15}/></button><button className="icon-soft-action is-danger" onClick={()=>confirm("To-Do silinsin mi?")&&remove(t.id)} style={{border:0,background:"transparent",color:"var(--danger)",cursor:"pointer"}}><Icon name="trash" size={15}/></button></div>})}{!active.length&&<div className="empty-panel ui-section-card" style={{padding:35,textAlign:"center",border:"1.5px dashed var(--muted)",borderRadius:12,color:"var(--muted)"}}>Açık To-Do yok.</div>}</div><div><div style={{fontSize:11,fontWeight:800,color:"var(--muted)",marginBottom:8,textTransform:"uppercase"}}>Tamamlananlar</div>{done.map(t=><button className="todo-done-card" key={t.id} onClick={()=>toggle(t.id)} style={{width:"100%",border:"1px solid var(--border)",background:"var(--surface-soft)",borderRadius:9,padding:10,marginBottom:6,textAlign:"left",fontSize:11,color:"var(--muted)",textDecoration:"line-through",cursor:"pointer"}}>{t.action||t.text}</button>)}{!done.length&&<div className="ui-muted-note" style={{fontSize:11,color:"var(--muted)"}}>Tamamlanan kayıt yok.</div>}</div></div>
  </div>;
}



export function DeadlinePage({warnings,people,onOpenTask,onOpenTodos}) {
  const [filter,setFilter]=useState("all");
  const shown=filter==="all"?warnings:warnings.filter(w=>w.level===filter);
  return <div className="theme-work-page deadlines-theme-page" style={{padding:"clamp(18px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div className="unified-page-header deadlines-page-header" style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}><div><h2 style={{margin:0,fontSize:20,display:"flex",alignItems:"center",gap:8}}><Icon name="clock" size={21}/>Termin Uyarıları</h2><p style={{margin:"4px 0 0",fontSize:12,color:"var(--muted)"}}>{warnings.length} geciken görev</p></div></div>
    <div className="theme-filter-strip unified-filter-row deadlines-filter-row" style={{display:"flex",gap:5,marginBottom:14}}>{[["all","Tümü"],["critical","Kritik"],["normal","Geciken"]].map(([id,label])=><button key={id} className={filter===id?"is-active":""} onClick={()=>setFilter(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontSize:11,fontWeight:700,background:filter===id?"var(--accent)":"var(--accent-ink)",color:filter===id?"#fff":"var(--muted)"}}>{label}</button>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{shown.map(t=>{const person=people.find(p=>p.id===t.assignee);return <button className={`deadline-card ui-section-card ${t.level==="critical"?"is-danger":"is-warning"}`} key={`${t.projectId||"todo"}-${t.id}`} onClick={()=>t.kind==="todo"?onOpenTodos():onOpenTask(t.id)} style={{border:`1.5px solid ${t.level==="critical"?"var(--danger)":"color-mix(in srgb, var(--warning) 24%, var(--border))"}`,borderRadius:12,background:"#fff",padding:13,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"}}><div className="deadline-day-pill" style={{width:42,height:42,borderRadius:11,background:t.level==="critical"?"color-mix(in srgb, var(--danger) 9%, white 91%)":"color-mix(in srgb, var(--warning) 10%, white 90%)",display:"grid",placeItems:"center",color:t.level==="critical"?"var(--danger)":"var(--warning)",fontWeight:850,fontSize:12}}>{t.days}g</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{t.title}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:3}}><span className={`ui-chip ${t.kind==="todo"?"ui-chip-danger":"ui-chip-accent"}`} style={{color:t.kind==="todo"?"var(--danger)":t.projectColor,fontWeight:800}}>{t.kind==="todo"?"TO-DO":t.projectName}</span>{person?` · ${person.name}`:""} · Termin {fmt(t.dueDate)}</div></div>{t.kind==="todo"?<span className="ui-chip ui-chip-danger">TO-DO</span>:<Badge label={t.status}/>}</button>})}{!shown.length&&<div className="empty-panel ui-section-card" style={{padding:40,textAlign:"center",color:"var(--muted)",border:"1.5px dashed var(--muted)",borderRadius:13}}>Bu filtrede termin uyarısı yok.</div>}</div>
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
  const Stat=({label,count,color})=><div style={{ background:color+"15", border:`1.5px solid ${color}30`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color }}>{count}</div><div style={{ fontSize:10, color:"var(--muted)", marginTop:1 }}>{label}</div></div>;
  const Row=({t})=>{const dl=delayLvl(t.dueDate,t.status);return <div style={{ background:"var(--surface-soft)", borderRadius:8, padding:"9px 13px", border:"1.5px solid var(--border)", display:"flex", gap:9, alignItems:"center", marginBottom:5 }}>
    {t.projectColor&&<span style={{ width:7, height:7, borderRadius:"50%", background:t.projectColor, flexShrink:0 }} />}
    <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, textDecoration:t.status==="Tamamland\u0131"?"line-through":"none", color:t.status==="Tamamland\u0131"?"var(--muted)":"var(--text)" }}>{t.title}</div><div style={{ fontSize:10, color:"var(--muted)" }}>{t.projectName||"Genel"}{t.msName?` — ${t.msName}`:""}</div></div>
    <Badge label={t.status} />{dl&&<DelayBadge dateStr={t.dueDate} status={t.status} />}<span style={{ fontSize:11, color:"var(--muted)" }}>{fmt(t.dueDate)}</span>
  </div>;};
  return <Modal title={`${person.name} Detay`} onClose={onClose} wide>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
      <Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={44} color={person.isAdmin?"var(--danger)":"var(--accent)"} />
      <div><div style={{ fontWeight:800, fontSize:15 }}>{person.name}</div><div style={{ color:"var(--muted)", fontSize:12 }}>{person.role}</div>{person.email&&<div style={{color:"var(--accent)",fontSize:11,marginTop:2}}>{person.email}</div>}</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:18 }}>
      <Stat label="Aktif" count={active.filter(t=>t.status==="Devam Ediyor").length} color="var(--accent)" />
      <Stat label="Beklemede" count={active.filter(t=>t.status==="Bekliyor").length} color="var(--muted)" />
      <Stat label="Gecikmiş" count={delayed} color="var(--warning)" />
      <Stat label="Kritik" count={critical} color="var(--danger)" />
    </div>
    {active.length>0&&<div style={{ marginBottom:14 }}><div style={{ fontWeight:700, fontSize:11, color:"var(--muted)", marginBottom:7, textTransform:"uppercase", letterSpacing:1 }}>Aktif ({active.length})</div>{active.map(t=><Row key={t.id} t={t} />)}</div>}
    {done.length>0&&<div>
      <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, padding:"0 0 7px", display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({done.length})</button>
      {showDone&&done.map(t=><Row key={t.id} t={t} />)}
    </div>}
    {all.length===0&&<div style={{ textAlign:"center", color:"var(--muted)", padding:20 }}>Görev atanmamis.</div>}
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

  return <div className="theme-work-page logs-theme-page" style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div className="unified-page-header logs-page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Aktivite Günlüğü</h2><p style={{ margin:"3px 0 0", color:"var(--muted)", fontSize:13 }}>{filtered.length} kayıt</p></div>
      <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ ...iStyle, width:"auto", minWidth:160 }}>
        <option value="all">Tum Projeler</option>
        {projNames.map(n=><option key={n} value={n}>{n}</option>)}
      </select>
    </div>
    {days.length===0&&<div style={{ textAlign:"center", padding:40, color:"var(--muted)" }}>Kayıt yok.</div>}
    {days.map(day=><div key={day} style={{ marginBottom:24 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
        <span>{new Date(day).toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}</span>
        <div style={{ flex:1, height:1, background:"var(--border)" }} />
        <span>{grouped[day].length} işlem</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {grouped[day].map(l=>{
          const meta=LOG_META[l.action]||LOG_META.general;
          return <div className="log-entry-card ui-section-card" key={l.id} style={{ background:"#fff", borderRadius:12, padding:"12px 16px", border:"1.5px solid var(--border)", display:"flex", gap:12, alignItems:"flex-start", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:meta.bg, border:`1.5px solid ${meta.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, color:meta.color, fontWeight:700 }}>{meta.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                <span className="ui-chip" style={{ background:meta.bg, color:meta.color, borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{meta.label}</span>
                {l.project&&<span className="ui-chip ui-chip-accent" style={{ background:"var(--accent-ink)", color:"var(--accent)", borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{l.project}</span>}
                {l.milestone&&<span className="ui-chip ui-chip-muted" style={{ background:"var(--surface-soft)", color:"var(--accent)", borderRadius:8, padding:"2px 8px", fontSize:11 }}>{l.milestone}</span>}
              </div>
              <div style={{ fontSize:13, color:"var(--text)" }}><strong>{l.user}</strong> {l.detail}</div>
            </div>
            <div style={{ fontSize:11, color:"var(--muted)", flexShrink:0, paddingTop:2 }}>{new Date(l.ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</div>
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
  return <div className="theme-work-page notifications-theme-page" style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div className="unified-page-header notifications-page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Bildirimler</h2>
        <p style={{ margin:"3px 0 0", color:"var(--muted)", fontSize:13 }}>{mine.filter(n=>!n.read).length} okunmamış</p>
      </div>
      {mine.length>0&&<button className="inline-text-action" onClick={()=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>!isNotificationForUser(n,currentUser))}))} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:12 }}>Tümünü Temizle</button>}
    </div>
    {mine.length===0&&<div className="empty-panel ui-section-card" style={{ textAlign:"center", padding:"50px", background:"#fff", borderRadius:16, border:"1.5px dashed var(--border)" }}>
      <div style={{ width:42,height:42,margin:"0 auto 10px",borderRadius:14,background:"var(--accent-ink)",color:"var(--accent)",display:"grid",placeItems:"center" }}><Icon name="bell" size={21}/></div>
      <div style={{ color:"var(--muted)" }}>Bildirim yok</div>
    </div>}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {mine.map(n=>{const request=dateChangeRequests.find(item=>item.id===n.requestId);return <div className={`notification-card ui-section-card ${n.read?"is-read":"is-unread"}`} key={n.id} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:`1.5px solid ${n.read?"var(--border)":"var(--accent)"}`, display:"flex", gap:12, alignItems:"flex-start", boxShadow:n.read?"none":"0 2px 8px rgba(74,108,247,0.1)", cursor:n.taskId?"pointer":"default" }} onClick={()=>{markRead(n.id);if(n.taskId)onOpenTask?.(n.taskId);}}>
        <div className="notification-icon" style={{ width:36, height:36, borderRadius:"50%", background:n.read?"var(--accent-ink)":"var(--accent-ink)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}><Icon name="tasks" size={17}/></div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:n.read?400:600, color:"var(--text)" }}>{n.msg}</div>
          {n.projectName&&<div style={{ fontSize:11, color:"var(--accent)", marginTop:3 }}>{n.projectName}</div>}
          {request&&request.status==="pending"&&<div style={{background:"var(--surface-soft)",border:"1px solid var(--border)",borderRadius:10,padding:"8px 10px",marginTop:8,fontSize:11,color:"var(--text)"}}><b>{request.kind==="milestone"?"Milestone":"Görev"} tarih değişikliği</b><div style={{marginTop:4}}>{Object.entries(request.data||{}).map(([key,value])=>`${key}: ${request.oldValues?.[key]||"-"} → ${value||"-"}`).join(" · ")}</div><div style={{display:"flex",gap:7,marginTop:8}}><button onClick={event=>{event.stopPropagation();onResolveDateChange?.(request.id,true);}} style={{border:0,borderRadius:8,background:"color-mix(in srgb, var(--success) 10%, white 90%)",color:"var(--success)",padding:"6px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>Onayla</button><button onClick={event=>{event.stopPropagation();onResolveDateChange?.(request.id,false);}} style={{border:0,borderRadius:8,background:"color-mix(in srgb, var(--danger) 9%, white 91%)",color:"var(--danger)",padding:"6px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>Reddet</button></div></div>}
          {request&&request.status!=="pending"&&<div style={{fontSize:10,fontWeight:800,color:request.status==="approved"?"var(--success)":"var(--danger)",marginTop:6}}>Talep {request.status==="approved"?"onaylandı":"reddedildi"}.</div>}
          <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>{new Date(n.ts).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"})}</div>
        </div>
        {!n.read&&<span style={{ width:8,height:8,borderRadius:"50%",background:"var(--accent)",flexShrink:0,marginTop:4 }} />}
        <button className="icon-soft-action" onClick={e=>{e.stopPropagation();deleteNotif(n.id);}} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:16,padding:0 }}>×</button>
      </div>})}
    </div>
  </div>;
}
// ─── Modals ──────────────────────────────────────────────────────────────────
