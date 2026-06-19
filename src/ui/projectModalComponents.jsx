import { useState } from "react";
import { projectPmIds, projectStakeholders } from "../domain/projectHelpers.js";
import { PeopleMultiSelect, StakeholderEditor } from "./formControls.jsx";
import { TemplatePicker as SharedTemplatePicker } from "./projectPlanComponents.jsx";
import { Btn, Field, Modal, iStyle } from "./primitives.jsx";
import { STATUSES } from "./status.jsx";

const roleLabel = (roles, id) => roles.find(level => level.id === id)?.label || "Atanmam??";

export function UserEditModal({ person, people=[], roles=[], onClose, onSave, title="Profilimi DÃ¼zenle", allowAdmin=false }) {
  const [name, setName] = useState(person.name);
  const [email,setEmail]=useState(person.email||"");
  const [phone,setPhone]=useState(person.phone||"");
  const [city,setCity]=useState(person.location?.city||person.city||"");
  const [district,setDistrict]=useState(person.location?.district||person.district||"");
  const [whatsappEnabled,setWhatsappEnabled]=useState(person.whatsappEnabled!==false);
  const [orgLevel,setOrgLevel]=useState(person.orgLevel||"");
  const [managerId,setManagerId]=useState(person.managerId||"");
  const [isAdmin,setIsAdmin]=useState(Boolean(person.isAdmin));
  const [ticketOnly,setTicketOnly]=useState(Boolean(person.ticketOnly));
  const [defaultDashboard,setDefaultDashboard]=useState(person.defaultDashboard||"team");
  const canChooseDashboard=Boolean(person.isAdmin||allowAdmin);
  return <Modal title={title} onClose={onClose} wide>
    <Field label="Ad Soyad *"><input style={iStyle} value={name} onChange={e=>setName(e.target.value)} /></Field>
    <Field label="E-posta"><input type="email" style={iStyle} value={email} onChange={e=>setEmail(e.target.value)} placeholder="kullanici@sirket.com" /></Field>
    <Field label="WhatsApp Telefonu"><input type="tel" style={iStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="905551234567" /></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="Ä°l"><input style={iStyle} value={city} onChange={e=>setCity(e.target.value)} placeholder="Ä°stanbul"/></Field>
      <Field label="Ä°lÃ§e"><input style={iStyle} value={district} onChange={e=>setDistrict(e.target.value)} placeholder="KadÄ±kÃ¶y"/></Field>
    </div>
    <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={whatsappEnabled} onChange={e=>setWhatsappEnabled(e.target.checked)}/> WhatsApp gÃ¶rev bildirimlerini al</label>
    {allowAdmin&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="Organizasyon Seviyesi"><select style={iStyle} value={orgLevel} onChange={e=>setOrgLevel(e.target.value)}><option value="">- AtanmamÄ±ÅŸ -</option>{roles.map(level=><option key={level.id} value={level.id}>{level.label}</option>)}</select></Field>
      <Field label="BaÄŸlÄ± OlduÄŸu YÃ¶netici"><select style={iStyle} value={managerId} onChange={e=>setManagerId(e.target.value)}><option value="">- YÃ¶netici yok -</option>{people.filter(item=>item.id!==person.id).map(item=><option key={item.id} value={item.id}>{item.name} - {roleLabel(roles, item.orgLevel)}</option>)}</select></Field>
    </div>}
    {allowAdmin&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)}/> YÃ¶netici yetkisi</label>}
    {allowAdmin&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={ticketOnly} onChange={e=>setTicketOnly(e.target.checked)}/> YalnÄ±zca ticket modÃ¼lÃ¼nÃ¼ kullanabilir</label>}
    {canChooseDashboard&&<Field label="Alt ana sayfa"><select style={iStyle} value={defaultDashboard} onChange={e=>setDefaultDashboard(e.target.value)}><option value="team">Ekip dashboardu</option><option value="admin">YÃ¶netici dashboardu</option></select></Field>}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>Ä°ptal</Btn><Btn onClick={()=>{ if(!name.trim())return; onSave({name:name.trim(),email:email.trim(),phone:phone.replace(/\D/g,""),city:city.trim(),district:district.trim(),location:{...(person.location||{}),city:city.trim(),district:district.trim()},whatsappEnabled,defaultDashboard:canChooseDashboard?defaultDashboard:"team",...(allowAdmin?{isAdmin,orgLevel,managerId,ticketOnly,role:roles.find(item=>item.id===orgLevel)?.label||"AtanmamÄ±ÅŸ"}:{})}); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}

// â”€â”€â”€ Notifications Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function AddProjectModal({ onClose, onSave, people, roles, templates = [], buildFromTemplate, colors = [], createId, todayString }) {
  const [step,setStep]=useState("template");
  const [tplData,setTplData]=useState(null);
  const [f,setF]=useState({ name:"", description:"", color:"#4A6CF7", status:"Bekliyor", startDate:todayString(), endDate:"", pmIds:[], stakeholders:[], commissioningTracking:false, connectedSupplier:false });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  const handleTplSelect=(tpl)=>{ setTplData(tpl); setF(s=>({...s,color:tpl.color})); setStep("form"); };
  const handleSave=()=>{ if(!f.name.trim())return; const built=tplData?buildFromTemplate(tplData,f.startDate||todayString()):{milestones:[]}; onSave({...f,...built,risks:[]}); onClose(); };
  return <Modal title="Yeni Proje" onClose={onClose} wide>
    {step==="template"&&<SharedTemplatePicker templates={templates} onSelect={handleTplSelect} onSkip={()=>setStep("form")} />}
    {step==="form"&&<div>
      {tplData&&<div style={{ background:tplData.color+"15", border:`1.5px solid ${tplData.color}44`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12 }}>
        <strong style={{ color:tplData.color }}>Sablon: {tplData.name}</strong>
        <span style={{ color:"#64748B", marginLeft:8 }}>{tplData.milestones.length} milestone otomatik eklenecek</span>
        <button onClick={()=>setStep("template")} style={{ marginLeft:12, background:"none", border:"none", cursor:"pointer", color:tplData.color, fontSize:11, textDecoration:"underline" }}>Degistir</button>
      </div>}
      <Field label="Proje AdÄ± *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="Proje adi" /></Field>
      <Field label="AÃ§Ä±klama"><input style={iStyle} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
      <Field label="Proje YÃ¶neticileri (birden fazla seÃ§ilebilir)"><PeopleMultiSelect people={people} value={f.pmIds} onChange={value=>upd("pmIds",value)}/></Field>
      <Field label="Proje Rolleri ve KatÄ±lÄ±mcÄ±lar"><StakeholderEditor people={people} roles={roles} value={f.stakeholders} onChange={value=>upd("stakeholders",value)} createId={createId}/></Field>
      <label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F0FDFA",border:"1.5px solid #99F6E4",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.connectedSupplier)} onChange={e=>upd("connectedSupplier",e.target.checked)} style={{marginTop:2}}/><span><b>Connected Supplier</b><span style={{display:"block",color:"#0F766E",marginTop:3}}>Bu proje Connected Supplier kapsamÄ±nda ayrÄ± takip ve filtrelere dahil edilir.</span></span></label><label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.commissioningTracking)} onChange={e=>upd("commissioningTracking",e.target.checked)} style={{marginTop:2}}/><span><b>HiyerarÅŸik devreye alma takibi</b><span style={{display:"block",color:"#64748B",marginTop:3}}>SektÃ¶r, Ã¼retim merkezi, iÅŸyeri, hat ve makine bazÄ±nda yÃ¼zdesel takip ekranÄ±nÄ± aÃ§ar.</span></span></label>
      <Field label="Renk"><div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>{colors.map(c=><div key={c} onClick={()=>upd("color",c)} style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:f.color===c?"3px solid #1E293B":"3px solid transparent" }} />)}</div></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <Field label="BaÅŸlangÄ±Ã§"><input type="date" style={iStyle} value={f.startDate} onChange={e=>upd("startDate",e.target.value)} /></Field>
        <Field label="BitiÅŸ"><input type="date" style={iStyle} value={f.endDate} onChange={e=>upd("endDate",e.target.value)} /></Field>
      </div>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>Ä°ptal</Btn><Btn onClick={handleSave}>Kaydet</Btn></div>
    </div>}
  </Modal>;
}
export function ProjectModal({ title, initial, onClose, onSave, people, roles, colors = [], createId }) {
  const [f,setF]=useState(()=>({ name:"", description:"", color:"#4A6CF7", status:"Bekliyor", startDate:"", endDate:"", ...initial, pmIds:projectPmIds(initial||{}), stakeholders:projectStakeholders(initial||{}) }));
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Proje AdÄ± *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} /></Field>
    <Field label="AÃ§Ä±klama"><input style={iStyle} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <Field label="Proje YÃ¶neticileri (birden fazla seÃ§ilebilir)"><PeopleMultiSelect people={people} value={f.pmIds} onChange={value=>upd("pmIds",value)}/></Field>
    <Field label="Proje Rolleri ve KatÄ±lÄ±mcÄ±lar"><StakeholderEditor people={people} roles={roles} value={f.stakeholders} onChange={value=>upd("stakeholders",value)} createId={createId}/></Field>
    <label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F0FDFA",border:"1.5px solid #99F6E4",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.connectedSupplier)} onChange={e=>upd("connectedSupplier",e.target.checked)} style={{marginTop:2}}/><span><b>Connected Supplier</b><span style={{display:"block",color:"#0F766E",marginTop:3}}>Bu proje Connected Supplier kapsamÄ±nda ayrÄ± takip ve filtrelere dahil edilir.</span></span></label><label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.commissioningTracking)} onChange={e=>upd("commissioningTracking",e.target.checked)} style={{marginTop:2}}/><span><b>HiyerarÅŸik devreye alma takibi</b><span style={{display:"block",color:"#64748B",marginTop:3}}>SektÃ¶r, Ã¼retim merkezi, iÅŸyeri, hat ve makine bazÄ±nda yÃ¼zdesel takip ekranÄ±nÄ± aÃ§ar.</span></span></label>
    <Field label="Renk"><div style={{ display:"flex", gap:7 }}>{colors.map(c=><div key={c} onClick={()=>upd("color",c)} style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:f.color===c?"3px solid #1E293B":"3px solid transparent" }} />)}</div></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="BaÅŸlangÄ±Ã§"><input type="date" style={iStyle} value={f.startDate} onChange={e=>upd("startDate",e.target.value)} /></Field>
      <Field label="BitiÅŸ"><input type="date" style={iStyle} value={f.endDate} onChange={e=>upd("endDate",e.target.value)} /></Field>
    </div>
    <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Başarı Kriteri / Müşteri Kazancı"><textarea style={{...iStyle,minHeight:76,resize:"vertical"}} value={f.successCriteria||""} onChange={e=>upd("successCriteria",e.target.value)} placeholder="Bu milestone tamamlandığında müşterinin kazanımı nedir?"/></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>Ä°ptal</Btn><Btn onClick={()=>{ if(!f.name.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
