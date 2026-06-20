export const GlobalStyle = () => (
  <style>{`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; margin: 0; padding: 0; }
    body {
      font-family: var(--font-ui, Manrope, Segoe UI, sans-serif);
      color: var(--text, #112327);
      background:
        var(--scene-overlay, linear-gradient(150deg, rgba(255,255,255,.62), rgba(245,245,244,.2))),
        var(--scene-image, linear-gradient(156deg, #fbfbfa 0%, #f3f4f4 46%, #eeeeec 100%));
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      background-attachment: fixed;
    }
    h1, h2, h3 { color: var(--text, #112327); }
    input, select, textarea, button { font-family: inherit; }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent, #0b8a94) !important;
      box-shadow: 0 0 0 4px var(--ring, rgb(11 138 148 / 24%)) !important;
    }
    .sidebar-nav { scrollbar-width: none; }
    .sidebar-nav::-webkit-scrollbar { display: none; }
    .login-users { scrollbar-width: thin; scrollbar-color: var(--muted, #5b6f74) transparent; }
    @keyframes corjectLoadingFloat {
      0%, 100% { transform: translateY(0) rotate(0deg) scale(1); filter: drop-shadow(0 12px 30px rgba(11 138 148,.24)); }
      50% { transform: translateY(-7px) rotate(5deg) scale(1.05); filter: drop-shadow(0 18px 38px rgba(191 122 18,.24)); }
    }
    .corject-loading-logo { animation: corjectLoadingFloat 1.8s ease-in-out infinite; }
    @keyframes corjectRingSweep {
      0% { transform: rotate(-30deg); filter: drop-shadow(0 0 12px rgba(34,211,238,.26)); }
      50% { transform: rotate(18deg); filter: drop-shadow(0 0 24px rgba(139,92,246,.46)); }
      100% { transform: rotate(330deg); filter: drop-shadow(0 0 16px rgba(34,211,238,.32)); }
    }
    @keyframes corjectNodeTravel {
      0%, 100% { transform: translateX(-34px) scale(.9); opacity:.78; }
      45% { transform: translateX(5px) scale(1.08); opacity:1; }
      75% { transform: translateX(38px) scale(.96); opacity:.9; }
    }
    @keyframes corjectBeam {
      0%, 100% { opacity:.25; transform: scaleX(.55); }
      50% { opacity:1; transform: scaleX(1.05); }
    }
    @keyframes corjectCheckPulse {
      0%, 65%, 100% { transform: scale(.92); opacity:.72; }
      78% { transform: scale(1.14); opacity:1; }
    }
    @keyframes corjectGlowPulse {
      0%, 100% { opacity:.36; transform: scale(.82); }
      50% { opacity:.95; transform: scale(1.08); }
    }
    @keyframes corjectDots {
      0%, 80%, 100% { opacity:.25; transform: translateY(0); }
      40% { opacity:1; transform: translateY(-3px); }
    }
    .admin-summary-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
    .admin-summary-card {
      min-width:0;
      min-height:126px;
      border:1px solid var(--glass-border, #cfe0e3);
      border-top:3px solid color-mix(in srgb, transparent 80%, var(--accent, #0b8a94));
      border-radius:18px;
      background:linear-gradient(150deg, color-mix(in srgb, var(--glass) 74%, transparent), color-mix(in srgb, #fff 62%, transparent));
      padding:15px;
      text-align:left;
      cursor:pointer;
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      box-shadow:var(--shadow-soft, 0 18px 40px -26px rgb(17 35 39 / 34%));
      overflow:hidden;
      transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }
    .admin-summary-card:hover { border-color: color-mix(in srgb, var(--accent) 25%, var(--border)); transform:translateY(-2px); box-shadow:0 22px 48px -34px rgb(17 35 39 / 48%); }
    .admin-summary-card:focus-visible { outline:3px solid color-mix(in srgb, var(--accent) 25%, transparent); outline-offset:2px; }
    .admin-summary-card b,
    .admin-summary-card div { min-width:0; }
    .admin-summary-card .admin-summary-detail { line-height:1.35; }
    .admin-summary-card .admin-summary-value { letter-spacing:-0.02em; }
    .admin-kpi-card {
      background:linear-gradient(145deg, color-mix(in srgb, var(--surface) 84%, transparent), color-mix(in srgb, var(--surface-soft) 82%, transparent));
      border:1px solid var(--glass-border);
      backdrop-filter: var(--glass-blur);
      -webkit-backdrop-filter: var(--glass-blur);
      box-shadow: var(--shadow-card);
      transition: transform .16s ease, box-shadow .16s ease;
    }
    .admin-kpi-card:hover { transform:translateY(-1px); box-shadow:0 18px 46px -34px rgb(17 35 39 / 42%); }
    .admin-ai-summary { background:linear-gradient(135deg, var(--surface, #fff), var(--surface-soft, #f6fafb)); border:1px solid var(--border, #cfe0e3); border-radius:20px; padding:16px; box-shadow:var(--shadow-soft, 0 18px 40px -26px rgb(17 35 39 / 34%)); overflow:hidden; }
    .admin-board-grid { display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); grid-auto-flow:dense; gap:12px; align-items:start; }
    .admin-board-card { min-width:0; overflow:hidden; }
    .admin-board-card * { min-width:0; }
    .admin-board-card button { max-width:100%; }
    .admin-report-button span { display:inline; }
    .admin-board-small { grid-column:span 3; min-height:128px; }
    .admin-board-medium { grid-column:span 4; min-height:190px; }
    .admin-board-large { grid-column:span 6; }
    .admin-board-full { grid-column:span 12; }
    .admin-board-tools { opacity:.38; transition:opacity .16s ease; }
    .admin-board-card:hover .admin-board-tools,
    .admin-board-tools:focus-within { opacity:1; }
    @media (max-width: 760px) {
      .readiness-row { grid-template-columns: 1fr !important; }
      .readiness-row > * { grid-column: 1 !important; }
      .readiness-summary { grid-template-columns: 1fr !important; }
    }
    @media (max-height: 760px) and (min-width: 761px) {
      .login-screen { padding: 8px 0 !important; }
      .login-shell { max-width: 720px !important; }
      .login-brand { margin-bottom: 8px !important; }
      .login-logo { width: 44px !important; height: 44px !important; margin-bottom: 2px !important; }
      .login-card { padding-top: 12px !important; padding-bottom: 12px !important; }
      .login-users { max-height: 43vh !important; grid-template-columns: repeat(auto-fit,minmax(125px,1fr)) !important; }
      .login-version { margin-top: 6px !important; }
    }
    @media (max-width: 760px) {
      .todo-columns { grid-template-columns: 1fr !important; }
      .reminders-layout { grid-template-columns: 1fr !important; }
      .admin-main-grid, .admin-triple-grid { grid-template-columns: 1fr !important; }
      .visit-time-grid { grid-template-columns: 1fr !important; }
      .org-level-row { grid-template-columns:1fr !important; }
      .project-effort-row { grid-template-columns:1fr auto !important; }
      .project-effort-row > :nth-child(1) { grid-column:1; grid-row:2; justify-self:start; }
      .project-effort-row > :nth-child(2) { grid-column:1 / -1; grid-row:1; }
      .project-effort-row > :nth-child(3) { grid-column:1; grid-row:3; }
      .project-effort-row > :nth-child(4) { grid-column:1; grid-row:4; }
      .project-effort-row > :nth-child(5) { grid-column:2; grid-row:2 / 5; align-self:center; }
      .admin-summary-grid { grid-template-columns: 1fr; }
      .admin-summary-card { min-height:102px; padding:12px 13px; }
      .admin-summary-card .admin-summary-label { font-size:9px !important; }
      .admin-summary-card .admin-summary-value { font-size:24px !important; line-height:1.04; }
      .admin-summary-card .admin-summary-detail { font-size:9px !important; line-height:1.28 !important; margin-top:7px !important; }
      .management-heading { margin-top: 2px !important; }
      .management-tabs { width: 100% !important; max-width: 380px !important; }
      .management-tabs button { flex: 1; padding: 9px 7px !important; font-size: 10px !important; }
      .admin-control-row { margin-bottom: 14px !important; }
      .admin-control-row > div:last-child { width: 100%; display:grid !important; grid-template-columns: 1fr 44px; align-items:end !important; gap:8px !important; }
      .admin-control-row > div:last-child > div { min-width:0 !important; }
      .admin-report-button { width:42px !important; height:42px !important; padding:0 !important; justify-content:center !important; border-radius:13px !important; }
      .admin-report-button span { display:none; }
      .admin-card-size-select { display:none !important; }
      .admin-board-tools { right:9px !important; top:9px !important; }
      .admin-kpi-card { padding-bottom: 28px !important; }
      .admin-kpi-head { padding-right: 0 !important; }
      .admin-kpi-info { position:absolute !important; right:9px !important; bottom:8px !important; width:16px !important; height:16px !important; font-size:9px !important; opacity:.72; }
      .admin-board-small, .admin-board-medium, .admin-board-large, .admin-board-full { grid-column:span 12; }
      .admin-board-card button { padding-top:2px; padding-bottom:2px; }
      .admin-summary-grid { margin-bottom: 14px !important; }
      .admin-summary-card { border-radius:16px; }
      .admin-board-tools { opacity:1; }
      .manager-assigned-row { display:grid !important; grid-template-columns:auto minmax(0,1fr) !important; align-items:start !important; padding:12px !important; border-radius:16px !important; box-shadow:0 8px 22px rgba(15,23,42,.055); }
      .manager-assigned-row > button { grid-column:2 !important; }
      .manager-assigned-row > .manager-assigned-status { grid-column:1 / -1 !important; width:100% !important; margin-top:4px !important; border-radius:10px !important; padding:8px 10px !important; }
      .manager-assigned-row > span,
      .manager-assigned-row > div[style*="display: inline-flex"] { grid-column:1 / -1 !important; justify-self:start !important; }
    }
    @media (min-width: 761px) and (max-width: 1100px) {
      .admin-main-grid { grid-template-columns: 1fr !important; }
      .admin-triple-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
      .admin-summary-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
      .admin-board-small { grid-column:span 4; }
      .admin-board-medium { grid-column:span 6; }
      .admin-board-large, .admin-board-full { grid-column:span 12; }
    }
  `}</style>
);

