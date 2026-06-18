import { useState } from "react";
import { Icon } from "./primitives.jsx";
import { daysDiff } from "./status.jsx";
import { EmptyMobileRow, MobileFeedCard, MobileFeedRow, QuickActionModal, QuickTodoModal } from "./mobileComponents.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const DEFAULT_ACTION_TAGS = ["Takip", "Toplant?", "Telefon/G?r??me", "Yaz??ma", "Sistem Kontrol?", "Saha Ziyareti", "E?itim"];

export function DashboardPage({state,setState,currentUser,isAdmin,myProjects,deadlineWarnings,onNavigate,onOpenProject}) {
  const [quick,setQuick]=useState(null);
  const myTasks=state.projects.flatMap(p=>p.milestones.flatMap(m=>m.tasks.filter(t=>t.assignee===currentUser.id&&t.status!=="Tamamlandı")));
  const personal=(state.personalTasks||[]).filter(t=>t.assignee===currentUser.id&&t.status!=="Tamamlandı");
  const tickets=Object.values(state.projectTickets||{}).flat().filter(t=>t.assignedTo===currentUser.id||t.author===currentUser.name);
  const plans=(state.fieldPlans||[]).filter(p=>p.userId===currentUser.id&&p.date>=todayStr()).sort((a,b)=>a.date.localeCompare(b.date));
  const visits=(state.fieldPlans||[]).filter(p=>p.userId===currentUser.id&&(p.status==="completed"||p.completedAt));
  const todos=((state.userNotes||{})[currentUser.id]?.todos||[]).filter(t=>!t.done);
  const upcomingTodos=[...todos].sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const todayPlans=plans.filter(plan=>plan.date===todayStr());
  const overdueTodos=todos.filter(todo=>todo.dueDate&&daysDiff(todo.dueDate)>0);
  const todayFlowLines=[
    todayPlans.length?`${todayPlans.length} çalışma planı var.`:"Bugün için planlı saha/uzaktan çalışma yok.",
    overdueTodos.length?`${overdueTodos.length} geciken to-do kontrol edilmeli.`:upcomingTodos.length?`${upcomingTodos.length} açık to-do sırada.`:"Açık to-do görünmüyor.",
    deadlineWarnings.length?`${deadlineWarnings.length} termin uyarısı var.`:"Kritik termin uyarısı yok."
  ];
  const cards=[
    {label:"To-Do",value:todos.length,desc:"Müşteri aksiyonlarım",icon:"ticket",color:"#DB2777",view:"todos"},
    {label:"Projelerim",value:myProjects.length,desc:"Dahil olduğum projeler",icon:"projects",color:"#4A6CF7",view:"projects"},
    {label:"Görevlerim",value:myTasks.length+personal.length,desc:"Aktif görevler",icon:"tasks",color:"#7C3AED",view:"mytasks"},
    {label:"Saha Yönetimi",value:plans.length+visits.length,desc:`${plans.length} plan · ${visits.length} ziyaret`,icon:"calendar",color:"#059669",view:"fieldops"},
    {label:"Ticketlarım",value:tickets.length,desc:"İlgili ticketlar",icon:"ticket",color:"#EA6C00",view:"tickets"},
    {label:"Termin Uyarıları",value:deadlineWarnings.length,desc:"Geciken görevler",icon:"clock",color:"#E11D48",view:"deadlines"},
    {label:"AI Asistan",value:"",desc:"Projeleri yorumla ve aksiyon çıkar",icon:"activity",color:"#6D28D9",view:"ai"},
    {label:"Raporlar",value:"",desc:"Proje çıktılarını görüntüle",icon:"reports",color:"#0369A1",view:"reports"},
  ];
  const saveQuickTodo=(data)=>{
    const todo={id:uid(),customer:data.customer||"",projectId:data.projectId||"",dueDate:data.dueDate||"",action:data.action,text:data.action,done:false,createdAt:now()};
    setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...((current.userNotes||{})[currentUser.id]||{}),todos:[...(((current.userNotes||{})[currentUser.id]?.todos)||[]),todo]}}}));
    setQuick(null);
  };
  const saveQuickAction=(data)=>{
    if(!data.projectId)return;
    const project=state.projects.find(item=>item.id===data.projectId);
    const action={id:uid(),tag:data.tag||"Takip",text:data.text,effortHours:parseFloat(data.effortHours)||0,actionAt:now(),createdAt:now(),authorId:currentUser.id,authorName:currentUser.name};
    setState(current=>({...current,projectActions:{...(current.projectActions||{}),[data.projectId]:[action,...(((current.projectActions||{})[data.projectId])||[])]}}));
    setQuick(null);
    if(project)onOpenProject(project.id);
  };
  return <div style={{padding:"clamp(18px,4vw,30px)",flex:1,overflow:"auto"}}>
    <div style={{marginBottom:22}}><h2 style={{margin:0,fontSize:22}}>Merhaba, {currentUser.name}</h2><p style={{margin:"5px 0 0",color:"#64748B",fontSize:13}}>Bugün neye odaklanmak istersiniz?</p></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginBottom:18}}>
      <button onClick={()=>setQuick("todo")} style={{border:0,borderRadius:16,padding:16,textAlign:"left",cursor:"pointer",background:"linear-gradient(135deg,#DB2777,#7C3AED)",color:"#fff",boxShadow:"0 12px 28px rgba(124,58,237,.18)"}}><b style={{display:"block",fontSize:16}}>+ Hızlı To-Do</b><span style={{fontSize:11,color:"#FCE7F3"}}>Müşteri, termin ve aksiyonu hemen kaydet</span></button>
      <button onClick={()=>setQuick("action")} style={{border:0,borderRadius:16,padding:16,textAlign:"left",cursor:"pointer",background:"linear-gradient(135deg,#2563EB,#0891B2)",color:"#fff",boxShadow:"0 12px 28px rgba(37,99,235,.18)"}}><b style={{display:"block",fontSize:16}}>+ Hızlı Aksiyon</b><span style={{fontSize:11,color:"#DBEAFE"}}>Proje görüşmesi, yazışma veya saha notu gir</span></button>
    </div>
    <div style={{background:"linear-gradient(135deg,#EEF2FF,#F8FAFC)",border:"1.5px solid #C7D2FE",borderRadius:18,padding:18,marginBottom:18,boxShadow:"0 12px 28px rgba(79,70,229,.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{width:28,height:28,borderRadius:10,background:"#4A6CF7",color:"#fff",display:"grid",placeItems:"center",fontSize:12,fontWeight:950}}>AI</span><b style={{fontSize:14,color:"#1E293B"}}>Bugünün Akışı</b></div>
      <div style={{display:"grid",gap:5}}>{todayFlowLines.map(line=><div key={line} style={{fontSize:12,color:"#475569",lineHeight:1.45,wordBreak:"break-word"}}>{line}</div>)}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:13,marginBottom:24}}>
      {cards.map(card=><button key={card.view} onClick={()=>onNavigate(card.view)} style={{aspectRatio:"1.15/1",minHeight:145,border:"1.5px solid #E2E8F0",borderRadius:17,background:"#fff",padding:17,textAlign:"left",cursor:"pointer",boxShadow:"0 5px 18px rgba(15,23,42,.05)",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <span style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:card.color+"15",color:card.color}}><Icon name={card.icon} size={20}/></span>
        <span><span style={{display:"block",fontSize:card.value===""?15:25,fontWeight:850,color:card.color}}>{card.value===""?card.label:card.value}</span><span style={{display:"block",fontSize:12,fontWeight:800,color:"#1E293B",marginTop:2}}>{card.value===""?"":card.label}</span><span style={{display:"block",fontSize:10,color:"#94A3B8",marginTop:3}}>{card.desc}</span></span>
      </button>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:16}}><div style={{fontWeight:800,fontSize:13,marginBottom:10}}>Yaklaşan Çalışma Planları</div>{plans.slice(0,4).map(plan=>{const p=state.projects.find(x=>x.id===plan.projectId);const remote=plan.workType==="remote";return <div key={plan.id} style={{display:"flex",gap:9,alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}><span style={{width:8,height:8,borderRadius:"50%",background:remote?"#7C3AED":p?.color||"#4A6CF7"}}/><div style={{flex:1}}><div style={{fontSize:11,fontWeight:700}}>{p?.name||"Proje"}</div><div style={{fontSize:10,color:"#94A3B8"}}>{remote?"Uzaktan":"Saha"} · {fmt(plan.date)} · {plan.startTime}</div></div></div>})}{!plans.length&&<div style={{fontSize:12,color:"#94A3B8"}}>Yaklaşan çalışma planı yok.</div>}</div>
      <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:16}}><div style={{fontWeight:800,fontSize:13,marginBottom:10}}>Projelerim</div>{myProjects.slice(0,4).map(p=><button key={p.id} onClick={()=>onOpenProject(p.id)} style={{width:"100%",display:"flex",gap:9,alignItems:"center",padding:"9px 0",border:0,borderBottom:"1px solid #F1F5F9",background:"transparent",cursor:"pointer",textAlign:"left"}}><span style={{width:8,height:8,borderRadius:"50%",background:p.color}}/><span style={{fontSize:11,fontWeight:700}}>{p.name}</span></button>)}{!myProjects.length&&<div style={{fontSize:12,color:"#94A3B8"}}>Atanmış proje yok.</div>}</div>
      <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:16}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><div style={{fontWeight:800,fontSize:13}}>Yaklaşan To-Do'larım</div><button onClick={()=>onNavigate("todos")} style={{border:0,background:"#FDF2F8",color:"#BE185D",borderRadius:7,padding:"5px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>Tümünü aç</button></div>{upcomingTodos.slice(0,5).map(todo=>{const project=state.projects.find(item=>item.id===todo.projectId);const late=todo.dueDate&&daysDiff(todo.dueDate)>0;return <button key={todo.id} onClick={()=>onNavigate("todos")} style={{width:"100%",border:0,borderBottom:"1px solid #F1F5F9",background:"transparent",padding:"8px 0",textAlign:"left",cursor:"pointer",display:"flex",gap:8,alignItems:"flex-start"}}><span style={{width:7,height:7,borderRadius:"50%",background:late?"#E11D48":"#DB2777",marginTop:4,flexShrink:0}}/><span style={{minWidth:0,flex:1}}><b style={{display:"block",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{todo.action||todo.text}</b><span style={{display:"block",fontSize:9,color:late?"#E11D48":"#94A3B8",marginTop:2}}>{project?.name||todo.customer||"Genel"}{todo.dueDate?` · ${fmt(todo.dueDate)}`:""}{late?` · ${daysDiff(todo.dueDate)} gün gecikti`:""}</span></span></button>})}{!upcomingTodos.length&&<div style={{fontSize:12,color:"#94A3B8"}}>Açık To-Do bulunmuyor.</div>}</div>
    </div>
    {quick==="todo"&&<QuickTodoModal projects={state.projects} onClose={()=>setQuick(null)} onSave={saveQuickTodo}/>}
    {quick==="action"&&<QuickActionModal projects={state.projects} actionTags={DEFAULT_ACTION_TAGS} onClose={()=>setQuick(null)} onSave={saveQuickAction}/>}
  </div>;
}

