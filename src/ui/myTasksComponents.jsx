import { useEffect, useState } from "react";
import { assignTasksWithNotification } from "../email";
import { Btn, Icon } from "./primitives.jsx";
import { daysDiff, delayLvl } from "./status.jsx";
import {
  PersonalTaskModal as SharedPersonalTaskModal,
  TaskCard as SharedTaskCard,
  TaskDetailModal as SharedTaskDetailModal,
  TimeLogModal as SharedTimeLogModal,
} from "./taskComponents.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentTimeStr = () => new Date().toTimeString().slice(0, 5);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const fmtFull = (d) => d ? new Date(d).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" }) : "-";
const WAIT = ["PM","M\u00fc\u015fteri","ERP","Tedarik\u00e7i","Teknik","\u00dcr\u00fcn-Teknoloji","Y\u00f6netim","Di\u011fer"];

function CompactTaskCard({task,people=[],projectName="",projectColor="#4A6CF7",formatDate=fmt,onOpen,onStatusChange,onCheck}) {
  const assignee=people.find(person=>person.id===task.assignee);
  const delayed=delayLvl(task.dueDate,task.status);
  const done=task.status==="Tamamlandı";
  const role=task.assignmentRole||task.responsibilityGroup||task.sourceLabel||"Görev";
  return <div className="compact-list-card task-mobile-card" onClick={onOpen} style={{background:"var(--surface)",border:`1px solid ${delayed?"var(--warning)":"var(--glass-border)"}`,borderLeft:`4px solid ${delayed?"var(--warning)":projectColor||"var(--accent)"}`,borderRadius:16,padding:"12px 13px",boxShadow:"var(--shadow-soft)",cursor:onOpen?"pointer":"default",opacity:done?0.72:1,overflow:"hidden"}}>
    <div style={{display:"flex",alignItems:"flex-start",gap:10,minWidth:0}}>
      <button type="button" onClick={event=>{event.stopPropagation();onCheck?.(!done);}} style={{width:24,height:24,borderRadius:9,border:`1.5px solid ${done?"#10B981":"#CBD5E1"}`,background:done?"#ECFDF5":"#F8FAFC",color:done?"#059669":"#94A3B8",display:"grid",placeItems:"center",fontWeight:900,flexShrink:0,cursor:"pointer"}}>{done?"✓":" "}</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
          <b style={{fontSize:13,lineHeight:1.32,color:done?"#94A3B8":"#172033",textDecoration:done?"line-through":"none",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",overflowWrap:"anywhere"}}>{task.title}</b>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
          {projectName&&<span className="task-mobile-chip-soft" style={{maxWidth:"100%",color:"var(--accent)",background:"var(--accent-ink)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{projectName}</span>}
          <span className="task-mobile-chip-soft" style={{color:delayed?"var(--warning)":"var(--muted)"}}>{task.dueDate?`${formatDate(task.dueDate)}${task.dueTime?` ${task.dueTime}`:""}`:"Terminsiz"}</span>
          <span className="task-mobile-chip-soft" style={{color:"var(--success)"}}>{role}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7,marginTop:9,minWidth:0}}>
          {assignee&&<span style={{fontSize:10,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{assignee.name}</span>}
          {delayed&&<span style={{fontSize:10,color:"#E11D48",fontWeight:900,flexShrink:0}}>{daysDiff(task.dueDate)} gün gecikti</span>}
        </div>
      </div>
    </div>
    {onStatusChange&&<select onClick={event=>event.stopPropagation()} value={task.status||"Bekliyor"} onChange={event=>onStatusChange(event.target.value)} style={{width:"100%",marginTop:11,fontSize:11,borderRadius:10,background:"#F8FAFC",padding:"8px 10px",border:"1px solid #CBD5E1",outline:"none",fontFamily:"inherit",color:"#334155"}}>
      {["Bekliyor","Devam Ediyor","Engellendi","Tamamlandı"].map(status=><option key={status}>{status}</option>)}
      {!["Bekliyor","Devam Ediyor","Engellendi","Tamamlandı"].includes(task.status)&&task.status&&<option>{task.status}</option>}
    </select>}
  </div>;
}

export function MyTasksPage({ currentUser, state, setState, addLog, isAdmin, initialTaskId="", onTaskOpened }) {
  const [showDone,setShowDone]=useState(false);
  const [section,setSection]=useState("all");
  const [onlyOverdue,setOnlyOverdue]=useState(false);
  const [modal,setModal]=useState(null);
  const [assignmentNotice,setAssignmentNotice]=useState("");
  const [noteText,setNoteText]=useState((state.userNotes||{})[currentUser.id]?.notes||"");
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<760);
  const todos=((state.userNotes||{})[currentUser.id]?.todos)||[];

  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<760);
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[]);

  const updateNotes=(v)=>{ setNoteText(v); setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],notes:v}}})); };
  const toggleTodo=(id)=>setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:todos.map(t=>t.id===id?{...t,done:!t.done}:t)}}}));

  const pt=state.personalTasks||[];
  const myP=pt.filter(t=>t.assignee===currentUser.id).map(t=>({...t,projectName:state.projects.find(project=>project.id===t.projectId)?.name||"Genel Görev",projectColor:state.projects.find(project=>project.id===t.projectId)?.color}));
  const myProjT=state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===currentUser.id).map(t=>({...t,projectName:proj.name,projectColor:proj.color,msName:ms.name,projId:proj.id,msId:ms.id}))));
  const allMy=[...myP.map(t=>({...t,source:"personal"})),...myProjT.map(t=>({...t,source:"project"}))];
  const active=allMy.filter(t=>t.status!=="Tamamland\u0131");
  const completed=allMy.filter(t=>t.status==="Tamamland\u0131");
  const overdue=active.filter(t=>delayLvl(t.dueDate,t.status));
  const sectionAll=section==="all"?allMy:section==="project"?myProjT.map(t=>({...t,source:"project"})):myP.map(t=>({...t,source:"personal"}));
  const sectionBaseActive=sectionAll.filter(t=>t.status!=="Tamamland\u0131");
  const sectionActive=onlyOverdue?sectionBaseActive.filter(t=>delayLvl(t.dueDate,t.status)):sectionBaseActive;
  const sectionCompleted=sectionAll.filter(t=>t.status==="Tamamland\u0131");
  const linkedTaskId=initialTaskId||new URLSearchParams(window.location.search).get("task");

  const updatePersonal=(id,data)=>setState(s=>{
    const old=(s.personalTasks||[]).find(t=>t.id===id);
    const notices=[];
    const patch={...data};
    if(data.status&&old?.status!==data.status){
      if(old?.assignee===currentUser.id&&!old.firstSeenAt&&!patch.firstSeenAt)patch.firstSeenAt=now();
      patch.statusUpdatedAt=now();
      patch.statusUpdatedBy=currentUser.id;
      addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} \u2192 ${data.status}`);
      if(data.status==="Tamamland\u0131"){
        [old.assignee,old.createdBy].filter(Boolean).filter((userId,index,array)=>array.indexOf(userId)===index&&userId!==currentUser.id).forEach(userId=>notices.push({id:uid(),ts:now(),userId,msg:`"${old.title}" g\u00f6revi tamamland\u0131.`,projectName:"Y\u00f6netici Atamas\u0131",taskId:old.id,type:"task_done",read:false}));
      }
    }
    if(data.comments&&data.comments.length>(old?.comments||[]).length&&old?.assignee&&old.assignee!==currentUser.id){
      notices.push({id:uid(),ts:now(),userId:old.assignee,msg:`"${old.title}" g\u00f6revine yeni not eklendi.`,projectName:"Y\u00f6netici Atamas\u0131",taskId:old.id,type:"task_comment",read:false});
    }
    return {...s,personalTasks:(s.personalTasks||[]).map(t=>t.id===id?{...t,...patch}:t),notifications:[...notices,...(s.notifications||[])]};
  });
  const updateProjTask=(pId,mId,tId,data)=>setState(s=>{const old=s.projects.find(p=>p.id===pId)?.milestones.find(m=>m.id===mId)?.tasks.find(t=>t.id===tId);const upd={...s,projects:s.projects.map(p=>p.id!==pId?p:{...p,milestones:p.milestones.map(m=>m.id!==mId?m:{...m,tasks:m.tasks.map(t=>t.id!==tId?t:{...t,...data})})})};if(data.status&&old?.status!==data.status)addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} → ${data.status}`);return upd;});
  const openTaskDetail=t=>{
    if(t.source==="personal"&&t.assignee===currentUser.id&&!t.firstSeenAt)updatePersonal(t.id,{firstSeenAt:now()});
    setModal({type:"taskDetail",data:t});
  };
  useEffect(()=>{
    if(!linkedTaskId)return;
    const personal=(state.personalTasks||[]).find(t=>t.id===linkedTaskId);
    if(personal){openTaskDetail({...personal,source:"personal"});onTaskOpened?.();return;}
    for(const project of state.projects){
      for(const milestone of project.milestones){
        const task=milestone.tasks.find(t=>t.id===linkedTaskId);
        if(task){openTaskDetail({...task,source:"project",projId:project.id,msId:milestone.id});onTaskOpened?.();return;}
      }
    }
  },[linkedTaskId,state.personalTasks,state.projects,onTaskOpened]);
  const addPersonal=async(data)=>{
    setAssignmentNotice("");
    if(isAdmin){
      const {assigneeIds=[],supportAssigneeIds=[],recurrence,...task}=data;
      const groupId=uid();
      const primaryResult=assigneeIds.length?await assignTasksWithNotification({task:{...task,assignmentRole:"Ana Sorumlu"},assigneeIds,recurrence,assignerId:currentUser.id,groupId}):{tasks:[],notifications:[]};
      const supportOnly=supportAssigneeIds.filter(id=>!assigneeIds.includes(id));
      const supportResult=supportOnly.length?await assignTasksWithNotification({task:{...task,assignmentRole:"Destek Sorumlusu"},assigneeIds:supportOnly,recurrence:null,assignerId:currentUser.id,groupId}):{tasks:[],notifications:[]};
      const result={tasks:[...primaryResult.tasks,...supportResult.tasks],notifications:[...primaryResult.notifications,...supportResult.notifications],recurringTemplate:primaryResult.recurringTemplate};
      setState(s=>{const localNotices=result.tasks.map(task=>({id:uid(),ts:now(),userId:task.assignee,msg:`"${task.title}" görevi size atandı.`,projectName:"Yönetici Ataması",taskId:task.id,type:"task_assignment",read:false}));return {...s,personalTasks:[...(s.personalTasks||[]),...result.tasks.filter(t=>!(s.personalTasks||[]).some(x=>x.id===t.id))],recurringTasks:result.recurringTemplate?[...(s.recurringTasks||[]).filter(x=>x.id!==result.recurringTemplate.id),result.recurringTemplate]:(s.recurringTasks||[]),notifications:[...localNotices,...(s.notifications||[])]};});
      const whatsapp=result.notifications.filter(n=>n.sent&&n.channel==="whatsapp").length;
      const email=result.notifications.filter(n=>n.sent&&n.channel==="email").length;
      const failed=result.notifications.filter(n=>!n.sent).length;
      setAssignmentNotice(`${result.tasks.length} görev oluşturuldu · WhatsApp: ${whatsapp} · E-posta: ${email}${failed?` · Ulaşmayan: ${failed}`:""}`);
      addLog(currentUser.name,"task_add",`${task.title} (${result.tasks.length} kişi)`);
    return result;
      return;
    }
    const t={id:uid(),...data,assignee:currentUser.id,createdBy:currentUser.id,createdByName:currentUser.name,createdAt:new Date().toISOString(),comments:[]};
    setState(s=>({...s,personalTasks:[...(s.personalTasks||[]),t]}));
    addLog(currentUser.name,"task_add",t.title);
  };
  const deletePersonal=(id)=>{const t=(state.personalTasks||[]).find(x=>x.id===id);setState(s=>({...s,personalTasks:(s.personalTasks||[]).filter(x=>x.id!==id)}));addLog(currentUser.name,"task_delete",t?.title||"");};

  return <div style={{ padding:"0 0 24px", flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
    <div style={{ padding:"20px clamp(14px, 4vw, 28px) 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="tasks" size={20}/>Görevlerim</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{active.length} aktif · {completed.length} tamamlandı</p></div>
        <Btn onClick={()=>setModal({type:"addPersonal"})}>+ Görev Ekle</Btn>
      </div>
      {assignmentNotice&&<div style={{margin:"10px 0",padding:"10px 13px",borderRadius:9,background:"#ECFDF5",color:"#047857",fontSize:12,fontWeight:700}}>{assignmentNotice}</div>}
      {overdue.length>0&&<button onClick={()=>setOnlyOverdue(value=>!value)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,justifyContent:"space-between",background:onlyOverdue?"#FFF1F2":"#FFFBEB",border:`1.5px solid ${onlyOverdue?"#FCA5A5":"#FDE68A"}`,borderRadius:12,padding:"8px 11px",margin:"10px 0 4px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
        <span style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}><span style={{width:24,height:24,borderRadius:9,background:onlyOverdue?"#E11D48":"#F59E0B",color:"#fff",display:"grid",placeItems:"center",fontSize:12,fontWeight:950,flexShrink:0}}>!</span><span style={{minWidth:0}}><b style={{display:"block",fontSize:12,color:onlyOverdue?"#BE123C":"#92400E"}}>{overdue.length} geciken görev</b><span style={{display:"block",fontSize:10,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{overdue[0]?.title}{overdue.length>1?` +${overdue.length-1} diğer`:""}</span></span></span>
        <span style={{fontSize:10,fontWeight:850,color:onlyOverdue?"#BE123C":"#92400E",background:"#fff",borderRadius:999,padding:"4px 8px",flexShrink:0}}>{onlyOverdue?"Tümünü göster":"Filtrele"}</span>
      </button>}
      <div style={{display:"flex",gap:6,overflowX:"auto",margin:"14px 0 4px"}}>
        {[["all","tasks","Tümü"],["assigned","tasks","Yöneticinin Atadıkları"],["project","projects","Projeden Gelenler"],["todos","ticket","Kendi To-Do'larım"],["notes","notes","Notlarım"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:"none",borderRadius:9,padding:"8px 13px",background:section===id?"#4A6CF7":"#F1F5FF",color:section===id?"#fff":"#64748B",fontWeight:700,fontSize:12,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",cursor:"pointer"}}><Icon name={icon} size={14}/>{label}</button>)}
      </div>
    </div>

    <div style={{ flex:1, overflow:"auto" }}>
      {/* Tasks column */}
      {(section==="all"||section==="assigned"||section==="project")&&<div style={{ padding:"12px clamp(14px, 4vw, 28px)",maxWidth:1100,width:"100%" }}>
        {sectionActive.length>0&&<div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{section==="all"?"Tüm Görevler":section==="project"?"Proje Görevleri":"Atanan Görevler"} ({sectionActive.length})</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {sectionActive.map(t=>isMobile?<CompactTaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} projectName={t.projectName||"Genel Görev"} formatDate={fmt} onOpen={()=>openTaskDetail(t)} onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamlandı":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamlandı":"Bekliyor"}); }} onStatusChange={(status)=>{ if(t.source==="personal")updatePersonal(t.id,{status}); else updateProjTask(t.projId,t.msId,t.id,{status}); }}/>:<SharedTaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel Görev"} canEdit formatDate={fmt} formatFullDate={fmtFull}
               onOpen={()=>openTaskDetail(t)}
               onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
               onStatusChange={(status)=>{ if(t.source==="personal")updatePersonal(t.id,{status}); else updateProjTask(t.projId,t.msId,t.id,{status}); }}
               onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
              onTime={()=>setModal({type:"time",data:t})}
            />)}
          </div>
        </div>}
        {sectionCompleted.length>0&&<div>
          <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8, padding:0, display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({sectionCompleted.length})</button>
          {showDone&&<div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {sectionCompleted.map(t=>isMobile?<CompactTaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} projectName={t.projectName||"Genel"} formatDate={fmt} onOpen={()=>openTaskDetail(t)} onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamlandı":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamlandı":"Bekliyor"}); }} onStatusChange={(status)=>{ if(t.source==="personal")updatePersonal(t.id,{status}); else updateProjTask(t.projId,t.msId,t.id,{status}); }}/>:<SharedTaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel"} canEdit formatDate={fmt} formatFullDate={fmtFull}
               onOpen={()=>openTaskDetail(t)}
               onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
               onStatusChange={(status)=>{ if(t.source==="personal")updatePersonal(t.id,{status}); else updateProjTask(t.projId,t.msId,t.id,{status}); }}
               onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
              onTime={()=>setModal({type:"time",data:t})}
            />)}
          </div>}
        </div>}
        {section==="assigned"&&isAdmin&&<div style={{ marginTop:24, borderTop:"1.5px solid #E2E8F0", paddingTop:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Tüm Genel Görevler (Yönetici)</div>
          {(state.personalTasks||[]).length===0&&<div style={{ color:"#94A3B8", fontSize:12 }}>Genel görev yok.</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {(state.personalTasks||[]).map(t=>isMobile?<CompactTaskCard key={t.id} task={{...t,source:"personal"}} people={state.people} projectColor={state.projects.find(project=>project.id===t.projectId)?.color||"#4A6CF7"} projectName={state.projects.find(project=>project.id===t.projectId)?.name||"Genel Görev"} formatDate={fmt} onOpen={()=>openTaskDetail({...t,source:"personal"})} onCheck={(c)=>updatePersonal(t.id,{status:c?"Tamamlandı":"Bekliyor"})} onStatusChange={(status)=>updatePersonal(t.id,{status})}/>:<SharedTaskCard key={t.id} task={t} people={state.people} projectColor={null} showProject canEdit formatDate={fmt} formatFullDate={fmtFull}
               onOpen={()=>openTaskDetail({...t,source:"personal"})}
               onCheck={(c)=>updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"})}
               onStatusChange={(status)=>updatePersonal(t.id,{status})}
               onEdit={()=>setModal({type:"editPersonal",data:t})}
              onDelete={()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}}
              onTime={()=>setModal({type:"time",data:{...t,source:"personal"}})}
            />)}
          </div>
        </div>}
      </div>}

      {/* Notes & Todo sidebar */}
      {section==="notes"&&<div style={{padding:"16px clamp(14px, 4vw, 28px)"}}><div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:16}}><div style={{fontWeight:800,fontSize:14,marginBottom:9}}>Notlarım</div><textarea value={noteText} onChange={e=>updateNotes(e.target.value)} placeholder="Serbest notlar, hatırlatmalar..." style={{width:"100%",minHeight:260,padding:12,borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.6}}/></div></div>}
      {section==="todos"&&<div style={{padding:"16px clamp(14px, 4vw, 28px)",maxWidth:1000}}><div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:16}}><div style={{fontWeight:800,fontSize:14,marginBottom:12}}>Kendi To-Do'larım</div>{todos.filter(t=>!t.done).map(t=>{const p=state.projects.find(x=>x.id===t.projectId);const late=t.dueDate&&daysDiff(t.dueDate)>0;return <div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:"1px solid #F1F5F9"}}><input type="checkbox" checked={false} onChange={()=>toggleTodo(t.id)}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{t.action||t.text}</div><div style={{fontSize:10,color:late?"#E11D48":"#94A3B8",marginTop:2}}>{t.customer||p?.name||"Genel"}{t.dueDate?` · ${fmt(t.dueDate)}`:""}</div></div></div>})}{!todos.filter(t=>!t.done).length&&<div style={{fontSize:12,color:"#94A3B8"}}>Açık To-Do yok.</div>}</div></div>}
    </div>

    {modal?.type==="addPersonal"&&<SharedPersonalTaskModal title="Genel Görev Ekle" people={state.people} projects={state.projects} isAdmin={isAdmin} currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={addPersonal} />}
    {modal?.type==="editPersonal"&&<SharedPersonalTaskModal title="Görevi Düzenle" initial={modal.data} people={state.people} projects={state.projects} isAdmin={isAdmin} currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={(d)=>{updatePersonal(modal.data.id,d);setModal(null);}} />}
    {modal?.type==="time"&&<SharedTimeLogModal task={modal.data} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onSave={(entries)=>{const t=modal.data;if(t.source==="personal")updatePersonal(t.id,{timeEntries:entries});else updateProjTask(t.projId,t.msId,t.id,{timeEntries:entries});}} />}
    {modal?.type==="taskDetail"&&<SharedTaskDetailModal task={modal.data.source==="personal"?(state.personalTasks||[]).find(t=>t.id===modal.data.id)||modal.data:state.projects.find(p=>p.id===modal.data.projId)?.milestones.find(m=>m.id===modal.data.msId)?.tasks.find(t=>t.id===modal.data.id)||modal.data} people={state.people} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onUpdate={(data)=>{const t=modal.data;if(t.source==="personal")updatePersonal(t.id,data);else updateProjTask(t.projId,t.msId,t.id,data);}} />}
  </div>;
}

// ─── Log Page ────────────────────────────────────────────────────────────────
