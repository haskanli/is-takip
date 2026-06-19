export const GlobalStyle = () => (
  <style>{`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; margin: 0; padding: 0; }
    body {
      font-family: var(--font-ui, Manrope, Segoe UI, sans-serif);
      color: var(--text, #112327);
      background:
        radial-gradient(circle at 14% -12%, rgb(11 138 148 / 14%), transparent 34%),
        radial-gradient(circle at 96% -6%, rgb(191 122 18 / 10%), transparent 30%),
        var(--bg, #f1f5f6);
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
      0%, 100% { transform: translateY(0) rotate(0deg) scale(1); filter: drop-shadow(0 12px 30px rgba(99,102,241,.45)); }
      50% { transform: translateY(-7px) rotate(5deg) scale(1.05); filter: drop-shadow(0 18px 38px rgba(34,211,238,.55)); }
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
    .admin-summary-card { min-width:0; min-height:126px; border:1px solid var(--border, #cfe0e3); border-top:3px solid var(--accent, #0b8a94); border-radius:18px; background:var(--surface, #fff); padding:15px; text-align:left; cursor:pointer; box-shadow:var(--shadow-soft, 0 18px 40px -26px rgb(17 35 39 / 34%)); overflow:hidden; transition:transform .16s ease, box-shadow .16s ease; }
    .admin-summary-card:hover { transform:translateY(-2px); box-shadow:0 22px 48px -34px rgb(17 35 39 / 48%); }
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
      .admin-summary-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .admin-summary-card { min-height:118px; padding:13px; }
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
      .admin-board-tools { opacity:1; }
      .admin-board-small, .admin-board-medium, .admin-board-large, .admin-board-full { grid-column:span 12; }
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

function LegacyAppLoadingScreen({progress=10,status="Oturum hazırlanıyor",logoSrc=""}) {
  const safeProgress=Math.max(4,Math.min(100,Math.round(progress)));
  const localAnimationCss = `
    @keyframes corjectRingSweep { 0% { transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 12px rgba(37,99,235,.28)); } 55% { transform: rotate(174deg) scale(1.02); filter: drop-shadow(0 0 20px rgba(34,211,238,.38)); } 100% { transform: rotate(360deg) scale(1); filter: drop-shadow(0 0 14px rgba(124,58,237,.32)); } }
    @keyframes corjectPathFill { 0% { transform: scaleX(0); opacity:.45; } 18% { transform: scaleX(.28); opacity:.85; } 48% { transform: scaleX(.68); opacity:1; } 72%, 100% { transform: scaleX(1); opacity:1; } }
    @keyframes corjectSpark { 0% { left:39px; opacity:0; transform:scale(.7); } 10% { opacity:1; } 48% { left:78px; transform:scale(1); } 74% { left:115px; opacity:1; transform:scale(.92); } 100% { left:115px; opacity:0; transform:scale(.65); } }
    @keyframes corjectNodeReady { 0%, 18% { background:#0B1224; border-color:#334155; box-shadow:none; } 34%, 100% { background:#E0F2FE; border-color:#4A6CF7; box-shadow:0 0 20px rgba(74,108,247,.62); } }
    @keyframes corjectNodeReadyTwo { 0%, 40% { background:#0B1224; border-color:#334155; box-shadow:none; } 55%, 100% { background:#EDE9FE; border-color:#8B5CF6; box-shadow:0 0 20px rgba(139,92,246,.62); } }
    @keyframes corjectNodeReadyThree { 0%, 62% { background:#0B1224; border-color:#334155; box-shadow:none; } 78%, 100% { background:#CFFAFE; border-color:#22D3EE; box-shadow:0 0 22px rgba(34,211,238,.72); } }
    @keyframes corjectCheckPulse { 0%, 68% { transform: scale(.75); opacity:0; } 78% { transform: scale(1.1); opacity:1; } 88%, 100% { transform: scale(1); opacity:1; } }
    @keyframes corjectGlowPulse { 0%, 100% { opacity:.25; transform: scale(.9); } 50% { opacity:.6; transform: scale(1.03); } }
    @keyframes corjectDots { 0%, 80%, 100% { opacity:.25; transform: translateY(0); } 40% { opacity:1; transform: translateY(-3px); } }
  `;
  return <><style>{localAnimationCss}</style><div style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",boxSizing:"border-box",padding:20,fontFamily:"Inter,Segoe UI,sans-serif",background:"radial-gradient(circle at 50% 18%,rgba(74,108,247,.22),transparent 34%),radial-gradient(circle at 58% 70%,rgba(34,211,238,.16),transparent 28%),linear-gradient(145deg,#020617 0%,#0B1020 48%,#111827 100%)",color:"#fff",zIndex:9999,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:"auto 12% 9%",height:90,background:"radial-gradient(ellipse,rgba(37,99,235,.42),transparent 65%)",filter:"blur(16px)"}} />
    <div style={{width:"min(390px,100%)",textAlign:"center",border:"1px solid rgba(148,163,184,.18)",borderRadius:32,padding:"34px 28px 30px",background:"linear-gradient(180deg,rgba(15,23,42,.78),rgba(2,6,23,.62))",boxShadow:"0 30px 90px rgba(0,0,0,.42)",backdropFilter:"blur(16px)",position:"relative"}}>
      <div style={{width:150,height:150,margin:"0 auto 18px",position:"relative",display:"grid",placeItems:"center"}}>
        <div style={{position:"absolute",inset:8,borderRadius:"50%",background:"conic-gradient(from 18deg,#2563EB 0 116deg,transparent 116deg 174deg,#7C3AED 174deg 306deg,transparent 306deg 360deg)",animation:"corjectRingSweep 3.6s cubic-bezier(.45,0,.2,1) infinite"}} />
        <div style={{position:"absolute",inset:32,borderRadius:"50%",background:"#050A16",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.06)"}} />
        <div style={{position:"absolute",left:42,right:34,top:78,height:8,borderRadius:999,background:"rgba(148,163,184,.18)",overflow:"hidden"}}><span style={{display:"block",height:"100%",width:"100%",borderRadius:999,background:"linear-gradient(90deg,#22D3EE,#4A6CF7,#A855F7)",transformOrigin:"left center",animation:"corjectPathFill 2.4s ease-in-out infinite",boxShadow:"0 0 16px rgba(34,211,238,.55)"}} /></div>
        <span style={{position:"absolute",left:37,top:66,width:30,height:30,borderRadius:"50%",background:"#0B1224",border:"7px solid #334155",animation:"corjectNodeReady 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",left:75,top:72,width:18,height:18,borderRadius:"50%",background:"#0B1224",border:"5px solid #334155",animation:"corjectNodeReadyTwo 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",left:112,top:70,width:22,height:22,borderRadius:"50%",background:"#0B1224",border:"5px solid #334155",animation:"corjectNodeReadyThree 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",top:74,width:18,height:18,borderRadius:"50%",background:"#E0F2FE",boxShadow:"0 0 24px rgba(34,211,238,.9)",animation:"corjectSpark 2.4s ease-in-out infinite"}} />
        <span style={{position:"absolute",right:26,top:52,width:38,height:38,borderRadius:"50%",background:"#22D3EE",display:"grid",placeItems:"center",boxShadow:"0 0 28px rgba(34,211,238,.75)",animation:"corjectCheckPulse 2.1s ease-in-out infinite"}}>
          <i style={{width:15,height:8,borderLeft:"4px solid #fff",borderBottom:"4px solid #fff",transform:"rotate(-45deg)",display:"block",marginTop:-2}} />
        </span>
        <span style={{position:"absolute",inset:48,borderRadius:"50%",background:"radial-gradient(circle,rgba(34,211,238,.3),transparent 62%)",animation:"corjectGlowPulse 1.8s ease-in-out infinite"}} />
        {logoSrc&&<img className="corject-loading-logo" src={logoSrc} alt="Corject" style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none"}}/>}
      </div>
      <div style={{fontSize:32,fontWeight:950,letterSpacing:"-.04em",color:"#fff",lineHeight:1}}>Corject</div>
      <div style={{fontSize:13,color:"#CBD5E1",marginTop:10,minHeight:18}}>{status}</div>
      <div style={{display:"flex",justifyContent:"center",gap:7,margin:"13px 0 22px"}}>
        {[0,1,2].map(index=><span key={index} style={{width:7,height:7,borderRadius:"50%",background:index===1?"#8B5CF6":"#22D3EE",animation:`corjectDots 1.2s ease-in-out ${index*.16}s infinite`}} />)}
      </div>
      <div style={{height:8,borderRadius:20,background:"rgba(148,163,184,.16)",overflow:"hidden",border:"1px solid rgba(148,163,184,.16)"}}><div style={{height:"100%",width:`${safeProgress}%`,borderRadius:20,background:"linear-gradient(90deg,#2563EB,#7C3AED,#22D3EE)",transition:"width .35s ease",boxShadow:"0 0 24px rgba(34,211,238,.42)"}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#94A3B8",marginTop:9}}><span>Güvenli çalışma alanı yükleniyor</span><b style={{color:"#C4B5FD"}}>%{safeProgress}</b></div>
    </div>
  </div></>;
}

export function AppLoadingScreen({progress=10,status="Oturum hazırlanıyor",logoSrc=""}) {
  const safeProgress=Math.max(4,Math.min(100,Math.round(progress)));
  const animationCss=`
    @keyframes corjectSoftOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes corjectLogoBreath { 0%,100% { transform: scale(1); box-shadow:0 18px 38px rgb(11 138 148 / 16%); } 50% { transform: scale(1.035); box-shadow:0 22px 48px rgb(191 122 18 / 18%); } }
    @keyframes corjectProgressShine { 0% { transform: translateX(-78%); opacity:.12; } 45% { opacity:.72; } 100% { transform: translateX(176%); opacity:.08; } }
    @keyframes corjectPulseDot { 0%,100% { transform: scale(.82); opacity:.48; } 50% { transform: scale(1); opacity:1; } }
  `;
  return <><style>{animationCss}</style><div style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",boxSizing:"border-box",padding:22,fontFamily:"var(--font-ui, Manrope, Segoe UI, sans-serif)",background:"radial-gradient(circle at 20% 12%,rgb(11 138 148 / 14%),transparent 34%),radial-gradient(circle at 86% 22%,rgb(191 122 18 / 12%),transparent 30%),linear-gradient(180deg,#F7FBFC 0%,#EDF4F5 100%)",color:"var(--text, #112327)",zIndex:9999,overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,rgba(255,255,255,.52) 1px,transparent 1px),linear-gradient(180deg,rgba(255,255,255,.52) 1px,transparent 1px)",backgroundSize:"44px 44px",maskImage:"linear-gradient(180deg,rgba(0,0,0,.48),transparent 72%)",opacity:.34}} />
    <div style={{width:"min(420px,100%)",textAlign:"center",border:"1px solid var(--border, #cfe0e3)",borderRadius:30,padding:"34px 30px 28px",background:"rgb(255 255 255 / 88%)",boxShadow:"0 30px 90px -52px rgb(17 35 39 / 58%)",backdropFilter:"blur(18px)",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",left:"10%",right:"10%",top:0,height:4,background:"linear-gradient(90deg,var(--accent, #0b8a94),var(--warning, #bf7a12),var(--success, #19835c))",borderRadius:"0 0 999px 999px"}} />
      <div style={{width:116,height:116,margin:"0 auto 18px",position:"relative",display:"grid",placeItems:"center"}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",background:"conic-gradient(from 90deg,var(--accent, #0b8a94) 0 110deg,transparent 110deg 185deg,var(--warning, #bf7a12) 185deg 278deg,transparent 278deg 360deg)",opacity:.78,animation:"corjectSoftOrbit 5.2s linear infinite"}} />
        <div style={{position:"absolute",inset:8,borderRadius:"50%",background:"#fff",boxShadow:"inset 0 0 0 1px var(--border, #cfe0e3)"}} />
        <div style={{position:"relative",width:78,height:78,borderRadius:24,background:"linear-gradient(145deg,#FFFFFF,var(--surface-soft, #f6fafb))",display:"grid",placeItems:"center",animation:"corjectLogoBreath 2.6s ease-in-out infinite",border:"1px solid var(--border, #cfe0e3)"}}>
          {logoSrc?<img src={logoSrc} alt="Corject" style={{width:56,height:56,objectFit:"contain"}}/>:<span style={{fontSize:32,fontWeight:950,color:"var(--accent, #0b8a94)"}}>C</span>}
        </div>
      </div>
      <div style={{fontFamily:"var(--font-display, Fraunces, Georgia, serif)",fontSize:31,fontWeight:800,letterSpacing:"-.045em",color:"var(--text, #112327)",lineHeight:1}}>Corject</div>
      <div style={{fontSize:13,color:"var(--muted, #5b6f74)",marginTop:10,minHeight:18}}>{status}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"15px 0 22px"}}>
        {[0,1,2].map(index=><span key={index} style={{width:8,height:8,borderRadius:"50%",background:["var(--accent, #0b8a94)","var(--warning, #bf7a12)","var(--success, #19835c)"][index],animation:`corjectPulseDot 1.25s ease-in-out ${index*.15}s infinite`}} />)}
      </div>
      <div style={{height:10,borderRadius:999,background:"var(--surface-soft, #f6fafb)",overflow:"hidden",border:"1px solid var(--border, #cfe0e3)",position:"relative"}}>
        <div style={{height:"100%",width:`${safeProgress}%`,borderRadius:999,background:"linear-gradient(90deg,var(--accent, #0b8a94),var(--warning, #bf7a12),var(--success, #19835c))",transition:"width .35s ease",position:"relative",overflow:"hidden"}}>
          <span style={{position:"absolute",inset:0,width:"42%",background:"linear-gradient(90deg,transparent,rgba(255,255,255,.72),transparent)",animation:"corjectProgressShine 1.7s ease-in-out infinite"}} />
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--muted, #5b6f74)",marginTop:10}}><span>Güvenli çalışma alanı yükleniyor</span><b style={{color:"var(--accent, #0b8a94)"}}>%{safeProgress}</b></div>
    </div>
  </div></>;
}
