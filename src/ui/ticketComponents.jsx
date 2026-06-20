import { useEffect, useState } from "react";
import { getJiraIssue } from "../jira";
import { createTicketWithNotification, notifyTicketAssignment } from "../email";
import { DEFAULT_ACTIVE_MODULES } from "../appData.js";
import { isCustomerUser, visibleTicketsForUser } from "../customerAccess.js";
import { nextTicketNumber, projectResponsibleIds, ticketNumber } from "../domain/projectHelpers.js";
import { MultiChoiceFilter } from "./formControls.jsx";
import { Btn, Field, Icon, Modal, iStyle } from "./primitives.jsx";
import { daysDiff } from "./status.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();

export const TICKET_STATUSES = ["A\u00e7\u0131k","Operasyon \u0130ncelemesinde","\u00dcr\u00fcn De\u011ferlendirmesinde","Jira'da \u00c7al\u0131\u015f\u0131l\u0131yor","Operasyon Testinde","Test Ba\u015far\u0131s\u0131z","Yay\u0131na Haz\u0131r","M\u00fc\u015fteri Onay\u0131nda","M\u00fc\u015fteri Reddetti","Tamamland\u0131","Beklemede","\u0130ptal Edildi"];
export const TICKET_CATEGORIES = ["Operasyonel","Bug","Geli\u015ftirme","Entegrasyon","\u0130yile\u015ftirme","Veri","E\u011fitim","Di\u011fer"];

