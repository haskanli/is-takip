import { useState } from "react";
import { supabase } from "../supabase";
import corjectLogo from "../assets/corject-logo.png";
import { iStyle } from "./primitives.jsx";

export function LoginScreen({ people, onLogin, appVersion }) {
  const [sel, setSel] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  return (
    <div className="login-screen" style={{ position:"fixed", inset:0, background:"linear-gradient(145deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)", display:"flex", alignItems:"flex-start", justifyContent:"center", fontFamily:"Inter,Segoe UI,sans-serif", overflowY:"auto", padding:"clamp(10px,3vh,28px) 0" }}>
      <div className="login-shell" style={{ width:"100%", maxWidth:640, padding:"0 20px 14px", boxSizing:"border-box", margin:"auto 0" }}>
        {/* Logo */}
        <div className="login-brand" style={{ textAlign:"center", marginBottom:"clamp(12px,3vh,30px)" }}>
          <img className="login-logo" src={corjectLogo} alt="Corject" style={{ width:"clamp(48px,8vh,76px)", height:"clamp(48px,8vh,76px)", objectFit:"contain", marginBottom:6, filter:"drop-shadow(0 10px 22px rgba(74,108,247,.35))" }} />
          <div style={{ fontSize:"clamp(17px,2.5vh,22px)", fontWeight:800, color:"#fff", letterSpacing:3, textTransform:"uppercase" }}>CORJECT</div>
          <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>Proje Yönetim Sistemi</div>
        </div>
        {/* Card */}
        <div className="login-card" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:"clamp(14px,3vh,26px) 24px", backdropFilter:"blur(10px)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#94A3B8", marginBottom:"clamp(8px,2vh,15px)", textAlign:"center" }}>Hesabınızı seçin</div>
          <div className="login-users" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:8, marginBottom:"clamp(10px,2vh,20px)", maxHeight:"min(44vh,390px)", overflowY:"auto", paddingRight:2 }}>
            {people.map(p => (
              <div key={p.id} onClick={() => setSel(p.id)}
                onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, padding:"clamp(8px,1.5vh,12px) 10px", borderRadius:12, textAlign:"center",
                  border:`1.5px solid ${sel===p.id?"#4A6CF7":hoveredId===p.id?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.08)"}`,
                  cursor:"pointer", background:sel===p.id?"rgba(74,108,247,0.15)":"rgba(255,255,255,0.03)",
                  transition:"all .15s" }}>
                <div style={{ width:38, height:38, borderRadius:10, background:p.isAdmin?"rgba(225,29,72,0.2)":"rgba(74,108,247,0.2)", border:`1.5px solid ${p.isAdmin?"rgba(225,29,72,0.4)":"rgba(74,108,247,0.4)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:p.isAdmin?"#FCA5A5":"#93C5FD", flexShrink:0 }}>{p.avatar}</div>
                <div style={{ minWidth:0, width:"100%" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#F1F5F9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                  <div style={{ fontSize:10, color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.role}</div>
                </div>
                {p.isAdmin && <span style={{ background:"rgba(225,29,72,0.2)", color:"#FCA5A5", borderRadius:6, padding:"2px 8px", fontSize:10, fontWeight:700 }}>YÖN</span>}
                {sel===p.id && <span style={{ color:"#4A6CF7", fontSize:16 }}>✓</span>}
              </div>
            ))}
          </div>
          <button disabled={!sel} onClick={() => sel && onLogin(sel)}
            style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", cursor:sel?"pointer":"default",
              background:sel?"linear-gradient(135deg,#4A6CF7,#7C3AED)":"rgba(255,255,255,0.05)",
              color:sel?"#fff":"#475569", fontSize:14, fontWeight:700, fontFamily:"inherit",
              transition:"all .2s", boxShadow:sel?"0 4px 16px rgba(74,108,247,0.4)":"none" }}>
            {sel ? "Giriş Yap →" : "Hesap Seçin"}
          </button>
        </div>
        <div className="login-version" style={{ textAlign:"center", marginTop:"clamp(8px,2vh,18px)", fontSize:10, color:"#475569" }}>CORJECT {appVersion} · Proje Yönetimi</div>
      </div>
    </div>
  );
}

function SlackLogo({ size=22 }) {
  return <svg width={size} height={size} viewBox="0 0 122.8 122.8" aria-hidden="true">
    <path fill="#36C5F0" d="M30.3 77.6a15.1 15.1 0 1 1-15.1-15.1h15.1v15.1Zm7.6 0a15.1 15.1 0 0 1 30.2 0v37.8a15.1 15.1 0 0 1-30.2 0V77.6Z"/>
    <path fill="#2EB67D" d="M45.4 30.3a15.1 15.1 0 1 1 15.1-15.1v15.1H45.4Zm0 7.6a15.1 15.1 0 0 1 0 30.2H7.6a15.1 15.1 0 0 1 0-30.2h37.8Z"/>
    <path fill="#ECB22E" d="M92.5 45.4a15.1 15.1 0 1 1 15.1 15.1H92.5V45.4Zm-7.6 0a15.1 15.1 0 0 1-30.2 0V7.6a15.1 15.1 0 0 1 30.2 0v37.8Z"/>
    <path fill="#E01E5A" d="M77.6 92.5a15.1 15.1 0 1 1-15.1 15.1V92.5h15.1Zm0-7.6a15.1 15.1 0 0 1 0-30.2h37.8a15.1 15.1 0 0 1 0 30.2H77.6Z"/>
  </svg>;
}

export function AuthLoginScreen({ appVersion }) {
  const rememberedEmail = (() => {
    try { return localStorage.getItem("corject_remember_email") || ""; }
    catch { return ""; }
  })();
  const [email,setEmail]=useState(rememberedEmail);
  const [password,setPassword]=useState("");
  const [rememberMe,setRememberMe]=useState(Boolean(rememberedEmail));
  const [showAlternatives,setShowAlternatives]=useState(false);
  const [status,setStatus]=useState({loading:false,message:"",error:false});
  const syncRememberedEmail = (value) => {
    try {
      if (rememberMe) localStorage.setItem("corject_remember_email", value);
      else localStorage.removeItem("corject_remember_email");
    } catch {}
  };
  const slackLogin=async()=>{
    setStatus({loading:true,message:"",error:false});
    const {error}=await supabase.auth.signInWithOAuth({
      provider:"slack_oidc",
      options:{
        redirectTo:`${window.location.origin}/`,
        scopes:"openid profile email",
      },
    });
    if(error)setStatus({loading:false,message:error.message,error:true});
  };
  const passwordLogin=async()=>{
    const value=email.trim().toLowerCase();
    if(!value||!password){setStatus({loading:false,message:"E-posta ve \u015fifre girin.",error:true});return;}
    setStatus({loading:true,message:"",error:false});
    const {error}=await supabase.auth.signInWithPassword({email:value,password});
    if(!error)syncRememberedEmail(value);
    setStatus(error
      ?{loading:false,message:error.message,error:true}
      :{loading:false,message:"Giri\u015f ba\u015far\u0131l\u0131, y\u00f6nlendiriliyorsunuz...",error:false});
  };
  const sendResetLink=async()=>{
    const value=email.trim().toLowerCase();
    if(!value){setStatus({loading:false,message:"\u00d6nce e-posta adresinizi yaz\u0131n.",error:true});return;}
    setStatus({loading:true,message:"",error:false});
    const {error}=await supabase.auth.resetPasswordForEmail(value,{redirectTo:`${window.location.origin}/`});
    setStatus(error
      ?{loading:false,message:error.message,error:true}
      :{loading:false,message:"\u015eifre belirleme/s\u0131f\u0131rlama ba\u011flant\u0131s\u0131 e-posta adresinize g\u00f6nderildi.",error:false});
  };
  const sendMagicLink=async()=>{
    const value=email.trim().toLowerCase();
    if(!value){setStatus({loading:false,message:"\u00d6nce e-posta adresinizi yaz\u0131n.",error:true});return;}
    setStatus({loading:true,message:"",error:false});
    const {error}=await supabase.auth.signInWithOtp({
      email:value,
      options:{
        emailRedirectTo:`${window.location.origin}/`,
        shouldCreateUser:false,
      },
    });
    setStatus(error
      ?{loading:false,message:error.message,error:true}
      :{loading:false,message:"Tek kullan\u0131ml\u0131k giri\u015f ba\u011flant\u0131s\u0131 e-posta adresinize g\u00f6nderildi.",error:false});
  };
  return <div className="login-screen" style={{position:"fixed",inset:0,background:"linear-gradient(145deg,#0F172A,#1E293B 55%,#0F172A)",display:"grid",placeItems:"center",padding:20,fontFamily:"Inter,Segoe UI,sans-serif"}}>
    <div style={{width:"100%",maxWidth:430,textAlign:"center"}}>
      <img src={corjectLogo} alt="Corject" style={{width:74,height:74,objectFit:"contain",filter:"drop-shadow(0 10px 22px rgba(74,108,247,.35))"}}/>
      <h1 style={{color:"#fff",fontSize:22,letterSpacing:3,margin:"8px 0 4px"}}>CORJECT</h1>
      <p style={{color:"#94A3B8",fontSize:12,margin:"0 0 22px"}}>{"E-posta ve \u015fifre ile g\u00fcvenli giri\u015f"}</p>
      <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,padding:24,textAlign:"left",boxShadow:"0 22px 60px rgba(0,0,0,.25)"}}>
        <label style={{display:"block",fontSize:12,fontWeight:800,color:"#CBD5E1",marginBottom:6}}>E-posta</label>
        <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ad@firma.com" style={{...iStyle,padding:12,background:"#fff",marginBottom:10}}/>
        <label style={{display:"block",fontSize:12,fontWeight:800,color:"#CBD5E1",marginBottom:6}}>{"\u015eifre"}</label>
        <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&passwordLogin()} placeholder={"\u015eifreniz"} style={{...iStyle,padding:12,background:"#fff",marginBottom:12}}/>
        <label style={{display:"flex",alignItems:"center",gap:8,color:"#CBD5E1",fontSize:11,fontWeight:750,margin:"-2px 0 13px",cursor:"pointer"}}>
          <input type="checkbox" checked={rememberMe} onChange={e=>{setRememberMe(e.target.checked);if(!e.target.checked){try{localStorage.removeItem("corject_remember_email");}catch{}}}} style={{accentColor:"#4A6CF7"}}/>
          {"Beni hat\u0131rla"}
        </label>
        <button disabled={status.loading} onClick={passwordLogin} style={{width:"100%",border:0,borderRadius:12,padding:"13px 16px",background:"linear-gradient(135deg,#4A6CF7,#7C3AED)",color:"#fff",fontWeight:900,cursor:"pointer",boxShadow:"0 12px 26px rgba(74,108,247,.32)"}}>{status.loading?"Giri\u015f yap\u0131l\u0131yor...":"Giri\u015f Yap"}</button>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginTop:12,flexWrap:"wrap"}}>
          <button disabled={status.loading} onClick={sendResetLink} style={{border:0,background:"transparent",color:"#A5B4FC",fontSize:11,fontWeight:800,cursor:"pointer",padding:0}}>{"\u015eifremi belirle / unuttum"}</button>
          <button onClick={()=>setShowAlternatives(value=>!value)} style={{border:0,background:"transparent",color:"#94A3B8",fontSize:11,fontWeight:800,cursor:"pointer",padding:0}}>{showAlternatives?"Alternatifleri gizle":"Di\u011fer giri\u015fler"}</button>
        </div>
        {showAlternatives&&<div style={{marginTop:15,borderTop:"1px solid rgba(255,255,255,.12)",paddingTop:15,display:"grid",gap:9}}>
          <button disabled={status.loading} onClick={slackLogin} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:11,padding:"11px 14px",background:"#fff",color:"#1E293B",fontWeight:850,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><SlackLogo size={21}/>{"Slack ile giri\u015f"}</button>
          <button disabled={status.loading} onClick={sendMagicLink} style={{width:"100%",border:"1px solid rgba(255,255,255,.18)",borderRadius:11,padding:"11px 14px",background:"rgba(255,255,255,.06)",color:"#CBD5E1",fontWeight:850,cursor:"pointer"}}>{"Tek kullan\u0131ml\u0131k e-posta linki g\u00f6nder"}</button>
        </div>}
        {status.message&&<div style={{fontSize:11,lineHeight:1.5,marginTop:13,color:status.error?"#FCA5A5":"#A7F3D0",background:status.error?"rgba(127,29,29,.18)":"rgba(6,95,70,.18)",borderRadius:10,padding:"9px 10px"}}>{status.message}</div>}
      </div>
      <div style={{fontSize:10,color:"#475569",marginTop:14}}>CORJECT {appVersion}</div>
    </div>
  </div>;
}

export function PasswordRecoveryScreen({ onDone }) {
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [status,setStatus]=useState({loading:false,message:"",error:false});
  const save=async()=>{
    if(password.length<8){setStatus({loading:false,message:"\u015eifre en az 8 karakter olmal\u0131.",error:true});return;}
    if(password!==confirm){setStatus({loading:false,message:"\u015eifreler e\u015fle\u015fmiyor.",error:true});return;}
    setStatus({loading:true,message:"",error:false});
    const {error}=await supabase.auth.updateUser({password});
    setStatus(error
      ?{loading:false,message:error.message,error:true}
      :{loading:false,message:"\u015eifreniz g\u00fcncellendi.",error:false});
    if(!error)setTimeout(onDone,600);
  };
  return <div className="login-screen" style={{position:"fixed",inset:0,background:"linear-gradient(145deg,#0F172A,#1E293B 55%,#0F172A)",display:"grid",placeItems:"center",padding:20,fontFamily:"Inter,Segoe UI,sans-serif"}}>
    <div style={{width:"100%",maxWidth:430,textAlign:"center"}}>
      <img src={corjectLogo} alt="Corject" style={{width:68,height:68,objectFit:"contain",filter:"drop-shadow(0 10px 22px rgba(74,108,247,.35))"}}/>
      <h1 style={{color:"#fff",fontSize:21,letterSpacing:2,margin:"10px 0 4px"}}>{"Yeni \u015fifre belirle"}</h1>
      <p style={{color:"#94A3B8",fontSize:12,margin:"0 0 20px"}}>{"Corject hesab\u0131n\u0131z i\u00e7in kal\u0131c\u0131 \u015fifre olu\u015fturun."}</p>
      <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,padding:24,textAlign:"left"}}>
        <label style={{display:"block",fontSize:12,fontWeight:800,color:"#CBD5E1",marginBottom:6}}>{"Yeni \u015fifre"}</label>
        <input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={"En az 8 karakter"} style={{...iStyle,padding:12,background:"#fff",marginBottom:10}}/>
        <label style={{display:"block",fontSize:12,fontWeight:800,color:"#CBD5E1",marginBottom:6}}>{"Yeni \u015fifre tekrar"}</label>
        <input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} placeholder={"\u015eifreyi tekrar yaz\u0131n"} style={{...iStyle,padding:12,background:"#fff",marginBottom:12}}/>
        <button disabled={status.loading} onClick={save} style={{width:"100%",border:0,borderRadius:12,padding:"13px 16px",background:"linear-gradient(135deg,#4A6CF7,#7C3AED)",color:"#fff",fontWeight:900,cursor:"pointer"}}>{status.loading?"Kaydediliyor...":"\u015eifreyi Kaydet"}</button>
        {status.message&&<div style={{fontSize:11,lineHeight:1.5,marginTop:13,color:status.error?"#FCA5A5":"#A7F3D0",background:status.error?"rgba(127,29,29,.18)":"rgba(6,95,70,.18)",borderRadius:10,padding:"9px 10px"}}>{status.message}</div>}
      </div>
    </div>
  </div>;
}
