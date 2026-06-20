import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiUrl } from "../api";
import { COLORS } from "../appData.js";
import { commissioningMachines, fieldPlanHours } from "../domain/projectHelpers.js";
import { CommissioningPanel as SharedCommissioningPanel } from "./commissioningComponents.jsx";
import { MachinePanel as SharedMachinePanel } from "./machineComponents.jsx";
import { Avatar, Btn, Field, Icon, iStyle } from "./primitives.jsx";
import { daysDiff, delayLvl } from "./status.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "?";
const readImageAsDataUrl = (file, callback) => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 360;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/webp", 0.82));
    };
    img.onerror = () => callback(String(reader.result || ""));
    img.src = String(reader.result || "");
  };
  reader.readAsDataURL(file);
};
const TRAINING_SCOPES = ["Operatör Eğitimi","Yönetici Eğitimi","Hatırlatma Eğitimi","Proje Devri Eğitimi","Süper Kullanıcı Eğitimi","Teknik Eğitim","Diğer"];
const COST_CATEGORIES = ["Saha Yakıt","Yetkili Servis İşçilik","Donanım","Lisans","Konaklama","Ulaşım","Diğer"];
const DEFAULT_ACTIVE_MODULES = ["Üretim Takip","Bakım","Kalite","İzlenebilirlik","Satın Alma","Connected Supplier"];
const DEFAULT_COST_SETTINGS = {fuelConsumptionLtPer100Km:6.5,fuelTryPerLt:45,usdTry:32,laborUsdPerHour:35,accommodationUsdPerDay:80};
const mapsUrl = (location={}) => {
  const query=[location.address,location.district,location.city].filter(Boolean).join(", ");
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:"";
};
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const projectCostSettings = (project) => ({...DEFAULT_COST_SETTINGS,...(project?.costSettings||{})});
const fuelCost = ({roundTripKm=0,settings=DEFAULT_COST_SETTINGS}) => {
  const liters=(Number(roundTripKm)||0)*(Number(settings.fuelConsumptionLtPer100Km)||6.5)/100;
  const tryAmount=liters*(Number(settings.fuelTryPerLt)||0);
  const usdAmount=tryAmount/(Number(settings.usdTry)||1);
  return {liters:Math.round(liters*10)/10,tryAmount:Math.round(tryAmount),usdAmount:Math.round(usdAmount*100)/100};
};
const MES_READINESS_TEMPLATE = [
  {id:"scope",category:"Y\u00f6neti\u015fim",text:"Proje kapsam\u0131, hedef KPI'lar, ba\u015far\u0131 \u00f6l\u00e7\u00fctleri ve kapsam d\u0131\u015f\u0131 konular onayland\u0131.",weight:8},
  {id:"sponsor",category:"Y\u00f6neti\u015fim",text:"Proje sponsoru, karar mekanizmas\u0131, RACI ve eskalasyon yolu belirlendi.",weight:7},
  {id:"process",category:"S\u00fcre\u00e7 ve Model",text:"Mevcut ve hedef \u00fcretim s\u00fcre\u00e7leri ile ISA-95 ekipman hiyerar\u015fisi tan\u0131mland\u0131.",weight:8},
  {id:"usecases",category:"S\u00fcre\u00e7 ve Model",text:"MES kullan\u0131m senaryolar\u0131, istisnalar ve operasyon kurallar\u0131 onayland\u0131.",weight:7},
  {id:"masterdata",category:"Veri",text:"Malzeme, rota, operasyon, vardiya, personel ve ekipman ana verilerinin sahibi belirlendi.",weight:8},
  {id:"quality",category:"Veri",text:"Kaynak veri kalitesi kontrol edildi; temizleme ve migrasyon plan\u0131 haz\u0131r.",weight:7},
  {id:"interfaces",category:"Entegrasyon",text:"ERP, kalite, bak\u0131m, depo ve di\u011fer sistem entegrasyonlar\u0131n\u0131n kapsam\u0131 ve veri y\u00f6n\u00fc belirlendi.",weight:8},
  {id:"contracts",category:"Entegrasyon",text:"API/protokol, hata y\u00f6netimi, tekrar deneme, sahiplik ve test verileri tan\u0131mland\u0131.",weight:7},
  {id:"infrastructure",category:"OT Altyap\u0131",text:"Sunucu, a\u011f, zaman senkronizasyonu, yedekleme, kapasite ve ortam ayr\u0131m\u0131 haz\u0131r.",weight:8},
  {id:"security",category:"OT Altyap\u0131",text:"OT/IT a\u011f s\u0131n\u0131rlar\u0131, uzaktan eri\u015fim, hesaplar, yetkiler ve siber g\u00fcvenlik kontrolleri onayland\u0131.",weight:7},
  {id:"equipment",category:"Saha Haz\u0131rl\u0131\u011f\u0131",text:"Makine/PLC ba\u011flant\u0131 envanteri, protokoller, sinyal listeleri ve fiziksel eri\u015fim haz\u0131r.",weight:6},
  {id:"owners",category:"Saha Haz\u0131rl\u0131\u011f\u0131",text:"Hat baz\u0131nda teknik sorumlular ve planl\u0131 duru\u015f/ba\u011flant\u0131 zamanlar\u0131 belirlendi.",weight:4},
  {id:"test",category:"Test ve Kabul",text:"FAT/SAT/UAT senaryolar\u0131, kabul kriterleri, test sorumlular\u0131 ve kan\u0131t format\u0131 haz\u0131r.",weight:6},
  {id:"cutover",category:"Test ve Kabul",text:"Canl\u0131ya ge\u00e7i\u015f, geri d\u00f6n\u00fc\u015f, veri do\u011frulama ve destek plan\u0131 onayland\u0131.",weight:4},
  {id:"training",category:"De\u011fi\u015fim Y\u00f6netimi",text:"Anahtar kullan\u0131c\u0131lar, e\u011fitim, ileti\u015fim ve vardiya bazl\u0131 benimseme plan\u0131 haz\u0131r.",weight:3},
  {id:"support",category:"De\u011fi\u015fim Y\u00f6netimi",text:"Hypercare, SLA, izleme, sorun sahipli\u011fi ve kal\u0131c\u0131 destek modeli belirlendi.",weight:2},
];
const createReadinessChecklist = () => MES_READINESS_TEMPLATE.map(item=>({...item,status:"unanswered",note:""}));
const readinessScore = (project) => {
  const items=project?.readinessChecklist||createReadinessChecklist();
  const total=items.reduce((sum,item)=>sum+(Number(item.weight)||0),0)||1;
  const earned=items.reduce((sum,item)=>sum+(Number(item.weight)||0)*(item.status==="ready"?1:item.status==="partial"?0.5:0),0);
  return Math.round(earned/total*100);
};
const remainingResponsibility = (project) => {
  const open=(project?.milestones||[]).flatMap(ms=>ms.tasks||[]).filter(task=>task.status!=="Tamamland\u0131");
  const totals={};
  open.forEach(task=>{const group=task.responsibilityGroup||"Proje Ekibi";totals[group]=(totals[group]||0)+(Number(task.estimatedHours)||1);});
  const all=Object.values(totals).reduce((sum,value)=>sum+value,0)||1;
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([group,value])=>({group,value,percent:Math.round(value/all*100)}));
};
const nextReportRunAt = (schedule, from=new Date()) => {
  const localParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(from);
  const part=type=>Number(localParts.find(item=>item.type===type)?.value||0);
  const calendar=new Date(Date.UTC(part("year"),part("month")-1,part("day"),12));
  const [hour,minute]=String(schedule.time||"09:00").split(":").map(Number);
  if(schedule.frequency==="monthly") calendar.setUTCMonth(calendar.getUTCMonth()+1,1);
  else {
    const target=Number(schedule.weekday||1);
    calendar.setUTCDate(calendar.getUTCDate()+(target-calendar.getUTCDay()+7)%7);
  }
  const toDate=()=>`${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth()+1).padStart(2,"0")}-${String(calendar.getUTCDate()).padStart(2,"0")}`;
  let next=new Date(`${toDate()}T${String(hour||0).padStart(2,"0")}:${String(minute||0).padStart(2,"0")}:00+03:00`);
  if(next<=from){
    if(schedule.frequency==="monthly") calendar.setUTCMonth(calendar.getUTCMonth()+1,1);
    else calendar.setUTCDate(calendar.getUTCDate()+7);
    next=new Date(`${toDate()}T${String(hour||0).padStart(2,"0")}:${String(minute||0).padStart(2,"0")}:00+03:00`);
  }
  return next.toISOString();
};
const TICKET_STATUSES = ["Açık","Operasyon İncelemesinde","Ürün Değerlendirmesinde","Jira'da Çalışılıyor","Operasyon Testinde","Test Başarısız","Yayına Hazır","Müşteri Onayında","Müşteri Reddetti","Tamamlandı","Beklemede","İptal Edildi"];
const TICKET_CATEGORIES = ["Operasyonel","Bug","Geliştirme","Entegrasyon","İyileştirme","Veri","Eğitim","Diğer"];
const ORG_LEVELS = [
  { id:"ceo", label:"CEO", rank:1 },
  { id:"coo", label:"COO", rank:2 },
  { id:"operations_director", label:"Operasyon Direktörü", rank:3 },
  { id:"project_director", label:"Proje Müdürü", rank:4 },
  { id:"project_manager", label:"Proje Yöneticisi", rank:5 },
  { id:"process_lead", label:"Süreç Lideri", rank:6 },
  { id:"field_engineer", label:"Saha Mühendisi", rank:7 },
];


