import { useState } from "react";
import { apiHeaders, apiUrl } from "../api";
import { Btn, Field, Icon, iStyle } from "./primitives.jsx";
export function AIWorkspace({projects=[],initialProjectId="",embedded=false}) {
  const [scope,setScope]=useState(initialProjectId?"project":"portfolio");
  const [projectId,setProjectId]=useState(initialProjectId||projects[0]?.id||"");
  const [question,setQuestion]=useState("En kritik riskleri, gecikmeleri ve öncelikli aksiyonları yorumla.");
  const [answer,setAnswer]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const ask=async()=>{
    if(!question.trim()||(scope==="project"&&!projectId))return;
    setLoading(true);setError("");
    try{
      const response=await fetch(apiUrl("/api/ai/project-insight"),{method:"POST",headers:await apiHeaders({"Content-Type":"application/json"}),body:JSON.stringify({scope,projectId:scope==="project"?projectId:undefined,question:question.trim()})});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||"AI yanıtı alınamadı.");
      setAnswer(body.answer);
    }catch(requestError){setError(requestError.message);}finally{setLoading(false);}
  };
  return <div style={{padding:embedded?0:"clamp(18px,4vw,30px)",flex:1,overflow:"auto",background:embedded?"transparent":"var(--page-bg, transparent)"}}><div style={{maxWidth:900,margin:embedded?0:"0 auto"}}>
    {!embedded&&<div style={{marginBottom:17}}><div style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--accent-ink)",color:"var(--accent)",borderRadius:20,padding:"5px 10px",fontSize:10,fontWeight:850}}><Icon name="activity" size={13}/>CORJECT AI</div><h2 style={{margin:"8px 0 4px",fontSize:23}}>Proje ve Portföy Asistanı</h2><p style={{margin:0,fontSize:12,color:"var(--muted)"}}>Görev, termin, risk, checklist ve ticket özetlerinden yönetilebilir öneriler üretir.</p></div>}
    <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:16,padding:"clamp(14px,3vw,20px)",boxShadow:"var(--shadow-soft)"}}>
      <div style={{background:"var(--surface-soft)",borderRadius:10,padding:"9px 12px",fontSize:10,color:"var(--muted)",marginBottom:13}}>Uzaktan erişim parolaları ve doküman içerikleri AI analizine gönderilmez. Sonuçlar karar desteğidir; kaynak kayıtlarla doğrulanmalıdır.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}><Field label="Analiz Kapsamı"><select style={iStyle} value={scope} onChange={event=>setScope(event.target.value)}><option value="portfolio">Tüm erişilebilir projeler</option><option value="project">Tek proje</option></select></Field><Field label="Proje"><select disabled={scope!=="project"} style={{...iStyle,opacity:scope==="project"?1:.55}} value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="">Proje seçin</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></Field></div>
      <Field label="Sorunuz"><textarea style={{...iStyle,minHeight:105,resize:"vertical",lineHeight:1.55}} value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter")ask();}}/></Field>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:9,color:"var(--muted)"}}>Ctrl + Enter ile analiz edebilirsiniz.</span><Btn disabled={loading||!question.trim()||(scope==="project"&&!projectId)} onClick={ask}>{loading?"Analiz ediliyor...":"Yorumla"}</Btn></div>
      {error&&<div style={{marginTop:12,padding:12,borderRadius:10,background:"color-mix(in srgb, var(--danger) 9%, white 91%)",color:"var(--danger)",fontSize:11}}>{error}</div>}
      {answer&&<div style={{marginTop:14,padding:16,borderRadius:13,background:"var(--surface-soft)",border:"1px solid var(--border)",whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.75}}>{answer}</div>}
    </div>
  </div></div>;
}

