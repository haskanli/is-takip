import { useEffect, useState } from "react";
import { commissioningMachines, fieldPlanHours, ticketNumber } from "../domain/projectHelpers.js";
import { OrganizationPanel as SharedOrganizationPanel } from "./managementComponents.jsx";
import { Avatar, Btn, Icon, Modal, iStyle, lStyle } from "./primitives.jsx";
import { DelayBadge, STATUSES, daysDiff, delayLvl } from "./status.jsx";
import {
  PersonalTaskModal as SharedPersonalTaskModal,
  TaskDetailModal as SharedTaskDetailModal,
} from "./taskComponents.jsx";
import { TICKET_STATUSES } from "./ticketComponents.jsx";
import {
  downloadDelayReport,
  downloadEffortReport,
  generatePortfolioReport,
  generateTicketStatusReport,
} from "./reportComponents.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentTimeStr = () => new Date().toTimeString().slice(0, 5);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const WAIT = ["PM","M\u00fc\u015fteri","ERP","Tedarik\u00e7i","Teknik","\u00dcr\u00fcn-Teknoloji","Y\u00f6netim","Di\u011fer"];
const ORG_LEVELS = [
  {id:"ceo",label:"CEO",rank:1},
  {id:"coo",label:"COO",rank:2},
  {id:"operations_director",label:"Operasyon Direkt\u00f6r\u00fc",rank:3},
  {id:"project_director",label:"Proje M\u00fcd\u00fcr\u00fc",rank:4},
  {id:"project_manager",label:"Proje Y\u00f6neticisi",rank:5},
  {id:"process_lead",label:"S\u00fcre\u00e7 Lideri",rank:6},
  {id:"field_engineer",label:"Saha M\u00fchendisi",rank:7},
];
const organizationRoles = (state) => {
  const custom = Array.isArray(state?.organizationRoles) ? state.organizationRoles : [];
  return [...ORG_LEVELS, ...custom].filter((role, index, list) => list.findIndex(item => item.id === role.id) === index);
};

