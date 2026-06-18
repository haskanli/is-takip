import { useState } from "react";
import { fieldPlanHours, projectPmIds } from "../domain/projectHelpers.js";
import { Avatar, Btn, Field, Icon, Modal, iStyle } from "./primitives.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const DEFAULT_COST_SETTINGS = { fuelConsumptionLtPer100Km: 6.5, fuelTryPerLt: 45, usdTry: 32 };
const projectCostSettings = (project) => ({ ...DEFAULT_COST_SETTINGS, ...(project?.costSettings || {}) });
const fuelCost = ({ roundTripKm = 0, settings = DEFAULT_COST_SETTINGS }) => {
  const liters = (Number(roundTripKm) || 0) * (Number(settings.fuelConsumptionLtPer100Km) || 6.5) / 100;
  const tryAmount = liters * (Number(settings.fuelTryPerLt) || 0);
  const usdAmount = tryAmount / (Number(settings.usdTry) || 1);
  return { liters: Math.round(liters * 10) / 10, tryAmount: Math.round(tryAmount), usdAmount: Math.round(usdAmount * 100) / 100 };
};

function FieldPlanPage({
  state,
  setState,
  currentUser,
  isAdmin,
  scope: controlledScope,
  onScopeChange,
  projectFilter: controlledProjectFilter,
  onProjectFilterChange,
  personFilter: controlledPersonFilter,
  onPersonFilterChange,
  weekOffset: controlledWeekOffset,
  onWeekOffsetChange,
}) {
  const [localScope,setLocalScope]=useState(isAdmin?"team":"mine");
  const [localPersonFilter,setLocalPersonFilter]=useState("");
  const [localProjectFilter,setLocalProjectFilter]=useState("all");
  const [localWeekOffset,setLocalWeekOffset]=useState(0);
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [visitPlan,setVisitPlan]=useState(null);
  const [form,setForm]=useState({userId:currentUser.id,projectId:"",workType:"field",date:todayStr(),startTime:"09:00",endTime:"17:00",note:""});
  const scope=controlledScope||localScope;
  const setScope=onScopeChange||setLocalScope;
  const personFilter=controlledPersonFilter??localPersonFilter;
  const setPersonFilter=onPersonFilterChange||setLocalPersonFilter;
  const projectFilter=controlledProjectFilter??localProjectFilter;
  const setProjectFilter=onProjectFilterChange||setLocalProjectFilter;
  const weekOffset=controlledWeekOffset??localWeekOffset;
  const setWeekOffset=onWeekOffsetChange||setLocalWeekOffset;
  const plans=state.fieldPlans||[];
  const monday=new Date();
  const day=monday.getDay()||7;
  monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate()-day+1+(weekOffset*7));
  const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const weekEnd=days[6];
  const visible=plans.filter(p=>{
    const scopeOk=scope==="team"&&isAdmin?(personFilter?p.userId===personFilter:true):p.userId===currentUser.id;
    return scopeOk&&(projectFilter==="all"||p.projectId===projectFilter);
  });
  const openForm=(date=todayStr(),plan=null)=>{
    setEditingId(plan?.id||null);
    setForm(plan?{userId:plan.userId,projectId:plan.projectId,workType:plan.workType||"field",date:plan.date,startTime:plan.startTime||"09:00",endTime:plan.endTime||"17:00",note:plan.note||""}:{userId:currentUser.id,projectId:"",workType:"field",date,startTime:"09:00",endTime:"17:00",note:""});
    setShowForm(true);
  };
  const save=()=>{
    if(!form.projectId||!form.date)return;
    setState(s=>({...s,fieldPlans:editingId?(s.fieldPlans||[]).map(p=>p.id===editingId?{...p,...form,updatedAt:now()}:p):[...(s.fieldPlans||[]),{id:uid(),status:"planned",...form,createdAt:now()}]}));
    setEditingId(null);
    setShowForm(false);
  };
  const remove=id=>setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).filter(p=>p.id!==id)}));
  const monthLabel=`${monday.toLocaleDateString("tr-TR",{day:"numeric",month:"short"})} - ${weekEnd.toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"})}`;
  return <div style={{padding:"22px clamp(14px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:18}}>
      <div><h2 style={{margin:0,fontSize:20,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><Icon name="calendar" size={21}/>Haftalık Çalışma Planım</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Saha ziyaretlerini ve proje bazlı uzaktan çalışmaları haftalık planlayın.</p></div>
      <Btn onClick={()=>showForm?(setShowForm(false),setEditingId(null)):openForm()}>{showForm?"Kapat":"+ Plan Ekle"}</Btn>
    </div>
    {showForm&&<div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 8px 24px rgba(15,23,42,.05)"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,alignItems:"end"}}>
        {isAdmin&&<Field label="Personel"><select style={iStyle} value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}>{state.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <Field label="Çalışma Türü"><select style={iStyle} value={form.workType} onChange={e=>setForm({...form,workType:e.target.value})}><option value="field">Saha Ziyareti</option><option value="remote">Uzaktan Çalışma</option></select></Field>
        <Field label="Müşteri / Proje"><select style={iStyle} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})}><option value="">Proje seçin</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Tarih"><input type="date" style={iStyle} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
        <Field label="Başlangıç"><input type="time" style={iStyle} value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></Field>
        <Field label="Bitiş"><input type="time" style={iStyle} value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></Field>
      </div>
      <Field label="Plan Notu"><textarea style={{...iStyle,minHeight:70,resize:"vertical"}} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder={form.workType==="remote"?"Uzaktan yapılacak çalışma, hedef ve beklenen çıktı...":"Ziyaret amacı, görüşülecek kişiler veya hazırlık notu..."}/></Field>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn disabled={!form.projectId||!form.date} onClick={save}>{editingId?"Değişiklikleri Kaydet":"Planı Kaydet"}</Btn></div>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
      {isAdmin?<div style={{display:"flex",gap:7,flexWrap:"wrap"}}><div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>{[["mine","Benim Planım"],["team","Tüm Ekip"]].map(([id,label])=><button key={id} onClick={()=>setScope(id)} style={{border:0,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,background:scope===id?"#fff":"transparent",color:scope===id?"#4A6CF7":"#64748B",boxShadow:scope===id?"0 2px 6px #0f172a14":"none"}}>{label}</button>)}</div>{scope==="team"&&<select style={{...iStyle,width:190}} value={personFilter} onChange={e=>setPersonFilter(e.target.value)}><option value="">Tüm kişiler</option>{state.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}<select style={{...iStyle,width:210}} value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Tüm projeler</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>:<span style={{fontSize:12,fontWeight:700,color:"#4A6CF7"}}>Benim Planım</span>}
      <div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={()=>setWeekOffset(v=>v-1)} style={{border:0,borderRadius:8,padding:"7px 10px",background:"#fff",cursor:"pointer",color:"#64748B"}}>‹</button><button onClick={()=>setWeekOffset(0)} style={{border:0,borderRadius:8,padding:"7px 11px",background:"#F1F5FF",cursor:"pointer",fontWeight:700,color:"#4A6CF7"}}>{monthLabel}</button><button onClick={()=>setWeekOffset(v=>v+1)} style={{border:0,borderRadius:8,padding:"7px 10px",background:"#fff",cursor:"pointer",color:"#64748B"}}>›</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:9}}>
      {days.map(d=>{const key=dateKey(d);const dayPlans=visible.filter(p=>p.date===key).sort((a,b)=>(a.startTime||"").localeCompare(b.startTime||""));const today=key===todayStr();return <div key={key} style={{background:today?"#F1F5FF":"#fff",border:`1.5px solid ${today?"#A5B4FC":"#E2E8F0"}`,borderRadius:13,minHeight:190,padding:11}}>
        <button title="Bu güne plan ekle" onClick={()=>openForm(key)} style={{width:"100%",border:0,background:"transparent",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,cursor:"pointer",padding:0}}><div style={{fontSize:11,fontWeight:800,color:today?"#4A6CF7":"#64748B",textTransform:"uppercase"}}>{d.toLocaleDateString("tr-TR",{weekday:"short"})}<span style={{display:"block",fontSize:9,fontWeight:600,color:"#94A3B8",textTransform:"none",marginTop:2}}>+ plan ekle</span></div><div style={{width:28,height:28,borderRadius:9,display:"grid",placeItems:"center",fontWeight:800,fontSize:12,background:today?"#4A6CF7":"#F8FAFC",color:today?"#fff":"#1E293B"}}>{d.getDate()}</div></button>
        {dayPlans.map(plan=>{const project=state.projects.find(p=>p.id===plan.projectId);const person=state.people.find(p=>p.id===plan.userId);const remote=plan.workType==="remote";return <div key={plan.id} onClick={()=>openForm(key,plan)} style={{background:"#fff",border:`1px solid ${remote?"#C4B5FD":project?.color||"#CBD5E1"}55`,borderLeft:`4px solid ${remote?"#7C3AED":project?.color||"#4A6CF7"}`,borderRadius:9,padding:"9px 8px",marginBottom:7,boxShadow:"0 2px 8px #0f172a0c",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:5,alignItems:"flex-start"}}><div style={{fontSize:11,fontWeight:800,lineHeight:1.35}}>{project?.name||"Silinmiş proje"}</div><span style={{fontSize:8,fontWeight:850,color:remote?"#6D28D9":"#047857",background:remote?"#F5F3FF":"#ECFDF5",borderRadius:5,padding:"2px 5px",whiteSpace:"nowrap"}}>{remote?"UZAKTAN":"SAHA"}</span></div><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{plan.startTime} - {plan.endTime}</div>
          {scope==="team"&&person&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:6}}><Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={20}/><span style={{fontSize:10,fontWeight:700,color:"#475569"}}>{person.name}</span></div>}
          {plan.note&&<div style={{fontSize:10,color:"#64748B",lineHeight:1.4,marginTop:6,wordBreak:"break-word"}}>{plan.note}</div>}
          {plan.status==="completed"&&<div style={{fontSize:9,fontWeight:800,color:"#059669",background:"#ECFDF5",borderRadius:6,padding:"3px 6px",marginTop:6,display:"inline-block"}}>GERÇEKLEŞTİ · {fieldPlanHours(plan)} SA</div>}
          {(isAdmin||plan.userId===currentUser.id)&&<div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>{plan.status!=="completed"&&<button onClick={e=>{e.stopPropagation();setVisitPlan(plan);}} style={{border:0,background:"transparent",color:remote?"#7C3AED":"#059669",fontSize:10,fontWeight:800,cursor:"pointer",padding:0}}>{remote?"Çalışmayı Tamamla":"Ziyareti Tamamla"}</button>}<button onClick={e=>{e.stopPropagation();openForm(key,plan);}} style={{border:0,background:"transparent",color:"#4A6CF7",fontSize:10,cursor:"pointer",padding:0}}>Düzenle</button><button onClick={e=>{e.stopPropagation();if(confirm("Plan silinsin mi?"))remove(plan.id);}} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,cursor:"pointer",padding:0}}>Sil</button></div>}
        </div>})}
        {!dayPlans.length&&<div style={{fontSize:10,color:"#CBD5E1",textAlign:"center",paddingTop:38}}>Plan yok</div>}
      </div>})}
    </div>
    {visitPlan&&<FieldVisitModal plan={visitPlan} project={state.projects.find(project=>project.id===visitPlan.projectId)} currentUser={currentUser} onClose={()=>setVisitPlan(null)} onSave={data=>{setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).map(plan=>plan.id===visitPlan.id?{...plan,...data,status:"completed",completedAt:now(),updatedAt:now()}:plan)}));setVisitPlan(null);}}/>}
  </div>;
}