const normalizeTicketText=(value="")=>String(value||"")
  .toLocaleLowerCase("tr-TR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[^\w\s]/g," ");

const ticketToneClass=(value="")=>{
  const text=normalizeTicketText(value);
  if(["tamam","done","resolved","yayina hazir","basarili"].some(item=>text.includes(item))&&!["basarisiz","fail"].some(item=>text.includes(item)))return "ui-chip-success";
  if(["kritik","yuksek","basarisiz","redd","iptal","cancel","fail"].some(item=>text.includes(item)))return "ui-chip-danger";
  if(["bekle","devam","jira","test","inceleme","degerlendirme","operasyon","urun"].some(item=>text.includes(item)))return "ui-chip-warning";
  if(["acik","bug","gelistirme","entegrasyon","iyilestirme","veri","egitim"].some(item=>text.includes(item)))return "ui-chip-accent";
  return "ui-chip-muted";
};

const ticketChangeLog=(ticket,data,user)=>{
  const labels={status:"Durum",assignedTo:"Sorumlu",jiraKey:"Jira",jiraStatus:"Jira durumu",testResult:"Test sonucu",category:"Kategori",ownerTeam:"Sahip ekip"};
  return Object.entries(labels).flatMap(([key,label])=>{
    if(data[key]===undefined||String(data[key]??"")===String(ticket?.[key]??""))return [];
    return [{id:uid(),ts:now(),userId:user.id,userName:user.name,field:key,label,from:ticket?.[key]||"-",to:data[key]||"-"}];
  });
};
const ticketWorkflowFromJira=(status="")=>{
  const value=status.toLocaleLowerCase("tr-TR");
  if(value.includes("ready to release")||value.includes("yay\u0131na haz\u0131r"))return {status:"Yay\u0131na Haz\u0131r",ownerTeam:"\u00dcr\u00fcn"};
  if(["done","closed","resolved","tamamland\u0131"].some(item=>value.includes(item)))return {status:"Tamamland\u0131",ownerTeam:"\u00dcr\u00fcn"};
  if(value.includes("test"))return {status:"Operasyon Testinde",ownerTeam:"Operasyon",testResult:"Bekliyor"};
  return {status:"Jira'da \u00c7al\u0131\u015f\u0131l\u0131yor",ownerTeam:"\u00dcr\u00fcn"};
};
const applyTicketWorkflow=(data)=>{
  if(data.testResult==="Ba\u015far\u0131s\u0131z")return {...data,status:"Test Ba\u015far\u0131s\u0131z",ownerTeam:"\u00dcr\u00fcn"};
  if(data.testResult==="Ba\u015far\u0131l\u0131")return {...data,status:"Yay\u0131na Haz\u0131r",ownerTeam:"\u00dcr\u00fcn"};
  if(data.jiraStatus)return {...data,...ticketWorkflowFromJira(data.jiraStatus)};
  return data;
};

function TicketListTable({ rows, people = [], customerMode = false, showProject = true, onOpen, onStatusChange, onDelete, canDelete = () => false }) {
  return (
    <div className="soft-panel data-list-shell" style={{ padding: 10 }}>
      <table className="data-list-table">
        <thead>
          <tr>
            <th>No</th>
            <th>{"Ba\u015fl\u0131k"}</th>
            {showProject && <th>Proje</th>}
            <th>Durum</th>
            {!customerMode && <th>Sorumlu</th>}
            <th>{"Ya\u015f"}</th>
            <th>Jira</th>
            <th>Son Aksiyon</th>
            {!customerMode && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ticket, project, projectId }) => {
            const assignee = people.find((person) => person.id === ticket.assignedTo);
            const age = Math.max(0, daysDiff(ticket.ts));
            return (
              <tr key={`${projectId || project?.id || "project"}-${ticket.id}`} onClick={() => onOpen?.({ ticket, project, projectId })}>
                <td><span className="ui-chip ui-chip-accent">{ticketNumber(ticket)}</span></td>
                <td>
                  <b className="text-wrap-safe" style={{ display: "block", fontSize: 12.5, color: "var(--text, #112327)" }}>{ticket.title}</b>
                  {ticket.description && <span className="text-wrap-safe" style={{ display: "block", marginTop: 3, color: "var(--muted, #5b6f74)" }}>{ticket.description}</span>}
                </td>
                {showProject && <td><span className="ui-chip ui-chip-muted">{project?.name || "Proje yok"}</span></td>}
                <td>
                  {customerMode ? (
                    <span className={`ui-chip ${ticketToneClass(ticket.status || "A\u00e7\u0131k")}`}>{ticket.status || "A\u00e7\u0131k"}</span>
                  ) : (
                    <select
                      value={ticket.status || "A\u00e7\u0131k"}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onStatusChange?.(projectId, ticket.id, event.target.value)}
                      style={{ fontSize: 11, borderRadius: 10, border: "1px solid var(--border, #cfe0e3)", padding: "4px 7px", fontFamily: "inherit", background: "rgb(255 255 255 / 78%)", color: "var(--text, #112327)" }}
                    >
                      {!TICKET_STATUSES.includes(ticket.status) && ticket.status && <option>{ticket.status}</option>}
                      {TICKET_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  )}
                </td>
                {!customerMode && <td>{assignee?.name || "Atanmam\u0131\u015f"}</td>}
                <td><span style={{ color: age >= 7 ? "var(--danger, #b93f33)" : "var(--muted, #5b6f74)", fontWeight: 800 }}>{age} {"g\u00fcn"}</span></td>
                <td>{ticket.jiraStatus || ticket.jiraKey || "-"}</td>
                <td>{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleDateString("tr-TR") : "Yok"}</td>
                {!customerMode && (
                  <td>
                    {canDelete(ticket) && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete?.(projectId, ticket.id);
                        }}
                        style={{ border: 0, background: "transparent", color: "var(--danger, #b93f33)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                      >
                        Sil
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TicketsPage({
  state,
  setState,
  currentUser,
  isAdmin,
  customerMode: forcedCustomerMode=false,
  customerProjects,
  initialMine=false,
  initialProjectId="",
  initialTicketId="",
  activeTab: controlledActiveTab,
  onActiveTabChange,
  projectFilters: controlledProjectFilters,
  onProjectFiltersChange,
  statusFilters: controlledStatusFilters,
  onStatusFiltersChange,
  search: controlledSearch,
  onSearchChange,
  mineOnly: controlledMineOnly,
  onMineOnlyChange,
  onTicketOpened,
  generateTicketStatusReport,
}){
  const linkedProject=initialProjectId||"";
  const linkedTicket=initialTicketId||"";
  const linkedTicketData=linkedProject&&linkedTicket?((state.projectTickets||{})[linkedProject]||[]).find(ticket=>ticket.id===linkedTicket):null;
  const [localActiveTab,setLocalActiveTab]=useState("tickets");
  const [localProjectFilters,setLocalProjectFilters]=useState(linkedProject?[linkedProject]:[]);
  const [localStatusFilters,setLocalStatusFilters]=useState([]);
  const [localSearch,setLocalSearch]=useState("");
  const [mailNotice,setMailNotice]=useState("");
  const [localMineOnly,setLocalMineOnly]=useState(initialMine);
  const [modal,setModal]=useState(linkedTicketData?{type:"detail",projectId:linkedProject,data:linkedTicketData}:null);
  const [ticketView,setTicketView]=useState("cards");
  const activeTab=controlledActiveTab??localActiveTab;
  const setActiveTab=onActiveTabChange||setLocalActiveTab;
  const projectFilters=controlledProjectFilters??localProjectFilters;
  const setProjectFilters=onProjectFiltersChange||setLocalProjectFilters;
  const statusFilters=controlledStatusFilters??localStatusFilters;
  const setStatusFilters=onStatusFiltersChange||setLocalStatusFilters;
  const search=controlledSearch??localSearch;
  const setSearch=onSearchChange||setLocalSearch;
  const mineOnly=controlledMineOnly??localMineOnly;
  const setMineOnly=onMineOnlyChange||setLocalMineOnly;
  const customerMode=Boolean(forcedCustomerMode||isCustomerUser(currentUser));
  const baseProjects=state.projects||[];
  const customerProjectList=customerMode
    ? (customerProjects?.length?customerProjects:baseProjects.filter(project=>project.id===currentUser?.customerId||project.customerId===currentUser?.customerId))
    : baseProjects;
  const effectiveCustomerId=customerProjectList[0]?.id||currentUser?.customerId||"";
  const effectiveCustomerUser=customerMode?{...currentUser,userType:"customer",roleKey:"customer_viewer",customerId:currentUser?.customerId||effectiveCustomerId}:currentUser;
  const TYPES=["Bug","Görev","İyileştirme","Soru","Bilgi"];
  const PRIOS=["Düşük","Orta","Yüksek","Kritik"];
  const all=customerProjectList.flatMap(project=>{
    const projectId=project.id;
    return visibleTicketsForUser((state.projectTickets||{})[projectId]||[],effectiveCustomerUser).map(ticket=>({ticket,projectId,project}));
  });
  const filtered=all.filter(({ticket,projectId,project})=>{
    const haystack=`${ticket.ticketNo||""} ${ticket.title||""} ${ticket.description||""} ${project?.name||""} ${state.people.find(p=>p.id===ticket.assignedTo)?.name||""}`.toLocaleLowerCase("tr-TR");
    if(customerMode)return !search.trim()||haystack.includes(search.trim().toLocaleLowerCase("tr-TR"));
    return (!projectFilters.length||projectFilters.includes(projectId))&&(!statusFilters.length||statusFilters.includes(ticket.status))&&(!mineOnly||ticket.assignedTo===currentUser.id||ticket.author===currentUser.name)&&(!search.trim()||haystack.includes(search.trim().toLocaleLowerCase("tr-TR")));
  });
  useEffect(()=>{
    if(!linkedProject||!linkedTicket)return;
    const ticket=((state.projectTickets||{})[linkedProject]||[]).find(item=>item.id===linkedTicket);
    if(!ticket)return;
    setProjectFilters(current=>current.includes(linkedProject)?current:[linkedProject]);
    setModal({type:"detail",projectId:linkedProject,data:ticket});
    onTicketOpened?.();
  },[linkedProject,linkedTicket,state.projectTickets,onTicketOpened]);
  const save=(projectId,tickets)=>setState(s=>({...s,projectTickets:{...(s.projectTickets||{}),[projectId]:tickets}}));
  const add=async(projectId,data)=>{
    const createdAt=now();
    const project=customerProjectList.find(item=>item.id===projectId)||state.projects.find(item=>item.id===projectId);
    const customerTicket=customerMode;
    const pmIds=projectResponsibleIds(project);
    const ticket={id:uid(),ticketNo:nextTicketNumber(state),ts:createdAt,updatedAt:createdAt,author:currentUser.name,createdBy:currentUser.id,source:customerTicket?"customer":"internal",customerVisible:customerTicket?true:Boolean(data.customerVisible),customerId:customerTicket?projectId:data.customerId||project?.customerId||projectId||"",history:[{id:uid(),ts:createdAt,userId:currentUser.id,userName:currentUser.name,label:"Ticket",from:"-",to:"Oluşturuldu"}],...data,assignedTo:customerTicket?(pmIds[0]||""):data.assignedTo||""};
    save(projectId,[...((state.projectTickets||{})[projectId]||[]),ticket]);
    if(customerTicket){
      setState(s=>({...s,notifications:[...pmIds.map(userId=>({id:uid(),ts:now(),userId,msg:`${currentUser.name} müşteri portalından ${ticket.ticketNo} ticketını açtı.`,projectName:project?.name||"",type:"customer_ticket",ticketId:ticket.id,projectId,read:false})),...(s.notifications||[])]}));
    }
    const result=await createTicketWithNotification(projectId,ticket);
    if(result.ticket?.ticketNo)save(projectId,[...((state.projectTickets||{})[projectId]||[]),{...ticket,...result.ticket}]);
    setMailNotice(result.notification?.sent?"Ticket oluşturuldu ve atama maili gönderildi.":`Ticket oluşturuldu; mail gönderilemedi: ${result.notification?.reason||"Bilinmeyen hata"}`);
    return result;
  };
  const update=(projectId,id,data)=>{
    const tickets=(state.projectTickets||{})[projectId]||[];
    const old=tickets.find(t=>t.id===id);
    const workflowData=applyTicketWorkflow(data);
    const ticket={...old,...workflowData,updatedAt:now(),history:[...(old?.history||[]),...ticketChangeLog(old,workflowData,currentUser)]};
    save(projectId,tickets.map(t=>t.id===id?ticket:t));
    if(workflowData.assignedTo&&workflowData.assignedTo!==old?.assignedTo)notifyTicketAssignment(projectId,ticket).catch(error=>console.warn("Ticket maili gönderilemedi",error));
  };
  const remove=(projectId,id)=>save(projectId,((state.projectTickets||{})[projectId]||[]).filter(t=>t.id!==id));
  const sortedFiltered=[...filtered].sort((a,b)=>String(b.ticket.updatedAt||b.ticket.ts||"").localeCompare(String(a.ticket.updatedAt||a.ticket.ts||"")));
  return <div className="theme-work-page tickets-theme-page" style={{padding:"clamp(16px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div className="theme-page-heading unified-page-header tickets-page-header" style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
      <div><h2 style={{margin:0,fontSize:20,display:"flex",alignItems:"center",gap:8,color:"var(--text)"}}><Icon name="ticket" size={20}/>{customerMode?"Destek Taleplerim":"Ticketlar"}</h2><p style={{margin:"3px 0 0",fontSize:12,color:"var(--muted)"}}>{customerMode?"Bu alanda yalnızca kendi projenize ait müşteri talepleri görünür.":`${filtered.length} kayıt gösteriliyor`}</p></div>
      <div className="page-header-actions" style={{display:"flex",gap:7,flexWrap:"wrap"}}>{isAdmin&&!customerMode&&<Btn className="compact-tool-button" variant="secondary" title="Durum raporu" onClick={()=>generateTicketStatusReport(state,state.people)}>Rapor</Btn>}<Btn className="icon-only-action" title="Ticket aç" aria-label="Ticket aç" disabled={customerMode&&!customerProjectList.length} onClick={()=>setModal({type:"add",projectId:customerMode?(customerProjectList[0]?.id||""):(state.projects[0]?.id||"")})}>+</Btn></div>
    </div>
    {!customerMode&&<div className="segmented-control unified-tab-row" style={{display:"inline-flex",marginBottom:14}}>
      {[["tickets","Ticket Takibi"],["recurring","Tekrar Eden Problemler"]].map(([id,label])=><button key={id} className={activeTab===id?"is-active":""} onClick={()=>setActiveTab(id)}>{label}</button>)}
    </div>}
    {(customerMode||activeTab==="tickets")&&<><div className="theme-ticket-toolbar unified-filter-row" style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
      <input style={{...iStyle,width:"auto",minWidth:220,flex:"1 1 220px"}} value={search} onChange={e=>setSearch(e.target.value)} placeholder={customerMode?"Talep ara...":"Ticket, proje veya sorumlu ara..."}/>
      {!customerMode&&<button onClick={()=>setMineOnly(v=>!v)} className={mineOnly?"ui-chip ui-chip-accent":"ui-chip ui-chip-muted"} style={{borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:11}}>{"Ticketlar\u0131m"}</button>}
      {!customerMode&&<MultiChoiceFilter label="Projeler" options={state.projects.map(project=>({value:project.id,label:project.name}))} value={projectFilters} onChange={setProjectFilters}/>}
      {!customerMode&&<MultiChoiceFilter label="Durumlar" options={TICKET_STATUSES.map(status=>({value:status,label:status}))} value={statusFilters} onChange={setStatusFilters}/>}
      <div className="view-switch" role="group" aria-label="Ticket g\u00f6r\u00fcn\u00fcm\u00fc">
        <button type="button" className={ticketView==="cards"?"is-active":""} onClick={()=>setTicketView("cards")}>Kart</button>
        <button type="button" className={ticketView==="list"?"is-active":""} onClick={()=>setTicketView("list")}>Liste</button>
      </div>
    </div>
    {mailNotice&&<div style={{background:mailNotice.includes("gönderildi")?"color-mix(in srgb, var(--success) 10%, white 90%)":"color-mix(in srgb, var(--warning) 10%, white 90%)",color:mailNotice.includes("gönderildi")?"var(--success)":"var(--warning)",borderRadius:10,padding:"10px 13px",fontSize:11,fontWeight:700,marginBottom:12}}>{mailNotice}</div>}
    {ticketView==="list"?<TicketListTable rows={sortedFiltered} people={state.people} customerMode={customerMode} showProject={!customerMode} onOpen={({ticket,projectId})=>setModal({type:"detail",projectId,data:ticket})} onStatusChange={(projectId,id,status)=>update(projectId,id,{status})} onDelete={(projectId,id)=>{if(confirm("Ticket silinsin mi?"))remove(projectId,id);}} canDelete={(ticket)=>isAdmin||ticket.author===currentUser.name}/>:<div className="mobile-ticket-list-grid ticket-card-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(360px,100%),1fr))",gap:10}}>{sortedFiltered.map(({ticket,project,projectId})=>{const age=Math.max(0,daysDiff(ticket.ts));const assignee=state.people.find(p=>p.id===ticket.assignedTo);return <div className="compact-list-card ticket-mobile-card ticket-card" key={`${projectId}-${ticket.id}`} onClick={()=>setModal({type:"detail",projectId,data:ticket})} style={{borderTop:`3px solid ${project?.color||"var(--accent, #0b8a94)"}`,padding:"14px 15px",cursor:"pointer"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><span className="ui-chip ui-chip-accent">{ticketNumber(ticket)}</span><b className="text-wrap-safe" style={{fontSize:13,color:"var(--text, #112327)"}}>{ticket.title}</b>{customerMode?<span className={`ui-chip ${ticketToneClass(ticket.status||"A\u00e7\u0131k")}`}>{ticket.status||"A\u00e7\u0131k"}</span>:<select value={ticket.status||"A\u00e7\u0131k"} onClick={event=>event.stopPropagation()} onChange={event=>update(projectId,ticket.id,{status:event.target.value})} style={{fontSize:10,border:"1px solid var(--border, #cfe0e3)",borderRadius:9,padding:"4px 7px",background:"rgb(255 255 255 / 78%)",color:"var(--text, #112327)"}}>{TICKET_STATUSES.map(status=><option key={status}>{status}</option>)}</select>}{!customerMode&&<span className="ui-chip ui-chip-muted">{project?.name||"Proje yok"}</span>}<span className={`ui-chip ${age>=7?"ui-chip-danger":"ui-chip-muted"}`} style={{marginLeft:"auto",fontSize:11,fontWeight:800}}>{age} {"g\u00fcnd\u00fcr a\u00e7\u0131k"}</span></div>
      <div style={{display:"flex",gap:12,marginTop:7,flexWrap:"wrap",fontSize:11,color:"var(--muted, #5b6f74)"}}>{!customerMode&&<span>Sorumlu: <b style={{color:"var(--text, #112327)"}}>{assignee?.name||"Atanmam\u0131\u015f"}</b></span>}<span>Son aksiyon: {ticket.updatedAt?new Date(ticket.updatedAt).toLocaleDateString("tr-TR"):"Yok"}</span><span>Jira: {ticket.jiraStatus||ticket.jiraKey||"-"}</span>{!customerMode&&(isAdmin||ticket.author===currentUser.name)&&<button onClick={e=>{e.stopPropagation();if(confirm("Ticket silinsin mi?"))remove(projectId,ticket.id);}} style={{marginLeft:"auto",border:0,background:"transparent",color:"var(--danger, #b93f33)",fontSize:11,fontWeight:800,cursor:"pointer"}}>Sil</button>}</div>
    </div>})}</div>}
    {!filtered.length&&<div style={{padding:40,textAlign:"center",background:"#fff",border:"1.5px dashed var(--muted)",borderRadius:12,color:"var(--muted)"}}>Filtreye uygun ticket yok.</div>}
    </>}
    {!customerMode&&activeTab==="recurring"&&<RecurringProblemsPanel entries={all}/>}
    {modal?.type==="add"&&<Modal title="Ticket Ekle" onClose={()=>setModal(null)}>{customerMode?<div style={{marginBottom:12,padding:"10px 12px",borderRadius:12,background:"var(--accent-ink)",color:"var(--accent)",fontSize:12,fontWeight:850}}>Proje: {customerProjectList.find(p=>p.id===modal.projectId)?.name||customerProjectList[0]?.name||"Müşteri projesi"}</div>:<Field label="Proje"><select style={iStyle} value={modal.projectId} onChange={e=>setModal(m=>({...m,projectId:e.target.value}))}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}<TicketForm project={(customerMode?customerProjectList:state.projects).find(p=>p.id===modal.projectId)||customerProjectList[0]} types={TYPES} prios={PRIOS} people={state.people} customerMode={customerMode} onClose={()=>setModal(null)} onSave={async data=>{if(!modal.projectId)return;await add(modal.projectId,data);setModal(null);}}/></Modal>}
    {modal?.type==="detail"&&<TicketDetail ticket={((state.projectTickets||{})[modal.projectId]||[]).find(t=>t.id===modal.data.id)||modal.data} people={state.people} customerMode={customerMode} canEdit={!customerMode&&(isAdmin||modal.data.author===currentUser.name)} types={TYPES} prios={PRIOS} onClose={()=>setModal(null)} onUpdate={data=>update(modal.projectId,modal.data.id,data)} onResend={!customerMode?()=>notifyTicketAssignment(modal.projectId,((state.projectTickets||{})[modal.projectId]||[]).find(t=>t.id===modal.data.id)||modal.data):undefined}/>}
  </div>;
}



export function TicketsPanel({ project, currentUser, state, setState, isAdmin, customerMode: forcedCustomerMode=false }) {
  const [modal,setModal]=useState(null);
  const [mailNotice,setMailNotice]=useState("");
  const [ticketView,setTicketView]=useState("cards");
  const allTickets=((state.projectTickets||{})[project.id])||[];
  const customerMode=Boolean(forcedCustomerMode||isCustomerUser(currentUser));
  const effectiveCustomerUser=customerMode?{...currentUser,userType:"customer",roleKey:"customer_viewer",customerId:currentUser?.customerId||project.id}:currentUser;
  const tickets=visibleTicketsForUser(allTickets,effectiveCustomerUser);
  const saveTickets=(t)=>setState(s=>({...s,projectTickets:{...(s.projectTickets||{}),[project.id]:t}}));
  const addTicket=async(data)=>{
    const createdAt=now();
    const customerTicket=customerMode;
    const pmIds=projectResponsibleIds(project);
    const ticket={id:uid(),ticketNo:nextTicketNumber(state),ts:createdAt,updatedAt:createdAt,author:currentUser.name,createdBy:currentUser.id,source:customerTicket?"customer":"internal",customerVisible:customerTicket?true:Boolean(data.customerVisible),customerId:customerTicket?project.id:data.customerId||project.customerId||project.id||"",history:[{id:uid(),ts:createdAt,userId:currentUser.id,userName:currentUser.name,label:"Ticket",from:"-",to:"Oluşturuldu"}],...data,assignedTo:customerTicket?(pmIds[0]||""):data.assignedTo||""};
    saveTickets([...allTickets,ticket]);
    if(customerTicket){
      setState(s=>({...s,notifications:[...pmIds.map(userId=>({id:uid(),ts:now(),userId,msg:`${currentUser.name} müşteri portalından ${ticket.ticketNo} ticketını açtı.`,projectName:project.name,type:"customer_ticket",ticketId:ticket.id,projectId:project.id,read:false})),...(s.notifications||[])]}));
    }
    const result=await createTicketWithNotification(project.id,ticket);
    if(result.ticket?.ticketNo)saveTickets([...allTickets,{...ticket,...result.ticket}]);
    setMailNotice(result.notification?.sent?"Ticket oluşturuldu ve atama maili gönderildi.":`Ticket oluşturuldu; mail gönderilemedi: ${result.notification?.reason||"Bilinmeyen hata"}`);
    return result;
  };
  const updateTicket=(id,data)=>{
    const old=allTickets.find(t=>t.id===id);
    const workflowData=applyTicketWorkflow(data);
    const updated={...old,...workflowData,updatedAt:now(),history:[...(old?.history||[]),...ticketChangeLog(old,workflowData,currentUser)]};
    saveTickets(allTickets.map(t=>t.id===id?updated:t));
    if(workflowData.assignedTo&&workflowData.assignedTo!==old?.assignedTo)notifyTicketAssignment(project.id,updated).catch(error=>console.warn("Ticket maili gönderilemedi",error));
  };
  const deleteTicket=(id)=>saveTickets(allTickets.filter(t=>t.id!==id));
  const TICKET_TYPES=["Bug","Görev","İyileştirme","Soru","Bilgi"];
  const TICKET_PRIOS=["Düşük","Orta","Yüksek","Kritik"];
  const TYPE_COLORS={"Bug":"var(--danger, #b93f33)","Görev":"var(--accent, #0b8a94)","İyileştirme":"var(--success, #19835c)","Soru":"var(--warning, #bf7a12)","Bilgi":"var(--muted, #5b6f74)"};
  const sortedTickets=[...tickets].sort((a,b)=>String(b.updatedAt||b.ts||"").localeCompare(String(a.updatedAt||a.ts||"")));
  return <div className="theme-work-page tickets-theme-page" style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
    <div className="theme-page-heading" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:10, flexWrap:"wrap" }}>
      <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:"var(--text, #112327)" }}>Ticketlar ({tickets.length})</h3>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <div className="view-switch" role="group" aria-label="Ticket g\u00f6r\u00fcn\u00fcm\u00fc">
          <button type="button" className={ticketView==="cards"?"is-active":""} onClick={()=>setTicketView("cards")}>Kart</button>
          <button type="button" className={ticketView==="list"?"is-active":""} onClick={()=>setTicketView("list")}>Liste</button>
        </div>
        <Btn small onClick={()=>setModal({type:"add"})}>+ Ticket Ekle</Btn>
      </div>
    </div>
    {mailNotice&&<div className={mailNotice.includes("gönderildi")?"ui-chip ui-chip-success":"ui-chip ui-chip-warning"} style={{borderRadius:12,padding:"10px 13px",fontSize:11,marginBottom:12,display:"flex"}}>{mailNotice}</div>}
    {!customerMode&&<RecurringProblemsPanel entries={tickets.map(ticket=>({ticket,project}))}/>}
    {tickets.length===0&&<div className="soft-panel empty-panel">Henüz ticket yok.</div>}
    {ticketView==="list"?<TicketListTable rows={sortedTickets.map(ticket=>({ticket,project,projectId:project.id}))} people={state.people} customerMode={customerMode} showProject={false} onOpen={({ticket})=>setModal({type:"detail",data:ticket})} onStatusChange={(_,id,status)=>updateTicket(id,{status})} onDelete={(_,id)=>deleteTicket(id)} canDelete={(ticket)=>isAdmin||ticket.author===currentUser.name}/>:<div className="mobile-ticket-list" style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {sortedTickets.map(t=><div className="compact-list-card ticket-mobile-card mobile-ticket-card-inner" key={t.id} onClick={()=>setModal({type:"detail",data:t})} style={{ padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start", cursor:"pointer" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[t.type]||"var(--muted, #5b6f74)", marginTop:4, flexShrink:0, boxShadow:"0 0 0 4px rgb(255 255 255 / 72%)" }} />
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
            <span className="ui-chip ui-chip-accent">{ticketNumber(t)}</span>
            <span className="text-wrap-safe" style={{ fontWeight:800, fontSize:13, color:"var(--text, #112327)" }}>{t.title}</span>
            <span className={`ui-chip ${ticketToneClass(t.type)}`} style={{color:TYPE_COLORS[t.type]||undefined}}>{t.type}</span>
            <span className={`ui-chip ${ticketToneClass(t.priority)}`}>{t.priority}</span>
            {(t.jiraKey||t.jiraId)&&<a className="ui-chip ui-chip-accent" href={t.jiraLink||"#"} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{textDecoration:"none"}}>{t.jiraKey||t.jiraId}</a>}
            {t.jiraStatus&&<span className="ui-chip ui-chip-success">Jira: {t.jiraStatus}</span>}
            {!customerMode&&<select value={t.status||"Açık"} onClick={e=>e.stopPropagation()} onChange={e=>updateTicket(t.id,{status:e.target.value})} style={{ fontSize:11, borderRadius:10, border:"1px solid var(--border, #cfe0e3)", padding:"4px 7px", fontFamily:"inherit", background:"rgb(255 255 255 / 78%)", color:"var(--text, #112327)" }}>
              {!TICKET_STATUSES.includes(t.status)&&t.status&&<option>{t.status}</option>}
              {TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>}
            {customerMode&&<span className={`ui-chip ${ticketToneClass(t.status||"Açık")}`}>{t.status||"Açık"}</span>}
          </div>
          {t.description&&<div className="text-wrap-safe" style={{ fontSize:12, color:"var(--muted, #5b6f74)", marginBottom:4 }}>{t.description}</div>}
          <div style={{ fontSize:11, color:"var(--muted, #5b6f74)" }}>{t.author} · {new Date(t.ts).toLocaleDateString("tr-TR")}</div>
          {t.assignedTo&&<div style={{fontSize:11,color:"var(--accent, #0b8a94)",marginTop:3}}>Sorumlu: {state.people.find(p=>p.id===t.assignedTo)?.name||"Atanmamış"}</div>}
        </div>
        {!customerMode&&(isAdmin||t.author===currentUser.name)&&<button onClick={e=>{e.stopPropagation();deleteTicket(t.id);}} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted, #5b6f74)", fontSize:16 }}>×</button>}
      </div>)}
    </div>}
    {modal?.type==="add"&&<Modal title="Ticket Ekle" onClose={()=>setModal(null)}>
      <TicketForm project={project} onSave={async d=>{await addTicket(d);setModal(null);}} onClose={()=>setModal(null)} types={TICKET_TYPES} prios={TICKET_PRIOS} people={state.people} customerMode={customerMode} />
    </Modal>}
    {modal?.type==="detail"&&<TicketDetail ticket={tickets.find(t=>t.id===modal.data.id)||modal.data} customerMode={customerMode} canEdit={!customerMode&&(isAdmin||modal.data.author===currentUser.name)} onClose={()=>setModal(null)} onUpdate={(data)=>updateTicket(modal.data.id,data)} onResend={!customerMode?()=>notifyTicketAssignment(project.id,tickets.find(t=>t.id===modal.data.id)||modal.data):undefined} types={TICKET_TYPES} prios={TICKET_PRIOS} people={state.people} />}
  </div>;
}
function RecurringProblemsPanel({entries=[]}) {
  const normalize=value=>String(value||"").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const groups=new Map();
  entries.forEach(({ticket,project})=>{
    const explicit=String(ticket.recurrenceKey||"").trim();
    const key=explicit?`key:${normalize(explicit)}`:`title:${normalize(ticket.category)}:${normalize(ticket.title)}`;
    if(!normalize(ticket.title))return;
    const current=groups.get(key)||{label:explicit||ticket.title,explicit:Boolean(explicit),items:[],effort:0,projects:new Set()};
    current.items.push(ticket);
    current.effort+=Number(ticket.effortHours||0);
    if(project?.name)current.projects.add(project.name);
    groups.set(key,current);
  });
  const repeated=[...groups.values()].filter(group=>group.items.length>1).sort((a,b)=>b.effort-a.effort||b.items.length-a.items.length);
  if(!repeated.length)return <div className="soft-panel empty-panel"><b>Tekrar eden problem bulunmuyor.</b><div style={{fontSize:10,marginTop:5}}>Problem kodu veya benzer başlıkla eşleşen en az iki ticket burada görünür.</div></div>;
  return <div className="soft-panel" style={{padding:16,marginBottom:13}}>
    <div style={{fontSize:14,fontWeight:900,color:"var(--text, #112327)",marginBottom:3}}>Tekrar Eden Problemler</div><div style={{fontSize:10,color:"var(--muted, #5b6f74)",marginBottom:12}}>Yeniden efor harcanan konuları kök neden ve çözüm standardı için izleyin.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:9}}>{repeated.map(group=><div className="compact-list-card" key={`${group.label}-${group.items.length}`} style={{padding:"12px 13px",fontSize:10,color:"var(--muted, #5b6f74)"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b className="text-wrap-safe" style={{fontSize:12,color:"var(--text, #112327)"}}>{group.label}</b><span className="ui-chip ui-chip-warning">{group.items.length} kez</span></div><div style={{marginTop:8}}>{group.effort.toFixed(1)} saat efor · {[...group.projects].length} proje</div><span style={{display:"block",color:"var(--muted, #5b6f74)",marginTop:4}}>{group.explicit?"Ortak problem koduyla eşleşti":"Başlık benzerliğine göre aday"}</span></div>)}</div>
  </div>;
}
function TicketForm({ project, onSave, onClose, types, prios, people, customerMode=false }) {
  const [f,setF]=useState({ title:"", customer:project?.customerProfile?.name||project?.customerName||project?.name||"", module:(project?.activeModules||[])[0]||"", subModule:"", functionButton:"", pageUrl:"", type:"Görev", category:"Operasyonel", ownerTeam:"Operasyon", priority:"Orta", description:"", requestRequirements:[""], completionCriteria:[""], status:"Açık", jiraKey:"", assignedTo:"", testResult:"", recurrenceKey:"", rootCause:"", resolution:"", effortHours:"" });
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  const updList=(key,index,value)=>setF(s=>({...s,[key]:(s[key]||[]).map((item,i)=>i===index?value:item)}));
  const addListItem=key=>setF(s=>({...s,[key]:[...(s[key]||[]),""]}));
  const removeListItem=(key,index)=>setF(s=>({...s,[key]:(s[key]||[]).filter((_,i)=>i!==index)}));
  const submit=async()=>{
    if(!f.title.trim())return;
    const jiraKey=f.jiraKey.trim().toUpperCase();
    const normalized={...f,requestRequirements:(f.requestRequirements||[]).map(item=>item.trim()).filter(Boolean),completionCriteria:(f.completionCriteria||[]).map(item=>item.trim()).filter(Boolean)};
    setSaving(true);setError("");
    try{await onSave({...normalized,jiraKey,jiraId:jiraKey});}
    catch(e){setError(e?.message||"Ticket oluşturulamadı.");}
    finally{setSaving(false);}
  };
  return <div>
    <Field label="Başlık *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div className="soft-panel" style={{padding:12,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:900,color:"var(--muted, #5b6f74)",marginBottom:9}}>Standart Talep Bilgileri</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        {!customerMode&&<Field label="Müşteri"><input style={iStyle} value={f.customer} onChange={e=>upd("customer",e.target.value)} /></Field>}
        <Field label="İlgili Modül"><select style={iStyle} value={f.module} onChange={e=>upd("module",e.target.value)}><option value="">Modül seçin</option>{DEFAULT_ACTIVE_MODULES.map(module=><option key={module}>{module}</option>)}</select></Field>
        <Field label="İlgili Alt Modül"><input style={iStyle} value={f.subModule} onChange={e=>upd("subModule",e.target.value)} /></Field>
        <Field label="Fonksiyon / Buton"><input style={iStyle} value={f.functionButton} onChange={e=>upd("functionButton",e.target.value)} /></Field>
      </div>
      <Field label="Sistem Sayfa URL"><input style={iStyle} value={f.pageUrl} onChange={e=>upd("pageUrl",e.target.value)} placeholder="https://..." /></Field>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Tip"><select style={iStyle} value={f.type} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    {!customerMode&&<Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>}
    <div style={{display:"grid",gridTemplateColumns:customerMode?"1fr":"1fr 1fr",gap:11}}>
      <Field label="Kategori"><select style={iStyle} value={f.category} onChange={e=>upd("category",e.target.value)}>{TICKET_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></Field>
      {!customerMode&&<Field label="Sahip Ekip"><select style={iStyle} value={f.ownerTeam} onChange={e=>upd("ownerTeam",e.target.value)}>{["Operasyon","Ürün","Yazılım"].map(team=><option key={team}>{team}</option>)}</select></Field>}
    </div>
    <Field label="Talep Açıklaması"><textarea style={{ ...iStyle, height:80, resize:"vertical" }} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <StepListEditor title="Talep İsterleri" items={f.requestRequirements} onAdd={()=>addListItem("requestRequirements")} onRemove={index=>removeListItem("requestRequirements",index)} onChange={(index,value)=>updList("requestRequirements",index,value)}/>
    <StepListEditor title="Tamamlanma Kriterleri" items={f.completionCriteria} onAdd={()=>addListItem("completionCriteria")} onRemove={index=>removeListItem("completionCriteria",index)} onChange={(index,value)=>updList("completionCriteria",index,value)}/>
    {!customerMode&&<Field label="Atanan Kullanıcı"><select style={iStyle} value={f.assignedTo} onChange={e=>upd("assignedTo",e.target.value)}><option value="">- Atanmamış -</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}{person.email?` · ${person.email}`:""}</option>)}</select></Field>}
    {!customerMode&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
      <Field label="Tekrar Eden Problem Kodu"><input style={iStyle} value={f.recurrenceKey} onChange={e=>upd("recurrenceKey",e.target.value)} placeholder="Örn. VPN-KOPMA"/></Field>
      <Field label="Harcanan Efor (saat)"><input type="number" min="0" step="0.25" style={iStyle} value={f.effortHours} onChange={e=>upd("effortHours",e.target.value)}/></Field>
    </div>}
    {!customerMode&&<Field label="Jira Task Key"><input style={iStyle} value={f.jiraKey} onChange={e=>upd("jiraKey",e.target.value)} placeholder="PROJ-123" /></Field>}
    {!customerMode&&<div style={{ fontSize:11, color:"var(--muted, #5b6f74)", marginBottom:11 }}>Mevcut bir Jira taskıyla ilişkilendirmek için issue key girin.</div>}
    {error&&<div className="ui-chip ui-chip-danger" style={{borderRadius:10,padding:"8px 10px",fontSize:11,marginBottom:10,display:"flex"}}>{error}</div>}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" disabled={saving} onClick={onClose}>İptal</Btn><Btn disabled={saving} onClick={submit}>{saving?"Kaydediliyor...":"Kaydet"}</Btn></div>
  </div>;
}

function StepListEditor({title,items=[],onAdd,onRemove,onChange}) {
  return <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}>
      <label style={{fontSize:12,fontWeight:750,color:"var(--text, #112327)"}}>{title}</label>
      <button type="button" onClick={onAdd} className="ui-chip ui-chip-accent" style={{borderRadius:9,fontSize:10,cursor:"pointer"}}>+ Adım</button>
    </div>
    <div style={{display:"grid",gap:7}}>
      {(items.length?items:[""]).map((item,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"auto minmax(0,1fr) auto",gap:7,alignItems:"center"}}>
        <span style={{width:22,height:22,borderRadius:8,display:"grid",placeItems:"center",background:"var(--surface-soft, #f6fafb)",color:"var(--muted, #5b6f74)",fontSize:10,fontWeight:900}}>{index+1}</span>
        <input style={{...iStyle,minWidth:0}} value={item} onChange={event=>onChange(index,event.target.value)} placeholder={`${title} adımı`}/>
        <button type="button" onClick={()=>onRemove(index)} style={{border:0,background:"transparent",color:"var(--danger, #b93f33)",fontSize:16,cursor:"pointer"}}>×</button>
      </div>)}
    </div>
  </div>;
}

function TicketDetail({ ticket, customerMode=false, canEdit, onClose, onUpdate, onResend, types, prios, people=[] }) {
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState(ticket);
  const [jira,setJira]=useState(null);
  const canSyncJira=Boolean(canEdit&&onUpdate);
  const [loading,setLoading]=useState(Boolean(canSyncJira&&(ticket.jiraKey||ticket.jiraId)));
  const [error,setError]=useState("");
  const [mailStatus,setMailStatus]=useState({loading:false,message:"",error:false});
  const jiraKey=(ticket.jiraKey||ticket.jiraId||"").trim().toUpperCase();
  const upd=(k,v)=>setForm(s=>({...s,[k]:v}));
  const refreshJira=async()=>{
    if(!jiraKey||!canSyncJira)return;
    setLoading(true);
    setError("");
    try{
      const issue=await getJiraIssue(jiraKey);
      setJira(issue);
      onUpdate({jiraKey:issue.key,jiraId:issue.key,jiraIssueId:issue.id,jiraLink:issue.url,jiraStatus:issue.status,jiraSummary:issue.summary,jiraDescription:issue.description,jiraAssignee:issue.assignee,jiraIssueType:issue.issueType,jiraPriority:issue.priority,jiraUpdatedAt:now()});
    }catch(e){setError(e?.message||"Jira bilgisi alınamadı.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{
    if(!jiraKey||!canSyncJira){setLoading(false);return;}
    let active=true;
    getJiraIssue(jiraKey).then(issue=>{
      if(!active)return;
      setJira(issue);
      setError("");
      onUpdate({jiraKey:issue.key,jiraId:issue.key,jiraIssueId:issue.id,jiraLink:issue.url,jiraStatus:issue.status,jiraSummary:issue.summary,jiraDescription:issue.description,jiraAssignee:issue.assignee,jiraIssueType:issue.issueType,jiraPriority:issue.priority,jiraUpdatedAt:now()});
    }).catch(e=>{if(active)setError(e?.message||"Jira bilgisi alınamadı.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
    // onUpdate changes with parent renders; Jira should refresh only when its key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jiraKey,canSyncJira]);
  const save=()=>{
    const key=(form.jiraKey||form.jiraId||"").trim().toUpperCase();
    if(key!==jiraKey){setJira(null);setError("");setLoading(Boolean(key));}
    onUpdate({...form,jiraKey:key,jiraId:key,...(key!==jiraKey?{jiraStatus:"",jiraLink:"",jiraIssueId:""}:{})});
    setEditing(false);
  };
  const resend=async()=>{
    if(!ticket.assignedTo)return;
    setMailStatus({loading:true,message:"",error:false});
    try{
      const result=await onResend();
      setMailStatus({loading:false,message:`Mail gönderildi${result.emailId?` (${result.emailId})`:""}.`,error:false});
    }catch(e){
      setMailStatus({loading:false,message:e?.message||"Mail gönderilemedi.",error:true});
    }
  };
  const customerApprovalOpen=String(ticket.status||"").toLocaleLowerCase("tr-TR")==="müşteri onayında";
  if(customerMode){
    const decide=(approved)=>onUpdate?.({
      status:approved?"Tamamlandı":"Müşteri Reddetti",
      customerApproval:{...(ticket.customerApproval||{}),status:approved?"approved":"rejected",respondedAt:now()}
    });
    return <Modal title={`${ticketNumber(ticket)} · ${ticket.title}`} onClose={onClose} wide>
      <div>
        {ticket.description&&<div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,marginBottom:16}}>{ticket.description}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginBottom:16}}>
          <div style={{background:"var(--surface-soft)",border:"1px solid var(--border)",borderRadius:12,padding:12}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:850,textTransform:"uppercase"}}>Durum</div><div style={{fontSize:15,fontWeight:900,color:"var(--text)",marginTop:4}}>{ticket.status||"Açık"}</div></div>
          <div style={{background:"var(--surface-soft)",border:"1px solid var(--border)",borderRadius:12,padding:12}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:850,textTransform:"uppercase"}}>Öncelik</div><div style={{fontSize:15,fontWeight:900,color:"var(--text)",marginTop:4}}>{ticket.priority||"-"}</div></div>
          <div style={{background:"var(--surface-soft)",border:"1px solid var(--border)",borderRadius:12,padding:12}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:850,textTransform:"uppercase"}}>Açılış</div><div style={{fontSize:15,fontWeight:900,color:"var(--text)",marginTop:4}}>{ticket.ts?new Date(ticket.ts).toLocaleDateString("tr-TR"):"-"}</div></div>
        </div>
        {(ticket.jiraStatus||ticket.jiraKey||ticket.jiraSummary||ticket.jiraLink)&&<div style={{border:"1.5px solid var(--border)",borderRadius:12,padding:14,background:"var(--surface-soft)",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:13,color:"var(--accent)",marginBottom:8}}>Jira Durumu</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>{ticket.jiraKey&&<strong style={{fontSize:13}}>{ticket.jiraKey}</strong>}<span style={{background:"color-mix(in srgb, var(--success) 10%, white 90%)",color:"var(--success)",borderRadius:7,padding:"2px 8px",fontSize:11,fontWeight:700}}>{ticket.jiraStatus||"Durum bekleniyor"}</span></div>
          {ticket.jiraSummary&&<div style={{fontSize:12,fontWeight:750,color:"var(--text)",marginBottom:7}}>{ticket.jiraSummary}</div>}
          {ticket.jiraLink&&<a href={ticket.jiraLink} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"var(--accent)",color:"#fff",borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>Jira'da Aç</a>}
        </div>}
        <div style={{border:"1px solid color-mix(in srgb, var(--accent) 22%, var(--border))",borderRadius:12,padding:13,background:"var(--accent-ink)",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:12,color:"var(--accent)"}}>Müşteri Onayı</div>
          <div style={{fontSize:11,color:"var(--muted)",margin:"5px 0 10px"}}>{ticket.customerApproval?.status==="approved"?"Onaylandı":ticket.customerApproval?.status==="rejected"?"Reddedildi":customerApprovalOpen?"Onayınız bekleniyor":"Şu an onay beklenmiyor"}</div>
          {customerApprovalOpen&&<div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Btn small variant="success" onClick={()=>decide(true)}>Onayla</Btn><Btn small variant="danger" onClick={()=>decide(false)}>Reddet</Btn></div>}
        </div>
        <div style={{border:"1px solid var(--border)",borderRadius:12,padding:13,background:"var(--surface-soft)",marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:12,marginBottom:9}}>Ticket Geçmişi</div>
          <div style={{display:"grid",gap:7}}>{[...(ticket.history||[])].reverse().map(entry=><div key={entry.id} style={{fontSize:10,color:"var(--muted)",display:"grid",gridTemplateColumns:"110px 1fr",gap:8}}><span style={{color:"var(--muted)"}}>{new Date(entry.ts).toLocaleString("tr-TR")}</span><span><b>{entry.userName||"Sistem"}</b> · {entry.label}: {entry.from} → {entry.to}</span></div>)}</div>
          {!ticket.history?.length&&<div style={{fontSize:11,color:"var(--muted)"}}>Henüz değişiklik kaydı yok.</div>}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end"}}><Btn variant="ghost" onClick={onClose}>Kapat</Btn></div>
      </div>
    </Modal>;
  }
  return <Modal title={`${ticketNumber(ticket)} · ${ticket.title}`} onClose={onClose} wide>
    {editing?<div>
      <Field label="Başlık"><input style={iStyle} value={form.title||""} onChange={e=>upd("title",e.target.value)} /></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <Field label="Tip"><select style={iStyle} value={form.type||"Görev"} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Öncelik"><select style={iStyle} value={form.priority||"Orta"} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
      </div>
      <Field label="Durum"><select style={iStyle} value={form.status||"Açık"} onChange={e=>upd("status",e.target.value)}>{!TICKET_STATUSES.includes(form.status)&&form.status&&<option>{form.status}</option>}{TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <Field label="Kategori"><select style={iStyle} value={form.category||"Operasyonel"} onChange={e=>upd("category",e.target.value)}>{TICKET_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></Field>
        <Field label="Sahip Ekip"><select style={iStyle} value={form.ownerTeam||"Operasyon"} onChange={e=>upd("ownerTeam",e.target.value)}>{["Operasyon","Ürün","Yazılım"].map(team=><option key={team}>{team}</option>)}</select></Field>
      </div>
      <Field label="Açıklama"><textarea style={{...iStyle,height:90,resize:"vertical"}} value={form.description||""} onChange={e=>upd("description",e.target.value)} /></Field>
      <Field label="Atanan Kullanıcı"><select style={iStyle} value={form.assignedTo||""} onChange={e=>upd("assignedTo",e.target.value)}><option value="">- Atanmamış -</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <Field label="Test Sonucu"><select style={iStyle} value={form.testResult||""} onChange={e=>upd("testResult",e.target.value)}><option value="">- Test yok -</option>{["Bekliyor","Başarılı","Başarısız"].map(result=><option key={result}>{result}</option>)}</select></Field>
        <Field label="Efor (saat)"><input type="number" min="0" step="0.25" style={iStyle} value={form.effortHours||""} onChange={e=>upd("effortHours",e.target.value)}/></Field>
      </div>
      <Field label="Tekrar Eden Problem Kodu"><input style={iStyle} value={form.recurrenceKey||""} onChange={e=>upd("recurrenceKey",e.target.value)} placeholder="Aynı problem için ortak kod"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}><Field label="Müşteri Onay Yetkilisi"><input style={iStyle} value={form.customerApproval?.name||""} onChange={e=>upd("customerApproval",{...(form.customerApproval||{}),name:e.target.value})} placeholder="Ad Soyad"/></Field><Field label="Müşteri Onay E-postası"><input type="email" style={iStyle} value={form.customerApproval?.email||""} onChange={e=>upd("customerApproval",{...(form.customerApproval||{}),email:e.target.value})}/></Field></div>
      <Field label="Kök Neden"><textarea style={{...iStyle,height:65,resize:"vertical"}} value={form.rootCause||""} onChange={e=>upd("rootCause",e.target.value)}/></Field>
      <Field label="Kalıcı Çözüm"><textarea style={{...iStyle,height:65,resize:"vertical"}} value={form.resolution||""} onChange={e=>upd("resolution",e.target.value)}/></Field>
      <Field label="Jira Task Key"><input style={iStyle} value={form.jiraKey||form.jiraId||""} onChange={e=>upd("jiraKey",e.target.value)} placeholder="PROJ-123" /></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" onClick={()=>setEditing(false)}>İptal</Btn><Btn onClick={save}>Kaydet</Btn></div>
    </div>:<div>
      {ticket.description&&<div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,marginBottom:16}}>{ticket.description}</div>}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><span className={`ui-chip ${ticketToneClass(ticket.type)}`}>{ticket.type}</span><span className={`ui-chip ${ticketToneClass(ticket.priority)}`}>{ticket.priority}</span><span className={`ui-chip ${ticketToneClass(ticket.status)}`}>{ticket.status}</span><span className="ui-chip ui-chip-accent">{ticket.category||"Operasyonel"} · {ticket.ownerTeam||"Operasyon"}</span>{ticket.testResult&&<span className={`ui-chip ${ticketToneClass(ticket.testResult)}`}>Test: {ticket.testResult}</span>}</div>
      {(ticket.customer||ticket.module||ticket.subModule||ticket.functionButton||ticket.pageUrl||(ticket.requestRequirements||[]).length||(ticket.completionCriteria||[]).length)&&<div style={{border:"1px solid var(--border)",borderRadius:12,padding:13,background:"#fff",marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:12,marginBottom:10}}>Standart Talep Bilgileri</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,fontSize:11,color:"var(--muted)",marginBottom:10}}>
          {ticket.customer&&<div><b>Müşteri:</b> {ticket.customer}</div>}
          {ticket.module&&<div><b>İlgili Modül:</b> {ticket.module}</div>}
          {ticket.subModule&&<div><b>İlgili Alt Modül:</b> {ticket.subModule}</div>}
          {ticket.functionButton&&<div><b>Fonksiyon / Buton:</b> {ticket.functionButton}</div>}
          {ticket.pageUrl&&<div><b>Sistem Sayfa URL:</b> <a href={ticket.pageUrl} target="_blank" rel="noreferrer" style={{color:"var(--accent)"}}>{ticket.pageUrl}</a></div>}
        </div>
        {(ticket.requestRequirements||[]).length>0&&<div style={{marginTop:8}}><b style={{fontSize:11}}>Talep İsterleri</b><ol style={{margin:"6px 0 0 18px",fontSize:11,color:"var(--muted)",lineHeight:1.6}}>{ticket.requestRequirements.map((item,index)=><li key={index}>{item}</li>)}</ol></div>}
        {(ticket.completionCriteria||[]).length>0&&<div style={{marginTop:8}}><b style={{fontSize:11}}>Tamamlanma Kriterleri</b><ol style={{margin:"6px 0 0 18px",fontSize:11,color:"var(--muted)",lineHeight:1.6}}>{ticket.completionCriteria.map((item,index)=><li key={index}>{item}</li>)}</ol></div>}
      </div>}
      {ticket.assignedTo&&<div style={{fontSize:12,color:"var(--accent)",marginBottom:14}}>Atanan: <b>{people.find(person=>person.id===ticket.assignedTo)?.name||"Bilinmiyor"}</b></div>}
      {mailStatus.message&&<div style={{fontSize:11,fontWeight:700,color:mailStatus.error?"var(--danger)":"var(--success)",background:mailStatus.error?"color-mix(in srgb, var(--danger) 9%, white 91%)":"color-mix(in srgb, var(--success) 10%, white 90%)",borderRadius:8,padding:"8px 10px",marginBottom:12}}>{mailStatus.message}</div>}
      <div style={{border:"1.5px solid var(--border)",borderRadius:12,padding:14,background:"var(--surface-soft)",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:jiraKey?10:0}}><div style={{fontWeight:800,fontSize:13,color:"var(--accent)"}}>Jira Task</div>{jiraKey&&canSyncJira&&<button onClick={refreshJira} disabled={loading} style={{border:"none",background:"none",color:"var(--accent)",fontSize:11,cursor:"pointer"}}>{loading?"Güncelleniyor...":"Yenile"}</button>}</div>
        {!jiraKey&&<div style={{fontSize:12,color:"var(--muted)"}}>Bu ticket henüz bir Jira taskıyla ilişkilendirilmemiş.</div>}
        {jiraKey&&error&&<div style={{fontSize:11,color:"var(--danger)",background:"color-mix(in srgb, var(--danger) 9%, white 91%)",borderRadius:7,padding:"7px 9px",marginBottom:9}}>{error} Son alınan bilgiler gösteriliyor.</div>}
        {jiraKey&&<div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}><strong style={{fontSize:13}}>{jiraKey}</strong><span style={{background:"color-mix(in srgb, var(--success) 10%, white 90%)",color:"var(--success)",borderRadius:7,padding:"2px 8px",fontSize:11,fontWeight:700}}>{jira?.status||ticket.jiraStatus||"Durum alınıyor..."}</span></div>
          {(jira?.summary||ticket.jiraSummary)&&<div style={{fontSize:12,fontWeight:750,color:"var(--text)",marginBottom:7}}>{jira?.summary||ticket.jiraSummary}</div>}
          {(jira?.description||ticket.jiraDescription)&&<div style={{fontSize:11,color:"var(--muted)",lineHeight:1.55,whiteSpace:"pre-wrap",background:"#fff",borderRadius:8,padding:"9px 10px",marginBottom:9}}>{jira?.description||ticket.jiraDescription}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:10,color:"var(--muted)",marginBottom:9}}>{(jira?.issueType||ticket.jiraIssueType)&&<span>Tip: <b>{jira?.issueType||ticket.jiraIssueType}</b></span>}{(jira?.priority||ticket.jiraPriority)&&<span>Öncelik: <b>{jira?.priority||ticket.jiraPriority}</b></span>}{(jira?.assignee||ticket.jiraAssignee)&&<span>Sorumlu: <b>{jira?.assignee||ticket.jiraAssignee}</b></span>}</div>
          {(jira?.url||ticket.jiraLink)&&<a href={jira?.url||ticket.jiraLink} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"var(--accent)",color:"#fff",borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>Jira'da Aç</a>}
        </div>}
      </div>
      {(ticket.recurrenceKey||ticket.rootCause||ticket.resolution||ticket.effortHours)&&<div style={{border:"1px solid var(--border)",borderRadius:12,padding:13,background:"#fff",marginBottom:16}}><div style={{fontWeight:800,fontSize:12,marginBottom:8}}>Problem Bilgisi</div><div style={{display:"grid",gap:6,fontSize:11,color:"var(--muted)"}}>{ticket.recurrenceKey&&<div>Tekrar kodu: <b>{ticket.recurrenceKey}</b></div>}{ticket.effortHours&&<div>Efor: <b>{ticket.effortHours} saat</b></div>}{ticket.rootCause&&<div><b>Kök neden:</b> {ticket.rootCause}</div>}{ticket.resolution&&<div><b>Kalıcı çözüm:</b> {ticket.resolution}</div>}</div></div>}
      <div style={{border:"1px solid color-mix(in srgb, var(--accent) 22%, var(--border))",borderRadius:12,padding:13,background:"var(--accent-ink)",marginBottom:16}}><div style={{fontWeight:800,fontSize:12,color:"var(--accent)"}}>Müşteri Kabulü</div><div style={{fontSize:11,color:"var(--muted)",margin:"5px 0 10px"}}>{ticket.customerApproval?.name||"Onay yetkilisi belirlenmedi"}{ticket.customerApproval?.email?` · ${ticket.customerApproval.email}`:""} · {ticket.customerApproval?.status==="approved"?"Onaylandı":ticket.customerApproval?.status==="rejected"?"Reddedildi":ticket.customerApproval?.status==="pending"?"Onay bekleniyor":"Henüz istenmedi"}</div>{canEdit&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn small onClick={()=>onUpdate({status:"Müşteri Onayında",customerApproval:{...(ticket.customerApproval||{}),status:"pending",requestedAt:now()}})}>Onaya Gönder</Btn><Btn small variant="success" onClick={()=>onUpdate({status:"Tamamlandı",customerApproval:{...(ticket.customerApproval||{}),status:"approved",respondedAt:now()}})}>Onaylandı</Btn><Btn small variant="danger" onClick={()=>onUpdate({status:"Müşteri Reddetti",customerApproval:{...(ticket.customerApproval||{}),status:"rejected",respondedAt:now()}})}>Reddedildi</Btn></div>}</div>
      <div style={{border:"1px solid var(--border)",borderRadius:12,padding:13,background:"var(--surface-soft)",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:12,marginBottom:9}}>Ticket Geçmişi</div>
        <div style={{display:"grid",gap:7}}>{[...(ticket.history||[])].reverse().map(entry=><div key={entry.id} style={{fontSize:10,color:"var(--muted)",display:"grid",gridTemplateColumns:"110px 1fr",gap:8}}><span style={{color:"var(--muted)"}}>{new Date(entry.ts).toLocaleString("tr-TR")}</span><span><b>{entry.userName||"Sistem"}</b> · {entry.label}: {entry.from} → {entry.to}</span></div>)}</div>
        {!ticket.history?.length&&<div style={{fontSize:11,color:"var(--muted)"}}>Henüz değişiklik kaydı yok.</div>}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7,flexWrap:"wrap"}}>{ticket.assignedTo&&onResend&&<Btn variant="success" disabled={mailStatus.loading} onClick={resend}>{mailStatus.loading?"Gönderiliyor...":"Atama Mailini Gönder"}</Btn>}{canEdit&&<Btn variant="secondary" onClick={()=>{setForm(ticket);setEditing(true);}}>Düzenle / Jira İlişkilendir</Btn>}<Btn variant="ghost" onClick={onClose}>Kapat</Btn></div>
    </div>}
  </Modal>;
}

// ─── User Edit Modal ──────────────────────────────────────────────────────────
