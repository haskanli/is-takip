import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { commissioningMachines } from "../domain/projectHelpers.js";
import { Btn, Field, iStyle } from "./primitives.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().slice(0, 10);
const safeFileName = (value) => String(value || "rapor").replace(/[^a-zA-Z0-9_-]/g, "_");
const downloadXlsx = (rows, fileName, sheetName = "Rapor") => {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  XLSX.writeFile(book, fileName);
};

const COMMISSIONING_LEVELS = [
  { label:"Sekt\u00f6r", childKey:"productionCenters", childLabel:"\u00dcretim Merkezi" },
  { label:"\u00dcretim Merkezi", childKey:"workplaces", childLabel:"\u0130\u015fyeri" },
  { label:"\u0130\u015fyeri", childKey:"lines", childLabel:"Hat" },
  { label:"Hat", childKey:"machines", childLabel:"Makine" },
];
const commissioningRows=(sectors=[])=>sectors.flatMap(sector=>(sector.productionCenters||[]).flatMap(center=>(center.workplaces||[]).flatMap(workplace=>(workplace.lines||[]).flatMap(line=>(line.machines||[]).map(machine=>({sector:sector.name,productionCenter:center.name,workplace:workplace.name,line:line.name,machine}))))));
const commissioningTreeFromRows=(rows=[])=>{
  const sectors=[];
  const getOrCreate=(list,name,childKey)=>{
    let item=list.find(entry=>entry.name===name);
    if(!item){item={id:uid(),name,[childKey]:[]};list.push(item);}
    return item;
  };
  rows.forEach(row=>{
    if(!row.sector||!row.productionCenter||!row.workplace||!row.line||!row.machine?.name)return;
    const sector=getOrCreate(sectors,row.sector,"productionCenters");
    const center=getOrCreate(sector.productionCenters,row.productionCenter,"workplaces");
    const workplace=getOrCreate(center.workplaces,row.workplace,"lines");
    const line=getOrCreate(workplace.lines,row.line,"machines");
    line.machines.push({id:uid(),code:"",type:"physical",commissioned:false,commissionedAt:"",note:"",...row.machine});
  });
  return sectors;
};
const updateCommissioningNodes=(nodes,id,updater,level=0)=>(nodes||[]).map(node=>{
  if(node.id===id)return updater(node);
  const childKey=COMMISSIONING_LEVELS[level]?.childKey;
  return childKey&&node[childKey]?{...node,[childKey]:updateCommissioningNodes(node[childKey],id,updater,level+1)}:node;
});
const removeCommissioningNode=(nodes,id,level=0)=>(nodes||[]).filter(node=>node.id!==id).map(node=>{
  const childKey=COMMISSIONING_LEVELS[level]?.childKey;
  return childKey&&node[childKey]?{...node,[childKey]:removeCommissioningNode(node[childKey],id,level+1)}:node;
});