export function FieldVisitModal({plan,project,currentUser,onClose,onSave}) {
  const remote=plan.workType==="remote";
  const suggested=fieldPlanHours(plan);
  const costSettings=projectCostSettings(project||{});
  const [form,setForm]=useState({
    actualStartTime:plan.actualStartTime||plan.startTime||"09:00",
    actualEndTime:plan.actualEndTime||plan.endTime||"17:00",
    effortHours:plan.effortHours||suggested||"",
    visitNotes:plan.visitNotes||"",
    roundTripKm:plan.roundTripKm||"",
  });
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const calculated=fieldPlanHours({...plan,...form,effortHours:""});
  const tripKm=parseFloat(form.roundTripKm)||0;
  const tripCost=fuelCost({roundTripKm:tripKm,settings:costSettings});
  const save=()=>{
    const hours=parseFloat(form.effortHours)||calculated;
    if(hours<=0){alert("Geçerli bir efor süresi girin.");return;}
    if(!form.visitNotes.trim()){alert(remote?"Uzaktan çalışmada yapılanları yazın.":"Ziyarette yapılanları yazın.");return;}
    onSave({...form,effortHours:hours,roundTripKm:tripKm||"",fuelCostUsd:tripKm?tripCost.usdAmount:"",fuelCostTry:tripKm?tripCost.tryAmount:"",visitNotes:form.visitNotes.trim(),completedBy:currentUser.id,completedByName:currentUser.name});
  };
  return <Modal title={`${remote?"Uzaktan Çalışma":"Saha Ziyareti"} · ${project?.name||"Proje"}`} onClose={onClose} wide>
    <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:11,padding:"11px 13px",marginBottom:14,fontSize:11,color:"#047857"}}><b>{fmt(plan.date)}</b> · Planlanan {plan.startTime} - {plan.endTime}{suggested?` · ${suggested} saat`:""}</div>
    <div className="visit-time-grid" style={{display:"grid",gridTemplateColumns:`repeat(${remote?3:4},minmax(0,1fr))`,gap:10}}>
      <Field label="Gerçek Başlangıç"><input type="time" style={iStyle} value={form.actualStartTime} onChange={e=>update("actualStartTime",e.target.value)}/></Field>
      <Field label="Gerçek Bitiş"><input type="time" style={iStyle} value={form.actualEndTime} onChange={e=>update("actualEndTime",e.target.value)}/></Field>
      <Field label="Proje Eforu (Saat)"><input type="number" min="0.5" step="0.5" style={iStyle} value={form.effortHours} onChange={e=>update("effortHours",e.target.value)} placeholder={String(calculated||"")}/></Field>
      {!remote&&<Field label="Gidiş-Dönüş KM"><input type="number" min="0" step="1" style={iStyle} value={form.roundTripKm} onChange={e=>update("roundTripKm",e.target.value)} placeholder="örn. 180"/></Field>}
    </div>
    {!remote&&tripKm>0&&<div style={{fontSize:11,color:"#64748B",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:9,padding:"8px 10px",marginTop:8,marginBottom:4}}>Yakıt maliyeti tahmini: <b>${tripCost.usdAmount}</b> / <b>{tripCost.tryAmount} TL</b> · {costSettings.fuelConsumptionLtPer100Km} L/100km, {costSettings.fuelTryPerLt} TL/L, kur {costSettings.usdTry}</div>}
    <Field label={remote?"Uzaktan Çalışmada Yapılanlar":"Ziyarette Yapılanlar"}><textarea style={{...iStyle,minHeight:115,resize:"vertical",lineHeight:1.5}} value={form.visitNotes} onChange={e=>update("visitNotes",e.target.value)} placeholder={remote?"Yapılan analiz, kontrol, geliştirme, görüşme ve sonraki aksiyonlar...":"Görüşülen konular, yapılan kontroller, alınan kararlar ve sonraki aksiyonlar..."}/></Field>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={save}>{remote?"Çalışmayı":"Ziyareti"} Tamamla ve Eforu Kaydet</Btn></div>
  </Modal>;
}