function AdminBoardCard({id,size="medium",draggedId,onDragStart,onDragEnd,onDrop,onResize,children,style={}}) {
  const active=draggedId===id;
  const sizeLabels={small:"Kompakt",medium:"Orta",large:"Geniş",full:"Tam"};
  return <div
    className={`admin-board-card admin-board-${size}`}
    onDragOver={event=>event.preventDefault()}
    onDrop={event=>onDrop(event,id)}
    style={{position:"relative",opacity:active?.48:1,transform:active?"scale(.985)":"none",transition:"opacity .15s, transform .15s",...style}}
  >
    <div className="admin-board-tools" style={{position:"absolute",top:7,right:8,zIndex:3,display:"flex",alignItems:"center",gap:3}}>
      <select className="admin-card-size-select" title="Kart genişliği" value={size} onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onChange={event=>onResize(id,event.target.value)} style={{border:"1px solid var(--border)",borderRadius:6,background:"#fff",color:"var(--muted)",fontSize:9,padding:"2px 3px",cursor:"pointer",maxWidth:68}}>{Object.entries(sizeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <div draggable onDragStart={event=>onDragStart(event,id)} onDragEnd={onDragEnd} title="Sürükleyerek yerini değiştir" style={{color:"var(--muted)",fontSize:15,lineHeight:1,cursor:"grab",letterSpacing:1,userSelect:"none"}}>⠿</div>
    </div>
    {children}
  </div>;
}

function ManagerAssignedTasksV2({state,setState,currentUser,onAssignTask}) {
  const [personFilter,setPersonFilter]=useState("all");
  const [modal,setModal]=useState(null);
  const [assignmentNotice,setAssignmentNotice]=useState("");
  const tasks=(state.personalTasks||[]).filter(task=>task.createdBy===currentUser.id);
  const peopleWithTasks=state.people.filter(person=>tasks.some(task=>task.assignee===person.id));
  const rows=tasks
    .filter(task=>personFilter==="all"||task.assignee===personFilter)
    .map(task=>({...task,person:state.people.find(person=>person.id===task.assignee),project:state.projects.find(project=>project.id===task.projectId),source:"personal"}))
    .sort((a,b)=>{
      const ad=delayLvl(a.dueDate,a.status)?1:0,bd=delayLvl(b.dueDate,b.status)?1:0;
      if(ad!==bd)return bd-ad;
      if(a.status==="Tamamlandı"&&b.status!=="Tamamlandı")return 1;
      if(b.status==="Tamamlandı"&&a.status!=="Tamamlandı")return -1;
      return String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999"));
    });
  const active=tasks.filter(task=>task.status!=="Tamamlandı");
  const updateTask=(id,data)=>setState(current=>{
    const old=(current.personalTasks||[]).find(task=>task.id===id);
    if(!old)return current;
    const notices=[];
    const patch={...data};
    if(data.status&&old.status!==data.status){
      patch.statusUpdatedAt=now();
      patch.statusUpdatedBy=currentUser.id;
      [old.assignee,old.createdBy].filter(Boolean).filter((userId,index,array)=>array.indexOf(userId)===index&&userId!==currentUser.id).forEach(userId=>notices.push({id:uid(),ts:now(),userId,msg:`"${old.title}" görevinin durumu ${data.status} oldu.`,projectName:"Yönetici Ataması",taskId:old.id,type:"task_status",read:false}));
    }
    if(data.comments&&data.comments.length>(old.comments||[]).length&&old.assignee&&old.assignee!==currentUser.id){
      notices.push({id:uid(),ts:now(),userId:old.assignee,msg:`"${old.title}" görevine yeni not eklendi.`,projectName:"Yönetici Ataması",taskId:old.id,type:"task_comment",read:false});
    }
    return {...current,personalTasks:(current.personalTasks||[]).map(task=>task.id===id?{...task,...patch}:task),notifications:[...notices,...(current.notifications||[])]};
  });
  const assignTask=async(data)=>{
    setAssignmentNotice("");
    const result=await onAssignTask(data);
    const created=result?.tasks?.length||0;
    const whatsapp=result?.notifications?.filter(item=>item.sent&&item.channel==="whatsapp").length||0;
    const email=result?.notifications?.filter(item=>item.sent&&item.channel==="email").length||0;
    const failed=result?.notifications?.filter(item=>!item.sent).length||0;
    setAssignmentNotice(`${created} görev oluşturuldu · WhatsApp: ${whatsapp} · E-posta: ${email}${failed?` · Ulaşmayan: ${failed}`:""}`);
    setModal(null);
  };
  return <div className="manager-assigned-dashboard">
    <div className="manager-assigned-stats">
      {[["Toplam Atama",tasks.length,"var(--accent)"],["Aktif",active.length,"var(--warning)"],["Geciken",active.filter(task=>delayLvl(task.dueDate,task.status)).length,"var(--danger)"],["Tamamlanan",tasks.filter(task=>task.status==="Tamamlandı").length,"var(--success)"]].map(([label,value,color])=><div key={label} className="manager-stat-card" style={{"--stat-color":color}}><div>{label}</div><b>{value}</b></div>)}
    </div>
    <div className="manager-assigned-toolbar">
      <div><b>Atadığım işler</b><span>Geciken görevler listede üstte görünür.</span></div>
      <div><Btn small onClick={()=>setModal({type:"addPersonal"})}>Görev Ata</Btn><select style={{...iStyle,width:220,background:"#fff"}} value={personFilter} onChange={event=>setPersonFilter(event.target.value)}><option value="all">Tüm kişiler</option>{peopleWithTasks.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
    </div>
    {assignmentNotice&&<div className="soft-panel" style={{margin:"0 0 12px",padding:"10px 13px",color:"var(--success)",fontSize:12,fontWeight:800}}>{assignmentNotice}</div>}
    <div style={{display:"grid",gap:8}}>{rows.map(task=><div key={task.id} className="manager-assigned-row compact-list-card" style={{borderColor:delayLvl(task.dueDate,task.status)?"color-mix(in srgb, var(--danger) 34%, var(--border))":"var(--glass-border)",padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10,minWidth:0}}>
      <Avatar initials={task.person?.avatar||"?"} imageUrl={task.person?.avatarUrl} size={30}/>
      <button onClick={()=>setModal({type:"taskDetail",data:task})} style={{flex:1,minWidth:0,border:0,background:"transparent",textAlign:"left",cursor:"pointer",padding:0}}><b style={{fontSize:12,display:"block",lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{task.title}</b><div style={{fontSize:10,color:"var(--muted)",marginTop:3,lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{task.person?.name||"Atanmamış"} · {task.project?.name||"Projesiz"} · {fmt(task.dueDate)}{task.dueTime?` ${task.dueTime}`:""} · {task.status}</div>{task.firstSeenAt&&<div style={{fontSize:10,color:"var(--success)",marginTop:3,fontWeight:800}}>İlk görüntüleme: {new Date(task.firstSeenAt).toLocaleString("tr-TR")}</div>}{task.notes&&<div style={{fontSize:10,color:"var(--muted)",marginTop:3,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{task.notes}</div>}</button>
      {delayLvl(task.dueDate,task.status)&&<DelayBadge dateStr={task.dueDate} status={task.status}/>}
      <select className="manager-assigned-status" onClick={event=>event.stopPropagation()} style={{...iStyle,width:150,background:"rgb(255 255 255 / 72%)",fontSize:11}} value={task.status||"Bekliyor"} onChange={event=>updateTask(task.id,{status:event.target.value})}>{STATUSES.map(status=><option key={status}>{status}</option>)}</select>
    </div>)}{!rows.length&&<div className="empty-panel soft-panel">Bu filtrede yönetici ataması bulunmuyor.</div>}</div>
    {modal?.type==="taskDetail"&&<SharedTaskDetailModal task={(state.personalTasks||[]).find(task=>task.id===modal.data.id)||modal.data} people={state.people} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onUpdate={data=>updateTask(modal.data.id,data)} />}
    {modal?.type==="addPersonal"&&<SharedPersonalTaskModal title="Görev Ata" people={state.people} projects={state.projects} isAdmin currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={assignTask} />}
  </div>;
}

export function ManagementWorkspace({state,setState,currentUser,onOpenProject,onNavigate,onEditPerson,onAddPerson,onAssignTask,initialSection="overview"}) {
  const [section,setSection]=useState(initialSection);
  const [newRole,setNewRole]=useState("");
  const roles=organizationRoles(state);
  useEffect(()=>setSection(initialSection),[initialSection]);
  const addRole=()=>{
    const label=newRole.trim();
    if(!label)return;
    setState(current=>({...current,organizationRoles:[...(current.organizationRoles||[]),{id:`custom_${uid()}`,label,rank:roles.length+1}]}));
    setNewRole("");
  };
  const tabs=<div className="management-tabs" role="tablist">{[["overview","Genel Bakış"],["assigned","Atadığım İşler"],["organization","Organizasyon"]].map(([id,label])=><button key={id} type="button" role="tab" aria-selected={section===id} onClick={()=>setSection(id)} className={section===id?"is-active":""}>{label}</button>)}</div>;
  return <div className="theme-work-page management-theme-page management-workspace">
    <div className="management-hero unified-page-header">
      <div className="management-heading">
        <span className="management-eyebrow">Yönetim Paneli</span>
        <h2>Operasyon Kontrol Merkezi</h2>
        <p>Projeler, terminler, riskler, ekip yükü ve ticketlar için tek bakışta karar ekranı.</p>
      </div>
    </div>
    <div className="unified-filter-row management-tabs-row">{tabs}</div>
    {section==="overview"&&<AdminDashboard state={state} setState={setState} currentUser={currentUser} onOpenProject={onOpenProject} onNavigate={onNavigate} showHeader={false}/>}
    {section==="assigned"&&<ManagerAssignedTasksV2 state={state} setState={setState} currentUser={currentUser} onAssignTask={onAssignTask}/>}
    {section==="organization"&&<><div className="management-org-toolbar"><input style={{...iStyle,width:220}} value={newRole} onChange={event=>setNewRole(event.target.value)} onKeyDown={event=>event.key==="Enter"&&addRole()} placeholder="Yeni organizasyon rolü"/><Btn small onClick={addRole}>Rol Ekle</Btn><Btn small variant="secondary" onClick={onAddPerson}>Kişi Ekle</Btn></div><SharedOrganizationPanel people={state.people} roles={roles} onEdit={onEditPerson}/></>}
  </div>;
}

function AdminDashboard({state,setState,currentUser,onOpenProject,onNavigate,showHeader=true}) {
  const [projectId,setProjectId]=useState("all");
  const [detailModal,setDetailModal]=useState(null);
  const [draggedCard,setDraggedCard]=useState(null);
  const [aiSummaryRefresh,setAiSummaryRefresh]=useState(0);
  const projects=projectId==="all"?state.projects:state.projects.filter(project=>project.id===projectId);
  const projectIds=new Set(projects.map(project=>project.id));
  const scopedState={
    ...state,
    projects,
    projectTickets:Object.fromEntries(
      Object.entries(state.projectTickets||{}).filter(([id])=>projectIds.has(id)),
    ),
  };
  const tasks=projects.flatMap(project=>project.milestones.flatMap(milestone=>
    milestone.tasks.map(task=>({task,project,milestone}))
  ));
  const tickets=Object.entries(state.projectTickets||{}).flatMap(([id,list])=>
    projectIds.has(id)?(list||[]).map(ticket=>({ticket,project:state.projects.find(project=>project.id===id)})):[]
  );
  const risks=projects.flatMap(project=>(project.risks||[]).map(risk=>({risk,project})));
  const activeTasks=tasks.filter(({task})=>task.status!=="Tamamlandı");
  const completedTasks=tasks.filter(({task})=>task.status==="Tamamlandı");
  const delayedTasks=activeTasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const criticalTasks=delayedTasks.filter(({task})=>delayLvl(task.dueDate,task.status)==="critical");
  const dueSoon=activeTasks.filter(({task})=>{
    if(!task.dueDate||delayLvl(task.dueDate,task.status))return false;
    const days=-daysDiff(task.dueDate);
    return days>=0&&days<=14;
  }).sort((a,b)=>(a.task.dueDate||"").localeCompare(b.task.dueDate||""));
  const openTickets=tickets.filter(({ticket})=>!["Tamamlandı","İptal Edildi"].includes(ticket.status));
  const staleTickets=openTickets.filter(({ticket})=>daysDiff(ticket.updatedAt||ticket.ts)>=7);
  const openRisks=risks.filter(({risk})=>risk.status!=="Kapalı");
  const highRisks=openRisks.filter(({risk})=>["Yüksek","Kritik"].includes(risk.level));
  const effortHours=tasks.reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0)
    +(state.fieldPlans||[]).filter(plan=>projectIds.has(plan.projectId)&&(plan.status==="completed"||plan.completedAt)).reduce((total,plan)=>total+fieldPlanHours(plan),0)
    +Object.entries(state.projectActions||{}).filter(([id])=>projectIds.has(id)).flatMap(([,items])=>items||[]).reduce((total,item)=>total+(parseFloat(item.effortHours)||0),0);
  const estimatedHours=tasks.reduce((total,{task})=>total+(parseFloat(task.estimatedHours)||0),0);
  const machineList=projects.flatMap(project=>project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[]);
  const commissioned=machineList.filter(machine=>machine.commissioned).length;
  const progress=tasks.length?Math.round(completedTasks.length/tasks.length*100):0;
  const onTimeRate=tasks.length?Math.round((tasks.length-delayedTasks.length)/tasks.length*100):100;
  const riskRate=projects.length?Math.min(100,Math.round(highRisks.length/projects.length*25)):0;
  const health=Math.max(0,Math.min(100,Math.round(progress*.45+onTimeRate*.45+(100-riskRate)*.1)));
  const healthColor=health>=80?"var(--success)":health>=60?"var(--warning)":"var(--danger)";

  const projectRows=projects.map(project=>{
    const projectTasks=project.milestones.flatMap(milestone=>milestone.tasks);
    const done=projectTasks.filter(task=>task.status==="Tamamlandı").length;
    const delayed=projectTasks.filter(task=>delayLvl(task.dueDate,task.status)).length;
    const critical=projectTasks.filter(task=>delayLvl(task.dueDate,task.status)==="critical").length;
    const projectRisks=(project.risks||[]).filter(risk=>risk.status!=="Kapalı").length;
    const pct=projectTasks.length?Math.round(done/projectTasks.length*100):0;
    const score=Math.max(0,Math.min(100,Math.round(pct*.55+(projectTasks.length?(projectTasks.length-delayed)/projectTasks.length*35:35)+Math.max(0,10-projectRisks*3-critical*3))));
    return {project,total:projectTasks.length,done,delayed,critical,risks:projectRisks,pct,score};
  }).sort((a,b)=>a.score-b.score);

  const workload=state.people.map(person=>{
    const personTasks=activeTasks.filter(({task})=>task.assignee===person.id);
    return {
      person,
      active:personTasks.length,
      delayed:personTasks.filter(({task})=>delayLvl(task.dueDate,task.status)).length,
      hours:tasks.filter(({task})=>task.assignee===person.id).reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0),
    };
  }).filter(item=>item.active||item.hours).sort((a,b)=>b.active-a.active||b.hours-a.hours);
  const maxWorkload=Math.max(1,...workload.map(item=>item.active));
  const ticketStatuses=TICKET_STATUSES.map(status=>({
    status,
    count:tickets.filter(({ticket})=>(ticket.status||"Açık")===status).length,
  })).filter(item=>item.count);
  const maxTicketStatus=Math.max(1,...ticketStatuses.map(item=>item.count));
  const statusColors={"Açık":"var(--accent)","Ürün Ekibinde":"var(--accent)","Devam Ediyor":"var(--warning)","Beklemede":"var(--muted)","Tamamlandı":"var(--success)","İptal Edildi":"var(--danger)"};
  const kpis=[
    {id:"health",label:"Portföy Sağlığı",value:`${health}%`,detail:health>=80?"Kontrol altında":health>=60?"Yakın takip gerekli":"Yönetici aksiyonu gerekli",color:healthColor,info:"Görev ilerlemesi %45, termin uyumu %45 ve yüksek/kritik risk yoğunluğu %10 ağırlıkla hesaplanır.",items:projectRows.map(item=>({title:item.project.name,meta:`Sağlık ${item.score} · İlerleme %${item.pct} · ${item.delayed} gecikme`}))},
    {id:"progress",label:"Genel İlerleme",value:`${progress}%`,detail:`${completedTasks.length}/${tasks.length} görev tamamlandı`,color:"var(--accent)",info:"Tamamlanan görev sayısının kapsamdaki toplam görev sayısına oranıdır.",items:tasks.map(({task,project})=>({title:task.title,meta:`${project.name} · ${task.status}`}))},
    {id:"deadlines",label:"Kritik Termin",value:criticalTasks.length,detail:`${delayedTasks.length} toplam gecikme`,color:"var(--danger)",info:"Termin tarihi en az 7 gün geçmiş ve tamamlanmamış görevler kritik kabul edilir.",items:delayedTasks.map(({task,project})=>({title:task.title,meta:`${project.name} · ${daysDiff(task.dueDate)} gün gecikti`}))},
    {id:"tickets",label:"Açık Ticket",value:openTickets.length,detail:`${staleTickets.length} ticket 7+ gündür aksiyonsuz`,color:"var(--warning)",info:"Tamamlandı veya İptal Edildi dışındaki ticketlar açık; son güncellemesi 7 günü geçenler aksiyonsuz sayılır.",items:openTickets.map(({ticket,project})=>({title:`${ticketNumber(ticket)} · ${ticket.title}`,meta:`${project?.name||"Proje"} · ${ticket.status||"Açık"}`}))},
    {id:"risks",label:"Açık Risk",value:openRisks.length,detail:`${highRisks.length} yüksek/kritik`,color:"var(--warning)",info:"Kapalı olmayan riskler sayılır; Yüksek ve Kritik seviyeler ayrıca vurgulanır.",items:openRisks.map(({risk,project})=>({title:risk.title,meta:`${project.name} · ${risk.level}`}))},
    {id:"effort",label:"Toplam Efor",value:`${effortHours} sa`,detail:estimatedHours?`${estimatedHours} sa planlandı`:"Plan eforu girilmedi",color:"var(--accent)",info:"Görev zaman kayıtları, tamamlanan saha ziyaretleri ve efor girilmiş proje aksiyonlarının toplamıdır.",items:projects.map(project=>({title:project.name,meta:`${project.milestones.flatMap(m=>m.tasks).reduce((sum,task)=>sum+(task.timeEntries||[]).reduce((total,entry)=>total+(parseFloat(entry.hours)||0),0),0)+((state.projectActions||{})[project.id]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0)} saat görev/aksiyon eforu`}))},
    {id:"commissioning",label:"Devreye Alma",value:machineList.length?`${Math.round(commissioned/machineList.length*100)}%`:"-",detail:`${commissioned}/${machineList.length} makine devrede`,color:"var(--success)",info:"Devreye alınmış makine sayısının kapsamdaki fiziksel ve sanal toplam makine sayısına oranıdır.",items:machineList.map(machine=>({title:machine.name,meta:`${machine.type==="virtual"?"Sanal":"Fiziksel"} · ${machine.commissioned?"Devrede":"Bekliyor"}`}))},
    {id:"projects",label:"Aktif Proje",value:projects.length,detail:`${projectRows.filter(item=>item.score<60).length} proje riskli`,color:"var(--accent)",info:"Seçilen kapsamdaki projeler sayılır; sağlık puanı 60 altındaki projeler riskli kabul edilir.",items:projectRows.map(item=>({title:item.project.name,meta:`Sağlık ${item.score} · ${item.project.status}`}))},
  ];
  const kpiById=Object.fromEntries(kpis.map(kpi=>[kpi.id,kpi]));
  const summaryCards=[
    {id:"health",label:"Sağlık",value:`${health}%`,detail:health>=80?"Portföy kontrol altında":health>=60?"Yakın takip gerekli":"Yönetici aksiyonu gerekli",color:healthColor},
    {id:"progress",label:"İlerleme",value:`${progress}%`,detail:`${completedTasks.length}/${tasks.length} görev tamamlandı`,color:"var(--accent)"},
    {id:"deadlines",label:"Kritik Termin",value:criticalTasks.length,detail:`${delayedTasks.length} toplam gecikme`,color:"var(--danger)"},
    {id:"tickets",label:"Ticket",value:openTickets.length,detail:`${staleTickets.length} aksiyonsuz`,color:"var(--warning)"},
    {id:"risks",label:"Risk",value:openRisks.length,detail:`${highRisks.length} yüksek/kritik`,color:"var(--warning)"},
    {id:"effort",label:"Efor",value:`${effortHours} sa`,detail:estimatedHours?`${estimatedHours} sa plan`:"Plan eforu yok",color:"var(--accent)"},
  ];
  const topRiskProject=projectRows[0];
  const topDeadline=[...criticalTasks,...dueSoon][0];
  const topStaleTicket=staleTickets[0];
  const assignedByManager=(state.personalTasks||[]).filter(task=>task.createdBy===currentUser.id);
  const delayedAssignedByManager=assignedByManager.filter(task=>task.status!=="Tamamlandı"&&delayLvl(task.dueDate,task.status));
  const topDelayedAssigned=delayedAssignedByManager[0];
  const adminSummaryLines=[
    delayedAssignedByManager.length?`Atadığınız ${delayedAssignedByManager.length} görev gecikmiş; ilk odak ${state.people.find(person=>person.id===topDelayedAssigned?.assignee)?.name||"atanan kişi"} / ${topDelayedAssigned?.title||"görev"}.`:"Atadığınız görevlerde gecikmiş kayıt görünmüyor.",
    criticalTasks.length?`${criticalTasks.length} kritik termin var; ilk odak ${topDeadline?.project?.name||"ilgili proje"} / ${topDeadline?.task?.title||"kritik görev"}.`:"Kritik termin görünmüyor, termin baskısı şu an kontrol altında.",
    staleTickets.length?`${staleTickets.length} ticket 7+ gündür aksiyonsuz; en eski kayıt ${ticketNumber(topStaleTicket?.ticket||{})}.`:"Ticket aksiyonları genel olarak güncel görünüyor.",
    highRisks.length?`${highRisks.length} yüksek/kritik risk açık; risk kapatma aksiyonları takip edilmeli.`:"Yüksek/kritik risk yoğunluğu düşük.",
    topRiskProject&&topRiskProject.score<60?`${topRiskProject.project.name} sağlık puanı ${topRiskProject.score}; yönetici takibi öncelikli.`:`Portföy sağlığı ${health}% seviyesinde.`,
  ];
  const defaultCardOrder=[
    ...kpis.map(kpi=>`kpi-${kpi.id}`),
    "project-health","portfolio-distribution","ticket-statuses",
    "critical-deadlines","team-workload","risk-radar","ai-assistant","report-center",
  ];
  const savedOrder=(state.userNotes||{})[currentUser.id]?.adminDashboardOrder||[];
  const savedSizes=(state.userNotes||{})[currentUser.id]?.adminDashboardSizes||{};
  const cardOrder=[...savedOrder.filter(id=>defaultCardOrder.includes(id)),...defaultCardOrder.filter(id=>!savedOrder.includes(id))];
  const saveCardOrder=(order)=>setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...(current.userNotes||{})[currentUser.id],adminDashboardOrder:order}}}));
  const resizeCard=(id,size)=>setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...(current.userNotes||{})[currentUser.id],adminDashboardSizes:{...((current.userNotes||{})[currentUser.id]?.adminDashboardSizes||{}),[id]:size}}}}));
  const startDrag=(event,id)=>{
    setDraggedCard(id);
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("text/plain",id);
  };
  const dropCard=(event,targetId)=>{
    event.preventDefault();
    const sourceId=draggedCard||event.dataTransfer.getData("text/plain");
    if(!sourceId||sourceId===targetId)return setDraggedCard(null);
    const next=[...cardOrder];
    const sourceIndex=next.indexOf(sourceId),targetIndex=next.indexOf(targetId);
    if(sourceIndex<0||targetIndex<0)return setDraggedCard(null);
    next.splice(sourceIndex,1);
    next.splice(targetIndex,0,sourceId);
    saveCardOrder(next);
    setDraggedCard(null);
  };
  const dashboardCards={};
  kpis.forEach(kpi=>{
    dashboardCards[`kpi-${kpi.id}`]={
      size:"small",
      node:<div
        role="button"
        tabIndex={0}
        onKeyDown={event=>event.key==="Enter"&&setDetailModal({mode:"detail",...kpi})}
        onClick={()=>setDetailModal({mode:"detail",...kpi})}
        className="admin-kpi-card"
        style={{height:"100%",borderRadius:14,padding:"14px 15px",borderTop:`3px solid ${kpi.color}`,textAlign:"left",cursor:"pointer",position:"relative"}}
      >
        <div className="admin-kpi-head" style={{display:"flex",alignItems:"center",gap:5,paddingRight:78,minWidth:0}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:750,textTransform:"uppercase",letterSpacing:.45,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{kpi.label}</div><button className="admin-kpi-info" title="Hesaplama bilgisi" onClick={event=>{event.stopPropagation();setDetailModal({mode:"info",...kpi});}} style={{width:20,height:20,borderRadius:"50%",border:"1px solid var(--muted)",background:"var(--surface-soft)",color:"var(--muted)",fontSize:11,fontWeight:850,cursor:"pointer",flexShrink:0}}>i</button></div>
        <div style={{fontSize:25,fontWeight:900,color:kpi.color,margin:"4px 0 2px"}}>{kpi.value}</div>
        <div style={{fontSize:10,color:"var(--muted)",lineHeight:1.35,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",overflowWrap:"anywhere"}}>{kpi.detail}</div>
      </div>,
    };
  });
  dashboardCards["project-health"]={size:"large",node:<div className="management-dashboard-card management-project-health" style={{height:"100%",background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:16,boxShadow:"0 5px 16px rgba(15,23,42,.04)"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:13,paddingRight:78,minWidth:0}}><div style={{minWidth:0}}><div style={{fontWeight:850,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Proje Sağlık Haritası</div><div style={{fontSize:10,color:"var(--muted)",marginTop:2,lineHeight:1.35}}>En fazla yönetici ilgisi gerektiren projeler üstte.</div></div><button onClick={()=>onNavigate("projects")} style={{border:0,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:8,padding:"6px 9px",fontSize:10,fontWeight:800,cursor:"pointer",flexShrink:0}}>Tüm projeler</button></div>
    <div style={{display:"flex",flexDirection:"column",gap:9}}>{projectRows.slice(0,8).map(item=><button className="management-health-row" key={item.project.id} onClick={()=>onOpenProject(item.project.id)} style={{border:"1px solid var(--surface-soft)",background:"var(--surface-soft)",borderRadius:11,padding:"10px 11px",cursor:"pointer",textAlign:"left",overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,minWidth:0}}><span style={{width:8,height:8,borderRadius:"50%",background:item.project.color,flexShrink:0}}/><b style={{fontSize:11,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.project.name}</b><span style={{fontSize:11,fontWeight:900,color:item.score>=80?"var(--success)":item.score>=60?"var(--warning)":"var(--danger)",flexShrink:0}}>{item.score}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{height:7,background:"var(--border)",borderRadius:10,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${item.pct}%`,background:`linear-gradient(90deg,var(--accent),var(--success))`,borderRadius:10}}/></div><span style={{fontSize:10,fontWeight:800,color:"var(--muted)",width:32,flexShrink:0}}>{item.pct}%</span></div><div style={{display:"flex",gap:7,marginTop:6,fontSize:9,color:"var(--muted)",flexWrap:"wrap",lineHeight:1.35}}><span>{item.done}/{item.total} tamam</span><span style={{color:item.delayed?"var(--warning)":"var(--muted)"}}>{item.delayed} gecikme</span><span style={{color:item.critical?"var(--danger)":"var(--muted)"}}>{item.critical} kritik</span><span>{item.risks} risk</span></div></button>)}{!projectRows.length&&<div style={{padding:30,textAlign:"center",color:"var(--muted)",fontSize:12}}>Bu kapsamda proje yok.</div>}</div>
  </div>};
  dashboardCards["portfolio-distribution"]={size:"medium",node:<div className="management-dashboard-card management-portfolio-card" style={{height:"100%",background:"var(--text)",color:"#fff",borderRadius:16,padding:17,boxShadow:"0 8px 24px rgba(15,23,42,.16)",overflow:"hidden"}}><div style={{fontSize:11,fontWeight:800,color:"var(--accent-ink)",paddingRight:18,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>PORTFÖY DAĞILIMI</div><div style={{display:"flex",alignItems:"center",gap:17,marginTop:12,flexWrap:"wrap"}}><div className="management-donut" style={{width:112,height:112,borderRadius:"50%",background:`conic-gradient(var(--success) 0 ${progress}%,var(--surface-soft) ${progress}% 100%)`,display:"grid",placeItems:"center",flexShrink:0}}><div style={{width:78,height:78,borderRadius:"50%",background:"var(--text)",display:"grid",placeItems:"center",textAlign:"center"}}><div><b style={{fontSize:22}}>{progress}%</b><div style={{fontSize:8,color:"var(--muted)"}}>TAMAMLANMA</div></div></div></div><div style={{flex:"1 1 135px",display:"grid",gap:8,minWidth:0}}>{[["Tamamlanan",completedTasks.length,"var(--success)"],["Aktif",activeTasks.length-delayedTasks.length,"var(--accent)"],["Geciken",delayedTasks.length,"var(--warning)"],["Kritik",criticalTasks.length,"var(--danger)"]].map(([label,value,color])=><div key={label} className="management-legend-row" style={{display:"flex",alignItems:"center",gap:7,fontSize:10,minWidth:0}}><span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/><span style={{color:"var(--muted)",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span><b style={{flexShrink:0}}>{value}</b></div>)}</div></div></div>};
  dashboardCards["ticket-statuses"]={size:"medium",node:<div className="management-dashboard-card" style={{height:"100%",background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:12,paddingRight:18}}>Ticket Durumları</div><div style={{display:"grid",gap:8}}>{ticketStatuses.map(item=><div key={item.status}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><span>{item.status}</span><b>{item.count}</b></div><div style={{height:6,background:"var(--surface-soft)",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${item.count/maxTicketStatus*100}%`,background:statusColors[item.status]||"var(--accent)",borderRadius:8}}/></div></div>)}{!ticketStatuses.length&&<div style={{fontSize:11,color:"var(--muted)"}}>Ticket bulunmuyor.</div>}</div><button onClick={()=>onNavigate("tickets")} style={{marginTop:12,border:0,background:"color-mix(in srgb, var(--warning) 10%, white 90%)",color:"var(--warning)",borderRadius:8,padding:"7px 10px",fontSize:10,fontWeight:800,cursor:"pointer"}}>Ticket ekranını aç</button></div>};
  dashboardCards["critical-deadlines"]={size:"medium",node:<div className="management-dashboard-card" style={{height:"100%",background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:11,paddingRight:18}}>Kritik Terminler</div><div style={{display:"grid",gap:7}}>{[...criticalTasks,...dueSoon].slice(0,6).map(({task,project})=><button className="management-deadline-row" key={`${project.id}-${task.id}`} onClick={()=>onOpenProject(project.id)} style={{border:0,borderLeft:`3px solid ${delayLvl(task.dueDate,task.status)?"var(--danger)":"var(--warning)"}`,background:"var(--surface-soft)",borderRadius:8,padding:"8px 9px",textAlign:"left",cursor:"pointer",overflow:"hidden"}}><div style={{fontSize:10,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div><div style={{fontSize:9,color:"var(--muted)",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.name} · {fmt(task.dueDate)}{delayLvl(task.dueDate,task.status)?` · ${daysDiff(task.dueDate)} gün gecikti`:""}</div></button>)}{![...criticalTasks,...dueSoon].length&&<div className="management-ok-note" style={{fontSize:11,color:"var(--success)",padding:12,background:"color-mix(in srgb, var(--success) 10%, white 90%)",borderRadius:9}}>Yakın veya kritik termin yok.</div>}</div></div>};
  dashboardCards["team-workload"]={size:"medium",node:<div className="management-dashboard-card" style={{height:"100%",background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:11,paddingRight:18}}>Ekip İş Yükü</div><div style={{display:"grid",gap:9}}>{workload.slice(0,7).map(item=><div key={item.person.id}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,minWidth:0}}><Avatar initials={item.person.avatar} imageUrl={item.person.avatarUrl} size={22}/><span style={{fontSize:10,fontWeight:750,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.person.name}</span><span style={{fontSize:9,color:item.delayed?"var(--danger)":"var(--muted)",whiteSpace:"nowrap",flexShrink:0}}>{item.active} aktif · {item.delayed} gecikmiş</span></div><div style={{marginLeft:29,height:6,background:"var(--surface-soft)",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${item.active/maxWorkload*100}%`,background:item.delayed?"linear-gradient(90deg,var(--warning),var(--danger))":"linear-gradient(90deg,var(--accent),var(--success))",borderRadius:8}}/></div></div>)}{!workload.length&&<div style={{fontSize:11,color:"var(--muted)"}}>Aktif iş yükü bulunmuyor.</div>}</div></div>};
  dashboardCards["risk-radar"]={size:"medium",node:<div className="management-dashboard-card" style={{height:"100%",background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:11,paddingRight:18}}>Risk ve Aksiyon Radarı</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:11}}>{[["Yüksek Risk",highRisks.length,"var(--danger)","var(--surface-soft)"],["Aksiyonsuz Ticket",staleTickets.length,"var(--warning)","var(--surface-soft)"],["Geciken Görev",delayedTasks.length,"var(--warning)","var(--surface-soft)"],["Devre Dışı",machineList.length-commissioned,"var(--accent)","var(--surface-soft)"]].map(([label,value,color,bg])=><div className="management-radar-tile" key={label} style={{background:bg,borderRadius:10,padding:10}}><b style={{fontSize:20,color}}>{value}</b><div style={{fontSize:9,color:"var(--muted)",marginTop:2}}>{label}</div></div>)}</div><div style={{fontSize:10,color:"var(--muted)",lineHeight:1.55}}>{highRisks.length||criticalTasks.length||staleTickets.length?"Kritik sapmalar için proje sahipleriyle aksiyon planı oluşturulmalı.":"Portföyde acil yönetici aksiyonu gerektiren belirgin bir sapma yok."}</div></div>};
  dashboardCards["ai-assistant"]={size:"medium",node:<button className="management-dashboard-card management-ai-card" onClick={()=>onNavigate("ai")} style={{width:"100%",height:"100%",border:"1px solid var(--border)",borderRadius:16,padding:18,background:"linear-gradient(135deg,var(--accent),var(--accent))",color:"#fff",textAlign:"left",cursor:"pointer",boxShadow:"0 10px 24px rgba(109,40,217,.2)"}}><span style={{width:36,height:36,borderRadius:11,display:"grid",placeItems:"center",background:"rgba(255,255,255,.14)",marginBottom:16}}><Icon name="activity" size={19}/></span><b style={{display:"block",fontSize:15}}>AI Portföy Asistanı</b><span style={{display:"block",fontSize:10,color:"var(--border)",lineHeight:1.55,marginTop:5}}>Seçili proje veya tüm portföy için risk, gecikme ve öncelikli aksiyon analizi alın.</span><span style={{display:"inline-block",marginTop:14,fontSize:10,fontWeight:850,background:"#fff",color:"var(--accent)",borderRadius:8,padding:"6px 9px"}}>Analizi aç</span></button>};
  dashboardCards["report-center"]={size:"full",node:<div className="management-dashboard-card management-report-center" style={{height:"100%",background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:16,overflow:"hidden"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12,paddingRight:18}}><div style={{minWidth:0}}><div style={{fontWeight:850,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Yönetici Rapor Merkezi</div><div style={{fontSize:10,color:"var(--muted)",marginTop:2,lineHeight:1.35}}>Toplantı, operasyon takibi ve paylaşım için hazır çıktılar.</div></div><button onClick={()=>onNavigate("reports")} style={{border:0,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:8,padding:"7px 10px",fontSize:10,fontWeight:800,cursor:"pointer",flexShrink:0}}>Tüm raporlar</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>{[["Genel Durum","Portföy ilerleme, gecikme ve kapasite özeti.","var(--accent)",()=>generatePortfolioReport(scopedState,state.people),"HTML / PDF"],["Termin ve Gecikme","Geciken görevler ve sorumlu dağılımı.","var(--danger)",()=>downloadDelayReport(scopedState,state.people),"XLSX"],["Efor ve Kapasite","Kişi, proje ve görev bazlı saat analizi.","var(--success)",()=>downloadEffortReport(scopedState,state.people),"XLSX"],["Ticket Durumu","Ticket yaşı, aksiyon ve Jira durumları.","var(--warning)",()=>generateTicketStatusReport(scopedState,state.people),"HTML / PDF"]].map(([title,description,color,action,label])=><button className="management-report-tile" key={title} onClick={action} style={{border:"1px solid var(--border)",borderLeft:`4px solid ${color}`,borderRadius:11,background:"var(--surface-soft)",padding:12,textAlign:"left",cursor:"pointer",overflow:"hidden"}}><div style={{display:"flex",justifyContent:"space-between",gap:7,minWidth:0}}><b style={{fontSize:11,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</b><span style={{fontSize:8,fontWeight:850,color,background:"var(--surface-soft)",borderRadius:6,padding:"3px 5px",whiteSpace:"nowrap",flexShrink:0}}>{label}</span></div><div style={{fontSize:9,color:"var(--muted)",lineHeight:1.45,marginTop:5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{description}</div></button>)}</div></div>};

  return <div className="management-dashboard-shell" style={{padding:showHeader?"clamp(16px,3vw,28px)":0,flex:1,overflow:showHeader?"auto":"visible",background:showHeader?"transparent":"transparent"}}>
    <div className="admin-control-row" style={{display:"flex",justifyContent:showHeader?"space-between":"center",alignItems:"flex-end",gap:10,flexWrap:"wrap",marginBottom:18}}>
      {showHeader&&<div>
        <h2 style={{margin:0,fontSize:"clamp(21px,3vw,28px)",fontWeight:900,color:"var(--text)"}}>Operasyon Kontrol Merkezi</h2>
        <p style={{margin:"5px 0 0",fontSize:12,color:"var(--muted)"}}>Projeler, terminler, riskler, ekip yükü ve ticketlar için tek bakışta karar ekranı.</p>
      </div>}
      <div className="management-command-bar" style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",justifyContent:"center"}}>
        <div style={{minWidth:230}}><label style={lStyle}>Proje Kapsamı</label><select style={{...iStyle,background:"#fff"}} value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="all">Tüm Portföy</option>{state.projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
        <button title="Genel rapor" onClick={()=>generatePortfolioReport(scopedState,state.people)} className="admin-report-button" style={{border:0,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:12,padding:"10px 12px",fontSize:11,fontWeight:900,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,height:42}}><Icon name="reports" size={15}/><span>Rapor</span></button>
      </div>
    </div>

    <div className="admin-summary-grid">
      {summaryCards.map(card=>{
        const kpi=kpiById[card.id];
        return <button key={card.id} onClick={()=>kpi&&setDetailModal({mode:"detail",...kpi})} className="admin-summary-card" style={{borderTopColor:card.color}}>
          <div className="admin-summary-label" style={{fontSize:10,fontWeight:850,color:"var(--muted)",letterSpacing:.4,textTransform:"uppercase",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.label}</div>
          <div className="admin-summary-value" style={{fontSize:27,fontWeight:950,color:card.color,lineHeight:1.05,marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.value}</div>
          <div className="admin-summary-detail" style={{fontSize:10,color:"var(--muted)",lineHeight:1.35,marginTop:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{card.detail}</div>
        </button>;
      })}
    </div>

    <div className="admin-ai-summary">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:0,flex:1}}>
          <div className="admin-ai-icon" style={{width:38,height:38,borderRadius:13,display:"grid",placeItems:"center",background:"linear-gradient(135deg,var(--accent),var(--accent))",color:"#fff",boxShadow:"0 10px 22px rgba(74,108,247,.22)",flexShrink:0}}><Icon name="activity" size={18}/></div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:900,color:"var(--text)"}}>AI Yönetici Özeti</div>
            <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.45,marginTop:3}}>Genel durum için hızlı okuma. Detaylı analiz için AI çalışma alanına geçebilirsiniz.</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button onClick={()=>setAiSummaryRefresh(value=>value+1)} style={{border:0,background:"color-mix(in srgb, var(--success) 10%, white 90%)",color:"var(--success)",borderRadius:10,padding:"8px 10px",fontSize:10,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}}>Yenile</button>
          <button onClick={()=>onNavigate("ai")} style={{border:0,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:10,padding:"8px 11px",fontSize:10,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}}>AI'da Detaylandır</button>
        </div>
      </div>
      <div style={{fontSize:9,color:"var(--muted)",marginTop:8}}>Son güncelleme: {new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}{aiSummaryRefresh?` · ${aiSummaryRefresh}. manuel yenileme`:""}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:8,marginTop:13}}>
        {adminSummaryLines.map((line,index)=><div key={index} style={{background:"var(--surface-soft)",border:"1px solid var(--border)",borderRadius:12,padding:"10px 11px",fontSize:11,color:"var(--muted)",lineHeight:1.45,overflowWrap:"anywhere"}}>{line}</div>)}
      </div>
    </div>

    <div className="admin-section-heading" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"16px 0 10px",flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:14,fontWeight:900,color:"var(--text)"}}>Detay Kartları</div>
        <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>Kartları sürükleyip kendi takip düzeninizi oluşturabilirsiniz.</div>
      </div>
    </div>

    <div className="admin-board-grid">
      {cardOrder.map(id=>dashboardCards[id]&&<AdminBoardCard key={id} id={id} size={savedSizes[id]||dashboardCards[id].size} draggedId={draggedCard} onDragStart={startDrag} onDragEnd={()=>setDraggedCard(null)} onDrop={dropCard} onResize={resizeCard}>{dashboardCards[id].node}</AdminBoardCard>)}
    </div>
    {detailModal&&<Modal title={detailModal.mode==="info"?`${detailModal.label} · Hesaplama`:`${detailModal.label} · Detay`} onClose={()=>setDetailModal(null)} wide>{detailModal.mode==="info"?<div style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,background:"var(--surface-soft)",borderRadius:11,padding:15}}>{detailModal.info}</div>:<div style={{display:"grid",gap:8,maxHeight:"60vh",overflow:"auto"}}>{(detailModal.items||[]).map((item,index)=><div key={`${item.title}-${index}`} style={{border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:12,fontWeight:800}}>{item.title}</div><div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>{item.meta}</div></div>)}{!detailModal.items?.length&&<div style={{padding:30,textAlign:"center",color:"var(--muted)"}}>Bu kapsamda detay kaydı bulunmuyor.</div>}</div>}</Modal>}
  </div>;
}