export function CommissioningPanel({ project, canEdit, onChange }) {
  const sectors=project.commissioningTree||[];
  const [filter,setFilter]=useState("all");
  const [showForm,setShowForm]=useState(false);
  const [editingMachineId,setEditingMachineId]=useState("");
  const [form,setForm]=useState({sector:"",productionCenter:"",workplace:"",line:"",name:"",code:"",type:"physical",commissioned:false,note:""});
  const fileRef=useRef(null);
  const machines=commissioningMachines(sectors);
  const rows=commissioningRows(sectors);
  const commissioned=machines.filter(machine=>machine.commissioned).length;
  const physical=machines.filter(machine=>machine.type!=="virtual").length;
  const virtual=machines.filter(machine=>machine.type==="virtual").length;
  const percent=machines.length?Math.round(commissioned/machines.length*100):0;
  const update=(id,updater)=>onChange(updateCommissioningNodes(sectors,id,updater));
  const remove=(id)=>onChange(removeCommissioningNode(sectors,id));
  const visibleRows=rows.filter(row=>filter==="all"||(filter==="done"?row.machine.commissioned:!row.machine.commissioned));
  const addMachine=()=>{
    if(!form.sector.trim()||!form.productionCenter.trim()||!form.workplace.trim()||!form.line.trim()||!form.name.trim())return;
    const machine={id:editingMachineId||uid(),name:form.name.trim(),code:form.code.trim(),type:form.type,commissioned:form.commissioned,commissionedAt:form.commissioned?(rows.find(row=>row.machine.id===editingMachineId)?.machine.commissionedAt||todayStr()):"",note:form.note.trim()};
    const nextRows=[...rows.filter(row=>row.machine.id!==editingMachineId),{sector:form.sector.trim(),productionCenter:form.productionCenter.trim(),workplace:form.workplace.trim(),line:form.line.trim(),machine}];
    onChange(commissioningTreeFromRows(nextRows));
    setForm({sector:"",productionCenter:"",workplace:"",line:"",name:"",code:"",type:"physical",commissioned:false,note:""});
    setEditingMachineId("");
    setShowForm(false);
  };
  const editMachine=row=>{setEditingMachineId(row.machine.id);setForm({sector:row.sector,productionCenter:row.productionCenter,workplace:row.workplace,line:row.line,name:row.machine.name||"",code:row.machine.code||"",type:row.machine.type||"physical",commissioned:Boolean(row.machine.commissioned),note:row.machine.note||""});setShowForm(true);};
  const exportExcel=()=>{
    const data=[["Sekt\u00f6r","\u00dcretim Merkezi","\u0130\u015fyeri","Hat","Makine Kodu","Makine Ad\u0131","Tip","Devreye Al\u0131nd\u0131","Devreye Alma Tarihi","A\u00e7\u0131klama"]];
    rows.forEach(row=>data.push([row.sector,row.productionCenter,row.workplace,row.line,row.machine.code||"",row.machine.name,row.machine.type==="virtual"?"Sanal":"Fiziksel",row.machine.commissioned?"Evet":"Hay\u0131r",row.machine.commissionedAt||"",row.machine.note||""]));
    downloadXlsx(data,`${safeFileName(project.name)}-devreye-alma.xlsx`,"Devreye Alma");
  };
  const importExcel=(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const workbook=XLSX.read(reader.result,{type:"array"});
        const data=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
        const imported=data.map(item=>({sector:String(item["Sekt\u00f6r"]||item.Sektor||"").trim(),productionCenter:String(item["\u00dcretim Merkezi"]||item["Uretim Merkezi"]||"").trim(),workplace:String(item["\u0130\u015fyeri"]||item.Isyeri||"").trim(),line:String(item.Hat||"").trim(),machine:{name:String(item["Makine Ad\u0131"]||item["Makine Adi"]||"").trim(),code:String(item["Makine Kodu"]||"").trim(),type:String(item.Tip||"").toLocaleLowerCase("tr-TR")==="sanal"?"virtual":"physical",commissioned:["evet","true","1"].includes(String(item["Devreye Al\u0131nd\u0131"]||item["Devreye Alindi"]||"").toLocaleLowerCase("tr-TR")),commissionedAt:String(item["Devreye Alma Tarihi"]||""),note:String(item["A\u00e7\u0131klama"]||item.Aciklama||"")}})).filter(row=>row.machine.name);
        onChange(commissioningTreeFromRows([...rows,...imported]));
      }catch(error){alert(`Excel okunamad\u0131: ${error.message}`);}
      event.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };
  return <div style={{flex:1,overflow:"auto",padding:"clamp(14px,3vw,24px)",background:"#F8FAFC"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
      <div><h3 style={{margin:0,fontSize:17}}>Toplu Devreye Alma Takibi</h3><div style={{fontSize:11,color:"#64748B",marginTop:3}}>T\u00fcm hiyerar\u015fi tek listede; filtreleyin, i\u015faretleyin veya Excel ile y\u00f6netin.</div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Btn small variant="secondary" onClick={exportExcel}>Excel D\u0131\u015fa Aktar</Btn>{canEdit&&<><Btn small variant="secondary" onClick={()=>fileRef.current?.click()}>Excel \u0130\u00e7e Aktar</Btn><input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importExcel}/><Btn small onClick={()=>{setEditingMachineId("");setForm({sector:"",productionCenter:"",workplace:"",line:"",name:"",code:"",type:"physical",commissioned:false,note:""});setShowForm(value=>!value);}}>{showForm?"Formu Kapat":"+ Kay\u0131t Ekle"}</Btn></>}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:9,marginBottom:13}}>
      {[["\u0130lerleme",`${percent}%`,"#4A6CF7"],["Devrede",`${commissioned}/${machines.length}`,"#059669"],["Fiziksel",physical,"#0369A1"],["Sanal",virtual,"#7C3AED"],["Bekleyen",machines.length-commissioned,"#EA6C00"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:11,padding:12}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><div style={{fontSize:21,fontWeight:800,color,marginTop:2}}>{value}</div></div>)}
    </div>
    <div style={{height:10,background:"#E2E8F0",borderRadius:10,overflow:"hidden",marginBottom:13}}><div style={{height:"100%",width:`${percent}%`,background:"linear-gradient(90deg,#4A6CF7,#10B981)",transition:"width .25s"}}/></div>
    <div style={{display:"flex",gap:6,marginBottom:13}}>{[["all","T\u00fcm\u00fc"],["pending","Devreye Al\u0131nacak"],["done","Devreye Al\u0131nan"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{border:0,borderRadius:8,padding:"7px 11px",background:filter===id?"#4A6CF7":"#fff",color:filter===id?"#fff":"#64748B",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>)}</div>
    {showForm&&<div style={{background:"#fff",border:"1px solid #DDE7F5",borderRadius:13,padding:15,marginBottom:14}}><div style={{fontSize:12,fontWeight:850,marginBottom:10}}>{editingMachineId?"Makine Kayd\u0131n\u0131 D\u00fczenle":"Yeni Makine Kayd\u0131"}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}>{[["sector","Sekt\u00f6r"],["productionCenter","\u00dcretim Merkezi"],["workplace","\u0130\u015fyeri"],["line","Hat"],["name","Makine Ad\u0131"],["code","Makine Kodu"]].map(([key,label])=><Field key={key} label={label}><input style={iStyle} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></Field>)}<Field label="Tip"><select style={iStyle} value={form.type} onChange={event=>setForm(current=>({...current,type:event.target.value}))}><option value="physical">Fiziksel</option><option value="virtual">Sanal</option></select></Field></div><Field label="A\u00e7\u0131klama"><input style={iStyle} value={form.note} onChange={event=>setForm(current=>({...current,note:event.target.value}))}/></Field><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><label style={{fontSize:12,fontWeight:700}}><input type="checkbox" checked={form.commissioned} onChange={event=>setForm(current=>({...current,commissioned:event.target.checked}))}/> Devreye al\u0131nd\u0131</label><Btn onClick={addMachine}>{editingMachineId?"Değişiklikleri Kaydet":"Kaydet"}</Btn></div></div>}
    <div style={{overflowX:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:13}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}><thead><tr>{["Durum","Sekt\u00f6r","\u00dcretim Merkezi","\u0130\u015fyeri","Hat","Makine","Tip","A\u00e7\u0131klama",""].map(label=><th key={label} style={{padding:"10px 9px",fontSize:10,color:"#64748B",background:"#F8FAFC",textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row=><tr key={row.machine.id} style={{borderTop:"1px solid #EEF2F7"}}><td style={{padding:9}}><input type="checkbox" checked={Boolean(row.machine.commissioned)} disabled={!canEdit} onChange={event=>update(row.machine.id,current=>({...current,commissioned:event.target.checked,commissionedAt:event.target.checked?todayStr():""}))}/></td>{[row.sector,row.productionCenter,row.workplace,row.line].map((value,index)=><td key={index} style={{padding:9,fontSize:11,color:"#475569"}}>{value}</td>)}<td style={{padding:9}}><div style={{fontSize:11,fontWeight:800}}>{row.machine.name}</div><div style={{fontSize:9,color:"#94A3B8"}}>{row.machine.code||"Kod yok"}</div></td><td style={{padding:9,fontSize:11}}>{row.machine.type==="virtual"?"Sanal":"Fiziksel"}</td><td style={{padding:9,minWidth:190}}>{canEdit?<input style={{...iStyle,padding:"6px 8px",fontSize:10}} value={row.machine.note||""} onChange={event=>update(row.machine.id,current=>({...current,note:event.target.value}))}/>:<span style={{fontSize:10,color:"#64748B"}}>{row.machine.note||"-"}</span>}</td><td style={{padding:9}}>{canEdit&&<div style={{display:"flex",gap:7}}><button onClick={()=>editMachine(row)} style={{border:0,background:"transparent",color:"#4A6CF7",cursor:"pointer",fontSize:11}}>D\u00fczenle</button><button onClick={()=>confirm("Makine silinsin mi?")&&remove(row.machine.id)} style={{border:0,background:"transparent",color:"#E11D48",cursor:"pointer",fontSize:11}}>Sil</button></div>}</td></tr>)}</tbody></table></div>
    {!visibleRows.length&&<div style={{padding:35,textAlign:"center",color:"#94A3B8"}}>Bu filtrede kay\u0131t bulunmuyor.</div>}
  </div>;
}