function FieldVisitsPage({
  state,
  setState,
  currentUser,
  isAdmin,
  scope: controlledScope,
  onScopeChange,
  projectFilter: controlledProjectFilter,
  onProjectFilterChange,
  personFilter: controlledPersonFilter,
  onPersonFilterChange,
  typeFilter: controlledTypeFilter,
  onTypeFilterChange,
  onOpenProject,
}) {
  const responsibleIds=new Set(state.projects.filter(project=>isAdmin||projectPmIds(project).includes(currentUser.id)).map(project=>project.id));
  const [localScope,setLocalScope]=useState("mine");
  const [localProjectFilter,setLocalProjectFilter]=useState("all");
  const [localPersonFilter,setLocalPersonFilter]=useState("");
  const [localTypeFilter,setLocalTypeFilter]=useState("all");
  const [editing,setEditing]=useState(null);
  const scope=controlledScope||localScope;
  const setScope=onScopeChange||setLocalScope;
  const projectFilter=controlledProjectFilter??localProjectFilter;
  const setProjectFilter=onProjectFilterChange||setLocalProjectFilter;
  const personFilter=controlledPersonFilter??localPersonFilter;
  const setPersonFilter=onPersonFilterChange||setLocalPersonFilter;
  const typeFilter=controlledTypeFilter??localTypeFilter;
  const setTypeFilter=onTypeFilterChange||setLocalTypeFilter;
  const completed=(state.fieldPlans||[]).filter(plan=>plan.status==="completed"||plan.completedAt);
  const visible=completed.filter(plan=>{
    const inScope=scope==="mine"?plan.userId===currentUser.id:responsibleIds.has(plan.projectId);
    return inScope&&(typeFilter==="all"||(plan.workType||"field")===typeFilter)&&(projectFilter==="all"||plan.projectId===projectFilter)&&(!personFilter||plan.userId===personFilter);
  }).sort((a,b)=>`${b.date} ${b.actualStartTime||b.startTime||""}`.localeCompare(`${a.date} ${a.actualStartTime||a.startTime||""}`));
  const hours=visible.reduce((total,plan)=>total+fieldPlanHours(plan),0);
  const projects=state.projects.filter(project=>scope==="mine"?(state.fieldPlans||[]).some(plan=>plan.userId===currentUser.id&&plan.projectId===project.id):responsibleIds.has(project.id));
  return <div style={{padding:"clamp(16px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,flexWrap:"wrap",marginBottom:18}}>
      <div><h2 style={{margin:0,fontSize:21,display:"flex",alignItems:"center",gap:8}}><Icon name="calendar" size={21}/>Gerçekleşen Çalışmalar</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Saha ziyaretleri ve uzaktan çalışmaların notları ile proje eforları.</p></div>
      <div style={{display:"flex",gap:7,background:"#E2E8F0",padding:3,borderRadius:10}}>{[["mine","Benim Ziyaretlerim"],["responsible",isAdmin?"Tüm Ekip":"Sorumlu Projeler"]].map(([id,label])=><button key={id} onClick={()=>{setScope(id);setProjectFilter("all");setPersonFilter("");}} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontSize:11,fontWeight:800,background:scope===id?"#fff":"transparent",color:scope===id?"#4A6CF7":"#64748B"}}>{label}</button>)}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginBottom:14}}>{[["Saha Ziyareti",visible.filter(plan=>(plan.workType||"field")==="field").length,"#059669"],["Uzaktan Çalışma",visible.filter(plan=>plan.workType==="remote").length,"#7C3AED"],["Toplam Efor",`${hours} sa`,"#0369A1"],["Çalışılan Proje",new Set(visible.map(plan=>plan.projectId)).size,"#EA6C00"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:12,padding:13}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><div style={{fontSize:23,fontWeight:900,color,marginTop:3}}>{value}</div></div>)}</div>
    <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:14}}>
      <select style={{...iStyle,width:"auto",minWidth:180}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Tüm Çalışma Türleri</option><option value="field">Saha Ziyaretleri</option><option value="remote">Uzaktan Çalışmalar</option></select>
      <select style={{...iStyle,width:"auto",minWidth:220}} value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Tüm Projeler</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select>
      {(isAdmin||scope==="responsible")&&<select style={{...iStyle,width:"auto",minWidth:190}} value={personFilter} onChange={e=>setPersonFilter(e.target.value)}><option value="">Tüm Kişiler</option>{state.people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(320px,100%),1fr))",gap:11}}>
      {visible.map(plan=>{const project=state.projects.find(item=>item.id===plan.projectId);const person=state.people.find(item=>item.id===plan.userId);const canEdit=isAdmin||plan.userId===currentUser.id;const remote=plan.workType==="remote";return <div key={plan.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`4px solid ${remote?"#7C3AED":project?.color||"#4A6CF7"}`,borderRadius:14,padding:15,boxShadow:"0 4px 14px rgba(15,23,42,.04)"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:9}}><div style={{flex:1}}><button onClick={()=>onOpenProject(project?.id)} style={{border:0,background:"transparent",padding:0,fontSize:13,fontWeight:850,cursor:"pointer",textAlign:"left"}}>{project?.name||"Silinmiş proje"}</button><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{fmt(plan.date)} · {plan.actualStartTime||plan.startTime} - {plan.actualEndTime||plan.endTime}</div></div><span style={{background:"#ECFDF5",color:"#047857",borderRadius:8,padding:"4px 7px",fontSize:10,fontWeight:850}}>{fieldPlanHours(plan)} SA</span></div>
        {person&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}><Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={23}/><span style={{fontSize:10,fontWeight:750,color:"#475569"}}>{person.name}</span></div>}
        <div style={{fontSize:9,fontWeight:850,color:remote?"#6D28D9":"#047857",marginTop:9}}>{remote?"UZAKTAN ÇALIŞMA":"SAHA ZİYARETİ"}</div><div style={{fontSize:11,lineHeight:1.55,color:"#334155",whiteSpace:"pre-wrap",background:"#F8FAFC",borderRadius:9,padding:"9px 10px",marginTop:6}}>{plan.visitNotes||(remote?"Çalışma notu girilmedi.":"Ziyaret notu girilmedi.")}</div>
        {canEdit&&<button onClick={()=>setEditing(plan)} style={{marginTop:9,border:0,background:"transparent",color:"#4A6CF7",fontSize:10,fontWeight:800,cursor:"pointer",padding:0}}>Çalışma ve eforu düzenle</button>}
      </div>})}
    </div>
    {!visible.length&&<div style={{padding:45,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:13,color:"#94A3B8",background:"#fff"}}>Bu kapsamda gerçekleşmiş çalışma bulunmuyor.</div>}
    {editing&&<FieldVisitModal plan={editing} project={state.projects.find(project=>project.id===editing.projectId)} currentUser={currentUser} onClose={()=>setEditing(null)} onSave={data=>{setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).map(plan=>plan.id===editing.id?{...plan,...data,status:"completed",updatedAt:now()}:plan)}));setEditing(null);}}/>}
  </div>;
}