function RemoteAccessPanel({project,setState,isAdmin,canManage,authHeaders,updateApiStateVersion}) {
  const empty={name:"",url:"",username:"",password:"",status:"Hazır",routing:"",note:""};
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState("");
  const [form,setForm]=useState(empty);
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [visibleSecrets,setVisibleSecrets]=useState({});
  const [copied,setCopied]=useState("");
  const canEdit=isAdmin||canManage;
  const endpoint=`/api/projects/${encodeURIComponent(project.id)}/remote-access`;
  const syncMetadata=useCallback(next=>setState(current=>({...current,projects:current.projects.map(item=>item.id===project.id?{...item,remoteAccess:next.map(record=>{const metadata={...record};delete metadata.password;return metadata;})}:item)})),[project.id,setState]);
  useEffect(()=>{
    let active=true;
    Promise.resolve().then(()=>{if(active){setLoading(true);setError("");}});
    authHeaders().then(headers=>fetch(apiUrl(endpoint),{headers})).then(async response=>{
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Erişim kasası yüklenemedi.");
      if(active)setRecords(result.records||[]);
    }).catch(fetchError=>{if(active)setError(fetchError.message);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[endpoint]);
  const copy=async(value,key)=>{
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(key);setTimeout(()=>setCopied(""),1200);
  };
  const openAdd=()=>{setEditingId("");setForm(empty);setShowForm(true);};
  const openEdit=item=>{setEditingId(item.id);setForm({...empty,...item});setShowForm(true);};
  const submit=async()=>{
    if(!form.name.trim())return;
    setSaving(true);setError("");
    try{
      const id=editingId||uid();
      const response=await fetch(apiUrl(`${endpoint}${editingId?`/${encodeURIComponent(editingId)}`:""}`),{
        method:editingId?"PUT":"POST",
        headers:{"Content-Type":"application/json",...(await authHeaders())},
        body:JSON.stringify({record:{...form,id,name:form.name.trim()}}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Erişim kaydı kaydedilemedi.");
      updateApiStateVersion?.(Number(result.version||0));
      const next=editingId?records.map(item=>item.id===editingId?result.result:item):[result.result,...records];
      setRecords(next);syncMetadata(next);
      setShowForm(false);setEditingId("");setForm(empty);
    }catch(saveError){setError(saveError.message);}
    finally{setSaving(false);}
  };
  const remove=async id=>{
    if(!confirm("Erişim kaydı silinsin mi?"))return;
    setError("");
    try{
      const response=await fetch(apiUrl(`${endpoint}/${encodeURIComponent(id)}`),{method:"DELETE",headers:await authHeaders()});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Erişim kaydı silinemedi.");
      updateApiStateVersion?.(Number(result.version||0));
      const next=records.filter(item=>item.id!==id);
      setRecords(next);syncMetadata(next);
    }catch(deleteError){setError(deleteError.message);}
  };
  return <div className="project-panel-page remote-access-panel" style={{flex:1,overflow:"auto",padding:"18px 22px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14}}>
      <div><h3 style={{margin:0,fontSize:16}}>Uzaktan Erişim Kasası</h3><p style={{margin:"3px 0 0",fontSize:11,color:"var(--muted)"}}>Parolalar şifreli saklanır; projeye dahil kullanıcılar görüntüleyebilir, yalnızca proje yöneticileri ve adminler düzenleyebilir.</p></div>
      {canEdit&&<Btn small onClick={openAdd}>+ Erişim Ekle</Btn>}
    </div>
    {error&&<div style={{background:"color-mix(in srgb, var(--danger) 9%, white 91%)",color:"var(--danger)",borderRadius:9,padding:"9px 11px",fontSize:11,fontWeight:700,marginBottom:10}}>{error}</div>}
    {loading&&<div style={{padding:28,textAlign:"center",color:"var(--muted)"}}>Şifre kasası yükleniyor...</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(320px,100%),1fr))",gap:10,marginBottom:14}}>
      {!loading&&records.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid var(--border)",borderTop:`3px solid ${item.status==="Hazır"?"var(--success)":"var(--warning)"}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{fontSize:13}}>{item.name}</b><span style={{fontSize:9,fontWeight:850,color:item.status==="Hazır"?"var(--success)":"var(--warning)",background:item.status==="Hazır"?"color-mix(in srgb, var(--success) 10%, white 90%)":"color-mix(in srgb, var(--warning) 10%, white 90%)",padding:"3px 6px",borderRadius:7}}>{item.status}</span></div>
        <div style={{display:"grid",gap:7,marginTop:10}}>
          {[["Adres",item.url,"url"],["Kullanıcı",item.username,"username"]].filter(([,value])=>value).map(([label,value,key])=><div key={key} style={{display:"flex",alignItems:"center",gap:7,background:"#F8FAFC",borderRadius:8,padding:"7px 9px"}}><span style={{fontSize:9,color:"var(--muted)",width:54}}>{label}</span><b style={{fontSize:10,flex:1,wordBreak:"break-all"}}>{value}</b><button onClick={()=>copy(value,`${item.id}-${key}`)} style={{border:0,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:6,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{copied===`${item.id}-${key}`?"Kopyalandı":"Kopyala"}</button></div>)}
          {item.password&&<div style={{display:"flex",alignItems:"center",gap:7,background:"color-mix(in srgb, var(--warning) 10%, white 90%)",borderRadius:8,padding:"7px 9px"}}><span style={{fontSize:9,color:"#9A3412",width:54}}>Parola</span><b style={{fontSize:11,flex:1,letterSpacing:visibleSecrets[item.id]?0:2}}>{visibleSecrets[item.id]?item.password:"••••••••••"}</b><button onClick={()=>setVisibleSecrets(current=>({...current,[item.id]:!current[item.id]}))} style={{border:0,background:"transparent",color:"var(--warning)",fontSize:9,fontWeight:800,cursor:"pointer"}}>{visibleSecrets[item.id]?"Gizle":"Göster"}</button><button onClick={()=>copy(item.password,`${item.id}-password`)} style={{border:0,background:"#FFEDD5",color:"#9A3412",borderRadius:6,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{copied===`${item.id}-password`?"Kopyalandı":"Kopyala"}</button></div>}
        </div>
        {item.routing&&<div style={{fontSize:10,color:"var(--muted)",lineHeight:1.5,marginTop:9}}><b>VPN / Yönlendirme:</b> {item.routing}</div>}
        {item.note&&<div style={{fontSize:10,color:"var(--muted)",lineHeight:1.5,marginTop:5}}>{item.note}</div>}
        {canEdit&&<div style={{display:"flex",gap:9,marginTop:10}}><button onClick={()=>openEdit(item)} style={{border:0,background:"transparent",color:"var(--accent)",fontSize:10,fontWeight:800,cursor:"pointer"}}>Düzenle</button><button onClick={()=>remove(item.id)} style={{border:0,background:"transparent",color:"var(--danger)",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button></div>}
      </div>)}
    </div>
    {!loading&&!records.length&&!showForm&&<div style={{padding:38,textAlign:"center",border:"1px dashed var(--muted)",borderRadius:12,color:"var(--muted)"}}>Uzaktan erişim kaydı bulunmuyor.</div>}
    {showForm&&canEdit&&<div style={{background:"#fff",border:"1.5px solid var(--muted)",borderRadius:14,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><b style={{fontSize:13}}>{editingId?"Erişim Kaydını Düzenle":"Yeni Erişim Kaydı"}</b><button onClick={()=>setShowForm(false)} style={{border:0,background:"transparent",fontSize:18,color:"var(--muted)",cursor:"pointer"}}>×</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>
        {[["name","Sistem / Sunucu","text"],["url","Bağlantı Adresi","text"],["username","Kullanıcı Adı","text"],["password","Parola","password"],["routing","VPN / Yönlendirme","text"]].map(([key,label,type])=><Field key={key} label={label}><input type={type} autoComplete="off" style={iStyle} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></Field>)}
        <Field label="Durum"><select style={iStyle} value={form.status} onChange={event=>setForm(current=>({...current,status:event.target.value}))}>{["Hazır","Test Bekliyor","Erişim Yok","Süresi Doldu"].map(status=><option key={status}>{status}</option>)}</select></Field>
      </div>
      <Field label="Not"><input style={iStyle} value={form.note} onChange={event=>setForm(current=>({...current,note:event.target.value}))}/></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" disabled={saving} onClick={()=>setShowForm(false)}>İptal</Btn><Btn disabled={saving} onClick={submit}>{saving?"Kaydediliyor...":editingId?"Güncelle":"Kaydet"}</Btn></div>
    </div>}
  </div>;
}



function ProjectEffortPanel({project,state,people}) {
  const taskRows=project.milestones.flatMap(milestone=>milestone.tasks.flatMap(task=>(task.timeEntries||[]).map(entry=>({
    id:`task-${task.id}-${entry.id}`,source:"Görev",item:task.title,person:people.find(person=>person.id===(entry.userId||task.assignee))?.name||entry.user||"Bilinmiyor",date:entry.date||entry.ts,hours:Number(entry.hours)||0,note:entry.note||"",planned:Number(task.estimatedHours)||0,
  }))));
  const actionRows=((state.projectActions||{})[project.id]||[]).filter(action=>Number(action.effortHours)>0).map(action=>({
    id:`action-${action.id}`,source:"Aksiyon",item:action.text||"Proje aksiyonu",person:action.authorName||people.find(person=>person.id===action.authorId)?.name||"Bilinmiyor",date:action.actionAt||action.createdAt,hours:Number(action.effortHours)||0,note:action.text||"",planned:0,
  }));
  const visitRows=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).map(plan=>({
    id:`visit-${plan.id}`,source:plan.workType==="remote"?"Uzaktan Çalışma":"Saha Ziyareti",item:plan.customer||project.name,person:people.find(person=>person.id===plan.userId)?.name||"Bilinmiyor",date:plan.date||plan.completedAt,hours:fieldPlanHours(plan),note:plan.visitNotes||"",planned:0,
  }));
  const rows=[...taskRows,...actionRows,...visitRows].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const total=rows.reduce((sum,row)=>sum+row.hours,0);
  const planned=project.milestones.flatMap(milestone=>milestone.tasks).reduce((sum,task)=>sum+(Number(task.estimatedHours)||0),0);
  const byPerson=Object.entries(rows.reduce((result,row)=>({...result,[row.person]:(result[row.person]||0)+row.hours}),{})).sort((a,b)=>b[1]-a[1]);
  const exportXlsx=()=>{
    const data=[["Kaynak","İş / Kayıt","Kişi","Tarih","Efor (Saat)","Planlanan (Saat)","Açıklama"],...rows.map(row=>[row.source,row.item,row.person,row.date||"",row.hours,row.planned,row.note])];
    const sheet=XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"]=[{wch:16},{wch:32},{wch:22},{wch:14},{wch:12},{wch:16},{wch:45}];
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,sheet,"Proje Eforu");
    XLSX.writeFile(book,`${project.name.replace(/[^a-zA-Z0-9_-]/g,"_")}-efor.xlsx`);
  };
  const stats=[["Toplam Efor",`${total} sa`,"accent"],["Planlanan",`${planned} sa`,"info"],["Fark",`${Math.round((total-planned)*10)/10} sa`,total>planned?"danger":"success"],["Kayıt",rows.length,"accent"]];
  return <div className="project-panel-page project-effort-panel">
    <div className="project-panel-header"><div><h3>Proje Efor Merkezi</h3><p>Görev, aksiyon ve saha ziyaretlerinden gelen tüm eforlar.</p></div><Btn small onClick={exportXlsx}>XLSX İndir</Btn></div>
    <div className="project-panel-stats">
      {stats.map(([label,value,tone])=><div key={label} className={`ui-section-card project-stat-card is-${tone}`}><span>{label}</span><b>{value}</b></div>)}
    </div>
    {byPerson.length>0&&<div className="ui-section-card project-effort-distribution"><div className="project-panel-subtitle">Kişi Bazlı Dağılım</div><div className="project-chip-row">{byPerson.map(([name,hours])=><span key={name} className="ui-chip ui-chip-accent">{name}: {hours} sa</span>)}</div></div>}
    <div className="project-effort-list">{rows.map(row=><div key={row.id} className="ui-section-card project-effort-row"><span className="ui-chip ui-chip-accent">{row.source}</span><div className="project-row-main"><b>{row.item}</b>{row.note&&<div>{row.note}</div>}</div><span>{row.person}</span><span>{fmt(row.date)}</span><b>{row.hours} sa</b></div>)}{!rows.length&&<div className="ui-muted-note project-empty-state">Bu projede henüz efor kaydı yok.</div>}</div>
  </div>;
}



const reportScheduleStatus = (item) => {
  if(item.lastError)return `Son hata: ${item.lastError}`;
  if(item.lastSentAt)return `Son gönderim: ${new Date(item.lastSentAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}`;
  return `Sonraki gönderim: ${item.nextRunAt?new Date(item.nextRunAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"}):"-"}`;
};

function ReportScheduleCard({item,canEdit,onToggle,onDelete}) {
  return <details style={{background:"#fff",border:"1px solid var(--border)",borderRadius:12,padding:13}}>
    <summary style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",cursor:"pointer",listStyle:"none"}}>
      <div style={{flex:1,minWidth:180}}>
        <b style={{fontSize:12}}>{item.name}</b>
        <div style={{fontSize:10,color:"var(--muted)",marginTop:3}}>{item.reportType==="jira_newsletter"?"Jira Done geliştirme bülteni":"Proje durum raporu"} · {item.frequency==="weekly"?"Haftalık":"Aylık"} · {item.time} (İstanbul) · {(item.recipients||[]).join(", ")}</div>
        <div style={{fontSize:9,color:item.lastError?"var(--danger)":"var(--muted)",marginTop:4}}>{reportScheduleStatus(item)}</div>
      </div>
      <button onClick={event=>{event.preventDefault();onToggle();}} style={{border:0,borderRadius:8,padding:"6px 9px",cursor:"pointer",background:item.enabled?"color-mix(in srgb, var(--success) 10%, white 90%)":"var(--surface-soft)",color:item.enabled?"var(--success)":"var(--muted)"}}>{item.enabled?"Aktif":"Pasif"}</button>
      {canEdit&&<button onClick={event=>{event.preventDefault();onDelete();}} style={{border:0,background:"transparent",color:"var(--danger)",cursor:"pointer"}}>Sil</button>}
    </summary>
    <div style={{borderTop:"1px solid var(--border)",marginTop:10,paddingTop:10}}>
      <b style={{fontSize:10}}>Gönderim Logu</b>
      <div style={{display:"grid",gap:5,marginTop:7}}>
        {(item.deliveryLog||[]).length?(item.deliveryLog||[]).map(log=><div key={log.id||log.at} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:9,background:log.success?"color-mix(in srgb, var(--success) 10%, white 90%)":"color-mix(in srgb, var(--danger) 9%, white 91%)",color:log.success?"var(--success)":"var(--danger)",borderRadius:7,padding:"6px 8px"}}><span>{new Date(log.at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})} · {(log.recipients||item.recipients||[]).join(", ")}</span><b>{log.success?"Gönderildi":log.error||"Başarısız"}</b></div>):<div style={{fontSize:9,color:"var(--muted)"}}>Henüz gönderim denemesi yok.</div>}
      </div>
    </div>
  </details>;
}

function ProjectOverviewPanel({project,onChange,canEdit}) {
  const [editing,setEditing]=useState(false);
  const fileInput=useRef(null);
  const location=project.location||{city:"",district:"",address:""};
  const customer=project.customerProfile||{};
  const customerName=customer.name||project.customerName||project.name;
  const modules=project.activeModules||[];
  const contacts=(project.raciContacts||[]).filter(item=>item.side==="Müşteri");
  const totalTasks=project.milestones.flatMap(milestone=>milestone.tasks||[]).length;
  const doneTasks=project.milestones.flatMap(milestone=>milestone.tasks||[]).filter(task=>task.status==="Tamamlandı").length;
  const progress=totalTasks?Math.round(doneTasks/totalTasks*100):0;
  const lateTasks=project.milestones.flatMap(milestone=>milestone.tasks||[]).filter(task=>delayLvl(task.dueDate,task.status)).length;
  const openRisks=(project.risks||[]).filter(risk=>!["Kapalı","Kapal\u0131"].includes(risk.status)).length;
  const url=mapsUrl(location);
  const updateLocation=(key,value)=>onChange({location:{...location,[key]:value}});
  const updateCustomer=(key,value)=>onChange({customerProfile:{...customer,[key]:value}});
  const uploadLogo=(file)=>readImageAsDataUrl(file,logoUrl=>updateCustomer("logoUrl",logoUrl));
  const toggleModule=(module)=>onChange({activeModules:modules.includes(module)?modules.filter(item=>item!==module):[...modules,module]});
  const statCards=[["Tamamlama",`%${progress}`,"var(--accent, #0b8a94)",`${doneTasks}/${totalTasks} görev`],["Proje Sağlığı",`%${readinessScore(project)}`,readinessScore(project)>=Number(project.readinessThreshold||80)?"var(--success, #19835c)":"var(--danger, #b93f33)","hazırlık skoru"],["Geciken",lateTasks,"var(--warning, #bf7a12)","açık termin"],["Risk",openRisks,"var(--danger, #b93f33)","açık risk"]];
  return <div className="project-panel-page project-overview-panel" style={{display:"grid",gap:14}}>
    <div style={{display:"none",background:"linear-gradient(135deg,var(--text),var(--accent) 58%,var(--accent))",borderRadius:22,padding:"clamp(18px,3vw,28px)",color:"#fff",boxShadow:"0 22px 48px rgba(67,56,202,.2)",overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",right:-60,top:-70,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,.13)"}}/>
      <div style={{display:"flex",gap:16,alignItems:"center",position:"relative",zIndex:1,flexWrap:"wrap"}}>
        <div style={{width:78,height:78,borderRadius:24,background:"rgba(255,255,255,.16)",display:"grid",placeItems:"center",overflow:"hidden",border:"1px solid rgba(255,255,255,.2)",boxShadow:"0 16px 34px rgba(15,23,42,.2)"}}>{customer.logoUrl?<img src={customer.logoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<b style={{fontSize:29}}>{customerName.slice(0,1).toUpperCase()}</b>}</div>
        <div style={{flex:1,minWidth:220}}><div style={{fontSize:11,fontWeight:900,color:"#C7D2FE",letterSpacing:1,textTransform:"uppercase"}}>Müşteri / Proje Ana Sayfası</div><h2 style={{margin:"4px 0 6px",fontSize:"clamp(23px,4vw,34px)",lineHeight:1.1}}>{customerName}</h2><div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}><span style={{fontSize:10,fontWeight:900,color:"#fff",background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,padding:"5px 9px"}}>Proje: {project.name}</span>{customer.website&&<a href={customer.website.startsWith("http")?customer.website:`https://${customer.website}`} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:900,color:"#fff",background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,padding:"5px 9px",textDecoration:"none"}}>Web sitesi</a>}{url&&<a href={url} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:900,color:"#fff",background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,padding:"5px 9px",textDecoration:"none"}}>Yol tarifi</a>}</div><div style={{fontSize:12,color:"var(--accent-ink)",lineHeight:1.55}}>{project.description||"Proje açıklaması henüz girilmedi."}</div></div>
        <div style={{display:"grid",gap:7,minWidth:190,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.16)",borderRadius:18,padding:13}}><span style={{fontSize:11,color:"var(--accent-ink)"}}>Başlangıç: <b style={{color:"#fff"}}>{fmt(project.startDate)}</b></span><span style={{fontSize:11,color:"var(--accent-ink)"}}>Hedef Bitiş: <b style={{color:"#fff"}}>{fmt(project.endDate)}</b></span><span style={{fontSize:11,color:"var(--accent-ink)"}}>Konum: <b style={{color:"#fff"}}>{[location.district,location.city].filter(Boolean).join(" / ")||"-"}</b></span></div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>{statCards.map(([label,value,color,meta])=><div key={label} className="liquid-card" style={{borderRadius:18,padding:15}}><div style={{fontSize:10,color:"var(--muted, #5b6f74)",fontWeight:850,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:26,fontWeight:950,color,marginTop:4}}>{value}</div><div style={{fontSize:10,color:"var(--muted, #5b6f74)",marginTop:2}}>{meta}</div></div>)}</div>
    <div className="admin-main-grid" style={{display:"none",gridTemplateColumns:"1.15fr .85fr",gap:14}}>
      <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:18,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:13}}><div><h3 style={{margin:0,fontSize:15}}>Müşteri Bilgileri</h3><p style={{margin:"4px 0 0",fontSize:11,color:"var(--muted)"}}>Logo, web sitesi, konum ve aktif modüller.</p></div><div style={{display:"flex",gap:7}}>{customer.website&&<a href={customer.website.startsWith("http")?customer.website:`https://${customer.website}`} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:850,color:"var(--accent)",background:"var(--accent-ink)",borderRadius:9,padding:"7px 9px",textDecoration:"none"}}>Web Sitesi</a>}{canEdit&&<button onClick={()=>setEditing(value=>!value)} style={{border:0,borderRadius:9,padding:"7px 9px",background:editing?"var(--text)":"var(--accent-ink)",color:editing?"#fff":"var(--accent)",fontSize:10,fontWeight:900,cursor:"pointer"}}>{editing?"Kapat":"Düzenle"}</button>}</div></div>
        {editing&&canEdit&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9,marginBottom:14}}><Field label="Müşteri Adı"><input style={iStyle} value={customer.name||""} onChange={event=>updateCustomer("name",event.target.value)} placeholder="Firma adı"/></Field><Field label="Müşteri Web Sitesi"><input style={iStyle} value={customer.website||""} onChange={event=>updateCustomer("website",event.target.value)} placeholder="https://firma.com"/></Field><Field label="Müşteri Logo"><div style={{display:"grid",gap:6}}><input style={iStyle} value={(customer.logoUrl||"").startsWith("data:")?"":customer.logoUrl||""} onChange={event=>updateCustomer("logoUrl",event.target.value)} placeholder="https://.../logo.png"/><button type="button" onClick={()=>fileInput.current?.click()} style={{border:0,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:9,padding:"7px 9px",fontSize:10,fontWeight:900,cursor:"pointer",textAlign:"left"}}>veya dosya yükle</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={event=>uploadLogo(event.target.files?.[0])}/></div></Field><Field label="İl"><input style={iStyle} value={location.city||""} onChange={event=>updateLocation("city",event.target.value)}/></Field><Field label="İlçe"><input style={iStyle} value={location.district||""} onChange={event=>updateLocation("district",event.target.value)}/></Field><Field label="Adres"><input style={iStyle} value={location.address||""} onChange={event=>updateLocation("address",event.target.value)} placeholder="Açık adres"/></Field></div>}
        <div style={{display:"grid",gap:8,marginBottom:13,fontSize:12,color:"var(--muted)"}}><div><b>Web:</b> {customer.website||"-"}</div><div><b>Konum:</b> {[location.address,location.district,location.city].filter(Boolean).join(", ")||"-"}</div></div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{DEFAULT_ACTIVE_MODULES.map(module=><button key={module} disabled={!editing||!canEdit} onClick={()=>toggleModule(module)} style={{border:"1px solid "+(modules.includes(module)?"#4F46E5":"var(--border)"),background:modules.includes(module)?"var(--accent-ink)":"#F8FAFC",color:modules.includes(module)?"var(--accent)":"var(--muted)",borderRadius:999,padding:"7px 10px",fontSize:10,fontWeight:850,cursor:editing&&canEdit?"pointer":"default"}}>{module}</button>)}</div>
      </div>
      <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:18,padding:18}}>
        <h3 style={{margin:"0 0 12px",fontSize:15}}>Kontaklar</h3>
        <div style={{display:"grid",gap:8}}>{contacts.slice(0,6).map((contact,index)=><div key={contact.id||index} style={{display:"flex",gap:10,alignItems:"center",background:"#F8FAFC",border:"1px solid var(--border)",borderRadius:13,padding:10}}><span style={{width:34,height:34,borderRadius:"50%",background:"var(--accent-ink)",color:"var(--accent)",display:"grid",placeItems:"center",fontWeight:900,fontSize:11}}>{(contact.name||"?").split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}</span><span style={{minWidth:0,flex:1}}><b style={{display:"block",fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{contact.name}</b><small style={{display:"block",fontSize:10,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{contact.title||contact.raci||"Kontak"}{contact.email?` · ${contact.email}`:""}</small></span></div>)}</div>
        {!contacts.length&&<div style={{padding:24,textAlign:"center",border:"1px dashed var(--muted)",borderRadius:13,color:"var(--muted)",fontSize:11}}>Müşteri kontağı henüz eklenmedi.</div>}
      </div>
    </div>
  </div>;
}

function ReadinessPanel({project,checklist,score,threshold,canEdit,onChange,updateItem}) {
  const [category,setCategory]=useState("all");
  const categories=["all",...Array.from(new Set(checklist.map(item=>item.category)))];
  const filtered=category==="all"?checklist:checklist.filter(item=>item.category===category);
  const statusMeta={
    ready:["Hazır","var(--success)","color-mix(in srgb, var(--success) 10%, white 90%)"],
    partial:["Kısmi","var(--warning)","color-mix(in srgb, var(--warning) 10%, white 90%)"],
    not_ready:["Hazır Değil","var(--danger)","color-mix(in srgb, var(--danger) 9%, white 91%)"],
    unanswered:["Bekliyor","var(--muted)","var(--surface-soft)"],
  };
  const counts=checklist.reduce((result,item)=>({...result,[item.status]:(result[item.status]||0)+1}),{});
  const reset=()=>onChange({readinessChecklist:createReadinessChecklist()});
  return <div className="project-panel-page readiness-panel" style={{display:"grid",gap:14}}>
    <div className="liquid-card" style={{borderRadius:22,padding:18}}>
      <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{width:118,height:118,borderRadius:"50%",background:`conic-gradient(${score>=threshold?"var(--success, #19835c)":"var(--danger, #b93f33)"} ${score*3.6}deg,var(--border, #cfe0e3) 0deg)`,display:"grid",placeItems:"center",flexShrink:0}}>
          <div style={{width:92,height:92,borderRadius:"50%",background:"var(--surface, #ffffff)",display:"grid",placeItems:"center",textAlign:"center"}}><b style={{fontSize:28,color:score>=threshold?"var(--success, #19835c)":"var(--danger, #b93f33)"}}>{score}</b><span style={{fontSize:9,color:"var(--muted, #5b6f74)",fontWeight:850}}>/100</span></div>
        </div>
        <div style={{flex:1,minWidth:230}}><div style={{fontSize:11,fontWeight:900,color:"var(--muted, #5b6f74)",letterSpacing:1,textTransform:"uppercase"}}>Proje Sağlığı</div><h3 style={{margin:"5px 0 6px",fontSize:22}}>{score>=threshold?"Proje Başlamaya Elverişli":"Başlamadan Önce Tamamlanmalı"}</h3><p style={{margin:0,fontSize:12,color:"var(--muted, #5b6f74)",lineHeight:1.65}}>MES projeleri için kapsam, veri, entegrasyon, OT altyapı, saha hazırlığı ve kabul maddeleri tek yerde takip edilir. Eşik değer <b>{threshold}</b>; 80 altı projelerde saha uygulamasına geçmeden önce eksikler kapatılmalı.</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,94px)",gap:8}}>{[["ready","Hazır"],["partial","Kısmi"],["not_ready","Eksik"],["unanswered","Bekleyen"]].map(([key,label])=>{const [,color,bg]=statusMeta[key];return <div key={key} style={{background:bg,borderRadius:13,padding:10,textAlign:"center"}}><b style={{display:"block",fontSize:20,color}}>{counts[key]||0}</b><span style={{fontSize:9,color,fontWeight:850}}>{label}</span></div>;})}</div>
      </div>
    </div>
    <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:2}}>{categories.map(item=><button className="btn-base" key={item} onClick={()=>setCategory(item)} style={{border:"1px solid var(--border, #cfe0e3)",borderRadius:999,padding:"8px 12px",background:category===item?"var(--accent, #0b8a94)":"var(--surface, #ffffff)",color:category===item?"#fff":"var(--muted, #5b6f74)",fontSize:10,fontWeight:900,cursor:"pointer",whiteSpace:"nowrap"}}>{item==="all"?"Tüm Kategoriler":item}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(360px,100%),1fr))",gap:10}}>{filtered.map(item=>{const [label,color,bg]=statusMeta[item.status]||statusMeta.unanswered;return <div key={item.id} className="liquid-card" style={{borderRadius:18,padding:14}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:12,background:bg,color,display:"grid",placeItems:"center",flexShrink:0}}><Icon name={item.status==="ready"?"check":"clock"} size={16}/></span><div style={{flex:1,minWidth:0}}><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:9,fontWeight:900,color:"var(--accent, #0b8a94)",background:"var(--accent-ink, #def5f8)",borderRadius:999,padding:"3px 7px"}}>{item.category}</span><span style={{fontSize:9,fontWeight:900,color,background:bg,borderRadius:999,padding:"3px 7px"}}>{label}</span><span style={{fontSize:9,color:"var(--muted, #5b6f74)"}}>Ağırlık {item.weight}</span></div>{canEdit?<input style={{...iStyle,border:0,padding:"8px 0",fontWeight:850,fontSize:12,background:"transparent"}} value={item.text} onChange={event=>updateItem(item.id,{text:event.target.value})}/>:<b style={{display:"block",fontSize:12,marginTop:8,lineHeight:1.45}}>{item.text}</b>}</div></div>
      {canEdit&&<div style={{display:"grid",gridTemplateColumns:"1fr 72px auto",gap:8,alignItems:"center",marginTop:10}}><select style={iStyle} value={item.status} onChange={event=>updateItem(item.id,{status:event.target.value})}><option value="unanswered">Bekliyor</option><option value="ready">Hazır</option><option value="partial">Kısmi</option><option value="not_ready">Hazır Değil</option></select><input type="number" min="1" max="100" style={iStyle} value={item.weight} onChange={event=>updateItem(item.id,{weight:event.target.value})}/><button title="Sil" onClick={()=>onChange({readinessChecklist:checklist.filter(entry=>entry.id!==item.id)})} style={{border:0,background:"color-mix(in srgb, var(--danger) 9%, white 91%)",color:"var(--danger)",borderRadius:10,padding:"9px 11px",cursor:"pointer"}}>Sil</button></div>}
      <textarea disabled={!canEdit} style={{...iStyle,minHeight:64,resize:"vertical",marginTop:9,fontSize:11,background:canEdit?"var(--surface-soft, #f6fafb)":"var(--surface, #ffffff)"}} value={item.note||""} onChange={event=>updateItem(item.id,{note:event.target.value})} placeholder="Kanıt, eksik veya aksiyon notu"/>
    </div>;})}</div>
    {canEdit&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Btn small onClick={()=>onChange({readinessChecklist:[...checklist,{id:uid(),category:"Özel",text:"Yeni kontrol maddesi",weight:1,status:"unanswered",note:""}]})}>+ Kontrol Maddesi</Btn><Btn small variant="secondary" onClick={reset}>MES Şablonunu Sıfırla</Btn></div>}
  </div>;
}

