import { useState } from "react";
import { Btn, Field, Modal, iStyle } from "./primitives.jsx";

const RISK_LEVEL_COLORS = {
  "D\u00fc\u015f\u00fck": { bg: "#ECFDF5", text: "#059669" },
  "Orta": { bg: "#FFF7ED", text: "#EA6C00" },
  "Y\u00fcksek": { bg: "#FFF1F2", text: "#E11D48" },
};
const RISK_LEVELS = ["D\u00fc\u015f\u00fck", "Orta", "Y\u00fcksek"];
const RISK_STATUSES = ["A\u00e7\u0131k", "\u0130zleniyor", "Kapal\u0131"];

export function RiskPanel({ risks, onAdd, onUpdate, onDelete, canEdit }) {
  return <div>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
      <span style={{ fontWeight:700, fontSize:13 }}>Riskler & Engeller</span>
      {canEdit&&<Btn small variant="warning" onClick={onAdd}>+ Risk Ekle</Btn>}
    </div>
    {risks.length===0&&<div style={{ fontSize:12, color:"#94A3B8", padding:"10px 0" }}>Risk yok.</div>}
    {risks.map(r=><div key={r.id} style={{ background:"#FAFBFC", borderRadius:8, padding:"10px 14px", marginBottom:6, border:"1.5px solid #E2E8F0", display:"flex", gap:10, alignItems:"flex-start" }}>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontWeight:700, fontSize:12 }}>{r.title}</span>
          <span style={{ background:RISK_LEVEL_COLORS[r.level]?.bg||"#F1F5FF", color:RISK_LEVEL_COLORS[r.level]?.text||"#4A6CF7", borderRadius:12, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{r.level}</span>
          <span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:12, padding:"2px 8px", fontSize:11 }}>{r.status}</span>
        </div>
        {r.note&&<div style={{ fontSize:11, color:"#64748B", marginTop:3 }}>{r.note}</div>}
      </div>
      {canEdit&&<div style={{ display:"flex", gap:4 }}>
        <select value={r.status} onChange={e=>onUpdate(r.id,{status:e.target.value})} style={{ fontSize:11, borderRadius:6, border:"1px solid #E2E8F0", padding:"3px 6px" }}>
          {RISK_STATUSES.map(x=><option key={x}>{x}</option>)}
        </select>
        <Btn small variant="danger" onClick={()=>onDelete(r.id)}>x</Btn>
      </div>}
    </div>)}
  </div>;
}

export function RiskModal({ onClose, onSave }) {
  const [f,setF]=useState({ title:"", level:"Orta", status:"A\u00e7\u0131k", note:"" });
  return <Modal title="Risk Ekle" onClose={onClose}>
    <Field label="Ba\u015fl\u0131k *"><input style={iStyle} value={f.title} onChange={e=>setF(s=>({...s,title:e.target.value}))} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Seviye"><select style={iStyle} value={f.level} onChange={e=>setF(s=>({...s,level:e.target.value}))}>{RISK_LEVELS.map(l=><option key={l}>{l}</option>)}</select></Field>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>setF(s=>({...s,status:e.target.value}))}>{RISK_STATUSES.map(l=><option key={l}>{l}</option>)}</select></Field>
    </div>
    <Field label="Not"><input style={iStyle} value={f.note} onChange={e=>setF(s=>({...s,note:e.target.value}))} /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>{"\u0130ptal"}</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
