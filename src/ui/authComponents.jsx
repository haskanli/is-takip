import { useState } from "react";
import { supabase } from "../supabase";
import corjectLogo from "../assets/corject-logo.png";
import { iStyle } from "./primitives.jsx";

export function LoginScreen({ people, onLogin, appVersion }) {
  const [sel, setSel] = useState(null);
  return (
    <div className="auth-screen">
      <div className="auth-local-shell">
        <div className="auth-card">
          <div className="auth-brand-row" style={{ justifyContent: "center" }}>
            <div className="auth-logo-frame"><img src={corjectLogo} alt="Corject" /></div>
            <div>
              <p className="auth-kicker">Corject</p>
              <h1 className="auth-title" style={{ fontSize: "clamp(24px, 6vw, 34px)" }}>Dev ortamı girişi</h1>
            </div>
          </div>
          <p className="auth-subtitle" style={{ textAlign: "center", margin: "-10px auto 18px" }}>Test etmek istediğiniz kullanıcı profilini seçin.</p>
          <div className="auth-local-grid">
            {people.map(person => (
              <button key={person.id} onClick={() => setSel(person.id)} className={`auth-user-card ${sel === person.id ? "is-selected" : ""}`}>
                <div className="auth-user-avatar" style={person.isAdmin ? { color: "var(--danger)", background: "rgb(185 63 51 / 10%)", borderColor: "rgb(185 63 51 / 18%)" } : undefined}>{person.avatar}</div>
                <div style={{ minWidth: 0, width: "100%" }}>
                  <b className="text-wrap-safe" style={{ display: "block", fontSize: 13 }}>{person.name}</b>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.role}</span>
                </div>
                {person.isAdmin && <span className="ui-chip ui-chip-danger">Yönetici</span>}
                {sel === person.id && <span className="ui-chip ui-chip-accent">Seçildi</span>}
              </button>
            ))}
          </div>
          <button disabled={!sel} onClick={() => sel && onLogin(sel)} className="auth-primary" style={{ marginTop: 16 }}>
            {sel ? "Giriş Yap" : "Hesap Seçin"}
          </button>
        </div>
        <div className="auth-version" style={{ textAlign: "center" }}>CORJECT {appVersion} · Proje Yönetimi</div>
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
  return <div className="auth-screen">
    <div className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand-row">
          <div className="auth-logo-frame"><img src={corjectLogo} alt="Corject" /></div>
          <div>
            <p className="auth-kicker">Project intelligence</p>
            <h1 className="auth-title">Corject’e hoş geldiniz</h1>
          </div>
        </div>
        <p className="auth-subtitle">Projeler, saha planları, ticketlar ve yönetici görünümü tek güvenli çalışma alanında.</p>
        <div className="auth-form">
          <div>
            <label className="auth-label">E-posta</label>
            <input className="auth-input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ad@firma.com" style={{...iStyle,padding:12}}/>
          </div>
          <div>
            <label className="auth-label">Şifre</label>
            <input className="auth-input" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&passwordLogin()} placeholder="Şifreniz" style={{...iStyle,padding:12}}/>
          </div>
          <div className="auth-row">
            <label className="auth-remember">
              <input type="checkbox" checked={rememberMe} onChange={e=>{setRememberMe(e.target.checked);if(!e.target.checked){try{localStorage.removeItem("corject_remember_email");}catch{}}}}/>
              Beni hatırla
            </label>
            <button disabled={status.loading} onClick={sendResetLink} className="auth-link">Şifremi belirle / unuttum</button>
          </div>
          <button disabled={status.loading} onClick={passwordLogin} className="auth-primary">{status.loading?"Giriş yapılıyor...":"Giriş Yap"}</button>
          <button type="button" onClick={()=>setShowAlternatives(value=>!value)} className="auth-link auth-link-muted" style={{ justifySelf: "center" }}>{showAlternatives?"Alternatifleri gizle":"Diğer giriş seçenekleri"}</button>
          {showAlternatives&&<div className="auth-alternatives">
            <button disabled={status.loading} onClick={slackLogin} className="auth-secondary"><SlackLogo size={21}/>Slack ile giriş</button>
            <button disabled={status.loading} onClick={sendMagicLink} className="auth-secondary">Tek kullanımlık e-posta linki gönder</button>
          </div>}
          {status.message&&<div className={`auth-status ${status.error?"is-error":"is-success"}`}>{status.message}</div>}
        </div>
        <div className="auth-version">CORJECT {appVersion}</div>
      </section>
      <aside className="auth-hero-panel">
        <div className="auth-hero-content">
          <p className="auth-kicker">Operasyon merkezi</p>
          <h2 className="auth-title" style={{ fontSize: "clamp(25px, 3vw, 36px)" }}>Sahadan yönetime aynı ritim.</h2>
          <p className="auth-subtitle">Günlük akış, görevler, proje sağlığı ve müşteri görünümü sade bir karar ekranında birleşir.</p>
          <div className="auth-feature-grid">
            <div className="auth-feature"><b>Hızlı takip</b><span>To-do, saha planı, ticket ve aksiyonlar tek yerden yönetilir.</span></div>
            <div className="auth-feature"><b>Rol bazlı erişim</b><span>Ekip, yönetici ve müşteri görünümleri güvenli şekilde ayrılır.</span></div>
            <div className="auth-feature"><b>Canlı görünüm</b><span>Proje sağlığı, gecikmeler ve riskler anlık olarak özetlenir.</span></div>
          </div>
        </div>
      </aside>
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
  return <div className="auth-screen">
    <div className="auth-local-shell" style={{ maxWidth: 460 }}>
      <section className="auth-card">
        <div className="auth-brand-row">
          <div className="auth-logo-frame"><img src={corjectLogo} alt="Corject" /></div>
          <div>
            <p className="auth-kicker">Güvenli erişim</p>
            <h1 className="auth-title" style={{ fontSize: "clamp(24px, 6vw, 34px)" }}>Yeni şifre belirle</h1>
          </div>
        </div>
        <p className="auth-subtitle" style={{ marginTop: -8 }}>Corject hesabınız için kalıcı şifre oluşturun.</p>
        <div className="auth-form">
          <div>
            <label className="auth-label">Yeni şifre</label>
            <input className="auth-input" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="En az 8 karakter" style={{...iStyle,padding:12}}/>
          </div>
          <div>
            <label className="auth-label">Yeni şifre tekrar</label>
            <input className="auth-input" type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} placeholder="Şifreyi tekrar yazın" style={{...iStyle,padding:12}}/>
          </div>
          <button disabled={status.loading} onClick={save} className="auth-primary">{status.loading?"Kaydediliyor...":"Şifreyi Kaydet"}</button>
          {status.message&&<div className={`auth-status ${status.error?"is-error":"is-success"}`}>{status.message}</div>}
        </div>
      </section>
    </div>
  </div>;
}
