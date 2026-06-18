import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Btn, Field, Icon, iStyle } from "./primitives.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "-";
const safeFileName = (value) => String(value || "rapor").replace(/[^a-zA-Z0-9_-]/g, "_");
const downloadXlsx = (rows, fileName, sheetName = "Rapor") => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName);
};
const MACHINE_CONTROL_REASONS = [
  "Ping yok",
  "Telnet yok",
  "Adet Saym\u0131yor",
  "Makine Verisi Yok",
  "Sunucu Kapanm\u0131\u015f",
  "Pm2 Prosesleri Durmu\u015f",
  "Lisans Bitmi\u015f",
  "Ip Adresi De\u011fi\u015fmi\u015f",
  "Kablolamas\u0131 Eksik Yap\u0131lm\u0131\u015f",
  "Problem G\u00f6r\u00fcnm\u00fcyor Ama Veri Yok (!!!)",
];

export function MachinePanel({ project, canEdit, currentUser, onChange }) {
  const machines=project.machines||[];
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState("");
  const [viewMode,setViewMode]=useState("cards");
  const [search,setSearch]=useState("");
  const [controlDrafts,setControlDrafts]=useState({});
  const blankMachineForm={name:"",code:"",type:"physical",ip:"",osModel:"",extraLicense:"",serialNo:"",location:"",dataSource:"",protocol:"",responsible:"",processParameters:"",commissioned:false,commissionedAt:"",note:""};
  const [form,setForm]=useState(blankMachineForm);
  const fileRef=useRef(null);
  const commissioned=machines.filter(m=>m.commissioned).length;
  const visibleMachines=machines.filter(machine=>`${machine.name||""} ${machine.code||""} ${machine.ip||""} ${machine.osModel||""} ${machine.extraLicense||""} ${machine.serialNo||""} ${machine.location||""} ${machine.dataSource||""} ${machine.protocol||""} ${machine.processParameters||""}`.toLocaleLowerCase("tr-TR").includes(search.trim().toLocaleLowerCase("tr-TR")));
  const commissionedMachines=visibleMachines.filter(machine=>machine.commissioned);
  const copyIp=async(ip)=>{if(!ip)return;try{await navigator.clipboard.writeText(ip);}catch{prompt("IP adresi",ip);}};
  const save=()=>{
    if(!form.name.trim())return;
    const saved={...form,name:form.name.trim(),code:form.code.trim(),ip:form.ip.trim(),osModel:form.osModel.trim(),extraLicense:form.extraLicense.trim(),serialNo:form.serialNo.trim(),location:form.location.trim(),dataSource:form.dataSource.trim(),protocol:form.protocol.trim(),responsible:form.responsible.trim(),processParameters:form.processParameters.trim(),commissionedAt:form.commissioned?(form.commissionedAt||todayStr()):""};
    onChange(editingId?machines.map(machine=>machine.id===editingId?{...machine,...saved}:machine):[...machines,{...saved,id:uid()}]);
    setForm(blankMachineForm);
    setEditingId("");
    setShowForm(false);
  };
  const edit=machine=>{setEditingId(machine.id);setForm({name:machine.name||"",code:machine.code||"",type:machine.type||"physical",ip:machine.ip||"",osModel:machine.osModel||"",extraLicense:machine.extraLicense||"",serialNo:machine.serialNo||"",location:machine.location||"",dataSource:machine.dataSource||"",protocol:machine.protocol||"",responsible:machine.responsible||"",processParameters:machine.processParameters||"",commissioned:Boolean(machine.commissioned),commissionedAt:machine.commissionedAt||"",note:machine.note||""});setShowForm(true);};
  const update=(id,data)=>onChange(machines.map(m=>m.id===id?{...m,...data}:m));
  const exportExcel=()=>downloadXlsx([["Makine Kodu","Makine Adı","Seri No","Lokasyon","IP","İşletim Sistemi/Model","Veri Kaynağı","Protokol","Proses Parametreleri","Ek Lisans","Sorumlu","Tip","Devreye Alındı","Perfect Veri","Son Kontrol","Son Kontrol Nedenleri","Devreye Alma Tarihi","Açıklama"],...machines.map(machine=>{const last=(machine.controlHistory||[])[0]||{};return [machine.code||"",machine.name,machine.serialNo||"",machine.location||"",machine.ip||"",machine.osModel||"",machine.dataSource||"",machine.protocol||"",machine.processParameters||"",machine.extraLicense||"",machine.responsible||"",machine.type==="virtual"?"Sanal":"Fiziksel",machine.commissioned?"Evet":"Hayır",machine.lastPerfectData?"Evet":"Hayır",machine.lastControlAt||"",((last.reasons||[]).join(", ")),machine.commissionedAt||"",machine.note||""]})],`${safeFileName(project.name)}-makineler.xlsx`,"Makineler");
  const addMachineCheck=(machine,perfectData,note="")=>{
    const draft=controlDrafts[machine.id]||{};
    const check={id:uid(),ts:now(),userId:currentUser?.id||"",userName:currentUser?.name||"",perfectData,reasons:perfectData?[]:(draft.reasons||[]),note:note||draft.note||"",resolved:Boolean(draft.resolved)};
    update(machine.id,{lastPerfectData:perfectData,lastControlAt:check.ts,controlHistory:[check,...(machine.controlHistory||[])]});
    setControlDrafts(current=>({...current,[machine.id]:{reasons:[],note:"",resolved:false}}));
  };
  const importExcel=(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const workbook=XLSX.read(reader.result,{type:"array"});
        const data=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
        const imported=data.map(item=>({id:uid(),code:String(item["Makine Kodu"]||"").trim(),name:String(item["Makine Adı"]||item["Makine Adi"]||"").trim(),serialNo:String(item["Seri No"]||"").trim(),location:String(item.Lokasyon||"").trim(),ip:String(item.IP||item.Ip||"").trim(),osModel:String(item["İşletim Sistemi/Model"]||item["Isletim Sistemi/Model"]||item.Model||"").trim(),dataSource:String(item["Veri Kaynağı"]||item["Veri Kaynagi"]||"").trim(),protocol:String(item.Protokol||"").trim(),processParameters:String(item["Proses Parametreleri"]||"").trim(),extraLicense:String(item["Ek Lisans"]||"").trim(),responsible:String(item.Sorumlu||"").trim(),type:String(item.Tip||"").toLocaleLowerCase("tr-TR")==="sanal"?"virtual":"physical",commissioned:["evet","true","1"].includes(String(item["Devreye Alındı"]||item["Devreye Alindi"]||"").toLocaleLowerCase("tr-TR")),lastPerfectData:["evet","true","1"].includes(String(item["Perfect Veri"]||"").toLocaleLowerCase("tr-TR")),lastControlAt:String(item["Son Kontrol"]||""),commissionedAt:String(item["Devreye Alma Tarihi"]||""),note:String(item["Açıklama"]||item.Aciklama||"")})).filter(machine=>machine.name);
        onChange([...machines,...imported]);
      }catch(error){alert(`Excel okunamadı: ${error.message}`);}
      event.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };
  return <div style={{flex:1,overflow:"auto",padding:"clamp(14px, 3vw, 24px)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <div><h3 style={{margin:0,fontSize:16,display:"flex",alignItems:"center",gap:7}}><Icon name="machines" size={18}/>Makine Devreye Alma</h3><div style={{fontSize:12,color:"#64748B",marginTop:3}}>{commissioned}/{machines.length} makine devrede</div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Btn variant="secondary" onClick={exportExcel}>Excel Dışa Aktar</Btn>{canEdit&&<><Btn variant="secondary" onClick={()=>fileRef.current?.click()}>Excel İçe Aktar</Btn><input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importExcel}/><Btn onClick={()=>{setEditingId("");setForm(blankMachineForm);setShowForm(v=>!v);}}>{showForm?"Formu Kapat":"+ Makine Ekle"}</Btn></>}</div>
    </div>
    <div style={{height:8,background:"#E2E8F0",borderRadius:8,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:`${machines.length?commissioned/machines.length*100:0}%`,background:"#059669"}} /></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
      <input style={{...iStyle,width:260,maxWidth:"100%"}} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Makine adı, kodu, IP veya OS/model ara..."/>
      <div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>
        {[["cards","Kutucuk"],["list","Liste"],["control","Kontrol"]].map(([id,label])=><button key={id} onClick={()=>setViewMode(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontWeight:800,fontSize:11,background:viewMode===id?"#fff":"transparent",color:viewMode===id?"#4A6CF7":"#64748B"}}>{label}</button>)}
      </div>
    </div>
    {showForm&&<div style={{background:"#fff",border:"1.5px solid #DCE6F2",borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Makine Adı *"><input style={iStyle} value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} /></Field><Field label="Kod / Hat No"><input style={iStyle} value={form.code} onChange={e=>setForm(s=>({...s,code:e.target.value}))} /></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Seri No"><input style={iStyle} value={form.serialNo} onChange={e=>setForm(s=>({...s,serialNo:e.target.value}))}/></Field><Field label="Lokasyon"><input style={iStyle} value={form.location} onChange={e=>setForm(s=>({...s,location:e.target.value}))} placeholder="Hat / pano / alan"/></Field><Field label="IP Adresi"><input style={iStyle} value={form.ip} onChange={e=>setForm(s=>({...s,ip:e.target.value}))} placeholder="Örn. 192.168.1.10"/></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="İşletim Sistemi / Model"><input style={iStyle} value={form.osModel} onChange={e=>setForm(s=>({...s,osModel:e.target.value}))} placeholder="Örn. Windows Server / IPC model"/></Field><Field label="Veri Kaynağı"><input style={iStyle} value={form.dataSource} onChange={e=>setForm(s=>({...s,dataSource:e.target.value}))} placeholder="PLC, OPC, API..."/></Field><Field label="Protokol"><input style={iStyle} value={form.protocol} onChange={e=>setForm(s=>({...s,protocol:e.target.value}))} placeholder="OPC UA, Modbus, SQL..."/></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Ek Lisans"><input style={iStyle} value={form.extraLicense} onChange={e=>setForm(s=>({...s,extraLicense:e.target.value}))} placeholder="Örn. OPC, historian, runtime"/></Field><Field label="Sorumlu"><input style={iStyle} value={form.responsible} onChange={e=>setForm(s=>({...s,responsible:e.target.value}))}/></Field></div>
      <Field label="Alınabilen Proses Parametreleri"><textarea style={{...iStyle,height:74,resize:"vertical"}} value={form.processParameters} onChange={e=>setForm(s=>({...s,processParameters:e.target.value}))} placeholder="Örn. adet, duruş kodu, hız, sıcaklık, alarm..."/></Field>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Makine Tipi"><select style={iStyle} value={form.type} onChange={e=>setForm(s=>({...s,type:e.target.value}))}><option value="physical">Fiziksel</option><option value="virtual">Sanal</option></select></Field><Field label="Devreye Alma Tarihi"><input type="date" style={iStyle} value={form.commissionedAt} onChange={e=>setForm(s=>({...s,commissionedAt:e.target.value}))} /></Field></div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:13}}><input type="checkbox" checked={form.commissioned} onChange={e=>setForm(s=>({...s,commissioned:e.target.checked}))} /> Devreye alındı</label>
      <Field label="Devreye Alınamama Açıklaması / Not"><textarea style={{...iStyle,height:70,resize:"vertical"}} value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))} /></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId("");setShowForm(false);}}>İptal</Btn>}<Btn onClick={save}>{editingId?"Değişiklikleri Kaydet":"Makineyi Kaydet"}</Btn></div>
    </div>}
    {!machines.length&&<div style={{padding:40,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Henüz makine eklenmedi.</div>}
    {viewMode==="list"&&<div style={{overflowX:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,marginBottom:12}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1100}}><thead><tr>{["Makine","Kod","Seri/Lokasyon","OS/Model","IP","Veri Kaynağı","Protokol","Perfect Veri","Tip","Durum",""].map(label=><th key={label} style={{padding:"10px 9px",fontSize:10,color:"#64748B",background:"#F8FAFC",textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{visibleMachines.map(machine=><tr key={machine.id} style={{borderTop:"1px solid #EEF2F7"}}><td style={{padding:9,fontSize:11,fontWeight:850}}>{machine.name}</td><td style={{padding:9,fontSize:11,color:"#64748B"}}>{machine.code||"-"}</td><td style={{padding:9,fontSize:10,color:"#64748B"}}>{machine.serialNo||"-"}{machine.location?` · ${machine.location}`:""}</td><td style={{padding:9,fontSize:11,color:"#475569"}}>{machine.osModel||"-"}</td><td style={{padding:9,fontSize:11}}>{machine.ip?<button onClick={()=>copyIp(machine.ip)} title="IP kopyala" style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"5px 8px",fontSize:10,fontWeight:850,cursor:"pointer"}}>{machine.ip}</button>:"-"}</td><td style={{padding:9,fontSize:11,color:"#475569"}}>{machine.dataSource||"-"}</td><td style={{padding:9,fontSize:11,color:"#475569"}}>{machine.protocol||"-"}</td><td style={{padding:9,fontSize:11,color:machine.lastPerfectData?"#059669":"#EA6C00",fontWeight:850}}>{machine.lastControlAt?(machine.lastPerfectData?"Evet":"Hayır"):"Kontrol yok"}</td><td style={{padding:9,fontSize:11}}>{machine.type==="virtual"?"Sanal":"Fiziksel"}</td><td style={{padding:9,fontSize:11,color:machine.commissioned?"#059669":"#EA6C00",fontWeight:850}}>{machine.commissioned?"Devrede":"Bekliyor"}</td><td style={{padding:9}}>{canEdit&&<div style={{display:"flex",gap:6}}><Btn small variant="secondary" onClick={()=>edit(machine)}>Düzenle</Btn><Btn small variant="danger" onClick={()=>onChange(machines.filter(m=>m.id!==machine.id))}>Sil</Btn></div>}</td></tr>)}</tbody></table>{!visibleMachines.length&&<div style={{padding:24,textAlign:"center",fontSize:12,color:"#94A3B8"}}>Aramaya uygun makine bulunamadı.</div>}</div>}
    {viewMode==="control"&&<div style={{display:"grid",gap:10,marginBottom:12}}>
      <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:13,padding:12,fontSize:12,color:"#3730A3",lineHeight:1.5}}>Devredeki makineleri saha kontrolü sırasında hızlıca işaretleyin. Her işaretleme makinenin kontrol geçmişine kaydedilir.</div>
      {commissionedMachines.map(machine=>{const last=(machine.controlHistory||[])[0];const draft=controlDrafts[machine.id]||{reasons:[],note:"",resolved:false};const setDraft=data=>setControlDrafts(current=>({...current,[machine.id]:{...draft,...data}}));return <div key={machine.id} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:14,padding:13}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:900,wordBreak:"break-word"}}>{machine.name}</div><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{machine.code||"Kod yok"}{machine.ip?` · ${machine.ip}`:""}{machine.dataSource?` · ${machine.dataSource}`:""}</div></div>
          <label style={{display:"inline-flex",alignItems:"center",gap:8,background:machine.lastPerfectData?"#ECFDF5":"#FFF7ED",color:machine.lastPerfectData?"#047857":"#EA6C00",borderRadius:10,padding:"8px 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}><input type="checkbox" checked={Boolean(machine.lastPerfectData)} onChange={event=>addMachineCheck(machine,event.target.checked)}/> Perfect veri alıyor</label>
        </div>
        <div style={{marginTop:10,display:"grid",gap:8}}>
          {!machine.lastPerfectData&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{MACHINE_CONTROL_REASONS.map(reason=><button key={reason} onClick={()=>setDraft({reasons:draft.reasons.includes(reason)?draft.reasons.filter(item=>item!==reason):[...draft.reasons,reason]})} style={{border:"1px solid "+(draft.reasons.includes(reason)?"#E11D48":"#E2E8F0"),background:draft.reasons.includes(reason)?"#FFF1F2":"#fff",color:draft.reasons.includes(reason)?"#BE123C":"#475569",borderRadius:999,padding:"5px 8px",fontSize:9,fontWeight:850,cursor:"pointer"}}>{reason}</button>)}</div>}
          {!machine.lastPerfectData&&<label style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:11,fontWeight:850,color:"#047857",background:"#ECFDF5",borderRadius:9,padding:"7px 9px",width:"fit-content"}}><input type="checkbox" checked={Boolean(draft.resolved)} onChange={event=>setDraft({resolved:event.target.checked})}/> Çözüldü</label>}
          <textarea style={{...iStyle,minHeight:58,fontSize:11,resize:"vertical"}} value={draft.note||""} onChange={event=>setDraft({note:event.target.value})} placeholder="Serbest kontrol notu / gözlem..."/>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button onClick={()=>addMachineCheck(machine,Boolean(machine.lastPerfectData))} style={{border:0,background:"#F1F5F9",color:"#475569",borderRadius:8,padding:"7px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>Notlu Kontrolü Kaydet</button>{last&&<span style={{fontSize:10,color:"#64748B",alignSelf:"center"}}>Son kontrol: {new Date(last.ts).toLocaleString("tr-TR")} · {last.userName||"Kullanıcı"} · {last.perfectData?"Perfect":"Sorun var"}</span>}</div>
        </div>
        {(machine.controlHistory||[]).length>0&&<div style={{marginTop:10,borderTop:"1px solid #EEF2F7",paddingTop:8,display:"grid",gap:5}}>{(machine.controlHistory||[]).slice(0,4).map(item=><div key={item.id} style={{fontSize:10,color:"#64748B",display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><span>{new Date(item.ts).toLocaleString("tr-TR")} · {item.userName||"Kullanıcı"}</span><b style={{color:item.perfectData?"#059669":item.resolved?"#047857":"#E11D48"}}>{item.perfectData?"Perfect veri":item.resolved?"Sorun çözüldü":"Sorun / eksik veri"}</b>{(item.reasons||[]).length>0&&<span style={{flexBasis:"100%",color:"#BE123C",fontWeight:800}}>{item.reasons.join(", ")}</span>}{item.note&&<span style={{flexBasis:"100%",color:"#475569"}}>{item.note}</span>}</div>)}</div>}
      </div>;})}
      {!commissionedMachines.length&&<div style={{padding:34,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Kontrol edilecek devrede makine bulunamadı.</div>}
    </div>}
    <div style={{display:viewMode==="cards"?"grid":"none",gridTemplateColumns:"repeat(auto-fit,minmax(min(240px,100%),1fr))",gap:10}}>
      {visibleMachines.map(machine=><div key={machine.id} style={{background:"#fff",borderRadius:12,padding:14,border:`1.5px solid ${machine.commissioned?"#A7F3D0":"#FED7AA"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:13}}>{machine.name}</div><div style={{fontSize:11,color:"#64748B",marginTop:2}}>{machine.code||"Kod yok"} · {machine.type==="virtual"?"Sanal":"Fiziksel"}</div></div><span style={{background:machine.commissioned?"#ECFDF5":"#FFF7ED",color:machine.commissioned?"#059669":"#EA6C00",padding:"3px 8px",borderRadius:8,fontSize:10,fontWeight:800}}>{machine.commissioned?"DEVREDE":"BEKLİYOR"}</span></div>
        {(machine.ip||machine.osModel||machine.dataSource||machine.protocol||machine.location)&&<div style={{display:"grid",gap:3,marginTop:9,fontSize:10,color:"#64748B",lineHeight:1.35}}>
          {machine.ip&&<span>IP: <b style={{color:"#334155"}}>{machine.ip}</b></span>}
          {machine.osModel&&<span>OS/Model: {machine.osModel}</span>}
          {machine.dataSource&&<span>Veri: {machine.dataSource}{machine.protocol?` · ${machine.protocol}`:""}</span>}
          {machine.location&&<span>Lokasyon: {machine.location}</span>}
        </div>}
        {machine.lastControlAt&&<div style={{fontSize:10,color:machine.lastPerfectData?"#059669":"#E11D48",fontWeight:850,marginTop:8}}>Son kontrol: {machine.lastPerfectData?"Perfect veri":"Sorun var"} · {new Date(machine.lastControlAt).toLocaleDateString("tr-TR")}</div>}
        {machine.commissionedAt&&<div style={{fontSize:11,color:"#64748B",marginTop:9}}>Devreye alma: {fmt(machine.commissionedAt)}</div>}
        {!machine.commissioned&&<textarea disabled={!canEdit} value={machine.note||""} onChange={e=>update(machine.id,{note:e.target.value})} placeholder="Neden devreye alınamadı?" style={{...iStyle,height:58,resize:"vertical",marginTop:9,fontSize:11}} />}
        {canEdit&&<div style={{display:"flex",justifyContent:"space-between",marginTop:10,gap:6,flexWrap:"wrap"}}><Btn small variant={machine.commissioned?"warning":"success"} onClick={()=>update(machine.id,{commissioned:!machine.commissioned,commissionedAt:!machine.commissioned?todayStr():""})}>{machine.commissioned?"Devreden Çıkar":"Devreye Al"}</Btn><div style={{display:"flex",gap:6}}><Btn small variant="secondary" onClick={()=>edit(machine)}>Düzenle</Btn><Btn small variant="danger" onClick={()=>onChange(machines.filter(m=>m.id!==machine.id))}>Sil</Btn></div></div>}
      </div>)}
    </div>
  </div>;
}
