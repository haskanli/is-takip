import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { getJiraIssue } from "./jira";
import * as XLSX from "xlsx";
import corjectLogo from "./assets/corject-logo.png";

const APP_VERSION = "v1.2.0";
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "—";
const fmtFull = (d) => d ? new Date(d).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);

const S = {
  "Başlamadı":    { bg:"#F8FAFC", text:"#94A3B8", dot:"#94A3B8" },
  "Bekliyor":     { bg:"#F1F5FF", text:"#4A6CF7", dot:"#4A6CF7" },
  "Devam Ediyor": { bg:"#FFF7ED", text:"#EA6C00", dot:"#EA6C00" },
  "Tamamlandı":   { bg:"#ECFDF5", text:"#059669", dot:"#059669" },
  "Engellendi":   { bg:"#FFF1F2", text:"#E11D48", dot:"#E11D48" },
};
const PCOL = { "D\u00fc\u015f\u00fck":"#94A3B8", "Orta":"#EA6C00", "Y\u00fcksek":"#E11D48" };
const STATUSES = Object.keys(S);
const PRIORITIES = Object.keys(PCOL);
const WAIT = ["PM","M\u00fc\u015fteri","ERP","Tedarik\u00e7i","Teknik","\u00dcr\u00fcn-Teknoloji","Y\u00f6netim","Di\u011fer"];
const COLORS = ["#4A6CF7","#059669","#EA6C00","#E11D48","#7C3AED","#0EA5E9","#DB2777","#D97706"];

