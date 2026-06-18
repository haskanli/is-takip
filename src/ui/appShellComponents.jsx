export const GlobalStyle = () => (
  <style>{`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; margin: 0; padding: 0; }
    body { font-family: Inter, Segoe UI, sans-serif; background: #0F172A; }
    h1, h2, h3 { color: #1E293B; }
    input, select, textarea, button { font-family: inherit; }
    .sidebar-nav { scrollbar-width: none; }
    .sidebar-nav::-webkit-scrollbar { display: none; }
    .login-users { scrollbar-width: thin; scrollbar-color: #475569 transparent; }
    @keyframes corjectLoadingFloat {
      0%, 100% { transform: translateY(0) rotate(0deg) scale(1); filter: drop-shadow(0 12px 30px rgba(99,102,241,.45)); }
      50% { transform: translateY(-7px) rotate(5deg) scale(1.05); filter: drop-shadow(0 18px 38px rgba(34,211,238,.55)); }
    }
    .corject-loading-logo { animation: corjectLoadingFloat 1.8s ease-in-out infinite; }
    .admin-summary-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin-bottom:12px; }
    .admin-summary-card { min-width:0; min-height:126px; border:1px solid #E2E8F0; border-top:3px solid #4A6CF7; border-radius:16px; background:#fff; padding:15px; text-align:left; cursor:pointer; box-shadow:0 8px 22px rgba(15,23,42,.05); overflow:hidden; transition:transform .16s ease, box-shadow .16s ease; }
    .admin-summary-card:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(15,23,42,.08); }
    .admin-ai-summary { background:#fff; border:1px solid #E2E8F0; border-radius:18px; padding:16px; box-shadow:0 8px 24px rgba(15,23,42,.05); overflow:hidden; }
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

export function AppLoadingScreen({progress=10,status="Oturum haz?rlan?yor",logoSrc=""}) {
  const safeProgress=Math.max(4,Math.min(100,Math.round(progress)));
  return <div style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",boxSizing:"border-box",padding:20,fontFamily:"Inter,Segoe UI,sans-serif",background:"radial-gradient(circle at 50% 30%,#312E81 0,#172033 42%,#0F172A 100%)",color:"#fff",zIndex:9999,overflow:"hidden"}}>
    <div style={{width:"min(430px,100%)",textAlign:"center"}}>
      <img className="corject-loading-logo" src={logoSrc} alt="Corject" style={{width:66,height:66,objectFit:"contain"}}/>
      <div style={{fontSize:14,fontWeight:900,letterSpacing:4,color:"#A5B4FC",marginTop:9}}>CORJECT</div>
      <div style={{fontSize:12,color:"#CBD5E1",margin:"25px 0 10px"}}>{status}</div>
      <div style={{height:9,borderRadius:20,background:"rgba(255,255,255,.1)",overflow:"hidden",border:"1px solid rgba(255,255,255,.08)"}}><div style={{height:"100%",width:`${safeProgress}%`,borderRadius:20,background:"linear-gradient(90deg,#4A6CF7,#8B5CF6,#22D3EE)",transition:"width .35s ease"}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#64748B",marginTop:7}}><span>Güvenli çalışma alanı yükleniyor</span><b style={{color:"#C4B5FD"}}>%{safeProgress}</b></div>
    </div>
  </div>;
}
