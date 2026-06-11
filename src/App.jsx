import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import * as XLSX from "xlsx";

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
    { id:"p1", name:"Hakan B.", role:"Y\u00f6netici", avatar:"HB", isAdmin:true },
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
    { id:"l1", ts:"2026-06-08T10:30:00Z", user:"Hakan B.", userId:"p1", action:"task_done", detail:"Mevcut süreç analizi tamamland\u0131", project:"CNC Dashboard MES", milestone:"Kapsam & Fizibilite" },
    { id:"l2", ts:"2026-06-09T14:15:00Z", user:"Ay\u015fe K.", userId:"p2", action:"status_change", detail:"OPC-UA altyap\u0131 → Devam Ediyor", project:"CNC Dashboard MES", milestone:"Altyap\u0131 Haz\u0131rl\u0131k" },
    { id:"l3", ts:"2026-06-10T09:00:00Z", user:"Hakan B.", userId:"p1", action:"project_create", detail:"CNC Dashboard MES projesi olu\u015fturuldu", project:"CNC Dashboard MES", milestone:"" },
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
  return <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1E293B 0%,#0F172A 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Inter,Segoe UI,sans-serif" }}>
    <div style={{ background:"#fff", borderRadius:20, padding:"40px 44px", width:"100%", maxWidth:420, boxShadow:"0 30px 80px rgba(0,0,0,0.3)" }}>
      <div style={{ textAlign:"center", marginBottom:32 }}>
        <div style={{ fontSize:14, fontWeight:800, color:"#4A6CF7", letterSpacing:3, textTransform:"uppercase", marginBottom:6 }}>CORJECT</div>
        <div style={{ fontSize:22, fontWeight:800, color:"#1E293B" }}>Giriş Yap</div>
        <div style={{ color:"#94A3B8", fontSize:13, marginTop:4 }}>Kim olduğunuzu seçin</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
        {people.map(p => <div key={p.id} onClick={() => setSel(p.id)} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:12, border:`2px solid ${sel===p.id?"#4A6CF7":"#E2E8F0"}`, cursor:"pointer", background:sel===p.id?"#F1F5FF":"#fff" }}>
          <Avatar initials={p.avatar} size={40} color={p.isAdmin?"#E11D48":"#4A6CF7"} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
            <div style={{ fontSize:12, color:"#64748B" }}>{p.role}</div>
          </div>
          {p.isAdmin && <span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:8, padding:"1px 8px", fontSize:10, fontWeight:700 }}>YÖN</span>}
          {sel===p.id && <span style={{ color:"#4A6CF7", fontSize:18 }}>ok</span>}
        </div>)}
      </div>
      <Btn style={{ width:"100%", justifyContent:"center", padding:"11px", fontSize:14 }} disabled={!sel} onClick={() => sel&&onLogin(sel)}>Giriş Yap</Btn>
    </div>
  </div>;
}

