import { useState } from "react";
import { fieldPlanHours } from "../domain/projectHelpers.js";
import { Btn, Field, Icon, iStyle } from "./primitives.jsx";
import { FieldVisitModal } from "./fieldOperationsComponents.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const DEFAULT_ACTION_TAGS = [
  "Toplantı",
  "Telefon / Görüşme",
  "Yazışma",
  "Sistem Kontrolü",
  "Saha Ziyareti",
  "Takip",
  "Karar",
  "Bilgilendirme",
  "Diğer",
];

export function ProjectActionsPanel({project,currentUser,state,setState,isAdmin,canManage}) {
  const actions=((state.projectActions||{})[project.id])||[];
  const actionTags=(project.actionTags?.length?project.actionTags:DEFAULT_ACTION_TAGS);
  const personalTodos=(((state.userNotes||{})[currentUser.id]?.todos)||[]).filter(todo=>todo.projectId===project.id&&!todo.done&&!todo.actionId);
  const [visitPlan,setVisitPlan]=useState(null);
  const fieldActions=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id).map(plan=>{
    const person=state.people.find(item=>item.id===plan.userId);
    const completed=plan.status==="completed"||plan.completedAt;
    const time=`${plan.actualStartTime||plan.startTime||""} - ${plan.actualEndTime||plan.endTime||""}`;
    return {
      id:`field-${plan.id}`,
      source:"field_visit",
      tag:plan.workType==="remote"?"Uzaktan Çalışma":"Saha Ziyareti",
      authorId:plan.userId,
      authorName:person?.name||"Kullanıcı",
      actionAt:`${plan.date}T${plan.actualStartTime||plan.startTime||"09:00"}:00`,
      text:completed
        ?`${plan.workType==="remote"?"Uzaktan çalışma":"Saha ziyareti"} gerçekleştirildi (${time}, ${fieldPlanHours(plan)} saat efor).\n${plan.visitNotes||"Çalışma notu girilmedi."}`
        :`${plan.workType==="remote"?"Uzaktan çalışma":"Saha ziyareti"} planlandı (${time}).${plan.note?`\n${plan.note}`:""}`,
      completed,
      plan,
    };
  });
  const lessonActions=(project.lessonsLearned||[]).map(item=>({id:`lesson-${item.id}`,source:"lesson",tag:"Öğrenilmiş Ders",authorId:item.authorId,authorName:item.authorName||"Kullanıcı",actionAt:item.createdAt,createdAt:item.createdAt,text:[item.title,item.lesson,item.prevention?`Önleyici aksiyon: ${item.prevention}`:""].filter(Boolean).join("\n")}));
  const [text,setText]=useState("");
  const [effortHours,setEffortHours]=useState("");
  const [actionAt,setActionAt]=useState(()=>new Date().toISOString().slice(0,16));
  const [editingId,setEditingId]=useState(null);
  const [filter,setFilter]=useState("");
  const [tagFilter,setTagFilter]=useState("all");
  const [selectedTag,setSelectedTag]=useState(actionTags[0]||"Diğer");
  const [newTag,setNewTag]=useState("");
  const [todoEfforts,setTodoEfforts]=useState({});
  const [showActionForm,setShowActionForm]=useState(false);
  const saveActions=next=>setState(s=>({...s,projectActions:{...(s.projectActions||{}),[project.id]:next}}));
  const saveTags=next=>setState(s=>({...s,projects:s.projects.map(item=>item.id===project.id?{...item,actionTags:next}:item)}));
  const addTag=()=>{
    const value=newTag.trim();
    if(!value||actionTags.some(tag=>tag.toLocaleLowerCase("tr-TR")===value.toLocaleLowerCase("tr-TR")))return;
    saveTags([...actionTags,value]);
    setSelectedTag(value);
    setNewTag("");
  };
  const submit=()=>{
    if(!text.trim())return;
    const actionDate=new Date(actionAt);
    const actionIso=Number.isNaN(actionDate.getTime())?now():actionDate.toISOString();
    if(editingId){
      saveActions(actions.map(item=>item.id===editingId?{...item,tag:selectedTag,text:text.trim(),effortHours:parseFloat(effortHours)||0,actionAt:actionIso,updatedAt:now(),updatedBy:currentUser.name}:item));
    }else{
      saveActions([{id:uid(),tag:selectedTag,text:text.trim(),effortHours:parseFloat(effortHours)||0,actionAt:actionIso,createdAt:now(),authorId:currentUser.id,authorName:currentUser.name},...actions]);
    }
    setText("");
    setEffortHours("");
    setActionAt(new Date().toISOString().slice(0,16));
    setEditingId(null);
    setShowActionForm(false);
  };
  const edit=item=>{setEditingId(item.id);setSelectedTag(item.tag||"Diğer");setText(item.text);setEffortHours(item.effortHours||"");setActionAt(new Date(item.actionAt||item.createdAt).toISOString().slice(0,16));setShowActionForm(true);};
  const remove=id=>saveActions(actions.filter(item=>item.id!==id));
  const sendTodoToActions=todo=>{
    const action={id:uid(),tag:"Takip",text:todo.action||todo.text,effortHours:parseFloat(todoEfforts[todo.id])||0,actionAt:now(),createdAt:now(),authorId:currentUser.id,authorName:currentUser.name,source:"personal_todo",todoId:todo.id};
    setState(current=>({...current,
      projectActions:{...(current.projectActions||{}),[project.id]:[action,...(((current.projectActions||{})[project.id])||[])]},
      userNotes:{...(current.userNotes||{}),[currentUser.id]:{...((current.userNotes||{})[currentUser.id]),todos:(((current.userNotes||{})[currentUser.id]?.todos)||[]).map(item=>item.id===todo.id?{...item,actionId:action.id,actionSentAt:now()}:item)}}
    }));
  };
  const shown=[...actions,...fieldActions,...lessonActions].filter(item=>(tagFilter==="all"||(item.tag||"Diğer")===tagFilter)&&(!filter.trim()||`${item.text} ${item.authorName} ${item.tag||""}`.toLocaleLowerCase("tr-TR").includes(filter.trim().toLocaleLowerCase("tr-TR")))).sort((a,b)=>new Date(b.actionAt||b.createdAt)-new Date(a.actionAt||a.createdAt));
  return <div style={{flex:1,overflow:"auto",padding:"clamp(16px,3vw,26px)",maxWidth:1050,width:"100%",display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,flexWrap:"wrap",marginBottom:17}}><div><h3 style={{margin:0,fontSize:17,display:"flex",alignItems:"center",gap:8}}><Icon name="activity" size={19}/>Proje Aksiyonları</h3><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Görüşme, arama, yazışma ve sistem kontrollerini kolayca kaydedin.</p></div><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><select style={{...iStyle,width:175}} value={tagFilter} onChange={e=>setTagFilter(e.target.value)}><option value="all">Tüm aksiyon türleri</option>{actionTags.map(tag=><option key={tag}>{tag}</option>)}</select><input style={{...iStyle,width:220}} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Aksiyonlarda ara..."/>{canManage&&<Btn onClick={()=>{setEditingId(null);setSelectedTag(actionTags[0]||"Diğer");setText("");setEffortHours("");setActionAt(new Date().toISOString().slice(0,16));setShowActionForm(value=>!value);}}>{showActionForm?"Formu Kapat":"+ Aksiyon Ekle"}</Btn>}</div></div>
    {canManage&&showActionForm&&<div style={{background:"#fff",border:"1.5px solid #C7D2FE",borderRadius:14,padding:16,marginBottom:17,boxShadow:"0 7px 22px var(--accent)12",order:1}}>
      <div style={{display:"grid",gridTemplateColumns:"minmax(190px,260px) 1fr",gap:10,alignItems:"end",marginBottom:10}}><Field label="Aksiyon Türü"><select style={iStyle} value={selectedTag} onChange={e=>setSelectedTag(e.target.value)}>{actionTags.map(tag=><option key={tag}>{tag}</option>)}</select></Field><div style={{display:"flex",gap:7,alignItems:"flex-end"}}><Field label="Yeni tür ekle"><input style={iStyle} value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="Örn. Eğitim"/></Field><Btn small variant="secondary" onClick={addTag}>Ekle</Btn></div></div>
      <Field label="Aksiyon"><textarea style={{...iStyle,minHeight:82,resize:"vertical",lineHeight:1.5}} value={text} onChange={e=>setText(e.target.value)} placeholder="Örn. Müşteriyle görüştüm, revize teklif mailini ilettim. Teknik ekipten dönüş bekliyorum."/></Field>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:10,flexWrap:"wrap"}}><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><div style={{width:230}}><Field label="Aksiyon Tarihi"><input type="datetime-local" style={iStyle} value={actionAt} onChange={e=>setActionAt(e.target.value)}/></Field></div><div style={{width:170}}><Field label="Efor (Saat, isteğe bağlı)"><input type="number" min="0" step="0.25" style={iStyle} value={effortHours} onChange={e=>setEffortHours(e.target.value)} placeholder="Örn. 1.5"/></Field></div></div><div style={{display:"flex",gap:7,marginBottom:13}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId(null);setText("");setEffortHours("");setActionAt(new Date().toISOString().slice(0,16));}}>İptal</Btn>}<Btn disabled={!text.trim()} onClick={submit}>{editingId?"Aksiyonu Güncelle":"Aksiyon Ekle"}</Btn></div></div>
    </div>}
    {!canManage&&<div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 13px",fontSize:11,color:"#64748B",marginBottom:14,order:1}}>Aksiyon ekleme yetkisi proje yöneticileri ve sistem yöneticilerindedir.</div>}
    <div style={{position:"relative",paddingLeft:24,order:2,marginBottom:16}}>
      <div style={{position:"absolute",left:7,top:8,bottom:8,width:2,background:"#E2E8F0"}}/>
      {shown.map(item=>{const canEdit=!["field_visit","lesson"].includes(item.source)&&(isAdmin||item.authorId===currentUser.id);return <div key={item.id} style={{position:"relative",background:"#fff",border:`1.5px solid ${item.source==="field_visit"?"#A7F3D0":item.source==="lesson"?"var(--border)":"#E2E8F0"}`,borderRadius:12,padding:"13px 15px",marginBottom:10}}>
        <span style={{position:"absolute",left:-22,top:18,width:12,height:12,borderRadius:"50%",background:item.source==="field_visit"?"#059669":project.color,border:"3px solid #F8FAFC"}}/>
        <span style={{display:"inline-block",fontSize:9,fontWeight:850,color:item.source==="field_visit"?(item.completed?"var(--success)":"#0369A1"):"#4338CA",background:item.source==="field_visit"?(item.completed?"#ECFDF5":"#F0F9FF"):"#EEF2FF",borderRadius:6,padding:"3px 6px",marginBottom:7}}>{item.source==="field_visit"?(item.plan?.workType==="remote"?(item.completed?"UZAKTAN ÇALIŞMA":"UZAKTAN PLAN"):(item.completed?"SAHA ZİYARETİ":"SAHA PLANI")):(item.tag||"Diğer").toLocaleUpperCase("tr-TR")}</span>
        <div style={{fontSize:13,color:"#1E293B",lineHeight:1.55,whiteSpace:"pre-wrap"}}>{item.text}</div>
        {item.source!=="field_visit"&&Number(item.effortHours)>0&&<span style={{display:"inline-block",marginTop:8,background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"3px 7px",fontSize:10,fontWeight:800}}>Efor: {item.effortHours} saat</span>}
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginTop:9,fontSize:10,color:"#94A3B8"}}><span style={{fontWeight:700,color:"#64748B"}}>{item.authorName}</span><span>·</span><span>{new Date(item.actionAt||item.createdAt).toLocaleString("tr-TR")}</span>{item.updatedAt&&<span>· Düzenlendi</span>}{item.source==="field_visit"&&(isAdmin||item.authorId===currentUser.id)&&<button onClick={()=>setVisitPlan(item.plan)} style={{marginLeft:"auto",border:0,background:"#ECFDF5",color:"var(--success)",borderRadius:7,padding:"5px 8px",fontSize:9,fontWeight:850,cursor:"pointer"}}>{item.completed?"Ziyaret ve eforu düzenle":"Not ve efor gir"}</button>}{canEdit&&<span style={{marginLeft:item.source==="field_visit"?0:"auto",display:"flex",gap:8}}><button onClick={()=>edit(item)} style={{border:0,background:"transparent",color:"#4A6CF7",fontSize:10,fontWeight:700,cursor:"pointer"}}>Düzenle</button><button onClick={()=>confirm("Aksiyon silinsin mi?")&&remove(item.id)} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:700,cursor:"pointer"}}>Sil</button></span>}</div>
      </div>})}
      {!shown.length&&<div style={{padding:38,textAlign:"center",border:"1.5px dashed var(--muted)",borderRadius:12,color:"#94A3B8",fontSize:12}}>Henüz proje aksiyonu kaydedilmedi.</div>}
    </div>
    {personalTodos.length>0&&<div style={{background:"#FDF2F8",border:"1px solid #FBCFE8",borderRadius:13,padding:13,marginBottom:14,order:3}}><div style={{fontSize:11,fontWeight:850,color:"#BE185D",marginBottom:8}}>BU PROJEYE BAĞLI KİŞİSEL TO-DO'LARIM</div><div style={{display:"grid",gap:7}}>{personalTodos.map(todo=><div key={todo.id} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:9,padding:"8px 10px"}}><span style={{fontSize:11,fontWeight:700,flex:1}}>{todo.action||todo.text}</span><input type="number" min="0" step=".25" title="Efor saati" value={todoEfforts[todo.id]||""} onChange={event=>setTodoEfforts(current=>({...current,[todo.id]:event.target.value}))} placeholder="Efor" style={{...iStyle,width:75,padding:"5px 7px",fontSize:10}}/><button onClick={()=>sendTodoToActions(todo)} style={{border:0,background:"#DB2777",color:"#fff",borderRadius:7,padding:"6px 8px",fontSize:9,fontWeight:800,cursor:"pointer"}}>Aksiyona Gönder</button></div>)}</div></div>}
    {visitPlan&&<FieldVisitModal plan={visitPlan} project={project} currentUser={currentUser} onClose={()=>setVisitPlan(null)} onSave={data=>{setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).map(plan=>plan.id===visitPlan.id?{...plan,...data,status:"completed",completedAt:plan.completedAt||now(),updatedAt:now()}:plan)}));setVisitPlan(null);}}/>}
  </div>;
}