export function FieldOperationsPage({
  state,
  setState,
  currentUser,
  isAdmin,
  section: controlledSection,
  onSectionChange,
  scope,
  onScopeChange,
  projectFilter,
  onProjectFilterChange,
  personFilter,
  onPersonFilterChange,
  typeFilter,
  onTypeFilterChange,
  weekOffset,
  onWeekOffsetChange,
  onOpenProject,
}) {
  const [localSection,setLocalSection]=useState("plan");
  const section=controlledSection||localSection;
  const setSection=onSectionChange||setLocalSection;
  return <div style={{flex:1,overflow:"auto",background:"#F8FAFC"}}>
    <div style={{position:"sticky",top:0,zIndex:5,display:"flex",gap:7,padding:"12px clamp(16px,4vw,28px)",background:"#fff",borderBottom:"1px solid #E2E8F0"}}>
      {[["plan","calendar","Haftalık Plan"],["visits","activity","Gerçekleşen Çalışmalar"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:0,borderRadius:9,padding:"8px 13px",background:section===id?"#0F766E":"#F1F5F9",color:section===id?"#fff":"#64748B",fontSize:12,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><Icon name={icon} size={14}/>{label}</button>)}
    </div>
    {section==="plan"?<FieldPlanPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} scope={scope} onScopeChange={onScopeChange} projectFilter={projectFilter} onProjectFilterChange={onProjectFilterChange} personFilter={personFilter} onPersonFilterChange={onPersonFilterChange} weekOffset={weekOffset} onWeekOffsetChange={onWeekOffsetChange}/>:<FieldVisitsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} scope={scope} onScopeChange={onScopeChange} projectFilter={projectFilter} onProjectFilterChange={onProjectFilterChange} personFilter={personFilter} onPersonFilterChange={onPersonFilterChange} typeFilter={typeFilter} onTypeFilterChange={onTypeFilterChange} onOpenProject={onOpenProject}/>}
  </div>;
}