function LegacyAppLoadingScreen({progress=10,status="Oturum hazirlanıyor",logoSrc=""}) {
  const safeProgress=Math.max(4,Math.min(100,Math.round(progress)));
  const localAnimationCss = `
    @keyframes corjectRingSweep { 0% { transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 12px rgba(37,99,235,.28)); } 55% { transform: rotate(174deg) scale(1.02); filter: drop-shadow(0 0 20px rgba(34,211,238,.38)); } 100% { transform: rotate(360deg) scale(1); filter: drop-shadow(0 0 14px rgba(124,58,237,.32)); } }
    @keyframes corjectPathFill { 0% { transform: scaleX(0); opacity:.45; } 18% { transform: scaleX(.28); opacity:.85; } 48% { transform: scaleX(.68); opacity:1; } 72%, 100% { transform: scaleX(1); opacity:1; } }
    @keyframes corjectSpark { 0% { left:39px; opacity:0; transform:scale(.7); } 10% { opacity:1; } 48% { left:78px; transform:scale(1); } 74% { left:115px; opacity:1; transform:scale(.92); } 100% { left:115px; opacity:0; transform:scale(.65); } }
    @keyframes corjectNodeReady { 0%, 18% { background:var(--text); border-color:var(--text); box-shadow:none; } 34%, 100% { background:var(--accent-ink); border-color:var(--accent); box-shadow:0 0 20px rgba(74,108,247,.62); } }
    @keyframes corjectNodeReadyTwo { 0%, 40% { background:var(--text); border-color:var(--text); box-shadow:none; } 55%, 100% { background:var(--accent-ink); border-color:var(--accent); box-shadow:0 0 20px rgba(139,92,246,.62); } }
    @keyframes corjectNodeReadyThree { 0%, 62% { background:var(--text); border-color:var(--text); box-shadow:none; } 78%, 100% { background:var(--accent-ink); border-color:var(--accent); box-shadow:0 0 22px rgba(34,211,238,.72); } }
    @keyframes corjectCheckPulse { 0%, 68% { transform: scale(.75); opacity:0; } 78% { transform: scale(1.1); opacity:1; } 88%, 100% { transform: scale(1); opacity:1; } }
    @keyframes corjectGlowPulse { 0%, 100% { opacity:.25; transform: scale(.9); } 50% { opacity:.6; transform: scale(1.03); } }
    @keyframes corjectDots { 0%, 80%, 100% { opacity:.25; transform: translateY(0); } 40% { opacity:1; transform: translateY(-3px); } }
  `;
  return <><style>{localAnimationCss}</style><div style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",boxSizing:"border-box",padding:20,fontFamily:"Inter,Segoe UI,sans-serif",background:"var(--scene-overlay, linear-gradient(150deg, rgba(255,255,255,.62), rgba(245,245,244,.2))),var(--scene-image, linear-gradient(156deg,#fbfbfa 0%, #f3f4f4 46%, #eeeeec 100%))",color:"var(--text)",zIndex:9999,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:"auto 12% 9%",height:90,background:"radial-gradient(ellipse,rgba(17,35,39,.12),transparent 65%)",filter:"blur(18px)"}} />
    <div style={{width:"min(390px,100%)",textAlign:"center",border:"1px solid rgba(15,23,42,.12)",borderRadius:32,padding:"34px 28px 30px",background:"linear-gradient(180deg,rgba(255,255,255,.85),rgba(246,250,251,.75))",boxShadow:"0 30px 90px rgba(15,23,42,.2)",backdropFilter:"blur(16px)",position:"relative"}}>
      <div style={{width:150,height:150,margin:"0 auto 18px",position:"relative",display:"grid",placeItems:"center"}}>
        <div style={{position:"absolute",inset:8,borderRadius:"50%",background:"conic-gradient(from 18deg,var(--accent) 0 116deg,transparent 116deg 174deg,var(--accent) 174deg 306deg,transparent 306deg 360deg)",animation:"corjectRingSweep 3.6s cubic-bezier(.45,0,.2,1) infinite"}} />
        <div style={{position:"absolute",inset:32,borderRadius:"50%",background:"var(--text)",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.06)"}} />
        <div style={{position:"absolute",left:42,right:34,top:78,height:8,borderRadius:999,background:"rgba(148,163,184,.18)",overflow:"hidden"}}><span style={{display:"block",height:"100%",width:"100%",borderRadius:999,background:"linear-gradient(90deg,var(--accent),var(--accent),var(--accent))",transformOrigin:"left center",animation:"corjectPathFill 2.4s ease-in-out infinite",boxShadow:"0 0 16px rgba(34,211,238,.55)"}} /></div>
        <span style={{position:"absolute",left:37,top:66,width:30,height:30,borderRadius:"50%",background:"var(--text)",border:"7px solid var(--text)",animation:"corjectNodeReady 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",left:75,top:72,width:18,height:18,borderRadius:"50%",background:"var(--text)",border:"5px solid var(--text)",animation:"corjectNodeReadyTwo 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",left:112,top:70,width:22,height:22,borderRadius:"50%",background:"var(--text)",border:"5px solid var(--text)",animation:"corjectNodeReadyThree 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",top:74,width:18,height:18,borderRadius:"50%",background:"var(--accent-ink)",boxShadow:"0 0 24px rgba(34,211,238,.9)",animation:"corjectSpark 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",right:26,top:52,width:38,height:38,borderRadius:"50%",background:"var(--accent)",display:"grid",placeItems:"center",boxShadow:"0 0 28px rgba(34,211,238,.75)",animation:"corjectCheckPulse 2.1s ease-in-out infinite"}}>
          <i style={{width:15,height:8,borderLeft:"4px solid #fff",borderBottom:"4px solid #fff",transform:"rotate(-45deg)",display:"block",marginTop:-2}} />
        </span>
        <span style={{position:"absolute",inset:48,borderRadius:"50%",background:"radial-gradient(circle,rgba(34,211,238,.3),transparent 62%)",animation:"corjectGlowPulse 1.8s ease-in-out infinite"}} />
        {logoSrc&&<img className="corject-loading-logo" src={logoSrc} alt="Corject" style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none"}}/>}
      </div>
      <div style={{fontSize:32,fontWeight:950,letterSpacing:"-.04em",color:"var(--text)",lineHeight:1}}>Corject</div>
      <div style={{fontSize:13,color:"var(--muted)",marginTop:10,minHeight:18}}>{status}</div>
      <div style={{display:"flex",justifyContent:"center",gap:7,margin:"13px 0 22px"}}>
        {[0,1,2].map(index=><span key={index} style={{width:7,height:7,borderRadius:"50%",background:index===1?"var(--accent)":"var(--accent)",animation:`corjectDots 1.2s ease-in-out ${index*.16}s infinite`}} />)}
      </div>
      <div style={{height:8,borderRadius:20,background:"rgba(15,23,42,.12)",overflow:"hidden",border:"1px solid rgba(15,23,42,.12)"}}><div style={{height:"100%",width:`${safeProgress}%`,borderRadius:20,background:"linear-gradient(90deg,var(--accent),var(--accent),var(--warning))",transition:"width .35s ease",boxShadow:"0 0 24px rgba(11,138,148,.24)"}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--muted)",marginTop:9}}><span>Güvenli çalışma alanı yükleniyor</span><b style={{color:"var(--accent)"}}>%{safeProgress}</b></div>
    </div>
  </div></>;
}

export function AppLoadingScreen({progress=10,status="Oturum haz\u0131rlan\u0131yor",logoSrc=""}) {
  const safeProgress=Math.max(4,Math.min(100,Math.round(progress)));
  return (
    <div className="app-loading-shell" role="status" aria-live="polite" aria-label="Corject yukleniyor">
      <div className="app-loading-panel">
        <div className="app-loading-mark" aria-hidden="true">
          {logoSrc
            ? <img className="app-loading-logo" src={logoSrc} alt="" />
            : <span className="app-loading-letter">C</span>}
        </div>
        <div className="app-loading-title">Corject</div>
        <div className="app-loading-status">{status}</div>
        <div className="app-loading-progress" aria-hidden="true">
          <span style={{ width: `${safeProgress}%` }} />
        </div>
        <div className="app-loading-meta">
          <span>Calisma alani hazirlaniyor</span>
          <b>%{safeProgress}</b>
        </div>
      </div>
    </div>
  );
  const animationCss=`
    @keyframes corjectFloatField {
      0%,100% { transform: translateY(0) rotate(0deg) scale(1); }
      50% { transform: translateY(-8px) rotate(.8deg) scale(1.015); }
    }
    @keyframes corjectFieldPulse {
      0%,100% { opacity: .2; transform: scale(.98); }
      50% { opacity: .38; transform: scale(1.02); }
    }
    @keyframes corjectOrbitSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
    @keyframes corjectOrbitSpinReverse { from { transform: translate(-50%, -50%) rotate(360deg); } to { transform: translate(-50%, -50%) rotate(0deg); } }
    @keyframes corjectNodeFloat {
      0%,100% { transform: translateY(0); opacity:.35; }
      50% { transform: translateY(-7px); opacity:1; }
    }
    @keyframes corjectCorePulse { 0%,100% { transform: scale(.96); box-shadow: 0 18px 40px -24px rgb(11 138 148 / 20%); } 50% { transform: scale(1.02); box-shadow: 0 26px 56px -28px rgb(11 138 148 / 36%); } }
    @keyframes corjectGlowSweep { 0% { transform: translateX(-130%); opacity:0; } 45% { opacity:.45; } 100% { transform: translateX(130%); opacity:0; } }
    @keyframes corjectBarFlow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    @keyframes corjectStatusGlow { 0%,100% { opacity:.75; } 50% { opacity:1; } }
  `;
  return <><style>{animationCss}</style><div style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",boxSizing:"border-box",padding:22,fontFamily:"var(--font-ui, Manrope, Segoe UI, sans-serif)",background:"var(--scene-overlay, linear-gradient(150deg, rgba(255,255,255,.62), rgba(245,245,244,.2))),var(--scene-image, linear-gradient(156deg,#fbfbfa 0%, #f3f4f4 46%, #eeeeec 100%))",backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",backgroundAttachment:"fixed",color:"var(--text)",zIndex:9999,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 18%, rgb(255 255 255 / 34%), transparent 38%),radial-gradient(circle at 50% 100%, rgb(17 35 39 / 8%), transparent 38%)",animation:"corjectFieldPulse 4.4s ease-in-out infinite",pointerEvents:"none"}} />
    <span style={{position:"absolute",left:"-20vw",top:"-12vh",width:"40vw",height:"40vh",borderRadius:"50%",background:"radial-gradient(circle, rgb(255 255 255 / 42%), transparent 70%)",filter:"blur(18px)",animation:"corjectFieldPulse 5.2s ease-in-out infinite"}} />
    <span style={{position:"absolute",right:"-22vw",bottom:"-10vh",width:"38vw",height:"38vh",borderRadius:"50%",background:"radial-gradient(circle, rgb(229 231 235 / 38%), transparent 70%)",filter:"blur(20px)",animation:"corjectFieldPulse 5.8s ease-in-out 900ms infinite"}} />
    <div style={{position:"absolute",left:"50%",top:"50%",width:"420px",height:"420px",maxWidth:"82vw",maxHeight:"82vw",borderRadius:"50%",transform:"translate(-50%, -50%)",border:"1px solid color-mix(in srgb, var(--glass-border) 76%, transparent)",animation:"corjectOrbitSpinReverse 24s linear infinite",pointerEvents:"none"}} />
    <div style={{position:"absolute",left:"50%",top:"50%",width:"540px",height:"540px",maxWidth:"95vw",maxHeight:"95vw",borderRadius:"50%",overflow:"hidden",transform:"translate(-50%, -50%)",pointerEvents:"none",opacity:.42}}>
      <span style={{position:"absolute",inset:0,borderRadius:"50%",border:"1px dashed color-mix(in srgb, var(--accent) 55%, transparent)",animation:"corjectOrbitSpin 20s linear infinite"}} />
      <span style={{position:"absolute",inset:"16% 20% auto",width:"12px",height:"12px",borderRadius:"50%",background:"var(--success)",boxShadow:"0 0 20px color-mix(in srgb, var(--success) 60%, transparent)",animation:"corjectOrbitSpin 8s linear infinite"}} />
      <span style={{position:"absolute",left:"18%",top:"55%",width:"8px",height:"8px",borderRadius:"50%",background:"var(--warning)",animation:"corjectOrbitSpin 10s linear infinite reverse"}} />
      <span style={{position:"absolute",right:"16%",top:"33%",width:"10px",height:"10px",borderRadius:"50%",background:"var(--accent)",animation:"corjectOrbitSpin 12s linear infinite"}} />
    </div>
    <div style={{width:"min(360px,100%)",textAlign:"center",padding:"8px 2px",position:"relative",zIndex:1}}>
      <div style={{position:"relative",borderRadius:28,padding:"30px 28px 24px",background:"linear-gradient(145deg, rgb(255 255 255 / 84%), rgb(244 250 251 / 78%))",backdropFilter:"blur(24px) saturate(1.08)",WebkitBackdropFilter:"blur(24px) saturate(1.08)",boxShadow:"0 28px 82px -46px rgb(17 35 39 / 48%)",overflow:"hidden",animation:"corjectFloatField 340ms cubic-bezier(.2,.9,.2,1) both",border:"1px solid color-mix(in srgb, var(--glass-border) 84%, transparent)"}}>
        <span style={{position:"absolute",left:"-36%",top:"-20%",width:"72%",height:"72%",borderRadius:"50%",background:"radial-gradient(circle, color-mix(in srgb, var(--accent) 30%, transparent), transparent 65%)",filter:"blur(3px)"}} />
        <span style={{position:"absolute",right:"-34%",bottom:"-20%",width:"58%",height:"58%",borderRadius:"50%",background:"radial-gradient(circle, color-mix(in srgb, var(--warning) 30%, transparent), transparent 65%)",filter:"blur(3px)"}} />
        <div style={{position:"absolute",inset:"0 14% auto",top:"13px",height:"3px",borderRadius:999,overflow:"hidden",background:"rgba(15,23,42,.08)"}}>
          <span style={{display:"block",height:"100%",width:"42%",background:"linear-gradient(90deg,transparent,color-mix(in srgb, var(--accent) 52%, #fff),transparent)",filter:"blur(.6px)",animation:"corjectGlowSweep 3.5s ease-in-out infinite"}} />
        </div>
        <div style={{width:86,height:86,borderRadius:24,margin:"2px auto 18px",display:"grid",placeItems:"center",position:"relative",zIndex:1,background:"rgb(255 255 255 / 78%)",border:"1px solid color-mix(in srgb, var(--glass-border) 72%, transparent)",animation:"corjectCorePulse 2.1s ease-in-out infinite"}}>
          <span style={{position:"absolute",inset:5,borderRadius:20,border:"1px dashed color-mix(in srgb, var(--accent) 33%, transparent)",animation:"corjectOrbitSpin 16s linear infinite"}} />
          {logoSrc?<img src={logoSrc} alt="Corject" style={{width:48,height:48,objectFit:"contain",animation:"corjectNodeFloat 1.9s ease-in-out infinite"}}/>:<span style={{fontSize:32,fontWeight:950,color:"var(--accent)",letterSpacing:"-.02em"}}>C</span>}
        </div>
        <div style={{fontFamily:"var(--font-display, Plus Jakarta Sans, Manrope, sans-serif)",fontSize:30,fontWeight:800,letterSpacing:"-.045em",color:"var(--text)",lineHeight:1,animation:"corjectStatusGlow 2.3s ease-in-out infinite"}}>Corject</div>
        <div style={{fontSize:13,color:"var(--muted)",marginTop:8,minHeight:20,lineHeight:1.45}}>{status}</div>
        <div style={{display:"flex",justifyContent:"center",gap:7,margin:"13px 0 22px"}}>{[0,1,2].map(index=><span key={index} style={{width:7,height:7,borderRadius:"50%",background:index===1?"var(--accent)":"var(--warning)",animation:`corjectNodeFloat .9s ease-in-out ${index*.14}s infinite alternate`}} />)}</div>
        <div style={{height:10,borderRadius:999,background:"rgb(255 255 255 / 60%)",overflow:"hidden",border:"1px solid var(--glass-border)",position:"relative",marginTop:10}}>
          <div style={{height:"100%",width:`${safeProgress}%`,borderRadius:999,background:"linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 64%, var(--warning))",transition:"width .38s cubic-bezier(.2,.8,.2,1)",position:"relative",overflow:"hidden",boxShadow:"0 0 24px color-mix(in srgb,var(--accent) 45%, transparent)"}}>
            <span style={{position:"absolute",inset:0,width:"44%",background:"linear-gradient(90deg,transparent,rgb(255 255 255 / 72%),transparent)",animation:"corjectBarFlow 1.8s ease-in-out infinite"}} />
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--muted)",marginTop:10,gap:12}}><span>{"Güvenli çalışma alanı yükleniyor..."}</span><b style={{color:"var(--accent)"}}>%{safeProgress}</b></div>
      </div>
    </div>
  </div></>;
}

