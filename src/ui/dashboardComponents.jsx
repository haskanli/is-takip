import { useState } from "react";
import { readinessScore } from "../appData.js";
import { visibleTicketsForUser } from "../customerAccess.js";
import { commissioningMachines } from "../domain/projectHelpers.js";
import { Icon } from "./primitives.jsx";
import { daysDiff } from "./status.jsx";
import { EmptyMobileRow, MobileFeedCard, MobileFeedRow, QuickActionModal, QuickTodoModal } from "./mobileComponents.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const DEFAULT_ACTION_TAGS = ["Takip", "Toplant?", "Telefon/G?r??me", "Yaz??ma", "Sistem Kontrol?", "Saha Ziyareti", "E?itim"];

const customerDisplayName = (project = {}) =>
  project.customerProfile?.name || project.customerName || project.name || "Proje";

const customerLogo = (project = {}) => project.customerProfile?.logoUrl || project.logoUrl || "";
const customerWebsite = (project = {}) => project.customerProfile?.website || project.website || "";
const customerAccent = (project = {}) => project.customerProfile?.accentColor || project.color || "#4A6CF7";

export function CustomerDashboardPage({ state, currentUser, projects = [], onNavigate, onOpenProject }) {
  const projectSummaries = projects.map((project) => {
    const tasks = (project.milestones || []).flatMap((milestone) => milestone.tasks || []);
    const doneTasks = tasks.filter((task) => task.status === "Tamamlandı").length;
    const progress = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;
    const overdue = tasks.filter((task) => task.dueDate && task.status !== "Tamamlandı" && daysDiff(task.dueDate) > 0).length;
    const visibleTickets = visibleTicketsForUser((state.projectTickets || {})[project.id] || [], {
      ...currentUser,
      customerId: currentUser?.customerId || project.id,
      userType: "customer",
    });
    const openTickets = visibleTickets.filter((ticket) => !["Tamamlandı", "İptal edildi", "Done"].includes(ticket.status)).length;
    const machines = project.commissioningTracking ? commissioningMachines(project.commissioningTree || []) : project.machines || [];
    const commissioned = machines.filter((machine) => machine.commissioned).length;
    const trainings = project.trainings || [];
    const raciCount = (project.raciContacts || project.customerContacts || []).length;
    const activeMilestone = (project.milestones || []).find((milestone) =>
      (milestone.tasks || []).some((task) => task.status !== "Tamamlandı"),
    ) || (project.milestones || [])[0];
    return {
      project,
      tasks,
      doneTasks,
      progress,
      overdue,
      visibleTickets,
      openTickets,
      machines,
      commissioned,
      trainings,
      raciCount,
      activeMilestone,
      readiness: readinessScore(project),
      accent: customerAccent(project),
      logo: customerLogo(project),
      website: customerWebsite(project),
      customerName: customerDisplayName(project),
    };
  });

  const totalTasks = projectSummaries.reduce((sum, item) => sum + item.tasks.length, 0);
  const doneTasks = projectSummaries.reduce((sum, item) => sum + item.doneTasks, 0);
  const averageProgress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const totalTickets = projectSummaries.reduce((sum, item) => sum + item.visibleTickets.length, 0);
  const openTickets = projectSummaries.reduce((sum, item) => sum + item.openTickets, 0);
  const totalOverdue = projectSummaries.reduce((sum, item) => sum + item.overdue, 0);
  const averageReadiness = projectSummaries.length
    ? Math.round(projectSummaries.reduce((sum, item) => sum + item.readiness, 0) / projectSummaries.length)
    : 0;

  if (!projectSummaries.length) {
    return <div style={{ flex: 1, overflow: "auto", padding: "clamp(18px,4vw,34px)", background: "#F8FAFC" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 24, padding: 26, boxShadow: "0 18px 45px rgba(15,23,42,.06)" }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, background: "#EEF2FF", color: "#4A6CF7", display: "grid", placeItems: "center", marginBottom: 14 }}><Icon name="projects" size={25} /></div>
        <h2 style={{ margin: 0, fontSize: 24 }}>Proje özeti hazırlanıyor</h2>
        <p style={{ margin: "8px 0 0", color: "#64748B", lineHeight: 1.55 }}>Hesabınıza bağlı görüntülenebilir proje bulunamadı. Proje erişimi tanımlandığında burada yalnızca size ait proje raporu görünecek.</p>
      </div>
    </div>;
  }

  return <div style={{ flex: 1, overflow: "auto", padding: "clamp(16px,4vw,34px)", background: "linear-gradient(180deg,#F8FAFC 0%,#EEF2FF 100%)" }}>
    <div style={{ maxWidth: 1160, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #C7D2FE", background: "#EEF2FF", color: "#4338CA", borderRadius: 999, padding: "7px 11px", fontSize: 11, fontWeight: 900, marginBottom: 10 }}>
            <Icon name="reports" size={14} /> Müşteri Proje Özeti
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(24px,4vw,38px)", letterSpacing: "-.04em", color: "#111827" }}>Proje durum raporu</h1>
          <p style={{ margin: "8px 0 0", color: "#64748B", fontSize: 14, lineHeight: 1.55, maxWidth: 680 }}>Bu ekranda size ait proje planı, sağlık skoru, eğitim/RACI, makineler ve görünür ticketların güncel özeti yer alır.</p>
        </div>
        <div style={{display:"flex",gap:9,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button onClick={() => onNavigate?.("tickets")} style={{ border: 0, borderRadius: 14, background: "linear-gradient(135deg,#4A6CF7,#7C3AED)", color: "#fff", padding: "12px 15px", fontWeight: 900, cursor: "pointer", boxShadow: "0 14px 30px rgba(79,70,229,.22)" }}>+ Yeni Ticket Aç</button>
          <button onClick={() => onNavigate?.("tickets")} style={{ border: "1px solid #E2E8F0", borderRadius: 14, background: "#fff", color: "#334155", padding: "12px 15px", fontWeight: 900, cursor: "pointer" }}>Ticketları Gör</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        {[
          ["Genel İlerleme", `%${averageProgress}`, `${doneTasks}/${totalTasks} görev tamamlandı`, "#4A6CF7"],
          ["Proje Sağlığı", averageReadiness ? `%${averageReadiness}` : "-", "Hazırlık skoru", "#059669"],
          ["Açık Ticket", openTickets, `${totalTickets} görünür ticket`, "#EA6C00"],
          ["Geciken İş", totalOverdue, "Müşteri görünür plan", "#E11D48"],
        ].map(([label, value, desc, color]) => <div key={label} style={{ background: "#fff", border: "1px solid #E2E8F0", borderTop: `4px solid ${color}`, borderRadius: 18, padding: 16, boxShadow: "0 10px 26px rgba(15,23,42,.05)", minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 950, color: "#64748B", letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</div>
          <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 950, color, marginTop: 7 }}>{value}</div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4, overflowWrap: "anywhere" }}>{desc}</div>
        </div>)}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {projectSummaries.map((item) => <section key={item.project.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 24, overflow: "hidden", boxShadow: "0 18px 45px rgba(15,23,42,.07)" }}>
          <div style={{ background: `linear-gradient(135deg,${item.accent} 0%,#111827 120%)`, color: "#fff", padding: "18px clamp(16px,3vw,24px)", display: "flex", gap: 15, alignItems: "center", minWidth: 0 }}>
            <div style={{ width: 58, height: 58, borderRadius: 18, background: "rgba(255,255,255,.95)", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}>
              {item.logo ? <img src={item.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} /> : <b style={{ color: item.accent, fontSize: 22 }}>{item.customerName.slice(0, 1)}</b>}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ margin: 0, color: "#fff", fontSize: "clamp(20px,3vw,28px)", overflowWrap: "anywhere" }}>{item.customerName}</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.82)" }}>
                <span>{item.project.name}</span>
                <span>{fmt(item.project.startDate)} - {fmt(item.project.endDate)}</span>
                {item.website && <a href={item.website.startsWith("http") ? item.website : `https://${item.website}`} target="_blank" rel="noreferrer" style={{ color: "#fff", fontWeight: 850 }}>Web sitesi</a>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 30, fontWeight: 950 }}>%{item.progress}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.76)" }}>tamamlanma</div>
            </div>
          </div>
          <div style={{ padding: "18px clamp(16px,3vw,24px)" }}>
            <div style={{ height: 9, borderRadius: 999, background: "#E2E8F0", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ height: "100%", width: `${item.progress}%`, background: `linear-gradient(90deg,${item.accent},#22D3EE)`, borderRadius: 999 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
              <CustomerMetric title="Proje Planı" value={`${item.doneTasks}/${item.tasks.length}`} desc={item.activeMilestone ? `Aktif: ${item.activeMilestone.name}` : "Milestone bulunmuyor"} icon="tasks" color={item.accent} />
              <CustomerMetric title="Proje Sağlığı" value={`%${item.readiness}`} desc={item.readiness >= 80 ? "Başlamaya uygun" : "Hazırlık takibi gerekli"} icon="activity" color={item.readiness >= 80 ? "#059669" : "#EA6C00"} />
              <CustomerMetric title="Ticketlar" value={item.openTickets} desc={`${item.visibleTickets.length} müşteri görünür ticket`} icon="ticket" color="#EA6C00" />
              <CustomerMetric title="Makineler" value={`${item.commissioned}/${item.machines.length}`} desc="Devreye alma durumu" icon="projects" color="#0F766E" />
              <CustomerMetric title="Eğitimler" value={item.trainings.length} desc="Kayıtlı eğitim" icon="people" color="#7C3AED" />
              <CustomerMetric title="RACI / Kontak" value={item.raciCount} desc="Tanımlı sorumlu ve kontak" icon="people" color="#0369A1" />
            </div>
            {item.overdue > 0 && <div style={{ marginTop: 13, border: "1px solid #FECACA", background: "#FFF1F2", color: "#BE123C", borderRadius: 14, padding: "10px 12px", fontSize: 12, fontWeight: 800 }}>{item.overdue} geciken iş takip bekliyor.</div>}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
              <button onClick={()=>onOpenProject?.(item.project.id)} style={{border:0,borderRadius:13,background:item.accent,color:"#fff",padding:"10px 13px",fontSize:12,fontWeight:900,cursor:"pointer",boxShadow:"0 10px 22px rgba(15,23,42,.12)"}}>Proje detaylarını gör</button>
              <button onClick={()=>onNavigate?.("tickets")} style={{border:"1px solid #E2E8F0",borderRadius:13,background:"#fff",color:"#334155",padding:"10px 13px",fontSize:12,fontWeight:900,cursor:"pointer"}}>Ticketları aç</button>
            </div>
          </div>
        </section>)}
      </div>
    </div>
  </div>;
}

function CustomerMetric({ title, value, desc, icon, color }) {
  return <div style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", borderRadius: 16, padding: 14, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      <span style={{ width: 34, height: 34, borderRadius: 12, background: `${color}16`, color, display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name={icon} size={17} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "#64748B", fontWeight: 950, letterSpacing: ".06em", textTransform: "uppercase" }}>{title}</div>
        <div style={{ fontSize: 23, fontWeight: 950, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
    <div style={{ marginTop: 8, color: "#64748B", fontSize: 11, lineHeight: 1.4, overflowWrap: "anywhere" }}>{desc}</div>
  </div>;
}

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