function TrainingPanel({project,onChange,canEdit,people}) {
  const trainings=project.trainings||[];
  const empty={scope:TRAINING_SCOPES[0],title:"",date:todayStr(),trainerId:"",participants:"",notes:""};
  const [form,setForm]=useState(empty);
  const [search,setSearch]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const save=()=>{
    if(!form.title.trim())return;
    onChange({trainings:[{...form,id:uid(),createdAt:now(),title:form.title.trim(),participants:form.participants.split(",").map(item=>item.trim()).filter(Boolean)},...trainings]});
    setForm(empty);
  };
  const filtered=trainings.filter(item=>`${item.scope} ${item.title} ${item.notes}`.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));
  return <div className="project-panel-page training-panel">
    <div className="project-panel-header"><div><h3>Eğitimler</h3><p>Proje kapsamındaki eğitimleri, katılımcıları ve devir notlarını takip edin.</p></div><div className="project-panel-tools"><button type="button" className={`toolbar-search-toggle ${searchOpen||search?"is-active":""}`} title="Eğitimlerde ara" aria-label="Eğitimlerde ara" onClick={()=>setSearchOpen(value=>!value)}><Icon name="search" size={15}/></button>{(searchOpen||search)&&<input className="toolbar-search-input" style={iStyle} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Eğitimlerde ara..." autoFocus/>}</div></div>
    {canEdit&&<div className="ui-section-card training-form-card"><Field label="Kapsam"><select style={iStyle} value={form.scope} onChange={event=>update("scope",event.target.value)}>{TRAINING_SCOPES.map(scope=><option key={scope}>{scope}</option>)}</select></Field><Field label="Başlık"><input style={iStyle} value={form.title} onChange={event=>update("title",event.target.value)} placeholder="Örn. Operatör vardiya eğitimi"/></Field><Field label="Tarih"><input type="date" style={iStyle} value={form.date} onChange={event=>update("date",event.target.value)}/></Field><Field label="Eğitmen"><select style={iStyle} value={form.trainerId} onChange={event=>update("trainerId",event.target.value)}><option value="">- Seç -</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Katılımcılar"><input style={iStyle} value={form.participants} onChange={event=>update("participants",event.target.value)} placeholder="Virgül ile yazın"/></Field><Field label="Not"><input style={iStyle} value={form.notes} onChange={event=>update("notes",event.target.value)} placeholder="Kapsam, eksik kalanlar, sonraki eğitim"/></Field><div className="project-form-action"><Btn onClick={save}>Eğitimi Kaydet</Btn></div></div>}
    <div className="training-grid">{filtered.map(item=>{const trainer=people.find(person=>person.id===item.trainerId);return <div key={item.id} className="ui-section-card training-card"><div className="project-card-title-row"><b>{item.title}</b><span className="ui-chip ui-chip-info">{item.scope}</span></div><div className="project-card-meta">{fmt(item.date)}{trainer?` · ${trainer.name}`:""}{item.participants?.length?` · ${item.participants.length} katılımcı`:""}{item.notes?` · ${item.notes}`:""}</div>{canEdit&&<button className="inline-text-action is-danger" onClick={()=>onChange({trainings:trainings.filter(entry=>entry.id!==item.id)})}>Sil</button>}</div>;})}</div>
    {!filtered.length&&<div className="ui-muted-note project-empty-state">Eğitim kaydı bulunmuyor.</div>}
  </div>;
}

function ProjectCostPanel({project,onChange,state,canEdit}) {
  const settings=projectCostSettings(project);
  const costs=project.costItems||[];
  const empty={category:"Yetkili Servis İşçilik",description:"",date:todayStr(),amountUsd:"",amountTry:"",note:""};
  const [form,setForm]=useState(empty);
  const updateSettings=(key,value)=>onChange({costSettings:{...settings,[key]:Number(value)||0}});
  const save=()=>{
    if(!form.description.trim())return;
    const amountUsd=form.amountUsd?Number(form.amountUsd):(Number(form.amountTry)||0)/(settings.usdTry||1);
    onChange({costItems:[{...form,id:uid(),amountUsd:Math.round(amountUsd*100)/100,amountTry:form.amountTry?Number(form.amountTry):Math.round(amountUsd*(settings.usdTry||1)),createdAt:now()},...costs]});
    setForm(empty);
  };
  const visitCosts=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)&&Number(plan.roundTripKm)>0).map(plan=>{const c=fuelCost({roundTripKm:plan.roundTripKm,settings});const person=state.people.find(item=>item.id===plan.userId);return {id:`visit-${plan.id}`,category:"Saha Yakıt",description:`${person?.name||"Kullanıcı"} · ${fmt(plan.date)} saha ziyareti`,date:plan.date,amountUsd:c.usdAmount,amountTry:c.tryAmount,meta:`${plan.roundTripKm} km · ${c.liters} L`};});
  const effortHours=[
    ...(project.milestones||[]).flatMap(milestone=>(milestone.tasks||[]).flatMap(task=>(task.timeEntries||[]).map(entry=>Number(entry.hours)||0))),
    ...(((state.projectActions||{})[project.id])||[]).map(action=>Number(action.effortHours)||0),
    ...(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).map(plan=>fieldPlanHours(plan))
  ].reduce((sum,value)=>sum+value,0);
  const laborCost=effortHours>0?{id:"auto-labor",category:"Efor İşçilik",description:"Projeye girilen toplam efor maliyeti",date:todayStr(),amountUsd:Math.round(effortHours*(Number(settings.laborUsdPerHour)||0)*100)/100,amountTry:Math.round(effortHours*(Number(settings.laborUsdPerHour)||0)*(settings.usdTry||1)),meta:`${effortHours} saat · ${settings.laborUsdPerHour}/sa`}:null;
  const accommodationCosts=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&plan.accommodationRequired).map(plan=>{const person=state.people.find(item=>item.id===plan.userId);const days=Number(plan.accommodationDays)||1;const usd=days*(Number(settings.accommodationUsdPerDay)||0);return {id:`accommodation-${plan.id}`,category:"Konaklama",description:`${person?.name||"Kullanıcı"} · ${fmt(plan.date)} konaklama`,date:plan.date,amountUsd:usd,amountTry:Math.round(usd*(settings.usdTry||1)),meta:`${days} gün · ${settings.accommodationUsdPerDay}/gün`};});
  const manual=costs.map(item=>({...item,amountUsd:Number(item.amountUsd)||0,amountTry:item.amountTry?Number(item.amountTry):Math.round((Number(item.amountUsd)||0)*(settings.usdTry||1))}));
  const rows=[...visitCosts,...(laborCost?[laborCost]:[]),...accommodationCosts,...manual];
  const totalUsd=rows.reduce((sum,item)=>sum+(Number(item.amountUsd)||0),0);
  const totalTry=rows.reduce((sum,item)=>sum+(Number(item.amountTry)||0),0);
  const stats=[["Toplam USD",`$${totalUsd.toFixed(2)}`,"info"],["Toplam TL",`${Math.round(totalTry).toLocaleString("tr-TR")} TL`,"success"],["Yakıt Kaydı",visitCosts.length,"warning"],["Manuel Kalem",manual.length,"accent"]];
  return <div className="project-panel-page project-cost-panel">
    <div className="project-panel-stats">{stats.map(([label,value,tone])=><div key={label} className={`ui-section-card project-stat-card is-${tone}`}><span>{label}</span><b>{value}</b></div>)}</div>
    {canEdit&&<div className="ui-section-card project-cost-form"><div className="project-cost-settings"><Field label="Yakıt L/100km"><input type="number" step=".1" style={iStyle} value={settings.fuelConsumptionLtPer100Km} onChange={event=>updateSettings("fuelConsumptionLtPer100Km",event.target.value)}/></Field><Field label="Benzin TL/L"><input type="number" step=".01" style={iStyle} value={settings.fuelTryPerLt} onChange={event=>updateSettings("fuelTryPerLt",event.target.value)}/></Field><Field label="USD/TL"><input type="number" step=".01" style={iStyle} value={settings.usdTry} onChange={event=>updateSettings("usdTry",event.target.value)}/></Field><Field label="Adam/Saat USD"><input type="number" step=".01" style={iStyle} value={settings.laborUsdPerHour} onChange={event=>updateSettings("laborUsdPerHour",event.target.value)}/></Field><Field label="Konaklama USD/Gün"><input type="number" step=".01" style={iStyle} value={settings.accommodationUsdPerDay} onChange={event=>updateSettings("accommodationUsdPerDay",event.target.value)}/></Field></div><div className="project-cost-entry"><Field label="Kategori"><select style={iStyle} value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{COST_CATEGORIES.filter(item=>item!=="Saha Yakıt").map(item=><option key={item}>{item}</option>)}</select></Field><Field label="Açıklama"><input style={iStyle} value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></Field><Field label="Tarih"><input type="date" style={iStyle} value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></Field><Field label="Tutar USD"><input type="number" step=".01" style={iStyle} value={form.amountUsd} onChange={event=>setForm({...form,amountUsd:event.target.value})}/></Field><Field label="veya Tutar TL"><input type="number" step=".01" style={iStyle} value={form.amountTry} onChange={event=>setForm({...form,amountTry:event.target.value})}/></Field><Field label="Not"><input style={iStyle} value={form.note} onChange={event=>setForm({...form,note:event.target.value})}/></Field><div className="project-form-action"><Btn onClick={save}>Maliyet Ekle</Btn></div></div></div>}
    <div className="project-cost-list">{rows.map(row=><div key={row.id} className="ui-section-card project-cost-row"><span className="ui-chip ui-chip-accent">{row.category}</span><div className="project-row-main"><b>{row.description}</b>{row.meta&&<div>{row.meta}</div>}</div><span>{fmt(row.date)}</span><b>${Number(row.amountUsd||0).toFixed(2)}</b>{canEdit&&row.id&&!String(row.id).startsWith("visit-")&&!String(row.id).startsWith("auto-")&&!String(row.id).startsWith("accommodation-")?<button className="inline-text-action is-danger" onClick={()=>onChange({costItems:costs.filter(item=>item.id!==row.id)})}>Sil</button>:<span/>}</div>)}</div>
    {!rows.length&&<div className="ui-muted-note project-empty-state">Maliyet kaydı bulunmuyor.</div>}
  </div>;
}