export function MilestoneModal({ title, initial, onClose, onSave, waitOptions = [] }) {
  const [f,setF]=useState({ name:"", startDate:"", dueDate:"", actualStart:"", actualEnd:"", status:"Bekliyor", waitSource:"", successCriteria:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Milestone AdÄ± *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Hedef BaÅŸlangÄ±Ã§"><input type="date" style={iStyle} value={f.startDate} onChange={e=>upd("startDate",e.target.value)} /></Field>
      <Field label="Hedef Termin"><input type="date" style={iStyle} value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} /></Field>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="GerÃ§ekleÅŸen BaÅŸlangÄ±Ã§"><input type="date" style={iStyle} value={f.actualStart||""} onChange={e=>upd("actualStart",e.target.value)} /></Field>
      <Field label="GerÃ§ekleÅŸen BitiÅŸ"><input type="date" style={iStyle} value={f.actualEnd||""} onChange={e=>upd("actualEnd",e.target.value)} /></Field>
    </div>
    <div style={{background:"#F1F5F9",borderRadius:9,padding:"9px 11px",fontSize:11,color:"#64748B",marginBottom:13}}>Milestone durumu iÃ§indeki gÃ¶revlerin durumuna gÃ¶re otomatik hesaplanÄ±r.</div>
    <Field label="Bekleme KaynaÄŸÄ±"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{waitOptions.map(s=><option key={s}>{s}</option>)}</select></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>Ä°ptal</Btn><Btn onClick={()=>{ if(!f.name.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
export function PersonModal({ people=[], roles=[], onClose, onSave }) {
  const [name, setName] = useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [city,setCity]=useState("");
  const [district,setDistrict]=useState("");
  const [whatsappEnabled,setWhatsappEnabled]=useState(true);
  const [orgLevel,setOrgLevel]=useState("");
  const [managerId,setManagerId]=useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ticketOnly,setTicketOnly]=useState(false);
  return (
    <Modal title="Ekip Ãœyesi Ekle" onClose={onClose}>
      <Field label="Ad Soyad *">
        <input style={iStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Ad soyad" />
      </Field>
      <Field label="Organizasyon Seviyesi"><select style={iStyle} value={orgLevel} onChange={e=>setOrgLevel(e.target.value)}><option value="">- AtanmamÄ±ÅŸ -</option>{roles.map(level=><option key={level.id} value={level.id}>{level.label}</option>)}</select></Field>
      <Field label="BaÄŸlÄ± OlduÄŸu YÃ¶netici"><select style={iStyle} value={managerId} onChange={e=>setManagerId(e.target.value)}><option value="">- YÃ¶netici yok -</option>{people.map(item=><option key={item.id} value={item.id}>{item.name} Â· {roleLabel(roles, item.orgLevel)}</option>)}</select></Field>
      <Field label="E-posta">
        <input type="email" style={iStyle} value={email} onChange={e=>setEmail(e.target.value)} placeholder="kullanici@sirket.com" />
      </Field>
      <Field label="WhatsApp Telefonu">
        <input type="tel" style={iStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="905551234567" />
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Ä°l"><input style={iStyle} value={city} onChange={e=>setCity(e.target.value)} placeholder="Ä°stanbul"/></Field>
        <Field label="Ä°lÃ§e"><input style={iStyle} value={district} onChange={e=>setDistrict(e.target.value)} placeholder="KadÄ±kÃ¶y"/></Field>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={whatsappEnabled} onChange={e=>setWhatsappEnabled(e.target.checked)}/> WhatsApp gÃ¶rev bildirimlerini al</label>
      <Field label="Yetki">
        <div style={{ display:"flex", gap:10 }}>
          <div onClick={()=>setIsAdmin(false)} style={{ flex:1, padding:"10px", borderRadius:8, border:`1.5px solid ${!isAdmin?"#4A6CF7":"#E2E8F0"}`, cursor:"pointer", textAlign:"center", background:!isAdmin?"#F1F5FF":"#fff", fontSize:12, fontWeight:600, color:!isAdmin?"#4A6CF7":"#64748B" }}>
            Ekip Ãœyesi
          </div>
          <div onClick={()=>setIsAdmin(true)} style={{ flex:1, padding:"10px", borderRadius:8, border:`1.5px solid ${isAdmin?"#4A6CF7":"#E2E8F0"}`, cursor:"pointer", textAlign:"center", background:isAdmin?"#F1F5FF":"#fff", fontSize:12, fontWeight:600, color:isAdmin?"#4A6CF7":"#64748B" }}>
            YÃ¶netici
          </div>
        </div>
      </Field>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={ticketOnly} onChange={e=>setTicketOnly(e.target.checked)}/> YalnÄ±zca ticket modÃ¼lÃ¼nÃ¼ kullanabilir</label>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}>
        <Btn variant="ghost" onClick={onClose}>Ä°ptal</Btn>
        <Btn onClick={()=>{ if(!name.trim())return; onSave({name,email:email.trim(),phone:phone.replace(/\D/g,""),city:city.trim(),district:district.trim(),location:{city:city.trim(),district:district.trim()},whatsappEnabled,orgLevel,managerId,ticketOnly,role:roles.find(item=>item.id===orgLevel)?.label||"AtanmamÄ±ÅŸ",isAdmin}); onClose(); }}>Kaydet</Btn>
      </div>
    </Modal>
  );
}