export function MobileHomePage({state,setState,currentUser,myProjects,deadlineWarnings,onNavigate,onOpenProject}) {
  const [quick,setQuick]=useState(null);
  const dailyKey=`corject_daily_flow_${currentUser.id}_${todayStr()}`;
  const [showDailySummary,setShowDailySummary]=useState(()=>{try{return localStorage.getItem(dailyKey)!=="dismissed";}catch{return true;}});
  const todos=((state.userNotes||{})[currentUser.id]?.todos||[]).filter(todo=>!todo.done).sort((a,b)=>String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
  const plans=(state.fieldPlans||[]).filter(plan=>plan.userId===currentUser.id&&plan.date>=todayStr()).sort((a,b)=>`${a.date} ${a.startTime||""}`.localeCompare(`${b.date} ${b.startTime||""}`)).slice(0,5);
  const tickets=Object.entries(state.projectTickets||{}).flatMap(([projectId,list])=>(list||[]).map(ticket=>({ticket,project:state.projects.find(item=>item.id===projectId)}))).filter(({ticket})=>ticket.assignedTo===currentUser.id||ticket.author===currentUser.name).slice(0,5);
  const actions=Object.entries(state.projectActions||{}).flatMap(([projectId,list])=>(list||[]).map(action=>({action,project:state.projects.find(item=>item.id===projectId)}))).sort((a,b)=>String(b.action.actionAt||b.action.createdAt||"").localeCompare(String(a.action.actionAt||a.action.createdAt||""))).slice(0,8);
  const saveQuickTodo=(data)=>{
    const todo={id:uid(),customer:data.customer||"",projectId:data.projectId||"",dueDate:data.dueDate||"",action:data.action,text:data.action,done:false,createdAt:now()};
    setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...((current.userNotes||{})[currentUser.id]||{}),todos:[...(((current.userNotes||{})[currentUser.id]?.todos)||[]),todo]}}}));
    setQuick(null);
  };
  const saveQuickAction=(data)=>{
    if(!data.projectId)return;
    const action={id:uid(),tag:data.tag||"Takip",text:data.text,effortHours:parseFloat(data.effortHours)||0,actionAt:now(),createdAt:now(),authorId:currentUser.id,authorName:currentUser.name};
    setState(current=>({...current,projectActions:{...(current.projectActions||{}),[data.projectId]:[action,...(((current.projectActions||{})[data.projectId])||[])]}}));
    setQuick(null);
    onOpenProject(data.projectId);
  };
  const closeDailySummary=()=>{try{localStorage.setItem(dailyKey,"dismissed");}catch{}setShowDailySummary(false);};
  const todayPlans=plans.filter(plan=>plan.date===todayStr());
  const overdueTodos=todos.filter(todo=>todo.dueDate&&daysDiff(todo.dueDate)>0);
  const urgentTodos=todos.filter(todo=>todo.dueDate&&!overdueTodos.includes(todo)&&daysDiff(todo.dueDate)>=-2);
  const dailyLines=[
    todayPlans.length?`Bugün ${todayPlans.length} çalışma planınız var.`:plans.length?`Yaklaşan ilk planınız ${fmt(plans[0].date)} tarihinde.`:"Bugün planlı saha/uzaktan çalışma görünmüyor.",
    overdueTodos.length?`${overdueTodos.length} To-Do gecikmiş; önce bunlara bakmak iyi olur.`:urgentTodos.length?`${urgentTodos.length} To-Do yakın terminli.`:"Acil To-Do görünmüyor.",
    deadlineWarnings.length?`${deadlineWarnings.length} termin uyarısı takip bekliyor.`:"Termin tarafı sakin görünüyor.",
  ];
  const storyItems=[
    {id:"todo",label:"To-Do",value:todos.length,color:"#DB2777",icon:"ticket",action:()=>onNavigate("todos")},
    {id:"plan",label:"Plan",value:plans.length,color:"#0F766E",icon:"calendar",action:()=>onNavigate("fieldops")},
    {id:"late",label:"Termin",value:deadlineWarnings.length,color:"#E11D48",icon:"clock",action:()=>onNavigate("deadlines")},
    {id:"ticket",label:"Ticket",value:tickets.length,color:"#EA6C00",icon:"ticket",action:()=>onNavigate("tickets")},
    {id:"ai",label:"AI",value:"",color:"#7C3AED",icon:"activity",action:()=>onNavigate("ai")},
    {id:"modules",label:"Modüller",value:"",color:"#0369A1",icon:"reports",action:()=>onNavigate("reports")},
  ];
  return <div style={{minHeight:"100%",background:"linear-gradient(180deg,#F8FAFC 0%,#EEF2FF 100%)",padding:"12px 13px 92px",overflow:"auto"}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9,padding:"4px 0 14px"}}>
      {storyItems.map(item=><button key={item.id} onClick={item.action} style={{border:"1px solid #E2E8F0",background:"#fff",borderRadius:18,padding:"10px 7px",cursor:"pointer",textAlign:"center",minWidth:0,boxShadow:"0 6px 16px rgba(15,23,42,.04)"}}>
        <span style={{width:46,height:42,borderRadius:14,display:"grid",placeItems:"center",margin:"0 auto 7px",background:item.color+"14",border:`1px solid ${item.color}24`,color:item.color,position:"relative"}}>
          <Icon name={item.icon} size={22}/>{item.value!==""&&<b style={{position:"absolute",right:5,top:5,minWidth:18,height:18,borderRadius:9,display:"grid",placeItems:"center",background:item.color,color:"#fff",fontSize:9,border:"2px solid #fff"}}>{item.value}</b>}
        </span>
        <span style={{fontSize:10,fontWeight:900,color:"#475569",whiteSpace:"nowrap"}}>{item.label}</span>
      </button>)}
    </div>
    {showDailySummary&&<div style={{background:"linear-gradient(135deg,#EFF6FF,#F5F3FF)",border:"1px solid #DBEAFE",borderRadius:24,padding:18,color:"#172033",boxShadow:"0 18px 40px rgba(67,56,202,.12)",marginBottom:13}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}><span style={{width:42,height:42,borderRadius:15,background:"#EEF2FF",color:"#4338CA",display:"grid",placeItems:"center",flexShrink:0}}><Icon name="activity" size={20}/></span><div style={{flex:1}}><div style={{fontSize:11,color:"#4F46E5",fontWeight:900}}>AI · Bugünün Akışı</div><h2 style={{margin:"2px 0 6px",fontSize:18,color:"#111827"}}>Merhaba, {currentUser.name.split(" ")[0]}</h2><div style={{display:"grid",gap:5}}>{dailyLines.map(line=><div key={line} style={{fontSize:12,color:"#475569",lineHeight:1.45}}>• {line}</div>)}</div></div><button onClick={closeDailySummary} style={{border:0,background:"#fff",borderRadius:10,width:30,height:30,cursor:"pointer",color:"#64748B",fontWeight:900}}>×</button></div>
    </div>}
    <MobileFeedCard title="To-Do" actionLabel="Tümü" onAction={()=>onNavigate("todos")}>
      {todos.slice(0,4).map(todo=><MobileFeedRow key={todo.id} color={todo.dueDate&&daysDiff(todo.dueDate)>0?"#E11D48":"#DB2777"} icon="ticket" title={todo.action||todo.text} meta={`${todo.customer||state.projects.find(item=>item.id===todo.projectId)?.name||"Genel"}${todo.dueDate?` · ${fmt(todo.dueDate)}`:""}`} onClick={()=>onNavigate("todos")}/>)}
      {!todos.length&&<EmptyMobileRow text="Açık To-Do yok."/>}
    </MobileFeedCard>
    <MobileFeedCard title="Yaklaşan Planlar" actionLabel="Tümü" onAction={()=>onNavigate("fieldops")}>
      {plans.map(plan=>{const project=state.projects.find(item=>item.id===plan.projectId);const dayName=plan.date?new Date(plan.date).toLocaleDateString("tr-TR",{weekday:"long"}):"";return <MobileFeedRow key={plan.id} color={plan.workType==="remote"?"#7C3AED":project?.color||"#0F766E"} icon="calendar" title={project?.name||"Plan"} meta={`${dayName?`${dayName} · `:""}${fmt(plan.date)} · ${plan.startTime||""} - ${plan.endTime||""}`} onClick={()=>onNavigate("fieldops")}/>;})}
      {!plans.length&&<EmptyMobileRow text="Yaklaşan saha/uzaktan çalışma yok."/>}
    </MobileFeedCard>
    <MobileFeedCard title="Son Aksiyonlar" actionLabel="Tümü" onAction={()=>onNavigate("projects")}>
      {actions.slice(0,4).map(({action,project})=><MobileFeedRow key={action.id} color={project?.color||"#4A6CF7"} icon="activity" title={action.text||"Aksiyon"} meta={`${project?.name||"Proje"} · ${action.authorName||""}`} onClick={()=>project&&onOpenProject(project.id)}/>)}
      {!actions.length&&<EmptyMobileRow text="Henüz aksiyon kaydı yok."/>}
    </MobileFeedCard>
    <MobileFeedCard title="Projeler" actionLabel="Tümü" onAction={()=>onNavigate("projects")}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        {myProjects.slice(0,4).map(project=>{const total=project.milestones.reduce((sum,ms)=>sum+ms.tasks.length,0);const done=project.milestones.reduce((sum,ms)=>sum+ms.tasks.filter(task=>task.status==="Tamamlandı").length,0);const progress=total?Math.round(done/total*100):0;return <button key={project.id} onClick={()=>onOpenProject(project.id)} style={{border:0,borderRadius:16,background:"#F8FAFC",padding:12,textAlign:"left",cursor:"pointer"}}>
          <span style={{width:28,height:28,borderRadius:10,background:project.color+"18",color:project.color,display:"grid",placeItems:"center",marginBottom:10}}><Icon name="projects" size={15}/></span>
          <b style={{display:"block",fontSize:12,lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{project.name}</b>
          <span style={{display:"block",fontSize:10,color:"#94A3B8",marginTop:3}}>%{progress} ilerleme</span>
          <span style={{display:"block",height:5,background:"#E2E8F0",borderRadius:8,overflow:"hidden",marginTop:8}}><i style={{display:"block",height:"100%",width:`${progress}%`,background:project.color}}/></span>
        </button>;})}
      </div>
      {!myProjects.length&&<EmptyMobileRow text="Atanmış proje yok."/>}
    </MobileFeedCard>
    {quick==="todo"&&<QuickTodoModal projects={state.projects} onClose={()=>setQuick(null)} onSave={saveQuickTodo}/>}
    {quick==="action"&&<QuickActionModal projects={state.projects} actionTags={DEFAULT_ACTION_TAGS} onClose={()=>setQuick(null)} onSave={saveQuickAction}/>}
  </div>;
}