function LessonsLearnedPanel({project,onChange,canEdit,currentUser}) {
  const lessons=project.lessonsLearned||[];
  const [form,setForm]=useState({title:"",category:"Tekrar Eden Problem",lesson:"",prevention:""});
  const save=()=>{
    if(!form.title.trim()&&!form.lesson.trim())return;
    onChange({lessonsLearned:[{id:uid(),...form,title:form.title.trim()||"Öğrenilmiş ders",lesson:form.lesson.trim(),prevention:form.prevention.trim(),authorId:currentUser?.id||"",authorName:currentUser?.name||"Kullanıcı",createdAt:now()},...lessons]});
    setForm({title:"",category:"Tekrar Eden Problem",lesson:"",prevention:""});
  };
  return <div className="project-panel-page lessons-panel">
    {canEdit&&<div className="ui-section-card lesson-form-card">
      <div className="lesson-form-grid"><Field label="Başlık"><input style={iStyle} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></Field><Field label="Kategori"><select style={iStyle} value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{["Tekrar Eden Problem","Kurulum","Entegrasyon","Müşteri İletişimi","Saha Operasyonu","Eğitim","Diğer"].map(item=><option key={item}>{item}</option>)}</select></Field></div>
      <Field label="Ne öğrendik?"><textarea style={{...iStyle,minHeight:80,resize:"vertical"}} value={form.lesson} onChange={event=>setForm({...form,lesson:event.target.value})}/></Field>
      <Field label="Tekrar etmemesi için aksiyon"><textarea style={{...iStyle,minHeight:64,resize:"vertical"}} value={form.prevention} onChange={event=>setForm({...form,prevention:event.target.value})}/></Field>
      <div className="project-form-action"><Btn onClick={save}>Kaydet</Btn></div>
    </div>}
    <div className="lesson-list">{lessons.map(item=><div key={item.id} className="ui-section-card lesson-card"><div className="project-card-title-row"><b>{item.title}</b><span className="ui-chip ui-chip-warning">{item.category}</span></div><div className="lesson-text">{item.lesson}</div>{item.prevention&&<div className="lesson-prevention"><b>Önleyici aksiyon:</b> {item.prevention}</div>}<div className="project-card-meta">{item.authorName} · {new Date(item.createdAt||now()).toLocaleString("tr-TR")}</div>{canEdit&&<button className="inline-text-action is-danger" onClick={()=>onChange({lessonsLearned:lessons.filter(lesson=>lesson.id!==item.id)})}>Sil</button>}</div>)}</div>
    {!lessons.length&&<div className="ui-muted-note project-empty-state">Bu proje için henüz öğrenilmiş ders yok.</div>}
  </div>;
}