const daysDiff = (d) => !d ? 0 : Math.floor((new Date().setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
const delayLvl = (d, st) => { if (!d || st==="Tamamland\u0131") return null; const x=daysDiff(d); if(x<=0)return null; return x>=7?"critical":"normal"; };

// ─── MES Templates ─────────────────────────────────────────────────────────
const MES_TEMPLATES = [
  {
    id:"tpl_mes_full",
    name:"MES Tam Kurulum",
    description:"Fabrikada s\u0131f\u0131rdan MES kurulumu i\u00e7in standart 6 a\u015famal\u0131 plan",
    color:"#4A6CF7",
    milestones:[
      { name:"Kapsam & Fizibilite", offsetDays:0, durationDays:21,
        tasks:["Mevcut s\u00fcre\u00e7 analizi","Veri ak\u0131\u015f haritas\u0131 olu\u015fturma","Entegrasyon noktalar\u0131 belirleme","ROI hesaplama","Onay ve imza"] },
      { name:"Altyap\u0131 Haz\u0131rl\u0131k", offsetDays:21, durationDays:28,
        tasks:["Sunucu kurulumu","Network segmentasyonu","Firewall kurallar\u0131","OPC-UA / MQTT altyap\u0131","Test ortam\u0131 kurulumu"] },
      { name:"Makine Entegrasyonu", offsetDays:49, durationDays:35,
        tasks:["CNC ba\u011flant\u0131 konfigurasyonu","PLC haberle\u015fme testi","Alarm mapping","\u00dcretim say\u0131c\u0131 kalibrasyonu","Canl\u0131 veri do\u011frulama"] },
      { name:"MES Yaz\u0131l\u0131m Kurulum", offsetDays:84, durationDays:28,
        tasks:["Veritaban\u0131 kurulumu","Modül konfigurasyonu","Kullan\u0131c\u0131 yetkilendirme","Dashboard tan\u0131mlar\u0131","Rapor \u015fablonlar\u0131"] },
      { name:"Test & Validasyon", offsetDays:112, durationDays:21,
        tasks:["Fonksiyonel testler","Entegrasyon testleri","Performans testleri","Kullan\u0131c\u0131 kabul testi","Hata d\u00fczeltme"] },
      { name:"Canl\u0131ya Al\u0131\u015f & E\u011fitim", offsetDays:133, durationDays:14,
        tasks:["Operatör e\u011fitimi","Y\u00f6netici e\u011fitimi","Canl\u0131ya ge\u00e7i\u015f plan\u0131","\u0130lk hafta izleme","Dökümantasyon teslimi"] }
    ]
  },
  {
    id:"tpl_mes_integration",
    name:"MES-ERP Entegrasyonu",
    description:"Mevcut MES sisteminin ERP ile entegrasyonu",
    color:"#059669",
    milestones:[
      { name:"Analiz & Tasarım", offsetDays:0, durationDays:14,
        tasks:["Mevcut API analizi","Veri modeli e\u015fle\u015ftirme","Entegrasyon mimarisi","Test plan\u0131 haz\u0131rlama"] },
      { name:"API Geli\u015ftirme", offsetDays:14, durationDays:28,
        tasks:["REST endpoint geli\u015ftirme","Kimlik do\u011frulama","Hata y\u00f6netimi","API dökümantasyonu"] },
      { name:"Veri Senkronizasyon", offsetDays:42, durationDays:21,
        tasks:["\u0130\u015f emirleri senkronu","Stok güncelleme","Kalite kay\u0131tlar\u0131","Raporlama entegrasyonu"] },
      { name:"Test & Canl\u0131", offsetDays:63, durationDays:14,
        tasks:["UAT testleri","Performans testleri","Canl\u0131ya ge\u00e7i\u015f","\u0130zlem ve destek"] }
    ]
  },
  {
    id:"tpl_mes_upgrade",
    name:"MES Versiyon G\u00fcncelleme",
    description:"Mevcut MES sisteminin yeni versiyona g\u00fcncellenmesi",
    color:"#7C3AED",
    milestones:[
      { name:"Etki Analizi", offsetDays:0, durationDays:7,
        tasks:["Versiyon fark analizi","Özelleştirme envanteri","Risk de\u011ferlendirme","Geri d\u00f6nü\u015f plan\u0131"] },
      { name:"Test Ortam\u0131 Güncelleme", offsetDays:7, durationDays:14,
        tasks:["Test ortam\u0131 yedek","Güncelleme uygulanmas\u0131","Regresyon testleri","Özelleştirme migrasyonu"] },
      { name:"Canl\u0131 Güncelleme", offsetDays:21, durationDays:7,
        tasks:["Canl\u0131 sistem yedek","Planlı downtime","Güncelleme uygulama","Doğrulama testleri","Geri d\u00f6nü\u015f kontrol"] }
    ]
  }
];

const addDays = (dateStr, n) => {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
};

const buildFromTemplate = (tpl, startDate) => ({
  milestones: tpl.milestones.map(m => ({
    id: uid(), name: m.name,
    startDate: addDays(startDate, m.offsetDays),
    dueDate: addDays(startDate, m.offsetDays + m.durationDays),
    status: "Bekliyor", waitSource: "",
    tasks: m.tasks.map(t => ({ id:uid(), title:t, status:"Bekliyor", priority:"Orta", assignee:"", dueDate: addDays(startDate, m.offsetDays + m.durationDays), notes:"", waitSource:"" }))
  }))
});

// ─── Demo Data ──────────────────────────────────────────────────────────────
const DEMO = {
  people:[
    { id:"p1", name:"Hakan", role:"Y\u00f6netici", avatar:"H", isAdmin:true },
    { id:"p2", name:"Ay\u015fe K.", role:"Geli\u015ftirici", avatar:"AK", isAdmin:false },
    { id:"p3", name:"Mert D.", role:"Tasar\u0131mc\u0131", avatar:"MD", isAdmin:false },
  ],
  projects:[{
    id:"proj1", name:"CNC Dashboard MES", color:"#4A6CF7",
    description:"Makine izleme MES entegrasyon projesi",
    startDate:"2026-06-01", endDate:"2026-08-31",
    status:"Devam Ediyor", pm:"p1",
    members:["p1","p2","p3"],
    risks:[{ id:"r1", title:"Mitsubishi API eri\u015fimi belirsiz", level:"Y\u00fcksek", status:"A\u00e7\u0131k", note:"Alternatif protokol ara\u015ft\u0131r\u0131l\u0131yor" }],
    milestones:[
      { id:"ms1", name:"Kapsam & Fizibilite", startDate:"2026-06-01", dueDate:"2026-06-22", status:"Tamamland\u0131", waitSource:"",
        tasks:[
          { id:"t1", title:"Mevcut s\u00fcre\u00e7 analizi", status:"Tamamland\u0131", priority:"Y\u00fcksek", assignee:"p1", dueDate:"2026-06-10", notes:"", waitSource:"" },
          { id:"t2", title:"Entegrasyon noktalar\u0131 belirleme", status:"Tamamland\u0131", priority:"Y\u00fcksek", assignee:"p2", dueDate:"2026-06-15", notes:"", waitSource:"" },
        ]},
      { id:"ms2", name:"Altyap\u0131 Haz\u0131rl\u0131k", startDate:"2026-06-22", dueDate:"2026-07-20", status:"Devam Ediyor", waitSource:"Teknik",
        tasks:[
          { id:"t3", title:"Sunucu kurulumu", status:"Tamamland\u0131", priority:"Y\u00fcksek", assignee:"p2", dueDate:"2026-07-01", notes:"", waitSource:"" },
          { id:"t4", title:"OPC-UA altyap\u0131", status:"Devam Ediyor", priority:"Y\u00fcksek", assignee:"p2", dueDate:"2026-07-15", notes:"pyLSV2 test ediliyor", waitSource:"Teknik" },
          { id:"t5", title:"Test ortam\u0131 kurulumu", status:"Bekliyor", priority:"Orta", assignee:"p3", dueDate:"2026-07-20", notes:"", waitSource:"" },
        ]},
      { id:"ms3", name:"Makine Entegrasyonu", startDate:"2026-07-20", dueDate:"2026-08-24", status:"Bekliyor", waitSource:"",
        tasks:[
          { id:"t6", title:"CNC ba\u011flant\u0131 konfigurasyonu", status:"Bekliyor", priority:"Y\u00fcksek", assignee:"p1", dueDate:"2026-08-05", notes:"", waitSource:"" },
          { id:"t7", title:"Alarm mapping", status:"Bekliyor", priority:"Orta", assignee:"p3", dueDate:"2026-08-15", notes:"", waitSource:"" },
        ]},
    ]
  }],
  personalTasks:[
    { id:"pt1", title:"Haftal\u0131k rapor haz\u0131rla", status:"Bekliyor", priority:"Orta", assignee:"p2", dueDate:"2026-06-14", notes:"", waitSource:"", createdBy:"p1" },
    { id:"pt2", title:"Sunucu yedekleme kontrolü", status:"Tamamland\u0131", priority:"Y\u00fcksek", assignee:"p1", dueDate:"2026-06-10", notes:"", waitSource:"", createdBy:"p1" },
  ],
  userNotes:{
    "p1":{ notes:"Mitsubishi protokol sorunu çözülmeli\nERP entegrasyon toplant\u0131s\u0131 planlanacak", todos:[
      { id:"n1", text:"Teknik ekiple protokol toplant\u0131s\u0131", done:false },
      { id:"n2", text:"Q3 butce onayi", done:false, projectId:"proj1" },
      { id:"n3", text:"Server rack siparisi", done:true, projectId:"" },
    ]},
    "p2":{ notes:"OPC-UA test notlar\u0131: port 4840 a\u00e7\u0131k, sertifika sorunu var", todos:[
      { id:"n4", text:"OPC-UA sertifika yenile", done:false, projectId:"proj1" },
      { id:"n5", text:"Pycomm3 dene", done:false, projectId:"" },
    ]},
    "p3":{ notes:"", todos:[] },
  },
  logs:[
    { id:"l1", ts:"2026-06-08T10:30:00Z", user:"Hakan", userId:"p1", action:"task_done", detail:"Mevcut süreç analizi tamamland\u0131", project:"CNC Dashboard MES", milestone:"Kapsam & Fizibilite" },
    { id:"l2", ts:"2026-06-09T14:15:00Z", user:"Ay\u015fe K.", userId:"p2", action:"status_change", detail:"OPC-UA altyap\u0131 → Devam Ediyor", project:"CNC Dashboard MES", milestone:"Altyap\u0131 Haz\u0131rl\u0131k" },
    { id:"l3", ts:"2026-06-10T09:00:00Z", user:"Hakan", userId:"p1", action:"project_create", detail:"CNC Dashboard MES projesi olu\u015fturuldu", project:"CNC Dashboard MES", milestone:"" },
  ],
  currentUserId:null,
};

// ─── Supabase persistence ────────────────────────────────────────────────────
// Tum uygulama durumu tek bir JSON satirinda tutulur (app_state tablosu)
const load = () => JSON.parse(JSON.stringify(DEMO)); // baslangic — gercek veri useEffect ile yuklenir

const loadFromSupabase = async () => {
  try {
    const { data, error } = await supabase.from("app_state").select("data").eq("id", 1).single();
    if (error || !data) return null;
    return data.data;
  } catch { return null; }
};

let saveTimer = null;
const saveToSupabase = (state, onStatus) => {
  const { currentUserId, ...shared } = state;
  if (saveTimer) clearTimeout(saveTimer);
  if (onStatus) onStatus("saving");
  saveTimer = setTimeout(async () => {
    try {
      const { error } = await supabase.from("app_state").upsert({ id: 1, data: shared, updated_at: new Date().toISOString() });
      if (error) {
        console.error("Supabase kayit hatasi:", error);
        if (onStatus) onStatus("error", error.message);
      } else {
        if (onStatus) onStatus("saved");
      }
    } catch (e) {
      console.error("Supabase baglanti hatasi:", e);
      if (onStatus) onStatus("error", String(e));
    }
  }, 800);
};

// ─── Log action types ───────────────────────────────────────────────────────
const LOG_META = {
  task_done:     { icon:"✓", color:"#059669", bg:"#ECFDF5", label:"Tamamland\u0131" },
  task_add:      { icon:"+", color:"#4A6CF7", bg:"#F1F5FF", label:"Görev Eklendi" },
  task_delete:   { icon:"×", color:"#E11D48", bg:"#FFF1F2", label:"Görev Silindi" },
  status_change: { icon:"↻", color:"#EA6C00", bg:"#FFF7ED", label:"Durum De\u011fi\u015fti" },
  milestone_add: { icon:"◆", color:"#7C3AED", bg:"#F5F3FF", label:"Milestone" },
  project_create:{ icon:"▦", color:"#0EA5E9", bg:"#F0F9FF", label:"Proje" },
  risk_add:      { icon:"!", color:"#E11D48", bg:"#FFF1F2", label:"Risk" },
  import:        { icon:"⬆", color:"#64748B", bg:"#F8FAFC", label:"Import" },
  person_add:    { icon:"◉", color:"#4A6CF7", bg:"#F1F5FF", label:"Ekip" },
  general:       { icon:"·", color:"#64748B", bg:"#F8FAFC", label:"Genel" },
};

// ─── UI Atoms ───────────────────────────────────────────────────────────────
function Avatar({ initials, size=28, color="#4A6CF7" }) {
  return <div style={{ width:size, height:size, borderRadius:"50%", background:color+"22", border:`2px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color, flexShrink:0, fontFamily:"monospace" }}>{initials}</div>;
}
function Icon({ name, size=16 }) {
  const paths={
    projects:<><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 6V4h7l2 2"/></>,
    tasks:<><path d="M5 4h14v16H5z"/><path d="m8 9 2 2 4-4M8 15h8"/></>,
    reports:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    people:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7M15 14c3 0 5 2 5 6"/></>,
    activity:<><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
    bell:<><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7M10 20h4"/></>,
    machines:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6v6H7zM16 9h2M16 13h2M8 22v-3M17 22v-3"/></>,
    gantt:<><path d="M4 6h8M4 12h14M4 18h11"/><path d="M2 4v4M2 10v4M2 16v4"/></>,
    risk:<><path d="M12 3 2 21h20zM12 9v5M12 18h.01"/></>,
    ticket:<><path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M12 7v10"/></>,
    notes:<><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/></>,
    edit:<><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.projects}</svg>;
}
function Badge({ label }) {
  const c=S[label]||{ bg:"#F1F5FF", text:"#4A6CF7", dot:"#4A6CF7" };
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:c.bg, color:c.text, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:600 }}><span style={{ width:5, height:5, borderRadius:"50%", background:c.dot }} />{label}</span>;
}
function DelayBadge({ dateStr, status }) {
  const lv=delayLvl(dateStr,status); if(!lv)return null;
  return <span style={{ background:lv==="critical"?"#FFF1F2":"#FFF7ED", color:lv==="critical"?"#E11D48":"#EA6C00", borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700 }}>{lv==="critical"?"🔴 Kritik":"🟠 Gecikti"} ({daysDiff(dateStr)}g)</span>;
}
function Modal({ title, onClose, wide, children }) {
  return <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{ background:"#fff", borderRadius:16, padding:"26px 30px", width:"100%", maxWidth:wide?720:500, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>{title}</h3>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#94A3B8" }}>x</button>
      </div>
      {children}
    </div>
  </div>;
}

const iStyle = { width:"100%", padding:"8px 11px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:13, color:"#1E293B", outline:"none", boxSizing:"border-box", fontFamily:"inherit", background:"#FAFBFC" };
const lStyle = { fontSize:12, fontWeight:600, color:"#64748B", display:"block", marginBottom:4 };
const Field = ({ label, children }) => <div style={{ marginBottom:13 }}><label style={lStyle}>{label}</label>{children}</div>;
const Btn = ({ children, onClick, variant="primary", small, style:s, disabled }) => {
  const v={ primary:{background:"#4A6CF7",color:"#fff"}, secondary:{background:"#F1F5FF",color:"#4A6CF7"}, danger:{background:"#FFF1F2",color:"#E11D48"}, ghost:{background:"transparent",color:"#64748B"}, warning:{background:"#FFF7ED",color:"#EA6C00"}, success:{background:"#ECFDF5",color:"#059669"} };
  return <button disabled={disabled} style={{ borderRadius:8, border:"none", cursor:disabled?"default":"pointer", fontWeight:600, fontSize:small?12:13, padding:small?"5px 11px":"8px 16px", fontFamily:"inherit", opacity:disabled?0.5:1, ...v[variant], ...s }} onClick={onClick}>{children}</button>;
};

// ─── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ people, onLogin }) {
  const [sel, setSel] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  return (
    <div style={{ position:"fixed", inset:0, background:"linear-gradient(145deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,Segoe UI,sans-serif", overflow:"auto" }}>
      <div style={{ width:"100%", maxWidth:640, padding:"24px 20px", boxSizing:"border-box" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <img src={corjectLogo} alt="Corject" style={{ width:76, height:76, objectFit:"contain", marginBottom:10, filter:"drop-shadow(0 10px 22px rgba(74,108,247,.35))" }} />
          <div style={{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:3, textTransform:"uppercase" }}>CORJECT</div>
          <div style={{ fontSize:13, color:"#64748B", marginTop:6 }}>Proje Yönetim Sistemi</div>
        </div>
        {/* Card */}
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:20, padding:"28px 24px", backdropFilter:"blur(10px)" }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#94A3B8", marginBottom:16, textAlign:"center" }}>Hesabınızı seçin</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))", gap:9, marginBottom:22, maxHeight:"48vh", overflowY:"auto", paddingRight:2 }}>
            {people.map(p => (
              <div key={p.id} onClick={() => setSel(p.id)}
                onMouseEnter={() => setHoveredId(p.id)} onMouseLeave={() => setHoveredId(null)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:7, padding:"13px 10px", borderRadius:12, textAlign:"center",
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
        <div style={{ textAlign:"center", marginTop:20, fontSize:11, color:"#334155" }}>CORJECT {APP_VERSION} · Proje Yönetimi</div>
      </div>
    </div>
  );
}

function TemplatePicker({ onSelect, onSkip }) {
  const [sel, setSel] = useState(null);
  return <div>
    <div style={{ marginBottom:16, fontSize:13, color:"#64748B" }}>Başlangıç şablonu seçin veya boş devam edin:</div>
    <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
      {MES_TEMPLATES.map(t => <div key={t.id} onClick={() => setSel(t.id)}
        style={{ padding:"14px 16px", borderRadius:12, border:`2px solid ${sel===t.id?t.color:"#E2E8F0"}`, cursor:"pointer", background:sel===t.id?t.color+"11":"#fff" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ width:10, height:10, borderRadius:"50%", background:t.color, flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13 }}>{t.name}</div>
          <span style={{ marginLeft:"auto", fontSize:11, color:"#94A3B8" }}>{t.milestones.length} milestone</span>
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginTop:4, marginLeft:20 }}>{t.description}</div>
        {sel===t.id && <div style={{ marginTop:10, marginLeft:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#64748B", marginBottom:5 }}>Milestonelar:</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {t.milestones.map((m,i) => <span key={i} style={{ background:t.color+"22", color:t.color, borderRadius:8, padding:"2px 9px", fontSize:11, fontWeight:600 }}>{m.name}</span>)}
          </div>
        </div>}
      </div>)}
    </div>
    <div style={{ display:"flex", justifyContent:"space-between" }}>
      <Btn variant="ghost" onClick={onSkip}>Şablon Olmadan Devam</Btn>
      <Btn disabled={!sel} onClick={() => sel&&onSelect(MES_TEMPLATES.find(t=>t.id===sel))}>Bu Şablonu Kullan</Btn>
    </div>
  </div>;
}

// ─── Gantt ──────────────────────────────────────────────────────────────────
function GanttChart({ project, compact }) {
  const [expanded, setExpanded] = useState(null);
  const ms = project.milestones;
  if (!ms.length) return <div style={{ padding:40, textAlign:"center", color:"#94A3B8" }}>Milestone yok.</div>;

  const allDates = [
    ...ms.map(m => m.startDate || project.startDate).filter(Boolean),
    ...ms.map(m => m.dueDate).filter(Boolean),
  ].filter(Boolean);
  if (!allDates.length) return <div style={{ padding:40, textAlign:"center", color:"#94A3B8" }}>Tarih bilgisi eksik.</div>;

  const minDate = new Date(Math.min(...allDates.map(d => new Date(d))));
  const maxDate = new Date(Math.max(...allDates.map(d => new Date(d))));
  // Add padding so bars don't touch edges
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 3);
  const total = Math.max(1, (maxDate - minDate) / 86400000);
  const todayOff = (new Date() - minDate) / 86400000;

  const pct = (d) => {
    if (!d) return 0;
    return Math.max(0, Math.min(99, (new Date(d) - minDate) / 86400000 / total * 100));
  };
  const wPct = (s, e) => {
    if (!s || !e) return 2;
    const w = (new Date(e) - new Date(s)) / 86400000 / total * 100;
    return Math.max(2, w);
  };

  const months = [];
  let cur = new Date(minDate); cur.setDate(1);
  while (cur <= maxDate) {
    months.push({ label: cur.toLocaleDateString("tr-TR", { month:"short", year:"2-digit" }), pct: pct(cur.toISOString().slice(0,10)) });
    cur.setMonth(cur.getMonth() + 1);
  }

  const labelW = compact ? 110 : 150;
  const rowH = 28;
  const bgs = ["#FFFFFF", "#F8FAFF"];

  const barColor = (m) => {
    const dl = delayLvl(m.dueDate, m.status);
    if (m.status === "Tamamland\u0131") return "#059669";
    if (dl === "critical") return "#E11D48";
    if (dl === "normal") return "#EA6C00";
    return project.color;
  };

  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth: 520 }}>
        <div style={{ fontSize:10, color:"#94A3B8", marginBottom:8 }}>
          Milestone tıklayın → hedeflenen/gerçekleşen + görev satırları
        </div>
        {/* Month labels */}
        <div style={{ display:"flex", marginLeft:labelW, marginBottom:4, position:"relative", height:16 }}>
          {months.map((m, i) => (
            <div key={i} style={{ position:"absolute", left:`${m.pct}%`, fontSize:9, color:"#94A3B8", fontWeight:600, whiteSpace:"nowrap" }}>{m.label}</div>
          ))}
        </div>
        {/* Today line header */}
        <div style={{ display:"flex", marginLeft:labelW, marginBottom:2, position:"relative", height:2 }}>
          <div style={{ flex:1, position:"relative", height:2, background:"#F1F5FF", borderRadius:1 }}>
            {todayOff >= 0 && todayOff <= total && (
              <div style={{ position:"absolute", left:`${todayOff/total*100}%`, top:-2, bottom:-2, width:2, background:"#E11D48", opacity:0.5 }} />
            )}
          </div>
        </div>

        {ms.map((m, mi) => {
          const s = m.startDate || project.startDate;
          const e = m.dueDate;
          if (!s || !e) return null;
          const bc = barColor(m);
          const done = m.tasks.filter(t => t.status === "Tamamland\u0131").length;
          const isExp = expanded === m.id;

          return (
            <div key={m.id} style={{ marginBottom: isExp ? 2 : 3 }}>
              {/* Milestone row */}
              <div onClick={() => setExpanded(isExp ? null : m.id)}
                style={{ display:"flex", alignItems:"center", padding:"2px 0", cursor:"pointer" }}>
                <div style={{ width:labelW, flexShrink:0, fontSize:compact ? 10 : 11, fontWeight:700, paddingRight:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#1E293B" }} title={m.name}>
                  {isExp ? "▾" : "▸"} {m.name}
                </div>
                <div style={{ flex:1, position:"relative", height:rowH, background: bgs[mi % 2], borderRadius:6, border:`1px solid #E8EDF5` }}>
                  {/* Today line */}
                  {todayOff >= 0 && todayOff <= total && (
                    <div style={{ position:"absolute", left:`${todayOff/total*100}%`, top:0, bottom:0, width:1.5, background:"#E11D48", zIndex:4, opacity:0.7 }} />
                  )}
                  {/* Planned bar (dashed outline) */}
                  <div style={{
                    position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`,
                    top:4, height:rowH-8, background:bc+"22",
                    border:`1.5px dashed ${bc}`, borderRadius:4, zIndex:1
                  }} />
                  {/* Actual bar (solid) - only if actual dates exist */}
                  {m.actualStart && (
                    <div style={{
                      position:"absolute",
                      left:`${pct(m.actualStart)}%`,
                      width:`${wPct(m.actualStart, m.actualEnd || new Date().toISOString().slice(0,10))}%`,
                      top:4, height:rowH-8, background:bc, borderRadius:4, zIndex:2,
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      <span style={{ fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap" }}>
                        {m.status === "Tamamland\u0131" ? "✓ " : ""}{fmt(e)}
                      </span>
                    </div>
                  )}
                  {/* If no actual, show solid planned bar with label */}
                  {!m.actualStart && (
                    <div style={{
                      position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`,
                      top:4, height:rowH-8, background:bc, borderRadius:4, zIndex:2,
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      <span style={{ fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap" }}>
                        {m.status === "Tamamland\u0131" ? "✓ " : ""}{fmt(s)} → {fmt(e)}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ width:50, textAlign:"right", paddingLeft:6, fontSize:10, color:"#94A3B8" }}>{done}/{m.tasks.length}</div>
              </div>

              {/* Expanded: comparison + tasks */}
              {isExp && (
                <div style={{ marginLeft:labelW, background:"#F0F6FF", borderRadius:"0 0 6px 6px", padding:"8px 8px 10px", border:"1px solid #D0E0FF", borderTop:"none", marginBottom:4 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:"#4A6CF7", marginBottom:8 }}>
                    Hedef: {fmt(s)} → {fmt(e)} &nbsp;|&nbsp; {m.actualStart ? `Gerçekleşen: ${fmt(m.actualStart)} → ${fmt(m.actualEnd)||"devam"}` : "Gerçekleşen tarih girilmemiş (Milestone Düzenle)"}
                  </div>
                  {/* Task Gantt rows */}
                  {m.tasks.filter(t => t.dueDate).length > 0 ? (
                    <div>
                      <div style={{ fontSize:9, fontWeight:600, color:"#4A6CF7", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Görev Planı</div>
                      {m.tasks.filter(t => t.dueDate).map(t => {
                        const tdl = delayLvl(t.dueDate, t.status);
                        const tc = t.status === "Tamamland\u0131" ? "#059669" : tdl === "critical" ? "#E11D48" : tdl === "normal" ? "#EA6C00" : project.color;
                        const hasRange = t.startDate && t.dueDate && new Date(t.startDate) < new Date(t.dueDate);
                        const barLeft = hasRange ? pct(t.startDate) : Math.max(0, pct(t.dueDate) - 1);
                        const barWidth = hasRange ? wPct(t.startDate, t.dueDate) : 2;
                        const donePct = t.status === "Tamamland\u0131" ? 100 : 0;
                        return (
                          <div key={t.id} style={{ display:"flex", alignItems:"center", marginBottom:5 }}>
                            <div style={{ width:140, flexShrink:0, fontSize:9, color:"#475569", paddingRight:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: t.status==="Tamamland\u0131"?400:500 }} title={t.title}>
                              {t.status==="Tamamland\u0131" ? "✓ " : ""}{t.title}
                            </div>
                            <div style={{ flex:1, position:"relative", height:20, background:"#fff", borderRadius:4, border:"1px solid #E8EDF5", overflow:"hidden" }}>
                              {/* Today line */}
                              {todayOff >= 0 && todayOff <= total && (
                                <div style={{ position:"absolute", left:`${todayOff/total*100}%`, top:0, bottom:0, width:1, background:"#E11D48", opacity:0.4, zIndex:3 }} />
                              )}
                              {/* Task bar background */}
                              <div style={{
                                position:"absolute",
                                left:`${barLeft}%`,
                                width:`${barWidth}%`,
                                top:3, height:14,
                                background: tc + "33",
                                border:`1px solid ${tc}66`,
                                borderRadius:4,
                                zIndex:1,
                                minWidth:4
                              }} />
                              {/* Progress fill */}
                              {hasRange && donePct > 0 && (
                                <div style={{
                                  position:"absolute",
                                  left:`${barLeft}%`,
                                  width:`${barWidth * donePct / 100}%`,
                                  top:3, height:14,
                                  background: tc,
                                  borderRadius:4,
                                  zIndex:2
                                }} />
                              )}
                              {/* If no range: diamond marker at due date */}
                              {!hasRange && (
                                <div style={{
                                  position:"absolute",
                                  left:`${pct(t.dueDate)}%`,
                                  top:4, width:12, height:12,
                                  background:tc,
                                  transform:"translateX(-50%) rotate(45deg)",
                                  zIndex:2,
                                  borderRadius:2
                                }} title={`${t.title}: ${fmt(t.dueDate)}`} />
                              )}
                              {/* Date label inside bar if wide enough */}
                              {hasRange && barWidth > 8 && (
                                <div style={{
                                  position:"absolute",
                                  left:`${barLeft}%`,
                                  width:`${barWidth}%`,
                                  top:3, height:14,
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  zIndex:3, pointerEvents:"none"
                                }}>
                                  <span style={{ fontSize:8, color: donePct>50?"#fff":tc, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden" }}>
                                    {fmt(t.startDate)}→{fmt(t.dueDate)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div style={{ width:56, fontSize:8, color: tdl ? "#E11D48" : "#94A3B8", paddingLeft:5, whiteSpace:"nowrap", textAlign:"right" }}>
                              {hasRange ? fmt(t.dueDate) : fmt(t.dueDate)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:"#94A3B8" }}>Bu milestone'da tarihli görev yok.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Today label */}
        {todayOff >= 0 && todayOff <= total && (
          <div style={{ position:"relative", height:14, marginLeft:labelW }}>
            <div style={{ position:"absolute", left:`${todayOff/total*100}%`, fontSize:9, color:"#E11D48", fontWeight:700, transform:"translateX(-50%)", whiteSpace:"nowrap" }}>▲ BUGÜN</div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display:"flex", gap:14, marginTop:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:24, height:8, borderRadius:3, border:`1.5px dashed ${project.color}`, background:project.color+"22" }} />
            <span style={{ fontSize:10, color:"#64748B" }}>Hedeflenen</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:24, height:8, borderRadius:3, background:project.color }} />
            <span style={{ fontSize:10, color:"#64748B" }}>Gerçekleşen</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:2, height:16, background:"#E11D48", borderRadius:2 }} />
            <span style={{ fontSize:10, color:"#64748B" }}>Bugün</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const safeFileName=(value)=>String(value||"rapor").replace(/[^a-zA-Z0-9_-]/g,"_");
const downloadTextFile=(content,fileName,type="text/plain;charset=utf-8")=>{
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
const allProjectTasks=(state)=>state.projects.flatMap(project=>project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({project,milestone,task}))));
const downloadXlsx=(rows,fileName,sheetName="Rapor")=>{
  const ws=XLSX.utils.aoa_to_sheet(rows);
  const widths=rows.reduce((acc,row)=>row.map((cell,i)=>Math.max(acc[i]||10,String(cell??"").length+2)),[]);
  ws["!cols"]=widths.map(w=>({wch:Math.min(w,45)}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,sheetName.slice(0,31));
  XLSX.writeFile(wb,fileName);
};

function downloadDelayReport(state,people){
  const rows=[["Proje","Milestone","Görev","Sorumlu","Durum","Öncelik","Termin","Gecikme Günü","Seviye","Bekleme Kaynağı"]];
  allProjectTasks(state).filter(({task})=>delayLvl(task.dueDate,task.status)).forEach(({project,milestone,task})=>{
    rows.push([project.name,milestone.name,task.title,people.find(p=>p.id===task.assignee)?.name||"Atanmamış",task.status,task.priority,task.dueDate,daysDiff(task.dueDate),delayLvl(task.dueDate,task.status)==="critical"?"Kritik":"Gecikmiş",task.waitSource||""]);
  });
  downloadXlsx(rows,`gecikme-raporu-${todayStr()}.xlsx`,"Gecikmeler");
}

function downloadEffortReport(state,people){
  const rows=[["Proje","Milestone","Görev","Sorumlu","Planlanan Saat","Gerçekleşen Saat","Fark","Kayıt Tarihi","Girişi Yapan","Açıklama"]];
  allProjectTasks(state).forEach(({project,milestone,task})=>{
    const entries=task.timeEntries||[];
    const actual=entries.reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
    if(!entries.length)rows.push([project.name,milestone.name,task.title,people.find(p=>p.id===task.assignee)?.name||"Atanmamış",task.estimatedHours||0,actual,actual-(parseFloat(task.estimatedHours)||0),"","",""]);
    entries.forEach(entry=>rows.push([project.name,milestone.name,task.title,people.find(p=>p.id===task.assignee)?.name||"Atanmamış",task.estimatedHours||0,actual,actual-(parseFloat(task.estimatedHours)||0),entry.date||"",entry.user||"",entry.note||""]));
  });
  downloadXlsx(rows,`efor-raporu-${todayStr()}.xlsx`,"Efor");
}

function downloadMachineReport(state){
  const rows=[["Proje","Makine Kodu","Makine Adı","Tip","Devreye Alındı","Devreye Alma Tarihi","Açıklama"]];
  state.projects.forEach(project=>(project.machines||[]).forEach(machine=>rows.push([project.name,machine.code||"",machine.name,machine.type==="virtual"?"Sanal":"Fiziksel",machine.commissioned?"Evet":"Hayır",machine.commissionedAt||"",machine.note||""])));
  downloadXlsx(rows,`makine-devreye-alma-${todayStr()}.xlsx`,"Makineler");
}

function generateSummaryReport(project,people,{customer=false}={}){
  const tasks=project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name})));
  const done=tasks.filter(t=>t.status==="Tamamlandı").length;
  const delayed=tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const machines=project.machines||[];
  const commissioned=machines.filter(m=>m.commissioned).length;
  const hours=tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const rows=tasks.map(t=>`<tr><td>${t.milestone}</td><td>${t.title}</td><td>${t.status}</td><td>${fmt(t.dueDate)}</td>${customer?"":`<td>${people.find(p=>p.id===t.assignee)?.name||"Atanmamış"}</td><td>${(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)} sa</td>`}</tr>`).join("");
  const machineRows=machines.map(m=>`<tr><td>${m.code||"-"}</td><td>${m.name}</td><td>${m.type==="virtual"?"Sanal":"Fiziksel"}</td><td>${m.commissioned?"Devrede":"Bekliyor"}</td><td>${m.commissioned?fmt(m.commissionedAt):(customer?"Planlanıyor":m.note||"-")}</td></tr>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${project.name} - ${customer?"Müşteri":"İç"} Rapor</title><style>body{font-family:Arial,sans-serif;color:#1e293b;padding:32px}h1{margin-bottom:4px}.meta{color:#64748b;margin-bottom:24px}.stats{display:flex;gap:12px;margin:20px 0}.stat{border:1px solid #e2e8f0;border-radius:10px;padding:14px 20px}.stat b{display:block;font-size:24px}table{width:100%;border-collapse:collapse;margin:12px 0 24px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f8fafc}button{float:right;padding:8px 14px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Yazdır / PDF</button><h1>${project.name}</h1><div class="meta">${customer?"Müşteri İlerleme Raporu":"İç Operasyon Raporu"} · ${new Date().toLocaleDateString("tr-TR")}</div><div class="stats"><div class="stat"><b>${tasks.length?Math.round(done/tasks.length*100):0}%</b>İlerleme</div><div class="stat"><b>${done}/${tasks.length}</b>Görev</div><div class="stat"><b>${commissioned}/${machines.length}</b>Makine</div><div class="stat"><b>${delayed.length}</b>Gecikme</div>${customer?"":`<div class="stat"><b>${hours}</b>Saat</div>`}</div><h2>Görev Durumu</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Termin</th>${customer?"":"<th>Sorumlu</th><th>Efor</th>"}</tr></thead><tbody>${rows}</tbody></table><h2>Makine Devreye Alma</h2><table><thead><tr><th>Kod</th><th>Makine</th><th>Tip</th><th>Durum</th><th>${customer?"Plan":"Açıklama"}</th></tr></thead><tbody>${machineRows||"<tr><td colspan='5'>Makine kaydı yok.</td></tr>"}</tbody></table>${!customer&&delayed.length?`<h2>Gecikmeler</h2><ul>${delayed.map(t=>`<li>${t.title} · ${daysDiff(t.dueDate)} gün · ${t.waitSource||"Neden belirtilmedi"}</li>`).join("")}</ul>`:""}</body></html>`;
  downloadTextFile(html,`${safeFileName(project.name)}-${customer?"musteri":"ic"}-rapor.html`,"text/html;charset=utf-8");
}

function generateVisualReport(project,people,{customer=false}={}){
  const tasks=project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name})));
  const count=(status)=>tasks.filter(t=>t.status===status).length;
  const done=count("Tamamlandı"), active=count("Devam Ediyor"), waiting=count("Bekliyor");
  const delayed=tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const machines=project.machines||[];
  const commissioned=machines.filter(m=>m.commissioned).length;
  const hours=tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const progress=tasks.length?Math.round(done/tasks.length*100):0;
  const taskRows=tasks.map(t=>`<tr><td>${t.milestone}</td><td><b>${t.title}</b></td><td><span class="pill ${t.status==="Tamamlandı"?"green":t.status==="Devam Ediyor"?"blue":"orange"}">${t.status}</span></td><td>${fmt(t.dueDate)}</td>${customer?"":`<td>${people.find(p=>p.id===t.assignee)?.name||"Atanmamış"}</td><td>${(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)} sa</td>`}</tr>`).join("");
  const machineRows=machines.map(m=>`<tr><td>${m.code||"-"}</td><td><b>${m.name}</b></td><td>${m.type==="virtual"?"Sanal":"Fiziksel"}</td><td><span class="pill ${m.commissioned?"green":"orange"}">${m.commissioned?"Devrede":"Bekliyor"}</span></td><td>${m.commissioned?fmt(m.commissionedAt):(customer?"Planlanıyor":m.note||"-")}</td></tr>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${project.name} Raporu</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:linear-gradient(135deg,#eef2ff,#f8fafc 55%,#f5f3ff);font-family:Inter,Segoe UI,Arial;color:#172033}.wrap{max-width:1180px;margin:auto}.hero{background:linear-gradient(125deg,#172554,#4338ca,#7c3aed);color:#fff;border-radius:24px;padding:30px;box-shadow:0 20px 45px #312e8130}.hero h1{margin:0 0 6px;font-size:29px}.hero p{margin:0;color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800;cursor:pointer}.overview{display:grid;grid-template-columns:1fr 2fr;gap:18px;margin:18px 0}.card{background:#fff;border-radius:18px;padding:21px;border:1px solid #e2e8f0;box-shadow:0 8px 24px #33415512}.donut{width:150px;height:150px;border-radius:50%;margin:auto;display:grid;place-items:center;background:conic-gradient(#4f46e5 0 ${progress}%,#e2e8f0 ${progress}% 100%)}.donut:after{content:"${progress}%";width:108px;height:108px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:27px;font-weight:900;color:#4338ca}.stats{display:grid;grid-template-columns:repeat(${customer?4:5},1fr);gap:10px}.stat{border-radius:14px;padding:16px;color:#fff;min-height:92px}.stat b{font-size:25px;display:block}.s1{background:linear-gradient(135deg,#2563eb,#4f46e5)}.s2{background:linear-gradient(135deg,#059669,#10b981)}.s3{background:linear-gradient(135deg,#dc2626,#f43f5e)}.s4{background:linear-gradient(135deg,#ea580c,#f59e0b)}.s5{background:linear-gradient(135deg,#7c3aed,#a855f7)}.bar{display:flex;height:13px;border-radius:8px;overflow:hidden;background:#e2e8f0;margin-top:18px}.legend{display:flex;gap:13px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#64748b}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}h2{font-size:17px;margin:0 0 14px}.table{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #eef2f7;font-size:12px}th{background:#f8fafc;color:#64748b}.pill{display:inline-block;border-radius:99px;padding:3px 8px;font-size:10px;font-weight:800}.pill.green{background:#d1fae5;color:#047857}.pill.blue{background:#dbeafe;color:#1d4ed8}.pill.orange{background:#ffedd5;color:#c2410c}@media(max-width:760px){body{padding:14px}.overview{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}.hero{padding:20px}}@media print{body{padding:0;background:#fff}.print{display:none}.hero,.card{box-shadow:none}}
</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>${project.name}</h1><p>${customer?"Müşteri İlerleme Raporu":"İç Operasyon Raporu"} · ${new Date().toLocaleDateString("tr-TR")} · ${fmt(project.startDate)} - ${fmt(project.endDate)}</p></div><div class="overview"><div class="card"><h2>Genel İlerleme</h2><div class="donut"></div><div class="bar"><span style="width:${tasks.length?done/tasks.length*100:0}%;background:#10b981"></span><span style="width:${tasks.length?active/tasks.length*100:0}%;background:#3b82f6"></span><span style="width:${tasks.length?waiting/tasks.length*100:0}%;background:#f59e0b"></span></div><div class="legend"><span><i class="dot" style="background:#10b981"></i>Tamamlandı ${done}</span><span><i class="dot" style="background:#3b82f6"></i>Devam ${active}</span><span><i class="dot" style="background:#f59e0b"></i>Bekliyor ${waiting}</span></div></div><div class="stats"><div class="stat s1"><b>${done}/${tasks.length}</b>Görev</div><div class="stat s2"><b>${commissioned}/${machines.length}</b>Makine</div><div class="stat s3"><b>${delayed.length}</b>Gecikme</div><div class="stat s4"><b>${project.milestones.length}</b>Milestone</div>${customer?"":`<div class="stat s5"><b>${hours}</b>Efor Saati</div>`}</div></div><div class="card"><h2>Görev Durumu</h2><div class="table"><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Termin</th>${customer?"":"<th>Sorumlu</th><th>Efor</th>"}</tr></thead><tbody>${taskRows||"<tr><td colspan='6'>Görev kaydı yok.</td></tr>"}</tbody></table></div></div><div class="card" style="margin-top:18px"><h2>Makine Devreye Alma</h2><div class="table"><table><thead><tr><th>Kod</th><th>Makine</th><th>Tip</th><th>Durum</th><th>${customer?"Plan":"Açıklama"}</th></tr></thead><tbody>${machineRows||"<tr><td colspan='5'>Makine kaydı yok.</td></tr>"}</tbody></table></div></div>${!customer&&delayed.length?`<div class="card" style="margin-top:18px;border-left:5px solid #ef4444"><h2 style="color:#dc2626">Gecikme Analizi</h2>${delayed.map(t=>`<div style="padding:8px 0;border-bottom:1px solid #fee2e2"><b>${t.title}</b><span style="float:right;color:#dc2626;font-weight:800">${daysDiff(t.dueDate)} gün</span><div style="font-size:11px;color:#64748b">${t.waitSource||"Neden belirtilmedi"}</div></div>`).join("")}</div>`:""}</div></body></html>`;
  downloadTextFile(html,`${safeFileName(project.name)}-${customer?"musteri":"ic"}-rapor.html`,"text/html;charset=utf-8");
}

function generatePortfolioReport(state,people){
  const data=state.projects.map(project=>{
    const tasks=project.milestones.flatMap(ms=>ms.tasks), done=tasks.filter(t=>t.status==="Tamamlandı").length;
    return {project,tasks,done,progress:tasks.length?Math.round(done/tasks.length*100):0,delayed:tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,hours:tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0),machines:project.machines||[]};
  });
  const totalTasks=data.reduce((a,r)=>a+r.tasks.length,0), totalDone=data.reduce((a,r)=>a+r.done,0), totalDelayed=data.reduce((a,r)=>a+r.delayed,0), totalHours=data.reduce((a,r)=>a+r.hours,0);
  const tableRows=data.map(r=>`<tr><td><b>${r.project.name}</b></td><td>${people.find(p=>p.id===r.project.pm)?.name||"Atanmamış"}</td><td>${r.project.status}</td><td><span class="track"><i style="width:${r.progress}%;background:${r.project.color}"></i></span><b>${r.progress}%</b></td><td>${r.done}/${r.tasks.length}</td><td class="${r.delayed?"danger":""}">${r.delayed}</td><td>${r.machines.filter(m=>m.commissioned).length}/${r.machines.length}</td><td>${r.hours} sa</td></tr>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Corject Genel Durum Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1250px;margin:auto}.hero{background:linear-gradient(120deg,#172554,#4338ca,#7c3aed);color:#fff;border-radius:24px;padding:30px;box-shadow:0 20px 45px #312e8130}.hero h1{margin:0}.hero p{color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat{padding:18px;border-radius:16px;color:#fff}.stat b{font-size:28px;display:block}.blue{background:linear-gradient(135deg,#2563eb,#4f46e5)}.green{background:linear-gradient(135deg,#059669,#10b981)}.red{background:linear-gradient(135deg,#dc2626,#f43f5e)}.purple{background:linear-gradient(135deg,#7c3aed,#a855f7)}.portfolio{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px}.project,.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:17px}.project h3{margin:0 0 10px}.ring,.track{display:inline-block;background:#e2e8f0;border-radius:8px;overflow:hidden}.ring{display:block;height:8px}.ring i,.track i{display:block;height:100%;border-radius:8px}.track{width:80px;height:7px;margin-right:7px}.card{box-shadow:0 8px 24px #33415510}.table{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #eef2f7;font-size:12px}th{background:#f8fafc;color:#64748b}.danger{color:#dc2626;font-weight:800}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:1fr 1fr}.hero{padding:20px}}@media print{body{padding:0;background:#fff}.print{display:none}.hero,.card{box-shadow:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Corject Genel Durum Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · ${state.projects.length} proje portföyü</p></div><div class="stats"><div class="stat blue"><b>${state.projects.length}</b>Toplam Proje</div><div class="stat green"><b>${totalDone}/${totalTasks}</b>Tamamlanan Görev</div><div class="stat red"><b>${totalDelayed}</b>Geciken Görev</div><div class="stat purple"><b>${totalHours}</b>Toplam Efor</div></div><div class="portfolio">${data.map(r=>`<div class="project" style="border-top:4px solid ${r.project.color}"><h3>${r.project.name}</h3><div class="ring"><i style="width:${r.progress}%;background:${r.project.color}"></i></div><div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#64748b"><span>${r.progress}% tamamlandı</span><span style="color:${r.delayed?"#dc2626":"#059669"}">${r.delayed} gecikme</span></div></div>`).join("")}</div><div class="card"><h2>Proje Karşılaştırması</h2><div class="table"><table><thead><tr><th>Proje</th><th>PM</th><th>Durum</th><th>İlerleme</th><th>Görev</th><th>Gecikme</th><th>Makine</th><th>Efor</th></tr></thead><tbody>${tableRows||"<tr><td colspan='8'>Proje yok.</td></tr>"}</tbody></table></div></div></div></body></html>`;
  downloadTextFile(html,`corject-genel-durum-${todayStr()}.html`,"text/html;charset=utf-8");
}

// ─── HTML Report ─────────────────────────────────────────────────────────────
function generateHTMLReport(project, people, logs) {
  const findName=(id)=>people.find(p=>p.id===id)?.name||"Atanmamış";
  const allTasks=project.milestones.flatMap(ms=>ms.tasks.map(t=>({...t,msName:ms.name,msDue:ms.dueDate})));
  const done=allTasks.filter(t=>t.status==="Tamamland\u0131");
  const active=allTasks.filter(t=>t.status==="Devam Ediyor");
  const waiting=allTasks.filter(t=>t.status==="Bekliyor");
  const delayed=allTasks.filter(t=>delayLvl(t.dueDate,t.status));
  const progress=allTasks.length?Math.round((done.length/allTasks.length)*100):0;
  const pm=people.find(p=>p.id===project.pm);
  const projLogs=logs.filter(l=>l.project===project.name).slice(0,10);

  const taskRows=(tasks)=>tasks.map(t=>{
    const dl=delayLvl(t.dueDate,t.status);
    const dlCell=dl==="critical"?`<span style="background:#FFF1F2;color:#E11D48;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">Kritik</span>`:dl==="normal"?`<span style="background:#FFF7ED;color:#EA6C00;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">Gecikti</span>`:"";
    const stColor=S[t.status]?.text||"#64748B";
    return `<tr><td>${t.msName}</td><td><strong>${t.title}</strong></td><td style="color:${stColor}">${t.status}</td><td>${t.priority}</td><td>${findName(t.assignee)}</td><td>${fmt(t.dueDate)}</td><td>${dlCell}</td></tr>`;
  }).join("");

  const logRows=projLogs.map(l=>{
    const meta=LOG_META[l.action]||LOG_META.general;
    return `<tr><td style="color:#64748B;font-size:12px">${new Date(l.ts).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"})}</td><td><span style="background:${meta.bg};color:${meta.color};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700">${meta.label}</span></td><td><strong>${l.user}</strong></td><td style="color:#64748B">${l.detail}</td></tr>`;
  }).join("");

  // Simple Gantt as HTML table
  const ms=project.milestones;
  const starts=ms.map(m=>m.startDate||project.startDate).filter(Boolean);
  const ends=ms.map(m=>m.dueDate).filter(Boolean);
  let ganttHTML="<p style=\"color:#94A3B8;font-size:12px\">Tarih bilgisi eksik.</p>";
  if(starts.length&&ends.length){
    const minDate=new Date(Math.min(...starts.map(d=>new Date(d))));
    const maxDate=new Date(Math.max(...ends.map(d=>new Date(d))));
    const total=Math.max(1,(maxDate-minDate)/86400000)+4;
    const pct=(d)=>Math.max(0,Math.min(100,((new Date(d)-minDate)/86400000)/total*100));
    const wPct=(s,e)=>Math.max(1,(new Date(e)-new Date(s))/86400000/total*100);
    const todayOff=Math.max(0,(new Date()-minDate)/86400000);
    const todayPct=Math.min(100,todayOff/total*100);
    const ganttRows=ms.map(m=>{
      const s=m.startDate||project.startDate,e=m.dueDate;
      if(!s||!e)return"";
      const dl=delayLvl(e,m.status);
      const barC=m.status==="Tamamland\u0131"?"#059669":dl==="critical"?"#E11D48":dl==="normal"?"#EA6C00":project.color;
      return `<div style="display:flex;align-items:center;margin-bottom:8px"><div style="width:140px;flex-shrink:0;font-size:11px;font-weight:600;padding-right:8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${m.name}</div><div style="flex:1;position:relative;height:22px;background:#F1F5FF;border-radius:4px"><div style="position:absolute;left:${pct(s)}%;width:${wPct(s,e)}%;top:2px;height:18px;background:${barC};border-radius:3px;display:flex;align-items:center;justify-content:center;min-width:16px"><span style="font-size:9px;color:#fff;padding:0 3px">${fmt(e)}</span></div><div style="position:absolute;left:${todayPct}%;top:0;bottom:0;width:2px;background:#E11D48;z-index:2"></div></div><div style="width:70px;text-align:right;padding-left:6px;font-size:10px;color:#94A3B8">${m.tasks.filter(t=>t.status==="Tamamland\u0131").length}/${m.tasks.length}</div></div>`;
    }).join("");
    ganttHTML=ganttRows;
  }

  const html=`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${project.name} - Yönetici Raporu</title>
<style>
body{font-family:Inter,Segoe UI,sans-serif;margin:0;padding:32px;color:#1E293B;background:#F8FAFC}
h1{font-size:24px;font-weight:800;margin:0 0 4px}
h2{font-size:16px;font-weight:700;margin:0 0 14px;padding-bottom:8px;border-bottom:2px solid #E2E8F0}
.meta{font-size:13px;color:#64748B;margin-bottom:24px}
.card{background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:20px;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stat{background:#fff;border-radius:10px;padding:14px;border:1px solid #E2E8F0;text-align:center}
.stat-num{font-size:26px;font-weight:800;margin:0}
.stat-lbl{font-size:11px;color:#64748B;margin-top:2px}
.prog{height:10px;background:#E2E8F0;border-radius:10px;overflow:hidden;margin:10px 0}
.prog-bar{height:100%;background:${project.color};border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#F8FAFC;padding:8px 10px;text-align:left;font-weight:600;color:#64748B;border-bottom:1px solid #E2E8F0}
td{padding:8px 10px;border-bottom:1px solid #F1F5FF}
tr:last-child td{border-bottom:none}
@media print{body{padding:16px;background:#fff}.card{box-shadow:none;border:1px solid #E2E8F0}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="float:right;background:#4A6CF7;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-weight:600;font-size:13px">Yazdır / PDF</button>
<h1>${project.name}</h1>
<div class="meta">Rapor tarihi: ${new Date().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})} &nbsp;|&nbsp; PM: ${pm?.name||"Atanmamış"} &nbsp;|&nbsp; ${fmt(project.startDate)} - ${fmt(project.endDate)}</div>

<div class="stats">
  <div class="stat"><div class="stat-num" style="color:#4A6CF7">${progress}%</div><div class="stat-lbl">İlerleme</div></div>
  <div class="stat"><div class="stat-num" style="color:#059669">${done.length}</div><div class="stat-lbl">Tamamlandı</div></div>
  <div class="stat"><div class="stat-num" style="color:#EA6C00">${active.length}</div><div class="stat-lbl">Devam Ediyor</div></div>
  <div class="stat"><div class="stat-num" style="color:#E11D48">${delayed.length}</div><div class="stat-lbl">Gecikmiş</div></div>
</div>

<div class="card">
  <h2>Proje Planı</h2>
  <div class="prog"><div class="prog-bar" style="width:${progress}%"></div></div>
  <div style="font-size:12px;color:#64748B;margin-bottom:16px">${done.length}/${allTasks.length} görev tamamlandı</div>
  ${ganttHTML}
  <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
    ${[[project.color,"Devam Ediyor"],["#059669","Tamamlandı"],["#EA6C00","Gecikmiş"],["#E11D48","Kritik"]].map(([c,l])=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:8px;border-radius:2px;background:${c}"></div><span style="font-size:11px;color:#64748B">${l}</span></div>`).join("")}
  </div>
</div>

${active.length>0?`<div class="card"><h2>Devam Eden Görevler (${active.length})</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th><th>Gecikme</th></tr></thead><tbody>${taskRows(active)}</tbody></table></div>`:""}

${delayed.length>0?`<div class="card" style="border-left:4px solid #E11D48"><h2 style="color:#E11D48">Gecikmiş / Kritik Görevler (${delayed.length})</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th><th>Gecikme</th></tr></thead><tbody>${taskRows(delayed)}</tbody></table></div>`:""}

${(()=>{
  const timeByPerson={};
  let grandTotal=0;
  allTasks.forEach(t=>(t.timeEntries||[]).forEach(e=>{
    const h=parseFloat(e.hours)||0;
    timeByPerson[e.user]=(timeByPerson[e.user]||0)+h;
    grandTotal+=h;
  }));
  if(grandTotal===0)return"";
  const personRows=Object.entries(timeByPerson).sort((a,b)=>b[1]-a[1]).map(([name,h])=>`<tr><td><strong>${name}</strong></td><td>${h} saat</td><td>${Math.round(h/grandTotal*100)}%</td></tr>`).join("");
  const taskRows2=allTasks.filter(t=>(t.timeEntries||[]).length>0).map(t=>{
    const th=(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
    return `<tr><td>${t.msName}</td><td><strong>${t.title}</strong></td><td>${findName(t.assignee)}</td><td>${th} saat</td></tr>`;
  }).join("");
  return `<div class="card"><h2>Harcanan Süre Raporu (Toplam: ${grandTotal} saat)</h2>
    <table style="margin-bottom:16px"><thead><tr><th>Kisi</th><th>Toplam Saat</th><th>Oran</th></tr></thead><tbody>${personRows}</tbody></table>
    <table><thead><tr><th>Milestone</th><th>Görev</th><th>Sorumlu</th><th>Sure</th></tr></thead><tbody>${taskRows2}</tbody></table></div>`;
})()}

<div class="card"><h2>Tamamlanan Görevler (${done.length})</h2><table><thead><tr><th>Milestone</th><th>Görev</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Termin</th><th></th></tr></thead><tbody>${taskRows(done)}</tbody></table></div>

${projLogs.length>0?`<div class="card"><h2>Son Aktiviteler</h2><table><thead><tr><th>Tarih</th><th>Tip</th><th>Kullanici</th><th>Detay</th></tr></thead><tbody>${logRows}</tbody></table></div>`:""}

</body></html>`;
  const uri = "data:text/html;charset=utf-8," + encodeURIComponent(html);
  const a = document.createElement("a");
  a.href = uri;
  a.download = project.name.replace(/[^a-zA-Z0-9]/g,"_") + "-rapor.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, people, projectColor, onCheck, onEdit, onDelete, onTime, showProject, projectName, canEdit }) {
  const assignee=people.find(p=>p.id===task.assignee);
  const dl=delayLvl(task.dueDate,task.status);
  return <div style={{ background:"#fff", borderRadius:10, padding:"11px 15px", border:`1.5px solid ${dl==="critical"?"#FCA5A5":dl==="normal"?"#FED7AA":"#E2E8F0"}`, display:"flex", alignItems:"flex-start", gap:11, boxShadow:"0 1px 3px rgba(0,0,0,0.04)", opacity:task.status==="Tamamland\u0131"?0.75:1 }}>
    {canEdit?<input type="checkbox" checked={task.status==="Tamamland\u0131"} onChange={e=>onCheck&&onCheck(e.target.checked)} style={{ marginTop:3, width:15, height:15, cursor:"pointer", accentColor:"#4A6CF7" }} />:<span style={{ marginTop:3, width:15, height:15, flexShrink:0, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>{task.status==="Tamamland\u0131"?"✓":"○"}</span>}
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        <span style={{ fontWeight:600, fontSize:13, textDecoration:task.status==="Tamamland\u0131"?"line-through":"none", color:task.status==="Tamamland\u0131"?"#94A3B8":"#1E293B" }}>{task.title}</span>
        <Badge label={task.status} />
        <span style={{ fontSize:11, fontWeight:700, color:PCOL[task.priority] }}>+{task.priority}</span>
        <DelayBadge dateStr={task.dueDate} status={task.status} />
      </div>
      <div style={{ display:"flex", gap:10, marginTop:5, alignItems:"center", flexWrap:"wrap" }}>
        {assignee&&<div style={{ display:"flex", alignItems:"center", gap:4 }}><Avatar initials={assignee.avatar} size={17} color={projectColor||"#4A6CF7"} /><span style={{ fontSize:11, color:"#64748B" }}>{assignee.name}</span></div>}
        {task.startDate&&<span style={{ fontSize:11, color:"#94A3B8" }}>Başl: {fmt(task.startDate)}</span>}
        {task.dueDate&&<span style={{ fontSize:11, color:dl?"#E11D48":"#94A3B8" }}>{task.startDate?"Bit:":"Termin:"} {fmt(task.dueDate)}</span>}
        {(task.timeEntries||[]).length>0&&<span style={{ fontSize:11, color:"#7C3AED", fontWeight:600, background:"#F5F3FF", borderRadius:6, padding:"1px 6px" }}>{(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)} saat</span>}
        {task.estimatedHours&&<span style={{ fontSize:11, color:"#0369A1", fontWeight:600, background:"#F0F9FF", borderRadius:6, padding:"1px 6px" }}>Plan: {task.estimatedHours} sa</span>}
        {task.waitSource&&<span style={{ fontSize:11, color:"#EA6C00", fontWeight:600 }}>Bekliyor: {task.waitSource}</span>}
        {task.link&&(()=>{const jm=String(task.link).match(/([A-Z][A-Z0-9]+-[0-9]+)/);return <a href={task.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:11, color:"#0052CC", background:"#DEEBFF", borderRadius:6, padding:"1px 7px", fontWeight:700, textDecoration:"none" }}>{jm?jm[1]:"Jira"}</a>;})()}
        {showProject&&projectName&&<span style={{ fontSize:11, color:"#4A6CF7", background:"#F1F5FF", borderRadius:6, padding:"1px 6px" }}>{projectName}</span>}
        {task.notes&&<span style={{ fontSize:11, color:"#94A3B8", fontStyle:"italic" }}>"{task.notes}"</span>}
      </div>
    </div>
    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
      {onTime&&<Btn small variant="ghost" onClick={onTime} style={{ color:"#7C3AED" }}>Efor</Btn>}
      {canEdit&&onEdit&&<Btn small variant="ghost" onClick={onEdit} style={{ display:"inline-flex", alignItems:"center", padding:"5px 7px" }}><Icon name="edit" size={15}/></Btn>}
      {canEdit&&onDelete&&<Btn small variant="danger" onClick={onDelete}>x</Btn>}
    </div>
  </div>;
}

// ─── Risk Panel ──────────────────────────────────────────────────────────────
function RiskPanel({ risks, onAdd, onUpdate, onDelete, canEdit }) {
  const RL={ "Düşük":{bg:"#ECFDF5",text:"#059669"}, "Orta":{bg:"#FFF7ED",text:"#EA6C00"}, "Yüksek":{bg:"#FFF1F2",text:"#E11D48"} };
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
          <span style={{ background:RL[r.level]?.bg||"#F1F5FF", color:RL[r.level]?.text||"#4A6CF7", borderRadius:12, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{r.level}</span>
          <span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:12, padding:"2px 8px", fontSize:11 }}>{r.status}</span>
        </div>
        {r.note&&<div style={{ fontSize:11, color:"#64748B", marginTop:3 }}>{r.note}</div>}
      </div>
      {canEdit&&<div style={{ display:"flex", gap:4 }}>
        <select value={r.status} onChange={e=>onUpdate(r.id,{status:e.target.value})} style={{ fontSize:11, borderRadius:6, border:"1px solid #E2E8F0", padding:"3px 6px" }}>
          {["Açık","İzleniyor","Kapalı"].map(x=><option key={x}>{x}</option>)}
        </select>
        <Btn small variant="danger" onClick={()=>onDelete(r.id)}>x</Btn>
      </div>}
    </div>)}
  </div>;
}

// ─── Person Detail Modal ─────────────────────────────────────────────────────
function PersonDetailModal({ person, projects, personalTasks, onClose }) {
  const [showDone,setShowDone]=useState(false);
  const projTasks=projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===person.id).map(t=>({...t,projectName:proj.name,projectColor:proj.color,msName:ms.name}))));
  const pTasks=(personalTasks||[]).filter(t=>t.assignee===person.id);
  const all=[...projTasks,...pTasks];
  const active=all.filter(t=>t.status!=="Tamamland\u0131");
  const done=all.filter(t=>t.status==="Tamamland\u0131");
  const delayed=all.filter(t=>delayLvl(t.dueDate,t.status)==="normal").length;
  const critical=all.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length;
  const Stat=({label,count,color})=><div style={{ background:color+"15", border:`1.5px solid ${color}30`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}><div style={{ fontSize:22, fontWeight:800, color }}>{count}</div><div style={{ fontSize:10, color:"#64748B", marginTop:1 }}>{label}</div></div>;
  const Row=({t})=>{const dl=delayLvl(t.dueDate,t.status);return <div style={{ background:"#F8FAFC", borderRadius:8, padding:"9px 13px", border:"1.5px solid #E2E8F0", display:"flex", gap:9, alignItems:"center", marginBottom:5 }}>
    {t.projectColor&&<span style={{ width:7, height:7, borderRadius:"50%", background:t.projectColor, flexShrink:0 }} />}
    <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, textDecoration:t.status==="Tamamland\u0131"?"line-through":"none", color:t.status==="Tamamland\u0131"?"#94A3B8":"#1E293B" }}>{t.title}</div><div style={{ fontSize:10, color:"#94A3B8" }}>{t.projectName||"Genel"}{t.msName?` — ${t.msName}`:""}</div></div>
    <Badge label={t.status} />{dl&&<DelayBadge dateStr={t.dueDate} status={t.status} />}<span style={{ fontSize:11, color:"#94A3B8" }}>{fmt(t.dueDate)}</span>
  </div>;};
  return <Modal title={`${person.name} Detay`} onClose={onClose} wide>
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
      <Avatar initials={person.avatar} size={44} color={person.isAdmin?"#E11D48":"#4A6CF7"} />
      <div><div style={{ fontWeight:800, fontSize:15 }}>{person.name}</div><div style={{ color:"#64748B", fontSize:12 }}>{person.role}</div></div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:18 }}>
      <Stat label="Aktif" count={active.filter(t=>t.status==="Devam Ediyor").length} color="#4A6CF7" />
      <Stat label="Beklemede" count={active.filter(t=>t.status==="Bekliyor").length} color="#94A3B8" />
      <Stat label="Gecikmiş" count={delayed} color="#EA6C00" />
      <Stat label="Kritik" count={critical} color="#E11D48" />
    </div>
    {active.length>0&&<div style={{ marginBottom:14 }}><div style={{ fontWeight:700, fontSize:11, color:"#64748B", marginBottom:7, textTransform:"uppercase", letterSpacing:1 }}>Aktif ({active.length})</div>{active.map(t=><Row key={t.id} t={t} />)}</div>}
    {done.length>0&&<div>
      <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, padding:"0 0 7px", display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({done.length})</button>
      {showDone&&done.map(t=><Row key={t.id} t={t} />)}
    </div>}
    {all.length===0&&<div style={{ textAlign:"center", color:"#94A3B8", padding:20 }}>Görev atanmamis.</div>}
  </Modal>;
}

// ─── My Tasks + Notes ────────────────────────────────────────────────────────
function MyTasksPage({ currentUser, state, setState, addLog, isAdmin }) {
  const [showDone,setShowDone]=useState(false);
  const [section,setSection]=useState("tasks");
  const [modal,setModal]=useState(null);
  const [noteText,setNoteText]=useState((state.userNotes||{})[currentUser.id]?.notes||"");
  const [newTodo,setNewTodo]=useState("");
  const [todoProject,setTodoProject]=useState("");
  const [todoReminder,setTodoReminder]=useState("");
  const todos=((state.userNotes||{})[currentUser.id]?.todos)||[];

  const updateNotes=(v)=>{ setNoteText(v); setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],notes:v}}})); };
  const addTodo=()=>{ if(!newTodo.trim())return; const t={id:uid(),text:newTodo,done:false,projectId:todoProject,reminderDays:parseInt(todoReminder)||0,createdAt:now()}; setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:[...todos,t]}}})); setNewTodo(""); setTodoProject(""); setTodoReminder(""); };
  const toggleTodo=(id)=>setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:todos.map(t=>t.id===id?{...t,done:!t.done}:t)}}}));
  const deleteTodo=(id)=>setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:todos.filter(t=>t.id!==id)}}}));

  const pt=state.personalTasks||[];
  const myP=pt.filter(t=>t.assignee===currentUser.id);
  const myProjT=state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===currentUser.id).map(t=>({...t,projectName:proj.name,projectColor:proj.color,msName:ms.name,projId:proj.id,msId:ms.id}))));
  const allMy=[...myP.map(t=>({...t,source:"personal"})),...myProjT.map(t=>({...t,source:"project"}))];
  const active=allMy.filter(t=>t.status!=="Tamamland\u0131");
  const completed=allMy.filter(t=>t.status==="Tamamland\u0131");
  const overdue=active.filter(t=>delayLvl(t.dueDate,t.status));

  const updatePersonal=(id,data)=>setState(s=>{const old=(s.personalTasks||[]).find(t=>t.id===id);const upd={...s,personalTasks:(s.personalTasks||[]).map(t=>t.id===id?{...t,...data}:t)};if(data.status&&old?.status!==data.status)addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} → ${data.status}`);return upd;});
  const updateProjTask=(pId,mId,tId,data)=>setState(s=>{const old=s.projects.find(p=>p.id===pId)?.milestones.find(m=>m.id===mId)?.tasks.find(t=>t.id===tId);const upd={...s,projects:s.projects.map(p=>p.id!==pId?p:{...p,milestones:p.milestones.map(m=>m.id!==mId?m:{...m,tasks:m.tasks.map(t=>t.id!==tId?t:{...t,...data})})})};if(data.status&&old?.status!==data.status)addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} → ${data.status}`);return upd;});
  const addPersonal=(data)=>{const t={id:uid(),...data,assignee:data.assignee||currentUser.id,createdBy:currentUser.id};setState(s=>({...s,personalTasks:[...(s.personalTasks||[]),t]}));addLog(currentUser.name,"task_add",t.title);};
  const deletePersonal=(id)=>{const t=(state.personalTasks||[]).find(x=>x.id===id);setState(s=>({...s,personalTasks:(s.personalTasks||[]).filter(x=>x.id!==id)}));addLog(currentUser.name,"task_delete",t?.title||"");};

  return <div style={{ padding:"0 0 24px", flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
    <div style={{ padding:"20px clamp(14px, 4vw, 28px) 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="tasks" size={20}/>Görevlerim</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{active.length} aktif · {completed.length} tamamlandı</p></div>
        <Btn onClick={()=>setModal({type:"addPersonal"})}>+ Görev Ekle</Btn>
      </div>
      {overdue.length>0&&<div style={{ background:"#FFF1F2", border:"1.5px solid #FCA5A5", borderRadius:12, padding:"12px 16px", margin:"12px 0" }}>
        <div style={{ fontWeight:700, fontSize:12, color:"#E11D48", marginBottom:6 }}>Gecikmiş: {overdue.length}</div>
        {overdue.map(t=><div key={t.id} style={{ fontSize:12, color:"#1E293B", display:"flex", gap:8, marginBottom:3 }}><DelayBadge dateStr={t.dueDate} status={t.status} /><span>{t.title}</span><span style={{ color:"#94A3B8" }}>— {fmt(t.dueDate)}</span></div>)}
      </div>}
      <div style={{display:"flex",gap:6,overflowX:"auto",margin:"14px 0 4px"}}>
        {[["tasks","tasks","Görevler"],["notes","notes","Notlarım"],["todos","ticket","To-Do"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:"none",borderRadius:9,padding:"8px 13px",background:section===id?"#4A6CF7":"#F1F5FF",color:section===id?"#fff":"#64748B",fontWeight:700,fontSize:12,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",cursor:"pointer"}}><Icon name={icon} size={14}/>{label}</button>)}
      </div>
    </div>

    <div style={{ flex:1, overflow:"auto" }}>
      {/* Tasks column */}
      {section==="tasks"&&<div style={{ padding:"12px clamp(14px, 4vw, 28px)" }}>
        {active.length>0&&<div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Aktif ({active.length})</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {active.map(t=><TaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel Görev"} canEdit
              onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
              onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
              onTime={()=>setModal({type:"time",data:t})}
            />)}
          </div>
        </div>}
        {completed.length>0&&<div>
          <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8, padding:0, display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({completed.length})</button>
          {showDone&&<div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {completed.map(t=><TaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel"} canEdit
              onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
              onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
              onTime={()=>setModal({type:"time",data:t})}
            />)}
          </div>}
        </div>}
        {isAdmin&&<div style={{ marginTop:24, borderTop:"1.5px solid #E2E8F0", paddingTop:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Tüm Genel Görevler (Yönetici)</div>
          {(state.personalTasks||[]).length===0&&<div style={{ color:"#94A3B8", fontSize:12 }}>Genel görev yok.</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {(state.personalTasks||[]).map(t=><TaskCard key={t.id} task={t} people={state.people} projectColor={null} showProject canEdit
              onCheck={(c)=>updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"})}
              onEdit={()=>setModal({type:"editPersonal",data:t})}
              onDelete={()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}}
              onTime={()=>setModal({type:"time",data:{...t,source:"personal"}})}
            />)}
          </div>
        </div>}
      </div>}

      {/* Notes & Todo sidebar */}
      {section==="notes"&&<div style={{padding:"16px clamp(14px, 4vw, 28px)"}}><div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:16}}><div style={{fontWeight:800,fontSize:14,marginBottom:9}}>Notlarım</div><textarea value={noteText} onChange={e=>updateNotes(e.target.value)} placeholder="Serbest notlar, hatırlatmalar..." style={{width:"100%",minHeight:260,padding:12,borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.6}}/></div></div>}
      {section==="todos"&&<div style={{padding:"16px clamp(14px, 4vw, 28px)"}}><div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:16,maxWidth:720}}>
          <div style={{fontWeight:800,fontSize:14,marginBottom:12}}>To-Do {todos.filter(t=>!t.done).length>0?`(${todos.filter(t=>!t.done).length})`:""}</div>
            <div style={{ marginBottom:8 }}>
              <input value={newTodo} onChange={e=>setNewTodo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()} placeholder="Yeni madde ekle..." style={{ ...iStyle, width:"100%", padding:"8px 10px", fontSize:13, boxSizing:"border-box" }} />
            </div>
            <div style={{ display:"flex", gap:5, marginBottom:8 }}>
              <select value={todoProject} onChange={e=>setTodoProject(e.target.value)} style={{ ...iStyle, flex:1, padding:"6px 8px", fontSize:11 }}>
                <option value="">Proje bagla (opsiyonel)</option>
                {state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:5, marginBottom:12, alignItems:"center" }}>
              <input type="number" min="0" value={todoReminder} onChange={e=>setTodoReminder(e.target.value)} placeholder="Gun" style={{ ...iStyle, width:64, padding:"6px 8px", fontSize:11 }} title="Hatirlatma (gun sonra)" />
              <span style={{ fontSize:10, color:"#94A3B8", flex:1 }}>gun sonra hatirlat</span>
              <Btn small onClick={addTodo}>Ekle</Btn>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {todos.length===0&&<div style={{ fontSize:12, color:"#94A3B8" }}>Bos. Enter ile ekleyin.</div>}
              {todos.map(t=>{
                const proj=t.projectId?state.projects.find(p=>p.id===t.projectId):null;
                return <div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"9px 11px", background:"#fff", borderRadius:8, border:"1.5px solid #E2E8F0" }}>
                  <input type="checkbox" checked={t.done} onChange={()=>toggleTodo(t.id)} style={{ cursor:"pointer", accentColor:"#4A6CF7", marginTop:2 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, textDecoration:t.done?"line-through":"none", color:t.done?"#94A3B8":"#1E293B", lineHeight:1.4, wordBreak:"break-word" }}>{t.text}</div>
                    <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
                      {proj&&<span style={{ background:proj.color+"22", color:proj.color, borderRadius:6, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{proj.name}</span>}
                      {t.reminderDays>0&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:6, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{t.reminderDays} gun sonra hatirlat</span>}
                    </div>
                  </div>
                  <button onClick={()=>deleteTodo(t.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:14, padding:0, flexShrink:0 }}>x</button>
                </div>;
              })}
            </div>
        </div></div>}
    </div>

    {modal?.type==="addPersonal"&&<PersonalTaskModal title="Genel Görev Ekle" people={state.people} isAdmin={isAdmin} currentUser={currentUser} onClose={()=>setModal(null)} onSave={addPersonal} />}
    {modal?.type==="editPersonal"&&<PersonalTaskModal title="Görevi Düzenle" initial={modal.data} people={state.people} isAdmin={isAdmin} currentUser={currentUser} onClose={()=>setModal(null)} onSave={(d)=>{updatePersonal(modal.data.id,d);setModal(null);}} />}
    {modal?.type==="time"&&<TimeLogModal task={modal.data} currentUser={currentUser} onClose={()=>setModal(null)} onSave={(entries)=>{const t=modal.data;if(t.source==="personal")updatePersonal(t.id,{timeEntries:entries});else updateProjTask(t.projId,t.msId,t.id,{timeEntries:entries});}} />}
  </div>;
}

// ─── Log Page ────────────────────────────────────────────────────────────────
function LogPage({ logs, projects }) {
  const [filter,setFilter]=useState("all");
  const projNames=[...new Set(logs.map(l=>l.project).filter(Boolean))];
  const filtered=filter==="all"?logs:logs.filter(l=>l.project===filter);
  const grouped={};
  filtered.forEach(l=>{
    const day=l.ts.slice(0,10);
    if(!grouped[day])grouped[day]=[];
    grouped[day].push(l);
  });
  const days=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  return <div style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Aktivite Günlüğü</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{filtered.length} kayıt</p></div>
      <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ ...iStyle, width:"auto", minWidth:160 }}>
        <option value="all">Tum Projeler</option>
        {projNames.map(n=><option key={n} value={n}>{n}</option>)}
      </select>
    </div>
    {days.length===0&&<div style={{ textAlign:"center", padding:40, color:"#94A3B8" }}>Kayıt yok.</div>}
    {days.map(day=><div key={day} style={{ marginBottom:24 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
        <span>{new Date(day).toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}</span>
        <div style={{ flex:1, height:1, background:"#E2E8F0" }} />
        <span>{grouped[day].length} işlem</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {grouped[day].map(l=>{
          const meta=LOG_META[l.action]||LOG_META.general;
          return <div key={l.id} style={{ background:"#fff", borderRadius:12, padding:"12px 16px", border:"1.5px solid #E2E8F0", display:"flex", gap:12, alignItems:"flex-start", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:meta.bg, border:`1.5px solid ${meta.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, color:meta.color, fontWeight:700 }}>{meta.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                <span style={{ background:meta.bg, color:meta.color, borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{meta.label}</span>
                {l.project&&<span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{l.project}</span>}
                {l.milestone&&<span style={{ background:"#F5F3FF", color:"#7C3AED", borderRadius:8, padding:"2px 8px", fontSize:11 }}>{l.milestone}</span>}
              </div>
              <div style={{ fontSize:13, color:"#1E293B" }}><strong>{l.user}</strong> {l.detail}</div>
            </div>
            <div style={{ fontSize:11, color:"#94A3B8", flexShrink:0, paddingTop:2 }}>{new Date(l.ts).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>;
        })}
      </div>
    </div>)}
  </div>;
}

// ─── Milestone Task Panel ────────────────────────────────────────────────────
function MilestoneTaskPanel({ milestone, project, people, isAdmin, showDone, setShowDone, onEdit, onDelete, onAddTask, onEditTask, onDeleteTask, onCheckTask, onTimeTask }) {
  const active=milestone.tasks.filter(t=>t.status!=="Tamamland\u0131");
  const done=milestone.tasks.filter(t=>t.status==="Tamamland\u0131");
  return <div>
    <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:13, flexWrap:"wrap" }}>
      <h3 style={{ margin:0, fontSize:15, fontWeight:800 }}>{milestone.name}</h3>
      <Badge label={milestone.status} /><DelayBadge dateStr={milestone.dueDate} status={milestone.status} />
      {milestone.waitSource&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Bekliyor: {milestone.waitSource}</span>}
      <div style={{ marginLeft:"auto", display:"flex", gap:5 }}>
        {isAdmin&&<><Btn small variant="secondary" onClick={()=>onEdit(milestone)}>Duzenle</Btn><Btn small variant="danger" onClick={()=>onDelete(milestone.id)}>Sil</Btn><Btn small onClick={()=>onAddTask(milestone.id)}>+ Görev</Btn></>}
      </div>
    </div>
    {active.length===0&&done.length===0&&<div style={{ textAlign:"center", padding:"28px", color:"#94A3B8", fontSize:12 }}>Görev yok.</div>}
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {active.map(task=><TaskCard key={task.id} task={task} people={people} projectColor={project.color} canEdit={isAdmin}
        onCheck={(c)=>onCheckTask(milestone.id,task.id,c)}
        onEdit={isAdmin?()=>onEditTask(milestone.id,task):null}
        onDelete={isAdmin?()=>onDeleteTask(milestone.id,task.id):null}
        onTime={()=>onTimeTask(milestone.id,task)}
      />)}
    </div>
    {done.length>0&&<div style={{ marginTop:12 }}>
      <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, padding:"0 0 7px", display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({done.length})</button>
      {showDone&&<div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {done.map(task=><TaskCard key={task.id} task={task} people={people} projectColor={project.color} canEdit={isAdmin}
          onCheck={(c)=>onCheckTask(milestone.id,task.id,c)}
          onEdit={isAdmin?()=>onEditTask(milestone.id,task):null}
          onDelete={isAdmin?()=>onDeleteTask(milestone.id,task.id):null}
          onTime={()=>onTimeTask(milestone.id,task)}
        />)}
      </div>}
    </div>}
  </div>;
}

// ─── Main App ────────────────────────────────────────────────────────────────

// ─── Project Notes Panel ───────────────────────────────────────────────────
function ProjectNotesPanel({ project, currentUser, state, setState, isAdmin }) {
  const [section,setSection]=useState("notes");
  // Shared project notes (admin can edit, others view)
  const projNotes = (state.projectNotes||{})[project.id] || { shared:"", items:[] };
  const [editNote, setEditNote] = useState(projNotes.shared);
  const [newItem, setNewItem] = useState("");

  const save = (data) => setState(s=>({...s, projectNotes:{...(s.projectNotes||{}), [project.id]:{...projNotes,...data}}}));
  const addItem = () => { if(!newItem.trim())return; save({ items:[...projNotes.items, {id:uid(),text:newItem,done:false,author:currentUser.name,ts:now()}]}); setNewItem(""); };
  const toggleItem = (id) => save({ items:projNotes.items.map(x=>x.id===id?{...x,done:!x.done}:x) });
  const deleteItem = (id) => save({ items:projNotes.items.filter(x=>x.id!==id) });

  // User todos linked to this project
  const linkedTodos = state.people.flatMap(p=>{
    const todos=((state.userNotes||{})[p.id]?.todos)||[];
    return todos.filter(t=>t.projectId===project.id).map(t=>({...t, personName:p.name, personAvatar:p.avatar, personIsAdmin:p.isAdmin}));
  });

  return <div style={{ flex:1, overflow:"auto", padding:"clamp(14px, 3vw, 24px)" }}>
    <div style={{display:"flex",gap:7,marginBottom:16}}>
      {[["notes","notes","Notlar"],["todos","ticket","To-Do"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:"none",borderRadius:9,padding:"8px 14px",background:section===id?project.color:"#F1F5FF",color:section===id?"#fff":"#64748B",fontWeight:700,fontSize:12,display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}}><Icon name={icon} size={14}/>{label}</button>)}
    </div>
    <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
    {/* Left: shared notes */}
    <div style={{ flex:"1 1 340px", minWidth:280 }}>
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>{section==="notes"?"Proje Notları":"Proje To-Do"}</div>

      {section==="notes"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:8, color:"#1E293B" }}>Paylaşılan Notlar</div>
        {isAdmin
          ? <textarea value={editNote} onChange={e=>{setEditNote(e.target.value);save({shared:e.target.value});}} placeholder="Proje genelinde paylaşılacak not, karar, önemli bilgi..." style={{ width:"100%", minHeight:120, padding:"9px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:12, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", background:"#FAFBFC", outline:"none", lineHeight:1.6 }} />
          : <div style={{ minHeight:80, fontSize:12, color: projNotes.shared?"#1E293B":"#94A3B8", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{projNotes.shared||"Henüz not girilmemiş."}</div>
        }
      </div>}

      {section==="todos"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#1E293B" }}>Proje To-Do</div>
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Yeni madde..." style={{ ...iStyle, flex:1, padding:"7px 10px", fontSize:12 }} />
          <Btn small onClick={addItem}>+</Btn>
        </div>
        {projNotes.items.length===0&&<div style={{ fontSize:12, color:"#94A3B8" }}>Madde yok.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {projNotes.items.map(item=><div key={item.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 11px", background:"#F8FAFC", borderRadius:8, border:"1.5px solid #E2E8F0" }}>
            <input type="checkbox" checked={item.done} onChange={()=>toggleItem(item.id)} style={{ cursor:"pointer", accentColor:"#4A6CF7", marginTop:2 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, textDecoration:item.done?"line-through":"none", color:item.done?"#94A3B8":"#1E293B" }}>{item.text}</div>
              <div style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>{item.author} · {new Date(item.ts).toLocaleDateString("tr-TR")}</div>
            </div>
            <button onClick={()=>deleteItem(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:14, padding:0 }}>x</button>
          </div>)}
        </div>
      </div>}
    </div>

    {/* Right: user todos linked to this project */}
    <div style={{ flex:"1 1 300px", minWidth:0 }}>
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>{section==="notes"?"Ekip Notları":"Kişisel To-Do Bağlantıları"}</div>
      {section==="todos"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#64748B" }}>Bu projeye bağlı todo ları</div>
        {linkedTodos.length===0&&<div style={{ fontSize:12, color:"#94A3B8" }}>Henüz bağlı kişisel todo yok.<br/>Görevlerim sayfasından todo eklerken proje seçin.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {linkedTodos.map(t=><div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 11px", background:"#F8FAFC", borderRadius:8, border:"1.5px solid #E2E8F0" }}>
            <Avatar initials={t.personAvatar} size={22} color={t.personIsAdmin?"#E11D48":"#4A6CF7"} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, textDecoration:t.done?"line-through":"none", color:t.done?"#94A3B8":"#1E293B" }}>{t.text}</div>
              <div style={{ fontSize:10, color:"#94A3B8", marginTop:1 }}>{t.personName}</div>
            </div>
            {t.done&&<span style={{ fontSize:11, color:"#059669" }}>✓</span>}
          </div>)}
        </div>
      </div>}

      {/* Person notes (if admin) */}
      {section==="notes"&&isAdmin&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#64748B" }}>Ekip Serbest Notları</div>
        {state.people.map(p=>{
          const note=((state.userNotes||{})[p.id]?.notes)||"";
          if(!note) return null;
          return <div key={p.id} style={{ marginBottom:10, paddingBottom:10, borderBottom:"1px solid #F1F5FF" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
              <Avatar initials={p.avatar} size={18} color={p.isAdmin?"#E11D48":"#4A6CF7"} />
              <span style={{ fontSize:11, fontWeight:700 }}>{p.name}</span>
            </div>
            <div style={{ fontSize:11, color:"#64748B", whiteSpace:"pre-wrap", lineHeight:1.5 }}>{note}</div>
          </div>;
        })}
        {state.people.every(p=>!((state.userNotes||{})[p.id]?.notes))&&<div style={{ fontSize:12, color:"#94A3B8" }}>Ekip notu yok.</div>}
      </div>}
    </div>
    </div>
  </div>;
}

function MachinePanel({ project, canEdit, onChange }) {
  const machines=project.machines||[];
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({name:"",code:"",type:"physical",commissioned:false,commissionedAt:"",note:""});
  const commissioned=machines.filter(m=>m.commissioned).length;
  const save=()=>{
    if(!form.name.trim())return;
    onChange([...machines,{...form,id:uid(),name:form.name.trim(),code:form.code.trim(),commissionedAt:form.commissioned?(form.commissionedAt||todayStr()):""}]);
    setForm({name:"",code:"",type:"physical",commissioned:false,commissionedAt:"",note:""});
    setShowForm(false);
  };
  const update=(id,data)=>onChange(machines.map(m=>m.id===id?{...m,...data}:m));
  return <div style={{flex:1,overflow:"auto",padding:"clamp(14px, 3vw, 24px)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <div><h3 style={{margin:0,fontSize:16,display:"flex",alignItems:"center",gap:7}}><Icon name="machines" size={18}/>Makine Devreye Alma</h3><div style={{fontSize:12,color:"#64748B",marginTop:3}}>{commissioned}/{machines.length} makine devrede</div></div>
      {canEdit&&<Btn onClick={()=>setShowForm(v=>!v)}>{showForm?"Formu Kapat":"+ Makine Ekle"}</Btn>}
    </div>
    <div style={{height:8,background:"#E2E8F0",borderRadius:8,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:`${machines.length?commissioned/machines.length*100:0}%`,background:"#059669"}} /></div>
    {showForm&&<div style={{background:"#fff",border:"1.5px solid #DCE6F2",borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Makine Adı *"><input style={iStyle} value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} /></Field><Field label="Kod / Hat No"><input style={iStyle} value={form.code} onChange={e=>setForm(s=>({...s,code:e.target.value}))} /></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Makine Tipi"><select style={iStyle} value={form.type} onChange={e=>setForm(s=>({...s,type:e.target.value}))}><option value="physical">Fiziksel</option><option value="virtual">Sanal</option></select></Field><Field label="Devreye Alma Tarihi"><input type="date" style={iStyle} value={form.commissionedAt} onChange={e=>setForm(s=>({...s,commissionedAt:e.target.value}))} /></Field></div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:13}}><input type="checkbox" checked={form.commissioned} onChange={e=>setForm(s=>({...s,commissioned:e.target.checked}))} /> Devreye alındı</label>
      <Field label="Devreye Alınamama Açıklaması / Not"><textarea style={{...iStyle,height:70,resize:"vertical"}} value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))} /></Field>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={save}>Makineyi Kaydet</Btn></div>
    </div>}
    {!machines.length&&<div style={{padding:40,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Henüz makine eklenmedi.</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(240px,100%),1fr))",gap:10}}>
      {machines.map(machine=><div key={machine.id} style={{background:"#fff",borderRadius:12,padding:14,border:`1.5px solid ${machine.commissioned?"#A7F3D0":"#FED7AA"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:13}}>{machine.name}</div><div style={{fontSize:11,color:"#64748B",marginTop:2}}>{machine.code||"Kod yok"} · {machine.type==="virtual"?"Sanal":"Fiziksel"}</div></div><span style={{background:machine.commissioned?"#ECFDF5":"#FFF7ED",color:machine.commissioned?"#059669":"#EA6C00",padding:"3px 8px",borderRadius:8,fontSize:10,fontWeight:800}}>{machine.commissioned?"DEVREDE":"BEKLİYOR"}</span></div>
        {machine.commissionedAt&&<div style={{fontSize:11,color:"#64748B",marginTop:9}}>Devreye alma: {fmt(machine.commissionedAt)}</div>}
        {!machine.commissioned&&<textarea disabled={!canEdit} value={machine.note||""} onChange={e=>update(machine.id,{note:e.target.value})} placeholder="Neden devreye alınamadı?" style={{...iStyle,height:58,resize:"vertical",marginTop:9,fontSize:11}} />}
        {canEdit&&<div style={{display:"flex",justifyContent:"space-between",marginTop:10,gap:6}}><Btn small variant={machine.commissioned?"warning":"success"} onClick={()=>update(machine.id,{commissioned:!machine.commissioned,commissionedAt:!machine.commissioned?todayStr():""})}>{machine.commissioned?"Devreden Çıkar":"Devreye Al"}</Btn><Btn small variant="danger" onClick={()=>onChange(machines.filter(m=>m.id!==machine.id))}>Sil</Btn></div>}
      </div>)}
    </div>
  </div>;
}

function ReportsPage({ state, people, isAdmin }) {
  const [projectId,setProjectId]=useState(state.projects[0]?.id||"");
  const project=state.projects.find(p=>p.id===projectId);
  const tasks=allProjectTasks(state);
  const delayed=tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const hours=tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const machines=state.projects.flatMap(p=>p.machines||[]);
  const cards=[
    {title:"Gecikme Raporu",desc:"Geciken görevler, gecikme günleri, sorumlu ve bekleme nedeni.",color:"#E11D48",action:()=>downloadDelayReport(state,people),label:"XLSX İndir"},
    {title:"Efor Raporu",desc:"Planlanan ve gerçekleşen saatler; kişi, görev ve tarih kırılımı.",color:"#7C3AED",action:()=>downloadEffortReport(state,people),label:"XLSX İndir"},
    {title:"Makine Devreye Alma",desc:"Fiziksel/sanal makineler, devre durumu ve devreye alınamama açıklamaları.",color:"#059669",action:()=>downloadMachineReport(state),label:"XLSX İndir"},
    {title:"İç Operasyon Raporu",desc:"Grafikler, efor, gecikme, sorumlu, görev ve makine detaylarını içeren yönetim raporu.",color:"#0369A1",action:()=>project&&generateVisualReport(project,people),label:"HTML / PDF"},
    {title:"Müşteri İlerleme Raporu",desc:"Renkli ilerleme grafikleri, teslim tarihleri ve makine durumunu sade müşteri görünümünde sunar.",color:"#EA6C00",action:()=>project&&generateVisualReport(project,people,{customer:true}),label:"HTML / PDF"},
    ...(isAdmin?[{title:"Genel Durum Raporu",desc:"Tüm projeleri ilerleme, gecikme, makine ve efor göstergeleriyle karşılaştırır.",color:"#4338CA",action:()=>generatePortfolioReport(state,people),label:"HTML / PDF"}]:[]),
  ];
  return <div style={{padding:"clamp(16px, 4vw, 28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:20,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:21,display:"flex",alignItems:"center",gap:8}}><Icon name="reports" size={21}/>Raporlar</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>İç operasyon ve müşteri paylaşımı için güncel proje çıktıları.</p></div><div style={{minWidth:"min(240px,100%)",flex:"0 1 280px"}}><label style={lStyle}>Rapor Projesi</label><select style={iStyle} value={projectId} onChange={e=>setProjectId(e.target.value)}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10,marginBottom:20}}>{[["Geciken Görev",delayed.length,"#E11D48"],["Toplam Efor",`${hours} sa`,"#7C3AED"],["Makine",machines.length,"#0369A1"],["Devrede",machines.filter(m=>m.commissioned).length,"#059669"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:14}}><div style={{fontSize:11,color:"#64748B"}}>{label}</div><div style={{fontSize:24,fontWeight:800,color,marginTop:3}}>{value}</div></div>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>{cards.map(card=><div key={card.title} style={{background:"#fff",borderRadius:14,padding:18,border:"1.5px solid #E2E8F0",borderTop:`4px solid ${card.color}`,boxShadow:"0 2px 6px rgba(0,0,0,.04)"}}><div style={{fontWeight:800,fontSize:14,marginBottom:6}}>{card.title}</div><div style={{fontSize:12,color:"#64748B",lineHeight:1.5,minHeight:54}}>{card.desc}</div><Btn style={{marginTop:12,background:card.color}} disabled={!project&&card.title.includes("Raporu")} onClick={card.action}>{card.label}</Btn></div>)}</div>
  </div>;
}

// Global style reset
const GlobalStyle = () => (
  <style>{`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; margin: 0; padding: 0; }
    body { font-family: Inter, Segoe UI, sans-serif; background: #0F172A; }
    input, select, textarea, button { font-family: inherit; }
  `}</style>
);

export default function App() {
  const [state,setState]=useState(load);
  const [view,setView]=useState("projects");
  const [selProject,setSelProject]=useState(null);
  const [selMilestone,setSelMilestone]=useState(null);
  const [projectTab,setProjectTab]=useState("tasks");
  const [modal,setModal]=useState(null);
  const [showDoneTasks,setShowDoneTasks]=useState(false);
  const [dataLoaded,setDataLoaded]=useState(false);
  const [syncStatus,setSyncStatus]=useState({ s:"idle", msg:"" });
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<768);
  const fileRef=useRef();
  const skipNextSave=useRef(true);

  // Mobil algilama
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  // Ilk yukleme: Supabase'den veri cek
  useEffect(()=>{
    // Once localStorage'dan kullanici kimligini geri yukle
    try{
      const savedUid=localStorage.getItem("corject_uid");
      if(savedUid) setState(s=>({...s,currentUserId:savedUid}));
    }catch(e){}
    (async()=>{
      const remote=await loadFromSupabase();
      if(remote){
        skipNextSave.current=true;
        // currentUserId'yi localStorage'dan koru, Supabase'den geleni kullanma
        let savedUid="";
        try{ savedUid=localStorage.getItem("corject_uid")||""; }catch(e){}
        setState(s=>({ ...remote, currentUserId:savedUid||s.currentUserId }));
      } else {
        saveToSupabase(state, (s,msg)=>setSyncStatus({s,msg:msg||""}));
      }
      setDataLoaded(true);
    })();
  },[]);

  // Degisiklikleri Supabase'e kaydet (ilk yuklemede atla)
  useEffect(()=>{
    if(!dataLoaded) return;
    if(skipNextSave.current){ skipNextSave.current=false; return; }
    saveToSupabase(state, (s,msg)=>setSyncStatus({s,msg:msg||""}));
  },[state, dataLoaded]);

  // Periyodik senkronizasyon: 30 sn'de bir baskalarinin degisikliklerini cek
  useEffect(()=>{
    if(!dataLoaded) return;
    const interval=setInterval(async()=>{
      const remote=await loadFromSupabase();
      if(remote){
        skipNextSave.current=true;
        let savedUid="";
        try{ savedUid=localStorage.getItem("corject_uid")||""; }catch(e){}
        setState(s=>({ ...remote, currentUserId:savedUid||s.currentUserId }));
      }
    }, 30000);
    return ()=>clearInterval(interval);
  },[dataLoaded]);

  const currentUser=state.people.find(p=>p.id===state.currentUserId);
  const isAdmin=currentUser?.isAdmin||false;

  const addLog=(user,action,detail,project,milestone)=>{
    setState(s=>({...s,logs:[{id:uid(),ts:now(),user,userId:s.currentUserId,action,detail,project:project||"",milestone:milestone||""},...s.logs]}));
  };
  const addNotification=(userId,msg,projectName)=>{
    setState(s=>({...s,notifications:[{id:uid(),ts:now(),userId,msg,projectName,read:false},...(s.notifications||[])]}));
  };
  const markAllRead=()=>setState(s=>({...s,notifications:(s.notifications||[]).map(n=>n.userId===currentUser?.id?{...n,read:true}:n)}));
  const login=(id)=>{ setState(s=>({...s,currentUserId:id})); try{localStorage.setItem("corject_uid",id);}catch(e){} };
  const logout=()=>{ setState(s=>({...s,currentUserId:null})); try{localStorage.removeItem("corject_uid");}catch(e){} setView("projects"); setSelProject(null); };

  if(!dataLoaded) return <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,sans-serif", background:"#1E293B", color:"#94A3B8", flexDirection:"column", gap:12 }}>
    <div style={{ fontSize:14, fontWeight:800, color:"#4A6CF7", letterSpacing:3 }}>CORJECT</div>
    <div style={{ fontSize:13 }}>Veriler yükleniyor...</div>
  </div>;
  if(!currentUser) return <LoginScreen people={state.people} onLogin={login} />;

  // Project visibility filter
  const visibleProjects=isAdmin?state.projects:state.projects.filter(p=>{
    if(p.pm===currentUser.id)return true;
    if((p.members||[]).includes(currentUser.id))return true;
    return p.milestones.some(ms=>ms.tasks.some(t=>t.assignee===currentUser.id));
  });

  const project=state.projects.find(p=>p.id===selProject);
  const milestone=project?.milestones.find(m=>m.id===selMilestone);
  const currentMs=project?.milestones.find(m=>m.status!=="Tamamland\u0131");
  const activePM=project?state.people.find(p=>p.id===project.pm):null;
  const mutProject=(fn)=>setState(s=>({...s,projects:s.projects.map(p=>p.id===selProject?fn(p):p)}));

  const addProject=(data)=>{ const p={id:uid(),milestones:[],risks:[],machines:[],members:[],...data}; setState(s=>({...s,projects:[...s.projects,p]})); addLog(currentUser.name,"project_create",`${p.name} projesi oluşturuldu`,p.name); };
  const addPerson=(data)=>{
    const avatar=data.name.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase();
    setState(s=>({...s,people:[...s.people,{id:uid(),avatar,...data}]}));
    addLog(currentUser.name,"general",`Ekip üyesi eklendi: ${data.name}`);
  };
  const updatePerson=(id,data)=>{
    const avatar=data.name.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase();
    setState(s=>({...s,people:s.people.map(person=>person.id===id?{...person,...data,avatar}:person)}));
    addLog(currentUser.name,"general",`Ekip üyesi güncellendi: ${data.name}`);
  };
  const deletePerson=(id)=>setState(s=>({...s,
    people:s.people.filter(person=>person.id!==id),
    projects:s.projects.map(p=>({...p,pm:p.pm===id?"":p.pm,members:(p.members||[]).filter(memberId=>memberId!==id),milestones:p.milestones.map(ms=>({...ms,tasks:ms.tasks.map(t=>t.assignee===id?{...t,assignee:""}:t)}))})),
    personalTasks:(s.personalTasks||[]).map(t=>t.assignee===id?{...t,assignee:""}:t)
  }));
  const updateProject=(data)=>{ mutProject(p=>({...p,...data})); addLog(currentUser.name,"general","Proje güncellendi",data.name||project?.name); };
  const deleteProject=(id)=>{ const name=state.projects.find(p=>p.id===id)?.name; setState(s=>({...s,projects:s.projects.filter(p=>p.id!==id)})); setSelProject(null); setSelMilestone(null); addLog(currentUser.name,"general","Proje silindi: "+name); };
  const addRisk=(data)=>{ mutProject(p=>({...p,risks:[...(p.risks||[]),{id:uid(),...data}]})); addLog(currentUser.name,"risk_add",data.title,project?.name); };
  const updateRisk=(rId,data)=>mutProject(p=>({...p,risks:(p.risks||[]).map(r=>r.id===rId?{...r,...data}:r)}));
  const deleteRisk=(rId)=>mutProject(p=>({...p,risks:(p.risks||[]).filter(r=>r.id!==rId)}));
  const addMilestone=(data)=>{ const ms={id:uid(),tasks:[],waitSource:"",...data}; mutProject(p=>({...p,milestones:[...p.milestones,ms]})); addLog(currentUser.name,"milestone_add",ms.name,project?.name); };
  const updateMilestone=(msId,data)=>{ const old=project?.milestones.find(m=>m.id===msId); mutProject(p=>({...p,milestones:p.milestones.map(m=>m.id===msId?{...m,...data}:m)})); if(data.status&&old?.status!==data.status)addLog(currentUser.name,"status_change",`${old?.name}: ${old?.status} → ${data.status}`,project?.name); else addLog(currentUser.name,"general","Milestone güncellendi: "+(data.name||old?.name),project?.name); };
  const deleteMilestone=(msId)=>{ mutProject(p=>({...p,milestones:p.milestones.filter(m=>m.id!==msId)})); setSelMilestone(null); addLog(currentUser.name,"general","Milestone silindi",project?.name); };
  const addTask=(msId,data)=>{
    const task={id:uid(),waitSource:"",...data};
    mutProject(p=>({...p,milestones:p.milestones.map(m=>m.id===msId?{...m,tasks:[...m.tasks,task]}:m)}));
    addLog(currentUser.name,"task_add",task.title,project?.name,project?.milestones.find(m=>m.id===msId)?.name);
    if(task.assignee&&task.assignee!==currentUser.id){
      addNotification(task.assignee,`"${task.title}" görevi size atandı`,project?.name);
    }
  };
  const updateTask=(msId,taskId,data)=>{
    const old=project?.milestones.find(m=>m.id===msId)?.tasks.find(t=>t.id===taskId);
    mutProject(p=>{
      const newMs=p.milestones.map(m=>{
        if(m.id!==msId)return m;
        const newTasks=m.tasks.map(t=>t.id===taskId?{...t,...data}:t);
        const allDone=newTasks.length>0&&newTasks.every(t=>t.status==="Tamamlandı");
        return {...m,tasks:newTasks,...(allDone&&m.status!=="Tamamlandı"?{status:"Tamamlandı",actualEnd:new Date().toISOString().slice(0,10)}:{})};
      });
      return {...p,milestones:newMs};
    });
    if(data.status&&old?.status!==data.status){
      if(data.status==="Tamamlandı")addLog(currentUser.name,"task_done",`${old?.title} tamamlandı`,project?.name,project?.milestones.find(m=>m.id===msId)?.name);
      else addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} → ${data.status}`,project?.name,project?.milestones.find(m=>m.id===msId)?.name);
    } else addLog(currentUser.name,"general","Görev güncellendi: "+(data.title||old?.title),project?.name);
  };
  const deleteTask=(msId,taskId)=>mutProject(p=>({...p,milestones:p.milestones.map(ms=>ms.id===msId?{...ms,tasks:ms.tasks.filter(task=>task.id!==taskId)}:ms)}));

  const excelDateToStr=(v)=>{
    if(!v&&v!==0)return "";
    if(typeof v==="number"){
      // Excel serial date
      const d=new Date(Math.round((v-25569)*86400*1000));
      return isNaN(d)?"":d.toISOString().slice(0,10);
    }
    const s=String(v).trim();
    if(!s)return "";
    // Already ISO: 2026-07-01
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    // DD.MM.YYYY
    const dm=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(dm)return `${dm[3]}-${dm[2].padStart(2,"0")}-${dm[1].padStart(2,"0")}`;
    // DD/MM/YYYY or MM/DD/YYYY - assume DD/MM if day<=12 ambiguous, try parse
    const sl=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(sl){
      const d=new Date(`${sl[3]}-${sl[2].padStart(2,"0")}-${sl[1].padStart(2,"0")}`);
      if(!isNaN(d))return d.toISOString().slice(0,10);
    }
    // Try generic parse
    const gd=new Date(s);
    return isNaN(gd)?"":gd.toISOString().slice(0,10);
  };

  const parseRows=(rows)=>{
    if(!rows||rows.length<2)return null;
    const startRow=String(rows[0][0]||"").toLowerCase().includes("milestone")?1:0;
    const mm={};
    for(let i=startRow;i<rows.length;i++){
      const c=(rows[i]||[]).map(x=>typeof x==="string"?x.trim():x);
      if(!c[0])continue;
      const n=String(c[0]);
      // cols: 0=ms_name,1=ms_start,2=ms_due,3=ms_status,4=ms_wait,
      //       5=task_title,6=task_start,7=task_status,8=priority,9=assignee,
      //       10=task_due,11=task_wait,12=notes,13=tags,14=link
      if(!mm[n])mm[n]={id:uid(),name:n,startDate:excelDateToStr(c[1]),dueDate:excelDateToStr(c[2]),status:STATUSES.includes(String(c[3]||""))?String(c[3]):"Bekliyor",waitSource:String(c[4]||""),tasks:[]};
      if(c[5])mm[n].tasks.push({
        id:uid(),
        title:String(c[5]),
        startDate:excelDateToStr(c[6]),
        status:STATUSES.includes(String(c[7]||""))?String(c[7]):"Bekliyor",
        priority:PRIORITIES.includes(String(c[8]||""))?String(c[8]):"Orta",
        assignee:state.people.find(person=>person.id===String(c[9]||"")||person.name.trim().toLocaleLowerCase("tr-TR")===String(c[9]||"").trim().toLocaleLowerCase("tr-TR"))?.id||"",
        dueDate:excelDateToStr(c[10]),
        waitSource:String(c[11]||""),
        notes:String(c[12]||""),
        tags:String(c[13]||""),
        link:String(c[14]||""),
        timeEntries:[]
      });
    }
    // Recalculate milestone dates from task dates
    Object.values(mm).forEach(ms=>{
      const taskDues=ms.tasks.map(t=>t.dueDate).filter(Boolean);
      const taskStarts=ms.tasks.map(t=>t.startDate||t.dueDate).filter(Boolean);
      if(taskDues.length>0){
        ms.dueDate=taskDues.reduce((a,b)=>new Date(a)>new Date(b)?a:b);
      }
      if(taskStarts.length>0){
        ms.startDate=taskStarts.reduce((a,b)=>new Date(a)<new Date(b)?a:b);
      }
    });
    return Object.values(mm);
  };

  const downloadTemplate=()=>{
    const rows=[
      ["Milestone Adı","Başlangıç (YYYY-AA-GG)","Termin (YYYY-AA-GG)","Milestone Durumu","Bekleme Kaynağı",
       "Görev Adı","Görev Başlangıç","Görev Durumu","Öncelik","Sorumlu","Görev Termin","Görev Bekleme","Notlar","Etiketler","Bağlantı"],
      ["Kapsam ve Fizibilite","2026-07-01","2026-07-21","Bekliyor","",
       "Süreç analizi","2026-07-01","Bekliyor","Yüksek","Hakan","2026-07-10","","Akış diyagramı","analiz",""],
      ["Kapsam ve Fizibilite","2026-07-01","2026-07-21","Bekliyor","",
       "ROI hesaplama","2026-07-08","Bekliyor","Orta","Ayşe K.","2026-07-15","","","analiz",""],
      ["Altyapı Hazırlık","2026-07-21","2026-08-18","Bekliyor","",
       "Sunucu kurulumu","2026-07-21","Bekliyor","Yüksek","Ayşe K.","2026-07-28","","","altyapı",""],
      ["Altyapı Hazırlık","2026-07-21","2026-08-18","Bekliyor","Tedarikçi",
       "OPC-UA altyapı","2026-07-28","Bekliyor","Yüksek","Ayşe K.","2026-08-10","Teknik","Port 4840","altyapı",""],
      ["Makine Entegrasyonu","2026-08-18","2026-09-22","Bekliyor","",
       "CNC bağlantı","2026-08-18","Bekliyor","Yüksek","Hakan","2026-09-01","","","makine",""],
      ["Test ve Validasyon","2026-09-22","2026-10-13","Bekliyor","",
       "Fonksiyonel testler","2026-09-22","Bekliyor","Yüksek","Hakan","2026-10-01","","","test",""],
      ["Canlıya Alış","2026-10-13","2026-10-27","Bekliyor","",
       "Operatör eğitimi","2026-10-13","Bekliyor","Orta","Hakan","2026-10-20","","","eğitim",""]
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=[{wch:22},{wch:18},{wch:18},{wch:16},{wch:16},{wch:26},{wch:16},{wch:14},{wch:10},{wch:16},{wch:14},{wch:14},{wch:24},{wch:14},{wch:20}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Proje Plani");
    XLSX.writeFile(wb,"proje-plani-sablonu.xlsx");
  };

  const handleImport=(e)=>{
    const file=e.target.files[0]; if(!file)return;
    const isXlsx=file.name.toLowerCase().endsWith(".xlsx")||file.name.toLowerCase().endsWith(".xls");
    const reader=new FileReader();
    reader.onload=(ev)=>{
      let ms=null;
      if(isXlsx){
        try{
          const wb=XLSX.read(ev.target.result,{type:"array"});
          const sheet=wb.Sheets[wb.SheetNames[0]];
          const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:""});
          ms=parseRows(rows);
        }catch(err){ alert("Excel okunamadı: "+err.message); return; }
      } else {
        const text=ev.target.result;
        const rows=text.split("\n").filter(l=>l.trim()).map(line=>{
          const cols=[];let cur="",inQ=false;
          for(const ch of line){if(ch==='"'){inQ=!inQ;}else if(ch===","&&!inQ){cols.push(cur.trim());cur="";}else cur+=ch;}
          cols.push(cur.trim());return cols;
        });
        ms=parseRows(rows);
      }
      if(!ms||!ms.length){alert("Dosyada veri bulunamadı.");return;}
      mutProject(p=>{
        const updated=p.milestones.map(existing=>{
          const match=ms.find(m=>m.name.trim().toLowerCase()===existing.name.trim().toLowerCase());
          if(!match)return existing;
          // Merge: update dates/status, merge tasks (add new ones, update existing by title)
          const mergedTasks=existing.tasks.map(et=>{
            const mt=match.tasks.find(t=>t.title.trim().toLowerCase()===et.title.trim().toLowerCase());
            if(!mt)return et;
            return {...et,...Object.fromEntries(Object.entries(mt).filter(([key,value])=>key==="id"||value!==""&&value!=null)),id:et.id};
          });
          const newTasks=match.tasks.filter(mt=>!existing.tasks.some(et=>et.title.trim().toLowerCase()===mt.title.trim().toLowerCase()));
          return {...existing,startDate:match.startDate||existing.startDate,dueDate:match.dueDate||existing.dueDate,status:match.status||existing.status,waitSource:match.waitSource||existing.waitSource,tasks:[...mergedTasks,...newTasks]};
        });
        const newMs=ms.filter(m=>!p.milestones.some(e=>e.name.trim().toLowerCase()===m.name.trim().toLowerCase()));
        return {...p,milestones:[...updated,...newMs]};
      });
      addLog(currentUser.name,"import",`${ms.length} milestone aktarıldı`,project?.name);
      alert(`${ms.length} milestone aktarıldı.`);
    };
    if(isXlsx) reader.readAsArrayBuffer(file); else reader.readAsText(file,"UTF-8");
    e.target.value="";
  };

  const totalT=project?.milestones.reduce((a,m)=>a+m.tasks.length,0)||0;
  const doneT=project?.milestones.reduce((a,m)=>a+m.tasks.filter(t=>t.status==="Tamamland\u0131").length,0)||0;
  const progress=totalT?Math.round((doneT/totalT)*100):0;
  const overdueC=project?.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,0)||0;
  const criticalC=project?.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length,0)||0;

  const nav=[{id:"projects",icon:"projects",label:"Projeler"},{id:"mytasks",icon:"tasks",label:"Görevlerim"},{id:"reports",icon:"reports",label:"Raporlar"},{id:"people",icon:"people",label:"Ekip"},{id:"logs",icon:"activity",label:"Aktivite"}];

  return <><GlobalStyle /><div style={{ display:"flex", height:"100vh", width:"100vw", fontFamily:"Inter,Segoe UI,sans-serif", background:"#F8FAFC", color:"#1E293B", overflow:"hidden", position:"relative" }}>
    {/* Mobil ust bar */}
    {isMobile&&<div style={{ position:"fixed", top:0, left:0, right:0, height:50, background:"#1E293B", display:"flex", alignItems:"center", padding:"0 14px", zIndex:900, gap:10 }}>
      <button onClick={()=>setMobileMenuOpen(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", padding:4 }}>☰</button>
      <img src={corjectLogo} alt="" style={{width:27,height:27,objectFit:"contain"}}/><span style={{ fontSize:13, fontWeight:800, color:"#4A6CF7", letterSpacing:2 }}>CORJECT</span>
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
        <button title="Görevlerime git" onClick={()=>{setView("mytasks");setSelProject(null);}} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}><Avatar initials={currentUser.avatar} size={28} color={isAdmin?"#E11D48":"#4A6CF7"} /></button>
      </div>
    </div>}
    {/* Mobil overlay arka plan */}
    {isMobile&&mobileMenuOpen&&<div onClick={()=>setMobileMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:950 }} />}
    {/* Sidebar */}
    <div style={{ width:220, background:"#1E293B", display:"flex", flexDirection:"column", flexShrink:0,
      ...(isMobile?{ position:"fixed", top:0, left:mobileMenuOpen?0:-240, bottom:0, zIndex:960, transition:"left .25s ease", boxShadow:mobileMenuOpen?"4px 0 20px rgba(0,0,0,0.3)":"none" }:{}) }}>
      <div style={{ padding:"18px 16px 12px", borderBottom:"1px solid #334155" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex",alignItems:"center",gap:7 }}><img src={corjectLogo} alt="" style={{width:26,height:26,objectFit:"contain"}}/><span style={{ fontSize:11, fontWeight:800, color:"#4A6CF7", letterSpacing:2, textTransform:"uppercase" }}>CORJECT</span></div>
            <button onClick={()=>{ setView("notifications"); setSelProject(null); setMobileMenuOpen(false); markAllRead(); }} style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:4 }}>
              <span style={{ color:"#94A3B8", display:"flex" }}><Icon name="bell" size={17} /></span>
              {(state.notifications||[]).filter(n=>n.userId===currentUser?.id&&!n.read).length>0&&<span style={{ position:"absolute", top:0, right:0, width:8, height:8, background:"#E11D48", borderRadius:"50%" }} />}
            </button>
          </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
          <button title="Görevlerime git" onClick={()=>{setView("mytasks");setSelProject(null);setMobileMenuOpen(false);}} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}><Avatar initials={currentUser.avatar} size={28} color={isAdmin?"#E11D48":"#4A6CF7"} /></button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{currentUser.name}</div>
            <div style={{ fontSize:10, color:"#64748B" }}>{isAdmin?"Yönetici":currentUser.role}</div>
          </div>
          <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:12, padding:2 }}>Çıkış</button>
        </div>
      </div>
      <nav style={{ padding:"8px 7px", flex:1, overflowY:"auto" }}>
        {nav.map(n=><button key={n.id} onClick={()=>{ setView(n.id); setSelProject(null); setSelMilestone(null); setMobileMenuOpen(false); }}
          style={{ display:"flex", alignItems:"center", gap:9, width:"100%", padding:"9px 10px", borderRadius:8, border:"none", cursor:"pointer", background:view===n.id&&!selProject?"#4A6CF7":"transparent", color:view===n.id&&!selProject?"#fff":"#94A3B8", fontSize:13, fontWeight:600, textAlign:"left", marginBottom:2 }}>
          <span style={{ display:"flex", flexShrink:0 }}><Icon name={n.icon} size={15} /></span> {n.label}
        </button>)}
        {visibleProjects.length>0&&<div style={{ marginTop:12 }}>
          <div style={{ fontSize:9, fontWeight:700, color:"#475569", letterSpacing:1.5, textTransform:"uppercase", padding:"0 10px", marginBottom:4 }}>PROJELER</div>
          {visibleProjects.map(p=><button key={p.id} onClick={()=>{ setSelProject(p.id); setSelMilestone(null); setView("projects"); setProjectTab("tasks"); setMobileMenuOpen(false); }}
            style={{ display:"flex", alignItems:"center", gap:7, width:"100%", padding:"7px 10px", borderRadius:8, border:"none", cursor:"pointer", background:selProject===p.id?p.color+"33":"transparent", color:selProject===p.id?"#fff":"#94A3B8", fontSize:11, fontWeight:600, textAlign:"left", marginBottom:1 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:p.color, flexShrink:0 }} />
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
          </button>)}
        </div>}
      </nav>
      <div style={{ padding:"8px 12px", borderTop:"1px solid #334155", fontSize:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background: syncStatus.s==="saved"?"#059669": syncStatus.s==="saving"?"#EA6C00": syncStatus.s==="error"?"#E11D48":"#475569" }} />
          <span style={{ color: syncStatus.s==="error"?"#FCA5A5":"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={syncStatus.msg}>
            {syncStatus.s==="saved"?"Kaydedildi": syncStatus.s==="saving"?"Kaydediliyor...": syncStatus.s==="error"?("HATA: "+syncStatus.msg.slice(0,40)):"Hazir"}
          </span>
        </div>
        <div style={{ color:"#475569", marginTop:5, letterSpacing:.5 }}>CORJECT {APP_VERSION}</div>
      </div>
      {isAdmin&&<div style={{ padding:"10px 7px", borderTop:"1px solid #334155" }}>
        <Btn onClick={()=>setModal({type:"addProject"})} style={{ width:"100%", justifyContent:"center" }}>+ Yeni Proje</Btn>
      </div>}
    </div>

    {/* Main */}
    <div style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column", paddingTop:isMobile?50:0 }}>

      {/* PROJECT DETAIL */}
      {selProject&&project&&<div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ background:"#fff", borderBottom:"1px solid #E2E8F0", padding:"13px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{ width:11, height:11, borderRadius:"50%", background:project.color }} />
            <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"#1E293B", background:"#fff", borderRadius:6, padding:"2px 4px" }}>{project.name}</h2>
            <Badge label={project.status} />
            {overdueC>0&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Gecikmiş: {overdueC}</span>}
            {criticalC>0&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Kritik: {criticalC}</span>}
            <div style={{ marginLeft:"auto", display:"flex", gap:7, flexWrap:"wrap" }}>
              {isAdmin&&<><Btn small variant="secondary" onClick={()=>setModal({type:"editProject",data:project})}>Duzenle</Btn><Btn small variant="danger" onClick={()=>{if(confirm("Projeyi sil?"))deleteProject(project.id);}}>Sil</Btn></>}
              {isAdmin&&<Btn small variant="success" onClick={()=>generateHTMLReport(project,state.people,state.logs)}>HTML Rapor</Btn>}
            </div>
          </div>
          <div style={{ display:"flex", gap:16, fontSize:12, color:"#64748B", flexWrap:"wrap", alignItems:"center" }}>
            {activePM&&<span>PM: <b>{activePM.name}</b></span>}
            <span>{fmt(project.startDate)} - {fmt(project.endDate)}</span>
            <span>{doneT}/{totalT} görev</span>
            {currentMs&&<span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"2px 9px", fontWeight:600 }}>Aktif: {currentMs.name} ({fmt(currentMs.dueDate)})</span>}
          </div>
          {totalT>0&&<div style={{ display:"flex", alignItems:"center", gap:9, marginTop:7 }}>
            <div style={{ flex:1, height:5, background:"#E2E8F0", borderRadius:10 }}><div style={{ width:`${progress}%`, height:"100%", background:project.color, borderRadius:10 }} /></div>
            <span style={{ fontSize:12, fontWeight:700, color:project.color }}>{progress}%</span>
          </div>}
          <div style={{ display:"flex", gap:5, marginTop:10, overflowX:"auto", paddingBottom:3, scrollbarWidth:"thin" }}>
            {[["tasks","tasks","Görevler"],["gantt","gantt","Proje Planı"],["machines","machines","Makineler"],["risks","risk","Riskler"],["tickets","ticket","Ticketlar"],["notlar","notes","Notlar"],["projlogs","activity","Log"]].map(([id,icon,label])=><button key={id} onClick={()=>setProjectTab(id)} style={{ padding:"7px 11px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:12, background:projectTab===id?project.color:"#F1F5FF", color:projectTab===id?"#fff":"#64748B", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap", flexShrink:0 }}><Icon name={icon} size={14}/>{label}</button>)}
          </div>
        </div>

        {projectTab==="tasks"&&<div style={{ flex:1, overflow:"auto", padding:isMobile?"12px":"18px 22px" }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><h3 style={{margin:0,fontSize:15}}>Milestonelar</h3><span style={{fontSize:11,color:"#64748B"}}>Görevleri görmek için milestone seçin.</span></div>{isAdmin&&<Btn small onClick={()=>setModal({type:"addMilestone"})}>+ Milestone</Btn>}</div>
          {project.milestones.map(ms=>{const open=selMilestone===ms.id;const done=ms.tasks.filter(t=>t.status==="Tamamland\u0131").length;return <div key={ms.id} style={{background:"#fff",border:`1.5px solid ${open?project.color:"#E2E8F0"}`,borderRadius:12,marginBottom:9,overflow:"hidden"}}>
            <button onClick={()=>{setSelMilestone(open?null:ms.id);setShowDoneTasks(false);}} style={{width:"100%",border:"none",background:open?project.color+"0D":"#fff",padding:"13px 15px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",fontFamily:"inherit"}}>
              <span style={{color:project.color,display:"flex"}}><Icon name="tasks" size={17}/></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:13}}>{ms.name}</div><div style={{fontSize:11,color:"#64748B",marginTop:3}}>{fmt(ms.startDate)} - {fmt(ms.dueDate)} · {done}/{ms.tasks.length} tamamlandı</div></div><Badge label={ms.status}/><span style={{fontSize:17,color:"#64748B"}}>{open?"−":"+"}</span>
            </button>
            {open&&<div style={{padding:"13px 15px",borderTop:"1px solid #E2E8F0"}}><MilestoneTaskPanel milestone={ms} project={project} people={state.people} isAdmin={isAdmin} showDone={showDoneTasks} setShowDone={setShowDoneTasks} onEdit={(item)=>setModal({type:"editMilestone",data:item})} onDelete={(id)=>{if(confirm("Silinsin mi?"))deleteMilestone(id);}} onAddTask={(msId)=>setModal({type:"addTask",msId})} onEditTask={(msId,task)=>setModal({type:"editTask",msId,data:task})} onDeleteTask={(msId,taskId)=>{if(confirm("Silinsin mi?"))deleteTask(msId,taskId);}} onCheckTask={(msId,taskId,c)=>updateTask(msId,taskId,{status:c?"Tamamland\u0131":"Bekliyor"})} onTimeTask={(msId,task)=>setModal({type:"timeLog",msId,data:task})}/></div>}
          </div>;})}
          {!project.milestones.length&&<div style={{padding:40,textAlign:"center",color:"#94A3B8",border:"1.5px dashed #CBD5E1",borderRadius:12}}>Milestone yok.</div>}
        </div>}

        {projectTab==="gantt"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:"0 0 3px", fontSize:14, fontWeight:800 }}>Proje Planı (Gantt)</h3>
            <div style={{ display:"flex", gap:7, alignItems:"center" }}>
              <Btn small variant="secondary" onClick={downloadTemplate}>Şablon İndir (Excel)</Btn>
              <Btn small variant="primary" onClick={()=>fileRef.current?.click()}>Excel/CSV Yükle</Btn>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:"none" }} onChange={handleImport} />
            </div>
          </div>
          <GanttChart project={project} />
          {/* Plan listesi - expandable */}
          <PlanListTable project={project} people={state.people} />
          <div style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
            {[[project.color,"Devam Ediyor"],["#059669","Tamamlandı"],["#EA6C00","Gecikmiş"],["#E11D48","Kritik"]].map(([c,l])=><div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:12, height:8, borderRadius:3, background:c }} /><span style={{ fontSize:11, color:"#64748B" }}>{l}</span></div>)}
          </div>
        </div>}

        {projectTab==="machines"&&<MachinePanel project={project} canEdit={isAdmin} onChange={(machines)=>mutProject(p=>({...p,machines}))} />}

        {projectTab==="risks"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px", maxWidth:680 }}>
          <RiskPanel risks={project.risks||[]} onAdd={()=>setModal({type:"addRisk"})} onUpdate={updateRisk} onDelete={deleteRisk} canEdit={isAdmin} />
        </div>}

        {projectTab==="tickets"&&<TicketsPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} />}
        {projectTab==="notlar"&&<ProjectNotesPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} />}

        {projectTab==="projlogs"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
          <LogPage logs={state.logs.filter(l=>l.project===project.name)} projects={state.projects} />
        </div>}
      </div>}

      {/* PROJECTS LIST */}
      {view==="projects"&&!selProject&&<div style={{ padding:"22px 26px", flex:1, overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="projects" size={20}/>Projeler</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{visibleProjects.length} proje</p></div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addProject"})}>+ Yeni Proje</Btn>}
        </div>
        {visibleProjects.length===0&&<div style={{ textAlign:"center", padding:"50px", background:"#fff", borderRadius:16, border:"1.5px dashed #E2E8F0" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Proje yok</div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addProject"})}>+ Proje Oluştur</Btn>}
        </div>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:13 }}>
          {visibleProjects.map(p=>{
            const total=p.milestones.reduce((a,m)=>a+m.tasks.length,0);
            const done=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>t.status==="Tamamland\u0131").length,0);
            const prog=total?Math.round((done/total)*100):0;
            const overdue=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,0);
            const crit=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length,0);
            const pm=state.people.find(pe=>pe.id===p.pm);
            const aMs=p.milestones.find(m=>m.status!=="Tamamland\u0131");
            return <div key={p.id} onClick={()=>{ setSelProject(p.id); setSelMilestone(null); setProjectTab("tasks"); }}
              style={{ background:"#fff", borderRadius:13, padding:"17px", border:"1.5px solid #E2E8F0", cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,0.04)", borderTop:`4px solid ${p.color}` }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none";}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:800 }}>{p.name}</h3><Badge label={p.status} />
              </div>
              {p.description&&<p style={{ margin:"0 0 7px", fontSize:12, color:"#64748B" }}>{p.description}</p>}
              {pm&&<div style={{ fontSize:11, color:"#64748B", marginBottom:3 }}>PM: <b>{pm.name}</b></div>}
              {aMs&&<div style={{ fontSize:11, color:"#4A6CF7", marginBottom:5, fontWeight:600 }}>Aktif: {aMs.name} — {fmt(aMs.dueDate)}</div>}
              <div style={{ display:"flex", gap:6, marginBottom:7, flexWrap:"wrap" }}>
                {overdue>0&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>Gecikmiş: {overdue}</span>}
                {crit>0&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>Kritik: {crit}</span>}
              </div>
              <div style={{ height:4, background:"#F1F5FF", borderRadius:10 }}><div style={{ width:`${prog}%`, height:"100%", background:p.color, borderRadius:10 }} /></div>
              <div style={{ fontSize:11, color:"#64748B", marginTop:4 }}>{done}/{total} görev · {prog}%</div>
            </div>;
          })}
        </div>
      </div>}

      {view==="mytasks"&&<MyTasksPage currentUser={currentUser} state={state} setState={setState} addLog={addLog} isAdmin={isAdmin} />}
      {view==="reports"&&<ReportsPage state={state} people={state.people} isAdmin={isAdmin} />}

      {view==="people"&&<div style={{ padding:"22px 26px", flex:1, overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="people" size={20}/>Ekip</h2></div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addPerson"})}>+ Kişi Ekle</Btn>}
        </div>
        {(()=>{
          const ot=state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>delayLvl(t.dueDate,t.status)).map(t=>({...t,projectName:proj.name,projectColor:proj.color,personName:state.people.find(p=>p.id===t.assignee)?.name,dl:delayLvl(t.dueDate,t.status),days:daysDiff(t.dueDate)}))));
          if(!ot.length)return null;
          const criticals=ot.filter(t=>t.dl==="critical");
          const normals=ot.filter(t=>t.dl==="normal");
          return (
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
                Termin Uyarıları — {criticals.length>0&&<span style={{ color:"#E11D48" }}>{criticals.length} kritik</span>}{criticals.length>0&&normals.length>0&&" · "}{normals.length>0&&<span style={{ color:"#EA6C00" }}>{normals.length} gecikmiş</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {ot.slice(0,10).map(t=>(
                  <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", borderRadius:10, padding:"10px 14px", border:`1.5px solid ${t.dl==="critical"?"#FCA5A5":"#FED7AA"}`, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:t.dl==="critical"?"#FFF1F2":"#FFF7ED", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <span style={{ fontSize:14, fontWeight:800, color:t.dl==="critical"?"#E11D48":"#EA6C00", lineHeight:1 }}>{t.days}</span>
                      <span style={{ fontSize:8, color:t.dl==="critical"?"#E11D48":"#EA6C00", fontWeight:600 }}>GÜN</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#1E293B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.title}</div>
                      <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:2, flexWrap:"wrap" }}>
                        <span style={{ width:7, height:7, borderRadius:"50%", background:t.projectColor, flexShrink:0 }} />
                        <span style={{ fontSize:11, color:"#64748B" }}>{t.projectName}</span>
                        {t.personName&&<span style={{ fontSize:11, color:"#94A3B8" }}>· {t.personName}</span>}
                        <span style={{ fontSize:11, color:"#94A3B8" }}>· Termin: {fmt(t.dueDate)}</span>
                      </div>
                    </div>
                    <span style={{ background:t.dl==="critical"?"#FFF1F2":"#FFF7ED", color:t.dl==="critical"?"#E11D48":"#EA6C00", borderRadius:8, padding:"3px 9px", fontSize:10, fontWeight:700, flexShrink:0 }}>
                      {t.dl==="critical"?"KRİTİK":"GECİKTİ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {state.people.map(p=>{
            const allT=[...state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===p.id))),...(state.personalTasks||[]).filter(t=>t.assignee===p.id)];
            const active=allT.filter(t=>t.status==="Devam Ediyor").length;
            const waiting=allT.filter(t=>t.status==="Bekliyor").length;
            const delayed=allT.filter(t=>delayLvl(t.dueDate,t.status)==="normal").length;
            const crit=allT.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length;
            const comp=allT.filter(t=>t.status==="Tamamlandı").length;
            const projC=[...new Set(state.projects.filter(proj=>proj.milestones.some(ms=>ms.tasks.some(t=>t.assignee===p.id))).map(pr=>pr.id))].length;
            const stats=[["Aktif",active,"#4A6CF7"],["Bekl.",waiting,"#94A3B8"],["Gec.",delayed,"#EA6C00"],["Krit.",crit,"#E11D48"],["Bitti",comp,"#059669"]].filter(([,c])=>c>0);
            return (
              <div key={p.id} style={{ background:"#fff", borderRadius:12, padding:"11px 14px", border:"1.5px solid #E2E8F0", display:"flex", alignItems:"center", gap:12 }}>
                <Avatar initials={p.avatar} size={36} color={p.isAdmin?"#E11D48":"#4A6CF7"} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
                    {p.isAdmin&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:6, padding:"1px 6px", fontSize:9, fontWeight:700 }}>YÖN</span>}
                  </div>
                  <div style={{ color:"#94A3B8", fontSize:11, marginTop:1 }}>{p.role}{projC>0?` · ${projC} proje`:""}</div>
                  {stats.length>0&&<div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
                    {stats.map(([l,c,col])=><span key={l} style={{ fontSize:11, fontWeight:700, color:col }}>{l} {c}</span>)}
                  </div>}
                </div>
                <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                  <Btn small variant="secondary" onClick={()=>setModal({type:"personDetail",data:p})}>Detay</Btn>
                  {isAdmin&&<Btn small variant="ghost" onClick={()=>setModal({type:"editPerson",data:p})} style={{display:"inline-flex",alignItems:"center",padding:"5px 8px"}}><Icon name="edit" size={15}/></Btn>}
                  {isAdmin&&p.id!==currentUser.id&&<Btn small variant="danger" onClick={()=>{if(confirm("Kaldırılsın mı?"))deletePerson(p.id);}}>×</Btn>}
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {view==="logs"&&<LogPage logs={state.logs} projects={state.projects} />}
      {view==="notifications"&&<NotificationsPage notifications={state.notifications||[]} currentUser={currentUser} setState={setState} />}
    </div>

    {/* MODALS */}
    {modal?.type==="addProject"&&<AddProjectModal onClose={()=>setModal(null)} onSave={addProject} people={state.people} />}
    {modal?.type==="editProject"&&<ProjectModal title="Projeyi Duzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={updateProject} people={state.people} />}
    {modal?.type==="addMilestone"&&<MilestoneModal title="Yeni Milestone" onClose={()=>setModal(null)} onSave={addMilestone} />}
    {modal?.type==="editMilestone"&&<MilestoneModal title="Milestone Duzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(d)=>updateMilestone(modal.data.id,d)} />}
    {modal?.type==="addTask"&&<TaskModal title="Yeni Görev" onClose={()=>setModal(null)} onSave={(d)=>addTask(modal.msId,d)} people={state.people} />}
    {modal?.type==="editTask"&&<TaskModal title="Görevi Düzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(d)=>updateTask(modal.msId,modal.data.id,d)} people={state.people} />}
    {modal?.type==="addPerson"&&<PersonModal onClose={()=>setModal(null)} onSave={addPerson} />}
    {modal?.type==="editPerson"&&<UserEditModal title="Kullanıcıyı Düzenle" person={modal.data} allowAdmin onClose={()=>setModal(null)} onSave={(d)=>updatePerson(modal.data.id,d)} />}
    {modal?.type==="personDetail"&&<PersonDetailModal person={modal.data} projects={state.projects} personalTasks={state.personalTasks} onClose={()=>setModal(null)} />}
    {modal?.type==="addRisk"&&<RiskModal onClose={()=>setModal(null)} onSave={addRisk} />}
    {modal?.type==="editProfile"&&<UserEditModal title="Profilimi Düzenle" person={currentUser} onClose={()=>setModal(null)} onSave={(d)=>updatePerson(currentUser.id,d)} />}
    {modal?.type==="timeLog"&&<TimeLogModal task={(project?.milestones.find(m=>m.id===modal.msId)?.tasks.find(t=>t.id===modal.data.id))||modal.data} currentUser={currentUser} onClose={()=>setModal(null)} onSave={(entries)=>updateTask(modal.msId,modal.data.id,{timeEntries:entries})} />}
  </div></>;
}


// ─── Time Log Modal ──────────────────────────────────────────────────────────
function TimeLogModal({ task, currentUser, onClose, onSave }) {
  const entries=task.timeEntries||[];
  const [hours,setHours]=useState("");
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [note,setNote]=useState("");
  const total=entries.reduce((a,e)=>a+(parseFloat(e.hours)||0),0);
  const planned=parseFloat(task.estimatedHours)||0;
  const add=()=>{
    const h=parseFloat(hours);
    if(!h||h<=0){alert("Geçerli saat girin.");return;}
    onSave([...entries,{id:uid(),hours:h,date,note,user:currentUser.name,userId:currentUser.id,ts:now()}]);
    setHours("");setNote("");
  };
  const remove=(id)=>onSave(entries.filter(e=>e.id!==id));
  return <Modal title={`Süre Girişi — ${task.title}`} onClose={onClose} wide>
    <div style={{ background:"#F5F3FF", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:13, fontWeight:700, color:"#7C3AED" }}>Toplam Harcanan{planned?` / Planlanan ${planned} saat`:""}</span>
      <span style={{ fontSize:20, fontWeight:800, color:planned&&total>planned?"#E11D48":"#7C3AED" }}>{total} saat</span>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"100px 1fr", gap:10, marginBottom:10 }}>
      <Field label="Saat *"><input type="number" step="0.5" min="0" style={iStyle} value={hours} onChange={e=>setHours(e.target.value)} placeholder="2.5" /></Field>
      <Field label="Tarih"><input type="date" style={iStyle} value={date} onChange={e=>setDate(e.target.value)} /></Field>
    </div>
    <Field label="Açıklama"><input style={iStyle} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ne yapıldı?" /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:18 }}><Btn onClick={add}>+ Süre Ekle</Btn></div>
    {entries.length>0&&<div>
      <div style={{ fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Kayıtlar ({entries.length})</div>
      {entries.slice().reverse().map(e=><div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 13px", background:"#F8FAFC", borderRadius:8, border:"1.5px solid #E2E8F0", marginBottom:5 }}>
        <span style={{ fontWeight:800, fontSize:14, color:"#7C3AED", minWidth:55 }}>{e.hours} sa</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, color:"#1E293B" }}>{e.note||"—"}</div>
          <div style={{ fontSize:10, color:"#94A3B8" }}>{e.user} · {fmt(e.date)}</div>
        </div>
        <button onClick={()=>remove(e.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:14 }}>x</button>
      </div>)}
    </div>}
  </Modal>;
}



// ─── Plan List Table ─────────────────────────────────────────────────────────
function PlanListTable({ project, people }) {
  const [expandedMs, setExpandedMs] = useState({});
  const toggle = (id) => setExpandedMs(s => ({ ...s, [id]: !s[id] }));
  const findName = (id) => people.find(p => p.id === id)?.name || "—";
  const thStyle = { padding:"8px 12px", textAlign:"left", fontWeight:600, color:"#64748B", borderBottom:"1px solid #E2E8F0", fontSize:11 };
  const tdStyle = (extra={}) => ({ padding:"8px 12px", borderBottom:"1px solid #F1F5FF", fontSize:12, ...extra });
  const bgs = ["#FAFBFF", "#F5F9FF"];

  // Flatten rows: milestone rows + optional task rows
  const rows = [];
  project.milestones.forEach((m, mi) => {
    const done = m.tasks.filter(t => t.status === "Tamamlandı").length;
    const pct = m.tasks.length ? Math.round(done / m.tasks.length * 100) : 0;
    const isExp = !!expandedMs[m.id];
    const bg = bgs[mi % 2];
    rows.push(
      <tr key={m.id} style={{ background: bg, cursor:"pointer" }} onClick={() => toggle(m.id)}>
        <td style={{ ...tdStyle(), width:28, color:"#94A3B8", fontWeight:700 }}>{isExp ? "▾" : "▸"}</td>
        <td style={{ ...tdStyle(), fontWeight:700 }}>{m.name}</td>
        <td style={tdStyle({ color:"#64748B" })}>{fmt(m.startDate)}</td>
        <td style={tdStyle({ color:"#64748B" })}>{fmt(m.dueDate)}</td>
        <td style={tdStyle({ color: m.actualStart ? "#1E293B" : "#CBD5E1" })}>{fmt(m.actualStart) || "—"}</td>
        <td style={tdStyle({ color: m.actualEnd ? "#1E293B" : "#CBD5E1" })}>{fmt(m.actualEnd) || "—"}</td>
        <td style={tdStyle()}><Badge label={m.status} /></td>
        <td style={tdStyle()}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:60, height:6, background:"#E2E8F0", borderRadius:4 }}>
              <div style={{ width:`${pct}%`, height:"100%", background: project.color, borderRadius:4 }} />
            </div>
            <span style={{ fontSize:11, color:"#64748B" }}>{done}/{m.tasks.length}</span>
          </div>
        </td>
      </tr>
    );
    if (isExp) {
      m.tasks.forEach(t => {
        const dl = delayLvl(t.dueDate, t.status);
        rows.push(
          <tr key={t.id} style={{ background:"#F8FAFC" }}>
            <td style={{ ...tdStyle(), color:"#CBD5E1" }}></td>
            <td style={{ ...tdStyle(), paddingLeft:28 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:11, color:"#1E293B" }}>{t.title}</span>
                {t.link && (() => {
                  const jm = String(t.link).match(/([A-Z][A-Z0-9]+-[0-9]+)/);
                  return <a href={t.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize:10, color:"#0052CC", background:"#DEEBFF", borderRadius:4, padding:"1px 5px", fontWeight:700, textDecoration:"none" }}>{jm ? jm[1] : "Jira"}</a>;
                })()}
              </div>
            </td>
            <td style={tdStyle({ color:t.startDate?"#64748B":"#94A3B8" })}>{fmt(t.startDate)}</td>
            <td style={tdStyle({ color: dl ? "#E11D48" : "#64748B" })}>{fmt(t.dueDate)}</td>
            <td style={tdStyle({ color:"#CBD5E1" })}>—</td>
            <td style={tdStyle({ color:"#CBD5E1" })}>—</td>
            <td style={tdStyle()}><Badge label={t.status} /></td>
            <td style={tdStyle({ color:"#64748B", fontSize:11 })}>{findName(t.assignee)}</td>
          </tr>
        );
      });
    }
  });

  return (
    <div style={{ marginTop:24, background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:"1.5px solid #E2E8F0", fontWeight:700, fontSize:13 }}>Plan Listesi</div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
          <thead>
            <tr style={{ background:"#F8FAFC" }}>
              {["","Milestone / Görev","Hedef Başl.","Hedef Bitiş","Gerç. Başl.","Gerç. Bitiş","Durum","İlerleme"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

function TicketsPanel({ project, currentUser, state, setState, isAdmin }) {
  const [modal,setModal]=useState(null);
  const tickets=((state.projectTickets||{})[project.id])||[];
  const saveTickets=(t)=>setState(s=>({...s,projectTickets:{...(s.projectTickets||{}),[project.id]:t}}));
  const addTicket=(data)=>saveTickets([...tickets,{id:uid(),ts:now(),author:currentUser.name,...data}]);
  const updateTicket=(id,data)=>saveTickets(tickets.map(t=>t.id===id?{...t,...data}:t));
  const deleteTicket=(id)=>saveTickets(tickets.filter(t=>t.id!==id));
  const TICKET_TYPES=["Bug","Görev","İyileştirme","Soru","Bilgi"];
  const TICKET_PRIOS=["Düşük","Orta","Yüksek","Kritik"];
  const TYPE_COLORS={"Bug":"#E11D48","Görev":"#4A6CF7","İyileştirme":"#059669","Soru":"#EA6C00","Bilgi":"#94A3B8"};
  return <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <h3 style={{ margin:0, fontSize:15, fontWeight:800 }}>Ticketlar ({tickets.length})</h3>
      <Btn small onClick={()=>setModal({type:"add"})}>+ Ticket Ekle</Btn>
    </div>
    {tickets.length===0&&<div style={{ textAlign:"center", padding:"40px", background:"#fff", borderRadius:12, border:"1.5px dashed #E2E8F0", color:"#94A3B8" }}>Henüz ticket yok.</div>}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {tickets.map(t=><div key={t.id} onClick={()=>setModal({type:"detail",data:t})} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:"1.5px solid #E2E8F0", display:"flex", gap:12, alignItems:"flex-start", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", cursor:"pointer" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[t.type]||"#94A3B8", marginTop:4, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:13 }}>{t.title}</span>
            <span style={{ background:(TYPE_COLORS[t.type]||"#94A3B8")+"22", color:TYPE_COLORS[t.type]||"#94A3B8", borderRadius:8, padding:"1px 8px", fontSize:11, fontWeight:600 }}>{t.type}</span>
            <span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"1px 8px", fontSize:11 }}>{t.priority}</span>
            {(t.jiraKey||t.jiraId)&&<a href={t.jiraLink||"#"} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ background:"#DEEBFF", color:"#0052CC", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:700, textDecoration:"none" }}>{t.jiraKey||t.jiraId}</a>}
            {t.jiraStatus&&<span style={{ background:"#E8F5E9", color:"#16794A", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:700 }}>Jira: {t.jiraStatus}</span>}
            <select value={t.status||"Açık"} onClick={e=>e.stopPropagation()} onChange={e=>updateTicket(t.id,{status:e.target.value})} style={{ fontSize:11, borderRadius:6, border:"1px solid #E2E8F0", padding:"2px 6px", fontFamily:"inherit" }}>
              {!["Açık","İnceleniyor","Çözüldü","Kapatıldı"].includes(t.status)&&t.status&&<option>{t.status}</option>}
              {["Açık","İnceleniyor","Çözüldü","Kapatıldı"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          {t.description&&<div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>{t.description}</div>}
          <div style={{ fontSize:11, color:"#94A3B8" }}>{t.author} · {new Date(t.ts).toLocaleDateString("tr-TR")}</div>
        </div>
        {(isAdmin||t.author===currentUser.name)&&<button onClick={e=>{e.stopPropagation();deleteTicket(t.id);}} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:16 }}>×</button>}
      </div>)}
    </div>
    {modal?.type==="add"&&<Modal title="Ticket Ekle" onClose={()=>setModal(null)}>
      <TicketForm onSave={(d)=>{addTicket(d);setModal(null);}} onClose={()=>setModal(null)} types={TICKET_TYPES} prios={TICKET_PRIOS} />
    </Modal>}
    {modal?.type==="detail"&&<TicketDetail ticket={tickets.find(t=>t.id===modal.data.id)||modal.data} canEdit={isAdmin||modal.data.author===currentUser.name} onClose={()=>setModal(null)} onUpdate={(data)=>updateTicket(modal.data.id,data)} types={TICKET_TYPES} prios={TICKET_PRIOS} />}
  </div>;
}
function TicketForm({ onSave, onClose, types, prios }) {
  const [f,setF]=useState({ title:"", type:"Görev", priority:"Orta", description:"", status:"Açık", jiraKey:"" });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  const submit=()=>{
    if(!f.title.trim())return;
    const jiraKey=f.jiraKey.trim().toUpperCase();
    onSave({...f,jiraKey,jiraId:jiraKey});
  };
  return <div>
    <Field label="Başlık *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Tip"><select style={iStyle} value={f.type} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    <Field label="Açıklama"><textarea style={{ ...iStyle, height:80, resize:"vertical" }} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <Field label="Jira Task Key"><input style={iStyle} value={f.jiraKey} onChange={e=>upd("jiraKey",e.target.value)} placeholder="PROJ-123" /></Field>
    <div style={{ fontSize:11, color:"#64748B", marginBottom:11 }}>Mevcut bir Jira taskıyla ilişkilendirmek için issue key girin.</div>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={submit}>Kaydet</Btn></div>
  </div>;
}

