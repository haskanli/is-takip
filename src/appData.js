const uid = () => Math.random().toString(36).slice(2, 9);

export const WAIT = ["PM","M\u00fc\u015fteri","ERP","Tedarik\u00e7i","Teknik","\u00dcr\u00fcn-Teknoloji","Y\u00f6netim","Di\u011fer"];
export const DEFAULT_ACTION_TAGS = ["Toplantı","Telefon / Görüşme","Yazışma","Sistem Kontrolü","Saha Ziyareti","Takip","Karar","Bilgilendirme","Diğer"];
export const RESPONSIBILITY_GROUPS = ["Proje Ekibi","\u00dcr\u00fcn Ekibi","Yaz\u0131l\u0131m Ekibi","M\u00fc\u015fteri","Tedarik\u00e7i","Di\u011fer"];
export const TRAINING_SCOPES = ["Operatör Eğitimi","Yönetici Eğitimi","Hatırlatma Eğitimi","Proje Devri Eğitimi","Süper Kullanıcı Eğitimi","Teknik Eğitim","Diğer"];
export const COST_CATEGORIES = ["Saha Yakıt","Yetkili Servis İşçilik","Donanım","Lisans","Konaklama","Ulaşım","Diğer"];
export const DEFAULT_ACTIVE_MODULES = ["Üretim Takip","Bakım","Kalite","İzlenebilirlik","Satın Alma","Connected Supplier"];
export const DEFAULT_COST_SETTINGS = {fuelConsumptionLtPer100Km:6.5,fuelTryPerLt:45,usdTry:32};
export const mapsUrl = (location={}) => {
  const query=[location.address,location.district,location.city].filter(Boolean).join(", ");
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:"";
};
export const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
export const projectCostSettings = (project) => ({...DEFAULT_COST_SETTINGS,...(project?.costSettings||{})});
export const fuelCost = ({roundTripKm=0,settings=DEFAULT_COST_SETTINGS}) => {
  const liters=(Number(roundTripKm)||0)*(Number(settings.fuelConsumptionLtPer100Km)||6.5)/100;
  const tryAmount=liters*(Number(settings.fuelTryPerLt)||0);
  const usdAmount=tryAmount/(Number(settings.usdTry)||1);
  return {liters:Math.round(liters*10)/10,tryAmount:Math.round(tryAmount),usdAmount:Math.round(usdAmount*100)/100};
};
export const MES_READINESS_TEMPLATE = [
  {id:"scope",category:"Y\u00f6neti\u015fim",text:"Proje kapsam\u0131, hedef KPI'lar, ba\u015far\u0131 \u00f6l\u00e7\u00fctleri ve kapsam d\u0131\u015f\u0131 konular onayland\u0131.",weight:8},
  {id:"sponsor",category:"Y\u00f6neti\u015fim",text:"Proje sponsoru, karar mekanizmas\u0131, RACI ve eskalasyon yolu belirlendi.",weight:7},
  {id:"process",category:"S\u00fcre\u00e7 ve Model",text:"Mevcut ve hedef \u00fcretim s\u00fcre\u00e7leri ile ISA-95 ekipman hiyerar\u015fisi tan\u0131mland\u0131.",weight:8},
  {id:"usecases",category:"S\u00fcre\u00e7 ve Model",text:"MES kullan\u0131m senaryolar\u0131, istisnalar ve operasyon kurallar\u0131 onayland\u0131.",weight:7},
  {id:"masterdata",category:"Veri",text:"Malzeme, rota, operasyon, vardiya, personel ve ekipman ana verilerinin sahibi belirlendi.",weight:8},
  {id:"quality",category:"Veri",text:"Kaynak veri kalitesi kontrol edildi; temizleme ve migrasyon plan\u0131 haz\u0131r.",weight:7},
  {id:"interfaces",category:"Entegrasyon",text:"ERP, kalite, bak\u0131m, depo ve di\u011fer sistem entegrasyonlar\u0131n\u0131n kapsam\u0131 ve veri y\u00f6n\u00fc belirlendi.",weight:8},
  {id:"contracts",category:"Entegrasyon",text:"API/protokol, hata y\u00f6netimi, tekrar deneme, sahiplik ve test verileri tan\u0131mland\u0131.",weight:7},
  {id:"infrastructure",category:"OT Altyap\u0131",text:"Sunucu, a\u011f, zaman senkronizasyonu, yedekleme, kapasite ve ortam ayr\u0131m\u0131 haz\u0131r.",weight:8},
  {id:"security",category:"OT Altyap\u0131",text:"OT/IT a\u011f s\u0131n\u0131rlar\u0131, uzaktan eri\u015fim, hesaplar, yetkiler ve siber g\u00fcvenlik kontrolleri onayland\u0131.",weight:7},
  {id:"equipment",category:"Saha Haz\u0131rl\u0131\u011f\u0131",text:"Makine/PLC ba\u011flant\u0131 envanteri, protokoller, sinyal listeleri ve fiziksel eri\u015fim haz\u0131r.",weight:6},
  {id:"owners",category:"Saha Haz\u0131rl\u0131\u011f\u0131",text:"Hat baz\u0131nda teknik sorumlular ve planl\u0131 duru\u015f/ba\u011flant\u0131 zamanlar\u0131 belirlendi.",weight:4},
  {id:"test",category:"Test ve Kabul",text:"FAT/SAT/UAT senaryolar\u0131, kabul kriterleri, test sorumlular\u0131 ve kan\u0131t format\u0131 haz\u0131r.",weight:6},
  {id:"cutover",category:"Test ve Kabul",text:"Canl\u0131ya ge\u00e7i\u015f, geri d\u00f6n\u00fc\u015f, veri do\u011frulama ve destek plan\u0131 onayland\u0131.",weight:4},
  {id:"training",category:"De\u011fi\u015fim Y\u00f6netimi",text:"Anahtar kullan\u0131c\u0131lar, e\u011fitim, ileti\u015fim ve vardiya bazl\u0131 benimseme plan\u0131 haz\u0131r.",weight:3},
  {id:"support",category:"De\u011fi\u015fim Y\u00f6netimi",text:"Hypercare, SLA, izleme, sorun sahipli\u011fi ve kal\u0131c\u0131 destek modeli belirlendi.",weight:2},
];
export const createReadinessChecklist = () => MES_READINESS_TEMPLATE.map(item=>({...item,status:"unanswered",note:""}));
export const readinessScore = (project) => {
  const items=project?.readinessChecklist||createReadinessChecklist();
  const total=items.reduce((sum,item)=>sum+(Number(item.weight)||0),0)||1;
  const earned=items.reduce((sum,item)=>sum+(Number(item.weight)||0)*(item.status==="ready"?1:item.status==="partial"?0.5:0),0);
  return Math.round(earned/total*100);
};
export const remainingResponsibility = (project) => {
  const open=(project?.milestones||[]).flatMap(ms=>ms.tasks||[]).filter(task=>task.status!=="Tamamland\u0131");
  const totals={};
  open.forEach(task=>{const group=task.responsibilityGroup||"Proje Ekibi";totals[group]=(totals[group]||0)+(Number(task.estimatedHours)||1);});
  const all=Object.values(totals).reduce((sum,value)=>sum+value,0)||1;
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([group,value])=>({group,value,percent:Math.round(value/all*100)}));
};
export const nextReportRunAt = (schedule, from=new Date()) => {
  const localParts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(from);
  const part=type=>Number(localParts.find(item=>item.type===type)?.value||0);
  const calendar=new Date(Date.UTC(part("year"),part("month")-1,part("day"),12));
  const [hour,minute]=String(schedule.time||"09:00").split(":").map(Number);
  if(schedule.frequency==="monthly") calendar.setUTCMonth(calendar.getUTCMonth()+1,1);
  else {
    const target=Number(schedule.weekday||1);
    calendar.setUTCDate(calendar.getUTCDate()+(target-calendar.getUTCDay()+7)%7);
  }
  const toDate=()=>`${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth()+1).padStart(2,"0")}-${String(calendar.getUTCDate()).padStart(2,"0")}`;
  let next=new Date(`${toDate()}T${String(hour||0).padStart(2,"0")}:${String(minute||0).padStart(2,"0")}:00+03:00`);
  if(next<=from){
    if(schedule.frequency==="monthly") calendar.setUTCMonth(calendar.getUTCMonth()+1,1);
    else calendar.setUTCDate(calendar.getUTCDate()+7);
    next=new Date(`${toDate()}T${String(hour||0).padStart(2,"0")}:${String(minute||0).padStart(2,"0")}:00+03:00`);
  }
  return next.toISOString();
};
export const TICKET_STATUSES = ["Açık","Operasyon İncelemesinde","Ürün Değerlendirmesinde","Jira'da Çalışılıyor","Operasyon Testinde","Test Başarısız","Yayına Hazır","Müşteri Onayında","Müşteri Reddetti","Tamamlandı","Beklemede","İptal Edildi"];
export const TICKET_CATEGORIES = ["Operasyonel","Bug","Geliştirme","Entegrasyon","İyileştirme","Veri","Eğitim","Diğer"];
export const ORG_LEVELS = [
  { id:"ceo", label:"CEO", rank:1 },
  { id:"coo", label:"COO", rank:2 },
  { id:"operations_director", label:"Operasyon Direktörü", rank:3 },
  { id:"project_director", label:"Proje Müdürü", rank:4 },
  { id:"project_manager", label:"Proje Yöneticisi", rank:5 },
  { id:"process_lead", label:"Süreç Lideri", rank:6 },
  { id:"field_engineer", label:"Saha Mühendisi", rank:7 },
];
export const orgLevelLabel = (id) => ORG_LEVELS.find(level=>level.id===id)?.label || "Atanmamış";
export const organizationRoles = (state) => {
  const custom=state?.organizationRoles||[];
  return [...ORG_LEVELS,...custom].filter((role,index,list)=>list.findIndex(item=>item.id===role.id)===index);
};
export const milestoneStatusFromTasks = (tasks=[]) => {
  if(!tasks.length)return "Başlamadı";
  if(tasks.every(task=>task.status==="Tamamlandı"))return "Tamamlandı";
  if(tasks.every(task=>["Başlamadı","Bekliyor"].includes(task.status)))return "Başlamadı";
  if(tasks.some(task=>task.status==="Engellendi"))return "Engellendi";
  return "Devam Ediyor";
};
export const normalizeMilestone = (milestone) => {
  const tasks=milestone.tasks||[];
  const starts=tasks.map(task=>task.startDate||task.dueDate).filter(Boolean);
  const dues=tasks.map(task=>task.dueDate).filter(Boolean);
  return {
    ...milestone,
    status:milestoneStatusFromTasks(tasks),
    startDate:starts.length?starts.reduce((a,b)=>a<b?a:b):milestone.startDate||"",
    dueDate:dues.length?dues.reduce((a,b)=>a>b?a:b):milestone.dueDate||"",
  };
};
export const COLORS = ["#4A6CF7","#059669","#EA6C00","#E11D48","#7C3AED","#0EA5E9","#DB2777","#D97706"];