function InvoiceMilestonePanel({project,onChange}) {
  const rows=project.invoiceMilestones||[];
  const [form,setForm]=useState({milestoneId:"",title:"",amount:"",conditions:""});
  const downloadMonthlyReport=()=>{
    const grouped={};
    rows.forEach(row=>{
      const milestone=(project.milestones||[]).find(item=>item.id===row.milestoneId);
      const month=(milestone?.dueDate||"Tarihsiz").slice(0,7);
      if(!grouped[month])grouped[month]=[];
      grouped[month].push({row,milestone});
    });
    const body=Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([month,items])=>`<h2>${escapeHtml(month)}</h2><table><thead><tr><th>Milestone</th><th>Termin</th><th>Fatura Kalemi</th><th>Tutar/Oran</th><th>Durum</th></tr></thead><tbody>${items.map(({row,milestone})=>{const ready=milestone?milestone.tasks?.length>0&&milestone.tasks.every(task=>task.status==="Tamamlandı"):false;return `<tr><td>${escapeHtml(milestone?.name||"-")}</td><td>${escapeHtml(milestone?.dueDate||"-")}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.amount||"-")}</td><td>${ready?"Faturalanabilir":"Tamamlanırsa kesilebilir"}</td></tr>`;}).join("")}</tbody></table>`).join("");
    const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(project.name)} - Aylık Fatura Potansiyeli</title><style>body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;padding:28px;background:#f8fafc}h1{margin:0 0 4px}.meta{color:#64748b;margin-bottom:20px}h2{margin-top:22px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px}th{background:#eef2ff;color:#4338ca}</style></head><body><h1>Aylık Fatura Potansiyeli</h1><div class="meta">${escapeHtml(project.name)} · ${new Date().toLocaleDateString("tr-TR")}</div>${body||"<p>Fatura koşulu yok.</p>"}</body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`${project.name.replace(/[^a-zA-Z0-9_-]/g,"_")}-fatura-potansiyeli.html`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  };
  const save=()=>{
    if(!form.milestoneId&&!form.title.trim())return;
    const milestone=(project.milestones||[]).find(item=>item.id===form.milestoneId);
    onChange({invoiceMilestones:[{id:uid(),...form,title:form.title.trim()||milestone?.name||"Fatura koşulu",createdAt:now()},...rows]});
    setForm({milestoneId:"",title:"",amount:"",conditions:""});
  };
  return <div className="project-panel-page invoice-panel">
    <div style={{background:"color-mix(in srgb, var(--warning) 10%, white 90%)",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 13px",fontSize:11,color:"#9A3412",marginBottom:12,display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}><span>Yalnızca yöneticiler görür. Milestone tamamlandığında hangi fatura kaleminin kesilebilir olduğunu takip eder.</span><Btn small variant="secondary" onClick={downloadMonthlyReport}>Aylık Fatura Raporu</Btn></div>
    <div className="ui-section-card project-inline-form" style={{background:"#fff",border:"1px solid var(--border)",borderRadius:14,padding:14,marginBottom:13,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}><Field label="Milestone"><select style={iStyle} value={form.milestoneId} onChange={event=>setForm({...form,milestoneId:event.target.value})}><option value="">- Seç -</option>{(project.milestones||[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Fatura Kalemi"><input style={iStyle} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></Field><Field label="Tutar / Oran"><input style={iStyle} value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})}/></Field><Field label="Koşul"><input style={iStyle} value={form.conditions} onChange={event=>setForm({...form,conditions:event.target.value})}/></Field><div style={{alignSelf:"end"}}><Btn onClick={save}>Ekle</Btn></div></div>
    <div style={{display:"grid",gap:8}}>{rows.map(row=>{const milestone=(project.milestones||[]).find(item=>item.id===row.milestoneId);const ready=milestone?milestone.tasks?.length>0&&milestone.tasks.every(task=>task.status==="Tamamlandı"):false;return <div key={row.id} style={{background:"#fff",border:"1px solid var(--border)",borderLeft:`4px solid ${ready?"var(--success)":"var(--warning)"}`,borderRadius:12,padding:13,display:"flex",justifyContent:"space-between",gap:10}}><div><b>{row.title}</b><div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{milestone?.name||"Milestone seçilmedi"} · Termin: {fmt(milestone?.dueDate)} · {row.amount||"Tutar yok"}</div>{row.conditions&&<div style={{fontSize:11,color:"var(--text)",marginTop:5}}>{row.conditions}</div>}</div><div style={{textAlign:"right"}}><span style={{display:"inline-block",background:ready?"color-mix(in srgb, var(--success) 10%, white 90%)":"color-mix(in srgb, var(--warning) 10%, white 90%)",color:ready?"var(--success)":"var(--warning)",borderRadius:8,padding:"5px 8px",fontSize:10,fontWeight:900}}>{ready?"Faturalanabilir":"Bekliyor"}</span><button onClick={()=>onChange({invoiceMilestones:rows.filter(item=>item.id!==row.id)})} style={{display:"block",marginTop:7,border:0,background:"transparent",color:"var(--danger)",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button></div></div>;})}</div>
  </div>;
}

function CommunicationPlanPanel({project,onChange,state,setState,canEdit}) {
  const plans=project.communicationPlans||[];
  const customerContacts=[...(project.raciContacts||[]),...(project.customerContacts||[])].filter(item=>item.side==="Müşteri"||item.legacyCustomerContact||item.email||item.phone);
  const [form,setForm]=useState({companyUserId:"",method:"Arama",customerContactId:"",frequency:"Haftalık",note:""});
  const save=()=>{
    if(!form.companyUserId||!form.customerContactId)return;
    const contact=customerContacts.find(item=>item.id===form.customerContactId);
    const person=state.people.find(item=>item.id===form.companyUserId);
    const item={id:uid(),...form,customerContactName:contact?.name||"",companyUserName:person?.name||"",createdAt:now()};
    onChange({communicationPlans:[item,...plans]});
    setState(current=>({...current,personalTasks:[{id:uid(),title:`İletişim planı: ${project.name}`,projectId:project.id,status:"Bekliyor",priority:"Orta",assignee:form.companyUserId,startDate:todayStr(),startTime:new Date().toTimeString().slice(0,5),dueDate:todayStr(),dueTime:"17:00",estimatedHours:"",notes:`${form.frequency} ${form.method}: ${contact?.name||"müşteri kontağı"}`,createdBy:"system",createdAt:now()},...(current.personalTasks||[])],notifications:[{id:uid(),ts:now(),userId:form.companyUserId,msg:`${project.name} iletişim planı görevi size atandı.`,projectName:project.name,read:false},...(current.notifications||[])]}));
    setForm({companyUserId:"",method:"Arama",customerContactId:"",frequency:"Haftalık",note:""});
  };
  return <div className="project-panel-page communication-panel">
    <div style={{background:"var(--accent-ink)",color:"var(--accent)",borderRadius:11,padding:"10px 13px",fontSize:11,marginBottom:12}}>Şirket kontağı, müşteri kontağı, metod ve sıklık bazında iletişim ritmini tanımlar. Bizim taraftaki kişiye takip görevi otomatik düşer.</div>
    {canEdit&&<div className="ui-section-card project-inline-form" style={{background:"#fff",border:"1px solid var(--border)",borderRadius:14,padding:14,marginBottom:13,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}><Field label="Bizim Taraftaki Kişi"><select style={iStyle} value={form.companyUserId} onChange={event=>setForm({...form,companyUserId:event.target.value})}><option value="">- Seç -</option>{state.people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="İletişim Metodu"><select style={iStyle} value={form.method} onChange={event=>setForm({...form,method:event.target.value})}>{["Arama","Mail","Yüz yüze","Online toplantı","WhatsApp","Diğer"].map(item=><option key={item}>{item}</option>)}</select></Field><Field label="Müşteri Kontağı"><select style={iStyle} value={form.customerContactId} onChange={event=>setForm({...form,customerContactId:event.target.value})}><option value="">- Seç -</option>{customerContacts.map(contact=><option key={contact.id} value={contact.id}>{contact.name} {contact.title?`· ${contact.title}`:""}</option>)}</select></Field><Field label="Sıklık"><select style={iStyle} value={form.frequency} onChange={event=>setForm({...form,frequency:event.target.value})}>{["Günlük","Haftalık","İki haftada bir","Aylık","Milestone bazlı","İhtiyaç halinde"].map(item=><option key={item}>{item}</option>)}</select></Field><Field label="Not"><input style={iStyle} value={form.note} onChange={event=>setForm({...form,note:event.target.value})}/></Field><div style={{alignSelf:"end"}}><Btn onClick={save}>Planı Ekle</Btn></div></div>}
    <div style={{display:"grid",gap:8}}>{plans.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid var(--border)",borderLeft:"4px solid var(--accent)",borderRadius:12,padding:13,display:"flex",justifyContent:"space-between",gap:10}}><div><b>{item.companyUserName||state.people.find(person=>person.id===item.companyUserId)?.name}</b><div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>{item.method} · {item.customerContactName||customerContacts.find(contact=>contact.id===item.customerContactId)?.name||"Müşteri kontağı"} · {item.frequency}</div>{item.note&&<div style={{fontSize:11,color:"var(--text)",marginTop:5}}>{item.note}</div>}</div>{canEdit&&<button onClick={()=>onChange({communicationPlans:plans.filter(plan=>plan.id!==item.id)})} style={{border:0,background:"transparent",color:"var(--danger)",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button>}</div>)}</div>
    {!plans.length&&<div style={{padding:36,textAlign:"center",border:"1px dashed var(--muted)",borderRadius:12,color:"var(--muted)"}}>İletişim planı bulunmuyor.</div>}
  </div>;
}

export function ProjectSetupPanel({project,onChange,canEdit,customerView=false,state,setState,currentUser,isAdmin,authHeaders,updateApiStateVersion,AIWorkspaceComponent=()=>null}) {
  const [section,setSection]=useState("overview");
  const customerSections=["overview","readiness","training","raci","machines","commissioning"];
  const [contact,setContact]=useState({side:"M\u00fc\u015fteri",name:"",title:"",company:"",department:"",email:"",phone:"",raci:"C",scope:""});
  const [document,setDocument]=useState({name:"",purpose:"",tags:"",url:"",owner:"",version:"1.0"});
  const emptySchedule={name:"",reportType:"project_status",recipients:"",frequency:"weekly",weekday:"1",time:"09:00",timezone:"Europe/Istanbul",enabled:true};
  const [schedule,setSchedule]=useState(emptySchedule);
  const checklist=project.readinessChecklist||createReadinessChecklist();
  const score=readinessScore({...project,readinessChecklist:checklist});
  const threshold=Number(project.readinessThreshold||80);
  const tenantName=state.tenantProfile?.name||state.mailSettings?.companyName||"Ürünü satın alan firma";
  const projectPartyName=project.customerProfile?.name||project.name||"Proje";
  const updateItem=(id,data)=>onChange({readinessChecklist:checklist.map(item=>item.id===id?{...item,...data}:item)});
  const addContact=()=>{if(!contact.name.trim())return;onChange({raciContacts:[...(project.raciContacts||[]),{...contact,id:uid()}]});setContact({side:"M\u00fc\u015fteri",name:"",title:"",company:"",department:"",email:"",phone:"",raci:"C",scope:""});};
  const legacyCustomerContacts=(project.customerContacts||[]).map(item=>({...item,side:item.side||"Müşteri",raci:item.raci||"I",scope:item.scope||"Eski müşteri kontağı",legacyCustomerContact:true}));
  const raciRows=[...(project.raciContacts||[]),...legacyCustomerContacts];
  const deleteRaciRow=(item)=>item.legacyCustomerContact
    ? onChange({customerContacts:(project.customerContacts||[]).filter(contact=>contact.id!==item.id)})
    : onChange({raciContacts:(project.raciContacts||[]).filter(contact=>contact.id!==item.id)});
  const addDocument=()=>{if(!document.name.trim())return;onChange({documents:[...(project.documents||[]),{...document,id:uid(),tags:document.tags.split(",").map(x=>x.trim()).filter(Boolean),createdAt:now()}]});setDocument({name:"",purpose:"",tags:"",url:"",owner:"",version:"1.0"});};
  const addSchedule=()=>{if(!schedule.name.trim()||!schedule.recipients.trim())return;onChange({reportSchedules:[...(project.reportSchedules||[]),{...schedule,id:uid(),recipients:schedule.recipients.split(",").map(x=>x.trim()).filter(Boolean),createdAt:now(),nextRunAt:nextReportRunAt(schedule)}]});setSchedule(emptySchedule);};
  const tabs=[["overview","Özet"],["readiness","Proje Sağlığı"],["training","Eğitimler"],["cost","Proje Maliyeti"],...(isAdmin?[["billing","Fatura Koşulları"]]:[]),["raci","RACI ve Kontaklar"],["communication","İletişim Planı"],["access","Uzaktan Erişim"],["machines","Makineler"],...(project.commissioningTracking?[["commissioning","Devreye Alma"]]:[]),["effort","Efor"],["lessons","Öğrenilmiş Dersler"],["documents","Dokümanlar"],["automation","Ayarlar / Rapor"],["ai","AI Proje Yorumu"]].filter(([id])=>!customerView||customerSections.includes(id));
  useEffect(()=>{if(customerView&&!customerSections.includes(section))setSection("overview");},[customerView,section]);
  return <div className="project-section project-setup-shell">
    <div className="glass-surface project-subtab-shell" style={{borderRadius:18,padding:8,marginBottom:16}}>
      <div className="project-tab-scroll">{tabs.map(([id,label])=><button key={id} className={`project-tab ${section===id?"is-active":""}`} onClick={()=>setSection(id)}>{label}</button>)}</div>
    </div>
    {section==="overview"&&<ProjectOverviewPanel project={project} onChange={onChange} canEdit={canEdit}/>}
    {section==="readiness"&&<ReadinessPanel project={project} checklist={checklist} score={score} threshold={threshold} canEdit={canEdit} onChange={onChange} updateItem={updateItem}/>}
    {section==="training"&&<TrainingPanel project={project} onChange={onChange} canEdit={canEdit} people={state.people}/>}
    {section==="cost"&&<ProjectCostPanel project={project} onChange={onChange} state={state} canEdit={canEdit}/>}
    {section==="billing"&&isAdmin&&<InvoiceMilestonePanel project={project} onChange={onChange}/>}
    {section==="raci"&&<div>
      <div style={{background:"var(--accent-ink)",color:"var(--accent)",borderRadius:11,padding:"10px 13px",fontSize:11,marginBottom:12}}><b>R</b> yapan, <b>A</b> nihai hesap veren, <b>C</b> görüşü alınan, <b>I</b> bilgilendirilen. Her kapsam için tek bir A belirlenmesi önerilir.</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#fff",fontSize:11}}><thead><tr>{["Taraf","Ad Soyad","Unvan / Departman","RACI","Sorumluluk Kapsam\u0131","Kontak",""].map(x=><th key={x} style={{textAlign:"left",padding:10,background:"#F8FAFC",borderBottom:"1px solid var(--border)"}}>{x}</th>)}</tr></thead><tbody>{raciRows.map(item=><tr key={`${item.legacyCustomerContact?"legacy":"raci"}-${item.id}`}><td style={{padding:9}}>{item.side}{item.legacyCustomerContact&&<span style={{display:"block",fontSize:9,color:"var(--warning)",fontWeight:800}}>Eski kontak</span>}</td><td style={{padding:9,fontWeight:750}}>{item.name}</td><td style={{padding:9}}>{item.title}{item.department?` / ${item.department}`:""}</td><td style={{padding:9,color:"#4F46E5",fontWeight:850}}>{item.raci}</td><td style={{padding:9}}>{item.scope}</td><td style={{padding:9}}>{item.email}<br/>{item.phone}</td><td>{canEdit&&<button onClick={()=>deleteRaciRow(item)} style={{border:0,background:"transparent",color:"var(--danger)",cursor:"pointer"}}>Sil</button>}</td></tr>)}</tbody></table></div>
      {canEdit&&<div className="ui-section-card project-inline-form" style={{background:"#fff",border:"1px solid var(--border)",borderRadius:13,padding:13,marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}><select style={iStyle} value={contact.side} onChange={e=>setContact({...contact,side:e.target.value})}><option value="Bizim Taraf">{tenantName}</option><option value="Müşteri">{projectPartyName}</option><option value="Partner/Tedarikçi">Partner / Tedarikçi</option></select>{["name","title","company","department","email","phone","scope"].map(key=><input key={key} style={iStyle} value={contact[key]} onChange={e=>setContact({...contact,[key]:e.target.value})} placeholder={({name:"Ad Soyad",title:"Unvan",company:"Şirket",department:"Departman",email:"E-posta",phone:"Telefon",scope:"Sorumluluk kapsamı"})[key]}/>)}<select style={iStyle} value={contact.raci} onChange={e=>setContact({...contact,raci:e.target.value})}>{["R","A","C","I"].map(x=><option key={x}>{x}</option>)}</select><Btn onClick={addContact}>Kontağı Ekle</Btn></div>}
    </div>}
    {section==="communication"&&<CommunicationPlanPanel project={project} onChange={onChange} state={state} setState={setState} canEdit={canEdit}/>}
    {section==="access"&&<RemoteAccessPanel project={project} state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} canManage={canEdit} authHeaders={authHeaders} updateApiStateVersion={updateApiStateVersion}/>}
    {section==="machines"&&<SharedMachinePanel project={project} canEdit={canEdit} currentUser={currentUser} onChange={machines=>onChange({machines})}/>}
    {section==="commissioning"&&project.commissioningTracking&&<SharedCommissioningPanel project={project} canEdit={canEdit} onChange={commissioningTree=>onChange({commissioningTree})}/>}
    {section==="effort"&&<ProjectEffortPanel project={project} state={state} people={state.people}/>}
    {section==="lessons"&&<LessonsLearnedPanel project={project} onChange={onChange} canEdit={canEdit} currentUser={currentUser}/>}
    {section==="documents"&&<div>
      <div style={{background:"#F0F9FF",color:"#0369A1",borderRadius:11,padding:"10px 13px",fontSize:11,marginBottom:12}}>Dosyanın kendisi yerine şimdilik OneDrive bağlantısı ve metadata saklanır. Microsoft Graph bağlantısı eklendiğinde aynı kayıt modeli doğrudan yüklemeyi destekleyecek.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:9}}>{(project.documents||[]).map(item=><div key={item.id} style={{background:"#fff",border:"1px solid var(--border)",borderRadius:12,padding:13}}><div style={{display:"flex",justifyContent:"space-between"}}><b>{item.name}</b><span style={{fontSize:9}}>v{item.version}</span></div><div style={{fontSize:11,color:"var(--muted)",marginTop:5}}>{item.purpose}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:7}}>{(item.tags||[]).map(tag=><span key={tag} style={{background:"var(--accent-ink)",color:"var(--accent)",borderRadius:6,padding:"2px 6px",fontSize:9}}>{tag}</span>)}</div><div style={{display:"flex",gap:9,marginTop:9}}>{item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:800,color:"var(--accent)"}}>OneDrive'da Aç</a>}{canEdit&&<button onClick={()=>onChange({documents:(project.documents||[]).filter(x=>x.id!==item.id)})} style={{border:0,background:"transparent",color:"var(--danger)",fontSize:10,cursor:"pointer"}}>Sil</button>}</div></div>)}</div>
      {canEdit&&<div className="ui-section-card project-inline-form" style={{background:"#fff",border:"1px solid var(--border)",borderRadius:13,padding:13,marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>{["name","purpose","tags","url","owner","version"].map(key=><input key={key} style={iStyle} value={document[key]} onChange={e=>setDocument({...document,[key]:e.target.value})} placeholder={({name:"Doküman adı",purpose:"Amaç / kategori",tags:"Etiketler (virgüllü)",url:"OneDrive linki",owner:"Doküman sahibi",version:"Versiyon"})[key]}/>)}<Btn onClick={addDocument}>Doküman Ekle</Btn></div>}
    </div>}
    {section==="automation"&&<div>
      <div style={{display:"grid",gap:8}}>{(project.reportSchedules||[]).map(item=><ReportScheduleCard key={item.id} item={item} canEdit={canEdit} onToggle={()=>onChange({reportSchedules:(project.reportSchedules||[]).map(x=>x.id===item.id?{...x,enabled:!x.enabled}:x)})} onDelete={()=>onChange({reportSchedules:(project.reportSchedules||[]).filter(x=>x.id!==item.id)})}/>)}</div>
      {canEdit&&<div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:13,padding:13,marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}><input style={iStyle} value={schedule.name} onChange={e=>setSchedule({...schedule,name:e.target.value})} placeholder="Plan adı"/><select style={iStyle} value={schedule.reportType} onChange={e=>setSchedule({...schedule,reportType:e.target.value})}><option value="project_status">Proje Durum Raporu</option><option value="jira_newsletter">Jira Done Newsletter</option></select><input style={iStyle} value={schedule.recipients} onChange={e=>setSchedule({...schedule,recipients:e.target.value})} placeholder="Alıcı e-postaları"/><select style={iStyle} value={schedule.frequency} onChange={e=>setSchedule({...schedule,frequency:e.target.value})}><option value="weekly">Haftalık</option><option value="monthly">Aylık</option></select>{schedule.frequency==="weekly"&&<select style={iStyle} value={schedule.weekday} onChange={e=>setSchedule({...schedule,weekday:e.target.value})}>{["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"].map((day,index)=><option key={day} value={index}>{day}</option>)}</select>}<input type="time" title="Europe/Istanbul saat dilimi" style={iStyle} value={schedule.time} onChange={e=>setSchedule({...schedule,time:e.target.value})}/><Btn onClick={addSchedule}>Planla</Btn></div>}
    </div>}
    {section==="ai"&&<AIWorkspaceComponent projects={[project]} initialProjectId={project.id} embedded/>}
  </div>;
}

function ResponsibilityFilterRow({item,index,active,onClick}) {
  const color=COLORS[index%COLORS.length];
  return <button type="button" onClick={onClick} style={{border:"1px solid "+(active?color:"var(--border)"),background:active?color+"12":"#fff",borderRadius:9,padding:8,cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><b>{item.group}</b><span>%{item.percent}</span></div><div style={{height:7,background:"var(--surface-soft)",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:item.percent+"%",background:color}}/></div></button>;
}

export function ResponsibilitySummary({project,selected=[],onChange}) {
  const items=remainingResponsibility(project);
  const toggle=group=>onChange(selected.includes(group)?selected.filter(item=>item!==group):[...selected,group]);
  return <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:13,padding:13,marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:9}}><div><div style={{fontSize:12,fontWeight:850}}>Kalan İşin Sorumluluk Dağılımı</div><div style={{fontSize:9,color:"var(--muted)",marginTop:2}}>Bir veya birden fazla ekibe tıklayarak görevleri filtreleyin.</div></div>{selected.length>0&&<button onClick={()=>onChange([])} style={{border:0,background:"color-mix(in srgb, var(--danger) 9%, white 91%)",color:"var(--danger)",borderRadius:7,padding:"5px 8px",fontSize:9,fontWeight:800,cursor:"pointer"}}>Filtreyi temizle</button>}</div>{items.length?<div style={{display:"grid",gap:7}}>{items.map((item,index)=><ResponsibilityFilterRow key={item.group} item={item} index={index} active={selected.includes(item.group)} onClick={()=>toggle(item.group)}/>)}</div>:<div style={{fontSize:11,color:"var(--success)"}}>Kalan görev bulunmuyor.</div>}</div>;
}

export function ProjectNotesPanel({ project, currentUser, state, setState, isAdmin, canManage }) {
  const [section,setSection]=useState("notes");
  // Shared project notes (admin can edit, others view)
  const projNotes = (state.projectNotes||{})[project.id] || { shared:"", items:[] };
  const [editNote, setEditNote] = useState(projNotes.shared);
  const [newItem, setNewItem] = useState("");
  const emptyAccess={name:"",url:"",username:"",status:"Hazır",routing:"",secretReference:"",note:""};
  const [accessForm,setAccessForm]=useState(emptyAccess);
  const accessItems=project.remoteAccess||[];
  const saveAccessItems=(items)=>setState(current=>({...current,projects:current.projects.map(item=>item.id===project.id?{...item,remoteAccess:items}:item)}));
  const addAccess=()=>{
    if(!accessForm.name.trim())return;
    saveAccessItems([...accessItems,{id:uid(),...accessForm,name:accessForm.name.trim(),createdAt:now()}]);
    setAccessForm(emptyAccess);
  };

  const save = (data) => setState(s=>({...s, projectNotes:{...(s.projectNotes||{}), [project.id]:{...projNotes,...data}}}));
  const addItem = () => { if(!newItem.trim())return; save({ items:[...projNotes.items, {id:uid(),text:newItem,done:false,author:currentUser.name,ts:now()}]}); setNewItem(""); };
  const toggleItem = (id) => save({ items:projNotes.items.map(x=>x.id===id?{...x,done:!x.done}:x) });
  const deleteItem = (id) => save({ items:projNotes.items.filter(x=>x.id!==id) });

  // User todos linked to this project
  const linkedTodos=((((state.userNotes||{})[currentUser.id]?.todos)||[]).filter(t=>t.projectId===project.id)).map(t=>({...t,personName:currentUser.name,personAvatar:currentUser.avatar,personAvatarUrl:currentUser.avatarUrl,personIsAdmin:currentUser.isAdmin}));

  return <div className="project-detail-scroll-panel" style={{ flex:1, overflow:"auto", padding:"clamp(14px, 3vw, 24px)" }}>
    <div style={{display:"flex",gap:7,marginBottom:16}}>
      {[["notes","notes","Notlar"],["todos","ticket","To-Do"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:"none",borderRadius:9,padding:"8px 14px",background:section===id?project.color:"var(--accent-ink)",color:section===id?"#fff":"var(--muted)",fontWeight:700,fontSize:12,display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}}><Icon name={icon} size={14}/>{label}</button>)}
    </div>
    {section==="access"&&<div>
      <div style={{background:"color-mix(in srgb, var(--warning) 10%, white 90%)",border:"1px solid #FED7AA",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#9A3412",marginBottom:13}}>Güvenlik nedeniyle gerçek parola burada tutulmaz. “Parola kasası referansı” alanına 1Password, Bitwarden veya kurum kasasındaki kayıt adını yazın.</div>
      {(isAdmin||canManage)&&<div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:13,padding:15,marginBottom:14}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>{[["name","Sistem / Sunucu"],["url","Bağlantı Adresi"],["username","Kullanıcı Adı"],["routing","VPN / Yönlendirme"],["secretReference","Parola Kasası Referansı"]].map(([key,label])=><Field key={key} label={label}><input style={iStyle} value={accessForm[key]} onChange={event=>setAccessForm(current=>({...current,[key]:event.target.value}))}/></Field>)}<Field label="Durum"><select style={iStyle} value={accessForm.status} onChange={event=>setAccessForm(current=>({...current,status:event.target.value}))}>{["Hazır","Test Bekliyor","Erişim Yok","Süresi Doldu"].map(status=><option key={status}>{status}</option>)}</select></Field></div><Field label="Not"><input style={iStyle} value={accessForm.note} onChange={event=>setAccessForm(current=>({...current,note:event.target.value}))}/></Field><div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={addAccess}>Erişim Kaydı Ekle</Btn></div></div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(300px,100%),1fr))",gap:10}}>{accessItems.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid var(--border)",borderRadius:12,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:13}}>{item.name}</b><span style={{fontSize:9,fontWeight:850,color:item.status==="Hazır"?"var(--success)":"var(--warning)",background:item.status==="Hazır"?"color-mix(in srgb, var(--success) 10%, white 90%)":"color-mix(in srgb, var(--warning) 10%, white 90%)",padding:"3px 6px",borderRadius:7}}>{item.status}</span></div><div style={{fontSize:11,color:"var(--muted)",lineHeight:1.7,marginTop:8}}>{item.url&&<div>Adres: <b>{item.url}</b></div>}{item.username&&<div>Kullanıcı: <b>{item.username}</b></div>}{item.routing&&<div>Yönlendirme: {item.routing}</div>}{item.secretReference&&<div>Kasa kaydı: <b>{item.secretReference}</b></div>}{item.note&&<div>Not: {item.note}</div>}</div>{(isAdmin||canManage)&&<button onClick={()=>confirm("Erişim kaydı silinsin mi?")&&saveAccessItems(accessItems.filter(entry=>entry.id!==item.id))} style={{marginTop:8,border:0,background:"transparent",color:"var(--danger)",fontSize:10,cursor:"pointer"}}>Sil</button>}</div>)}</div>
      {!accessItems.length&&<div style={{padding:35,textAlign:"center",border:"1px dashed var(--muted)",borderRadius:12,color:"var(--muted)"}}>Uzaktan erişim kaydı bulunmuyor.</div>}
    </div>}
    {section!=="access"&&<>
    <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
    {/* Left: shared notes */}
    <div style={{ flex:"1 1 340px", minWidth:280 }}>
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>{section==="notes"?"Proje Notları":"Proje To-Do"}</div>

      {section==="notes"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid var(--border)", padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:8, color:"#1E293B" }}>Paylaşılan Notlar</div>
        {isAdmin
          ? <textarea value={editNote} onChange={e=>{setEditNote(e.target.value);save({shared:e.target.value});}} placeholder="Proje genelinde paylaşılacak not, karar, önemli bilgi..." style={{ width:"100%", minHeight:120, padding:"9px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:12, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", background:"var(--surface-soft)", outline:"none", lineHeight:1.6 }} />
          : <div style={{ minHeight:80, fontSize:12, color: projNotes.shared?"#1E293B":"var(--muted)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{projNotes.shared||"Henüz not girilmemiş."}</div>
        }
      </div>}

      {section==="todos"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid var(--border)", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#1E293B" }}>Proje To-Do</div>
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Yeni madde..." style={{ ...iStyle, flex:1, padding:"7px 10px", fontSize:12 }} />
          <Btn small onClick={addItem}>+</Btn>
        </div>
        {projNotes.items.length===0&&<div style={{ fontSize:12, color:"var(--muted)" }}>Madde yok.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {projNotes.items.map(item=><div key={item.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 11px", background:"#F8FAFC", borderRadius:8, border:"1.5px solid var(--border)" }}>
            <input type="checkbox" checked={item.done} onChange={()=>toggleItem(item.id)} style={{ cursor:"pointer", accentColor:"var(--accent)", marginTop:2 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, textDecoration:item.done?"line-through":"none", color:item.done?"var(--muted)":"#1E293B" }}>{item.text}</div>
              <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>{item.author} · {new Date(item.ts).toLocaleDateString("tr-TR")}</div>
            </div>
            <button onClick={()=>deleteItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted)", fontSize:14, padding:0 }}>x</button>
          </div>)}
        </div>
      </div>}
    </div>

    {/* Right: user todos linked to this project */}
    <div style={{ flex:"1 1 300px", minWidth:0 }}>
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>{section==="notes"?"Ekip Notları":"Kişisel To-Do Bağlantılarım"}</div>
      {section==="todos"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid var(--border)", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"var(--muted)" }}>Bu projeye bağlı todo ları</div>
        {linkedTodos.length===0&&<div style={{ fontSize:12, color:"var(--muted)" }}>Henüz bağlı kişisel todo yok.<br/>Görevlerim sayfasından todo eklerken proje seçin.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {linkedTodos.map(t=><div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 11px", background:"#F8FAFC", borderRadius:8, border:"1.5px solid var(--border)" }}>
            <Avatar initials={t.personAvatar} imageUrl={t.personAvatarUrl} size={22} color={t.personIsAdmin?"var(--danger)":"var(--accent)"} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, textDecoration:t.done?"line-through":"none", color:t.done?"var(--muted)":"#1E293B" }}>{t.text}</div>
              <div style={{ fontSize:10, color:"var(--muted)", marginTop:1 }}>{t.personName}</div>
            </div>
            {t.done&&<span style={{ fontSize:11, color:"var(--success)" }}>✓</span>}
          </div>)}
        </div>
      </div>}

      {/* Person notes (if admin) */}
      {section==="notes"&&isAdmin&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid var(--border)", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"var(--muted)" }}>Ekip Serbest Notları</div>
        {state.people.map(p=>{
          const note=((state.userNotes||{})[p.id]?.notes)||"";
          if(!note) return null;
          return <div key={p.id} style={{ marginBottom:10, paddingBottom:10, borderBottom:"1px solid var(--accent-ink)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <Avatar initials={p.avatar} imageUrl={p.avatarUrl} size={18} color={p.isAdmin?"var(--danger)":"var(--accent)"} />
              <span style={{ fontSize:11, fontWeight:700 }}>{p.name}</span>
            </div>
            <div style={{ fontSize:11, color:"var(--muted)", whiteSpace:"pre-wrap", lineHeight:1.5 }}>{note}</div>
          </div>;
        })}
        {state.people.every(p=>!((state.userNotes||{})[p.id]?.notes))&&<div style={{ fontSize:12, color:"var(--muted)" }}>Ekip notu yok.</div>}
      </div>}
    </div>
    </div>
    </>}
  </div>;
}