function TicketDetail({ ticket, canEdit, onClose, onUpdate, types, prios }) {
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState(ticket);
  const [jira,setJira]=useState(null);
  const [loading,setLoading]=useState(Boolean(ticket.jiraKey||ticket.jiraId));
  const [error,setError]=useState("");
  const jiraKey=(ticket.jiraKey||ticket.jiraId||"").trim().toUpperCase();
  const upd=(k,v)=>setForm(s=>({...s,[k]:v}));
  const refreshJira=async()=>{
    if(!jiraKey)return;
    setLoading(true);
    setError("");
    try{
      const issue=await getJiraIssue(jiraKey);
      setJira(issue);
      onUpdate({jiraKey:issue.key,jiraId:issue.key,jiraIssueId:issue.id,jiraLink:issue.url,jiraStatus:issue.status,jiraUpdatedAt:now()});
    }catch(e){setError(e?.message||"Jira bilgisi alınamadı.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{
    if(!jiraKey)return;
    let active=true;
    getJiraIssue(jiraKey).then(issue=>{
      if(!active)return;
      setJira(issue);
      setError("");
      onUpdate({jiraKey:issue.key,jiraId:issue.key,jiraIssueId:issue.id,jiraLink:issue.url,jiraStatus:issue.status,jiraUpdatedAt:now()});
    }).catch(e=>{if(active)setError(e?.message||"Jira bilgisi alınamadı.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
    // onUpdate changes with parent renders; Jira should refresh only when its key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jiraKey]);
  const save=()=>{
    const key=(form.jiraKey||form.jiraId||"").trim().toUpperCase();
    if(key!==jiraKey){setJira(null);setError("");setLoading(Boolean(key));}
    onUpdate({...form,jiraKey:key,jiraId:key,...(key!==jiraKey?{jiraStatus:"",jiraLink:"",jiraIssueId:""}:{})});
    setEditing(false);
  };
  return <Modal title={ticket.title} onClose={onClose} wide>
    {editing?<div>
      <Field label="Başlık"><input style={iStyle} value={form.title||""} onChange={e=>upd("title",e.target.value)} /></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <Field label="Tip"><select style={iStyle} value={form.type||"Görev"} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Öncelik"><select style={iStyle} value={form.priority||"Orta"} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
      </div>
      <Field label="Açıklama"><textarea style={{...iStyle,height:90,resize:"vertical"}} value={form.description||""} onChange={e=>upd("description",e.target.value)} /></Field>
      <Field label="Jira Task Key"><input style={iStyle} value={form.jiraKey||form.jiraId||""} onChange={e=>upd("jiraKey",e.target.value)} placeholder="PROJ-123" /></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" onClick={()=>setEditing(false)}>İptal</Btn><Btn onClick={save}>Kaydet</Btn></div>
    </div>:<div>
      {ticket.description&&<div style={{fontSize:13,color:"#475569",lineHeight:1.6,marginBottom:16}}>{ticket.description}</div>}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><span style={{background:"#F1F5FF",color:"#4A6CF7",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.type}</span><span style={{background:"#FFF7ED",color:"#EA6C00",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.priority}</span><span style={{background:"#F8FAFC",color:"#64748B",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.status}</span></div>
      <div style={{border:"1.5px solid #DDE7F5",borderRadius:12,padding:14,background:"#F8FBFF",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:jiraKey?10:0}}><div style={{fontWeight:800,fontSize:13,color:"#0052CC"}}>Jira Task</div>{jiraKey&&<button onClick={refreshJira} disabled={loading} style={{border:"none",background:"none",color:"#4A6CF7",fontSize:11,cursor:"pointer"}}>{loading?"Güncelleniyor...":"Yenile"}</button>}</div>
        {!jiraKey&&<div style={{fontSize:12,color:"#64748B"}}>Bu ticket henüz bir Jira taskıyla ilişkilendirilmemiş.</div>}
        {jiraKey&&error&&<div style={{fontSize:12,color:"#BE123C"}}>{error}</div>}
        {jiraKey&&!error&&<div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}><strong style={{fontSize:13}}>{jiraKey}</strong><span style={{background:"#E8F5E9",color:"#16794A",borderRadius:7,padding:"2px 8px",fontSize:11,fontWeight:700}}>{jira?.status||ticket.jiraStatus||"Durum alınıyor..."}</span></div>
          {(jira?.summary)&&<div style={{fontSize:12,color:"#475569",marginBottom:9}}>{jira.summary}</div>}
          {(jira?.assignee)&&<div style={{fontSize:11,color:"#64748B",marginBottom:9}}>Sorumlu: {jira.assignee}</div>}
          {(jira?.url||ticket.jiraLink)&&<a href={jira?.url||ticket.jiraLink} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"#0052CC",color:"#fff",borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>Jira'da Aç</a>}
        </div>}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{canEdit&&<Btn variant="secondary" onClick={()=>{setForm(ticket);setEditing(true);}}>Düzenle / Jira İlişkilendir</Btn>}<Btn variant="ghost" onClick={onClose}>Kapat</Btn></div>
    </div>}
  </Modal>;
}

// ─── User Edit Modal ──────────────────────────────────────────────────────────
function UserEditModal({ person, onClose, onSave, title="Profilimi Düzenle", allowAdmin=false }) {
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role||"");
  const [isAdmin,setIsAdmin]=useState(Boolean(person.isAdmin));
  return <Modal title={title} onClose={onClose}>
    <Field label="Ad Soyad *"><input style={iStyle} value={name} onChange={e=>setName(e.target.value)} /></Field>
    <Field label="Rol / Unvan"><input style={iStyle} value={role} onChange={e=>setRole(e.target.value)} /></Field>
    {allowAdmin&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)}/> Yönetici yetkisi</label>}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!name.trim())return; onSave({name:name.trim(),role:role.trim(),...(allowAdmin?{isAdmin}:{})}); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}

// ─── Notifications Page ──────────────────────────────────────────────────────
function NotificationsPage({ notifications, currentUser, setState }) {
  const mine=(notifications||[]).filter(n=>n.userId===currentUser.id);
  const markRead=(id)=>setState(s=>({...s,notifications:(s.notifications||[]).map(n=>n.id===id?{...n,read:true}:n)}));
  const deleteNotif=(id)=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>n.id!==id)}));
  return <div style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Bildirimler</h2>
        <p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{mine.filter(n=>!n.read).length} okunmamış</p>
      </div>
      {mine.length>0&&<button onClick={()=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>n.userId!==currentUser.id)}))} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", fontSize:12 }}>Tümünü Temizle</button>}
    </div>
    {mine.length===0&&<div style={{ textAlign:"center", padding:"50px", background:"#fff", borderRadius:16, border:"1.5px dashed #E2E8F0" }}>
      <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
      <div style={{ color:"#94A3B8" }}>Bildirim yok</div>
    </div>}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {mine.map(n=><div key={n.id} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:`1.5px solid ${n.read?"#E2E8F0":"#4A6CF7"}`, display:"flex", gap:12, alignItems:"flex-start", boxShadow:n.read?"none":"0 2px 8px rgba(74,108,247,0.1)" }} onClick={()=>markRead(n.id)}>
        <div style={{ width:36, height:36, borderRadius:"50%", background:n.read?"#F1F5FF":"#EEF2FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📋</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:n.read?400:600, color:"#1E293B" }}>{n.msg}</div>
          {n.projectName&&<div style={{ fontSize:11, color:"#4A6CF7", marginTop:3 }}>{n.projectName}</div>}
          <div style={{ fontSize:11, color:"#94A3B8", marginTop:3 }}>{new Date(n.ts).toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"})}</div>
        </div>
        {!n.read&&<span style={{ width:8,height:8,borderRadius:"50%",background:"#4A6CF7",flexShrink:0,marginTop:4 }} />}
        <button onClick={e=>{e.stopPropagation();deleteNotif(n.id);}} style={{ background:"none",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:16,padding:0 }}>×</button>
      </div>)}
    </div>
  </div>;
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function AddProjectModal({ onClose, onSave, people }) {
  const [step,setStep]=useState("template");
  const [tplData,setTplData]=useState(null);
  const [f,setF]=useState({ name:"", description:"", color:"#4A6CF7", status:"Bekliyor", startDate:todayStr(), endDate:"", pm:"" });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  const handleTplSelect=(tpl)=>{ setTplData(tpl); setF(s=>({...s,color:tpl.color})); setStep("form"); };
  const handleSave=()=>{ if(!f.name.trim())return; const built=tplData?buildFromTemplate(tplData,f.startDate||todayStr()):{milestones:[]}; onSave({...f,...built,risks:[]}); onClose(); };
  return <Modal title="Yeni Proje" onClose={onClose} wide>
    {step==="template"&&<TemplatePicker onSelect={handleTplSelect} onSkip={()=>setStep("form")} />}
    {step==="form"&&<div>
      {tplData&&<div style={{ background:tplData.color+"15", border:`1.5px solid ${tplData.color}44`, borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:12 }}>
        <strong style={{ color:tplData.color }}>Sablon: {tplData.name}</strong>
        <span style={{ color:"#64748B", marginLeft:8 }}>{tplData.milestones.length} milestone otomatik eklenecek</span>
        <button onClick={()=>setStep("template")} style={{ marginLeft:12, background:"none", border:"none", cursor:"pointer", color:tplData.color, fontSize:11, textDecoration:"underline" }}>Degistir</button>
      </div>}
      <Field label="Proje Adı *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} placeholder="Proje adi" /></Field>
      <Field label="Açıklama"><input style={iStyle} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
      <Field label="PM"><select style={iStyle} value={f.pm} onChange={e=>upd("pm",e.target.value)}><option value="">- Seç -</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Renk"><div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>{COLORS.map(c=><div key={c} onClick={()=>upd("color",c)} style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:f.color===c?"3px solid #1E293B":"3px solid transparent" }} />)}</div></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <Field label="Başlangıç"><input type="date" style={iStyle} value={f.startDate} onChange={e=>upd("startDate",e.target.value)} /></Field>
        <Field label="Bitiş"><input type="date" style={iStyle} value={f.endDate} onChange={e=>upd("endDate",e.target.value)} /></Field>
      </div>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={handleSave}>Kaydet</Btn></div>
    </div>}
  </Modal>;
}
function ProjectModal({ title, initial, onClose, onSave, people }) {
  const [f,setF]=useState({ name:"", description:"", color:"#4A6CF7", status:"Bekliyor", startDate:"", endDate:"", pm:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Proje Adı *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} /></Field>
    <Field label="Açıklama"><input style={iStyle} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <Field label="PM"><select style={iStyle} value={f.pm} onChange={e=>upd("pm",e.target.value)}><option value="">- Seç -</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <Field label="Renk"><div style={{ display:"flex", gap:7 }}>{COLORS.map(c=><div key={c} onClick={()=>upd("color",c)} style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:f.color===c?"3px solid #1E293B":"3px solid transparent" }} />)}</div></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Başlangıç"><input type="date" style={iStyle} value={f.startDate} onChange={e=>upd("startDate",e.target.value)} /></Field>
      <Field label="Bitiş"><input type="date" style={iStyle} value={f.endDate} onChange={e=>upd("endDate",e.target.value)} /></Field>
    </div>
    <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.name.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function MilestoneModal({ title, initial, onClose, onSave }) {
  const [f,setF]=useState({ name:"", startDate:"", dueDate:"", actualStart:"", actualEnd:"", status:"Bekliyor", waitSource:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Milestone Adı *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Hedef Başlangıç"><input type="date" style={iStyle} value={f.startDate} onChange={e=>upd("startDate",e.target.value)} /></Field>
      <Field label="Hedef Termin"><input type="date" style={iStyle} value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} /></Field>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Gerçekleşen Başlangıç"><input type="date" style={iStyle} value={f.actualStart||""} onChange={e=>upd("actualStart",e.target.value)} /></Field>
      <Field label="Gerçekleşen Bitiş"><input type="date" style={iStyle} value={f.actualEnd||""} onChange={e=>upd("actualEnd",e.target.value)} /></Field>
    </div>
    <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Bekleme Kaynağı"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{WAIT.map(s=><option key={s}>{s}</option>)}</select></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.name.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function TaskModal({ title, initial, onClose, onSave, people }) {
  const [f,setF]=useState({ title:"", status:"Bekliyor", priority:"Orta", assignee:"", startDate:"", dueDate:"", estimatedHours:"", notes:"", waitSource:"", link:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Görev Başlığı *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    <Field label="Sorumlu"><select style={iStyle} value={f.assignee} onChange={e=>upd("assignee",e.target.value)}><option value="">- Seç -</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <Field label="Planlanan Efor (Saat)"><input type="number" min="0" step="0.5" style={iStyle} value={f.estimatedHours||""} onChange={e=>upd("estimatedHours",e.target.value)} placeholder="Örn. 8" /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Başlangıç Tarihi"><input type="date" style={iStyle} value={f.startDate||""} onChange={e=>upd("startDate",e.target.value)} /></Field>
      <Field label="Termin Tarihi"><input type="date" style={iStyle} value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} /></Field>
    </div>
    <Field label="Bekleme Kaynağı"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{WAIT.map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Notlar"><input style={iStyle} value={f.notes} onChange={e=>upd("notes",e.target.value)} /></Field>
    <Field label="Jira Linki"><input style={iStyle} value={f.link||""} onChange={e=>upd("link",e.target.value)} placeholder="https://sirket.atlassian.net/browse/PROJ-123" /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function PersonalTaskModal({ title, initial, onClose, onSave, people, isAdmin, currentUser }) {
  const [f,setF]=useState({ title:"", status:"Bekliyor", priority:"Orta", assignee:isAdmin?"":currentUser.id, dueDate:"", estimatedHours:"", notes:"", waitSource:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Görev Başlığı *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    {isAdmin?<Field label="Atanacak Kisi"><select style={iStyle} value={f.assignee} onChange={e=>upd("assignee",e.target.value)}><option value="">- Seç -</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>:<div style={{ background:"#F1F5FF", borderRadius:8, padding:"8px 12px", marginBottom:13, fontSize:12, color:"#4A6CF7" }}>Görev size atanacak: <b>{currentUser.name}</b></div>}
    <Field label="Planlanan Efor (Saat)"><input type="number" min="0" step="0.5" style={iStyle} value={f.estimatedHours||""} onChange={e=>upd("estimatedHours",e.target.value)} placeholder="Örn. 4" /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Başlangıç Tarihi"><input type="date" style={iStyle} value={f.startDate||""} onChange={e=>upd("startDate",e.target.value)} /></Field>
      <Field label="Termin Tarihi"><input type="date" style={iStyle} value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} /></Field>
    </div>
    <Field label="Bekleme Kaynağı"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{WAIT.map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Notlar"><input style={iStyle} value={f.notes} onChange={e=>upd("notes",e.target.value)} /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function PersonModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  return (
    <Modal title="Ekip Üyesi Ekle" onClose={onClose}>
      <Field label="Ad Soyad *">
        <input style={iStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Ad soyad" />
      </Field>
      <Field label="Rol / Unvan">
        <input style={iStyle} value={role} onChange={e=>setRole(e.target.value)} placeholder="Geliştirici, Tasarımcı..." />
      </Field>
      <Field label="Yetki">
        <div style={{ display:"flex", gap:10 }}>
          <div onClick={()=>setIsAdmin(false)} style={{ flex:1, padding:"10px", borderRadius:8, border:`1.5px solid ${!isAdmin?"#4A6CF7":"#E2E8F0"}`, cursor:"pointer", textAlign:"center", background:!isAdmin?"#F1F5FF":"#fff", fontSize:12, fontWeight:600, color:!isAdmin?"#4A6CF7":"#64748B" }}>
            Ekip Üyesi
          </div>
          <div onClick={()=>setIsAdmin(true)} style={{ flex:1, padding:"10px", borderRadius:8, border:`1.5px solid ${isAdmin?"#4A6CF7":"#E2E8F0"}`, cursor:"pointer", textAlign:"center", background:isAdmin?"#F1F5FF":"#fff", fontSize:12, fontWeight:600, color:isAdmin?"#4A6CF7":"#64748B" }}>
            Yönetici
          </div>
        </div>
      </Field>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{ if(!name.trim())return; onSave({name,role,isAdmin}); onClose(); }}>Kaydet</Btn>
      </div>
    </Modal>
  );
}
function RiskModal({ onClose, onSave }) {
  const [f,setF]=useState({ title:"", level:"Orta", status:"Açık", note:"" });
  return <Modal title="Risk Ekle" onClose={onClose}>
    <Field label="Başlık *"><input style={iStyle} value={f.title} onChange={e=>setF(s=>({...s,title:e.target.value}))} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Seviye"><select style={iStyle} value={f.level} onChange={e=>setF(s=>({...s,level:e.target.value}))}>{["Düşük","Orta","Yüksek"].map(l=><option key={l}>{l}</option>)}</select></Field>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>setF(s=>({...s,status:e.target.value}))}>{["Açık","İzleniyor","Kapalı"].map(l=><option key={l}>{l}</option>)}</select></Field>
    </div>
    <Field label="Not"><input style={iStyle} value={f.note} onChange={e=>setF(s=>({...s,note:e.target.value}))} /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