export const MES_TEMPLATES = [
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

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
};

export const buildFromTemplate = (tpl, startDate) => ({
  milestones: tpl.milestones.map(m => ({
    id: uid(), name: m.name,
    startDate: addDays(startDate, m.offsetDays),
    dueDate: addDays(startDate, m.offsetDays + m.durationDays),
    status: "Bekliyor", waitSource: "",
    tasks: m.tasks.map(t => ({ id:uid(), title:t, status:"Bekliyor", priority:"Orta", assignee:"", dueDate: addDays(startDate, m.offsetDays + m.durationDays), notes:"", waitSource:"" }))
  }))
});

// ─── Demo Data ──────────────────────────────────────────────────────────────
export const DEMO = {
  people:[
    { id:"p1", name:"Hakan", email:"", role:"Y\u00f6netici", avatar:"H", isAdmin:true },
    { id:"p2", name:"Ay\u015fe K.", email:"", role:"Geli\u015ftirici", avatar:"AK", isAdmin:false },
    { id:"p3", name:"Mert D.", email:"", role:"Tasar\u0131mc\u0131", avatar:"MD", isAdmin:false },
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
  fieldPlans:[],
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

export const load = () => JSON.parse(JSON.stringify(DEMO)); // baslangic — gercek veri useEffect ile yuklenir

export const normalizeTicketNumbers=(state)=>{
  const entries=Object.entries(state?.projectTickets||{}).flatMap(([projectId,tickets])=>(tickets||[]).map(ticket=>({projectId,ticket})));
  entries.sort((a,b)=>`${a.ticket.ts||a.ticket.createdAt||""}-${a.ticket.id||""}`.localeCompare(`${b.ticket.ts||b.ticket.createdAt||""}-${b.ticket.id||""}`));
  const numbers=new Map();
  const used=new Set();
  entries.forEach(({projectId,ticket})=>{
    const match=String(ticket.ticketNo||"").match(/^CJT-(\d+)$/);
    const sequence=match?Number(match[1]):0;
    if(sequence>0&&!used.has(sequence)){
      used.add(sequence);
      numbers.set(`${projectId}:${ticket.id}`,`CJT-${sequence}`);
    }
  });
  let next=1;
  entries.forEach(({projectId,ticket})=>{
    const key=`${projectId}:${ticket.id}`;
    if(numbers.has(key))return;
    while(used.has(next))next++;
    numbers.set(key,`CJT-${next}`);
    used.add(next);
    next++;
  });
  return {...state,
    projects:(state?.projects||[]).map(project=>({...project,milestones:(project.milestones||[]).map(normalizeMilestone)})),
    projectTickets:Object.fromEntries(Object.entries(state?.projectTickets||{}).map(([projectId,tickets])=>[projectId,(tickets||[]).map(ticket=>({...ticket,ticketNo:numbers.get(`${projectId}:${ticket.id}`)}))]))
  };
};