// ─── Template Picker ────────────────────────────────────────────────────────
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
    ...ms.map(m => m.startDate || project.startDate),
    ...ms.map(m => m.dueDate),
    ...ms.flatMap(m => m.tasks.map(t => t.dueDate)),
  ].filter(Boolean);
  if (!allDates.length) return <div style={{ padding:40, textAlign:"center", color:"#94A3B8" }}>Tarih bilgisi eksik.</div>;

  const minDate = new Date(Math.min(...allDates.map(d => new Date(d))));
  const maxDate = new Date(Math.max(...allDates.map(d => new Date(d))));
  const total = Math.max(1, (maxDate - minDate) / 86400000) + 4;
  const todayOff = Math.max(0, (new Date() - minDate) / 86400000);

  const pct = (d) => {
    if (!d) return 0;
    return Math.max(0, Math.min(98, ((new Date(d) - minDate) / 86400000) / total * 100));
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

  const labelW = compact ? 120 : 160;
  const rowH = compact ? 22 : 28;
  const bgs = ["#FAFBFF", "#F5F9FF"];

  return (
    <div style={{ overflowX:"auto" }}>
      <div style={{ minWidth: compact ? 500 : 650 }}>
        <div style={{ fontSize:10, color:"#94A3B8", marginBottom:6 }}>
          Milestone tıklayın: hedeflenen (kesik) / gerçekleşen (dolu) + görev satırları
        </div>
        <div style={{ display:"flex", marginLeft:labelW, marginBottom:5, position:"relative", height:16 }}>
          {months.map((m, i) => (
            <div key={i} style={{ position:"absolute", left:`${m.pct}%`, fontSize:9, color:"#94A3B8", fontWeight:600, whiteSpace:"nowrap" }}>{m.label}</div>
          ))}
        </div>

        {ms.map((m, mi) => {
          const s = m.startDate || project.startDate;
          const e = m.dueDate;
          if (!s || !e) return null;
          const dl = delayLvl(e, m.status);
          const barC = m.status === "Tamamland\u0131" ? "#059669" : dl === "critical" ? "#E11D48" : dl === "normal" ? "#EA6C00" : project.color;
          const done = m.tasks.filter(t => t.status === "Tamamland\u0131").length;
          const isExp = expanded === m.id;

          return (
            <div key={m.id} style={{ background: bgs[mi % 2], borderRadius:8, marginBottom: isExp ? 0 : 4, border:`1.5px solid ${isExp ? "#4A6CF7" : "#E8EDF5"}` }}>
              {/* Milestone row */}
              <div onClick={() => setExpanded(isExp ? null : m.id)}
                style={{ display:"flex", alignItems:"center", padding:"4px 6px", cursor:"pointer", borderBottom: isExp ? "1px solid #E2E8F0" : "none" }}>
                <div style={{ width:labelW, flexShrink:0, fontSize: compact ? 10 : 12, fontWeight:700, paddingRight:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#1E293B" }} title={m.name}>
                  {isExp ? "\u25BE " : "\u25B8 "}{m.name}
                </div>
                <div style={{ flex:1, position:"relative", height:rowH, background:"#EEF2FF", borderRadius:6 }}>
                  {todayOff <= total && (
                    <div style={{ position:"absolute", left:`${todayOff / total * 100}%`, top:0, bottom:0, width:2, background:"#E11D48", zIndex:3 }} />
                  )}
                  {/* Planned dashed */}
                  <div style={{ position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`, top:3, height:rowH-6, background:barC+"33", border:`1.5px dashed ${barC}`, borderRadius:4, zIndex:1 }}
                    title={`Hedeflenen: ${fmt(s)} \u2192 ${fmt(e)}`} />
                  {/* Actual or fallback */}
                  <div style={{ position:"absolute", left:`${pct(m.actualStart || s)}%`, width:`${wPct(m.actualStart || s, m.actualEnd || e)}%`, top:3, height:rowH-6, background:barC, borderRadius:4, zIndex:2, display:"flex", alignItems:"center", justifyContent:"center", minWidth:20 }}>
                    <span style={{ fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap" }}>
                      {m.status === "Tamamland\u0131" ? "\u2713 " : ""}{fmt(e)}
                    </span>
                  </div>
                </div>
                <div style={{ width:64, textAlign:"right", paddingLeft:6, fontSize:10, color:"#64748B" }}>{done}/{m.tasks.length}</div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div style={{ padding:"8px 6px 10px", background:"#F0F4FF", borderRadius:"0 0 6px 6px" }}>
                  {/* Planned vs actual */}
                  <div style={{ display:"flex", alignItems:"center", marginBottom:4 }}>
                    <div style={{ width:labelW, flexShrink:0, fontSize:9, color:"#94A3B8", textAlign:"right", paddingRight:8 }}>Hedeflenen</div>
                    <div style={{ flex:1, position:"relative", height:14, background:"#fff", borderRadius:4 }}>
                      <div style={{ position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`, height:10, top:2, background:project.color+"44", border:`1.5px dashed ${project.color}`, borderRadius:3 }} />
                    </div>
                    <div style={{ width:64, fontSize:9, color:"#94A3B8", paddingLeft:6 }}>{fmt(s)}\u2192{fmt(e)}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
                    <div style={{ width:labelW, flexShrink:0, fontSize:9, color:"#94A3B8", textAlign:"right", paddingRight:8 }}>Ger\u00e7ekle\u015fen</div>
                    <div style={{ flex:1, position:"relative", height:14, background:"#fff", borderRadius:4 }}>
                      {m.actualStart
                        ? <div style={{ position:"absolute", left:`${pct(m.actualStart)}%`, width:`${wPct(m.actualStart, m.actualEnd || new Date().toISOString().slice(0,10))}%`, height:10, top:2, background:barC, borderRadius:3 }} />
                        : <div style={{ position:"absolute", left:6, top:1, fontSize:9, color:"#CBD5E1" }}>Tarih girilmemi\u015f</div>
                      }
                    </div>
                    <div style={{ width:64, fontSize:9, color:"#94A3B8", paddingLeft:6 }}>
                      {m.actualStart ? `${fmt(m.actualStart)}\u2192${fmt(m.actualEnd) || "devam"}` : ""}
                    </div>
                  </div>

                  {/* Task rows */}
                  {m.tasks.filter(t => t.dueDate).map(t => {
                    const tdl = delayLvl(t.dueDate, t.status);
                    const tc = t.status === "Tamamland\u0131" ? "#059669" : tdl === "critical" ? "#E11D48" : tdl === "normal" ? "#EA6C00" : "#94A3B8";
                    const taskPct = pct(t.dueDate);
                    return (
                      <div key={t.id} style={{ display:"flex", alignItems:"center", marginBottom:3 }}>
                        <div style={{ width:labelW, flexShrink:0, fontSize:9, paddingRight:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#64748B", paddingLeft:12 }} title={t.title}>
                          {t.title}
                        </div>
                        <div style={{ flex:1, position:"relative", height:20, background:"#fff", borderRadius:4 }}>
                          {todayOff <= total && (
                            <div style={{ position:"absolute", left:`${todayOff / total * 100}%`, top:0, bottom:0, width:1, background:"#E11D48", zIndex:2 }} />
                          )}
                          <div style={{ position:"absolute", left:`${Math.max(0, taskPct - 1.5)}%`, width:"3%", top:3, height:14, background:tc, borderRadius:3, minWidth:8, zIndex:1 }}
                            title={`${t.title}: ${fmt(t.dueDate)}`} />
                        </div>
                        <div style={{ width:64, fontSize:9, color: tdl ? "#E11D48" : "#94A3B8", paddingLeft:6 }}>{fmt(t.dueDate)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ position:"relative", height:14, marginLeft:labelW, marginTop:4 }}>
          <div style={{ position:"absolute", left:`${Math.min(99, todayOff / total * 100)}%`, fontSize:9, color:"#E11D48", fontWeight:700, transform:"translateX(-50%)" }}>BUG\u00dcN</div>
        </div>
      </div>
    </div>
  );
}

function downloadCSVReport(project, people) {
  const findName=(id)=>people.find(p=>p.id===id)?.name||"Atanmamış";
  let rows=["Proje,Milestone,Milestone Başlangıç,Milestone Termin,Milestone Durum,Görev,Görev Durumu,Öncelik,Sorumlu,Görev Termin,Gecikme,Bekleme Kaynağı,Notlar,Harcanan Saat"];
  project.milestones.forEach(ms=>{
    if(ms.tasks.length===0){
      rows.push([project.name,ms.name,ms.startDate||"",ms.dueDate||"",ms.status,"","","","","","","",""].join(","));
    } else {
      ms.tasks.forEach(t=>{
        const dl=delayLvl(t.dueDate,t.status);
        rows.push([project.name,ms.name,ms.startDate||"",ms.dueDate||"",ms.status,t.title,t.status,t.priority,findName(t.assignee),t.dueDate||"",dl==="critical"?"Kritik Gecikme":dl==="normal"?"Gecikti":"",t.waitSource||"",t.notes||"",(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)].join(","));
      });
    }
  });
  const csv = "\uFEFF" + rows.join("\n");
  const uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  const a = document.createElement("a");
  a.href = uri;
  a.download = project.name.replace(/[^a-zA-Z0-9]/g,"_") + "-rapor.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
        {task.dueDate&&<span style={{ fontSize:11, color:dl?"#E11D48":"#94A3B8" }}>Termin: {fmt(task.dueDate)}</span>}
        {(task.timeEntries||[]).length>0&&<span style={{ fontSize:11, color:"#7C3AED", fontWeight:600, background:"#F5F3FF", borderRadius:6, padding:"1px 6px" }}>{(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0)} saat</span>}
        {task.waitSource&&<span style={{ fontSize:11, color:"#EA6C00", fontWeight:600 }}>Bekliyor: {task.waitSource}</span>}
        {task.link&&(()=>{const jm=String(task.link).match(/([A-Z][A-Z0-9]+-[0-9]+)/);return <a href={task.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:11, color:"#0052CC", background:"#DEEBFF", borderRadius:6, padding:"1px 7px", fontWeight:700, textDecoration:"none" }}>{jm?jm[1]:"Jira"}</a>;})()}
        {showProject&&projectName&&<span style={{ fontSize:11, color:"#4A6CF7", background:"#F1F5FF", borderRadius:6, padding:"1px 6px" }}>{projectName}</span>}
        {task.notes&&<span style={{ fontSize:11, color:"#94A3B8", fontStyle:"italic" }}>"{task.notes}"</span>}
      </div>
    </div>
    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
      {onTime&&<Btn small variant="ghost" onClick={onTime} style={{ color:"#7C3AED" }}>saat</Btn>}
      {canEdit&&onEdit&&<Btn small variant="ghost" onClick={onEdit}>e</Btn>}
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
  const [modal,setModal]=useState(null);
  const [noteText,setNoteText]=useState((state.userNotes||{})[currentUser.id]?.notes||"");
  const [newTodo,setNewTodo]=useState("");
  const [todoProject,setTodoProject]=useState("");
  const [todoReminder,setTodoReminder]=useState("");
  const [notesOpen,setNotesOpen]=useState(false);
  const [todosOpen,setTodosOpen]=useState(true);
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
    <div style={{ padding:"20px 28px 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Görevlerim</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{active.length} aktif · {completed.length} tamamlandı</p></div>
        <Btn onClick={()=>setModal({type:"addPersonal"})}>+ Görev Ekle</Btn>
      </div>
      {overdue.length>0&&<div style={{ background:"#FFF1F2", border:"1.5px solid #FCA5A5", borderRadius:12, padding:"12px 16px", margin:"12px 0" }}>
        <div style={{ fontWeight:700, fontSize:12, color:"#E11D48", marginBottom:6 }}>Gecikmiş: {overdue.length}</div>
        {overdue.map(t=><div key={t.id} style={{ fontSize:12, color:"#1E293B", display:"flex", gap:8, marginBottom:3 }}><DelayBadge dateStr={t.dueDate} status={t.status} /><span>{t.title}</span><span style={{ color:"#94A3B8" }}>— {fmt(t.dueDate)}</span></div>)}
      </div>}
    </div>

    <div style={{ display:"flex", flex:1, overflow:window.innerWidth<768?"auto":"hidden", gap:0, flexDirection:window.innerWidth<768?"column":"row" }}>
      {/* Tasks column */}
      <div style={{ flex:1, overflow:"auto", padding:"12px 28px" }}>
        {active.length>0&&<div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Aktif ({active.length})</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {active.map(t=><TaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel Görev"} canEdit
              onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
              onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
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
            />)}
          </div>
        </div>}
      </div>

      {/* Notes & Todo sidebar */}
      <div style={{ width:window.innerWidth<768?"100%":280, borderLeft:window.innerWidth<768?"none":"1px solid #E2E8F0", borderTop:window.innerWidth<768?"1px solid #E2E8F0":"none", background:"#FAFBFC", display:"flex", flexDirection:"column", overflow:window.innerWidth<768?"visible":"auto", flexShrink:0 }}>
        <div style={{ borderBottom:"1px solid #E2E8F0" }}>
          <button onClick={()=>setNotesOpen(v=>!v)} style={{ width:"100%", padding:"14px 18px", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", fontFamily:"inherit" }}>
            <span style={{ fontWeight:700, fontSize:13, color:"#1E293B" }}>Notlarım</span>
            <span style={{ color:"#94A3B8", fontSize:12 }}>{notesOpen?"kapat":"ac"}</span>
          </button>
          {notesOpen&&<div style={{ padding:"0 18px 16px" }}>
            <textarea value={noteText} onChange={e=>updateNotes(e.target.value)} placeholder="Serbest notlar, hatirlatmalar..." style={{ width:"100%", height:140, padding:"10px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:13, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", background:"#fff", outline:"none", lineHeight:1.6, color:"#1E293B" }} />
          </div>}
        </div>
        <div style={{ flex:window.innerWidth<768?"none":1, overflow:window.innerWidth<768?"visible":"auto" }}>
          <button onClick={()=>setTodosOpen(v=>!v)} style={{ width:"100%", padding:"14px 18px", background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", fontFamily:"inherit" }}>
            <span style={{ fontWeight:700, fontSize:13, color:"#1E293B" }}>To-Do {todos.filter(t=>!t.done).length>0?`(${todos.filter(t=>!t.done).length})`:""}</span>
            <span style={{ color:"#94A3B8", fontSize:12 }}>{todosOpen?"kapat":"ac"}</span>
          </button>
          {todosOpen&&<div style={{ padding:"0 18px 16px" }}>
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
          </div>}
        </div>
      </div>
    </div>

    {modal?.type==="addPersonal"&&<PersonalTaskModal title="Genel Görev Ekle" people={state.people} isAdmin={isAdmin} currentUser={currentUser} onClose={()=>setModal(null)} onSave={addPersonal} />}
    {modal?.type==="editPersonal"&&<PersonalTaskModal title="Görevi Düzenle" initial={modal.data} people={state.people} isAdmin={isAdmin} currentUser={currentUser} onClose={()=>setModal(null)} onSave={(d)=>{updatePersonal(modal.data.id,d);setModal(null);}} />}
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

  return <div style={{ flex:1, overflow:"auto", padding:"20px 24px", display:"flex", gap:20, flexWrap:"wrap" }}>
    {/* Left: shared notes */}
    <div style={{ flex:"1 1 340px", minWidth:280 }}>
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Proje Notları</div>

      <div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:8, color:"#1E293B" }}>Paylaşılan Notlar</div>
        {isAdmin
          ? <textarea value={editNote} onChange={e=>{setEditNote(e.target.value);save({shared:e.target.value});}} placeholder="Proje genelinde paylaşılacak not, karar, önemli bilgi..." style={{ width:"100%", minHeight:120, padding:"9px", borderRadius:8, border:"1.5px solid #E2E8F0", fontSize:12, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", background:"#FAFBFC", outline:"none", lineHeight:1.6 }} />
          : <div style={{ minHeight:80, fontSize:12, color: projNotes.shared?"#1E293B":"#94A3B8", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{projNotes.shared||"Henüz not girilmemiş."}</div>
        }
      </div>

      <div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px" }}>
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
      </div>
    </div>

    {/* Right: user todos linked to this project */}
    <div style={{ flex:"0 0 300px", minWidth:260 }}>
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>Kişiye Özel Notlar</div>
      <div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px" }}>
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
      </div>

      {/* Person notes (if admin) */}
      {isAdmin&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px", marginTop:14 }}>
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
  </div>;
}

// Global style reset
const GlobalStyle = () => (
  <style>{`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; width: 100%; overflow: hidden; }
    body { font-family: Inter, Segoe UI, sans-serif; }
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

  const addProject=(data)=>{ const p={id:uid(),milestones:[],risks:[],members:[],...data}; setState(s=>({...s,projects:[...s.projects,p]})); addLog(currentUser.name,"project_create",`${p.name} projesi oluşturuldu`,p.name); };
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

  const excelDateToStr=(v)=>{
    if(typeof v==="number"){ const d=new Date(Math.round((v-25569)*86400*1000)); return d.toISOString().slice(0,10); }
    return String(v||"").trim();
  };

  const parseRows=(rows)=>{
    if(!rows||rows.length<2)return null;
    const startRow=String(rows[0][0]||"").toLowerCase().includes("milestone")?1:0;
    const mm={};
    for(let i=startRow;i<rows.length;i++){
      const c=(rows[i]||[]).map(x=>typeof x==="string"?x.trim():x);
      if(!c[0])continue;
      const n=String(c[0]);
      if(!mm[n])mm[n]={id:uid(),name:n,startDate:excelDateToStr(c[1]),dueDate:excelDateToStr(c[2]),status:STATUSES.includes(c[3])?c[3]:"Bekliyor",waitSource:String(c[4]||""),tasks:[]};
      if(c[5])mm[n].tasks.push({id:uid(),title:String(c[5]),status:STATUSES.includes(c[6])?c[6]:"Bekliyor",priority:PRIORITIES.includes(c[7])?c[7]:"Orta",assignee:String(c[8]||""),dueDate:excelDateToStr(c[9]),waitSource:String(c[10]||""),notes:String(c[11]||""),tags:String(c[12]||""),link:String(c[13]||""),timeEntries:[]});
    }
    return Object.values(mm);
  };

  const downloadTemplate=()=>{
    const rows=[
      ["Milestone Adı","Başlangıç (YYYY-AA-GG)","Termin (YYYY-AA-GG)","Milestone Durumu","Bekleme Kaynağı","Görev Adı","Görev Durumu","Öncelik","Sorumlu","Görev Termin","Görev Bekleme","Notlar","Etiketler","Baglanti"],
      ["Kapsam ve Fizibilite","2026-07-01","2026-07-21","Bekliyor","","Surec analizi","Bekliyor","Yüksek","Hakan B.","2026-07-10","","Akis diyagrami","analiz",""],
      ["Kapsam ve Fizibilite","2026-07-01","2026-07-21","Bekliyor","","ROI hesaplama","Bekliyor","Orta","Ayse K.","2026-07-15","","","analiz",""],
      ["Altyapi Hazirlik","2026-07-21","2026-08-18","Bekliyor","","Sunucu kurulumu","Bekliyor","Yüksek","Ayse K.","2026-07-28","","","altyapi",""],
      ["Altyapi Hazirlik","2026-07-21","2026-08-18","Bekliyor","Tedarikci","OPC-UA altyapi","Bekliyor","Yüksek","Ayse K.","2026-08-10","Teknik","Port 4840","altyapi",""],
      ["Makine Entegrasyonu","2026-08-18","2026-09-22","Bekliyor","","CNC baglanti","Bekliyor","Yüksek","Hakan B.","2026-09-01","","","makine",""],
      ["Test ve Validasyon","2026-09-22","2026-10-13","Bekliyor","","Fonksiyonel testler","Bekliyor","Yüksek","Hakan B.","2026-10-01","","","test",""],
      ["Canlia Alis","2026-10-13","2026-10-27","Bekliyor","","Operator egitimi","Bekliyor","Orta","Hakan B.","2026-10-20","","","egitim",""]
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=[{wch:22},{wch:18},{wch:18},{wch:16},{wch:16},{wch:26},{wch:14},{wch:10},{wch:16},{wch:14},{wch:14},{wch:24},{wch:14},{wch:20}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"Proje Planı");
    XLSX.writeFile(wb,"proje-plani-sablonu.xlsx");
  };

  const totalT=project?.milestones.reduce((a,m)=>a+m.tasks.length,0)||0;
  const doneT=project?.milestones.reduce((a,m)=>a+m.tasks.filter(t=>t.status==="Tamamland\u0131").length,0)||0;
  const progress=totalT?Math.round((doneT/totalT)*100):0;
  const overdueC=project?.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,0)||0;
  const criticalC=project?.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length,0)||0;

  const nav=[{id:"projects",icon:"P",label:"Projeler"},{id:"mytasks",icon:"T",label:"Görevlerim"},{id:"people",icon:"E",label:"Ekip"},{id:"logs",icon:"L",label:"Aktivite"}];

  return <><GlobalStyle /><div style={{ display:"flex", height:"100vh", width:"100vw", fontFamily:"Inter,Segoe UI,sans-serif", background:"#F8FAFC", color:"#1E293B", overflow:"hidden", position:"relative" }}>
    {/* Mobil ust bar */}
    {isMobile&&<div style={{ position:"fixed", top:0, left:0, right:0, height:50, background:"#1E293B", display:"flex", alignItems:"center", padding:"0 14px", zIndex:900, gap:10 }}>
      <button onClick={()=>setMobileMenuOpen(v=>!v)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", padding:4 }}>☰</button>
      <span style={{ fontSize:13, fontWeight:800, color:"#4A6CF7", letterSpacing:2 }}>CORJECT</span>
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
        <Avatar initials={currentUser.avatar} size={26} color={isAdmin?"#E11D48":"#4A6CF7"} />
      </div>
    </div>}
    {/* Mobil overlay arka plan */}
    {isMobile&&mobileMenuOpen&&<div onClick={()=>setMobileMenuOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:950 }} />}
    {/* Sidebar */}
    <div style={{ width:220, background:"#1E293B", display:"flex", flexDirection:"column", flexShrink:0,
      ...(isMobile?{ position:"fixed", top:0, left:mobileMenuOpen?0:-240, bottom:0, zIndex:960, transition:"left .25s ease", boxShadow:mobileMenuOpen?"4px 0 20px rgba(0,0,0,0.3)":"none" }:{}) }}>
      <div style={{ padding:"18px 16px 12px", borderBottom:"1px solid #334155" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#4A6CF7", letterSpacing:2, textTransform:"uppercase" }}>CORJECT</div>
            <button onClick={()=>{ setView("notifications"); setSelProject(null); setMobileMenuOpen(false); markAllRead(); }} style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:4 }}>
              <span style={{ fontSize:16 }}>B</span>
              {(state.notifications||[]).filter(n=>n.userId===currentUser?.id&&!n.read).length>0&&<span style={{ position:"absolute", top:0, right:0, width:8, height:8, background:"#E11D48", borderRadius:"50%" }} />}
            </button>
          </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
          <Avatar initials={currentUser.avatar} size={28} color={isAdmin?"#E11D48":"#4A6CF7"} />
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
          <span style={{ fontSize:11 }}>{n.icon}</span> {n.label}
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
      <div style={{ padding:"8px 12px", borderTop:"1px solid #334155", fontSize:10, display:"flex", alignItems:"center", gap:6 }}>
        <span style={{ width:7, height:7, borderRadius:"50%", flexShrink:0, background: syncStatus.s==="saved"?"#059669": syncStatus.s==="saving"?"#EA6C00": syncStatus.s==="error"?"#E11D48":"#475569" }} />
        <span style={{ color: syncStatus.s==="error"?"#FCA5A5":"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={syncStatus.msg}>
          {syncStatus.s==="saved"?"Kaydedildi": syncStatus.s==="saving"?"Kaydediliyor...": syncStatus.s==="error"?("HATA: "+syncStatus.msg.slice(0,40)):"Hazir"}
        </span>
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
            <h2 style={{ margin:0, fontSize:17, fontWeight:800 }}>{project.name}</h2>
            <Badge label={project.status} />
            {overdueC>0&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Gecikmiş: {overdueC}</span>}
            {criticalC>0&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Kritik: {criticalC}</span>}
            <div style={{ marginLeft:"auto", display:"flex", gap:7 }}>
              {isAdmin&&<><Btn small variant="secondary" onClick={()=>setModal({type:"editProject",data:project})}>Duzenle</Btn><Btn small variant="danger" onClick={()=>{if(confirm("Projeyi sil?"))deleteProject(project.id);}}>Sil</Btn></>}
              {isAdmin&&<><Btn small variant="success" onClick={()=>downloadCSVReport(project,state.people)}>CSV</Btn><Btn small variant="success" onClick={()=>generateHTMLReport(project,state.people,state.logs)}>HTML Rapor</Btn></>}
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
          <div style={{ display:"flex", gap:4, marginTop:10 }}>
            {[["tasks","Görevler"],["gantt","Proje Planı"],["risks","Riskler"],["tickets","Ticketlar"],["notlar","Notlar"],["projlogs","Log"]].map(([id,label])=><button key={id} onClick={()=>setProjectTab(id)} style={{ padding:"5px 13px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:12, background:projectTab===id?project.color:"#F1F5FF", color:projectTab===id?"#fff":"#64748B", fontFamily:"inherit" }}>{label}</button>)}
          </div>
        </div>

        {projectTab==="tasks"&&<div style={{ display:"flex", flex:1, overflow:"hidden", flexDirection:isMobile?"column":"row" }}>
          <div style={{ width:isMobile?"100%":225, maxHeight:isMobile?180:"none", borderRight:isMobile?"none":"1px solid #E2E8F0", borderBottom:isMobile?"1px solid #E2E8F0":"none", background:"#F8FAFC", overflow:"auto", padding:"11px 8px", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7, padding:"0 3px" }}>
              <span style={{ fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:1 }}>Milestonlar</span>
              {isAdmin&&<Btn small variant="secondary" onClick={()=>setModal({type:"addMilestone"})}>+ Ekle</Btn>}
            </div>
            {project.milestones.map(ms=>{const dl=delayLvl(ms.dueDate,ms.status);const isC=currentMs?.id===ms.id;return <div key={ms.id} onClick={()=>{ setSelMilestone(ms.id); setShowDoneTasks(false); }} style={{ padding:"9px 10px", borderRadius:10, marginBottom:4, background:selMilestone===ms.id?"#fff":"transparent", border:selMilestone===ms.id?`1.5px solid ${project.color}`:"1.5px solid transparent", cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ fontWeight:700, fontSize:11 }}>{ms.name}</span>{isC&&<span style={{ fontSize:9, background:project.color, color:"#fff", borderRadius:6, padding:"1px 5px", fontWeight:700 }}>AKTİF</span>}</div>
              <div style={{ marginTop:3, display:"flex", gap:3, flexWrap:"wrap", alignItems:"center" }}>
          <select value={ms.status} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();isAdmin&&updateMilestone(ms.id,{status:e.target.value});}} style={{ fontSize:10, borderRadius:8, border:`1.5px solid ${(S[ms.status]||{}).dot||"#E2E8F0"}`, padding:"2px 5px", background:(S[ms.status]||{}).bg||"#F8FAFC", color:(S[ms.status]||{}).text||"#64748B", fontWeight:600, cursor:isAdmin?"pointer":"default", fontFamily:"inherit" }} disabled={!isAdmin}>
            {Object.keys(S).map(s=><option key={s}>{s}</option>)}
          </select>
          {dl&&<DelayBadge dateStr={ms.dueDate} status={ms.status} />}
        </div>
              <div style={{ marginTop:2, fontSize:10, color:"#94A3B8" }}>{fmt(ms.dueDate)} · {ms.tasks.filter(t=>t.status==="Tamamland\u0131").length}/{ms.tasks.length}</div>
              {ms.waitSource&&<div style={{ marginTop:1, fontSize:10, color:"#EA6C00", fontWeight:600 }}>Bek: {ms.waitSource}</div>}
            </div>;})}
            {project.milestones.length===0&&<div style={{ padding:"14px 7px", textAlign:"center", color:"#94A3B8", fontSize:11 }}>Milestone yok.</div>}
          </div>
          <div style={{ flex:1, overflow:"auto", padding:"15px 20px" }}>
            {!milestone&&<div style={{ textAlign:"center", padding:"48px", color:"#94A3B8" }}><div style={{ fontSize:28, marginBottom:8 }}>o</div><div style={{ fontSize:13 }}>Milestone seçin</div></div>}
            {milestone&&<MilestoneTaskPanel milestone={milestone} project={project} people={state.people} isAdmin={isAdmin} showDone={showDoneTasks} setShowDone={setShowDoneTasks}
              onEdit={(ms)=>setModal({type:"editMilestone",data:ms})} onDelete={(id)=>{if(confirm("Silinsin mi?"))deleteMilestone(id);}}
              onAddTask={(msId)=>setModal({type:"addTask",msId})} onEditTask={(msId,task)=>setModal({type:"editTask",msId,data:task})}
              onDeleteTask={(msId,taskId)=>{if(confirm("Silinsin mi?"))deleteTask(msId,taskId);}}
              onCheckTask={(msId,taskId,c)=>updateTask(msId,taskId,{status:c?"Tamamland\u0131":"Bekliyor"})}
            onTimeTask={(msId,task)=>setModal({type:"timeLog",msId,data:task})}
            />}
          </div>
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
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Projeler</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{visibleProjects.length} proje</p></div>
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

      {view==="people"&&<div style={{ padding:"22px 26px", flex:1, overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Ekip</h2></div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addPerson"})}>+ Kişi Ekle</Btn>}
        </div>
        {(()=>{ const ot=state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>delayLvl(t.dueDate,t.status)).map(t=>({...t,projectName:proj.name,personName:state.people.find(p=>p.id===t.assignee)?.name,dl:delayLvl(t.dueDate,t.status)})))); if(!ot.length)return null;
          return <div style={{ background:"#FFF1F2", border:"1.5px solid #FCA5A5", borderRadius:12, padding:"13px 17px", marginBottom:18 }}>
            <div style={{ fontWeight:700, fontSize:12, color:"#E11D48", marginBottom:7 }}>Termin Uyarıları</div>
            {ot.slice(0,8).map(t=><div key={t.id} style={{ display:"flex", gap:8, alignItems:"center", fontSize:12, marginBottom:3 }}>
              <span style={{ background:t.dl==="critical"?"#E11D48":"#EA6C00", color:"#fff", borderRadius:8, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{t.dl==="critical"?"KRİTİK":"GECİKMİŞ"}</span>
              <span style={{ fontWeight:600 }}>{t.title}</span>
              <span style={{ color:"#94A3B8" }}>— {t.personName||"?"} | {t.projectName} | {fmt(t.dueDate)}</span>
            </div>)}
          </div>;
        })()}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:12 }}>
          {state.people.map(p=>{
            const allT=[...state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===p.id))),...(state.personalTasks||[]).filter(t=>t.assignee===p.id)];
            const active=allT.filter(t=>t.status==="Devam Ediyor").length;
            const waiting=allT.filter(t=>t.status==="Bekliyor").length;
            const delayed=allT.filter(t=>delayLvl(t.dueDate,t.status)==="normal").length;
            const crit=allT.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length;
            const comp=allT.filter(t=>t.status==="Tamamland\u0131").length;
            const projC=[...new Set(state.projects.filter(proj=>proj.milestones.some(ms=>ms.tasks.some(t=>t.assignee===p.id))).map(pr=>pr.id))].length;
            return <div key={p.id} style={{ background:"#fff", borderRadius:13, padding:"16px", border:"1.5px solid #E2E8F0" }}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><Avatar initials={p.avatar} size={40} color={p.isAdmin?"#E11D48":"#4A6CF7"} /></div>
              <div style={{ fontWeight:700, fontSize:13, textAlign:"center" }}>{p.name}</div>
              <div style={{ color:"#64748B", fontSize:11, textAlign:"center", marginTop:2 }}>{p.role}</div>
              {p.isAdmin&&<div style={{ textAlign:"center", marginTop:3 }}><span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:8, padding:"1px 7px", fontSize:10, fontWeight:700 }}>YÖN</span></div>}
              <div style={{ fontSize:10, color:"#94A3B8", textAlign:"center", marginTop:2 }}>{projC} proje</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, marginTop:10 }}>
                {[["Aktif",active,"#4A6CF7"],["Beklem.",waiting,"#94A3B8"],["Gecikmiş",delayed,"#EA6C00"],["Kritik",crit,"#E11D48"]].map(([l,c,col])=><div key={l} style={{ background:col+"15", borderRadius:8, padding:"5px", textAlign:"center" }}><div style={{ fontSize:14, fontWeight:800, color:col }}>{c}</div><div style={{ fontSize:9, color:"#64748B", marginTop:1 }}>{l}</div></div>)}
              </div>
              {comp>0&&<div style={{ textAlign:"center", fontSize:11, color:"#059669", marginTop:6, fontWeight:600 }}>Tamamlandı: {comp}</div>}
              <div style={{ display:"flex", gap:5, marginTop:8 }}>
                <Btn small variant="secondary" style={{ flex:1 }} onClick={()=>setModal({type:"personDetail",data:p})}>Detay</Btn>
                {isAdmin&&p.id!==currentUser.id&&<Btn small variant="danger" onClick={()=>{if(confirm("Kaldırılsın mı?"))deletePerson(p.id);}}>x</Btn>}
              </div>
            </div>;
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
    {modal?.type==="personDetail"&&<PersonDetailModal person={modal.data} projects={state.projects} personalTasks={state.personalTasks} onClose={()=>setModal(null)} />}
    {modal?.type==="addRisk"&&<RiskModal onClose={()=>setModal(null)} onSave={addRisk} />}
    {modal?.type==="editProfile"&&<UserEditModal person={currentUser} onClose={()=>setModal(null)} onSave={(d)=>{ setState(s=>({...s,people:s.people.map(p=>p.id===currentUser.id?{...p,...d}:p)})); }} />}
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
  const add=()=>{
    const h=parseFloat(hours);
    if(!h||h<=0){alert("Geçerli saat girin.");return;}
    onSave([...entries,{id:uid(),hours:h,date,note,user:currentUser.name,userId:currentUser.id,ts:now()}]);
    setHours("");setNote("");
  };
  const remove=(id)=>onSave(entries.filter(e=>e.id!==id));
  return <Modal title={`Süre Girişi — ${task.title}`} onClose={onClose} wide>
    <div style={{ background:"#F5F3FF", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ fontSize:13, fontWeight:700, color:"#7C3AED" }}>Toplam Harcanan</span>
      <span style={{ fontSize:20, fontWeight:800, color:"#7C3AED" }}>{total} saat</span>
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
  const toggle = (id) => setExpandedMs(s=>({...s,[id]:!s[id]}));
  const findName=(id)=>people.find(p=>p.id===id)?.name||"—";
  const thStyle = { padding:"8px 12px", textAlign:"left", fontWeight:600, color:"#64748B", borderBottom:"1px solid #E2E8F0", fontSize:11 };
  const tdStyle = (extra={}) => ({ padding:"8px 12px", borderBottom:"1px solid #F1F5FF", fontSize:12, ...extra });
  return <div style={{ marginTop:24, background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", overflow:"hidden" }}>
    <div style={{ padding:"12px 16px", borderBottom:"1.5px solid #E2E8F0", fontWeight:700, fontSize:13 }}>Plan Listesi</div>
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
        <thead><tr style={{ background:"#F8FAFC" }}>
          {["","Milestone / Görev","Hedef Başl.","Hedef Bitiş","Gerç. Başl.","Gerç. Bitiş","Durum","İlerleme"].map(h=><th key={h} style={thStyle}>{h}</th>)}
        </tr></thead>
        <tbody>
          {project.milestones.map((m,mi)=>{
            const done=m.tasks.filter(t=>t.status==="Tamamlandı").length;
            const pct=m.tasks.length?Math.round(done/m.tasks.length*100):0;
            const isExp=expandedMs[m.id];
            const bgs=["#FAFBFF","#F5F9FF"];
            return [
              <tr key={m.id} style={{ background:bgs[mi%2], cursor:"pointer" }} onClick={()=>toggle(m.id)}>
                <td style={{ ...tdStyle(), width:28, color:"#94A3B8", fontWeight:700 }}>{isExp?"▾":"▸"}</td>
                <td style={{ ...tdStyle(), fontWeight:700 }}>{m.name}</td>
                <td style={tdStyle({ color:"#64748B" })}>{fmt(m.startDate)}</td>
                <td style={tdStyle({ color:"#64748B" })}>{fmt(m.dueDate)}</td>
                <td style={tdStyle({ color:m.actualStart?"#1E293B":"#CBD5E1" })}>{fmt(m.actualStart)||"—"}</td>
                <td style={tdStyle({ color:m.actualEnd?"#1E293B":"#CBD5E1" })}>{fmt(m.actualEnd)||"—"}</td>
                <td style={tdStyle()}><Badge label={m.status} /></td>
                <td style={tdStyle()}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ width:60, height:6, background:"#E2E8F0", borderRadius:4 }}><div style={{ width:`${pct}%`, height:"100%", background:project.color, borderRadius:4 }} /></div>
                    <span style={{ fontSize:11, color:"#64748B" }}>{done}/{m.tasks.length}</span>
                  </div>
                </td>
              </tr>,
              ...(isExp?m.tasks.map(t=>{
                const dl=delayLvl(t.dueDate,t.status);
                return <tr key={t.id} style={{ background:"#F8FAFC" }}>
                  <td style={{ ...tdStyle(), color:"#CBD5E1" }}></td>
                  <td style={{ ...tdStyle(), paddingLeft:28, color:"#1E293B" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:11 }}>{t.title}</span>
                      {t.link&&(()=>{const jm=String(t.link).match(/([A-Z][A-Z0-9]+-[0-9]+)/);return <a href={t.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:10, color:"#0052CC", background:"#DEEBFF", borderRadius:4, padding:"1px 5px", fontWeight:700, textDecoration:"none" }}>{jm?jm[1]:"Jira"}</a>;})()}
                    </div>
                  </td>
                  <td style={tdStyle({ color:"#94A3B8" })}>—</td>
                  <td style={tdStyle({ color:dl?"#E11D48":"#64748B" })}>{fmt(t.dueDate)}</td>
                  <td style={tdStyle({ color:"#CBD5E1" })}>—</td>
                  <td style={tdStyle({ color:"#CBD5E1" })}>—</td>
                  <td style={tdStyle()}><Badge label={t.status} /></td>
                  <td style={tdStyle({ color:"#64748B", fontSize:11 })}>{findName(t.assignee)}</td>
                </tr>;
              }):[])
            ];
          })}
        </tbody>
      </table>
    </div>
  </div>;
}


// ─── Tickets Panel ────────────────────────────────────────────────────────────
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
      {tickets.map(t=><div key={t.id} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:"1.5px solid #E2E8F0", display:"flex", gap:12, alignItems:"flex-start", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[t.type]||"#94A3B8", marginTop:4, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:13 }}>{t.title}</span>
            <span style={{ background:(TYPE_COLORS[t.type]||"#94A3B8")+"22", color:TYPE_COLORS[t.type]||"#94A3B8", borderRadius:8, padding:"1px 8px", fontSize:11, fontWeight:600 }}>{t.type}</span>
            <span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"1px 8px", fontSize:11 }}>{t.priority}</span>
            {t.jiraId&&<a href={t.jiraLink||"#"} target="_blank" rel="noreferrer" style={{ background:"#DEEBFF", color:"#0052CC", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:700, textDecoration:"none" }}>{t.jiraId}</a>}
            <select value={t.status||"Açık"} onChange={e=>updateTicket(t.id,{status:e.target.value})} style={{ fontSize:11, borderRadius:6, border:"1px solid #E2E8F0", padding:"2px 6px", fontFamily:"inherit" }}>
              {["Açık","İnceleniyor","Çözüldü","Kapatıldı"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          {t.description&&<div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>{t.description}</div>}
          <div style={{ fontSize:11, color:"#94A3B8" }}>{t.author} · {new Date(t.ts).toLocaleDateString("tr-TR")}</div>
        </div>
        {(isAdmin||t.author===currentUser.name)&&<button onClick={()=>deleteTicket(t.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:16 }}>×</button>}
      </div>)}
    </div>
    {modal?.type==="add"&&<Modal title="Ticket Ekle" onClose={()=>setModal(null)}>
      <TicketForm onSave={(d)=>{addTicket(d);setModal(null);}} onClose={()=>setModal(null)} types={TICKET_TYPES} prios={TICKET_PRIOS} />
    </Modal>}
  </div>;
}
function TicketForm({ onSave, onClose, types, prios }) {
  const [f,setF]=useState({ title:"", type:"Görev", priority:"Orta", description:"", jiraId:"", jiraLink:"", status:"Açık" });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <div>
    <Field label="Başlık *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Tip"><select style={iStyle} value={f.type} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    <Field label="Açıklama"><textarea style={{ ...iStyle, height:80, resize:"vertical" }} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Jira ID"><input style={iStyle} value={f.jiraId} onChange={e=>upd("jiraId",e.target.value)} placeholder="PROJ-123" /></Field>
      <Field label="Jira Link"><input style={iStyle} value={f.jiraLink} onChange={e=>upd("jiraLink",e.target.value)} placeholder="https://..." /></Field>
    </div>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); }}>Kaydet</Btn></div>
  </div>;
}

// ─── User Edit Modal ──────────────────────────────────────────────────────────
function UserEditModal({ person, onClose, onSave }) {
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role||"");
  return <Modal title="Profilimi Düzenle" onClose={onClose}>
    <Field label="Ad Soyad *"><input style={iStyle} value={name} onChange={e=>setName(e.target.value)} /></Field>
    <Field label="Rol / Unvan"><input style={iStyle} value={role} onChange={e=>setRole(e.target.value)} /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!name.trim())return; onSave({name,role}); onClose(); }}>Kaydet</Btn></div>
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
  const [f,setF]=useState({ title:"", status:"Bekliyor", priority:"Orta", assignee:"", dueDate:"", notes:"", waitSource:"", link:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Görev Başlığı *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    <Field label="Sorumlu"><select style={iStyle} value={f.assignee} onChange={e=>upd("assignee",e.target.value)}><option value="">- Seç -</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <Field label="Termin"><input type="date" style={iStyle} value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} /></Field>
    <Field label="Bekleme Kaynağı"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{WAIT.map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Notlar"><input style={iStyle} value={f.notes} onChange={e=>upd("notes",e.target.value)} /></Field>
    <Field label="Jira Linki"><input style={iStyle} value={f.link||""} onChange={e=>upd("link",e.target.value)} placeholder="https://sirket.atlassian.net/browse/PROJ-123" /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function PersonalTaskModal({ title, initial, onClose, onSave, people, isAdmin, currentUser }) {
  const [f,setF]=useState({ title:"", status:"Bekliyor", priority:"Orta", assignee:isAdmin?"":currentUser.id, dueDate:"", notes:"", waitSource:"", ...initial });
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Görev Başlığı *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    {isAdmin?<Field label="Atanacak Kisi"><select style={iStyle} value={f.assignee} onChange={e=>upd("assignee",e.target.value)}><option value="">- Seç -</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>:<div style={{ background:"#F1F5FF", borderRadius:8, padding:"8px 12px", marginBottom:13, fontSize:12, color:"#4A6CF7" }}>Görev size atanacak: <b>{currentUser.name}</b></div>}
    <Field label="Termin"><input type="date" style={iStyle} value={f.dueDate} onChange={e=>upd("dueDate",e.target.value)} /></Field>
    <Field label="Bekleme Kaynağı"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{WAIT.map(s=><option key={s}>{s}</option>)}</select></Field>
    <Field label="Notlar"><input style={iStyle} value={f.notes} onChange={e=>upd("notes",e.target.value)} /></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.title.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function PersonModal({ onClose, onSave }) {
  const [f,setF]=useState({ name:"", role:"", isAdmin:false });
  return <Modal title="Ekip Üyesi Ekle" onClose={onClose}>
    <Field label="Ad Soyad *"><input style={iStyle} value={f.name} onChange={e=>setF(s=>({...s,name:e.target.value}))} /></Field>
    <Field label="Rol"><input style={iStyle} value={f.role} onChange={e=>setF(s=>({...s,role:e.target.value}))} placeholder="Geliştirici, Tasarımcı..." /></Field>
    <Field label="Yetki">
      <div style={{ display:"flex", gap:10 }}>
        {[["Ekip Üyesi",false],["Yönetici",true]].map(([l,v])=><div key={l} onClick={()=>setF(s=>({...s,isAdmin:v}))} style={{ flex:1, padding:"9px", borderRadius:8, border:`1.5px solid ${f.isAdmin===v?"#4A6CF7":"#E2E8F0"}`, cursor:"pointer", textAlign:"center", background:f.isAdmin===v?"#F1F5FF":"#fff", fontSize:12, fontWeight:600, color:f.isAdmin===v?"#4A6CF7":"#64748B" }}>{l}</div>)}
      </div>
    </Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.name.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
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
