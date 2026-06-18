import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { getJiraIssue } from "./jira";
import {
  assignTasksWithNotification,
  createTicketWithNotification,
  notifyTicketAssignment,
  sendManagedTemplateEmail,
} from "./email";
import { apiHeaders, apiUrl, isPublicCorjectHost } from "./api";
import {
  commissioningMachines,
  fieldPlanHours,
  nextTicketNumber,
  projectPmIds,
  projectStakeholders,
  ticketNumber,
} from "./domain/projectHelpers.js";
import {
  CustomerContactEditor,
  MultiChoiceFilter,
  PeopleMultiSelect,
  StakeholderEditor,
} from "./ui/formControls.jsx";
import { OrganizationPanel as SharedOrganizationPanel } from "./ui/managementComponents.jsx";
import {
  PersonalTaskModal as SharedPersonalTaskModal,
  TaskCard as SharedTaskCard,
  TaskDetailModal as SharedTaskDetailModal,
  TaskModal as SharedTaskModal,
  TimeLogModal as SharedTimeLogModal,
} from "./ui/taskComponents.jsx";
import { Avatar, Btn, Card, Field, Icon, Modal, iStyle, lStyle } from "./ui/primitives.jsx";
import {
  Badge,
  DelayBadge,
  PRIORITIES,
  STATUSES,
  STATUS_COLORS as S,
  daysDiff,
  delayLvl,
} from "./ui/status.jsx";
import * as XLSX from "xlsx";
import corjectLogo from "./assets/corject-logo.png";
import {
  DEFAULT_EMAIL_TEMPLATES,
  renderManagedTemplate,
  resolveEmailTemplates,
  resolveTenantProfile,
} from "../server/services/emailTemplate.js";

const APP_VERSION = "v1.25.1";
const REQUIRE_AUTH = import.meta.env.VITE_REQUIRE_AUTH === "true" || isPublicCorjectHost;
const USE_DATA_API = import.meta.env.VITE_DATA_API === "true" || isPublicCorjectHost;
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = (d) => d ? new Date(d).toLocaleDateString("tr-TR") : "—";
const fmtFull = (d) => d ? new Date(d).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const now = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentTimeStr = () => new Date().toTimeString().slice(0, 5);
const slackAvatarUrl = (user) => {
  const metadata = user?.user_metadata || {};
  const identityData = (user?.identities || [])
    .map(identity => identity?.identity_data || {})
    .find(data => data.avatar_url || data.picture) || {};
  const value =
    metadata.avatar_url ||
    metadata.picture ||
    identityData.avatar_url ||
    identityData.picture ||
    "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};
const isNotificationForUser = (notification, user) => {
  if (!notification || !user) return false;
  if (notification.userId && notification.userId === user.id) return true;
  const noticeEmail = String(notification.userEmail || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();
  return Boolean(noticeEmail && userEmail && noticeEmail === userEmail);
};

const WAIT = ["PM","M\u00fc\u015fteri","ERP","Tedarik\u00e7i","Teknik","\u00dcr\u00fcn-Teknoloji","Y\u00f6netim","Di\u011fer"];
const DEFAULT_ACTION_TAGS = ["Toplantı","Telefon / Görüşme","Yazışma","Sistem Kontrolü","Saha Ziyareti","Takip","Karar","Bilgilendirme","Diğer"];
const MACHINE_CONTROL_REASONS = [
  "Ping yok",
  "Telnet yok",
  "Adet Saymıyor",
  "Makine Verisi Yok",
  "Sunucu Kapanmış",
  "Pm2 Prosesleri Durmuş",
  "Lisans Bitmiş",
  "Ip Adresi Değişmiş",
  "Kablolaması Eksik Yapılmış",
  "Problem Görünmüyor Ama Veri Yok (!!!)",
];
const RESPONSIBILITY_GROUPS = ["Proje Ekibi","\u00dcr\u00fcn Ekibi","Yaz\u0131l\u0131m Ekibi","M\u00fc\u015fteri","Tedarik\u00e7i","Di\u011fer"];
const TRAINING_SCOPES = ["Operatör Eğitimi","Yönetici Eğitimi","Hatırlatma Eğitimi","Proje Devri Eğitimi","Süper Kullanıcı Eğitimi","Teknik Eğitim","Diğer"];
const COST_CATEGORIES = ["Saha Yakıt","Yetkili Servis İşçilik","Donanım","Lisans","Konaklama","Ulaşım","Diğer"];
const DEFAULT_ACTIVE_MODULES = ["Üretim Takip","Bakım","Kalite","İzlenebilirlik","Satın Alma","Connected Supplier"];
const DEFAULT_COST_SETTINGS = {fuelConsumptionLtPer100Km:6.5,fuelTryPerLt:45,usdTry:32};
const mapsUrl = (location={}) => {
  const query=[location.address,location.district,location.city].filter(Boolean).join(", ");
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:"";
};
const escapeHtml = (value="") => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const projectCostSettings = (project) => ({...DEFAULT_COST_SETTINGS,...(project?.costSettings||{})});
const fuelCost = ({roundTripKm=0,settings=DEFAULT_COST_SETTINGS}) => {
  const liters=(Number(roundTripKm)||0)*(Number(settings.fuelConsumptionLtPer100Km)||6.5)/100;
  const tryAmount=liters*(Number(settings.fuelTryPerLt)||0);
  const usdAmount=tryAmount/(Number(settings.usdTry)||1);
  return {liters:Math.round(liters*10)/10,tryAmount:Math.round(tryAmount),usdAmount:Math.round(usdAmount*100)/100};
};
const MES_READINESS_TEMPLATE = [
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
const createReadinessChecklist = () => MES_READINESS_TEMPLATE.map(item=>({...item,status:"unanswered",note:""}));
const readinessScore = (project) => {
  const items=project?.readinessChecklist||createReadinessChecklist();
  const total=items.reduce((sum,item)=>sum+(Number(item.weight)||0),0)||1;
  const earned=items.reduce((sum,item)=>sum+(Number(item.weight)||0)*(item.status==="ready"?1:item.status==="partial"?0.5:0),0);
  return Math.round(earned/total*100);
};
const remainingResponsibility = (project) => {
  const open=(project?.milestones||[]).flatMap(ms=>ms.tasks||[]).filter(task=>task.status!=="Tamamland\u0131");
  const totals={};
  open.forEach(task=>{const group=task.responsibilityGroup||"Proje Ekibi";totals[group]=(totals[group]||0)+(Number(task.estimatedHours)||1);});
  const all=Object.values(totals).reduce((sum,value)=>sum+value,0)||1;
  return Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([group,value])=>({group,value,percent:Math.round(value/all*100)}));
};
const nextReportRunAt = (schedule, from=new Date()) => {
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
const TICKET_STATUSES = ["Açık","Operasyon İncelemesinde","Ürün Değerlendirmesinde","Jira'da Çalışılıyor","Operasyon Testinde","Test Başarısız","Yayına Hazır","Müşteri Onayında","Müşteri Reddetti","Tamamlandı","Beklemede","İptal Edildi"];
const TICKET_CATEGORIES = ["Operasyonel","Bug","Geliştirme","Entegrasyon","İyileştirme","Veri","Eğitim","Diğer"];
const ORG_LEVELS = [
  { id:"ceo", label:"CEO", rank:1 },
  { id:"coo", label:"COO", rank:2 },
  { id:"operations_director", label:"Operasyon Direktörü", rank:3 },
  { id:"project_director", label:"Proje Müdürü", rank:4 },
  { id:"project_manager", label:"Proje Yöneticisi", rank:5 },
  { id:"process_lead", label:"Süreç Lideri", rank:6 },
  { id:"field_engineer", label:"Saha Mühendisi", rank:7 },
];
const orgLevelLabel = (id) => ORG_LEVELS.find(level=>level.id===id)?.label || "Atanmamış";
const organizationRoles = (state) => {
  const custom=state?.organizationRoles||[];
  return [...ORG_LEVELS,...custom].filter((role,index,list)=>list.findIndex(item=>item.id===role.id)===index);
};
const milestoneStatusFromTasks = (tasks=[]) => {
  if(!tasks.length)return "Başlamadı";
  if(tasks.every(task=>task.status==="Tamamlandı"))return "Tamamlandı";
  if(tasks.every(task=>["Başlamadı","Bekliyor"].includes(task.status)))return "Başlamadı";
  if(tasks.some(task=>task.status==="Engellendi"))return "Engellendi";
  return "Devam Ediyor";
};
const normalizeMilestone = (milestone) => {
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
const COLORS = ["#4A6CF7","#059669","#EA6C00","#E11D48","#7C3AED","#0EA5E9","#DB2777","#D97706"];

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

// ─── Supabase persistence ────────────────────────────────────────────────────
// Tum uygulama durumu tek bir JSON satirinda tutulur (app_state tablosu)
const load = () => JSON.parse(JSON.stringify(DEMO)); // baslangic — gercek veri useEffect ile yuklenir

let apiStateVersion = 0;
const authHeaders = async () => {
  const {data}=await supabase.auth.getSession();
  return data.session?.access_token?{Authorization:`Bearer ${data.session.access_token}`}:{};
};
const loadFromSupabase = async () => {
  if(USE_DATA_API){
    const response=await fetch(apiUrl("/api/state"),{headers:await authHeaders()});
    if(!response.ok){
      const detail=await response.text();
      throw new Error(`Veri yuklenemedi (${response.status}): ${detail}`);
    }
    const result=await response.json();
    apiStateVersion=Number(result.version||1);
    return normalizeTicketNumbers(result.state);
  }
  const { data, error } = await supabase.from("app_state").select("data").eq("id", 1).single();
  if(error)throw error;
  if(!data)throw new Error("Uygulama verisi bulunamadi");
  return normalizeTicketNumbers(data.data);
};

let saveTimer = null;
const saveToSupabase = (state, onStatus) => {
  const { currentUserId, ...shared } = state;
  if (saveTimer) clearTimeout(saveTimer);
  if (onStatus) onStatus("saving");
  saveTimer = setTimeout(async () => {
    try {
      let error=null;
      if(USE_DATA_API){
        const response=await fetch(apiUrl("/api/state"),{method:"PUT",headers:{"Content-Type":"application/json",...(await authHeaders())},body:JSON.stringify({state:shared,version:apiStateVersion})});
        if(response.ok){const result=await response.json();apiStateVersion=Number(result.version);}
        else error=new Error(response.status===409?"Başka bir kullanıcı veriyi güncelledi. Sayfa yenilenerek son veri alınmalı.":await response.text());
      }else{
        const result=await supabase.from("app_state").upsert({ id: 1, data: shared, updated_at: new Date().toISOString() });
        error=result.error;
      }
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
const ticketChangeLog=(ticket,data,user)=>{
  const labels={status:"Durum",assignedTo:"Sorumlu",jiraKey:"Jira",jiraStatus:"Jira durumu",testResult:"Test sonucu",category:"Kategori",ownerTeam:"Sahip ekip"};
  return Object.entries(labels).flatMap(([key,label])=>{
    if(data[key]===undefined||String(data[key]??"")===String(ticket?.[key]??""))return [];
    return [{id:uid(),ts:now(),userId:user.id,userName:user.name,field:key,label,from:ticket?.[key]||"-",to:data[key]||"-"}];
  });
};
const ticketWorkflowFromJira=(status="")=>{
  const value=status.toLocaleLowerCase("tr-TR");
  if(value.includes("ready to release")||value.includes("yayına hazır"))return {status:"Yayına Hazır",ownerTeam:"Ürün"};
  if(["done","closed","resolved","tamamlandı"].some(item=>value.includes(item)))return {status:"Tamamlandı",ownerTeam:"Ürün"};
  if(value.includes("test"))return {status:"Operasyon Testinde",ownerTeam:"Operasyon",testResult:"Bekliyor"};
  return {status:"Jira'da Çalışılıyor",ownerTeam:"Ürün"};
};
const applyTicketWorkflow=(data)=>{
  if(data.testResult==="Başarısız")return {...data,status:"Test Başarısız",ownerTeam:"Ürün"};
  if(data.testResult==="Başarılı")return {...data,status:"Yayına Hazır",ownerTeam:"Ürün"};
  if(data.jiraStatus)return {...data,...ticketWorkflowFromJira(data.jiraStatus)};
  return data;
};
const normalizeTicketNumbers=(state)=>{
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

/* eslint-disable no-unused-vars */
function LegacyRemoteAccessPanel({project,state,setState,currentUser,isAdmin,canManage}) {
  const empty={name:"",url:"",username:"",password:"",status:"Hazır",routing:"",note:""};
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [form,setForm]=useState(empty);
  const [visibleSecrets,setVisibleSecrets]=useState({});
  const [copied,setCopied]=useState("");
  const items=project.remoteAccess||[];
  const canEdit=isAdmin||canManage;
  const saveItems=(next)=>setState(current=>({...current,projects:current.projects.map(item=>item.id===project.id?{...item,remoteAccess:next}:item)}));
  const copy=async(value,key)=>{
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(()=>setCopied(""),1200);
  };
  const openAdd=()=>{setEditingId(null);setForm(empty);setShowForm(true);};
  const openEdit=item=>{setEditingId(item.id);setForm({...empty,...item});setShowForm(true);};
  const submit=()=>{
    if(!form.name.trim())return;
    const entry={...form,name:form.name.trim(),updatedAt:now(),updatedBy:currentUser.name};
    saveItems(editingId?items.map(item=>item.id===editingId?{...item,...entry}:item):[{...entry,id:uid(),createdAt:now()},...items]);
    setShowForm(false);setEditingId(null);setForm(empty);
  };
  return <div style={{flex:1,overflow:"auto",padding:"18px 22px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14}}><div><h3 style={{margin:0,fontSize:16}}>Uzaktan Erişim</h3><p style={{margin:"3px 0 0",fontSize:11,color:"#64748B"}}>Sunucu, VPN ve yönlendirme bilgileri. Parolalar yalnızca yetkili proje kullanıcılarına gösterilir.</p></div>{canEdit&&<Btn small onClick={openAdd}>+ Erişim Ekle</Btn>}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(320px,100%),1fr))",gap:10,marginBottom:14}}>{items.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${item.status==="Hazır"?"#059669":"#EA6C00"}`,borderRadius:13,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{fontSize:13}}>{item.name}</b><span style={{fontSize:9,fontWeight:850,color:item.status==="Hazır"?"#047857":"#C2410C",background:item.status==="Hazır"?"#ECFDF5":"#FFF7ED",padding:"3px 6px",borderRadius:7}}>{item.status}</span></div>
      <div style={{display:"grid",gap:7,marginTop:10}}>{[["Adres",item.url,"url"],["Kullanıcı",item.username,"username"]].filter(([,value])=>value).map(([label,value,key])=><div key={key} style={{display:"flex",alignItems:"center",gap:7,background:"#F8FAFC",borderRadius:8,padding:"7px 9px"}}><span style={{fontSize:9,color:"#64748B",width:54}}>{label}</span><b style={{fontSize:10,flex:1,wordBreak:"break-all"}}>{value}</b><button onClick={()=>copy(value,`${item.id}-${key}`)} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:6,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{copied===`${item.id}-${key}`?"Kopyalandı":"Kopyala"}</button></div>)}
        {item.password&&<div style={{display:"flex",alignItems:"center",gap:7,background:"#FFF7ED",borderRadius:8,padding:"7px 9px"}}><span style={{fontSize:9,color:"#9A3412",width:54}}>Parola</span><b style={{fontSize:11,flex:1,letterSpacing:visibleSecrets[item.id]?0:2}}>{visibleSecrets[item.id]?item.password:"••••••••••"}</b><button onClick={()=>setVisibleSecrets(current=>({...current,[item.id]:!current[item.id]}))} style={{border:0,background:"transparent",color:"#C2410C",fontSize:9,fontWeight:800,cursor:"pointer"}}>{visibleSecrets[item.id]?"Gizle":"Göster"}</button><button onClick={()=>copy(item.password,`${item.id}-password`)} style={{border:0,background:"#FFEDD5",color:"#9A3412",borderRadius:6,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{copied===`${item.id}-password`?"Kopyalandı":"Kopyala"}</button></div>}
      </div>
      {item.routing&&<div style={{fontSize:10,color:"#475569",lineHeight:1.5,marginTop:9}}><b>VPN / Yönlendirme:</b> {item.routing}</div>}{item.note&&<div style={{fontSize:10,color:"#64748B",lineHeight:1.5,marginTop:5}}>{item.note}</div>}
      {canEdit&&<div style={{display:"flex",gap:9,marginTop:10}}><button onClick={()=>openEdit(item)} style={{border:0,background:"transparent",color:"#4A6CF7",fontSize:10,fontWeight:800,cursor:"pointer"}}>Düzenle</button><button onClick={()=>confirm("Erişim kaydı silinsin mi?")&&saveItems(items.filter(entry=>entry.id!==item.id))} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button></div>}
    </div>)}</div>
    {!items.length&&!showForm&&<div style={{padding:38,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Uzaktan erişim kaydı bulunmuyor.</div>}
    {showForm&&canEdit&&<div style={{background:"#fff",border:"1.5px solid #CBD5E1",borderRadius:14,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><b style={{fontSize:13}}>{editingId?"Erişim Kaydını Düzenle":"Yeni Erişim Kaydı"}</b><button onClick={()=>setShowForm(false)} style={{border:0,background:"transparent",fontSize:18,color:"#94A3B8",cursor:"pointer"}}>×</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>{[["name","Sistem / Sunucu","text"],["url","Bağlantı Adresi","text"],["username","Kullanıcı Adı","text"],["password","Parola","password"],["routing","VPN / Yönlendirme","text"]].map(([key,label,type])=><Field key={key} label={label}><input type={type} autoComplete="off" style={iStyle} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></Field>)}<Field label="Durum"><select style={iStyle} value={form.status} onChange={event=>setForm(current=>({...current,status:event.target.value}))}>{["Hazır","Test Bekliyor","Erişim Yok","Süresi Doldu"].map(status=><option key={status}>{status}</option>)}</select></Field></div><Field label="Not"><input style={iStyle} value={form.note} onChange={event=>setForm(current=>({...current,note:event.target.value}))}/></Field><div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" onClick={()=>setShowForm(false)}>İptal</Btn><Btn onClick={submit}>{editingId?"Güncelle":"Kaydet"}</Btn></div></div>}
  </div>;
}
/* eslint-enable no-unused-vars */

function RemoteAccessPanel({project,setState,isAdmin,canManage}) {
  const empty={name:"",url:"",username:"",password:"",status:"Hazır",routing:"",note:""};
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState("");
  const [form,setForm]=useState(empty);
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [visibleSecrets,setVisibleSecrets]=useState({});
  const [copied,setCopied]=useState("");
  const canEdit=isAdmin||canManage;
  const endpoint=`/api/projects/${encodeURIComponent(project.id)}/remote-access`;
  const syncMetadata=useCallback(next=>setState(current=>({...current,projects:current.projects.map(item=>item.id===project.id?{...item,remoteAccess:next.map(record=>{const metadata={...record};delete metadata.password;return metadata;})}:item)})),[project.id,setState]);
  useEffect(()=>{
    let active=true;
    Promise.resolve().then(()=>{if(active){setLoading(true);setError("");}});
    authHeaders().then(headers=>fetch(apiUrl(endpoint),{headers})).then(async response=>{
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Erişim kasası yüklenemedi.");
      if(active)setRecords(result.records||[]);
    }).catch(fetchError=>{if(active)setError(fetchError.message);})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[endpoint]);
  const copy=async(value,key)=>{
    if(!value)return;
    await navigator.clipboard.writeText(value);
    setCopied(key);setTimeout(()=>setCopied(""),1200);
  };
  const openAdd=()=>{setEditingId("");setForm(empty);setShowForm(true);};
  const openEdit=item=>{setEditingId(item.id);setForm({...empty,...item});setShowForm(true);};
  const submit=async()=>{
    if(!form.name.trim())return;
    setSaving(true);setError("");
    try{
      const id=editingId||uid();
      const response=await fetch(apiUrl(`${endpoint}${editingId?`/${encodeURIComponent(editingId)}`:""}`),{
        method:editingId?"PUT":"POST",
        headers:{"Content-Type":"application/json",...(await authHeaders())},
        body:JSON.stringify({record:{...form,id,name:form.name.trim()}}),
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Erişim kaydı kaydedilemedi.");
      apiStateVersion=Number(result.version||apiStateVersion);
      const next=editingId?records.map(item=>item.id===editingId?result.result:item):[result.result,...records];
      setRecords(next);syncMetadata(next);
      setShowForm(false);setEditingId("");setForm(empty);
    }catch(saveError){setError(saveError.message);}
    finally{setSaving(false);}
  };
  const remove=async id=>{
    if(!confirm("Erişim kaydı silinsin mi?"))return;
    setError("");
    try{
      const response=await fetch(apiUrl(`${endpoint}/${encodeURIComponent(id)}`),{method:"DELETE",headers:await authHeaders()});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Erişim kaydı silinemedi.");
      apiStateVersion=Number(result.version||apiStateVersion);
      const next=records.filter(item=>item.id!==id);
      setRecords(next);syncMetadata(next);
    }catch(deleteError){setError(deleteError.message);}
  };
  return <div style={{flex:1,overflow:"auto",padding:"18px 22px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:14}}>
      <div><h3 style={{margin:0,fontSize:16}}>Uzaktan Erişim Kasası</h3><p style={{margin:"3px 0 0",fontSize:11,color:"#64748B"}}>Parolalar şifreli saklanır; projeye dahil kullanıcılar görüntüleyebilir, yalnızca proje yöneticileri ve adminler düzenleyebilir.</p></div>
      {canEdit&&<Btn small onClick={openAdd}>+ Erişim Ekle</Btn>}
    </div>
    {error&&<div style={{background:"#FFF1F2",color:"#BE123C",borderRadius:9,padding:"9px 11px",fontSize:11,fontWeight:700,marginBottom:10}}>{error}</div>}
    {loading&&<div style={{padding:28,textAlign:"center",color:"#64748B"}}>Şifre kasası yükleniyor...</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(320px,100%),1fr))",gap:10,marginBottom:14}}>
      {!loading&&records.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${item.status==="Hazır"?"#059669":"#EA6C00"}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{fontSize:13}}>{item.name}</b><span style={{fontSize:9,fontWeight:850,color:item.status==="Hazır"?"#047857":"#C2410C",background:item.status==="Hazır"?"#ECFDF5":"#FFF7ED",padding:"3px 6px",borderRadius:7}}>{item.status}</span></div>
        <div style={{display:"grid",gap:7,marginTop:10}}>
          {[["Adres",item.url,"url"],["Kullanıcı",item.username,"username"]].filter(([,value])=>value).map(([label,value,key])=><div key={key} style={{display:"flex",alignItems:"center",gap:7,background:"#F8FAFC",borderRadius:8,padding:"7px 9px"}}><span style={{fontSize:9,color:"#64748B",width:54}}>{label}</span><b style={{fontSize:10,flex:1,wordBreak:"break-all"}}>{value}</b><button onClick={()=>copy(value,`${item.id}-${key}`)} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:6,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{copied===`${item.id}-${key}`?"Kopyalandı":"Kopyala"}</button></div>)}
          {item.password&&<div style={{display:"flex",alignItems:"center",gap:7,background:"#FFF7ED",borderRadius:8,padding:"7px 9px"}}><span style={{fontSize:9,color:"#9A3412",width:54}}>Parola</span><b style={{fontSize:11,flex:1,letterSpacing:visibleSecrets[item.id]?0:2}}>{visibleSecrets[item.id]?item.password:"••••••••••"}</b><button onClick={()=>setVisibleSecrets(current=>({...current,[item.id]:!current[item.id]}))} style={{border:0,background:"transparent",color:"#C2410C",fontSize:9,fontWeight:800,cursor:"pointer"}}>{visibleSecrets[item.id]?"Gizle":"Göster"}</button><button onClick={()=>copy(item.password,`${item.id}-password`)} style={{border:0,background:"#FFEDD5",color:"#9A3412",borderRadius:6,padding:"4px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>{copied===`${item.id}-password`?"Kopyalandı":"Kopyala"}</button></div>}
        </div>
        {item.routing&&<div style={{fontSize:10,color:"#475569",lineHeight:1.5,marginTop:9}}><b>VPN / Yönlendirme:</b> {item.routing}</div>}
        {item.note&&<div style={{fontSize:10,color:"#64748B",lineHeight:1.5,marginTop:5}}>{item.note}</div>}
        {canEdit&&<div style={{display:"flex",gap:9,marginTop:10}}><button onClick={()=>openEdit(item)} style={{border:0,background:"transparent",color:"#4A6CF7",fontSize:10,fontWeight:800,cursor:"pointer"}}>Düzenle</button><button onClick={()=>remove(item.id)} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button></div>}
      </div>)}
    </div>
    {!loading&&!records.length&&!showForm&&<div style={{padding:38,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Uzaktan erişim kaydı bulunmuyor.</div>}
    {showForm&&canEdit&&<div style={{background:"#fff",border:"1.5px solid #CBD5E1",borderRadius:14,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><b style={{fontSize:13}}>{editingId?"Erişim Kaydını Düzenle":"Yeni Erişim Kaydı"}</b><button onClick={()=>setShowForm(false)} style={{border:0,background:"transparent",fontSize:18,color:"#94A3B8",cursor:"pointer"}}>×</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>
        {[["name","Sistem / Sunucu","text"],["url","Bağlantı Adresi","text"],["username","Kullanıcı Adı","text"],["password","Parola","password"],["routing","VPN / Yönlendirme","text"]].map(([key,label,type])=><Field key={key} label={label}><input type={type} autoComplete="off" style={iStyle} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></Field>)}
        <Field label="Durum"><select style={iStyle} value={form.status} onChange={event=>setForm(current=>({...current,status:event.target.value}))}>{["Hazır","Test Bekliyor","Erişim Yok","Süresi Doldu"].map(status=><option key={status}>{status}</option>)}</select></Field>
      </div>
      <Field label="Not"><input style={iStyle} value={form.note} onChange={event=>setForm(current=>({...current,note:event.target.value}))}/></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" disabled={saving} onClick={()=>setShowForm(false)}>İptal</Btn><Btn disabled={saving} onClick={submit}>{saving?"Kaydediliyor...":editingId?"Güncelle":"Kaydet"}</Btn></div>
    </div>}
  </div>;
}

function FieldPlanPage({ state, setState, currentUser, isAdmin }) {
  const [scope,setScope]=useState(isAdmin?"team":"mine");
  const [personFilter,setPersonFilter]=useState("");
  const [projectFilter,setProjectFilter]=useState("all");
  const [weekOffset,setWeekOffset]=useState(0);
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [visitPlan,setVisitPlan]=useState(null);
  const [form,setForm]=useState({userId:currentUser.id,projectId:"",workType:"field",date:todayStr(),startTime:"09:00",endTime:"17:00",note:""});
  const plans=state.fieldPlans||[];
  const monday=new Date();
  const day=monday.getDay()||7;
  monday.setHours(0,0,0,0);
  monday.setDate(monday.getDate()-day+1+(weekOffset*7));
  const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const weekEnd=days[6];
  const visible=plans.filter(p=>{
    const scopeOk=scope==="team"&&isAdmin?(personFilter?p.userId===personFilter:true):p.userId===currentUser.id;
    return scopeOk&&(projectFilter==="all"||p.projectId===projectFilter);
  });
  const openForm=(date=todayStr(),plan=null)=>{
    setEditingId(plan?.id||null);
    setForm(plan?{userId:plan.userId,projectId:plan.projectId,workType:plan.workType||"field",date:plan.date,startTime:plan.startTime||"09:00",endTime:plan.endTime||"17:00",note:plan.note||""}:{userId:currentUser.id,projectId:"",workType:"field",date,startTime:"09:00",endTime:"17:00",note:""});
    setShowForm(true);
  };
  const save=()=>{
    if(!form.projectId||!form.date)return;
    setState(s=>({...s,fieldPlans:editingId?(s.fieldPlans||[]).map(p=>p.id===editingId?{...p,...form,updatedAt:now()}:p):[...(s.fieldPlans||[]),{id:uid(),status:"planned",...form,createdAt:now()}]}));
    setEditingId(null);
    setShowForm(false);
  };
  const remove=id=>setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).filter(p=>p.id!==id)}));
  const monthLabel=`${monday.toLocaleDateString("tr-TR",{day:"numeric",month:"short"})} - ${weekEnd.toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"})}`;
  return <div style={{padding:"22px clamp(14px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:18}}>
      <div><h2 style={{margin:0,fontSize:20,fontWeight:800,display:"flex",alignItems:"center",gap:8}}><Icon name="calendar" size={21}/>Haftalık Çalışma Planım</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Saha ziyaretlerini ve proje bazlı uzaktan çalışmaları haftalık planlayın.</p></div>
      <Btn onClick={()=>showForm?(setShowForm(false),setEditingId(null)):openForm()}>{showForm?"Kapat":"+ Plan Ekle"}</Btn>
    </div>
    {showForm&&<div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:14,padding:16,marginBottom:16,boxShadow:"0 8px 24px rgba(15,23,42,.05)"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,alignItems:"end"}}>
        {isAdmin&&<Field label="Personel"><select style={iStyle} value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}>{state.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <Field label="Çalışma Türü"><select style={iStyle} value={form.workType} onChange={e=>setForm({...form,workType:e.target.value})}><option value="field">Saha Ziyareti</option><option value="remote">Uzaktan Çalışma</option></select></Field>
        <Field label="Müşteri / Proje"><select style={iStyle} value={form.projectId} onChange={e=>setForm({...form,projectId:e.target.value})}><option value="">Proje seçin</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Tarih"><input type="date" style={iStyle} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
        <Field label="Başlangıç"><input type="time" style={iStyle} value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></Field>
        <Field label="Bitiş"><input type="time" style={iStyle} value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></Field>
      </div>
      <Field label="Plan Notu"><textarea style={{...iStyle,minHeight:70,resize:"vertical"}} value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder={form.workType==="remote"?"Uzaktan yapılacak çalışma, hedef ve beklenen çıktı...":"Ziyaret amacı, görüşülecek kişiler veya hazırlık notu..."}/></Field>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn disabled={!form.projectId||!form.date} onClick={save}>{editingId?"Değişiklikleri Kaydet":"Planı Kaydet"}</Btn></div>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
      {isAdmin?<div style={{display:"flex",gap:7,flexWrap:"wrap"}}><div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>{[["mine","Benim Planım"],["team","Tüm Ekip"]].map(([id,label])=><button key={id} onClick={()=>setScope(id)} style={{border:0,borderRadius:8,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,background:scope===id?"#fff":"transparent",color:scope===id?"#4A6CF7":"#64748B",boxShadow:scope===id?"0 2px 6px #0f172a14":"none"}}>{label}</button>)}</div>{scope==="team"&&<select style={{...iStyle,width:190}} value={personFilter} onChange={e=>setPersonFilter(e.target.value)}><option value="">Tüm kişiler</option>{state.people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}<select style={{...iStyle,width:210}} value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Tüm projeler</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>:<span style={{fontSize:12,fontWeight:700,color:"#4A6CF7"}}>Benim Planım</span>}
      <div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={()=>setWeekOffset(v=>v-1)} style={{border:0,borderRadius:8,padding:"7px 10px",background:"#fff",cursor:"pointer",color:"#64748B"}}>‹</button><button onClick={()=>setWeekOffset(0)} style={{border:0,borderRadius:8,padding:"7px 11px",background:"#F1F5FF",cursor:"pointer",fontWeight:700,color:"#4A6CF7"}}>{monthLabel}</button><button onClick={()=>setWeekOffset(v=>v+1)} style={{border:0,borderRadius:8,padding:"7px 10px",background:"#fff",cursor:"pointer",color:"#64748B"}}>›</button></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:9}}>
      {days.map(d=>{const key=dateKey(d);const dayPlans=visible.filter(p=>p.date===key).sort((a,b)=>(a.startTime||"").localeCompare(b.startTime||""));const today=key===todayStr();return <div key={key} style={{background:today?"#F1F5FF":"#fff",border:`1.5px solid ${today?"#A5B4FC":"#E2E8F0"}`,borderRadius:13,minHeight:190,padding:11}}>
        <button title="Bu güne plan ekle" onClick={()=>openForm(key)} style={{width:"100%",border:0,background:"transparent",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,cursor:"pointer",padding:0}}><div style={{fontSize:11,fontWeight:800,color:today?"#4A6CF7":"#64748B",textTransform:"uppercase"}}>{d.toLocaleDateString("tr-TR",{weekday:"short"})}<span style={{display:"block",fontSize:9,fontWeight:600,color:"#94A3B8",textTransform:"none",marginTop:2}}>+ plan ekle</span></div><div style={{width:28,height:28,borderRadius:9,display:"grid",placeItems:"center",fontWeight:800,fontSize:12,background:today?"#4A6CF7":"#F8FAFC",color:today?"#fff":"#1E293B"}}>{d.getDate()}</div></button>
        {dayPlans.map(plan=>{const project=state.projects.find(p=>p.id===plan.projectId);const person=state.people.find(p=>p.id===plan.userId);const remote=plan.workType==="remote";return <div key={plan.id} onClick={()=>openForm(key,plan)} style={{background:"#fff",border:`1px solid ${remote?"#C4B5FD":project?.color||"#CBD5E1"}55`,borderLeft:`4px solid ${remote?"#7C3AED":project?.color||"#4A6CF7"}`,borderRadius:9,padding:"9px 8px",marginBottom:7,boxShadow:"0 2px 8px #0f172a0c",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:5,alignItems:"flex-start"}}><div style={{fontSize:11,fontWeight:800,lineHeight:1.35}}>{project?.name||"Silinmiş proje"}</div><span style={{fontSize:8,fontWeight:850,color:remote?"#6D28D9":"#047857",background:remote?"#F5F3FF":"#ECFDF5",borderRadius:5,padding:"2px 5px",whiteSpace:"nowrap"}}>{remote?"UZAKTAN":"SAHA"}</span></div><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{plan.startTime} - {plan.endTime}</div>
          {scope==="team"&&person&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:6}}><Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={20}/><span style={{fontSize:10,fontWeight:700,color:"#475569"}}>{person.name}</span></div>}
          {plan.note&&<div style={{fontSize:10,color:"#64748B",lineHeight:1.4,marginTop:6,wordBreak:"break-word"}}>{plan.note}</div>}
          {plan.status==="completed"&&<div style={{fontSize:9,fontWeight:800,color:"#059669",background:"#ECFDF5",borderRadius:6,padding:"3px 6px",marginTop:6,display:"inline-block"}}>GERÇEKLEŞTİ · {fieldPlanHours(plan)} SA</div>}
          {(isAdmin||plan.userId===currentUser.id)&&<div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>{plan.status!=="completed"&&<button onClick={e=>{e.stopPropagation();setVisitPlan(plan);}} style={{border:0,background:"transparent",color:remote?"#7C3AED":"#059669",fontSize:10,fontWeight:800,cursor:"pointer",padding:0}}>{remote?"Çalışmayı Tamamla":"Ziyareti Tamamla"}</button>}<button onClick={e=>{e.stopPropagation();openForm(key,plan);}} style={{border:0,background:"transparent",color:"#4A6CF7",fontSize:10,cursor:"pointer",padding:0}}>Düzenle</button><button onClick={e=>{e.stopPropagation();if(confirm("Plan silinsin mi?"))remove(plan.id);}} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,cursor:"pointer",padding:0}}>Sil</button></div>}
        </div>})}
        {!dayPlans.length&&<div style={{fontSize:10,color:"#CBD5E1",textAlign:"center",paddingTop:38}}>Plan yok</div>}
      </div>})}
    </div>
    {visitPlan&&<FieldVisitModal plan={visitPlan} project={state.projects.find(project=>project.id===visitPlan.projectId)} currentUser={currentUser} onClose={()=>setVisitPlan(null)} onSave={data=>{setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).map(plan=>plan.id===visitPlan.id?{...plan,...data,status:"completed",completedAt:now(),updatedAt:now()}:plan)}));setVisitPlan(null);}}/>}
  </div>;
}

function FieldVisitModal({plan,project,currentUser,onClose,onSave}) {
  const remote=plan.workType==="remote";
  const suggested=fieldPlanHours(plan);
  const costSettings=projectCostSettings(project||{});
  const [form,setForm]=useState({
    actualStartTime:plan.actualStartTime||plan.startTime||"09:00",
    actualEndTime:plan.actualEndTime||plan.endTime||"17:00",
    effortHours:plan.effortHours||suggested||"",
    visitNotes:plan.visitNotes||"",
    roundTripKm:plan.roundTripKm||"",
  });
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const calculated=fieldPlanHours({...plan,...form,effortHours:""});
  const tripKm=parseFloat(form.roundTripKm)||0;
  const tripCost=fuelCost({roundTripKm:tripKm,settings:costSettings});
  const save=()=>{
    const hours=parseFloat(form.effortHours)||calculated;
    if(hours<=0){alert("Geçerli bir efor süresi girin.");return;}
    if(!form.visitNotes.trim()){alert(remote?"Uzaktan çalışmada yapılanları yazın.":"Ziyarette yapılanları yazın.");return;}
    onSave({...form,effortHours:hours,roundTripKm:tripKm||"",fuelCostUsd:tripKm?tripCost.usdAmount:"",fuelCostTry:tripKm?tripCost.tryAmount:"",visitNotes:form.visitNotes.trim(),completedBy:currentUser.id,completedByName:currentUser.name});
  };
  return <Modal title={`${remote?"Uzaktan Çalışma":"Saha Ziyareti"} · ${project?.name||"Proje"}`} onClose={onClose} wide>
    <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:11,padding:"11px 13px",marginBottom:14,fontSize:11,color:"#047857"}}><b>{fmt(plan.date)}</b> · Planlanan {plan.startTime} - {plan.endTime}{suggested?` · ${suggested} saat`:""}</div>
    <div className="visit-time-grid" style={{display:"grid",gridTemplateColumns:`repeat(${remote?3:4},minmax(0,1fr))`,gap:10}}>
      <Field label="Gerçek Başlangıç"><input type="time" style={iStyle} value={form.actualStartTime} onChange={e=>update("actualStartTime",e.target.value)}/></Field>
      <Field label="Gerçek Bitiş"><input type="time" style={iStyle} value={form.actualEndTime} onChange={e=>update("actualEndTime",e.target.value)}/></Field>
      <Field label="Proje Eforu (Saat)"><input type="number" min="0.5" step="0.5" style={iStyle} value={form.effortHours} onChange={e=>update("effortHours",e.target.value)} placeholder={String(calculated||"")}/></Field>
      {!remote&&<Field label="Gidiş-Dönüş KM"><input type="number" min="0" step="1" style={iStyle} value={form.roundTripKm} onChange={e=>update("roundTripKm",e.target.value)} placeholder="örn. 180"/></Field>}
    </div>
    {!remote&&tripKm>0&&<div style={{fontSize:11,color:"#64748B",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:9,padding:"8px 10px",marginTop:8,marginBottom:4}}>Yakıt maliyeti tahmini: <b>${tripCost.usdAmount}</b> / <b>{tripCost.tryAmount} TL</b> · {costSettings.fuelConsumptionLtPer100Km} L/100km, {costSettings.fuelTryPerLt} TL/L, kur {costSettings.usdTry}</div>}
    <Field label={remote?"Uzaktan Çalışmada Yapılanlar":"Ziyarette Yapılanlar"}><textarea style={{...iStyle,minHeight:115,resize:"vertical",lineHeight:1.5}} value={form.visitNotes} onChange={e=>update("visitNotes",e.target.value)} placeholder={remote?"Yapılan analiz, kontrol, geliştirme, görüşme ve sonraki aksiyonlar...":"Görüşülen konular, yapılan kontroller, alınan kararlar ve sonraki aksiyonlar..."}/></Field>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8}}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={save}>{remote?"Çalışmayı":"Ziyareti"} Tamamla ve Eforu Kaydet</Btn></div>
  </Modal>;
}

function FieldVisitsPage({state,setState,currentUser,isAdmin,onOpenProject}) {
  const responsibleIds=new Set(state.projects.filter(project=>isAdmin||projectPmIds(project).includes(currentUser.id)).map(project=>project.id));
  const [scope,setScope]=useState("mine");
  const [projectFilter,setProjectFilter]=useState("all");
  const [personFilter,setPersonFilter]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [editing,setEditing]=useState(null);
  const completed=(state.fieldPlans||[]).filter(plan=>plan.status==="completed"||plan.completedAt);
  const visible=completed.filter(plan=>{
    const inScope=scope==="mine"?plan.userId===currentUser.id:responsibleIds.has(plan.projectId);
    return inScope&&(typeFilter==="all"||(plan.workType||"field")===typeFilter)&&(projectFilter==="all"||plan.projectId===projectFilter)&&(!personFilter||plan.userId===personFilter);
  }).sort((a,b)=>`${b.date} ${b.actualStartTime||b.startTime||""}`.localeCompare(`${a.date} ${a.actualStartTime||a.startTime||""}`));
  const hours=visible.reduce((total,plan)=>total+fieldPlanHours(plan),0);
  const projects=state.projects.filter(project=>scope==="mine"?(state.fieldPlans||[]).some(plan=>plan.userId===currentUser.id&&plan.projectId===project.id):responsibleIds.has(project.id));
  return <div style={{padding:"clamp(16px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,flexWrap:"wrap",marginBottom:18}}>
      <div><h2 style={{margin:0,fontSize:21,display:"flex",alignItems:"center",gap:8}}><Icon name="calendar" size={21}/>Gerçekleşen Çalışmalar</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Saha ziyaretleri ve uzaktan çalışmaların notları ile proje eforları.</p></div>
      <div style={{display:"flex",gap:7,background:"#E2E8F0",padding:3,borderRadius:10}}>{[["mine","Benim Ziyaretlerim"],["responsible",isAdmin?"Tüm Ekip":"Sorumlu Projeler"]].map(([id,label])=><button key={id} onClick={()=>{setScope(id);setProjectFilter("all");setPersonFilter("");}} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontSize:11,fontWeight:800,background:scope===id?"#fff":"transparent",color:scope===id?"#4A6CF7":"#64748B"}}>{label}</button>)}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginBottom:14}}>{[["Saha Ziyareti",visible.filter(plan=>(plan.workType||"field")==="field").length,"#059669"],["Uzaktan Çalışma",visible.filter(plan=>plan.workType==="remote").length,"#7C3AED"],["Toplam Efor",`${hours} sa`,"#0369A1"],["Çalışılan Proje",new Set(visible.map(plan=>plan.projectId)).size,"#EA6C00"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:12,padding:13}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><div style={{fontSize:23,fontWeight:900,color,marginTop:3}}>{value}</div></div>)}</div>
    <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:14}}>
      <select style={{...iStyle,width:"auto",minWidth:180}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">Tüm Çalışma Türleri</option><option value="field">Saha Ziyaretleri</option><option value="remote">Uzaktan Çalışmalar</option></select>
      <select style={{...iStyle,width:"auto",minWidth:220}} value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="all">Tüm Projeler</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select>
      {(isAdmin||scope==="responsible")&&<select style={{...iStyle,width:"auto",minWidth:190}} value={personFilter} onChange={e=>setPersonFilter(e.target.value)}><option value="">Tüm Kişiler</option>{state.people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(320px,100%),1fr))",gap:11}}>
      {visible.map(plan=>{const project=state.projects.find(item=>item.id===plan.projectId);const person=state.people.find(item=>item.id===plan.userId);const canEdit=isAdmin||plan.userId===currentUser.id;const remote=plan.workType==="remote";return <div key={plan.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`4px solid ${remote?"#7C3AED":project?.color||"#4A6CF7"}`,borderRadius:14,padding:15,boxShadow:"0 4px 14px rgba(15,23,42,.04)"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:9}}><div style={{flex:1}}><button onClick={()=>onOpenProject(project?.id)} style={{border:0,background:"transparent",padding:0,fontSize:13,fontWeight:850,cursor:"pointer",textAlign:"left"}}>{project?.name||"Silinmiş proje"}</button><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{fmt(plan.date)} · {plan.actualStartTime||plan.startTime} - {plan.actualEndTime||plan.endTime}</div></div><span style={{background:"#ECFDF5",color:"#047857",borderRadius:8,padding:"4px 7px",fontSize:10,fontWeight:850}}>{fieldPlanHours(plan)} SA</span></div>
        {person&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}><Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={23}/><span style={{fontSize:10,fontWeight:750,color:"#475569"}}>{person.name}</span></div>}
        <div style={{fontSize:9,fontWeight:850,color:remote?"#6D28D9":"#047857",marginTop:9}}>{remote?"UZAKTAN ÇALIŞMA":"SAHA ZİYARETİ"}</div><div style={{fontSize:11,lineHeight:1.55,color:"#334155",whiteSpace:"pre-wrap",background:"#F8FAFC",borderRadius:9,padding:"9px 10px",marginTop:6}}>{plan.visitNotes||(remote?"Çalışma notu girilmedi.":"Ziyaret notu girilmedi.")}</div>
        {canEdit&&<button onClick={()=>setEditing(plan)} style={{marginTop:9,border:0,background:"transparent",color:"#4A6CF7",fontSize:10,fontWeight:800,cursor:"pointer",padding:0}}>Çalışma ve eforu düzenle</button>}
      </div>})}
    </div>
    {!visible.length&&<div style={{padding:45,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:13,color:"#94A3B8",background:"#fff"}}>Bu kapsamda gerçekleşmiş çalışma bulunmuyor.</div>}
    {editing&&<FieldVisitModal plan={editing} project={state.projects.find(project=>project.id===editing.projectId)} currentUser={currentUser} onClose={()=>setEditing(null)} onSave={data=>{setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).map(plan=>plan.id===editing.id?{...plan,...data,status:"completed",updatedAt:now()}:plan)}));setEditing(null);}}/>}
  </div>;
}

function FieldOperationsPage({state,setState,currentUser,isAdmin,onOpenProject}) {
  const [section,setSection]=useState("plan");
  return <div style={{flex:1,overflow:"auto",background:"#F8FAFC"}}>
    <div style={{position:"sticky",top:0,zIndex:5,display:"flex",gap:7,padding:"12px clamp(16px,4vw,28px)",background:"#fff",borderBottom:"1px solid #E2E8F0"}}>
      {[["plan","calendar","Haftalık Plan"],["visits","activity","Gerçekleşen Çalışmalar"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:0,borderRadius:9,padding:"8px 13px",background:section===id?"#0F766E":"#F1F5F9",color:section===id?"#fff":"#64748B",fontSize:12,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6}}><Icon name={icon} size={14}/>{label}</button>)}
    </div>
    {section==="plan"?<FieldPlanPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin}/>:<FieldVisitsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} onOpenProject={onOpenProject}/>}
  </div>;
}

function TodoPage({state,setState,currentUser}) {
  const todos=((state.userNotes||{})[currentUser.id]?.todos)||[];
  const empty={projectId:"",customer:"",dueDate:todayStr(),action:""};
  const [form,setForm]=useState(empty);
  const [editingId,setEditingId]=useState(null);
  const saveTodos=next=>setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:next}}}));
  const save=()=>{if(!form.action.trim())return;const item={id:editingId||uid(),done:false,createdAt:now(),...form,action:form.action.trim(),text:form.action.trim()};saveTodos(editingId?todos.map(t=>t.id===editingId?{...t,...item}:t):[...todos,item]);setForm(empty);setEditingId(null);};
  const edit=t=>{setEditingId(t.id);setForm({projectId:t.projectId||"",customer:t.customer||"",dueDate:t.dueDate||"",action:t.action||t.text||""});};
  const toggle=id=>saveTodos(todos.map(t=>t.id===id?{...t,done:!t.done}:t));
  const remove=id=>saveTodos(todos.filter(t=>t.id!==id));
  const active=todos.filter(t=>!t.done).sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const done=todos.filter(t=>t.done);
  return <div style={{padding:"clamp(20px,4vw,32px)",flex:1,overflow:"auto",maxWidth:1200,width:"100%",margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:18,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:22,display:"flex",alignItems:"center",gap:8}}><Icon name="ticket" size={21}/>To-Do</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>Yalnızca size özel müşteri aksiyonları.</p></div><span style={{fontSize:12,fontWeight:800,color:"#4A6CF7"}}>{active.length} açık aksiyon</span></div>
    <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:17,marginBottom:16,boxShadow:"0 6px 20px #0f172a0a"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:11}}><Field label="Müşteri / Proje"><select style={iStyle} value={form.projectId} onChange={e=>{const p=state.projects.find(x=>x.id===e.target.value);setForm({...form,projectId:e.target.value,customer:p?.name||form.customer});}}><option value="">Proje seçin veya müşteri yazın</option>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Müşteri"><input style={iStyle} value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} placeholder="Müşteri adı"/></Field><Field label="Termin"><input type="date" style={iStyle} value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field></div>
      <Field label="Aksiyon"><input style={iStyle} value={form.action} onChange={e=>setForm({...form,action:e.target.value})} onKeyDown={e=>e.key==="Enter"&&save()} placeholder="Yapılacak aksiyon"/></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId(null);setForm(empty);}}>İptal</Btn>}<Btn onClick={save}>{editingId?"Güncelle":"To-Do Ekle"}</Btn></div>
    </div>
    <div className="todo-columns" style={{display:"grid",gridTemplateColumns:"minmax(0,2fr) minmax(260px,1fr)",gap:15}}><div><div style={{fontSize:11,fontWeight:800,color:"#64748B",marginBottom:8,textTransform:"uppercase"}}>Açık Aksiyonlar</div>{active.map(t=>{const p=state.projects.find(x=>x.id===t.projectId);const late=t.dueDate&&daysDiff(t.dueDate)>0;return <div key={t.id} style={{background:"#fff",border:`1.5px solid ${late?"#FCA5A5":"#E2E8F0"}`,borderRadius:12,padding:13,marginBottom:8,display:"flex",gap:11,alignItems:"flex-start"}}><input type="checkbox" checked={false} onChange={()=>toggle(t.id)} style={{marginTop:3,accentColor:"#059669"}}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:800}}>{t.action||t.text}</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5,fontSize:10}}><span style={{color:p?.color||"#4A6CF7",fontWeight:700}}>{t.customer||p?.name||"Genel"}</span>{t.dueDate&&<span style={{color:late?"#E11D48":"#64748B",fontWeight:late?800:600}}>Termin: {fmt(t.dueDate)}{late?` · ${daysDiff(t.dueDate)} gün geçti`:""}</span>}</div></div><button onClick={()=>edit(t)} style={{border:0,background:"transparent",color:"#4A6CF7",cursor:"pointer"}}><Icon name="edit" size={15}/></button><button onClick={()=>confirm("To-Do silinsin mi?")&&remove(t.id)} style={{border:0,background:"transparent",color:"#E11D48",cursor:"pointer"}}><Icon name="trash" size={15}/></button></div>})}{!active.length&&<div style={{padding:35,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Açık To-Do yok.</div>}</div><div><div style={{fontSize:11,fontWeight:800,color:"#64748B",marginBottom:8,textTransform:"uppercase"}}>Tamamlananlar</div>{done.map(t=><button key={t.id} onClick={()=>toggle(t.id)} style={{width:"100%",border:"1px solid #E2E8F0",background:"#F8FAFC",borderRadius:9,padding:10,marginBottom:6,textAlign:"left",fontSize:11,color:"#94A3B8",textDecoration:"line-through",cursor:"pointer"}}>{t.action||t.text}</button>)}{!done.length&&<div style={{fontSize:11,color:"#CBD5E1"}}>Tamamlanan kayıt yok.</div>}</div></div>
  </div>;
}

function ProjectEffortPanel({project,state,people}) {
  const taskRows=project.milestones.flatMap(milestone=>milestone.tasks.flatMap(task=>(task.timeEntries||[]).map(entry=>({
    id:`task-${task.id}-${entry.id}`,source:"Görev",item:task.title,person:people.find(person=>person.id===(entry.userId||task.assignee))?.name||entry.user||"Bilinmiyor",date:entry.date||entry.ts,hours:Number(entry.hours)||0,note:entry.note||"",planned:Number(task.estimatedHours)||0,
  }))));
  const actionRows=((state.projectActions||{})[project.id]||[]).filter(action=>Number(action.effortHours)>0).map(action=>({
    id:`action-${action.id}`,source:"Aksiyon",item:action.text||"Proje aksiyonu",person:action.authorName||people.find(person=>person.id===action.authorId)?.name||"Bilinmiyor",date:action.actionAt||action.createdAt,hours:Number(action.effortHours)||0,note:action.text||"",planned:0,
  }));
  const visitRows=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).map(plan=>({
    id:`visit-${plan.id}`,source:plan.workType==="remote"?"Uzaktan Çalışma":"Saha Ziyareti",item:plan.customer||project.name,person:people.find(person=>person.id===plan.userId)?.name||"Bilinmiyor",date:plan.date||plan.completedAt,hours:fieldPlanHours(plan),note:plan.visitNotes||"",planned:0,
  }));
  const rows=[...taskRows,...actionRows,...visitRows].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const total=rows.reduce((sum,row)=>sum+row.hours,0);
  const planned=project.milestones.flatMap(milestone=>milestone.tasks).reduce((sum,task)=>sum+(Number(task.estimatedHours)||0),0);
  const byPerson=Object.entries(rows.reduce((result,row)=>({...result,[row.person]:(result[row.person]||0)+row.hours}),{})).sort((a,b)=>b[1]-a[1]);
  const exportXlsx=()=>{
    const data=[["Kaynak","İş / Kayıt","Kişi","Tarih","Efor (Saat)","Planlanan (Saat)","Açıklama"],...rows.map(row=>[row.source,row.item,row.person,row.date||"",row.hours,row.planned,row.note])];
    const sheet=XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"]=[{wch:16},{wch:32},{wch:22},{wch:14},{wch:12},{wch:16},{wch:45}];
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,sheet,"Proje Eforu");
    XLSX.writeFile(book,`${project.name.replace(/[^a-zA-Z0-9_-]/g,"_")}-efor.xlsx`);
  };
  return <div style={{flex:1,overflow:"auto",padding:"18px 22px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:14}}><div><h3 style={{margin:0,fontSize:16}}>Proje Efor Merkezi</h3><p style={{margin:"3px 0 0",fontSize:11,color:"#64748B"}}>Görev, aksiyon ve saha ziyaretlerinden gelen tüm eforlar.</p></div><Btn small onClick={exportXlsx}>XLSX İndir</Btn></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginBottom:14}}>
      {[["Toplam Efor",`${total} sa`,"#7C3AED"],["Planlanan",`${planned} sa`,"#0369A1"],["Fark",`${Math.round((total-planned)*10)/10} sa`,total>planned?"#E11D48":"#059669"],["Kayıt",rows.length,"#4A6CF7"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:12,padding:13}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><b style={{display:"block",fontSize:22,color,marginTop:3}}>{value}</b></div>)}
    </div>
    {byPerson.length>0&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:13,marginBottom:12}}><div style={{fontSize:11,fontWeight:800,marginBottom:9}}>Kişi Bazlı Dağılım</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{byPerson.map(([name,hours])=><span key={name} style={{background:"#F5F3FF",color:"#6D28D9",borderRadius:8,padding:"6px 9px",fontSize:10,fontWeight:700}}>{name}: {hours} sa</span>)}</div></div>}
    <div style={{display:"grid",gap:7}}>{rows.map(row=><div key={row.id} className="project-effort-row" style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 12px",display:"grid",gridTemplateColumns:"110px minmax(160px,1fr) 150px 90px 75px",gap:9,alignItems:"center"}}><span style={{fontSize:9,fontWeight:800,color:"#4A6CF7",background:"#EEF2FF",borderRadius:6,padding:"4px 6px",textAlign:"center"}}>{row.source}</span><div style={{minWidth:0}}><b style={{fontSize:11}}>{row.item}</b>{row.note&&<div style={{fontSize:9,color:"#94A3B8",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.note}</div>}</div><span style={{fontSize:10,color:"#475569"}}>{row.person}</span><span style={{fontSize:10,color:"#64748B"}}>{fmt(row.date)}</span><b style={{fontSize:12,color:"#7C3AED",textAlign:"right"}}>{row.hours} sa</b></div>)}{!rows.length&&<div style={{padding:35,textAlign:"center",color:"#94A3B8",background:"#fff",border:"1px dashed #CBD5E1",borderRadius:12}}>Bu projede henüz efor kaydı yok.</div>}</div>
  </div>;
}

function DashboardPage({state,setState,currentUser,isAdmin,myProjects,deadlineWarnings,onNavigate,onOpenProject}) {
  const [quick,setQuick]=useState(null);
  const myTasks=state.projects.flatMap(p=>p.milestones.flatMap(m=>m.tasks.filter(t=>t.assignee===currentUser.id&&t.status!=="Tamamlandı")));
  const personal=(state.personalTasks||[]).filter(t=>t.assignee===currentUser.id&&t.status!=="Tamamlandı");
  const tickets=Object.values(state.projectTickets||{}).flat().filter(t=>t.assignedTo===currentUser.id||t.author===currentUser.name);
  const plans=(state.fieldPlans||[]).filter(p=>p.userId===currentUser.id&&p.date>=todayStr()).sort((a,b)=>a.date.localeCompare(b.date));
  const visits=(state.fieldPlans||[]).filter(p=>p.userId===currentUser.id&&(p.status==="completed"||p.completedAt));
  const todos=((state.userNotes||{})[currentUser.id]?.todos||[]).filter(t=>!t.done);
  const upcomingTodos=[...todos].sort((a,b)=>(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
  const todayPlans=plans.filter(plan=>plan.date===todayStr());
  const overdueTodos=todos.filter(todo=>todo.dueDate&&daysDiff(todo.dueDate)>0);
  const todayFlowLines=[
    todayPlans.length?`${todayPlans.length} çalışma planı var.`:"Bugün için planlı saha/uzaktan çalışma yok.",
    overdueTodos.length?`${overdueTodos.length} geciken to-do kontrol edilmeli.`:upcomingTodos.length?`${upcomingTodos.length} açık to-do sırada.`:"Açık to-do görünmüyor.",
    deadlineWarnings.length?`${deadlineWarnings.length} termin uyarısı var.`:"Kritik termin uyarısı yok."
  ];
  const cards=[
    {label:"To-Do",value:todos.length,desc:"Müşteri aksiyonlarım",icon:"ticket",color:"#DB2777",view:"todos"},
    {label:"Projelerim",value:myProjects.length,desc:"Dahil olduğum projeler",icon:"projects",color:"#4A6CF7",view:"projects"},
    {label:"Görevlerim",value:myTasks.length+personal.length,desc:"Aktif görevler",icon:"tasks",color:"#7C3AED",view:"mytasks"},
    {label:"Saha Yönetimi",value:plans.length+visits.length,desc:`${plans.length} plan · ${visits.length} ziyaret`,icon:"calendar",color:"#059669",view:"fieldops"},
    {label:"Ticketlarım",value:tickets.length,desc:"İlgili ticketlar",icon:"ticket",color:"#EA6C00",view:"tickets"},
    {label:"Termin Uyarıları",value:deadlineWarnings.length,desc:"Geciken görevler",icon:"clock",color:"#E11D48",view:"deadlines"},
    {label:"AI Asistan",value:"",desc:"Projeleri yorumla ve aksiyon çıkar",icon:"activity",color:"#6D28D9",view:"ai"},
    {label:"Raporlar",value:"",desc:"Proje çıktılarını görüntüle",icon:"reports",color:"#0369A1",view:"reports"},
  ];
  const saveQuickTodo=(data)=>{
    const todo={id:uid(),customer:data.customer||"",projectId:data.projectId||"",dueDate:data.dueDate||"",action:data.action,text:data.action,done:false,createdAt:now()};
    setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...((current.userNotes||{})[currentUser.id]||{}),todos:[...(((current.userNotes||{})[currentUser.id]?.todos)||[]),todo]}}}));
    setQuick(null);
  };
  const saveQuickAction=(data)=>{
    if(!data.projectId)return;
    const project=state.projects.find(item=>item.id===data.projectId);
    const action={id:uid(),tag:data.tag||"Takip",text:data.text,effortHours:parseFloat(data.effortHours)||0,actionAt:now(),createdAt:now(),authorId:currentUser.id,authorName:currentUser.name};
    setState(current=>({...current,projectActions:{...(current.projectActions||{}),[data.projectId]:[action,...(((current.projectActions||{})[data.projectId])||[])]}}));
    setQuick(null);
    if(project)onOpenProject(project.id);
  };
  return <div style={{padding:"clamp(18px,4vw,30px)",flex:1,overflow:"auto"}}>
    <div style={{marginBottom:22}}><h2 style={{margin:0,fontSize:22}}>Merhaba, {currentUser.name}</h2><p style={{margin:"5px 0 0",color:"#64748B",fontSize:13}}>Bugün neye odaklanmak istersiniz?</p></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12,marginBottom:18}}>
      <button onClick={()=>setQuick("todo")} style={{border:0,borderRadius:16,padding:16,textAlign:"left",cursor:"pointer",background:"linear-gradient(135deg,#DB2777,#7C3AED)",color:"#fff",boxShadow:"0 12px 28px rgba(124,58,237,.18)"}}><b style={{display:"block",fontSize:16}}>+ Hızlı To-Do</b><span style={{fontSize:11,color:"#FCE7F3"}}>Müşteri, termin ve aksiyonu hemen kaydet</span></button>
      <button onClick={()=>setQuick("action")} style={{border:0,borderRadius:16,padding:16,textAlign:"left",cursor:"pointer",background:"linear-gradient(135deg,#2563EB,#0891B2)",color:"#fff",boxShadow:"0 12px 28px rgba(37,99,235,.18)"}}><b style={{display:"block",fontSize:16}}>+ Hızlı Aksiyon</b><span style={{fontSize:11,color:"#DBEAFE"}}>Proje görüşmesi, yazışma veya saha notu gir</span></button>
    </div>
    <div style={{background:"linear-gradient(135deg,#EEF2FF,#F8FAFC)",border:"1.5px solid #C7D2FE",borderRadius:18,padding:18,marginBottom:18,boxShadow:"0 12px 28px rgba(79,70,229,.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{width:28,height:28,borderRadius:10,background:"#4A6CF7",color:"#fff",display:"grid",placeItems:"center",fontSize:12,fontWeight:950}}>AI</span><b style={{fontSize:14,color:"#1E293B"}}>Bugünün Akışı</b></div>
      <div style={{display:"grid",gap:5}}>{todayFlowLines.map(line=><div key={line} style={{fontSize:12,color:"#475569",lineHeight:1.45,wordBreak:"break-word"}}>{line}</div>)}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:13,marginBottom:24}}>
      {cards.map(card=><button key={card.view} onClick={()=>onNavigate(card.view)} style={{aspectRatio:"1.15/1",minHeight:145,border:"1.5px solid #E2E8F0",borderRadius:17,background:"#fff",padding:17,textAlign:"left",cursor:"pointer",boxShadow:"0 5px 18px rgba(15,23,42,.05)",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <span style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",background:card.color+"15",color:card.color}}><Icon name={card.icon} size={20}/></span>
        <span><span style={{display:"block",fontSize:card.value===""?15:25,fontWeight:850,color:card.color}}>{card.value===""?card.label:card.value}</span><span style={{display:"block",fontSize:12,fontWeight:800,color:"#1E293B",marginTop:2}}>{card.value===""?"":card.label}</span><span style={{display:"block",fontSize:10,color:"#94A3B8",marginTop:3}}>{card.desc}</span></span>
      </button>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:16}}><div style={{fontWeight:800,fontSize:13,marginBottom:10}}>Yaklaşan Çalışma Planları</div>{plans.slice(0,4).map(plan=>{const p=state.projects.find(x=>x.id===plan.projectId);const remote=plan.workType==="remote";return <div key={plan.id} style={{display:"flex",gap:9,alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}><span style={{width:8,height:8,borderRadius:"50%",background:remote?"#7C3AED":p?.color||"#4A6CF7"}}/><div style={{flex:1}}><div style={{fontSize:11,fontWeight:700}}>{p?.name||"Proje"}</div><div style={{fontSize:10,color:"#94A3B8"}}>{remote?"Uzaktan":"Saha"} · {fmt(plan.date)} · {plan.startTime}</div></div></div>})}{!plans.length&&<div style={{fontSize:12,color:"#94A3B8"}}>Yaklaşan çalışma planı yok.</div>}</div>
      <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:16}}><div style={{fontWeight:800,fontSize:13,marginBottom:10}}>Projelerim</div>{myProjects.slice(0,4).map(p=><button key={p.id} onClick={()=>onOpenProject(p.id)} style={{width:"100%",display:"flex",gap:9,alignItems:"center",padding:"9px 0",border:0,borderBottom:"1px solid #F1F5F9",background:"transparent",cursor:"pointer",textAlign:"left"}}><span style={{width:8,height:8,borderRadius:"50%",background:p.color}}/><span style={{fontSize:11,fontWeight:700}}>{p.name}</span></button>)}{!myProjects.length&&<div style={{fontSize:12,color:"#94A3B8"}}>Atanmış proje yok.</div>}</div>
      <div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:15,padding:16}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><div style={{fontWeight:800,fontSize:13}}>Yaklaşan To-Do'larım</div><button onClick={()=>onNavigate("todos")} style={{border:0,background:"#FDF2F8",color:"#BE185D",borderRadius:7,padding:"5px 7px",fontSize:9,fontWeight:800,cursor:"pointer"}}>Tümünü aç</button></div>{upcomingTodos.slice(0,5).map(todo=>{const project=state.projects.find(item=>item.id===todo.projectId);const late=todo.dueDate&&daysDiff(todo.dueDate)>0;return <button key={todo.id} onClick={()=>onNavigate("todos")} style={{width:"100%",border:0,borderBottom:"1px solid #F1F5F9",background:"transparent",padding:"8px 0",textAlign:"left",cursor:"pointer",display:"flex",gap:8,alignItems:"flex-start"}}><span style={{width:7,height:7,borderRadius:"50%",background:late?"#E11D48":"#DB2777",marginTop:4,flexShrink:0}}/><span style={{minWidth:0,flex:1}}><b style={{display:"block",fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{todo.action||todo.text}</b><span style={{display:"block",fontSize:9,color:late?"#E11D48":"#94A3B8",marginTop:2}}>{project?.name||todo.customer||"Genel"}{todo.dueDate?` · ${fmt(todo.dueDate)}`:""}{late?` · ${daysDiff(todo.dueDate)} gün gecikti`:""}</span></span></button>})}{!upcomingTodos.length&&<div style={{fontSize:12,color:"#94A3B8"}}>Açık To-Do bulunmuyor.</div>}</div>
    </div>
    {quick==="todo"&&<QuickTodoModal projects={state.projects} onClose={()=>setQuick(null)} onSave={saveQuickTodo}/>}
    {quick==="action"&&<QuickActionModal projects={state.projects} onClose={()=>setQuick(null)} onSave={saveQuickAction}/>}
  </div>;
}

function QuickTodoModal({projects,onClose,onSave}) {
  const [form,setForm]=useState({projectId:"",customer:"",dueDate:"",action:""});
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const selected=projects.find(project=>project.id===form.projectId);
  return <Modal title="Hızlı To-Do" onClose={onClose}>
    <Field label="Proje / Müşteri"><select style={iStyle} value={form.projectId} onChange={event=>update("projectId",event.target.value)}><option value="">Genel / proje yok</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
    {!selected&&<Field label="Müşteri"><input style={iStyle} value={form.customer} onChange={event=>update("customer",event.target.value)} placeholder="Müşteri adı"/></Field>}
    <Field label="Termin"><input type="date" style={iStyle} value={form.dueDate} onChange={event=>update("dueDate",event.target.value)}/></Field>
    <Field label="Aksiyon"><textarea style={{...iStyle,minHeight:100,resize:"vertical"}} value={form.action} onChange={event=>update("action",event.target.value)} placeholder="Ne yapılacak?"/></Field>
    <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn disabled={!form.action.trim()} onClick={()=>onSave({...form,customer:selected?.name||form.customer})}>Kaydet</Btn></div>
  </Modal>;
}

function QuickActionModal({projects,onClose,onSave}) {
  const [form,setForm]=useState({projectId:projects[0]?.id||"",tag:"Takip",text:"",effortHours:""});
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  return <Modal title="Hızlı Aksiyon" onClose={onClose}>
    <Field label="Proje"><select style={iStyle} value={form.projectId} onChange={event=>update("projectId",event.target.value)}>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><Field label="Aksiyon Türü"><select style={iStyle} value={form.tag} onChange={event=>update("tag",event.target.value)}>{DEFAULT_ACTION_TAGS.map(tag=><option key={tag}>{tag}</option>)}</select></Field><Field label="Efor (opsiyonel)"><input type="number" min="0" step=".25" style={iStyle} value={form.effortHours} onChange={event=>update("effortHours",event.target.value)}/></Field></div>
    <Field label="Not"><textarea style={{...iStyle,minHeight:120,resize:"vertical"}} value={form.text} onChange={event=>update("text",event.target.value)} placeholder="Ne yaptınız, kiminle görüştünüz, sonraki aksiyon nedir?"/></Field>
    <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn disabled={!form.projectId||!form.text.trim()} onClick={()=>onSave(form)}>Kaydet</Btn></div>
  </Modal>;
}

function MobileHomePage({state,setState,currentUser,myProjects,deadlineWarnings,onNavigate,onOpenProject}) {
  const [quick,setQuick]=useState(null);
  const dailyKey=`corject_daily_flow_${currentUser.id}_${todayStr()}`;
  const [showDailySummary,setShowDailySummary]=useState(()=>{try{return localStorage.getItem(dailyKey)!=="dismissed";}catch{return true;}});
  const todos=((state.userNotes||{})[currentUser.id]?.todos||[]).filter(todo=>!todo.done).sort((a,b)=>String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
  const plans=(state.fieldPlans||[]).filter(plan=>plan.userId===currentUser.id&&plan.date>=todayStr()).sort((a,b)=>`${a.date} ${a.startTime||""}`.localeCompare(`${b.date} ${b.startTime||""}`)).slice(0,5);
  const tickets=Object.entries(state.projectTickets||{}).flatMap(([projectId,list])=>(list||[]).map(ticket=>({ticket,project:state.projects.find(item=>item.id===projectId)}))).filter(({ticket})=>ticket.assignedTo===currentUser.id||ticket.author===currentUser.name).slice(0,5);
  const actions=Object.entries(state.projectActions||{}).flatMap(([projectId,list])=>(list||[]).map(action=>({action,project:state.projects.find(item=>item.id===projectId)}))).sort((a,b)=>String(b.action.actionAt||b.action.createdAt||"").localeCompare(String(a.action.actionAt||a.action.createdAt||""))).slice(0,8);
  const saveQuickTodo=(data)=>{
    const todo={id:uid(),customer:data.customer||"",projectId:data.projectId||"",dueDate:data.dueDate||"",action:data.action,text:data.action,done:false,createdAt:now()};
    setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...((current.userNotes||{})[currentUser.id]||{}),todos:[...(((current.userNotes||{})[currentUser.id]?.todos)||[]),todo]}}}));
    setQuick(null);
  };
  const saveQuickAction=(data)=>{
    if(!data.projectId)return;
    const action={id:uid(),tag:data.tag||"Takip",text:data.text,effortHours:parseFloat(data.effortHours)||0,actionAt:now(),createdAt:now(),authorId:currentUser.id,authorName:currentUser.name};
    setState(current=>({...current,projectActions:{...(current.projectActions||{}),[data.projectId]:[action,...(((current.projectActions||{})[data.projectId])||[])]}}));
    setQuick(null);
    onOpenProject(data.projectId);
  };
  const closeDailySummary=()=>{try{localStorage.setItem(dailyKey,"dismissed");}catch{}setShowDailySummary(false);};
  const todayPlans=plans.filter(plan=>plan.date===todayStr());
  const overdueTodos=todos.filter(todo=>todo.dueDate&&daysDiff(todo.dueDate)>0);
  const urgentTodos=todos.filter(todo=>todo.dueDate&&!overdueTodos.includes(todo)&&daysDiff(todo.dueDate)>=-2);
  const dailyLines=[
    todayPlans.length?`Bugün ${todayPlans.length} çalışma planınız var.`:plans.length?`Yaklaşan ilk planınız ${fmt(plans[0].date)} tarihinde.`:"Bugün planlı saha/uzaktan çalışma görünmüyor.",
    overdueTodos.length?`${overdueTodos.length} To-Do gecikmiş; önce bunlara bakmak iyi olur.`:urgentTodos.length?`${urgentTodos.length} To-Do yakın terminli.`:"Acil To-Do görünmüyor.",
    deadlineWarnings.length?`${deadlineWarnings.length} termin uyarısı takip bekliyor.`:"Termin tarafı sakin görünüyor.",
  ];
  const storyItems=[
    {id:"todo",label:"To-Do",value:todos.length,color:"#DB2777",icon:"ticket",action:()=>onNavigate("todos")},
    {id:"plan",label:"Plan",value:plans.length,color:"#0F766E",icon:"calendar",action:()=>onNavigate("fieldops")},
    {id:"late",label:"Termin",value:deadlineWarnings.length,color:"#E11D48",icon:"clock",action:()=>onNavigate("deadlines")},
    {id:"ticket",label:"Ticket",value:tickets.length,color:"#EA6C00",icon:"ticket",action:()=>onNavigate("tickets")},
    {id:"ai",label:"AI",value:"",color:"#7C3AED",icon:"activity",action:()=>onNavigate("ai")},
    {id:"modules",label:"Modüller",value:"",color:"#0369A1",icon:"reports",action:()=>onNavigate("reports")},
  ];
  return <div style={{minHeight:"100%",background:"linear-gradient(180deg,#F8FAFC 0%,#EEF2FF 100%)",padding:"12px 13px 92px",overflow:"auto"}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:9,padding:"4px 0 14px"}}>
      {storyItems.map(item=><button key={item.id} onClick={item.action} style={{border:"1px solid #E2E8F0",background:"#fff",borderRadius:18,padding:"10px 7px",cursor:"pointer",textAlign:"center",minWidth:0,boxShadow:"0 6px 16px rgba(15,23,42,.04)"}}>
        <span style={{width:46,height:42,borderRadius:14,display:"grid",placeItems:"center",margin:"0 auto 7px",background:item.color+"14",border:`1px solid ${item.color}24`,color:item.color,position:"relative"}}>
          <Icon name={item.icon} size={22}/>{item.value!==""&&<b style={{position:"absolute",right:5,top:5,minWidth:18,height:18,borderRadius:9,display:"grid",placeItems:"center",background:item.color,color:"#fff",fontSize:9,border:"2px solid #fff"}}>{item.value}</b>}
        </span>
        <span style={{fontSize:10,fontWeight:900,color:"#475569",whiteSpace:"nowrap"}}>{item.label}</span>
      </button>)}
    </div>
    {showDailySummary&&<div style={{background:"linear-gradient(135deg,#EFF6FF,#F5F3FF)",border:"1px solid #DBEAFE",borderRadius:24,padding:18,color:"#172033",boxShadow:"0 18px 40px rgba(67,56,202,.12)",marginBottom:13}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}><span style={{width:42,height:42,borderRadius:15,background:"#EEF2FF",color:"#4338CA",display:"grid",placeItems:"center",flexShrink:0}}><Icon name="activity" size={20}/></span><div style={{flex:1}}><div style={{fontSize:11,color:"#4F46E5",fontWeight:900}}>AI · Bugünün Akışı</div><h2 style={{margin:"2px 0 6px",fontSize:18,color:"#111827"}}>Merhaba, {currentUser.name.split(" ")[0]}</h2><div style={{display:"grid",gap:5}}>{dailyLines.map(line=><div key={line} style={{fontSize:12,color:"#475569",lineHeight:1.45}}>• {line}</div>)}</div></div><button onClick={closeDailySummary} style={{border:0,background:"#fff",borderRadius:10,width:30,height:30,cursor:"pointer",color:"#64748B",fontWeight:900}}>×</button></div>
    </div>}
    <MobileFeedCard title="To-Do" actionLabel="Tümü" onAction={()=>onNavigate("todos")}>
      {todos.slice(0,4).map(todo=><MobileFeedRow key={todo.id} color={todo.dueDate&&daysDiff(todo.dueDate)>0?"#E11D48":"#DB2777"} icon="ticket" title={todo.action||todo.text} meta={`${todo.customer||state.projects.find(item=>item.id===todo.projectId)?.name||"Genel"}${todo.dueDate?` · ${fmt(todo.dueDate)}`:""}`} onClick={()=>onNavigate("todos")}/>)}
      {!todos.length&&<EmptyMobileRow text="Açık To-Do yok."/>}
    </MobileFeedCard>
    <MobileFeedCard title="Yaklaşan Planlar" actionLabel="Tümü" onAction={()=>onNavigate("fieldops")}>
      {plans.map(plan=>{const project=state.projects.find(item=>item.id===plan.projectId);const dayName=plan.date?new Date(plan.date).toLocaleDateString("tr-TR",{weekday:"long"}):"";return <MobileFeedRow key={plan.id} color={plan.workType==="remote"?"#7C3AED":project?.color||"#0F766E"} icon="calendar" title={project?.name||"Plan"} meta={`${dayName?`${dayName} · `:""}${fmt(plan.date)} · ${plan.startTime||""} - ${plan.endTime||""}`} onClick={()=>onNavigate("fieldops")}/>;})}
      {!plans.length&&<EmptyMobileRow text="Yaklaşan saha/uzaktan çalışma yok."/>}
    </MobileFeedCard>
    <MobileFeedCard title="Son Aksiyonlar" actionLabel="Tümü" onAction={()=>onNavigate("projects")}>
      {actions.slice(0,4).map(({action,project})=><MobileFeedRow key={action.id} color={project?.color||"#4A6CF7"} icon="activity" title={action.text||"Aksiyon"} meta={`${project?.name||"Proje"} · ${action.authorName||""}`} onClick={()=>project&&onOpenProject(project.id)}/>)}
      {!actions.length&&<EmptyMobileRow text="Henüz aksiyon kaydı yok."/>}
    </MobileFeedCard>
    <MobileFeedCard title="Projeler" actionLabel="Tümü" onAction={()=>onNavigate("projects")}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
        {myProjects.slice(0,4).map(project=>{const total=project.milestones.reduce((sum,ms)=>sum+ms.tasks.length,0);const done=project.milestones.reduce((sum,ms)=>sum+ms.tasks.filter(task=>task.status==="Tamamlandı").length,0);const progress=total?Math.round(done/total*100):0;return <button key={project.id} onClick={()=>onOpenProject(project.id)} style={{border:0,borderRadius:16,background:"#F8FAFC",padding:12,textAlign:"left",cursor:"pointer"}}>
          <span style={{width:28,height:28,borderRadius:10,background:project.color+"18",color:project.color,display:"grid",placeItems:"center",marginBottom:10}}><Icon name="projects" size={15}/></span>
          <b style={{display:"block",fontSize:12,lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{project.name}</b>
          <span style={{display:"block",fontSize:10,color:"#94A3B8",marginTop:3}}>%{progress} ilerleme</span>
          <span style={{display:"block",height:5,background:"#E2E8F0",borderRadius:8,overflow:"hidden",marginTop:8}}><i style={{display:"block",height:"100%",width:`${progress}%`,background:project.color}}/></span>
        </button>;})}
      </div>
      {!myProjects.length&&<EmptyMobileRow text="Atanmış proje yok."/>}
    </MobileFeedCard>
    {quick==="todo"&&<QuickTodoModal projects={state.projects} onClose={()=>setQuick(null)} onSave={saveQuickTodo}/>}
    {quick==="action"&&<QuickActionModal projects={state.projects} onClose={()=>setQuick(null)} onSave={saveQuickAction}/>}
  </div>;
}

function MobileFeedCard({title,actionLabel,onAction,children}) {
  return <section style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:20,padding:14,marginBottom:12,boxShadow:"0 8px 24px rgba(15,23,42,.05)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><h3 style={{margin:0,fontSize:14}}>{title}</h3>{actionLabel&&<button onClick={onAction} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:10,padding:"6px 9px",fontSize:10,fontWeight:900,cursor:"pointer"}}>{actionLabel}</button>}</div>
    <div style={{display:"grid",gap:8}}>{children}</div>
  </section>;
}

function MobileFeedRow({color,icon,title,meta,onClick}) {
  return <button onClick={onClick} style={{border:0,background:"#F8FAFC",borderRadius:14,padding:10,display:"flex",gap:10,alignItems:"center",textAlign:"left",cursor:"pointer"}}>
    <span style={{width:34,height:34,borderRadius:12,background:color+"16",color,display:"grid",placeItems:"center",flexShrink:0}}><Icon name={icon} size={16}/></span>
    <span style={{minWidth:0,flex:1}}><b style={{display:"block",fontSize:12,lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{title}</b><small style={{display:"block",fontSize:10,color:"#94A3B8",marginTop:2,lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{meta}</small></span>
  </button>;
}

function EmptyMobileRow({text}) {
  return <div style={{padding:"14px 10px",fontSize:11,color:"#94A3B8",textAlign:"center",background:"#F8FAFC",borderRadius:14}}>{text}</div>;
}

function MobileQuickSheet({onClose,onSelect,isAdminMode=false}) {
  const options=isAdminMode
    ? [
        ["assign","tasks","Görev Ata","Ekip üyesine görev ve hedef saat ata","#111827"],
        ["fieldops","calendar","Saha Planı","Ziyaret veya uzaktan çalışma planla","#0F766E"],
      ]
    : [
        ["todo","ticket","To-Do","Kişisel aksiyon ve termin ekle","#DB2777"],
        ["action","activity","Aksiyon","Projeye görüşme, not veya efor gir","#2563EB"],
        ["ticket","ticket","Ticket","Müşteri talebi veya problem kaydı aç","#EA6C00"],
        ["fieldops","calendar","Saha Planı","Ziyaret veya uzaktan çalışma planla","#0F766E"],
      ];
  return <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:980,background:"rgba(15,23,42,.38)",display:"flex",alignItems:"flex-end",padding:12}}>
    <div onClick={event=>event.stopPropagation()} style={{width:"100%",background:"#fff",borderRadius:26,padding:16,boxShadow:"0 -18px 55px rgba(15,23,42,.22)"}}>
      <div style={{width:44,height:5,borderRadius:99,background:"#CBD5E1",margin:"0 auto 14px"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><b style={{fontSize:16}}>Hızlı Ekle</b><div style={{fontSize:11,color:"#64748B",marginTop:3}}>Ne eklemek istiyorsun?</div></div><button onClick={onClose} style={{border:0,background:"#F1F5F9",borderRadius:12,width:34,height:34,cursor:"pointer"}}>×</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>{options.map(([id,icon,title,desc,color])=><button key={id} onClick={()=>onSelect(id)} style={{border:"1px solid #E2E8F0",background:"linear-gradient(180deg,#fff,#F8FAFC)",borderRadius:18,padding:14,textAlign:"left",cursor:"pointer",minHeight:122}}>
        <span style={{width:42,height:42,borderRadius:15,background:color+"16",color,display:"grid",placeItems:"center",marginBottom:10}}><Icon name={icon} size={20}/></span>
        <b style={{display:"block",fontSize:14,color:"#111827"}}>{title}</b>
        <span style={{display:"block",fontSize:10,color:"#64748B",lineHeight:1.35,marginTop:4}}>{desc}</span>
      </button>)}</div>
    </div>
  </div>;
}

function MobileBottomNav({view,onNavigate,onQuick,onProfile,deadlineCount,taskCount,isAdminMode=false}) {
  const items=[
    ["dashboard","home","Ana"],
    ["projects","projects","Projeler"],
    ["quick","plus",isAdminMode?"Görev Ata":"Ekle"],
    ["mytasks","tasks",isAdminMode?"Atadıklarım":"İşler",taskCount],
    ["tickets","ticket","Ticket"],
  ];
  return <div style={{position:"fixed",left:10,right:10,bottom:10,zIndex:920,background:"rgba(255,255,255,.92)",backdropFilter:"blur(18px)",border:"1px solid rgba(226,232,240,.9)",borderRadius:24,padding:"8px 9px",display:"grid",gridTemplateColumns:"repeat(5,1fr)",boxShadow:"0 18px 45px rgba(15,23,42,.18)"}}>
    {items.map(([id,icon,label,badge])=>{const active=view===id;return <button key={id} onClick={()=>id==="quick"?onQuick():onNavigate(id)} style={{border:0,background:"transparent",display:"grid",placeItems:"center",gap:3,color:active?"#4338CA":"#64748B",fontSize:9,fontWeight:900,cursor:"pointer",position:"relative",padding:0}}>
      <span style={{width:id==="quick"?58:34,height:id==="quick"?58:34,borderRadius:id==="quick"?20:14,display:"grid",placeItems:"center",background:id==="quick"?"linear-gradient(135deg,#4A6CF7,#7C3AED)":active?"#EEF2FF":"transparent",color:id==="quick"?"#fff":active?"#4338CA":"#64748B",transform:id==="quick"?"translateY(-16px)":"none",boxShadow:id==="quick"?"0 14px 28px rgba(79,70,229,.32)":"none",fontSize:id==="quick"?28:undefined,fontWeight:900}}>{id==="quick"?"+":<Icon name={icon} size={17}/>}</span>
      <span style={{marginTop:id==="quick"?-8:0}}>{label}</span>
      {badge>0&&<b style={{position:"absolute",top:2,right:"24%",minWidth:16,height:16,borderRadius:8,display:"grid",placeItems:"center",background:"#E11D48",color:"#fff",fontSize:8,border:"2px solid #fff"}}>{badge}</b>}
    </button>;})}
  </div>;
}

function MobileFeatureMenuPage({isAdmin,onNavigate}) {
  const items=[
    ["tickets","ticket","Ticketlar","Müşteri talepleri ve durum takibi","#EA6C00"],
    ["reports","reports","Raporlar","HTML/XLSX raporlar ve özetler","#4A6CF7"],
    ["ai","activity","AI Tool","Proje veya portföy yorumu","#7C3AED"],
    ["fieldops","calendar","Saha Yönetimi","Planlar ve ziyaretler","#0F766E"],
    ["deadlines","clock","Termin Uyarıları","Gecikmeler ve yaklaşan işler","#E11D48"],
    ["todos","tasks","To-Do","Kişisel aksiyonlar","#DB2777"],
    ["people","people","Ekip","Organizasyon ve kişiler","#0369A1"],
    ...(isAdmin?[["admin","admin","Yönetici","KPI ve yönetim paneli","#111827"],["import","download","Import Merkezi","Şablon ve veri aktarımı","#059669"],["mailcenter","mail","Mail Merkezi","Şablonlar ve otomasyon","#4338CA"]]:[]),
  ];
  return <div style={{minHeight:"100%",background:"#F8FAFC",padding:"18px 14px 92px",overflow:"auto"}}>
    <div style={{marginBottom:14}}><h2 style={{margin:"0 0 4px",fontSize:20}}>Tüm Özellikler</h2><div style={{fontSize:12,color:"#64748B"}}>Web tarafındaki ana alanlara mobilde de buradan erişebilirsiniz.</div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>{items.map(([view,icon,title,desc,color])=><button key={view} onClick={()=>onNavigate(view)} style={{border:"1px solid #E2E8F0",background:"#fff",borderRadius:18,padding:14,textAlign:"left",cursor:"pointer",minHeight:122,boxShadow:"0 8px 22px rgba(15,23,42,.04)"}}>
      <span style={{width:38,height:38,borderRadius:13,background:color+"16",color,display:"grid",placeItems:"center",marginBottom:10}}><Icon name={icon} size={18}/></span>
      <b style={{display:"block",fontSize:13,color:"#111827"}}>{title}</b>
      <span style={{display:"block",fontSize:10,color:"#64748B",lineHeight:1.35,marginTop:4}}>{desc}</span>
    </button>)}</div>
  </div>;
}

function AdminBoardCard({id,size="medium",draggedId,onDragStart,onDragEnd,onDrop,onResize,children,style={}}) {
  const active=draggedId===id;
  const sizeLabels={small:"Kompakt",medium:"Orta",large:"Geniş",full:"Tam"};
  return <div
    className={`admin-board-card admin-board-${size}`}
    onDragOver={event=>event.preventDefault()}
    onDrop={event=>onDrop(event,id)}
    style={{position:"relative",opacity:active?.48:1,transform:active?"scale(.985)":"none",transition:"opacity .15s, transform .15s",...style}}
  >
    <div className="admin-board-tools" style={{position:"absolute",top:7,right:8,zIndex:3,display:"flex",alignItems:"center",gap:3}}>
      <select className="admin-card-size-select" title="Kart genişliği" value={size} onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onChange={event=>onResize(id,event.target.value)} style={{border:"1px solid #E2E8F0",borderRadius:6,background:"#fff",color:"#94A3B8",fontSize:9,padding:"2px 3px",cursor:"pointer",maxWidth:68}}>{Object.entries(sizeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <div draggable onDragStart={event=>onDragStart(event,id)} onDragEnd={onDragEnd} title="Sürükleyerek yerini değiştir" style={{color:"#CBD5E1",fontSize:15,lineHeight:1,cursor:"grab",letterSpacing:1,userSelect:"none"}}>⠿</div>
    </div>
    {children}
  </div>;
}

function ManagerAssignedTasks({state,currentUser}) {
  const tasks=(state.personalTasks||[]).filter(task=>task.createdBy===currentUser.id);
  const rows=tasks.map(task=>({...task,person:state.people.find(person=>person.id===task.assignee)}));
  const active=rows.filter(task=>task.status!=="Tamamland\u0131");
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
      {[["Toplam Atama",rows.length,"#4A6CF7"],["Aktif",active.length,"#EA6C00"],["Geciken",active.filter(task=>delayLvl(task.dueDate,task.status)).length,"#E11D48"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:12,padding:13}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><b style={{fontSize:23,color}}>{value}</b></div>)}
    </div>
    <div style={{display:"grid",gap:7}}>{rows.map(task=><div key={task.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:11,padding:"11px 13px",display:"flex",alignItems:"center",gap:10}}>
      <Avatar initials={task.person?.avatar||"?"} imageUrl={task.person?.avatarUrl} size={28}/>
      <div style={{flex:1,minWidth:0}}><b style={{fontSize:12}}>{task.title}</b><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{task.person?.name||"Atanmamış"} · {fmt(task.dueDate)} · {task.status}</div></div>
      {delayLvl(task.dueDate,task.status)&&<DelayBadge dateStr={task.dueDate} status={task.status}/>}
    </div>)}{!rows.length&&<div style={{padding:35,textAlign:"center",color:"#94A3B8",background:"#fff",borderRadius:12,border:"1px dashed #CBD5E1"}}>Henüz yönetici ataması bulunmuyor.</div>}</div>
  </div>;
}

function ManagerAssignedTasksV2({state,setState,currentUser,onAssignTask}) {
  const [personFilter,setPersonFilter]=useState("all");
  const [modal,setModal]=useState(null);
  const [assignmentNotice,setAssignmentNotice]=useState("");
  const tasks=(state.personalTasks||[]).filter(task=>task.createdBy===currentUser.id);
  const peopleWithTasks=state.people.filter(person=>tasks.some(task=>task.assignee===person.id));
  const rows=tasks
    .filter(task=>personFilter==="all"||task.assignee===personFilter)
    .map(task=>({...task,person:state.people.find(person=>person.id===task.assignee),project:state.projects.find(project=>project.id===task.projectId),source:"personal"}))
    .sort((a,b)=>{
      const ad=delayLvl(a.dueDate,a.status)?1:0,bd=delayLvl(b.dueDate,b.status)?1:0;
      if(ad!==bd)return bd-ad;
      if(a.status==="Tamamlandı"&&b.status!=="Tamamlandı")return 1;
      if(b.status==="Tamamlandı"&&a.status!=="Tamamlandı")return -1;
      return String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999"));
    });
  const active=tasks.filter(task=>task.status!=="Tamamlandı");
  const updateTask=(id,data)=>setState(current=>{
    const old=(current.personalTasks||[]).find(task=>task.id===id);
    if(!old)return current;
    const notices=[];
    const patch={...data};
    if(data.status&&old.status!==data.status){
      patch.statusUpdatedAt=now();
      patch.statusUpdatedBy=currentUser.id;
      [old.assignee,old.createdBy].filter(Boolean).filter((userId,index,array)=>array.indexOf(userId)===index&&userId!==currentUser.id).forEach(userId=>notices.push({id:uid(),ts:now(),userId,msg:`"${old.title}" görevinin durumu ${data.status} oldu.`,projectName:"Yönetici Ataması",taskId:old.id,type:"task_status",read:false}));
    }
    if(data.comments&&data.comments.length>(old.comments||[]).length&&old.assignee&&old.assignee!==currentUser.id){
      notices.push({id:uid(),ts:now(),userId:old.assignee,msg:`"${old.title}" görevine yeni not eklendi.`,projectName:"Yönetici Ataması",taskId:old.id,type:"task_comment",read:false});
    }
    return {...current,personalTasks:(current.personalTasks||[]).map(task=>task.id===id?{...task,...patch}:task),notifications:[...notices,...(current.notifications||[])]};
  });
  const assignTask=async(data)=>{
    setAssignmentNotice("");
    const result=await onAssignTask(data);
    const created=result?.tasks?.length||0;
    const whatsapp=result?.notifications?.filter(item=>item.sent&&item.channel==="whatsapp").length||0;
    const email=result?.notifications?.filter(item=>item.sent&&item.channel==="email").length||0;
    const failed=result?.notifications?.filter(item=>!item.sent).length||0;
    setAssignmentNotice(`${created} görev oluşturuldu · WhatsApp: ${whatsapp} · E-posta: ${email}${failed?` · Ulaşmayan: ${failed}`:""}`);
    setModal(null);
  };
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(135px,1fr))",gap:10,marginBottom:14}}>
      {[["Toplam Atama",tasks.length,"#4A6CF7"],["Aktif",active.length,"#EA6C00"],["Geciken",active.filter(task=>delayLvl(task.dueDate,task.status)).length,"#E11D48"],["Tamamlanan",tasks.filter(task=>task.status==="Tamamlandı").length,"#059669"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:12,padding:13}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><b style={{fontSize:23,color}}>{value}</b></div>)}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:12}}>
      <div style={{fontSize:12,color:"#64748B",fontWeight:800}}>Geciken görevler listede üstte görünür.</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><Btn small onClick={()=>setModal({type:"addPersonal"})}>+ Yeni Gorev Ata</Btn><select style={{...iStyle,width:220,background:"#fff"}} value={personFilter} onChange={event=>setPersonFilter(event.target.value)}><option value="all">Tum kisiler</option>{peopleWithTasks.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
    </div>
    {assignmentNotice&&<div style={{margin:"0 0 12px",padding:"10px 13px",borderRadius:10,background:"#ECFDF5",color:"#047857",fontSize:12,fontWeight:800}}>{assignmentNotice}</div>}
    <div style={{display:"grid",gap:8}}>{rows.map(task=><div key={task.id} style={{background:"#fff",border:`1.5px solid ${delayLvl(task.dueDate,task.status)?"#FCA5A5":"#E2E8F0"}`,borderRadius:13,padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10,minWidth:0}}>
      <Avatar initials={task.person?.avatar||"?"} imageUrl={task.person?.avatarUrl} size={30}/>
      <button onClick={()=>setModal({type:"taskDetail",data:task})} style={{flex:1,minWidth:0,border:0,background:"transparent",textAlign:"left",cursor:"pointer",padding:0}}><b style={{fontSize:12,display:"block",lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{task.title}</b><div style={{fontSize:10,color:"#64748B",marginTop:3,lineHeight:1.35,wordBreak:"break-word",overflowWrap:"anywhere"}}>{task.person?.name||"Atanmamış"} · {task.project?.name||"Projesiz"} · {fmt(task.dueDate)}{task.dueTime?` ${task.dueTime}`:""} · {task.status}</div>{task.firstSeenAt&&<div style={{fontSize:10,color:"#059669",marginTop:3,fontWeight:800}}>İlk görüntüleme: {new Date(task.firstSeenAt).toLocaleString("tr-TR")}</div>}{task.notes&&<div style={{fontSize:10,color:"#94A3B8",marginTop:3,lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{task.notes}</div>}</button>
      {delayLvl(task.dueDate,task.status)&&<DelayBadge dateStr={task.dueDate} status={task.status}/>}
      <select onClick={event=>event.stopPropagation()} style={{...iStyle,width:150,background:"#F8FAFC",fontSize:11}} value={task.status||"Bekliyor"} onChange={event=>updateTask(task.id,{status:event.target.value})}>{STATUSES.map(status=><option key={status}>{status}</option>)}</select>
    </div>)}{!rows.length&&<div style={{padding:35,textAlign:"center",color:"#94A3B8",background:"#fff",borderRadius:12,border:"1px dashed #CBD5E1"}}>Bu filtrede yönetici ataması bulunmuyor.</div>}</div>
    {modal?.type==="taskDetail"&&<SharedTaskDetailModal task={(state.personalTasks||[]).find(task=>task.id===modal.data.id)||modal.data} people={state.people} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onUpdate={data=>updateTask(modal.data.id,data)} />}
    {modal?.type==="addPersonal"&&<SharedPersonalTaskModal title="Gorev Ata" people={state.people} projects={state.projects} isAdmin currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={assignTask} />}
  </div>;
}

function ManagementWorkspace({state,setState,currentUser,onOpenProject,onNavigate,onEditPerson,onAddPerson,onAssignTask,initialSection="overview"}) {
  const [section,setSection]=useState(initialSection);
  const [newRole,setNewRole]=useState("");
  const roles=organizationRoles(state);
  useEffect(()=>setSection(initialSection),[initialSection]);
  const addRole=()=>{
    const label=newRole.trim();
    if(!label)return;
    setState(current=>({...current,organizationRoles:[...(current.organizationRoles||[]),{id:`custom_${uid()}`,label,rank:roles.length+1}]}));
    setNewRole("");
  };
  const tabs=<div className="management-tabs" style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:12,justifyContent:"center",margin:"12px auto 18px",width:"fit-content",maxWidth:"100%"}}>{[["overview","Genel Bakış"],["assigned","Atadığım İşler"],["organization","Organizasyon"]].map(([id,label])=><button key={id} onClick={()=>setSection(id)} style={{border:0,borderRadius:9,padding:"9px 14px",fontSize:11,fontWeight:850,cursor:"pointer",background:section===id?"#fff":"transparent",color:section===id?"#4A6CF7":"#64748B",whiteSpace:"nowrap"}}>{label}</button>)}</div>;
  return <div style={{padding:"20px clamp(14px,3vw,28px)",flex:1,overflow:"auto",background:"linear-gradient(180deg,#F8FAFC 0%,#EEF2FF 100%)"}}>
    <div className="management-heading" style={{textAlign:"center",maxWidth:760,margin:"0 auto"}}>
      <h2 style={{margin:0,fontSize:"clamp(23px,3vw,30px)",fontWeight:950,color:"#172033",letterSpacing:"-.03em"}}>Operasyon Kontrol Merkezi</h2>
      <p style={{margin:"7px auto 0",fontSize:12,color:"#64748B",lineHeight:1.55,maxWidth:560}}>Projeler, terminler, riskler, ekip yükü ve ticketlar için tek bakışta karar ekranı.</p>
      {tabs}
    </div>
    {section==="overview"&&<AdminDashboard state={state} setState={setState} currentUser={currentUser} onOpenProject={onOpenProject} onNavigate={onNavigate} showHeader={false}/>}
    {section==="assigned"&&<ManagerAssignedTasksV2 state={state} setState={setState} currentUser={currentUser} onAssignTask={onAssignTask}/>}
    {section==="organization"&&<><div style={{display:"flex",justifyContent:"flex-end",gap:7,marginBottom:10,flexWrap:"wrap"}}><input style={{...iStyle,width:220}} value={newRole} onChange={event=>setNewRole(event.target.value)} onKeyDown={event=>event.key==="Enter"&&addRole()} placeholder="Yeni organizasyon rolü"/><Btn small onClick={addRole}>Rol Ekle</Btn><Btn small variant="secondary" onClick={onAddPerson}>Kişi Ekle</Btn></div><SharedOrganizationPanel people={state.people} roles={roles} onEdit={onEditPerson}/></>}
  </div>;
}

function AdminDashboard({state,setState,currentUser,onOpenProject,onNavigate,showHeader=true}) {
  const [projectId,setProjectId]=useState("all");
  const [detailModal,setDetailModal]=useState(null);
  const [draggedCard,setDraggedCard]=useState(null);
  const [aiSummaryRefresh,setAiSummaryRefresh]=useState(0);
  const projects=projectId==="all"?state.projects:state.projects.filter(project=>project.id===projectId);
  const projectIds=new Set(projects.map(project=>project.id));
  const scopedState={
    ...state,
    projects,
    projectTickets:Object.fromEntries(
      Object.entries(state.projectTickets||{}).filter(([id])=>projectIds.has(id)),
    ),
  };
  const tasks=projects.flatMap(project=>project.milestones.flatMap(milestone=>
    milestone.tasks.map(task=>({task,project,milestone}))
  ));
  const tickets=Object.entries(state.projectTickets||{}).flatMap(([id,list])=>
    projectIds.has(id)?(list||[]).map(ticket=>({ticket,project:state.projects.find(project=>project.id===id)})):[]
  );
  const risks=projects.flatMap(project=>(project.risks||[]).map(risk=>({risk,project})));
  const activeTasks=tasks.filter(({task})=>task.status!=="Tamamlandı");
  const completedTasks=tasks.filter(({task})=>task.status==="Tamamlandı");
  const delayedTasks=activeTasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const criticalTasks=delayedTasks.filter(({task})=>delayLvl(task.dueDate,task.status)==="critical");
  const dueSoon=activeTasks.filter(({task})=>{
    if(!task.dueDate||delayLvl(task.dueDate,task.status))return false;
    const days=-daysDiff(task.dueDate);
    return days>=0&&days<=14;
  }).sort((a,b)=>(a.task.dueDate||"").localeCompare(b.task.dueDate||""));
  const openTickets=tickets.filter(({ticket})=>!["Tamamlandı","İptal Edildi"].includes(ticket.status));
  const staleTickets=openTickets.filter(({ticket})=>daysDiff(ticket.updatedAt||ticket.ts)>=7);
  const openRisks=risks.filter(({risk})=>risk.status!=="Kapalı");
  const highRisks=openRisks.filter(({risk})=>["Yüksek","Kritik"].includes(risk.level));
  const effortHours=tasks.reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0)
    +(state.fieldPlans||[]).filter(plan=>projectIds.has(plan.projectId)&&(plan.status==="completed"||plan.completedAt)).reduce((total,plan)=>total+fieldPlanHours(plan),0)
    +Object.entries(state.projectActions||{}).filter(([id])=>projectIds.has(id)).flatMap(([,items])=>items||[]).reduce((total,item)=>total+(parseFloat(item.effortHours)||0),0);
  const estimatedHours=tasks.reduce((total,{task})=>total+(parseFloat(task.estimatedHours)||0),0);
  const machineList=projects.flatMap(project=>project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[]);
  const commissioned=machineList.filter(machine=>machine.commissioned).length;
  const progress=tasks.length?Math.round(completedTasks.length/tasks.length*100):0;
  const onTimeRate=tasks.length?Math.round((tasks.length-delayedTasks.length)/tasks.length*100):100;
  const riskRate=projects.length?Math.min(100,Math.round(highRisks.length/projects.length*25)):0;
  const health=Math.max(0,Math.min(100,Math.round(progress*.45+onTimeRate*.45+(100-riskRate)*.1)));
  const healthColor=health>=80?"#059669":health>=60?"#EA6C00":"#E11D48";

  const projectRows=projects.map(project=>{
    const projectTasks=project.milestones.flatMap(milestone=>milestone.tasks);
    const done=projectTasks.filter(task=>task.status==="Tamamlandı").length;
    const delayed=projectTasks.filter(task=>delayLvl(task.dueDate,task.status)).length;
    const critical=projectTasks.filter(task=>delayLvl(task.dueDate,task.status)==="critical").length;
    const projectRisks=(project.risks||[]).filter(risk=>risk.status!=="Kapalı").length;
    const pct=projectTasks.length?Math.round(done/projectTasks.length*100):0;
    const score=Math.max(0,Math.min(100,Math.round(pct*.55+(projectTasks.length?(projectTasks.length-delayed)/projectTasks.length*35:35)+Math.max(0,10-projectRisks*3-critical*3))));
    return {project,total:projectTasks.length,done,delayed,critical,risks:projectRisks,pct,score};
  }).sort((a,b)=>a.score-b.score);

  const workload=state.people.map(person=>{
    const personTasks=activeTasks.filter(({task})=>task.assignee===person.id);
    return {
      person,
      active:personTasks.length,
      delayed:personTasks.filter(({task})=>delayLvl(task.dueDate,task.status)).length,
      hours:tasks.filter(({task})=>task.assignee===person.id).reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0),
    };
  }).filter(item=>item.active||item.hours).sort((a,b)=>b.active-a.active||b.hours-a.hours);
  const maxWorkload=Math.max(1,...workload.map(item=>item.active));
  const ticketStatuses=TICKET_STATUSES.map(status=>({
    status,
    count:tickets.filter(({ticket})=>(ticket.status||"Açık")===status).length,
  })).filter(item=>item.count);
  const maxTicketStatus=Math.max(1,...ticketStatuses.map(item=>item.count));
  const statusColors={"Açık":"#3B82F6","Ürün Ekibinde":"#8B5CF6","Devam Ediyor":"#F59E0B","Beklemede":"#64748B","Tamamlandı":"#10B981","İptal Edildi":"#EF4444"};
  const kpis=[
    {id:"health",label:"Portföy Sağlığı",value:`${health}%`,detail:health>=80?"Kontrol altında":health>=60?"Yakın takip gerekli":"Yönetici aksiyonu gerekli",color:healthColor,info:"Görev ilerlemesi %45, termin uyumu %45 ve yüksek/kritik risk yoğunluğu %10 ağırlıkla hesaplanır.",items:projectRows.map(item=>({title:item.project.name,meta:`Sağlık ${item.score} · İlerleme %${item.pct} · ${item.delayed} gecikme`}))},
    {id:"progress",label:"Genel İlerleme",value:`${progress}%`,detail:`${completedTasks.length}/${tasks.length} görev tamamlandı`,color:"#4A6CF7",info:"Tamamlanan görev sayısının kapsamdaki toplam görev sayısına oranıdır.",items:tasks.map(({task,project})=>({title:task.title,meta:`${project.name} · ${task.status}`}))},
    {id:"deadlines",label:"Kritik Termin",value:criticalTasks.length,detail:`${delayedTasks.length} toplam gecikme`,color:"#E11D48",info:"Termin tarihi en az 7 gün geçmiş ve tamamlanmamış görevler kritik kabul edilir.",items:delayedTasks.map(({task,project})=>({title:task.title,meta:`${project.name} · ${daysDiff(task.dueDate)} gün gecikti`}))},
    {id:"tickets",label:"Açık Ticket",value:openTickets.length,detail:`${staleTickets.length} ticket 7+ gündür aksiyonsuz`,color:"#EA6C00",info:"Tamamlandı veya İptal Edildi dışındaki ticketlar açık; son güncellemesi 7 günü geçenler aksiyonsuz sayılır.",items:openTickets.map(({ticket,project})=>({title:`${ticketNumber(ticket)} · ${ticket.title}`,meta:`${project?.name||"Proje"} · ${ticket.status||"Açık"}`}))},
    {id:"risks",label:"Açık Risk",value:openRisks.length,detail:`${highRisks.length} yüksek/kritik`,color:"#7C3AED",info:"Kapalı olmayan riskler sayılır; Yüksek ve Kritik seviyeler ayrıca vurgulanır.",items:openRisks.map(({risk,project})=>({title:risk.title,meta:`${project.name} · ${risk.level}`}))},
    {id:"effort",label:"Toplam Efor",value:`${effortHours} sa`,detail:estimatedHours?`${estimatedHours} sa planlandı`:"Plan eforu girilmedi",color:"#0369A1",info:"Görev zaman kayıtları, tamamlanan saha ziyaretleri ve efor girilmiş proje aksiyonlarının toplamıdır.",items:projects.map(project=>({title:project.name,meta:`${project.milestones.flatMap(m=>m.tasks).reduce((sum,task)=>sum+(task.timeEntries||[]).reduce((total,entry)=>total+(parseFloat(entry.hours)||0),0),0)+((state.projectActions||{})[project.id]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0)} saat görev/aksiyon eforu`}))},
    {id:"commissioning",label:"Devreye Alma",value:machineList.length?`${Math.round(commissioned/machineList.length*100)}%`:"-",detail:`${commissioned}/${machineList.length} makine devrede`,color:"#059669",info:"Devreye alınmış makine sayısının kapsamdaki fiziksel ve sanal toplam makine sayısına oranıdır.",items:machineList.map(machine=>({title:machine.name,meta:`${machine.type==="virtual"?"Sanal":"Fiziksel"} · ${machine.commissioned?"Devrede":"Bekliyor"}`}))},
    {id:"projects",label:"Aktif Proje",value:projects.length,detail:`${projectRows.filter(item=>item.score<60).length} proje riskli`,color:"#0F766E",info:"Seçilen kapsamdaki projeler sayılır; sağlık puanı 60 altındaki projeler riskli kabul edilir.",items:projectRows.map(item=>({title:item.project.name,meta:`Sağlık ${item.score} · ${item.project.status}`}))},
  ];
  const kpiById=Object.fromEntries(kpis.map(kpi=>[kpi.id,kpi]));
  const summaryCards=[
    {id:"health",label:"Sağlık",value:`${health}%`,detail:health>=80?"Portföy kontrol altında":health>=60?"Yakın takip gerekli":"Yönetici aksiyonu gerekli",color:healthColor},
    {id:"progress",label:"İlerleme",value:`${progress}%`,detail:`${completedTasks.length}/${tasks.length} görev tamamlandı`,color:"#4A6CF7"},
    {id:"deadlines",label:"Kritik Termin",value:criticalTasks.length,detail:`${delayedTasks.length} toplam gecikme`,color:"#E11D48"},
    {id:"tickets",label:"Ticket",value:openTickets.length,detail:`${staleTickets.length} aksiyonsuz`,color:"#EA6C00"},
    {id:"risks",label:"Risk",value:openRisks.length,detail:`${highRisks.length} yüksek/kritik`,color:"#7C3AED"},
    {id:"effort",label:"Efor",value:`${effortHours} sa`,detail:estimatedHours?`${estimatedHours} sa plan`:"Plan eforu yok",color:"#0369A1"},
  ];
  const topRiskProject=projectRows[0];
  const topDeadline=[...criticalTasks,...dueSoon][0];
  const topStaleTicket=staleTickets[0];
  const assignedByManager=(state.personalTasks||[]).filter(task=>task.createdBy===currentUser.id);
  const delayedAssignedByManager=assignedByManager.filter(task=>task.status!=="Tamamlandı"&&delayLvl(task.dueDate,task.status));
  const topDelayedAssigned=delayedAssignedByManager[0];
  const adminSummaryLines=[
    delayedAssignedByManager.length?`Atadığınız ${delayedAssignedByManager.length} görev gecikmiş; ilk odak ${state.people.find(person=>person.id===topDelayedAssigned?.assignee)?.name||"atanan kişi"} / ${topDelayedAssigned?.title||"görev"}.`:"Atadığınız görevlerde gecikmiş kayıt görünmüyor.",
    criticalTasks.length?`${criticalTasks.length} kritik termin var; ilk odak ${topDeadline?.project?.name||"ilgili proje"} / ${topDeadline?.task?.title||"kritik görev"}.`:"Kritik termin görünmüyor, termin baskısı şu an kontrol altında.",
    staleTickets.length?`${staleTickets.length} ticket 7+ gündür aksiyonsuz; en eski kayıt ${ticketNumber(topStaleTicket?.ticket||{})}.`:"Ticket aksiyonları genel olarak güncel görünüyor.",
    highRisks.length?`${highRisks.length} yüksek/kritik risk açık; risk kapatma aksiyonları takip edilmeli.`:"Yüksek/kritik risk yoğunluğu düşük.",
    topRiskProject&&topRiskProject.score<60?`${topRiskProject.project.name} sağlık puanı ${topRiskProject.score}; yönetici takibi öncelikli.`:`Portföy sağlığı ${health}% seviyesinde.`,
  ];
  const defaultCardOrder=[
    ...kpis.map(kpi=>`kpi-${kpi.id}`),
    "project-health","portfolio-distribution","ticket-statuses",
    "critical-deadlines","team-workload","risk-radar","ai-assistant","report-center",
  ];
  const savedOrder=(state.userNotes||{})[currentUser.id]?.adminDashboardOrder||[];
  const savedSizes=(state.userNotes||{})[currentUser.id]?.adminDashboardSizes||{};
  const cardOrder=[...savedOrder.filter(id=>defaultCardOrder.includes(id)),...defaultCardOrder.filter(id=>!savedOrder.includes(id))];
  const saveCardOrder=(order)=>setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...(current.userNotes||{})[currentUser.id],adminDashboardOrder:order}}}));
  const resizeCard=(id,size)=>setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...(current.userNotes||{})[currentUser.id],adminDashboardSizes:{...((current.userNotes||{})[currentUser.id]?.adminDashboardSizes||{}),[id]:size}}}}));
  const startDrag=(event,id)=>{
    setDraggedCard(id);
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("text/plain",id);
  };
  const dropCard=(event,targetId)=>{
    event.preventDefault();
    const sourceId=draggedCard||event.dataTransfer.getData("text/plain");
    if(!sourceId||sourceId===targetId)return setDraggedCard(null);
    const next=[...cardOrder];
    const sourceIndex=next.indexOf(sourceId),targetIndex=next.indexOf(targetId);
    if(sourceIndex<0||targetIndex<0)return setDraggedCard(null);
    next.splice(sourceIndex,1);
    next.splice(targetIndex,0,sourceId);
    saveCardOrder(next);
    setDraggedCard(null);
  };
  const dashboardCards={};
  kpis.forEach(kpi=>{
    dashboardCards[`kpi-${kpi.id}`]={
      size:"small",
      node:<div role="button" tabIndex={0} onKeyDown={event=>event.key==="Enter"&&setDetailModal({mode:"detail",...kpi})} onClick={()=>setDetailModal({mode:"detail",...kpi})} className="admin-kpi-card" style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:"14px 15px",boxShadow:"0 5px 16px rgba(15,23,42,.045)",borderTop:`3px solid ${kpi.color}`,textAlign:"left",cursor:"pointer",position:"relative"}}>
        <div className="admin-kpi-head" style={{display:"flex",alignItems:"center",gap:5,paddingRight:78,minWidth:0}}><div style={{fontSize:10,color:"#64748B",fontWeight:750,textTransform:"uppercase",letterSpacing:.45,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{kpi.label}</div><button className="admin-kpi-info" title="Hesaplama bilgisi" onClick={event=>{event.stopPropagation();setDetailModal({mode:"info",...kpi});}} style={{width:20,height:20,borderRadius:"50%",border:"1px solid #CBD5E1",background:"#F8FAFC",color:"#64748B",fontSize:11,fontWeight:850,cursor:"pointer",flexShrink:0}}>i</button></div>
        <div style={{fontSize:25,fontWeight:900,color:kpi.color,margin:"4px 0 2px"}}>{kpi.value}</div>
        <div style={{fontSize:10,color:"#94A3B8",lineHeight:1.35,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",overflowWrap:"anywhere"}}>{kpi.detail}</div>
      </div>,
    };
  });
  dashboardCards["project-health"]={size:"large",node:<div style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:16,boxShadow:"0 5px 16px rgba(15,23,42,.04)"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:13,paddingRight:78,minWidth:0}}><div style={{minWidth:0}}><div style={{fontWeight:850,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Proje Sağlık Haritası</div><div style={{fontSize:10,color:"#94A3B8",marginTop:2,lineHeight:1.35}}>En fazla yönetici ilgisi gerektiren projeler üstte.</div></div><button onClick={()=>onNavigate("projects")} style={{border:0,background:"#EEF2FF",color:"#4A6CF7",borderRadius:8,padding:"6px 9px",fontSize:10,fontWeight:800,cursor:"pointer",flexShrink:0}}>Tüm projeler</button></div>
    <div style={{display:"flex",flexDirection:"column",gap:9}}>{projectRows.slice(0,8).map(item=><button key={item.project.id} onClick={()=>onOpenProject(item.project.id)} style={{border:"1px solid #F1F5F9",background:"#FAFCFF",borderRadius:11,padding:"10px 11px",cursor:"pointer",textAlign:"left",overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7,minWidth:0}}><span style={{width:8,height:8,borderRadius:"50%",background:item.project.color,flexShrink:0}}/><b style={{fontSize:11,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.project.name}</b><span style={{fontSize:11,fontWeight:900,color:item.score>=80?"#059669":item.score>=60?"#EA6C00":"#E11D48",flexShrink:0}}>{item.score}</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{height:7,background:"#E2E8F0",borderRadius:10,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${item.pct}%`,background:`linear-gradient(90deg,${item.project.color},${item.project.color}BB)`,borderRadius:10}}/></div><span style={{fontSize:10,fontWeight:800,color:"#475569",width:32,flexShrink:0}}>{item.pct}%</span></div><div style={{display:"flex",gap:7,marginTop:6,fontSize:9,color:"#64748B",flexWrap:"wrap",lineHeight:1.35}}><span>{item.done}/{item.total} tamam</span><span style={{color:item.delayed?"#EA6C00":"#64748B"}}>{item.delayed} gecikme</span><span style={{color:item.critical?"#E11D48":"#64748B"}}>{item.critical} kritik</span><span>{item.risks} risk</span></div></button>)}{!projectRows.length&&<div style={{padding:30,textAlign:"center",color:"#94A3B8",fontSize:12}}>Bu kapsamda proje yok.</div>}</div>
  </div>};
  dashboardCards["portfolio-distribution"]={size:"medium",node:<div style={{height:"100%",background:"#172033",color:"#fff",borderRadius:16,padding:17,boxShadow:"0 8px 24px rgba(15,23,42,.16)",overflow:"hidden"}}><div style={{fontSize:11,fontWeight:800,color:"#A5B4FC",paddingRight:18,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>PORTFÖY DAĞILIMI</div><div style={{display:"flex",alignItems:"center",gap:17,marginTop:12,flexWrap:"wrap"}}><div style={{width:112,height:112,borderRadius:"50%",background:`conic-gradient(#10B981 0 ${progress}%,#334155 ${progress}% 100%)`,display:"grid",placeItems:"center",flexShrink:0}}><div style={{width:78,height:78,borderRadius:"50%",background:"#172033",display:"grid",placeItems:"center",textAlign:"center"}}><div><b style={{fontSize:22}}>{progress}%</b><div style={{fontSize:8,color:"#94A3B8"}}>TAMAMLANMA</div></div></div></div><div style={{flex:"1 1 135px",display:"grid",gap:8,minWidth:0}}>{[["Tamamlanan",completedTasks.length,"#10B981"],["Aktif",activeTasks.length-delayedTasks.length,"#60A5FA"],["Geciken",delayedTasks.length,"#F59E0B"],["Kritik",criticalTasks.length,"#FB7185"]].map(([label,value,color])=><div key={label} style={{display:"flex",alignItems:"center",gap:7,fontSize:10,minWidth:0}}><span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0}}/><span style={{color:"#CBD5E1",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span><b style={{flexShrink:0}}>{value}</b></div>)}</div></div></div>};
  dashboardCards["ticket-statuses"]={size:"medium",node:<div style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:12,paddingRight:18}}>Ticket Durumları</div><div style={{display:"grid",gap:8}}>{ticketStatuses.map(item=><div key={item.status}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><span>{item.status}</span><b>{item.count}</b></div><div style={{height:6,background:"#F1F5F9",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${item.count/maxTicketStatus*100}%`,background:statusColors[item.status]||"#4A6CF7",borderRadius:8}}/></div></div>)}{!ticketStatuses.length&&<div style={{fontSize:11,color:"#94A3B8"}}>Ticket bulunmuyor.</div>}</div><button onClick={()=>onNavigate("tickets")} style={{marginTop:12,border:0,background:"#FFF7ED",color:"#C2410C",borderRadius:8,padding:"7px 10px",fontSize:10,fontWeight:800,cursor:"pointer"}}>Ticket ekranını aç</button></div>};
  dashboardCards["critical-deadlines"]={size:"medium",node:<div style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:11,paddingRight:18}}>Kritik Terminler</div><div style={{display:"grid",gap:7}}>{[...criticalTasks,...dueSoon].slice(0,6).map(({task,project})=><button key={`${project.id}-${task.id}`} onClick={()=>onOpenProject(project.id)} style={{border:0,borderLeft:`3px solid ${delayLvl(task.dueDate,task.status)?"#E11D48":"#F59E0B"}`,background:"#F8FAFC",borderRadius:8,padding:"8px 9px",textAlign:"left",cursor:"pointer",overflow:"hidden"}}><div style={{fontSize:10,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.title}</div><div style={{fontSize:9,color:"#64748B",marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.name} · {fmt(task.dueDate)}{delayLvl(task.dueDate,task.status)?` · ${daysDiff(task.dueDate)} gün gecikti`:""}</div></button>)}{![...criticalTasks,...dueSoon].length&&<div style={{fontSize:11,color:"#059669",padding:12,background:"#ECFDF5",borderRadius:9}}>Yakın veya kritik termin yok.</div>}</div></div>};
  dashboardCards["team-workload"]={size:"medium",node:<div style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:11,paddingRight:18}}>Ekip İş Yükü</div><div style={{display:"grid",gap:9}}>{workload.slice(0,7).map(item=><div key={item.person.id}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,minWidth:0}}><Avatar initials={item.person.avatar} imageUrl={item.person.avatarUrl} size={22}/><span style={{fontSize:10,fontWeight:750,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.person.name}</span><span style={{fontSize:9,color:item.delayed?"#E11D48":"#64748B",whiteSpace:"nowrap",flexShrink:0}}>{item.active} aktif · {item.delayed} gecikmiş</span></div><div style={{marginLeft:29,height:6,background:"#F1F5F9",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:`${item.active/maxWorkload*100}%`,background:item.delayed?"linear-gradient(90deg,#F59E0B,#EF4444)":"linear-gradient(90deg,#4A6CF7,#7C3AED)",borderRadius:8}}/></div></div>)}{!workload.length&&<div style={{fontSize:11,color:"#94A3B8"}}>Aktif iş yükü bulunmuyor.</div>}</div></div>};
  dashboardCards["risk-radar"]={size:"medium",node:<div style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:16}}><div style={{fontWeight:850,fontSize:13,marginBottom:11,paddingRight:18}}>Risk ve Aksiyon Radarı</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:11}}>{[["Yüksek Risk",highRisks.length,"#E11D48","#FFF1F2"],["Aksiyonsuz Ticket",staleTickets.length,"#EA6C00","#FFF7ED"],["Geciken Görev",delayedTasks.length,"#7C3AED","#F5F3FF"],["Devre Dışı",machineList.length-commissioned,"#0369A1","#F0F9FF"]].map(([label,value,color,bg])=><div key={label} style={{background:bg,borderRadius:10,padding:10}}><b style={{fontSize:20,color}}>{value}</b><div style={{fontSize:9,color:"#64748B",marginTop:2}}>{label}</div></div>)}</div><div style={{fontSize:10,color:"#64748B",lineHeight:1.55}}>{highRisks.length||criticalTasks.length||staleTickets.length?"Kritik sapmalar için proje sahipleriyle aksiyon planı oluşturulmalı.":"Portföyde acil yönetici aksiyonu gerektiren belirgin bir sapma yok."}</div></div>};
  dashboardCards["ai-assistant"]={size:"medium",node:<button onClick={()=>onNavigate("ai")} style={{width:"100%",height:"100%",border:"1px solid #DDD6FE",borderRadius:16,padding:18,background:"linear-gradient(135deg,#2E1065,#6D28D9)",color:"#fff",textAlign:"left",cursor:"pointer",boxShadow:"0 10px 24px rgba(109,40,217,.2)"}}><span style={{width:36,height:36,borderRadius:11,display:"grid",placeItems:"center",background:"rgba(255,255,255,.14)",marginBottom:16}}><Icon name="activity" size={19}/></span><b style={{display:"block",fontSize:15}}>AI Portföy Asistanı</b><span style={{display:"block",fontSize:10,color:"#DDD6FE",lineHeight:1.55,marginTop:5}}>Seçili proje veya tüm portföy için risk, gecikme ve öncelikli aksiyon analizi alın.</span><span style={{display:"inline-block",marginTop:14,fontSize:10,fontWeight:850,background:"#fff",color:"#6D28D9",borderRadius:8,padding:"6px 9px"}}>Analizi aç</span></button>};
  dashboardCards["report-center"]={size:"full",node:<div style={{height:"100%",background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:16,overflow:"hidden"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12,paddingRight:18}}><div style={{minWidth:0}}><div style={{fontWeight:850,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Yönetici Rapor Merkezi</div><div style={{fontSize:10,color:"#94A3B8",marginTop:2,lineHeight:1.35}}>Toplantı, operasyon takibi ve paylaşım için hazır çıktılar.</div></div><button onClick={()=>onNavigate("reports")} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:8,padding:"7px 10px",fontSize:10,fontWeight:800,cursor:"pointer",flexShrink:0}}>Tüm raporlar</button></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>{[["Genel Durum","Portföy ilerleme, gecikme ve kapasite özeti.","#4338CA",()=>generatePortfolioReport(scopedState,state.people),"HTML / PDF"],["Termin ve Gecikme","Geciken görevler ve sorumlu dağılımı.","#E11D48",()=>downloadDelayReport(scopedState,state.people),"XLSX"],["Efor ve Kapasite","Kişi, proje ve görev bazlı saat analizi.","#7C3AED",()=>downloadEffortReport(scopedState,state.people),"XLSX"],["Ticket Durumu","Ticket yaşı, aksiyon ve Jira durumları.","#EA6C00",()=>generateTicketStatusReport(scopedState,state.people),"HTML / PDF"]].map(([title,description,color,action,label])=><button key={title} onClick={action} style={{border:"1px solid #E2E8F0",borderLeft:`4px solid ${color}`,borderRadius:11,background:"#FAFCFF",padding:12,textAlign:"left",cursor:"pointer",overflow:"hidden"}}><div style={{display:"flex",justifyContent:"space-between",gap:7,minWidth:0}}><b style={{fontSize:11,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title}</b><span style={{fontSize:8,fontWeight:850,color,background:color+"12",borderRadius:6,padding:"3px 5px",whiteSpace:"nowrap",flexShrink:0}}>{label}</span></div><div style={{fontSize:9,color:"#64748B",lineHeight:1.45,marginTop:5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{description}</div></button>)}</div></div>};

  return <div style={{padding:showHeader?"clamp(16px,3vw,28px)":0,flex:1,overflow:showHeader?"auto":"visible",background:showHeader?"linear-gradient(180deg,#F8FAFC 0%,#EEF2FF 100%)":"transparent"}}>
    <div className="admin-control-row" style={{display:"flex",justifyContent:showHeader?"space-between":"center",alignItems:"flex-end",gap:10,flexWrap:"wrap",marginBottom:18}}>
      {showHeader&&<div>
        <h2 style={{margin:0,fontSize:"clamp(21px,3vw,28px)",fontWeight:900,color:"#172033"}}>Operasyon Kontrol Merkezi</h2>
        <p style={{margin:"5px 0 0",fontSize:12,color:"#64748B"}}>Projeler, terminler, riskler, ekip yükü ve ticketlar için tek bakışta karar ekranı.</p>
      </div>}
      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap",justifyContent:"center"}}>
        <div style={{minWidth:230}}><label style={lStyle}>Proje Kapsamı</label><select style={{...iStyle,background:"#fff"}} value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="all">Tüm Portföy</option>{state.projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
        <button title="Genel rapor" onClick={()=>generatePortfolioReport(scopedState,state.people)} className="admin-report-button" style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:12,padding:"10px 12px",fontSize:11,fontWeight:900,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,height:42}}><Icon name="reports" size={15}/><span>Rapor</span></button>
      </div>
    </div>

    <div className="admin-summary-grid">
      {summaryCards.map(card=>{
        const kpi=kpiById[card.id];
        return <button key={card.id} onClick={()=>kpi&&setDetailModal({mode:"detail",...kpi})} className="admin-summary-card" style={{borderTopColor:card.color}}>
          <div style={{fontSize:10,fontWeight:850,color:"#64748B",letterSpacing:.4,textTransform:"uppercase",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.label}</div>
          <div style={{fontSize:27,fontWeight:950,color:card.color,lineHeight:1.05,marginTop:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{card.value}</div>
          <div style={{fontSize:10,color:"#94A3B8",lineHeight:1.35,marginTop:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{card.detail}</div>
        </button>;
      })}
    </div>

    <div className="admin-ai-summary">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:0,flex:1}}>
          <div style={{width:38,height:38,borderRadius:13,display:"grid",placeItems:"center",background:"linear-gradient(135deg,#4A6CF7,#7C3AED)",color:"#fff",boxShadow:"0 10px 22px rgba(74,108,247,.22)",flexShrink:0}}><Icon name="activity" size={18}/></div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:14,fontWeight:900,color:"#172033"}}>AI Yönetici Özeti</div>
            <div style={{fontSize:11,color:"#64748B",lineHeight:1.45,marginTop:3}}>Genel durum için hızlı okuma. Detaylı analiz için AI çalışma alanına geçebilirsiniz.</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
          <button onClick={()=>setAiSummaryRefresh(value=>value+1)} style={{border:0,background:"#ECFDF5",color:"#047857",borderRadius:10,padding:"8px 10px",fontSize:10,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}}>Yenile</button>
          <button onClick={()=>onNavigate("ai")} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:10,padding:"8px 11px",fontSize:10,fontWeight:850,cursor:"pointer",whiteSpace:"nowrap"}}>AI'da Detaylandır</button>
        </div>
      </div>
      <div style={{fontSize:9,color:"#94A3B8",marginTop:8}}>Son güncelleme: {new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})}{aiSummaryRefresh?` · ${aiSummaryRefresh}. manuel yenileme`:""}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:8,marginTop:13}}>
        {adminSummaryLines.map((line,index)=><div key={index} style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:12,padding:"10px 11px",fontSize:11,color:"#475569",lineHeight:1.45,overflowWrap:"anywhere"}}>{line}</div>)}
      </div>
    </div>

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,margin:"16px 0 10px",flexWrap:"wrap"}}>
      <div>
        <div style={{fontSize:14,fontWeight:900,color:"#172033"}}>Detay Kartları</div>
        <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>Kartları sürükleyip kendi takip düzeninizi oluşturabilirsiniz.</div>
      </div>
    </div>

    <div className="admin-board-grid">
      {cardOrder.map(id=>dashboardCards[id]&&<AdminBoardCard key={id} id={id} size={savedSizes[id]||dashboardCards[id].size} draggedId={draggedCard} onDragStart={startDrag} onDragEnd={()=>setDraggedCard(null)} onDrop={dropCard} onResize={resizeCard}>{dashboardCards[id].node}</AdminBoardCard>)}
    </div>
    {detailModal&&<Modal title={detailModal.mode==="info"?`${detailModal.label} · Hesaplama`:`${detailModal.label} · Detay`} onClose={()=>setDetailModal(null)} wide>{detailModal.mode==="info"?<div style={{fontSize:13,color:"#475569",lineHeight:1.7,background:"#F8FAFC",borderRadius:11,padding:15}}>{detailModal.info}</div>:<div style={{display:"grid",gap:8,maxHeight:"60vh",overflow:"auto"}}>{(detailModal.items||[]).map((item,index)=><div key={`${item.title}-${index}`} style={{border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:12,fontWeight:800}}>{item.title}</div><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{item.meta}</div></div>)}{!detailModal.items?.length&&<div style={{padding:30,textAlign:"center",color:"#94A3B8"}}>Bu kapsamda detay kaydı bulunmuyor.</div>}</div>}</Modal>}
  </div>;
}

function DeadlinePage({warnings,people,onOpenTask,onOpenTodos}) {
  const [filter,setFilter]=useState("all");
  const shown=filter==="all"?warnings:warnings.filter(w=>w.level===filter);
  return <div style={{padding:"clamp(18px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:18}}><div><h2 style={{margin:0,fontSize:20,display:"flex",alignItems:"center",gap:8}}><Icon name="clock" size={21}/>Termin Uyarıları</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>{warnings.length} geciken görev</p></div><div style={{display:"flex",gap:5}}>{[["all","Tümü"],["critical","Kritik"],["normal","Geciken"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontSize:11,fontWeight:700,background:filter===id?"#4A6CF7":"#F1F5FF",color:filter===id?"#fff":"#64748B"}}>{label}</button>)}</div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{shown.map(t=>{const person=people.find(p=>p.id===t.assignee);return <button key={`${t.projectId||"todo"}-${t.id}`} onClick={()=>t.kind==="todo"?onOpenTodos():onOpenTask(t.id)} style={{border:`1.5px solid ${t.level==="critical"?"#FCA5A5":"#FED7AA"}`,borderRadius:12,background:"#fff",padding:13,display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left"}}><div style={{width:42,height:42,borderRadius:11,background:t.level==="critical"?"#FFF1F2":"#FFF7ED",display:"grid",placeItems:"center",color:t.level==="critical"?"#E11D48":"#EA6C00",fontWeight:850,fontSize:12}}>{t.days}g</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800}}>{t.title}</div><div style={{fontSize:11,color:"#64748B",marginTop:3}}><span style={{color:t.kind==="todo"?"#DB2777":t.projectColor,fontWeight:800}}>{t.kind==="todo"?"TO-DO":t.projectName}</span>{person?` · ${person.name}`:""} · Termin {fmt(t.dueDate)}</div></div>{t.kind==="todo"?<span style={{background:"#FDF2F8",color:"#DB2777",borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:800}}>TO-DO</span>:<Badge label={t.status}/>}</button>})}{!shown.length&&<div style={{padding:40,textAlign:"center",color:"#94A3B8",border:"1.5px dashed #CBD5E1",borderRadius:13}}>Bu filtrede termin uyarısı yok.</div>}</div>
  </div>;
}

// ─── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ people, onLogin }) {
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
        <div className="login-version" style={{ textAlign:"center", marginTop:"clamp(8px,2vh,18px)", fontSize:10, color:"#475569" }}>CORJECT {APP_VERSION} · Proje Yönetimi</div>
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

function AuthLoginScreen() {
  const [email,setEmail]=useState("");
  const [showEmail,setShowEmail]=useState(false);
  const [status,setStatus]=useState({loading:false,message:"",error:false});
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
  const submit=async()=>{
    const value=email.trim().toLowerCase();
    if(!value)return;
    setStatus({loading:true,message:"",error:false});
    const {error}=await supabase.auth.signInWithOtp({
      email:value,
      options:{
        emailRedirectTo:`${window.location.origin}/`,
        shouldCreateUser:true,
      },
    });
    setStatus(error
      ?{loading:false,message:error.message,error:true}
      :{loading:false,message:"Giriş bağlantısı e-posta adresinize gönderildi.",error:false});
  };
  return <div className="login-screen" style={{position:"fixed",inset:0,background:"linear-gradient(145deg,#0F172A,#1E293B 55%,#0F172A)",display:"grid",placeItems:"center",padding:20,fontFamily:"Inter,Segoe UI,sans-serif"}}>
    <div style={{width:"100%",maxWidth:430,textAlign:"center"}}>
      <img src={corjectLogo} alt="Corject" style={{width:74,height:74,objectFit:"contain",filter:"drop-shadow(0 10px 22px rgba(74,108,247,.35))"}}/>
      <h1 style={{color:"#fff",fontSize:22,letterSpacing:3,margin:"8px 0 4px"}}>CORJECT</h1>
      <p style={{color:"#64748B",fontSize:12,margin:"0 0 22px"}}>Güvenli ekip girişi</p>
      <div style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:18,padding:24,textAlign:"left"}}>
        <button disabled={status.loading} onClick={slackLogin} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:12,padding:"13px 16px",background:"#fff",color:"#1E293B",fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:11,boxShadow:"0 5px 18px rgba(0,0,0,.16)"}}>
          <SlackLogo size={23}/>
          Slack ile Giriş Yap
        </button>
        <button onClick={()=>{setShowEmail(value=>!value);setStatus({loading:false,message:"",error:false});}} style={{width:"100%",border:0,background:"transparent",color:"#94A3B8",fontSize:11,fontWeight:700,cursor:"pointer",padding:"14px 4px 2px",textDecoration:"underline"}}>
          {showEmail?"E-posta girişini kapat":"E-posta ile giriş"}
        </button>
        <div style={{display:showEmail?"flex":"none",alignItems:"center",gap:10,margin:"14px 0",color:"#64748B",fontSize:10}}>
          <span style={{height:1,background:"rgba(255,255,255,.12)",flex:1}}/>
          veya e-posta bağlantısı
          <span style={{height:1,background:"rgba(255,255,255,.12)",flex:1}}/>
        </div>
        <label style={{display:showEmail?"block":"none",fontSize:12,fontWeight:700,color:"#CBD5E1",marginBottom:6}}>Kurumsal e-posta adresiniz</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="ad@firma.com" style={{...iStyle,padding:12,background:"#fff",marginBottom:10,display:showEmail?"block":"none"}}/>
        <button disabled={status.loading} onClick={submit} style={{width:"100%",border:0,borderRadius:10,padding:12,background:"#4A6CF7",color:"#fff",fontWeight:800,cursor:"pointer",display:showEmail?"block":"none"}}>{status.loading?"Gönderiliyor...":"Giriş Bağlantısı Gönder"}</button>
        {status.message&&<div style={{fontSize:11,lineHeight:1.5,marginTop:11,color:status.error?"#FCA5A5":"#A7F3D0"}}>{status.message}</div>}
      </div>
      <div style={{fontSize:10,color:"#475569",marginTop:14}}>CORJECT {APP_VERSION}</div>
    </div>
  </div>;
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
                      top:4, height:rowH-8, background:bc, borderRadius:4, zIndex:2, overflow:"hidden",
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      <span title={`${fmt(m.actualStart)} → ${fmt(m.actualEnd||e)}`} style={{ display:"block",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap",textShadow:"0 1px 2px rgba(0,0,0,.45)" }}>
                        {m.status === "Tamamland\u0131" ? "✓ " : ""}{fmt(e)}
                      </span>
                    </div>
                  )}
                  {/* If no actual, show solid planned bar with label */}
                  {!m.actualStart && (
                    <div style={{
                      position:"absolute", left:`${pct(s)}%`, width:`${wPct(s,e)}%`,
                      top:4, height:rowH-8, background:bc, borderRadius:4, zIndex:2, overflow:"hidden",
                      display:"flex", alignItems:"center", justifyContent:"center"
                    }}>
                      <span title={`${fmt(s)} → ${fmt(e)}`} style={{ display:"block",maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",fontSize:9, color:"#fff", fontWeight:700, padding:"0 4px", whiteSpace:"nowrap",textShadow:"0 1px 2px rgba(0,0,0,.45)" }}>
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
  (state.fieldPlans||[]).filter(plan=>plan.status==="completed"||plan.completedAt).forEach(plan=>{
    const project=state.projects.find(item=>item.id===plan.projectId);
    const person=people.find(item=>item.id===plan.userId);
    const workLabel=plan.workType==="remote"?"Uzaktan Çalışma":"Saha Ziyareti";
    rows.push([project?.name||"Silinmiş proje",workLabel,`${workLabel} · ${plan.date}`,person?.name||"Atanmamış","",fieldPlanHours(plan),"",plan.date||"",person?.name||"",plan.visitNotes||""]);
  });
  Object.entries(state.projectActions||{}).forEach(([projectId,actions])=>{
    const project=state.projects.find(item=>item.id===projectId);
    (actions||[]).filter(action=>Number(action.effortHours)>0).forEach(action=>{
      rows.push([project?.name||"Silinmiş proje","Proje Aksiyonu",action.text||"Aksiyon",action.authorName||"","",Number(action.effortHours),"",action.actionAt||action.createdAt||"",action.authorName||"",action.text||""]);
    });
  });
  downloadXlsx(rows,`efor-raporu-${todayStr()}.xlsx`,"Efor");
}

function downloadMachineReport(state){
  const rows=[["Proje","Sektör","Üretim Merkezi","İşyeri","Hat","Makine Kodu","Makine Adı","Tip","Devreye Alındı","Devreye Alma Tarihi","Açıklama"]];
  state.projects.forEach(project=>{
    (project.machines||[]).forEach(machine=>rows.push([project.name,"","","","",machine.code||"",machine.name,machine.type==="virtual"?"Sanal":"Fiziksel",machine.commissioned?"Evet":"Hayır",machine.commissionedAt||"",machine.note||""]));
    commissioningRows(project.commissioningTree||[]).forEach(row=>rows.push([project.name,row.sector,row.productionCenter,row.workplace,row.line,row.machine.code||"",row.machine.name,row.machine.type==="virtual"?"Sanal":"Fiziksel",row.machine.commissioned?"Evet":"Hayır",row.machine.commissionedAt||"",row.machine.note||""]));
  });
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

function generateVisualReport(project,people,{customer=false,fieldHours=0}={}){
  const tasks=project.milestones.flatMap(ms=>ms.tasks.map(task=>({...task,milestone:ms.name})));
  const count=(status)=>tasks.filter(t=>t.status===status).length;
  const done=count("Tamamlandı"), active=count("Devam Ediyor"), waiting=count("Bekliyor");
  const delayed=tasks.filter(t=>delayLvl(t.dueDate,t.status));
  const machines=project.machines||[];
  const commissioned=machines.filter(m=>m.commissioned).length;
  const hours=tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0)+fieldHours;
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
    const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0);
    const actionHours=((state.projectActions||{})[project.id]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
    return {project,tasks,done,progress:tasks.length?Math.round(done/tasks.length*100):0,delayed:tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,hours:tasks.reduce((sum,t)=>sum+(t.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0)+fieldHours+actionHours,machines:project.machines||[]};
  });
  const totalTasks=data.reduce((a,r)=>a+r.tasks.length,0), totalDone=data.reduce((a,r)=>a+r.done,0), totalDelayed=data.reduce((a,r)=>a+r.delayed,0), totalHours=data.reduce((a,r)=>a+r.hours,0);
  const tableRows=data.map(r=>`<tr><td><b>${r.project.name}</b></td><td>${projectPmIds(r.project).map(id=>people.find(p=>p.id===id)?.name).filter(Boolean).join(", ")||"Atanmamış"}</td><td>${r.project.status}</td><td><span class="track"><i style="width:${r.progress}%;background:${r.project.color}"></i></span><b>${r.progress}%</b></td><td>${r.done}/${r.tasks.length}</td><td class="${r.delayed?"danger":""}">${r.delayed}</td><td>${r.machines.filter(m=>m.commissioned).length}/${r.machines.length}</td><td>${r.hours} sa</td></tr>`).join("");
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
  const pmNames=projectPmIds(project).map(id=>people.find(p=>p.id===id)?.name).filter(Boolean).join(", ");
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
<div class="meta">Rapor tarihi: ${new Date().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})} &nbsp;|&nbsp; PM: ${pmNames||"Atanmamış"} &nbsp;|&nbsp; ${fmt(project.startDate)} - ${fmt(project.endDate)}</div>

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
      <Avatar initials={person.avatar} imageUrl={person.avatarUrl} size={44} color={person.isAdmin?"#E11D48":"#4A6CF7"} />
      <div><div style={{ fontWeight:800, fontSize:15 }}>{person.name}</div><div style={{ color:"#64748B", fontSize:12 }}>{person.role}</div>{person.email&&<div style={{color:"#4A6CF7",fontSize:11,marginTop:2}}>{person.email}</div>}</div>
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
function MyTasksPage({ currentUser, state, setState, addLog, isAdmin, initialTaskId="", onTaskOpened }) {
  const [showDone,setShowDone]=useState(false);
  const [section,setSection]=useState("all");
  const [modal,setModal]=useState(null);
  const [assignmentNotice,setAssignmentNotice]=useState("");
  const [noteText,setNoteText]=useState((state.userNotes||{})[currentUser.id]?.notes||"");
  const todos=((state.userNotes||{})[currentUser.id]?.todos)||[];

  const updateNotes=(v)=>{ setNoteText(v); setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],notes:v}}})); };
  const toggleTodo=(id)=>setState(s=>({...s,userNotes:{...(s.userNotes||{}),[currentUser.id]:{...(s.userNotes||{})[currentUser.id],todos:todos.map(t=>t.id===id?{...t,done:!t.done}:t)}}}));

  const pt=state.personalTasks||[];
  const myP=pt.filter(t=>t.assignee===currentUser.id).map(t=>({...t,projectName:state.projects.find(project=>project.id===t.projectId)?.name||"Genel Görev",projectColor:state.projects.find(project=>project.id===t.projectId)?.color}));
  const myProjT=state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===currentUser.id).map(t=>({...t,projectName:proj.name,projectColor:proj.color,msName:ms.name,projId:proj.id,msId:ms.id}))));
  const allMy=[...myP.map(t=>({...t,source:"personal"})),...myProjT.map(t=>({...t,source:"project"}))];
  const active=allMy.filter(t=>t.status!=="Tamamland\u0131");
  const completed=allMy.filter(t=>t.status==="Tamamland\u0131");
  const overdue=active.filter(t=>delayLvl(t.dueDate,t.status));
  const sectionAll=section==="all"?allMy:section==="project"?myProjT.map(t=>({...t,source:"project"})):myP.map(t=>({...t,source:"personal"}));
  const sectionActive=sectionAll.filter(t=>t.status!=="Tamamland\u0131");
  const sectionCompleted=sectionAll.filter(t=>t.status==="Tamamland\u0131");
  const linkedTaskId=initialTaskId||new URLSearchParams(window.location.search).get("task");

  const updatePersonal=(id,data)=>setState(s=>{
    const old=(s.personalTasks||[]).find(t=>t.id===id);
    const notices=[];
    const patch={...data};
    if(data.status&&old?.status!==data.status){
      if(old?.assignee===currentUser.id&&!old.firstSeenAt&&!patch.firstSeenAt)patch.firstSeenAt=now();
      patch.statusUpdatedAt=now();
      patch.statusUpdatedBy=currentUser.id;
      addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} \u2192 ${data.status}`);
      if(data.status==="Tamamland\u0131"){
        [old.assignee,old.createdBy].filter(Boolean).filter((userId,index,array)=>array.indexOf(userId)===index&&userId!==currentUser.id).forEach(userId=>notices.push({id:uid(),ts:now(),userId,msg:`"${old.title}" g\u00f6revi tamamland\u0131.`,projectName:"Y\u00f6netici Atamas\u0131",taskId:old.id,type:"task_done",read:false}));
      }
    }
    if(data.comments&&data.comments.length>(old?.comments||[]).length&&old?.assignee&&old.assignee!==currentUser.id){
      notices.push({id:uid(),ts:now(),userId:old.assignee,msg:`"${old.title}" g\u00f6revine yeni not eklendi.`,projectName:"Y\u00f6netici Atamas\u0131",taskId:old.id,type:"task_comment",read:false});
    }
    return {...s,personalTasks:(s.personalTasks||[]).map(t=>t.id===id?{...t,...patch}:t),notifications:[...notices,...(s.notifications||[])]};
  });
  const updateProjTask=(pId,mId,tId,data)=>setState(s=>{const old=s.projects.find(p=>p.id===pId)?.milestones.find(m=>m.id===mId)?.tasks.find(t=>t.id===tId);const upd={...s,projects:s.projects.map(p=>p.id!==pId?p:{...p,milestones:p.milestones.map(m=>m.id!==mId?m:{...m,tasks:m.tasks.map(t=>t.id!==tId?t:{...t,...data})})})};if(data.status&&old?.status!==data.status)addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} → ${data.status}`);return upd;});
  const openTaskDetail=t=>{
    if(t.source==="personal"&&t.assignee===currentUser.id&&!t.firstSeenAt)updatePersonal(t.id,{firstSeenAt:now()});
    setModal({type:"taskDetail",data:t});
  };
  useEffect(()=>{
    if(!linkedTaskId)return;
    const personal=(state.personalTasks||[]).find(t=>t.id===linkedTaskId);
    if(personal){openTaskDetail({...personal,source:"personal"});onTaskOpened?.();return;}
    for(const project of state.projects){
      for(const milestone of project.milestones){
        const task=milestone.tasks.find(t=>t.id===linkedTaskId);
        if(task){openTaskDetail({...task,source:"project",projId:project.id,msId:milestone.id});onTaskOpened?.();return;}
      }
    }
  },[linkedTaskId,state.personalTasks,state.projects,onTaskOpened]);
  const addPersonal=async(data)=>{
    setAssignmentNotice("");
    if(isAdmin){
      const {assigneeIds=[],supportAssigneeIds=[],recurrence,...task}=data;
      const groupId=uid();
      const primaryResult=assigneeIds.length?await assignTasksWithNotification({task:{...task,assignmentRole:"Ana Sorumlu"},assigneeIds,recurrence,assignerId:currentUser.id,groupId}):{tasks:[],notifications:[]};
      const supportOnly=supportAssigneeIds.filter(id=>!assigneeIds.includes(id));
      const supportResult=supportOnly.length?await assignTasksWithNotification({task:{...task,assignmentRole:"Destek Sorumlusu"},assigneeIds:supportOnly,recurrence:null,assignerId:currentUser.id,groupId}):{tasks:[],notifications:[]};
      const result={tasks:[...primaryResult.tasks,...supportResult.tasks],notifications:[...primaryResult.notifications,...supportResult.notifications],recurringTemplate:primaryResult.recurringTemplate};
      setState(s=>{const localNotices=result.tasks.map(task=>({id:uid(),ts:now(),userId:task.assignee,msg:`"${task.title}" görevi size atandı.`,projectName:"Yönetici Ataması",taskId:task.id,type:"task_assignment",read:false}));return {...s,personalTasks:[...(s.personalTasks||[]),...result.tasks.filter(t=>!(s.personalTasks||[]).some(x=>x.id===t.id))],recurringTasks:result.recurringTemplate?[...(s.recurringTasks||[]).filter(x=>x.id!==result.recurringTemplate.id),result.recurringTemplate]:(s.recurringTasks||[]),notifications:[...localNotices,...(s.notifications||[])]};});
      const whatsapp=result.notifications.filter(n=>n.sent&&n.channel==="whatsapp").length;
      const email=result.notifications.filter(n=>n.sent&&n.channel==="email").length;
      const failed=result.notifications.filter(n=>!n.sent).length;
      setAssignmentNotice(`${result.tasks.length} görev oluşturuldu · WhatsApp: ${whatsapp} · E-posta: ${email}${failed?` · Ulaşmayan: ${failed}`:""}`);
      addLog(currentUser.name,"task_add",`${task.title} (${result.tasks.length} kişi)`);
    return result;
      return;
    }
    const t={id:uid(),...data,assignee:currentUser.id,createdBy:currentUser.id,createdByName:currentUser.name,createdAt:new Date().toISOString(),comments:[]};
    setState(s=>({...s,personalTasks:[...(s.personalTasks||[]),t]}));
    addLog(currentUser.name,"task_add",t.title);
  };
  const deletePersonal=(id)=>{const t=(state.personalTasks||[]).find(x=>x.id===id);setState(s=>({...s,personalTasks:(s.personalTasks||[]).filter(x=>x.id!==id)}));addLog(currentUser.name,"task_delete",t?.title||"");};

  return <div style={{ padding:"0 0 24px", flex:1, overflow:"auto", display:"flex", flexDirection:"column" }}>
    <div style={{ padding:"20px clamp(14px, 4vw, 28px) 0" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="tasks" size={20}/>Görevlerim</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{active.length} aktif · {completed.length} tamamlandı</p></div>
        <Btn onClick={()=>setModal({type:"addPersonal"})}>+ Görev Ekle</Btn>
      </div>
      {assignmentNotice&&<div style={{margin:"10px 0",padding:"10px 13px",borderRadius:9,background:"#ECFDF5",color:"#047857",fontSize:12,fontWeight:700}}>{assignmentNotice}</div>}
      {overdue.length>0&&<div style={{ background:"#FFF1F2", border:"1.5px solid #FCA5A5", borderRadius:12, padding:"12px 16px", margin:"12px 0" }}>
        <div style={{ fontWeight:700, fontSize:12, color:"#E11D48", marginBottom:6 }}>Gecikmiş: {overdue.length}</div>
        {overdue.map(t=><div key={t.id} style={{ fontSize:12, color:"#1E293B", display:"flex", gap:8, marginBottom:3 }}><DelayBadge dateStr={t.dueDate} status={t.status} /><span>{t.title}</span><span style={{ color:"#94A3B8" }}>— {fmt(t.dueDate)}</span></div>)}
      </div>}
      <div style={{display:"flex",gap:6,overflowX:"auto",margin:"14px 0 4px"}}>
        {[["all","tasks","Tümü"],["assigned","tasks","Yöneticinin Atadıkları"],["project","projects","Projeden Gelenler"],["todos","ticket","Kendi To-Do'larım"],["notes","notes","Notlarım"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:"none",borderRadius:9,padding:"8px 13px",background:section===id?"#4A6CF7":"#F1F5FF",color:section===id?"#fff":"#64748B",fontWeight:700,fontSize:12,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",cursor:"pointer"}}><Icon name={icon} size={14}/>{label}</button>)}
      </div>
    </div>

    <div style={{ flex:1, overflow:"auto" }}>
      {/* Tasks column */}
      {(section==="all"||section==="assigned"||section==="project")&&<div style={{ padding:"12px clamp(14px, 4vw, 28px)",maxWidth:1100,width:"100%" }}>
        {sectionActive.length>0&&<div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{section==="all"?"Tüm Görevler":section==="project"?"Proje Görevleri":"Atanan Görevler"} ({sectionActive.length})</div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {sectionActive.map(t=><SharedTaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel Görev"} canEdit formatDate={fmt} formatFullDate={fmtFull}
               onOpen={()=>openTaskDetail(t)}
               onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
               onStatusChange={(status)=>{ if(t.source==="personal")updatePersonal(t.id,{status}); else updateProjTask(t.projId,t.msId,t.id,{status}); }}
               onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
              onTime={()=>setModal({type:"time",data:t})}
            />)}
          </div>
        </div>}
        {sectionCompleted.length>0&&<div>
          <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8, padding:0, display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({sectionCompleted.length})</button>
          {showDone&&<div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {sectionCompleted.map(t=><SharedTaskCard key={t.id} task={t} people={state.people} projectColor={t.projectColor} showProject projectName={t.projectName||"Genel"} canEdit formatDate={fmt} formatFullDate={fmtFull}
               onOpen={()=>openTaskDetail(t)}
               onCheck={(c)=>{ if(t.source==="personal")updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); else updateProjTask(t.projId,t.msId,t.id,{status:c?"Tamamland\u0131":"Bekliyor"}); }}
               onStatusChange={(status)=>{ if(t.source==="personal")updatePersonal(t.id,{status}); else updateProjTask(t.projId,t.msId,t.id,{status}); }}
               onEdit={t.source==="personal"?()=>setModal({type:"editPersonal",data:t}):null}
              onDelete={t.source==="personal"?()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}:null}
              onTime={()=>setModal({type:"time",data:t})}
            />)}
          </div>}
        </div>}
        {section==="assigned"&&isAdmin&&<div style={{ marginTop:24, borderTop:"1.5px solid #E2E8F0", paddingTop:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Tüm Genel Görevler (Yönetici)</div>
          {(state.personalTasks||[]).length===0&&<div style={{ color:"#94A3B8", fontSize:12 }}>Genel görev yok.</div>}
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {(state.personalTasks||[]).map(t=><SharedTaskCard key={t.id} task={t} people={state.people} projectColor={null} showProject canEdit formatDate={fmt} formatFullDate={fmtFull}
               onOpen={()=>openTaskDetail({...t,source:"personal"})}
               onCheck={(c)=>updatePersonal(t.id,{status:c?"Tamamland\u0131":"Bekliyor"})}
               onStatusChange={(status)=>updatePersonal(t.id,{status})}
               onEdit={()=>setModal({type:"editPersonal",data:t})}
              onDelete={()=>{if(confirm("Silinsin mi?"))deletePersonal(t.id);}}
              onTime={()=>setModal({type:"time",data:{...t,source:"personal"}})}
            />)}
          </div>
        </div>}
      </div>}

      {/* Notes & Todo sidebar */}
      {section==="notes"&&<div style={{padding:"16px clamp(14px, 4vw, 28px)"}}><div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:16}}><div style={{fontWeight:800,fontSize:14,marginBottom:9}}>Notlarım</div><textarea value={noteText} onChange={e=>updateNotes(e.target.value)} placeholder="Serbest notlar, hatırlatmalar..." style={{width:"100%",minHeight:260,padding:12,borderRadius:9,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",lineHeight:1.6}}/></div></div>}
      {section==="todos"&&<div style={{padding:"16px clamp(14px, 4vw, 28px)",maxWidth:1000}}><div style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:16}}><div style={{fontWeight:800,fontSize:14,marginBottom:12}}>Kendi To-Do'larım</div>{todos.filter(t=>!t.done).map(t=>{const p=state.projects.find(x=>x.id===t.projectId);const late=t.dueDate&&daysDiff(t.dueDate)>0;return <div key={t.id} style={{display:"flex",alignItems:"center",gap:9,padding:"10px 0",borderBottom:"1px solid #F1F5F9"}}><input type="checkbox" checked={false} onChange={()=>toggleTodo(t.id)}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{t.action||t.text}</div><div style={{fontSize:10,color:late?"#E11D48":"#94A3B8",marginTop:2}}>{t.customer||p?.name||"Genel"}{t.dueDate?` · ${fmt(t.dueDate)}`:""}</div></div></div>})}{!todos.filter(t=>!t.done).length&&<div style={{fontSize:12,color:"#94A3B8"}}>Açık To-Do yok.</div>}</div></div>}
    </div>

    {modal?.type==="addPersonal"&&<SharedPersonalTaskModal title="Genel Görev Ekle" people={state.people} projects={state.projects} isAdmin={isAdmin} currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={addPersonal} />}
    {modal?.type==="editPersonal"&&<SharedPersonalTaskModal title="Görevi Düzenle" initial={modal.data} people={state.people} projects={state.projects} isAdmin={isAdmin} currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={(d)=>{updatePersonal(modal.data.id,d);setModal(null);}} />}
    {modal?.type==="time"&&<SharedTimeLogModal task={modal.data} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onSave={(entries)=>{const t=modal.data;if(t.source==="personal")updatePersonal(t.id,{timeEntries:entries});else updateProjTask(t.projId,t.msId,t.id,{timeEntries:entries});}} />}
    {modal?.type==="taskDetail"&&<SharedTaskDetailModal task={modal.data.source==="personal"?(state.personalTasks||[]).find(t=>t.id===modal.data.id)||modal.data:state.projects.find(p=>p.id===modal.data.projId)?.milestones.find(m=>m.id===modal.data.msId)?.tasks.find(t=>t.id===modal.data.id)||modal.data} people={state.people} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onUpdate={(data)=>{const t=modal.data;if(t.source==="personal")updatePersonal(t.id,data);else updateProjTask(t.projId,t.msId,t.id,data);}} />}
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
function AIWorkspace({projects=[],initialProjectId="",embedded=false}) {
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
  return <div style={{padding:embedded?0:"clamp(18px,4vw,30px)",flex:1,overflow:"auto",background:embedded?"transparent":"linear-gradient(180deg,#F8FAFC,#F5F3FF)"}}><div style={{maxWidth:900,margin:embedded?0:"0 auto"}}>
    {!embedded&&<div style={{marginBottom:17}}><div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EDE9FE",color:"#6D28D9",borderRadius:20,padding:"5px 10px",fontSize:10,fontWeight:850}}><Icon name="activity" size={13}/>CORJECT AI</div><h2 style={{margin:"8px 0 4px",fontSize:23}}>Proje ve Portföy Asistanı</h2><p style={{margin:0,fontSize:12,color:"#64748B"}}>Görev, termin, risk, checklist ve ticket özetlerinden yönetilebilir öneriler üretir.</p></div>}
    <div style={{background:"#fff",border:"1px solid #DDD6FE",borderRadius:16,padding:"clamp(14px,3vw,20px)",boxShadow:"0 10px 30px rgba(76,29,149,.07)"}}>
      <div style={{background:"#F5F3FF",borderRadius:10,padding:"9px 12px",fontSize:10,color:"#5B21B6",marginBottom:13}}>Uzaktan erişim parolaları ve doküman içerikleri AI analizine gönderilmez. Sonuçlar karar desteğidir; kaynak kayıtlarla doğrulanmalıdır.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}><Field label="Analiz Kapsamı"><select style={iStyle} value={scope} onChange={event=>setScope(event.target.value)}><option value="portfolio">Tüm erişilebilir projeler</option><option value="project">Tek proje</option></select></Field><Field label="Proje"><select disabled={scope!=="project"} style={{...iStyle,opacity:scope==="project"?1:.55}} value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="">Proje seçin</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></Field></div>
      <Field label="Sorunuz"><textarea style={{...iStyle,minHeight:105,resize:"vertical",lineHeight:1.55}} value={question} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==="Enter")ask();}}/></Field>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:9,color:"#94A3B8"}}>Ctrl + Enter ile analiz edebilirsiniz.</span><Btn disabled={loading||!question.trim()||(scope==="project"&&!projectId)} onClick={ask}>{loading?"Analiz ediliyor...":"Yorumla"}</Btn></div>
      {error&&<div style={{marginTop:12,padding:12,borderRadius:10,background:"#FFF1F2",color:"#BE123C",fontSize:11}}>{error}</div>}
      {answer&&<div style={{marginTop:14,padding:16,borderRadius:13,background:"#FAFAFF",border:"1px solid #E2E8F0",whiteSpace:"pre-wrap",fontSize:12,lineHeight:1.75}}>{answer}</div>}
    </div>
  </div></div>;
}

const importSheetRows=(workbook,name)=>workbook.Sheets[name]?XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:""}):[];
const importText=(value)=>String(value??"").trim();
const importBool=(value)=>["evet","true","1","yes"].includes(importText(value).toLocaleLowerCase("tr-TR"));

function ImportCenter({state,setState,currentUser}) {
  const [preview,setPreview]=useState(null);
  const [fileName,setFileName]=useState("");
  const [message,setMessage]=useState("");
  const [importType,setImportType]=useState("all");
  const importModules=[
    ["all","Tüm Veriler","Tüm modülleri tek çalışma kitabında taşıyın."],
    ["projects","Projeler","Proje temel bilgileri ve tarihleri."],
    ["people","Kişiler","Ekip üyeleri ve iletişim bilgileri."],
    ["tasks","Görevler","Milestone, görev, sorumlu ve efor."],
    ["tickets","Ticketlar","Ticket içeriği, durum ve atamalar."],
    ["machines","Makineler","Fiziksel/sanal makine envanteri."],
    ["actions","Aksiyonlar","Proje aksiyonları, etiket ve efor."],
    ["risks","Riskler","Proje riskleri ve takip durumları."],
    ["contacts","RACI ve Kontaklar","İç/dış paydaş ve RACI bilgileri."],
    ["documents","Dokümanlar","OneDrive bağlantısı ve doküman metadatası."],
    ["plans","Çalışma Planları","Saha ve uzaktan haftalık planlar."],
    ["todos","Kişisel To-Do","Kullanıcıya özel müşteri aksiyonları."],
    ["personalTasks","Yönetici Görevleri","Kişilere atanan bağımsız görevler."],
  ];
  const sheetDefinitions={
    projects:["Projeler",[["Proje Kodu","Proje Adı","Açıklama","Durum","Başlangıç","Bitiş","Renk"],["PRJ-001","Örnek MES Projesi","Kapsam açıklaması","Devam Ediyor","2026-07-01","2026-12-31","#4A6CF7"]]],
    people:["Kişiler",[["E-posta","Ad Soyad","Telefon","Rol"],["kullanici@sirket.com","Örnek Kullanıcı","+90 5xx","Proje Yöneticisi"]]],
    tasks:["Görevler",[["Proje Kodu","Milestone","Görev","Başlangıç","Termin","Durum","Öncelik","Sorumlu E-posta","Sorumluluk Grubu","Planlanan Efor"],["PRJ-001","Analiz","Süreç analizi","2026-07-01","2026-07-10","Başlamadı","Yüksek","kullanici@sirket.com","Proje Ekibi",8]]],
    tickets:["Ticketlar",[["Proje Kodu","Başlık","Açıklama","Kategori","Öncelik","Durum","Atanan E-posta","Açılış Tarihi"],["PRJ-001","Örnek ticket","Detay","Bug","Orta","Açık","kullanici@sirket.com","2026-07-02"]]],
    machines:["Makineler",[["Proje Kodu","Makine Kodu","Makine Adı","Tip","Devreye Alındı","Devreye Alma Tarihi","Açıklama"],["PRJ-001","MC-01","Paketleme Makinesi","Fiziksel","Hayır","","Bağlantı bekleniyor"]]],
    actions:["Aksiyonlar",[["Proje Kodu","Tarih","Etiket","Aksiyon","Efor","Yapan E-posta"],["PRJ-001","2026-07-03 10:00","Toplantı","Kapsam toplantısı yapıldı",1.5,"kullanici@sirket.com"]]],
    risks:["Riskler",[["Proje Kodu","Risk","Seviye","Durum","Açıklama"],["PRJ-001","PLC erişimi gecikebilir","Yüksek","Açık","Teknik ekipten dönüş bekleniyor"]]],
    contacts:["RACI ve Kontaklar",[["Proje Kodu","Taraf","Ad Soyad","Unvan","Şirket","Departman","E-posta","Telefon","RACI","Sorumluluk Kapsamı"],["PRJ-001","Müşteri","Örnek Kontak","Üretim Müdürü","Müşteri A.Ş.","Üretim","kontak@musteri.com","+90 5xx","A","Kabul ve önceliklendirme"]]],
    documents:["Dokümanlar",[["Proje Kodu","Doküman Adı","Amaç","Etiketler","OneDrive URL","Sahibi","Versiyon"],["PRJ-001","Teknik Tasarım","Teknik mimari","tasarım,mimari","https://...","Örnek Kullanıcı","1.0"]]],
    plans:["Çalışma Planları",[["Proje Kodu","Kullanıcı E-posta","Çalışma Türü","Tarih","Başlangıç","Bitiş","Plan Notu","Durum","Gerçekleşen Efor","Gerçekleşme Notu"],["PRJ-001","kullanici@sirket.com","Uzaktan","2026-07-06","09:00","12:00","Entegrasyon kontrolü","Planlandı","",""]]],
    todos:["Kişisel To-Do",[["Kullanıcı E-posta","Proje Kodu","Müşteri","Termin","Aksiyon","Tamamlandı"],["kullanici@sirket.com","PRJ-001","Örnek Müşteri","2026-07-10","Müşteriden veri bekleniyor","Hayır"]]],
    personalTasks:["Yönetici Görevleri",[["Atanan E-posta","Atayan E-posta","Görev","Başlangıç","Termin","Durum","Öncelik","Planlanan Efor","Not"],["kullanici@sirket.com","yonetici@sirket.com","Haftalık raporu hazırla","2026-07-06","2026-07-10","Bekliyor","Orta",2,""]]],
  };
  const downloadTemplate=(type="all")=>{
    const workbook=XLSX.utils.book_new();
    const definitions=type==="all"?Object.values(sheetDefinitions):[sheetDefinitions[type]];
    definitions.filter(Boolean).forEach(([name,rows])=>{const sheet=XLSX.utils.aoa_to_sheet(rows);sheet["!cols"]=rows[0].map((_,index)=>({wch:index<2?22:18}));XLSX.utils.book_append_sheet(workbook,sheet,name);});
    XLSX.writeFile(workbook,type==="all"?"corject-tum-veriler-import-sablonu.xlsx":`corject-${type}-import-sablonu.xlsx`);
  };
  const readFile=event=>{
    const file=event.target.files?.[0];if(!file)return;
    setMessage("");
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const workbook=XLSX.read(reader.result,{type:"array",cellDates:false});
        const data=Object.fromEntries(Object.keys(sheetDefinitions).map(key=>[key,[]]));
        if(importType==="all")Object.entries(sheetDefinitions).forEach(([key,[name]])=>{data[key]=importSheetRows(workbook,name);});
        else data[importType]=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
        const errors=[];
        const knownProjectCodes=new Set([...(state.projects||[]).map(project=>project.importCode).filter(Boolean),...data.projects.map(row=>importText(row["Proje Kodu"])).filter(Boolean)]);
        const knownEmails=new Set([...(state.people||[]).map(person=>person.email?.toLocaleLowerCase("tr-TR")).filter(Boolean),...data.people.map(row=>importText(row["E-posta"]).toLocaleLowerCase("tr-TR")).filter(Boolean)]);
        data.projects.forEach((row,index)=>{if(!importText(row["Proje Kodu"])||!importText(row["Proje Adı"]))errors.push(`Projeler satır ${index+2}: Proje Kodu ve Proje Adı zorunlu.`);});
        ["tasks","tickets","machines","actions","risks","contacts","documents","plans"].forEach(key=>data[key].forEach((row,index)=>{const code=importText(row["Proje Kodu"]);if(!code)errors.push(`${sheetDefinitions[key][0]} satır ${index+2}: Proje Kodu zorunlu.`);else if(!knownProjectCodes.has(code))errors.push(`${sheetDefinitions[key][0]} satır ${index+2}: ${code} proje kodu sistemde veya Projeler sayfasında bulunmuyor.`);}));
        data.plans.forEach((row,index)=>{const email=importText(row["Kullanıcı E-posta"]).toLocaleLowerCase("tr-TR");if(!knownEmails.has(email))errors.push(`Çalışma Planları satır ${index+2}: ${email||"Kullanıcı e-postası"} ekipte bulunmuyor.`);});
        data.todos.forEach((row,index)=>{const email=importText(row["Kullanıcı E-posta"]).toLocaleLowerCase("tr-TR");if(!knownEmails.has(email))errors.push(`Kişisel To-Do satır ${index+2}: ${email||"Kullanıcı e-postası"} ekipte bulunmuyor.`);});
        data.personalTasks.forEach((row,index)=>{const email=importText(row["Atanan E-posta"]).toLocaleLowerCase("tr-TR");if(!knownEmails.has(email))errors.push(`Yönetici Görevleri satır ${index+2}: ${email||"Atanan e-posta"} ekipte bulunmuyor.`);});
        setPreview({...data,errors});
        setFileName(file.name);
      }catch(error){setPreview(null);setMessage(`Dosya okunamadı: ${error.message}`);}
      event.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };
  const applyImport=()=>{
    if(!preview||preview.errors.length)return;
    setState(current=>{
      const people=[...current.people];
      const personByEmail=new Map(people.filter(person=>person.email).map(person=>[person.email.toLocaleLowerCase("tr-TR"),person]));
      preview.people.forEach(row=>{
        const email=importText(row["E-posta"]).toLocaleLowerCase("tr-TR");
        const name=importText(row["Ad Soyad"]);
        if(!email||!name||personByEmail.has(email))return;
        const person={id:uid(),email,name,phone:importText(row.Telefon),role:importText(row.Rol)||"Kullanıcı",avatar:name.split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase(),isAdmin:false};
        people.push(person);personByEmail.set(email,person);
      });
      const projects=current.projects.map(project=>({...project,milestones:(project.milestones||[]).map(milestone=>({...milestone,tasks:[...(milestone.tasks||[])]})),machines:[...(project.machines||[])]}));
      const projectByCode=new Map(projects.filter(project=>project.importCode).map(project=>[project.importCode,project]));
      preview.projects.forEach(row=>{
        const code=importText(row["Proje Kodu"]);if(projectByCode.has(code))return;
        const existing=projects.find(project=>project.name.toLocaleLowerCase("tr-TR")===importText(row["Proje Adı"]).toLocaleLowerCase("tr-TR"));
        if(existing){existing.importCode=code;projectByCode.set(code,existing);return;}
        const project={id:uid(),importCode:code,name:importText(row["Proje Adı"]),description:importText(row["Açıklama"]),status:importText(row.Durum)||"Başlamadı",startDate:importText(row["Başlangıç"]),endDate:importText(row["Bitiş"]),color:importText(row.Renk)||"#4A6CF7",milestones:[],risks:[],machines:[],commissioningTree:[],commissioningTracking:false,members:[],pmIds:[],stakeholders:[],readinessChecklist:createReadinessChecklist(),readinessThreshold:80,raciContacts:[],documents:[],reportSchedules:[]};
        projects.push(project);projectByCode.set(code,project);
      });
      preview.tasks.forEach(row=>{
        const project=projectByCode.get(importText(row["Proje Kodu"]));if(!project)return;
        const milestoneName=importText(row.Milestone)||"Genel";
        let milestone=project.milestones.find(item=>item.name===milestoneName);
        if(!milestone){milestone={id:uid(),name:milestoneName,status:"Başlamadı",startDate:"",dueDate:"",tasks:[]};project.milestones.push(milestone);}
        const title=importText(row.Görev);if(!title||milestone.tasks.some(task=>task.title===title&&task.dueDate===importText(row.Termin)))return;
        const person=personByEmail.get(importText(row["Sorumlu E-posta"]).toLocaleLowerCase("tr-TR"));
        milestone.tasks.push({id:uid(),title,startDate:importText(row.Başlangıç),dueDate:importText(row.Termin),status:STATUSES.includes(importText(row.Durum))?importText(row.Durum):"Başlamadı",priority:PRIORITIES.includes(importText(row.Öncelik))?importText(row.Öncelik):"Orta",assignee:person?.id||"",responsibilityGroup:importText(row["Sorumluluk Grubu"])||"Proje Ekibi",estimatedHours:Number(row["Planlanan Efor"])||0,timeEntries:[],waitingHistory:[]});
        Object.assign(milestone,normalizeMilestone(milestone));
      });
      preview.machines.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const name=importText(row["Makine Adı"]);if(!project||!name||project.machines.some(machine=>machine.code&&machine.code===importText(row["Makine Kodu"])))return;project.machines.push({id:uid(),code:importText(row["Makine Kodu"]),name,type:importText(row.Tip).toLocaleLowerCase("tr-TR")==="sanal"?"virtual":"physical",commissioned:importBool(row["Devreye Alındı"]),commissionedAt:importText(row["Devreye Alma Tarihi"]),note:importText(row["Açıklama"])});});
      preview.risks.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const title=importText(row.Risk);if(!project||!title||(project.risks||[]).some(risk=>risk.title===title))return;project.risks=[...(project.risks||[]),{id:uid(),title,level:importText(row.Seviye)||"Orta",status:importText(row.Durum)||"Açık",note:importText(row.Açıklama)}];});
      preview.contacts.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const name=importText(row["Ad Soyad"]);const email=importText(row["E-posta"]);if(!project||!name||(project.raciContacts||[]).some(contact=>contact.name===name&&contact.email===email))return;project.raciContacts=[...(project.raciContacts||[]),{id:uid(),side:importText(row.Taraf)||"Müşteri",name,title:importText(row.Unvan),company:importText(row.Şirket),department:importText(row.Departman),email,phone:importText(row.Telefon),raci:importText(row.RACI)||"I",scope:importText(row["Sorumluluk Kapsamı"])}];});
      preview.documents.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const name=importText(row["Doküman Adı"]);const url=importText(row["OneDrive URL"]);if(!project||!name||(project.documents||[]).some(document=>document.name===name&&document.url===url))return;project.documents=[...(project.documents||[]),{id:uid(),name,purpose:importText(row.Amaç),tags:importText(row.Etiketler).split(",").map(item=>item.trim()).filter(Boolean),url,owner:importText(row.Sahibi),version:importText(row.Versiyon)||"1.0",createdAt:now()}];});
      const projectTickets={...(current.projectTickets||{})};
      preview.tickets.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const title=importText(row.Başlık);const openedAt=importText(row["Açılış Tarihi"]);if(!project||!title||(projectTickets[project.id]||[]).some(ticket=>ticket.title===title&&String(ticket.ts||"").slice(0,10)===openedAt.slice(0,10)))return;const person=personByEmail.get(importText(row["Atanan E-posta"]).toLocaleLowerCase("tr-TR"));projectTickets[project.id]=[...(projectTickets[project.id]||[]),{id:uid(),title,description:importText(row.Açıklama),category:importText(row.Kategori)||"Diğer",priority:importText(row.Öncelik)||"Orta",status:importText(row.Durum)||"Açık",assignedTo:person?.id||"",author:currentUser.name,ts:openedAt||now(),updatedAt:now(),history:[]}];});
      const projectActions={...(current.projectActions||{})};
      preview.actions.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const text=importText(row.Aksiyon);const actionAt=importText(row.Tarih);if(!project||!text||(projectActions[project.id]||[]).some(action=>action.text===text&&String(action.actionAt||"").slice(0,16)===actionAt.slice(0,16)))return;const person=personByEmail.get(importText(row["Yapan E-posta"]).toLocaleLowerCase("tr-TR"))||currentUser;projectActions[project.id]=[...(projectActions[project.id]||[]),{id:uid(),tag:importText(row.Etiket)||"Diğer",text,effortHours:Number(row.Efor)||0,actionAt:actionAt||now(),createdAt:now(),authorId:person.id,authorName:person.name}];});
      const fieldPlans=[...(current.fieldPlans||[])];
      preview.plans.forEach(row=>{const project=projectByCode.get(importText(row["Proje Kodu"]));const person=personByEmail.get(importText(row["Kullanıcı E-posta"]).toLocaleLowerCase("tr-TR"));const date=importText(row.Tarih);const startTime=importText(row.Başlangıç);if(!project||!person||!date||fieldPlans.some(plan=>plan.projectId===project.id&&plan.userId===person.id&&plan.date===date&&plan.startTime===startTime))return;const completed=importText(row.Durum).toLocaleLowerCase("tr-TR").includes("gerçek");fieldPlans.push({id:uid(),projectId:project.id,userId:person.id,workType:importText(row["Çalışma Türü"]).toLocaleLowerCase("tr-TR").includes("uzak")?"remote":"field",date,startTime:startTime||"09:00",endTime:importText(row.Bitiş)||"17:00",note:importText(row["Plan Notu"]),status:completed?"completed":"planned",effortHours:Number(row["Gerçekleşen Efor"])||0,visitNotes:importText(row["Gerçekleşme Notu"]),createdAt:now(),...(completed?{completedAt:now()}: {})});});
      const userNotes={...(current.userNotes||{})};
      preview.todos.forEach(row=>{const person=personByEmail.get(importText(row["Kullanıcı E-posta"]).toLocaleLowerCase("tr-TR"));if(!person)return;const action=importText(row.Aksiyon);if(!action)return;const existing=userNotes[person.id]||{};const todos=[...(existing.todos||[])];if(todos.some(todo=>todo.action===action&&todo.dueDate===importText(row.Termin)))return;const project=projectByCode.get(importText(row["Proje Kodu"]));todos.push({id:uid(),projectId:project?.id||"",customer:importText(row.Müşteri)||project?.name||"",dueDate:importText(row.Termin),action,text:action,done:importBool(row.Tamamlandı),createdAt:now()});userNotes[person.id]={...existing,todos};});
      const personalTasks=[...(current.personalTasks||[])];
      preview.personalTasks.forEach(row=>{const assignee=personByEmail.get(importText(row["Atanan E-posta"]).toLocaleLowerCase("tr-TR"));const assigner=personByEmail.get(importText(row["Atayan E-posta"]).toLocaleLowerCase("tr-TR"))||currentUser;const title=importText(row.Görev);const dueDate=importText(row.Termin);if(!assignee||!title||personalTasks.some(task=>task.assignee===assignee.id&&task.title===title&&task.dueDate===dueDate))return;personalTasks.push({id:uid(),title,startDate:importText(row.Başlangıç),dueDate,status:STATUSES.includes(importText(row.Durum))?importText(row.Durum):"Bekliyor",priority:PRIORITIES.includes(importText(row.Öncelik))?importText(row.Öncelik):"Orta",estimatedHours:Number(row["Planlanan Efor"])||0,notes:importText(row.Not),assignee:assignee.id,createdBy:assigner.id,createdByName:assigner.name,createdAt:now(),comments:[]});});
      return {...current,people,projects,projectTickets,projectActions,fieldPlans,userNotes,personalTasks};
    });
    setMessage("Import tamamlandı. Yeni kayıtlar mevcut verilerle birleştirildi.");
    setPreview(null);setFileName("");
  };
  const counts=preview&&Object.entries(sheetDefinitions).map(([key,[label]])=>[label,preview[key].length]).filter(([,value])=>value>0);
  return <div style={{padding:"clamp(18px,4vw,30px)",flex:1,overflow:"auto"}}><div style={{maxWidth:980,margin:"0 auto"}}><div style={{marginBottom:18}}><h2 style={{margin:0,fontSize:22}}>Import Merkezi</h2><p style={{margin:"5px 0 0",fontSize:12,color:"#64748B"}}>Başka uygulamalardaki temel operasyon verilerini kontrollü olarak Corject'e taşıyın.</p><div style={{marginTop:9,display:"inline-block",background:"#FFF7ED",color:"#9A3412",borderRadius:8,padding:"6px 9px",fontSize:9,fontWeight:700}}>Güvenlik nedeniyle parola ve uzaktan erişim sırları Excel importuna dahil edilmez.</div></div>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:17,marginBottom:14}}><div style={{fontSize:13,fontWeight:850,marginBottom:10}}>Import edilecek veri grubunu seçin</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>{importModules.map(([id,label,description])=><button key={id} onClick={()=>{setImportType(id);setPreview(null);setMessage("");}} style={{border:`1.5px solid ${importType===id?"#4A6CF7":"#E2E8F0"}`,background:importType===id?"#EEF2FF":"#fff",borderRadius:11,padding:11,textAlign:"left",cursor:"pointer"}}><b style={{display:"block",fontSize:11,color:importType===id?"#4338CA":"#1E293B"}}>{label}</b><span style={{display:"block",fontSize:9,color:"#64748B",lineHeight:1.4,marginTop:3}}>{description}</span></button>)}</div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}><div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:17}}><b style={{fontSize:13}}>1. Şablonu indirin</b><p style={{fontSize:11,color:"#64748B",lineHeight:1.55}}>Seçili veri grubunun kolonlarını değiştirmeden doldurun.</p><Btn variant="secondary" onClick={()=>downloadTemplate(importType)}>Seçili XLSX Şablonunu İndir</Btn></div><div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:17}}><b style={{fontSize:13}}>2. Dolu dosyayı seçin</b><p style={{fontSize:11,color:"#64748B",lineHeight:1.55}}>Önce önizleme yapılır; onay vermeden hiçbir kayıt değiştirilmez.</p><label style={{display:"inline-flex",background:"#4A6CF7",color:"#fff",borderRadius:9,padding:"9px 12px",fontSize:11,fontWeight:800,cursor:"pointer"}}>XLSX Seç<input type="file" accept=".xlsx,.xls" onChange={readFile} style={{display:"none"}}/></label></div></div>
    {preview&&<div style={{background:"#fff",border:`1.5px solid ${preview.errors.length?"#FDA4AF":"#C7D2FE"}`,borderRadius:15,padding:17}}><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}><div><b>{fileName}</b><div style={{fontSize:10,color:"#64748B",marginTop:3}}>Import önizlemesi</div></div><Btn disabled={preview.errors.length>0} onClick={applyImport}>Importu Uygula</Btn></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:13}}>{counts.map(([label,value])=><div key={label} style={{background:"#F8FAFC",borderRadius:10,padding:10}}><b style={{fontSize:20,color:"#4F46E5"}}>{value}</b><div style={{fontSize:9,color:"#64748B"}}>{label}</div></div>)}</div>{preview.errors.length>0&&<div style={{marginTop:12,background:"#FFF1F2",color:"#BE123C",borderRadius:10,padding:11,fontSize:10,lineHeight:1.6}}>{preview.errors.map(error=><div key={error}>{error}</div>)}</div>}</div>}
    {message&&<div style={{marginTop:12,background:message.startsWith("Import")?"#ECFDF5":"#FFF1F2",color:message.startsWith("Import")?"#047857":"#BE123C",borderRadius:10,padding:12,fontSize:11}}>{message}</div>}
  </div></div>;
}

const reportScheduleStatus = (item) => {
  if(item.lastError)return `Son hata: ${item.lastError}`;
  if(item.lastSentAt)return `Son gönderim: ${new Date(item.lastSentAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})}`;
  return `Sonraki gönderim: ${item.nextRunAt?new Date(item.nextRunAt).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"}):"-"}`;
};

function ReportScheduleCard({item,canEdit,onToggle,onDelete}) {
  return <details style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:13}}>
    <summary style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",cursor:"pointer",listStyle:"none"}}>
      <div style={{flex:1,minWidth:180}}>
        <b style={{fontSize:12}}>{item.name}</b>
        <div style={{fontSize:10,color:"#64748B",marginTop:3}}>{item.reportType==="jira_newsletter"?"Jira Done geliştirme bülteni":"Proje durum raporu"} · {item.frequency==="weekly"?"Haftalık":"Aylık"} · {item.time} (İstanbul) · {(item.recipients||[]).join(", ")}</div>
        <div style={{fontSize:9,color:item.lastError?"#BE123C":"#64748B",marginTop:4}}>{reportScheduleStatus(item)}</div>
      </div>
      <button onClick={event=>{event.preventDefault();onToggle();}} style={{border:0,borderRadius:8,padding:"6px 9px",cursor:"pointer",background:item.enabled?"#ECFDF5":"#F1F5F9",color:item.enabled?"#047857":"#64748B"}}>{item.enabled?"Aktif":"Pasif"}</button>
      {canEdit&&<button onClick={event=>{event.preventDefault();onDelete();}} style={{border:0,background:"transparent",color:"#E11D48",cursor:"pointer"}}>Sil</button>}
    </summary>
    <div style={{borderTop:"1px solid #E2E8F0",marginTop:10,paddingTop:10}}>
      <b style={{fontSize:10}}>Gönderim Logu</b>
      <div style={{display:"grid",gap:5,marginTop:7}}>
        {(item.deliveryLog||[]).length?(item.deliveryLog||[]).map(log=><div key={log.id||log.at} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:9,background:log.success?"#ECFDF5":"#FFF1F2",color:log.success?"#047857":"#BE123C",borderRadius:7,padding:"6px 8px"}}><span>{new Date(log.at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})} · {(log.recipients||item.recipients||[]).join(", ")}</span><b>{log.success?"Gönderildi":log.error||"Başarısız"}</b></div>):<div style={{fontSize:9,color:"#94A3B8"}}>Henüz gönderim denemesi yok.</div>}
      </div>
    </div>
  </details>;
}

function ProjectOverviewPanel({project,onChange,canEdit}) {
  const [editing,setEditing]=useState(false);
  const location=project.location||{city:"",district:"",address:""};
  const customer=project.customerProfile||{};
  const customerName=customer.name||project.customerName||project.name;
  const modules=project.activeModules||[];
  const contacts=[...(project.customerContacts||[]),...(project.raciContacts||[]).filter(item=>item.side==="Müşteri")];
  const totalTasks=project.milestones.flatMap(milestone=>milestone.tasks||[]).length;
  const doneTasks=project.milestones.flatMap(milestone=>milestone.tasks||[]).filter(task=>task.status==="Tamamlandı").length;
  const progress=totalTasks?Math.round(doneTasks/totalTasks*100):0;
  const lateTasks=project.milestones.flatMap(milestone=>milestone.tasks||[]).filter(task=>delayLvl(task.dueDate,task.status)).length;
  const openRisks=(project.risks||[]).filter(risk=>!["Kapalı","Kapal\u0131"].includes(risk.status)).length;
  const url=mapsUrl(location);
  const updateLocation=(key,value)=>onChange({location:{...location,[key]:value}});
  const updateCustomer=(key,value)=>onChange({customerProfile:{...customer,[key]:value}});
  const toggleModule=(module)=>onChange({activeModules:modules.includes(module)?modules.filter(item=>item!==module):[...modules,module]});
  const statCards=[["Tamamlama",`%${progress}`,"#4F46E5",`${doneTasks}/${totalTasks} görev`],["Başlangıç",`${readinessScore(project)}/100`,readinessScore(project)>=Number(project.readinessThreshold||80)?"#059669":"#E11D48","proje sağlığı"],["Geciken",lateTasks,"#EA6C00","açık termin"],["Risk",openRisks,"#E11D48","açık risk"]];
  return <div style={{display:"grid",gap:14}}>
    <div style={{display:"none",background:"linear-gradient(135deg,#0F172A,#4338CA 58%,#06B6D4)",borderRadius:22,padding:"clamp(18px,3vw,28px)",color:"#fff",boxShadow:"0 22px 48px rgba(67,56,202,.2)",overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",right:-60,top:-70,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,.13)"}}/>
      <div style={{display:"flex",gap:16,alignItems:"center",position:"relative",zIndex:1,flexWrap:"wrap"}}>
        <div style={{width:78,height:78,borderRadius:24,background:"rgba(255,255,255,.16)",display:"grid",placeItems:"center",overflow:"hidden",border:"1px solid rgba(255,255,255,.2)",boxShadow:"0 16px 34px rgba(15,23,42,.2)"}}>{customer.logoUrl?<img src={customer.logoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<b style={{fontSize:29}}>{customerName.slice(0,1).toUpperCase()}</b>}</div>
        <div style={{flex:1,minWidth:220}}><div style={{fontSize:11,fontWeight:900,color:"#C7D2FE",letterSpacing:1,textTransform:"uppercase"}}>Müşteri / Proje Ana Sayfası</div><h2 style={{margin:"4px 0 6px",fontSize:"clamp(23px,4vw,34px)",lineHeight:1.1}}>{customerName}</h2><div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}><span style={{fontSize:10,fontWeight:900,color:"#fff",background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,padding:"5px 9px"}}>Proje: {project.name}</span>{customer.website&&<a href={customer.website.startsWith("http")?customer.website:`https://${customer.website}`} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:900,color:"#fff",background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,padding:"5px 9px",textDecoration:"none"}}>Web sitesi</a>}{url&&<a href={url} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:900,color:"#fff",background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,padding:"5px 9px",textDecoration:"none"}}>Yol tarifi</a>}</div><div style={{fontSize:12,color:"#DBEAFE",lineHeight:1.55}}>{project.description||"Proje açıklaması henüz girilmedi."}</div></div>
        <div style={{display:"grid",gap:7,minWidth:190,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.16)",borderRadius:18,padding:13}}><span style={{fontSize:11,color:"#BFDBFE"}}>Başlangıç: <b style={{color:"#fff"}}>{fmt(project.startDate)}</b></span><span style={{fontSize:11,color:"#BFDBFE"}}>Hedef Bitiş: <b style={{color:"#fff"}}>{fmt(project.endDate)}</b></span><span style={{fontSize:11,color:"#BFDBFE"}}>Konum: <b style={{color:"#fff"}}>{[location.district,location.city].filter(Boolean).join(" / ")||"-"}</b></span></div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>{statCards.map(([label,value,color,meta])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:15,boxShadow:"0 8px 24px rgba(15,23,42,.04)"}}><div style={{fontSize:10,color:"#64748B",fontWeight:850,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:26,fontWeight:950,color,marginTop:4}}>{value}</div><div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{meta}</div></div>)}</div>
    <div className="admin-main-grid" style={{display:"none",gridTemplateColumns:"1.15fr .85fr",gap:14}}>
      <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:18,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:13}}><div><h3 style={{margin:0,fontSize:15}}>Müşteri Bilgileri</h3><p style={{margin:"4px 0 0",fontSize:11,color:"#64748B"}}>Logo, web sitesi, konum ve aktif modüller.</p></div><div style={{display:"flex",gap:7}}>{customer.website&&<a href={customer.website.startsWith("http")?customer.website:`https://${customer.website}`} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:850,color:"#2563EB",background:"#DBEAFE",borderRadius:9,padding:"7px 9px",textDecoration:"none"}}>Web Sitesi</a>}{canEdit&&<button onClick={()=>setEditing(value=>!value)} style={{border:0,borderRadius:9,padding:"7px 9px",background:editing?"#111827":"#EEF2FF",color:editing?"#fff":"#4338CA",fontSize:10,fontWeight:900,cursor:"pointer"}}>{editing?"Kapat":"Düzenle"}</button>}</div></div>
        {editing&&canEdit&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9,marginBottom:14}}><Field label="Müşteri Adı"><input style={iStyle} value={customer.name||""} onChange={event=>updateCustomer("name",event.target.value)} placeholder="Firma adı"/></Field><Field label="Müşteri Web Sitesi"><input style={iStyle} value={customer.website||""} onChange={event=>updateCustomer("website",event.target.value)} placeholder="https://firma.com"/></Field><Field label="Müşteri Logo URL"><input style={iStyle} value={customer.logoUrl||""} onChange={event=>updateCustomer("logoUrl",event.target.value)} placeholder="https://.../logo.png"/></Field><Field label="İl"><input style={iStyle} value={location.city||""} onChange={event=>updateLocation("city",event.target.value)}/></Field><Field label="İlçe"><input style={iStyle} value={location.district||""} onChange={event=>updateLocation("district",event.target.value)}/></Field><Field label="Adres"><input style={iStyle} value={location.address||""} onChange={event=>updateLocation("address",event.target.value)} placeholder="Açık adres"/></Field></div>}
        <div style={{display:"grid",gap:8,marginBottom:13,fontSize:12,color:"#475569"}}><div><b>Web:</b> {customer.website||"-"}</div><div><b>Konum:</b> {[location.address,location.district,location.city].filter(Boolean).join(", ")||"-"}</div></div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{DEFAULT_ACTIVE_MODULES.map(module=><button key={module} disabled={!editing||!canEdit} onClick={()=>toggleModule(module)} style={{border:"1px solid "+(modules.includes(module)?"#4F46E5":"#E2E8F0"),background:modules.includes(module)?"#EEF2FF":"#F8FAFC",color:modules.includes(module)?"#4338CA":"#64748B",borderRadius:999,padding:"7px 10px",fontSize:10,fontWeight:850,cursor:editing&&canEdit?"pointer":"default"}}>{module}</button>)}</div>
      </div>
      <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:18,padding:18}}>
        <h3 style={{margin:"0 0 12px",fontSize:15}}>Kontaklar</h3>
        <div style={{display:"grid",gap:8}}>{contacts.slice(0,6).map((contact,index)=><div key={contact.id||index} style={{display:"flex",gap:10,alignItems:"center",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:13,padding:10}}><span style={{width:34,height:34,borderRadius:"50%",background:"#EEF2FF",color:"#4338CA",display:"grid",placeItems:"center",fontWeight:900,fontSize:11}}>{(contact.name||"?").split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()}</span><span style={{minWidth:0,flex:1}}><b style={{display:"block",fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{contact.name}</b><small style={{display:"block",fontSize:10,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{contact.title||contact.raci||"Kontak"}{contact.email?` · ${contact.email}`:""}</small></span></div>)}</div>
        {!contacts.length&&<div style={{padding:24,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:13,color:"#94A3B8",fontSize:11}}>Müşteri kontağı henüz eklenmedi.</div>}
      </div>
    </div>
  </div>;
}

function ReadinessPanel({project,checklist,score,threshold,canEdit,onChange,updateItem}) {
  const [category,setCategory]=useState("all");
  const categories=["all",...Array.from(new Set(checklist.map(item=>item.category)))];
  const filtered=category==="all"?checklist:checklist.filter(item=>item.category===category);
  const statusMeta={
    ready:["Hazır","#059669","#ECFDF5"],
    partial:["Kısmi","#EA6C00","#FFF7ED"],
    not_ready:["Hazır Değil","#E11D48","#FFF1F2"],
    unanswered:["Bekliyor","#64748B","#F1F5F9"],
  };
  const counts=checklist.reduce((result,item)=>({...result,[item.status]:(result[item.status]||0)+1}),{});
  const reset=()=>onChange({readinessChecklist:createReadinessChecklist()});
  return <div style={{display:"grid",gap:14}}>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:20,padding:18,boxShadow:"0 10px 28px rgba(15,23,42,.04)"}}>
      <div style={{display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{width:118,height:118,borderRadius:"50%",background:`conic-gradient(${score>=threshold?"#10B981":"#E11D48"} ${score*3.6}deg,#E2E8F0 0deg)`,display:"grid",placeItems:"center",flexShrink:0}}>
          <div style={{width:92,height:92,borderRadius:"50%",background:"#fff",display:"grid",placeItems:"center",textAlign:"center"}}><b style={{fontSize:28,color:score>=threshold?"#059669":"#E11D48"}}>{score}</b><span style={{fontSize:9,color:"#94A3B8",fontWeight:850}}>/100</span></div>
        </div>
        <div style={{flex:1,minWidth:230}}><div style={{fontSize:11,fontWeight:900,color:"#64748B",letterSpacing:1,textTransform:"uppercase"}}>Başlangıç Sağlığı</div><h3 style={{margin:"5px 0 6px",fontSize:22}}>{score>=threshold?"Proje Başlangıca Hazır":"Başlamadan Önce Tamamlanmalı"}</h3><p style={{margin:0,fontSize:12,color:"#64748B",lineHeight:1.65}}>MES projeleri için kapsam, veri, entegrasyon, OT altyapı, saha hazırlığı ve kabul maddeleri tek yerde takip edilir. Eşik değer <b>{threshold}</b>; 80 altı projelerde saha uygulamasına geçmeden önce eksikler kapatılmalı.</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,94px)",gap:8}}>{[["ready","Hazır"],["partial","Kısmi"],["not_ready","Eksik"],["unanswered","Bekleyen"]].map(([key,label])=>{const [,color,bg]=statusMeta[key];return <div key={key} style={{background:bg,borderRadius:13,padding:10,textAlign:"center"}}><b style={{display:"block",fontSize:20,color}}>{counts[key]||0}</b><span style={{fontSize:9,color,fontWeight:850}}>{label}</span></div>;})}</div>
      </div>
    </div>
    <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:2}}>{categories.map(item=><button key={item} onClick={()=>setCategory(item)} style={{border:0,borderRadius:999,padding:"8px 12px",background:category===item?"#111827":"#F1F5F9",color:category===item?"#fff":"#64748B",fontSize:10,fontWeight:900,cursor:"pointer",whiteSpace:"nowrap"}}>{item==="all"?"Tüm Kategoriler":item}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(360px,100%),1fr))",gap:10}}>{filtered.map(item=>{const [label,color,bg]=statusMeta[item.status]||statusMeta.unanswered;return <div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:14,boxShadow:"0 6px 18px rgba(15,23,42,.035)"}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}><span style={{width:34,height:34,borderRadius:12,background:bg,color,display:"grid",placeItems:"center",flexShrink:0}}><Icon name={item.status==="ready"?"check":"clock"} size={16}/></span><div style={{flex:1,minWidth:0}}><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:9,fontWeight:900,color:"#4338CA",background:"#EEF2FF",borderRadius:999,padding:"3px 7px"}}>{item.category}</span><span style={{fontSize:9,fontWeight:900,color,background:bg,borderRadius:999,padding:"3px 7px"}}>{label}</span><span style={{fontSize:9,color:"#94A3B8"}}>Ağırlık {item.weight}</span></div>{canEdit?<input style={{...iStyle,border:0,padding:"8px 0",fontWeight:850,fontSize:12,background:"transparent"}} value={item.text} onChange={event=>updateItem(item.id,{text:event.target.value})}/>:<b style={{display:"block",fontSize:12,marginTop:8,lineHeight:1.45}}>{item.text}</b>}</div></div>
      {canEdit&&<div style={{display:"grid",gridTemplateColumns:"1fr 72px auto",gap:8,alignItems:"center",marginTop:10}}><select style={iStyle} value={item.status} onChange={event=>updateItem(item.id,{status:event.target.value})}><option value="unanswered">Bekliyor</option><option value="ready">Hazır</option><option value="partial">Kısmi</option><option value="not_ready">Hazır Değil</option></select><input type="number" min="1" max="100" style={iStyle} value={item.weight} onChange={event=>updateItem(item.id,{weight:event.target.value})}/><button title="Sil" onClick={()=>onChange({readinessChecklist:checklist.filter(entry=>entry.id!==item.id)})} style={{border:0,background:"#FFF1F2",color:"#E11D48",borderRadius:10,padding:"9px 11px",cursor:"pointer"}}>Sil</button></div>}
      <textarea disabled={!canEdit} style={{...iStyle,minHeight:64,resize:"vertical",marginTop:9,fontSize:11,background:canEdit?"#F8FAFC":"#fff"}} value={item.note||""} onChange={event=>updateItem(item.id,{note:event.target.value})} placeholder="Kanıt, eksik veya aksiyon notu"/>
    </div>;})}</div>
    {canEdit&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Btn small onClick={()=>onChange({readinessChecklist:[...checklist,{id:uid(),category:"Özel",text:"Yeni kontrol maddesi",weight:1,status:"unanswered",note:""}]})}>+ Kontrol Maddesi</Btn><Btn small variant="secondary" onClick={reset}>MES Şablonunu Sıfırla</Btn></div>}
  </div>;
}

function TrainingPanel({project,onChange,canEdit,people}) {
  const trainings=project.trainings||[];
  const empty={scope:TRAINING_SCOPES[0],title:"",date:todayStr(),trainerId:"",participants:"",notes:""};
  const [form,setForm]=useState(empty);
  const [search,setSearch]=useState("");
  const update=(key,value)=>setForm(current=>({...current,[key]:value}));
  const save=()=>{
    if(!form.title.trim())return;
    onChange({trainings:[{...form,id:uid(),createdAt:now(),title:form.title.trim(),participants:form.participants.split(",").map(item=>item.trim()).filter(Boolean)},...trainings]});
    setForm(empty);
  };
  const filtered=trainings.filter(item=>`${item.scope} ${item.title} ${item.notes}`.toLocaleLowerCase("tr-TR").includes(search.toLocaleLowerCase("tr-TR")));
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}><div><h3 style={{margin:0,fontSize:15}}>Eğitimler</h3><p style={{margin:"4px 0 0",fontSize:11,color:"#64748B"}}>Proje kapsamındaki eğitimleri, katılımcıları ve devir notlarını takip edin.</p></div><input style={{...iStyle,width:240}} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Eğitimlerde ara..."/></div>
    {canEdit&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:15,marginBottom:13,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}><Field label="Kapsam"><select style={iStyle} value={form.scope} onChange={event=>update("scope",event.target.value)}>{TRAINING_SCOPES.map(scope=><option key={scope}>{scope}</option>)}</select></Field><Field label="Başlık"><input style={iStyle} value={form.title} onChange={event=>update("title",event.target.value)} placeholder="Örn. Operatör vardiya eğitimi"/></Field><Field label="Tarih"><input type="date" style={iStyle} value={form.date} onChange={event=>update("date",event.target.value)}/></Field><Field label="Eğitmen"><select style={iStyle} value={form.trainerId} onChange={event=>update("trainerId",event.target.value)}><option value="">- Seç -</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Field><Field label="Katılımcılar"><input style={iStyle} value={form.participants} onChange={event=>update("participants",event.target.value)} placeholder="Virgül ile yazın"/></Field><Field label="Not"><input style={iStyle} value={form.notes} onChange={event=>update("notes",event.target.value)} placeholder="Kapsam, eksik kalanlar, sonraki eğitim"/></Field><div style={{alignSelf:"end"}}><Btn onClick={save}>Eğitimi Kaydet</Btn></div></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:10}}>{filtered.map(item=>{const trainer=people.find(person=>person.id===item.trainerId);return <div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:"3px solid #7C3AED",borderRadius:13,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:13}}>{item.title}</b><span style={{fontSize:9,fontWeight:850,color:"#6D28D9",background:"#F5F3FF",borderRadius:7,padding:"3px 6px"}}>{item.scope}</span></div><div style={{fontSize:11,color:"#64748B",lineHeight:1.6,marginTop:8}}>{fmt(item.date)}{trainer?` · ${trainer.name}`:""}{item.participants?.length?` · ${item.participants.length} katılımcı`:""}{item.notes?` · ${item.notes}`:""}</div>{canEdit&&<button onClick={()=>onChange({trainings:trainings.filter(entry=>entry.id!==item.id)})} style={{marginTop:9,border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button>}</div>;})}</div>
    {!filtered.length&&<div style={{padding:36,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Eğitim kaydı bulunmuyor.</div>}
  </div>;
}

function ProjectCostPanel({project,onChange,state,canEdit}) {
  const settings=projectCostSettings(project);
  const costs=project.costItems||[];
  const empty={category:"Yetkili Servis İşçilik",description:"",date:todayStr(),amountUsd:"",amountTry:"",note:""};
  const [form,setForm]=useState(empty);
  const updateSettings=(key,value)=>onChange({costSettings:{...settings,[key]:Number(value)||0}});
  const save=()=>{
    if(!form.description.trim())return;
    const amountUsd=form.amountUsd?Number(form.amountUsd):(Number(form.amountTry)||0)/(settings.usdTry||1);
    onChange({costItems:[{...form,id:uid(),amountUsd:Math.round(amountUsd*100)/100,amountTry:form.amountTry?Number(form.amountTry):Math.round(amountUsd*(settings.usdTry||1)),createdAt:now()},...costs]});
    setForm(empty);
  };
  const visitCosts=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)&&Number(plan.roundTripKm)>0).map(plan=>{const c=fuelCost({roundTripKm:plan.roundTripKm,settings});const person=state.people.find(item=>item.id===plan.userId);return {id:`visit-${plan.id}`,category:"Saha Yakıt",description:`${person?.name||"Kullanıcı"} · ${fmt(plan.date)} saha ziyareti`,amountUsd:c.usdAmount,amountTry:c.tryAmount,meta:`${plan.roundTripKm} km · ${c.liters} L`};});
  const manual=costs.map(item=>({...item,amountUsd:Number(item.amountUsd)||0,amountTry:item.amountTry?Number(item.amountTry):Math.round((Number(item.amountUsd)||0)*(settings.usdTry||1))}));
  const rows=[...visitCosts,...manual];
  const totalUsd=rows.reduce((sum,item)=>sum+(Number(item.amountUsd)||0),0);
  const totalTry=rows.reduce((sum,item)=>sum+(Number(item.amountTry)||0),0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9,marginBottom:13}}>{[["Toplam USD",`$${totalUsd.toFixed(2)}`,"#0369A1"],["Toplam TL",`${Math.round(totalTry).toLocaleString("tr-TR")} TL`,"#059669"],["Yakıt Kaydı",visitCosts.length,"#EA6C00"],["Manuel Kalem",manual.length,"#7C3AED"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${color}`,borderRadius:12,padding:13}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><b style={{fontSize:22,color}}>{value}</b></div>)}</div>
    {canEdit&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:15,marginBottom:13}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:9}}><Field label="Yakıt L/100km"><input type="number" step=".1" style={iStyle} value={settings.fuelConsumptionLtPer100Km} onChange={event=>updateSettings("fuelConsumptionLtPer100Km",event.target.value)}/></Field><Field label="Benzin TL/L"><input type="number" step=".01" style={iStyle} value={settings.fuelTryPerLt} onChange={event=>updateSettings("fuelTryPerLt",event.target.value)}/></Field><Field label="USD/TL"><input type="number" step=".01" style={iStyle} value={settings.usdTry} onChange={event=>updateSettings("usdTry",event.target.value)}/></Field></div><div style={{marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}><Field label="Kategori"><select style={iStyle} value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{COST_CATEGORIES.filter(item=>item!=="Saha Yakıt").map(item=><option key={item}>{item}</option>)}</select></Field><Field label="Açıklama"><input style={iStyle} value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></Field><Field label="Tarih"><input type="date" style={iStyle} value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></Field><Field label="Tutar USD"><input type="number" step=".01" style={iStyle} value={form.amountUsd} onChange={event=>setForm({...form,amountUsd:event.target.value})}/></Field><Field label="veya Tutar TL"><input type="number" step=".01" style={iStyle} value={form.amountTry} onChange={event=>setForm({...form,amountTry:event.target.value})}/></Field><Field label="Not"><input style={iStyle} value={form.note} onChange={event=>setForm({...form,note:event.target.value})}/></Field><div style={{alignSelf:"end"}}><Btn onClick={save}>Maliyet Ekle</Btn></div></div></div>}
    <div style={{display:"grid",gap:7}}>{rows.map(row=><div key={row.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:11,padding:"11px 13px",display:"grid",gridTemplateColumns:"130px 1fr 110px 110px auto",gap:9,alignItems:"center"}}><span style={{fontSize:9,fontWeight:850,color:"#4338CA",background:"#EEF2FF",borderRadius:7,padding:"4px 6px",textAlign:"center"}}>{row.category}</span><div><b style={{fontSize:11}}>{row.description}</b>{row.meta&&<div style={{fontSize:9,color:"#94A3B8",marginTop:2}}>{row.meta}</div>}</div><span style={{fontSize:10,color:"#64748B"}}>{fmt(row.date)}</span><b style={{fontSize:12,color:"#0369A1"}}>${Number(row.amountUsd||0).toFixed(2)}</b>{canEdit&&row.id&&!String(row.id).startsWith("visit-")?<button onClick={()=>onChange({costItems:costs.filter(item=>item.id!==row.id)})} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button>:<span/>}</div>)}</div>
    {!rows.length&&<div style={{padding:36,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Maliyet kaydı bulunmuyor.</div>}
  </div>;
}

function LessonsLearnedPanel({project,onChange,canEdit,currentUser}) {
  const lessons=project.lessonsLearned||[];
  const [form,setForm]=useState({title:"",category:"Tekrar Eden Problem",lesson:"",prevention:""});
  const save=()=>{
    if(!form.title.trim()&&!form.lesson.trim())return;
    onChange({lessonsLearned:[{id:uid(),...form,title:form.title.trim()||"Öğrenilmiş ders",lesson:form.lesson.trim(),prevention:form.prevention.trim(),authorId:currentUser?.id||"",authorName:currentUser?.name||"Kullanıcı",createdAt:now()},...lessons]});
    setForm({title:"",category:"Tekrar Eden Problem",lesson:"",prevention:""});
  };
  return <div>
    {canEdit&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:15,marginBottom:13}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}><Field label="Başlık"><input style={iStyle} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></Field><Field label="Kategori"><select style={iStyle} value={form.category} onChange={event=>setForm({...form,category:event.target.value})}>{["Tekrar Eden Problem","Kurulum","Entegrasyon","Müşteri İletişimi","Saha Operasyonu","Eğitim","Diğer"].map(item=><option key={item}>{item}</option>)}</select></Field></div>
      <Field label="Ne öğrendik?"><textarea style={{...iStyle,minHeight:80,resize:"vertical"}} value={form.lesson} onChange={event=>setForm({...form,lesson:event.target.value})}/></Field>
      <Field label="Tekrar etmemesi için aksiyon"><textarea style={{...iStyle,minHeight:64,resize:"vertical"}} value={form.prevention} onChange={event=>setForm({...form,prevention:event.target.value})}/></Field>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={save}>Kaydet</Btn></div>
    </div>}
    <div style={{display:"grid",gap:9}}>{lessons.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderLeft:"4px solid #7C3AED",borderRadius:12,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><b>{item.title}</b><span style={{fontSize:9,fontWeight:900,color:"#6D28D9",background:"#F5F3FF",borderRadius:7,padding:"4px 7px"}}>{item.category}</span></div><div style={{fontSize:12,color:"#334155",lineHeight:1.55,whiteSpace:"pre-wrap",marginTop:8}}>{item.lesson}</div>{item.prevention&&<div style={{fontSize:11,color:"#047857",background:"#ECFDF5",borderRadius:9,padding:"8px 10px",marginTop:9}}><b>Önleyici aksiyon:</b> {item.prevention}</div>}<div style={{fontSize:10,color:"#94A3B8",marginTop:8}}>{item.authorName} · {new Date(item.createdAt||now()).toLocaleString("tr-TR")}</div>{canEdit&&<button onClick={()=>onChange({lessonsLearned:lessons.filter(lesson=>lesson.id!==item.id)})} style={{marginTop:8,border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button>}</div>)}</div>
    {!lessons.length&&<div style={{padding:36,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Bu proje için henüz öğrenilmiş ders yok.</div>}
  </div>;
}

function InvoiceMilestonePanel({project,onChange}) {
  const rows=project.invoiceMilestones||[];
  const [form,setForm]=useState({milestoneId:"",title:"",amount:"",conditions:""});
  const save=()=>{
    if(!form.milestoneId&&!form.title.trim())return;
    const milestone=(project.milestones||[]).find(item=>item.id===form.milestoneId);
    onChange({invoiceMilestones:[{id:uid(),...form,title:form.title.trim()||milestone?.name||"Fatura koşulu",createdAt:now()},...rows]});
    setForm({milestoneId:"",title:"",amount:"",conditions:""});
  };
  return <div>
    <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"10px 13px",fontSize:11,color:"#9A3412",marginBottom:12}}>Yalnızca yöneticiler görür. Milestone tamamlandığında hangi fatura kaleminin kesilebilir olduğunu takip eder.</div>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:14,marginBottom:13,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}><Field label="Milestone"><select style={iStyle} value={form.milestoneId} onChange={event=>setForm({...form,milestoneId:event.target.value})}><option value="">- Seç -</option>{(project.milestones||[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Fatura Kalemi"><input style={iStyle} value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></Field><Field label="Tutar / Oran"><input style={iStyle} value={form.amount} onChange={event=>setForm({...form,amount:event.target.value})}/></Field><Field label="Koşul"><input style={iStyle} value={form.conditions} onChange={event=>setForm({...form,conditions:event.target.value})}/></Field><div style={{alignSelf:"end"}}><Btn onClick={save}>Ekle</Btn></div></div>
    <div style={{display:"grid",gap:8}}>{rows.map(row=>{const milestone=(project.milestones||[]).find(item=>item.id===row.milestoneId);const ready=milestone?milestone.tasks?.length>0&&milestone.tasks.every(task=>task.status==="Tamamlandı"):false;return <div key={row.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderLeft:`4px solid ${ready?"#059669":"#EA6C00"}`,borderRadius:12,padding:13,display:"flex",justifyContent:"space-between",gap:10}}><div><b>{row.title}</b><div style={{fontSize:11,color:"#64748B",marginTop:4}}>{milestone?.name||"Milestone seçilmedi"} · {row.amount||"Tutar yok"}</div>{row.conditions&&<div style={{fontSize:11,color:"#334155",marginTop:5}}>{row.conditions}</div>}</div><div style={{textAlign:"right"}}><span style={{display:"inline-block",background:ready?"#ECFDF5":"#FFF7ED",color:ready?"#047857":"#C2410C",borderRadius:8,padding:"5px 8px",fontSize:10,fontWeight:900}}>{ready?"Faturalanabilir":"Bekliyor"}</span><button onClick={()=>onChange({invoiceMilestones:rows.filter(item=>item.id!==row.id)})} style={{display:"block",marginTop:7,border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:800,cursor:"pointer"}}>Sil</button></div></div>;})}</div>
  </div>;
}

function ProjectSetupPanel({project,onChange,canEdit,state,setState,currentUser,isAdmin}) {
  const [section,setSection]=useState("overview");
  const [contact,setContact]=useState({side:"M\u00fc\u015fteri",name:"",title:"",company:"",department:"",email:"",phone:"",raci:"C",scope:""});
  const [document,setDocument]=useState({name:"",purpose:"",tags:"",url:"",owner:"",version:"1.0"});
  const emptySchedule={name:"",reportType:"project_status",recipients:"",frequency:"weekly",weekday:"1",time:"09:00",timezone:"Europe/Istanbul",enabled:true};
  const [schedule,setSchedule]=useState(emptySchedule);
  const checklist=project.readinessChecklist||createReadinessChecklist();
  const score=readinessScore({...project,readinessChecklist:checklist});
  const threshold=Number(project.readinessThreshold||80);
  const updateItem=(id,data)=>onChange({readinessChecklist:checklist.map(item=>item.id===id?{...item,...data}:item)});
  const addContact=()=>{if(!contact.name.trim())return;onChange({raciContacts:[...(project.raciContacts||[]),{...contact,id:uid()}]});setContact({side:"M\u00fc\u015fteri",name:"",title:"",company:"",department:"",email:"",phone:"",raci:"C",scope:""});};
  const addDocument=()=>{if(!document.name.trim())return;onChange({documents:[...(project.documents||[]),{...document,id:uid(),tags:document.tags.split(",").map(x=>x.trim()).filter(Boolean),createdAt:now()}]});setDocument({name:"",purpose:"",tags:"",url:"",owner:"",version:"1.0"});};
  const addSchedule=()=>{if(!schedule.name.trim()||!schedule.recipients.trim())return;onChange({reportSchedules:[...(project.reportSchedules||[]),{...schedule,id:uid(),recipients:schedule.recipients.split(",").map(x=>x.trim()).filter(Boolean),createdAt:now(),nextRunAt:nextReportRunAt(schedule)}]});setSchedule(emptySchedule);};
  const tabs=[["overview","Özet"],["readiness","Başlangıç Sağlığı"],["training","Eğitimler"],["cost","Proje Maliyeti"],...(isAdmin?[["billing","Fatura Koşulları"]]:[]),["raci","RACI ve Kontaklar"],["access","Uzaktan Erişim"],["machines","Makineler"],...(project.commissioningTracking?[["commissioning","Devreye Alma"]]:[]),["effort","Efor"],["lessons","Öğrenilmiş Dersler"],["documents","Dokümanlar"],["automation","Ayarlar / Rapor"],["ai","AI Proje Yorumu"]];
  return <div style={{flex:1,overflow:"auto",padding:"clamp(14px,3vw,24px)"}}>
    <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:16,background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:6,boxShadow:"0 6px 18px rgba(15,23,42,.04)",scrollbarWidth:"thin"}}>{tabs.map(([id,label])=><button key={id} onClick={()=>setSection(id)} style={{border:0,borderRadius:10,padding:"8px 12px",cursor:"pointer",fontSize:11,fontWeight:850,background:section===id?project.color:"#F8FAFC",color:section===id?"#fff":"#64748B",whiteSpace:"nowrap",flexShrink:0}}>{label}</button>)}</div>
    {section==="overview"&&<ProjectOverviewPanel project={project} onChange={onChange} canEdit={canEdit}/>}
    {section==="readiness"&&<ReadinessPanel project={project} checklist={checklist} score={score} threshold={threshold} canEdit={canEdit} onChange={onChange} updateItem={updateItem}/>}
    {section==="training"&&<TrainingPanel project={project} onChange={onChange} canEdit={canEdit} people={state.people}/>}
    {section==="cost"&&<ProjectCostPanel project={project} onChange={onChange} state={state} canEdit={canEdit}/>}
    {section==="billing"&&isAdmin&&<InvoiceMilestonePanel project={project} onChange={onChange}/>}
    {section==="raci"&&<div>
      <div style={{background:"#EEF2FF",color:"#4338CA",borderRadius:11,padding:"10px 13px",fontSize:11,marginBottom:12}}><b>R</b> yapan, <b>A</b> nihai hesap veren, <b>C</b> görüşü alınan, <b>I</b> bilgilendirilen. Her kapsam için tek bir A belirlenmesi önerilir.</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#fff",fontSize:11}}><thead><tr>{["Taraf","Ad Soyad","Unvan / Departman","RACI","Sorumluluk Kapsam\u0131","Kontak",""].map(x=><th key={x} style={{textAlign:"left",padding:10,background:"#F8FAFC",borderBottom:"1px solid #E2E8F0"}}>{x}</th>)}</tr></thead><tbody>{(project.raciContacts||[]).map(item=><tr key={item.id}><td style={{padding:9}}>{item.side}</td><td style={{padding:9,fontWeight:750}}>{item.name}</td><td style={{padding:9}}>{item.title}{item.department?` / ${item.department}`:""}</td><td style={{padding:9,color:"#4F46E5",fontWeight:850}}>{item.raci}</td><td style={{padding:9}}>{item.scope}</td><td style={{padding:9}}>{item.email}<br/>{item.phone}</td><td>{canEdit&&<button onClick={()=>onChange({raciContacts:(project.raciContacts||[]).filter(x=>x.id!==item.id)})} style={{border:0,background:"transparent",color:"#E11D48",cursor:"pointer"}}>Sil</button>}</td></tr>)}</tbody></table></div>
      {canEdit&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,padding:13,marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}><select style={iStyle} value={contact.side} onChange={e=>setContact({...contact,side:e.target.value})}>{["Bizim Taraf","Müşteri","Partner/Tedarikçi"].map(x=><option key={x}>{x}</option>)}</select>{["name","title","company","department","email","phone","scope"].map(key=><input key={key} style={iStyle} value={contact[key]} onChange={e=>setContact({...contact,[key]:e.target.value})} placeholder={({name:"Ad Soyad",title:"Unvan",company:"Şirket",department:"Departman",email:"E-posta",phone:"Telefon",scope:"Sorumluluk kapsamı"})[key]}/>)}<select style={iStyle} value={contact.raci} onChange={e=>setContact({...contact,raci:e.target.value})}>{["R","A","C","I"].map(x=><option key={x}>{x}</option>)}</select><Btn onClick={addContact}>Kontağı Ekle</Btn></div>}
    </div>}
    {section==="access"&&<RemoteAccessPanel project={project} state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} canManage={canEdit}/>}
    {section==="machines"&&<MachinePanel project={project} canEdit={canEdit} currentUser={currentUser} onChange={machines=>onChange({machines})}/>}
    {section==="commissioning"&&project.commissioningTracking&&<CommissioningPanel project={project} canEdit={canEdit} onChange={commissioningTree=>onChange({commissioningTree})}/>}
    {section==="effort"&&<ProjectEffortPanel project={project} state={state} people={state.people}/>}
    {section==="lessons"&&<LessonsLearnedPanel project={project} onChange={onChange} canEdit={canEdit} currentUser={currentUser}/>}
    {section==="documents"&&<div>
      <div style={{background:"#F0F9FF",color:"#0369A1",borderRadius:11,padding:"10px 13px",fontSize:11,marginBottom:12}}>Dosyanın kendisi yerine şimdilik OneDrive bağlantısı ve metadata saklanır. Microsoft Graph bağlantısı eklendiğinde aynı kayıt modeli doğrudan yüklemeyi destekleyecek.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:9}}>{(project.documents||[]).map(item=><div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:13}}><div style={{display:"flex",justifyContent:"space-between"}}><b>{item.name}</b><span style={{fontSize:9}}>v{item.version}</span></div><div style={{fontSize:11,color:"#64748B",marginTop:5}}>{item.purpose}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:7}}>{(item.tags||[]).map(tag=><span key={tag} style={{background:"#EEF2FF",color:"#4338CA",borderRadius:6,padding:"2px 6px",fontSize:9}}>{tag}</span>)}</div><div style={{display:"flex",gap:9,marginTop:9}}>{item.url&&<a href={item.url} target="_blank" rel="noreferrer" style={{fontSize:10,fontWeight:800,color:"#2563EB"}}>OneDrive'da Aç</a>}{canEdit&&<button onClick={()=>onChange({documents:(project.documents||[]).filter(x=>x.id!==item.id)})} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,cursor:"pointer"}}>Sil</button>}</div></div>)}</div>
      {canEdit&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,padding:13,marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:8}}>{["name","purpose","tags","url","owner","version"].map(key=><input key={key} style={iStyle} value={document[key]} onChange={e=>setDocument({...document,[key]:e.target.value})} placeholder={({name:"Doküman adı",purpose:"Amaç / kategori",tags:"Etiketler (virgüllü)",url:"OneDrive linki",owner:"Doküman sahibi",version:"Versiyon"})[key]}/>)}<Btn onClick={addDocument}>Doküman Ekle</Btn></div>}
    </div>}
    {section==="automation"&&<div>
      <div style={{display:"grid",gap:8}}>{(project.reportSchedules||[]).map(item=><ReportScheduleCard key={item.id} item={item} canEdit={canEdit} onToggle={()=>onChange({reportSchedules:(project.reportSchedules||[]).map(x=>x.id===item.id?{...x,enabled:!x.enabled}:x)})} onDelete={()=>onChange({reportSchedules:(project.reportSchedules||[]).filter(x=>x.id!==item.id)})}/>)}</div>
      {canEdit&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,padding:13,marginTop:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}><input style={iStyle} value={schedule.name} onChange={e=>setSchedule({...schedule,name:e.target.value})} placeholder="Plan adı"/><select style={iStyle} value={schedule.reportType} onChange={e=>setSchedule({...schedule,reportType:e.target.value})}><option value="project_status">Proje Durum Raporu</option><option value="jira_newsletter">Jira Done Newsletter</option></select><input style={iStyle} value={schedule.recipients} onChange={e=>setSchedule({...schedule,recipients:e.target.value})} placeholder="Alıcı e-postaları"/><select style={iStyle} value={schedule.frequency} onChange={e=>setSchedule({...schedule,frequency:e.target.value})}><option value="weekly">Haftalık</option><option value="monthly">Aylık</option></select>{schedule.frequency==="weekly"&&<select style={iStyle} value={schedule.weekday} onChange={e=>setSchedule({...schedule,weekday:e.target.value})}>{["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"].map((day,index)=><option key={day} value={index}>{day}</option>)}</select>}<input type="time" title="Europe/Istanbul saat dilimi" style={iStyle} value={schedule.time} onChange={e=>setSchedule({...schedule,time:e.target.value})}/><Btn onClick={addSchedule}>Planla</Btn></div>}
    </div>}
    {section==="ai"&&<AIWorkspace projects={[project]} initialProjectId={project.id} embedded/>}
  </div>;
}

function ResponsibilityFilterRow({item,index,active,onClick}) {
  const color=COLORS[index%COLORS.length];
  return <button type="button" onClick={onClick} style={{border:"1px solid "+(active?color:"#E2E8F0"),background:active?color+"12":"#fff",borderRadius:9,padding:8,cursor:"pointer",textAlign:"left"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}><b>{item.group}</b><span>%{item.percent}</span></div><div style={{height:7,background:"#F1F5F9",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:item.percent+"%",background:color}}/></div></button>;
}

function ResponsibilitySummary({project,selected=[],onChange}) {
  const items=remainingResponsibility(project);
  const toggle=group=>onChange(selected.includes(group)?selected.filter(item=>item!==group):[...selected,group]);
  return <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,padding:13,marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:9}}><div><div style={{fontSize:12,fontWeight:850}}>Kalan İşin Sorumluluk Dağılımı</div><div style={{fontSize:9,color:"#94A3B8",marginTop:2}}>Bir veya birden fazla ekibe tıklayarak görevleri filtreleyin.</div></div>{selected.length>0&&<button onClick={()=>onChange([])} style={{border:0,background:"#FFF1F2",color:"#BE123C",borderRadius:7,padding:"5px 8px",fontSize:9,fontWeight:800,cursor:"pointer"}}>Filtreyi temizle</button>}</div>{items.length?<div style={{display:"grid",gap:7}}>{items.map((item,index)=><ResponsibilityFilterRow key={item.group} item={item} index={index} active={selected.includes(item.group)} onClick={()=>toggle(item.group)}/>)}</div>:<div style={{fontSize:11,color:"#059669"}}>Kalan görev bulunmuyor.</div>}</div>;
}

function ProjectBusinessCard({project,activePMs,activeStakeholders,contacts,progress,doneT,totalT,currentMs,readiness,commissioningPercent,overdueC,criticalC,canEdit,onChange,onOpenSetup}) {
  const [editing,setEditing]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const fileInput=useRef(null);
  const customer=project.customerProfile||{};
  const location=project.location||{city:"",district:"",address:""};
  const modules=project.activeModules||[];
  const customerName=customer.name||project.customerName||project.name;
  const accent=customer.accentColor||project.color||"#4A6CF7";
  const url=mapsUrl(location);
  const updateCustomer=(data)=>onChange({customerProfile:{...customer,...data}});
  const updateLocation=(key,value)=>onChange({location:{...location,[key]:value}});
  const toggleModule=(module)=>onChange({activeModules:modules.includes(module)?modules.filter(item=>item!==module):[...modules,module]});
  const uploadLogo=(file)=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>updateCustomer({logoUrl:String(reader.result||"")});
    reader.readAsDataURL(file);
  };
  const website=customer.website?customer.website.startsWith("http")?customer.website:`https://${customer.website}`:"";
  return <div style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:"8px clamp(10px,2vw,18px) 8px"}}>
    <div onClick={()=>setExpanded(value=>!value)} style={{position:"relative",overflow:"hidden",borderRadius:16,background:`linear-gradient(135deg,#0F172A 0%,${accent} 58%,#111827 100%)`,color:"#fff",padding:"9px 12px",boxShadow:`0 10px 24px ${accent}24`,cursor:"pointer"}}>
      <div style={{position:"absolute",right:-45,top:-75,width:145,height:145,borderRadius:"50%",background:"rgba(255,255,255,.10)"}}/>
      <div style={{position:"relative",zIndex:1,display:"grid",gridTemplateColumns:"auto minmax(0,1fr) auto",gap:10,alignItems:"center"}}>
        <button type="button" onClick={event=>{event.stopPropagation();canEdit&&fileInput.current?.click();}} title={canEdit?"Logo yükle":"Müşteri logosu"} style={{width:44,height:44,border:0,borderRadius:13,background:"rgba(255,255,255,.18)",display:"grid",placeItems:"center",overflow:"hidden",cursor:canEdit?"pointer":"default",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.24)"}}>
          {customer.logoUrl?<img src={customer.logoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain",background:"#fff",padding:6}}/>:<b style={{fontSize:26,color:"#fff"}}>{customerName.slice(0,2).toUpperCase()}</b>}
        </button>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={event=>uploadLogo(event.target.files?.[0])}/>
        <div style={{minWidth:0}}>
          <h2 style={{margin:0,fontSize:"clamp(19px,2.45vw,25px)",lineHeight:1.08,letterSpacing:"-.02em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#fff",fontWeight:950,textShadow:"0 2px 12px rgba(0,0,0,.75)"}}>{customerName}</h2>
          <div style={{marginTop:5,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",fontSize:10,color:"rgba(255,255,255,.82)",lineHeight:1.35}}>
            {activePMs.length>0&&<span>PM: <b style={{color:"#fff"}}>{activePMs.map(p=>p.name).join(", ")}</b></span>}
            {website&&<a href={website} target="_blank" rel="noreferrer" style={{color:"#fff",textDecoration:"none",fontWeight:850,maxWidth:190,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{customer.website}</a>}
            {expanded&&url&&<a href={url} target="_blank" rel="noreferrer" style={{color:"#fff",textDecoration:"none",fontWeight:850}}>Yol tarifi</a>}
            {expanded&&modules.slice(0,5).map(module=><span key={module}>{module}</span>)}
          </div>
          {expanded&&<div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:8,fontSize:11,color:"rgba(255,255,255,.78)"}}>
            {activeStakeholders.slice(0,3).map(item=><span key={item.id}>{item.role}: <b style={{color:"#fff"}}>{item.person.name}</b></span>)}
            <span>{fmt(project.startDate)} - {fmt(project.endDate)}</span>
            <span>{doneT}/{totalT} görev</span>
            {currentMs&&<span>Aktif: <b style={{color:"#fff"}}>{currentMs.name}</b></span>}
          </div>}
        </div>
        <div style={{display:"grid",gap:2,minWidth:70,justifyItems:"end"}}>
          <b style={{fontSize:18,lineHeight:1}}>{progress}%</b>
          <span style={{fontSize:9,color:"rgba(255,255,255,.75)",fontWeight:850}}>Tamamlama</span>
          {expanded&&canEdit&&<button onClick={event=>{event.stopPropagation();setEditing(value=>!value);}} style={{border:0,background:"#fff",color:accent,borderRadius:9,padding:"5px 8px",fontSize:9,fontWeight:950,cursor:"pointer"}}>{editing?"Kapat":"Düzenle"}</button>}
        </div>
      </div>
      {expanded&&totalT>0&&<div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:9,marginTop:10}}><div style={{flex:1,height:5,background:"rgba(255,255,255,.2)",borderRadius:10,overflow:"hidden"}}><div style={{width:`${progress}%`,height:"100%",background:"#fff",borderRadius:10}}/></div><span style={{fontSize:10,fontWeight:900}}>{progress}%</span></div>}
    </div>
    <button onClick={()=>setExpanded(value=>!value)} title={expanded?"Daralt":"Detayları aç"} style={{display:"grid",placeItems:"center",width:28,height:18,margin:"-2px auto 0",border:0,borderRadius:"0 0 10px 10px",background:"#F1F5F9",color:accent,cursor:"pointer",fontSize:13,fontWeight:950,lineHeight:1}}>{expanded?"⌃":"⌄"}</button>
    {expanded&&<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginTop:7,fontSize:11}}>
      <button onClick={onOpenSetup} style={{border:0,background:readiness>=Number(project.readinessThreshold||80)?"#ECFDF5":"#FFF1F2",color:readiness>=Number(project.readinessThreshold||80)?"#047857":"#BE123C",borderRadius:12,padding:"5px 9px",fontSize:11,fontWeight:850,cursor:"pointer"}}>Başlangıç: {readiness}/100</button>
      {commissioningPercent!==null&&<span style={{background:"#ECFDF5",color:"#047857",borderRadius:12,padding:"5px 9px",fontWeight:850}}>Devreye Alma: %{commissioningPercent}</span>}
      {overdueC>0&&<span style={{background:"#FFF7ED",color:"#EA6C00",borderRadius:12,padding:"5px 9px",fontWeight:850}}>Gecikmiş: {overdueC}</span>}
      {criticalC>0&&<span style={{background:"#FFF1F2",color:"#E11D48",borderRadius:12,padding:"5px 9px",fontWeight:850}}>Kritik: {criticalC}</span>}
      {contacts.slice(0,3).map(contact=><span key={contact.id} style={{background:"#F0F9FF",color:"#0369A1",borderRadius:12,padding:"5px 9px",fontWeight:800}}>{contact.name}{contact.title?` · ${contact.title}`:""}</span>)}
    </div>}
    {expanded&&editing&&canEdit&&<div style={{marginTop:10,background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:16,padding:13,display:"grid",gap:10}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:9}}>
        <Field label="Müşteri Adı"><input style={iStyle} value={customer.name||""} onChange={event=>updateCustomer({name:event.target.value})} placeholder="Firma adı"/></Field>
        <Field label="Web Adresi"><input style={iStyle} value={customer.website||""} onChange={event=>updateCustomer({website:event.target.value})} placeholder="https://firma.com"/></Field>
        <Field label="Logo URL"><input style={iStyle} value={(customer.logoUrl||"").startsWith("data:")?"":customer.logoUrl||""} onChange={event=>updateCustomer({logoUrl:event.target.value})} placeholder="https://.../logo.png"/></Field>
        <Field label="Kart Rengi"><input type="color" style={{...iStyle,padding:4,height:42}} value={accent} onChange={event=>updateCustomer({accentColor:event.target.value})}/></Field>
        <Field label="İl"><input style={iStyle} value={location.city||""} onChange={event=>updateLocation("city",event.target.value)}/></Field>
        <Field label="İlçe"><input style={iStyle} value={location.district||""} onChange={event=>updateLocation("district",event.target.value)}/></Field>
        <Field label="Adres"><input style={iStyle} value={location.address||""} onChange={event=>updateLocation("address",event.target.value)} placeholder="Açık adres"/></Field>
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{DEFAULT_ACTIVE_MODULES.map(module=><button key={module} onClick={()=>toggleModule(module)} style={{border:"1px solid "+(modules.includes(module)?accent:"#E2E8F0"),background:modules.includes(module)?accent+"18":"#fff",color:modules.includes(module)?accent:"#64748B",borderRadius:999,padding:"7px 10px",fontSize:10,fontWeight:850,cursor:"pointer"}}>{module}</button>)}</div>
    </div>}
  </div>;
}

function ProjectListCard({project,people,isAdmin,onOpen,onEdit,onReport,onDelete}) {
  const total=project.milestones.reduce((a,m)=>a+m.tasks.length,0);
  const done=project.milestones.reduce((a,m)=>a+m.tasks.filter(t=>t.status==="Tamamlandı").length,0);
  const progress=total?Math.round(done/total*100):0;
  const overdue=project.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,0);
  const critical=project.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length,0);
  const pms=projectPmIds(project).map(id=>people.find(person=>person.id===id)).filter(Boolean);
  const stakeholders=projectStakeholders(project).map(item=>({...item,person:people.find(person=>person.id===item.userId)})).filter(item=>item.person);
  const activeMs=project.milestones.find(milestone=>milestone.status!=="Tamamlandı");
  const customer=project.customerProfile||{};
  const customerName=customer.name||project.customerName||project.name;
  const accent=customer.accentColor||project.color;
  const website=customer.website?customer.website.startsWith("http")?customer.website:`https://${customer.website}`:"";
  return <div onClick={onOpen}
    style={{background:"#fff",borderRadius:16,border:"1px solid #E2E8F0",cursor:"pointer",boxShadow:"0 2px 6px rgba(0,0,0,0.04)",overflow:"hidden",transition:"box-shadow .15s, transform .15s"}}
    onMouseEnter={event=>{event.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.1)";event.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={event=>{event.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,0.04)";event.currentTarget.style.transform="none";}}>
    <div style={{background:`linear-gradient(135deg,#0F172A 0%,${accent} 62%,#111827 100%)`,color:"#fff",padding:"12px 13px",display:"grid",gridTemplateColumns:"auto minmax(0,1fr) auto",gap:10,alignItems:"center"}}>
      <span style={{width:42,height:42,borderRadius:12,background:"#fff",display:"grid",placeItems:"center",overflow:"hidden",boxShadow:"0 6px 18px rgba(0,0,0,.18)"}}>{customer.logoUrl?<img src={customer.logoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:5}}/>:<b style={{fontSize:16,color:accent}}>{customerName.slice(0,2).toUpperCase()}</b>}</span>
      <span style={{minWidth:0}}><h3 style={{margin:0,fontSize:18,fontWeight:950,lineHeight:1.12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"#fff",textShadow:"0 2px 12px rgba(0,0,0,.75)"}}>{customerName}</h3><span style={{display:"flex",gap:8,marginTop:5,fontSize:10,color:"rgba(255,255,255,.86)",overflow:"hidden"}}>{pms.length>0&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>PM: <b style={{color:"#fff"}}>{pms.map(pm=>pm.name).join(", ")}</b></span>}{website&&<a href={website} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()} style={{color:"#fff",fontWeight:850,textDecoration:"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{customer.website}</a>}</span></span>
      <span style={{fontSize:18,fontWeight:950,textAlign:"right"}}>{progress}%</span>
    </div>
    <div style={{padding:13}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><span style={{fontSize:11,color:"#64748B",fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.name}</span><Badge label={project.status}/></div>
      {activeMs&&<div style={{fontSize:11,color:"#4A6CF7",marginBottom:7,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Aktif: {activeMs.name} - {fmt(activeMs.dueDate)}</div>}
      <div style={{display:"flex",gap:7,marginBottom:8,flexWrap:"wrap"}}>
        <span style={{color:readinessScore(project)>=Number(project.readinessThreshold||80)?"#047857":"#BE123C",fontSize:10,fontWeight:850}}>Başlangıç {readinessScore(project)}/100</span>
        {overdue>0&&<span style={{color:"#EA6C00",fontSize:10,fontWeight:800}}>Gecikmiş: {overdue}</span>}
        {critical>0&&<span style={{color:"#E11D48",fontSize:10,fontWeight:800}}>Kritik: {critical}</span>}
        {stakeholders.slice(0,2).map(item=><span key={item.id} style={{fontSize:10,color:"#64748B"}}>{item.role}: {item.person.name}</span>)}
      </div>
      <div style={{height:4,background:"#F1F5FF",borderRadius:10}}><div style={{width:`${progress}%`,height:"100%",background:accent,borderRadius:10}}/></div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:7}}>
        <div style={{fontSize:11,color:"#64748B"}}>{done}/{total} görev</div>
        {isAdmin&&<div style={{display:"flex",gap:4}}>
          {[["edit","#EEF2FF","#4A6CF7",onEdit,"Düzenle"],["download","#ECFDF5","#059669",onReport,"HTML rapor"],["trash","#FFF1F2","#E11D48",onDelete,"Sil"]].map(([icon,bg,color,action,title])=><button key={icon} title={title} aria-label={title} onClick={event=>{event.stopPropagation();action();}} style={{width:28,height:28,border:0,borderRadius:7,background:bg,color,display:"grid",placeItems:"center",cursor:"pointer"}}><Icon name={icon} size={13}/></button>)}
        </div>}
      </div>
    </div>
  </div>;
}

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
      {active.map(task=><SharedTaskCard key={task.id} task={task} people={people} projectColor={project.color} canEdit={isAdmin} formatDate={fmt} formatFullDate={fmtFull}
        onCheck={(c)=>onCheckTask(milestone.id,task.id,c)}
        onEdit={isAdmin?()=>onEditTask(milestone.id,task):null}
        onDelete={isAdmin?()=>onDeleteTask(milestone.id,task.id):null}
        onTime={()=>onTimeTask(milestone.id,task)}
      />)}
    </div>
    {done.length>0&&<div style={{ marginTop:12 }}>
      <button onClick={()=>setShowDone(v=>!v)} style={{ background:"none", border:"none", cursor:"pointer", fontWeight:700, fontSize:11, color:"#64748B", textTransform:"uppercase", letterSpacing:1, padding:"0 0 7px", display:"flex", alignItems:"center", gap:5 }}>{showDone?"v":">"} Tamamlananlar ({done.length})</button>
      {showDone&&<div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {done.map(task=><SharedTaskCard key={task.id} task={task} people={people} projectColor={project.color} canEdit={isAdmin} formatDate={fmt} formatFullDate={fmtFull}
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
function ProjectNotesPanel({ project, currentUser, state, setState, isAdmin, canManage }) {
  const [section,setSection]=useState("notes");
  // Shared project notes (admin can edit, others view)
  const projNotes = (state.projectNotes||{})[project.id] || { shared:"", items:[] };
  const [editNote, setEditNote] = useState(projNotes.shared);
  const [newItem, setNewItem] = useState("");
  const emptyAccess={name:"",url:"",username:"",status:"Hazır",routing:"",secretReference:"",note:""};
  const [accessForm,setAccessForm]=useState(emptyAccess);
  const accessItems=project.remoteAccess||[];
  const saveAccessItems=(items)=>setState(current=>({...current,projects:current.projects.map(item=>item.id===project.id?{...item,remoteAccess:items}:item)}));
  const addAccess=()=>{
    if(!accessForm.name.trim())return;
    saveAccessItems([...accessItems,{id:uid(),...accessForm,name:accessForm.name.trim(),createdAt:now()}]);
    setAccessForm(emptyAccess);
  };

  const save = (data) => setState(s=>({...s, projectNotes:{...(s.projectNotes||{}), [project.id]:{...projNotes,...data}}}));
  const addItem = () => { if(!newItem.trim())return; save({ items:[...projNotes.items, {id:uid(),text:newItem,done:false,author:currentUser.name,ts:now()}]}); setNewItem(""); };
  const toggleItem = (id) => save({ items:projNotes.items.map(x=>x.id===id?{...x,done:!x.done}:x) });
  const deleteItem = (id) => save({ items:projNotes.items.filter(x=>x.id!==id) });

  // User todos linked to this project
  const linkedTodos=((((state.userNotes||{})[currentUser.id]?.todos)||[]).filter(t=>t.projectId===project.id)).map(t=>({...t,personName:currentUser.name,personAvatar:currentUser.avatar,personAvatarUrl:currentUser.avatarUrl,personIsAdmin:currentUser.isAdmin}));

  return <div style={{ flex:1, overflow:"auto", padding:"clamp(14px, 3vw, 24px)" }}>
    <div style={{display:"flex",gap:7,marginBottom:16}}>
      {[["notes","notes","Notlar"],["todos","ticket","To-Do"]].map(([id,icon,label])=><button key={id} onClick={()=>setSection(id)} style={{border:"none",borderRadius:9,padding:"8px 14px",background:section===id?project.color:"#F1F5FF",color:section===id?"#fff":"#64748B",fontWeight:700,fontSize:12,display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}}><Icon name={icon} size={14}/>{label}</button>)}
    </div>
    {section==="access"&&<div>
      <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:10,padding:"10px 12px",fontSize:11,color:"#9A3412",marginBottom:13}}>Güvenlik nedeniyle gerçek parola burada tutulmaz. “Parola kasası referansı” alanına 1Password, Bitwarden veya kurum kasasındaki kayıt adını yazın.</div>
      {(isAdmin||canManage)&&<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,padding:15,marginBottom:14}}><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:9}}>{[["name","Sistem / Sunucu"],["url","Bağlantı Adresi"],["username","Kullanıcı Adı"],["routing","VPN / Yönlendirme"],["secretReference","Parola Kasası Referansı"]].map(([key,label])=><Field key={key} label={label}><input style={iStyle} value={accessForm[key]} onChange={event=>setAccessForm(current=>({...current,[key]:event.target.value}))}/></Field>)}<Field label="Durum"><select style={iStyle} value={accessForm.status} onChange={event=>setAccessForm(current=>({...current,status:event.target.value}))}>{["Hazır","Test Bekliyor","Erişim Yok","Süresi Doldu"].map(status=><option key={status}>{status}</option>)}</select></Field></div><Field label="Not"><input style={iStyle} value={accessForm.note} onChange={event=>setAccessForm(current=>({...current,note:event.target.value}))}/></Field><div style={{display:"flex",justifyContent:"flex-end"}}><Btn onClick={addAccess}>Erişim Kaydı Ekle</Btn></div></div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(300px,100%),1fr))",gap:10}}>{accessItems.map(item=><div key={item.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:14}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:13}}>{item.name}</b><span style={{fontSize:9,fontWeight:850,color:item.status==="Hazır"?"#047857":"#C2410C",background:item.status==="Hazır"?"#ECFDF5":"#FFF7ED",padding:"3px 6px",borderRadius:7}}>{item.status}</span></div><div style={{fontSize:11,color:"#64748B",lineHeight:1.7,marginTop:8}}>{item.url&&<div>Adres: <b>{item.url}</b></div>}{item.username&&<div>Kullanıcı: <b>{item.username}</b></div>}{item.routing&&<div>Yönlendirme: {item.routing}</div>}{item.secretReference&&<div>Kasa kaydı: <b>{item.secretReference}</b></div>}{item.note&&<div>Not: {item.note}</div>}</div>{(isAdmin||canManage)&&<button onClick={()=>confirm("Erişim kaydı silinsin mi?")&&saveAccessItems(accessItems.filter(entry=>entry.id!==item.id))} style={{marginTop:8,border:0,background:"transparent",color:"#E11D48",fontSize:10,cursor:"pointer"}}>Sil</button>}</div>)}</div>
      {!accessItems.length&&<div style={{padding:35,textAlign:"center",border:"1px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Uzaktan erişim kaydı bulunmuyor.</div>}
    </div>}
    {section!=="access"&&<>
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
      <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>{section==="notes"?"Ekip Notları":"Kişisel To-Do Bağlantılarım"}</div>
      {section==="todos"&&<div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E2E8F0", padding:"16px" }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#64748B" }}>Bu projeye bağlı todo ları</div>
        {linkedTodos.length===0&&<div style={{ fontSize:12, color:"#94A3B8" }}>Henüz bağlı kişisel todo yok.<br/>Görevlerim sayfasından todo eklerken proje seçin.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {linkedTodos.map(t=><div key={t.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"9px 11px", background:"#F8FAFC", borderRadius:8, border:"1.5px solid #E2E8F0" }}>
            <Avatar initials={t.personAvatar} imageUrl={t.personAvatarUrl} size={22} color={t.personIsAdmin?"#E11D48":"#4A6CF7"} />
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
              <Avatar initials={p.avatar} imageUrl={p.avatarUrl} size={18} color={p.isAdmin?"#E11D48":"#4A6CF7"} />
              <span style={{ fontSize:11, fontWeight:700 }}>{p.name}</span>
            </div>
            <div style={{ fontSize:11, color:"#64748B", whiteSpace:"pre-wrap", lineHeight:1.5 }}>{note}</div>
          </div>;
        })}
        {state.people.every(p=>!((state.userNotes||{})[p.id]?.notes))&&<div style={{ fontSize:12, color:"#94A3B8" }}>Ekip notu yok.</div>}
      </div>}
    </div>
    </div>
    </>}
  </div>;
}

function ProjectActionsPanel({project,currentUser,state,setState,isAdmin,canManage}) {
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
    {canManage&&showActionForm&&<div style={{background:"#fff",border:"1.5px solid #C7D2FE",borderRadius:14,padding:16,marginBottom:17,boxShadow:"0 7px 22px #4f46e512",order:1}}>
      <div style={{display:"grid",gridTemplateColumns:"minmax(190px,260px) 1fr",gap:10,alignItems:"end",marginBottom:10}}><Field label="Aksiyon Türü"><select style={iStyle} value={selectedTag} onChange={e=>setSelectedTag(e.target.value)}>{actionTags.map(tag=><option key={tag}>{tag}</option>)}</select></Field><div style={{display:"flex",gap:7,alignItems:"flex-end"}}><Field label="Yeni tür ekle"><input style={iStyle} value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="Örn. Eğitim"/></Field><Btn small variant="secondary" onClick={addTag}>Ekle</Btn></div></div>
      <Field label="Aksiyon"><textarea style={{...iStyle,minHeight:82,resize:"vertical",lineHeight:1.5}} value={text} onChange={e=>setText(e.target.value)} placeholder="Örn. Müşteriyle görüştüm, revize teklif mailini ilettim. Teknik ekipten dönüş bekliyorum."/></Field>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:10,flexWrap:"wrap"}}><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><div style={{width:230}}><Field label="Aksiyon Tarihi"><input type="datetime-local" style={iStyle} value={actionAt} onChange={e=>setActionAt(e.target.value)}/></Field></div><div style={{width:170}}><Field label="Efor (Saat, isteğe bağlı)"><input type="number" min="0" step="0.25" style={iStyle} value={effortHours} onChange={e=>setEffortHours(e.target.value)} placeholder="Örn. 1.5"/></Field></div></div><div style={{display:"flex",gap:7,marginBottom:13}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId(null);setText("");setEffortHours("");setActionAt(new Date().toISOString().slice(0,16));}}>İptal</Btn>}<Btn disabled={!text.trim()} onClick={submit}>{editingId?"Aksiyonu Güncelle":"Aksiyon Ekle"}</Btn></div></div>
    </div>}
    {!canManage&&<div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 13px",fontSize:11,color:"#64748B",marginBottom:14,order:1}}>Aksiyon ekleme yetkisi proje yöneticileri ve sistem yöneticilerindedir.</div>}
    <div style={{position:"relative",paddingLeft:24,order:2,marginBottom:16}}>
      <div style={{position:"absolute",left:7,top:8,bottom:8,width:2,background:"#E2E8F0"}}/>
      {shown.map(item=>{const canEdit=!["field_visit","lesson"].includes(item.source)&&(isAdmin||item.authorId===currentUser.id);return <div key={item.id} style={{position:"relative",background:"#fff",border:`1.5px solid ${item.source==="field_visit"?"#A7F3D0":item.source==="lesson"?"#DDD6FE":"#E2E8F0"}`,borderRadius:12,padding:"13px 15px",marginBottom:10}}>
        <span style={{position:"absolute",left:-22,top:18,width:12,height:12,borderRadius:"50%",background:item.source==="field_visit"?"#059669":project.color,border:"3px solid #F8FAFC"}}/>
        <span style={{display:"inline-block",fontSize:9,fontWeight:850,color:item.source==="field_visit"?(item.completed?"#047857":"#0369A1"):"#4338CA",background:item.source==="field_visit"?(item.completed?"#ECFDF5":"#F0F9FF"):"#EEF2FF",borderRadius:6,padding:"3px 6px",marginBottom:7}}>{item.source==="field_visit"?(item.plan?.workType==="remote"?(item.completed?"UZAKTAN ÇALIŞMA":"UZAKTAN PLAN"):(item.completed?"SAHA ZİYARETİ":"SAHA PLANI")):(item.tag||"Diğer").toLocaleUpperCase("tr-TR")}</span>
        <div style={{fontSize:13,color:"#1E293B",lineHeight:1.55,whiteSpace:"pre-wrap"}}>{item.text}</div>
        {item.source!=="field_visit"&&Number(item.effortHours)>0&&<span style={{display:"inline-block",marginTop:8,background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"3px 7px",fontSize:10,fontWeight:800}}>Efor: {item.effortHours} saat</span>}
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginTop:9,fontSize:10,color:"#94A3B8"}}><span style={{fontWeight:700,color:"#64748B"}}>{item.authorName}</span><span>·</span><span>{new Date(item.actionAt||item.createdAt).toLocaleString("tr-TR")}</span>{item.updatedAt&&<span>· Düzenlendi</span>}{item.source==="field_visit"&&(isAdmin||item.authorId===currentUser.id)&&<button onClick={()=>setVisitPlan(item.plan)} style={{marginLeft:"auto",border:0,background:"#ECFDF5",color:"#047857",borderRadius:7,padding:"5px 8px",fontSize:9,fontWeight:850,cursor:"pointer"}}>{item.completed?"Ziyaret ve eforu düzenle":"Not ve efor gir"}</button>}{canEdit&&<span style={{marginLeft:item.source==="field_visit"?0:"auto",display:"flex",gap:8}}><button onClick={()=>edit(item)} style={{border:0,background:"transparent",color:"#4A6CF7",fontSize:10,fontWeight:700,cursor:"pointer"}}>Düzenle</button><button onClick={()=>confirm("Aksiyon silinsin mi?")&&remove(item.id)} style={{border:0,background:"transparent",color:"#E11D48",fontSize:10,fontWeight:700,cursor:"pointer"}}>Sil</button></span>}</div>
      </div>})}
      {!shown.length&&<div style={{padding:38,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8",fontSize:12}}>Henüz proje aksiyonu kaydedilmedi.</div>}
    </div>
    {personalTodos.length>0&&<div style={{background:"#FDF2F8",border:"1px solid #FBCFE8",borderRadius:13,padding:13,marginBottom:14,order:3}}><div style={{fontSize:11,fontWeight:850,color:"#BE185D",marginBottom:8}}>BU PROJEYE BAĞLI KİŞİSEL TO-DO'LARIM</div><div style={{display:"grid",gap:7}}>{personalTodos.map(todo=><div key={todo.id} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:9,padding:"8px 10px"}}><span style={{fontSize:11,fontWeight:700,flex:1}}>{todo.action||todo.text}</span><input type="number" min="0" step=".25" title="Efor saati" value={todoEfforts[todo.id]||""} onChange={event=>setTodoEfforts(current=>({...current,[todo.id]:event.target.value}))} placeholder="Efor" style={{...iStyle,width:75,padding:"5px 7px",fontSize:10}}/><button onClick={()=>sendTodoToActions(todo)} style={{border:0,background:"#DB2777",color:"#fff",borderRadius:7,padding:"6px 8px",fontSize:9,fontWeight:800,cursor:"pointer"}}>Aksiyona Gönder</button></div>)}</div></div>}
    {visitPlan&&<FieldVisitModal plan={visitPlan} project={project} currentUser={currentUser} onClose={()=>setVisitPlan(null)} onSave={data=>{setState(s=>({...s,fieldPlans:(s.fieldPlans||[]).map(plan=>plan.id===visitPlan.id?{...plan,...data,status:"completed",completedAt:plan.completedAt||now(),updatedAt:now()}:plan)}));setVisitPlan(null);}}/>}
  </div>;
}

function MachinePanel({ project, canEdit, currentUser, onChange }) {
  const machines=project.machines||[];
  const [showForm,setShowForm]=useState(false);
  const [editingId,setEditingId]=useState("");
  const [viewMode,setViewMode]=useState("cards");
  const [search,setSearch]=useState("");
  const [controlDrafts,setControlDrafts]=useState({});
  const blankMachineForm={name:"",code:"",type:"physical",ip:"",osModel:"",extraLicense:"",serialNo:"",location:"",dataSource:"",protocol:"",responsible:"",processParameters:"",commissioned:false,commissionedAt:"",note:""};
  const [form,setForm]=useState(blankMachineForm);
  const fileRef=useRef(null);
  const commissioned=machines.filter(m=>m.commissioned).length;
  const visibleMachines=machines.filter(machine=>`${machine.name||""} ${machine.code||""} ${machine.ip||""} ${machine.osModel||""} ${machine.extraLicense||""} ${machine.serialNo||""} ${machine.location||""} ${machine.dataSource||""} ${machine.protocol||""} ${machine.processParameters||""}`.toLocaleLowerCase("tr-TR").includes(search.trim().toLocaleLowerCase("tr-TR")));
  const commissionedMachines=visibleMachines.filter(machine=>machine.commissioned);
  const copyIp=async(ip)=>{if(!ip)return;try{await navigator.clipboard.writeText(ip);}catch{prompt("IP adresi",ip);}};
  const save=()=>{
    if(!form.name.trim())return;
    const saved={...form,name:form.name.trim(),code:form.code.trim(),ip:form.ip.trim(),osModel:form.osModel.trim(),extraLicense:form.extraLicense.trim(),serialNo:form.serialNo.trim(),location:form.location.trim(),dataSource:form.dataSource.trim(),protocol:form.protocol.trim(),responsible:form.responsible.trim(),processParameters:form.processParameters.trim(),commissionedAt:form.commissioned?(form.commissionedAt||todayStr()):""};
    onChange(editingId?machines.map(machine=>machine.id===editingId?{...machine,...saved}:machine):[...machines,{...saved,id:uid()}]);
    setForm(blankMachineForm);
    setEditingId("");
    setShowForm(false);
  };
  const edit=machine=>{setEditingId(machine.id);setForm({name:machine.name||"",code:machine.code||"",type:machine.type||"physical",ip:machine.ip||"",osModel:machine.osModel||"",extraLicense:machine.extraLicense||"",serialNo:machine.serialNo||"",location:machine.location||"",dataSource:machine.dataSource||"",protocol:machine.protocol||"",responsible:machine.responsible||"",processParameters:machine.processParameters||"",commissioned:Boolean(machine.commissioned),commissionedAt:machine.commissionedAt||"",note:machine.note||""});setShowForm(true);};
  const update=(id,data)=>onChange(machines.map(m=>m.id===id?{...m,...data}:m));
  const exportExcel=()=>downloadXlsx([["Makine Kodu","Makine Adı","Seri No","Lokasyon","IP","İşletim Sistemi/Model","Veri Kaynağı","Protokol","Proses Parametreleri","Ek Lisans","Sorumlu","Tip","Devreye Alındı","Perfect Veri","Son Kontrol","Son Kontrol Nedenleri","Devreye Alma Tarihi","Açıklama"],...machines.map(machine=>{const last=(machine.controlHistory||[])[0]||{};return [machine.code||"",machine.name,machine.serialNo||"",machine.location||"",machine.ip||"",machine.osModel||"",machine.dataSource||"",machine.protocol||"",machine.processParameters||"",machine.extraLicense||"",machine.responsible||"",machine.type==="virtual"?"Sanal":"Fiziksel",machine.commissioned?"Evet":"Hayır",machine.lastPerfectData?"Evet":"Hayır",machine.lastControlAt||"",((last.reasons||[]).join(", ")),machine.commissionedAt||"",machine.note||""]})],`${safeFileName(project.name)}-makineler.xlsx`,"Makineler");
  const addMachineCheck=(machine,perfectData,note="")=>{
    const draft=controlDrafts[machine.id]||{};
    const check={id:uid(),ts:now(),userId:currentUser?.id||"",userName:currentUser?.name||"",perfectData,reasons:perfectData?[]:(draft.reasons||[]),note:note||draft.note||"",resolved:Boolean(draft.resolved)};
    update(machine.id,{lastPerfectData:perfectData,lastControlAt:check.ts,controlHistory:[check,...(machine.controlHistory||[])]});
    setControlDrafts(current=>({...current,[machine.id]:{reasons:[],note:"",resolved:false}}));
  };
  const importExcel=(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const workbook=XLSX.read(reader.result,{type:"array"});
        const data=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
        const imported=data.map(item=>({id:uid(),code:String(item["Makine Kodu"]||"").trim(),name:String(item["Makine Adı"]||item["Makine Adi"]||"").trim(),serialNo:String(item["Seri No"]||"").trim(),location:String(item.Lokasyon||"").trim(),ip:String(item.IP||item.Ip||"").trim(),osModel:String(item["İşletim Sistemi/Model"]||item["Isletim Sistemi/Model"]||item.Model||"").trim(),dataSource:String(item["Veri Kaynağı"]||item["Veri Kaynagi"]||"").trim(),protocol:String(item.Protokol||"").trim(),processParameters:String(item["Proses Parametreleri"]||"").trim(),extraLicense:String(item["Ek Lisans"]||"").trim(),responsible:String(item.Sorumlu||"").trim(),type:String(item.Tip||"").toLocaleLowerCase("tr-TR")==="sanal"?"virtual":"physical",commissioned:["evet","true","1"].includes(String(item["Devreye Alındı"]||item["Devreye Alindi"]||"").toLocaleLowerCase("tr-TR")),lastPerfectData:["evet","true","1"].includes(String(item["Perfect Veri"]||"").toLocaleLowerCase("tr-TR")),lastControlAt:String(item["Son Kontrol"]||""),commissionedAt:String(item["Devreye Alma Tarihi"]||""),note:String(item["Açıklama"]||item.Aciklama||"")})).filter(machine=>machine.name);
        onChange([...machines,...imported]);
      }catch(error){alert(`Excel okunamadı: ${error.message}`);}
      event.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };
  return <div style={{flex:1,overflow:"auto",padding:"clamp(14px, 3vw, 24px)"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <div><h3 style={{margin:0,fontSize:16,display:"flex",alignItems:"center",gap:7}}><Icon name="machines" size={18}/>Makine Devreye Alma</h3><div style={{fontSize:12,color:"#64748B",marginTop:3}}>{commissioned}/{machines.length} makine devrede</div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Btn variant="secondary" onClick={exportExcel}>Excel Dışa Aktar</Btn>{canEdit&&<><Btn variant="secondary" onClick={()=>fileRef.current?.click()}>Excel İçe Aktar</Btn><input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importExcel}/><Btn onClick={()=>{setEditingId("");setForm(blankMachineForm);setShowForm(v=>!v);}}>{showForm?"Formu Kapat":"+ Makine Ekle"}</Btn></>}</div>
    </div>
    <div style={{height:8,background:"#E2E8F0",borderRadius:8,marginBottom:16,overflow:"hidden"}}><div style={{height:"100%",width:`${machines.length?commissioned/machines.length*100:0}%`,background:"#059669"}} /></div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
      <input style={{...iStyle,width:260,maxWidth:"100%"}} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Makine adı, kodu, IP veya OS/model ara..."/>
      <div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>
        {[["cards","Kutucuk"],["list","Liste"],["control","Kontrol"]].map(([id,label])=><button key={id} onClick={()=>setViewMode(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontWeight:800,fontSize:11,background:viewMode===id?"#fff":"transparent",color:viewMode===id?"#4A6CF7":"#64748B"}}>{label}</button>)}
      </div>
    </div>
    {showForm&&<div style={{background:"#fff",border:"1.5px solid #DCE6F2",borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Makine Adı *"><input style={iStyle} value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} /></Field><Field label="Kod / Hat No"><input style={iStyle} value={form.code} onChange={e=>setForm(s=>({...s,code:e.target.value}))} /></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Seri No"><input style={iStyle} value={form.serialNo} onChange={e=>setForm(s=>({...s,serialNo:e.target.value}))}/></Field><Field label="Lokasyon"><input style={iStyle} value={form.location} onChange={e=>setForm(s=>({...s,location:e.target.value}))} placeholder="Hat / pano / alan"/></Field><Field label="IP Adresi"><input style={iStyle} value={form.ip} onChange={e=>setForm(s=>({...s,ip:e.target.value}))} placeholder="Örn. 192.168.1.10"/></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="İşletim Sistemi / Model"><input style={iStyle} value={form.osModel} onChange={e=>setForm(s=>({...s,osModel:e.target.value}))} placeholder="Örn. Windows Server / IPC model"/></Field><Field label="Veri Kaynağı"><input style={iStyle} value={form.dataSource} onChange={e=>setForm(s=>({...s,dataSource:e.target.value}))} placeholder="PLC, OPC, API..."/></Field><Field label="Protokol"><input style={iStyle} value={form.protocol} onChange={e=>setForm(s=>({...s,protocol:e.target.value}))} placeholder="OPC UA, Modbus, SQL..."/></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Ek Lisans"><input style={iStyle} value={form.extraLicense} onChange={e=>setForm(s=>({...s,extraLicense:e.target.value}))} placeholder="Örn. OPC, historian, runtime"/></Field><Field label="Sorumlu"><input style={iStyle} value={form.responsible} onChange={e=>setForm(s=>({...s,responsible:e.target.value}))}/></Field></div>
      <Field label="Alınabilen Proses Parametreleri"><textarea style={{...iStyle,height:74,resize:"vertical"}} value={form.processParameters} onChange={e=>setForm(s=>({...s,processParameters:e.target.value}))} placeholder="Örn. adet, duruş kodu, hız, sıcaklık, alarm..."/></Field>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10}}><Field label="Makine Tipi"><select style={iStyle} value={form.type} onChange={e=>setForm(s=>({...s,type:e.target.value}))}><option value="physical">Fiziksel</option><option value="virtual">Sanal</option></select></Field><Field label="Devreye Alma Tarihi"><input type="date" style={iStyle} value={form.commissionedAt} onChange={e=>setForm(s=>({...s,commissionedAt:e.target.value}))} /></Field></div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:13}}><input type="checkbox" checked={form.commissioned} onChange={e=>setForm(s=>({...s,commissioned:e.target.checked}))} /> Devreye alındı</label>
      <Field label="Devreye Alınamama Açıklaması / Not"><textarea style={{...iStyle,height:70,resize:"vertical"}} value={form.note} onChange={e=>setForm(s=>({...s,note:e.target.value}))} /></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}>{editingId&&<Btn variant="ghost" onClick={()=>{setEditingId("");setShowForm(false);}}>İptal</Btn>}<Btn onClick={save}>{editingId?"Değişiklikleri Kaydet":"Makineyi Kaydet"}</Btn></div>
    </div>}
    {!machines.length&&<div style={{padding:40,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Henüz makine eklenmedi.</div>}
    {viewMode==="list"&&<div style={{overflowX:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:13,marginBottom:12}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1100}}><thead><tr>{["Makine","Kod","Seri/Lokasyon","OS/Model","IP","Veri Kaynağı","Protokol","Perfect Veri","Tip","Durum",""].map(label=><th key={label} style={{padding:"10px 9px",fontSize:10,color:"#64748B",background:"#F8FAFC",textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{visibleMachines.map(machine=><tr key={machine.id} style={{borderTop:"1px solid #EEF2F7"}}><td style={{padding:9,fontSize:11,fontWeight:850}}>{machine.name}</td><td style={{padding:9,fontSize:11,color:"#64748B"}}>{machine.code||"-"}</td><td style={{padding:9,fontSize:10,color:"#64748B"}}>{machine.serialNo||"-"}{machine.location?` · ${machine.location}`:""}</td><td style={{padding:9,fontSize:11,color:"#475569"}}>{machine.osModel||"-"}</td><td style={{padding:9,fontSize:11}}>{machine.ip?<button onClick={()=>copyIp(machine.ip)} title="IP kopyala" style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"5px 8px",fontSize:10,fontWeight:850,cursor:"pointer"}}>{machine.ip}</button>:"-"}</td><td style={{padding:9,fontSize:11,color:"#475569"}}>{machine.dataSource||"-"}</td><td style={{padding:9,fontSize:11,color:"#475569"}}>{machine.protocol||"-"}</td><td style={{padding:9,fontSize:11,color:machine.lastPerfectData?"#059669":"#EA6C00",fontWeight:850}}>{machine.lastControlAt?(machine.lastPerfectData?"Evet":"Hayır"):"Kontrol yok"}</td><td style={{padding:9,fontSize:11}}>{machine.type==="virtual"?"Sanal":"Fiziksel"}</td><td style={{padding:9,fontSize:11,color:machine.commissioned?"#059669":"#EA6C00",fontWeight:850}}>{machine.commissioned?"Devrede":"Bekliyor"}</td><td style={{padding:9}}>{canEdit&&<div style={{display:"flex",gap:6}}><Btn small variant="secondary" onClick={()=>edit(machine)}>Düzenle</Btn><Btn small variant="danger" onClick={()=>onChange(machines.filter(m=>m.id!==machine.id))}>Sil</Btn></div>}</td></tr>)}</tbody></table>{!visibleMachines.length&&<div style={{padding:24,textAlign:"center",fontSize:12,color:"#94A3B8"}}>Aramaya uygun makine bulunamadı.</div>}</div>}
    {viewMode==="control"&&<div style={{display:"grid",gap:10,marginBottom:12}}>
      <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:13,padding:12,fontSize:12,color:"#3730A3",lineHeight:1.5}}>Devredeki makineleri saha kontrolü sırasında hızlıca işaretleyin. Her işaretleme makinenin kontrol geçmişine kaydedilir.</div>
      {commissionedMachines.map(machine=>{const last=(machine.controlHistory||[])[0];const draft=controlDrafts[machine.id]||{reasons:[],note:"",resolved:false};const setDraft=data=>setControlDrafts(current=>({...current,[machine.id]:{...draft,...data}}));return <div key={machine.id} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:14,padding:13}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
          <div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:900,wordBreak:"break-word"}}>{machine.name}</div><div style={{fontSize:10,color:"#64748B",marginTop:3}}>{machine.code||"Kod yok"}{machine.ip?` · ${machine.ip}`:""}{machine.dataSource?` · ${machine.dataSource}`:""}</div></div>
          <label style={{display:"inline-flex",alignItems:"center",gap:8,background:machine.lastPerfectData?"#ECFDF5":"#FFF7ED",color:machine.lastPerfectData?"#047857":"#EA6C00",borderRadius:10,padding:"8px 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}><input type="checkbox" checked={Boolean(machine.lastPerfectData)} onChange={event=>addMachineCheck(machine,event.target.checked)}/> Perfect veri alıyor</label>
        </div>
        <div style={{marginTop:10,display:"grid",gap:8}}>
          {!machine.lastPerfectData&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{MACHINE_CONTROL_REASONS.map(reason=><button key={reason} onClick={()=>setDraft({reasons:draft.reasons.includes(reason)?draft.reasons.filter(item=>item!==reason):[...draft.reasons,reason]})} style={{border:"1px solid "+(draft.reasons.includes(reason)?"#E11D48":"#E2E8F0"),background:draft.reasons.includes(reason)?"#FFF1F2":"#fff",color:draft.reasons.includes(reason)?"#BE123C":"#475569",borderRadius:999,padding:"5px 8px",fontSize:9,fontWeight:850,cursor:"pointer"}}>{reason}</button>)}</div>}
          {!machine.lastPerfectData&&<label style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:11,fontWeight:850,color:"#047857",background:"#ECFDF5",borderRadius:9,padding:"7px 9px",width:"fit-content"}}><input type="checkbox" checked={Boolean(draft.resolved)} onChange={event=>setDraft({resolved:event.target.checked})}/> Çözüldü</label>}
          <textarea style={{...iStyle,minHeight:58,fontSize:11,resize:"vertical"}} value={draft.note||""} onChange={event=>setDraft({note:event.target.value})} placeholder="Serbest kontrol notu / gözlem..."/>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button onClick={()=>addMachineCheck(machine,Boolean(machine.lastPerfectData))} style={{border:0,background:"#F1F5F9",color:"#475569",borderRadius:8,padding:"7px 9px",fontSize:10,fontWeight:850,cursor:"pointer"}}>Notlu Kontrolü Kaydet</button>{last&&<span style={{fontSize:10,color:"#64748B",alignSelf:"center"}}>Son kontrol: {new Date(last.ts).toLocaleString("tr-TR")} · {last.userName||"Kullanıcı"} · {last.perfectData?"Perfect":"Sorun var"}</span>}</div>
        </div>
        {(machine.controlHistory||[]).length>0&&<div style={{marginTop:10,borderTop:"1px solid #EEF2F7",paddingTop:8,display:"grid",gap:5}}>{(machine.controlHistory||[]).slice(0,4).map(item=><div key={item.id} style={{fontSize:10,color:"#64748B",display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><span>{new Date(item.ts).toLocaleString("tr-TR")} · {item.userName||"Kullanıcı"}</span><b style={{color:item.perfectData?"#059669":item.resolved?"#047857":"#E11D48"}}>{item.perfectData?"Perfect veri":item.resolved?"Sorun çözüldü":"Sorun / eksik veri"}</b>{(item.reasons||[]).length>0&&<span style={{flexBasis:"100%",color:"#BE123C",fontWeight:800}}>{item.reasons.join(", ")}</span>}{item.note&&<span style={{flexBasis:"100%",color:"#475569"}}>{item.note}</span>}</div>)}</div>}
      </div>;})}
      {!commissionedMachines.length&&<div style={{padding:34,textAlign:"center",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Kontrol edilecek devrede makine bulunamadı.</div>}
    </div>}
    <div style={{display:viewMode==="cards"?"grid":"none",gridTemplateColumns:"repeat(auto-fit,minmax(min(240px,100%),1fr))",gap:10}}>
      {visibleMachines.map(machine=><div key={machine.id} style={{background:"#fff",borderRadius:12,padding:14,border:`1.5px solid ${machine.commissioned?"#A7F3D0":"#FED7AA"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}><div><div style={{fontWeight:800,fontSize:13}}>{machine.name}</div><div style={{fontSize:11,color:"#64748B",marginTop:2}}>{machine.code||"Kod yok"} · {machine.type==="virtual"?"Sanal":"Fiziksel"}</div></div><span style={{background:machine.commissioned?"#ECFDF5":"#FFF7ED",color:machine.commissioned?"#059669":"#EA6C00",padding:"3px 8px",borderRadius:8,fontSize:10,fontWeight:800}}>{machine.commissioned?"DEVREDE":"BEKLİYOR"}</span></div>
        {(machine.ip||machine.osModel||machine.dataSource||machine.protocol||machine.location)&&<div style={{display:"grid",gap:3,marginTop:9,fontSize:10,color:"#64748B",lineHeight:1.35}}>
          {machine.ip&&<span>IP: <b style={{color:"#334155"}}>{machine.ip}</b></span>}
          {machine.osModel&&<span>OS/Model: {machine.osModel}</span>}
          {machine.dataSource&&<span>Veri: {machine.dataSource}{machine.protocol?` · ${machine.protocol}`:""}</span>}
          {machine.location&&<span>Lokasyon: {machine.location}</span>}
        </div>}
        {machine.lastControlAt&&<div style={{fontSize:10,color:machine.lastPerfectData?"#059669":"#E11D48",fontWeight:850,marginTop:8}}>Son kontrol: {machine.lastPerfectData?"Perfect veri":"Sorun var"} · {new Date(machine.lastControlAt).toLocaleDateString("tr-TR")}</div>}
        {machine.commissionedAt&&<div style={{fontSize:11,color:"#64748B",marginTop:9}}>Devreye alma: {fmt(machine.commissionedAt)}</div>}
        {!machine.commissioned&&<textarea disabled={!canEdit} value={machine.note||""} onChange={e=>update(machine.id,{note:e.target.value})} placeholder="Neden devreye alınamadı?" style={{...iStyle,height:58,resize:"vertical",marginTop:9,fontSize:11}} />}
        {canEdit&&<div style={{display:"flex",justifyContent:"space-between",marginTop:10,gap:6,flexWrap:"wrap"}}><Btn small variant={machine.commissioned?"warning":"success"} onClick={()=>update(machine.id,{commissioned:!machine.commissioned,commissionedAt:!machine.commissioned?todayStr():""})}>{machine.commissioned?"Devreden Çıkar":"Devreye Al"}</Btn><div style={{display:"flex",gap:6}}><Btn small variant="secondary" onClick={()=>edit(machine)}>Düzenle</Btn><Btn small variant="danger" onClick={()=>onChange(machines.filter(m=>m.id!==machine.id))}>Sil</Btn></div></div>}
      </div>)}
    </div>
  </div>;
}

const COMMISSIONING_LEVELS = [
  { label:"Sektör", childKey:"productionCenters", childLabel:"Üretim Merkezi" },
  { label:"Üretim Merkezi", childKey:"workplaces", childLabel:"İşyeri" },
  { label:"İşyeri", childKey:"lines", childLabel:"Hat" },
  { label:"Hat", childKey:"machines", childLabel:"Makine" },
];
const commissioningRows=(sectors=[])=>sectors.flatMap(sector=>(sector.productionCenters||[]).flatMap(center=>(center.workplaces||[]).flatMap(workplace=>(workplace.lines||[]).flatMap(line=>(line.machines||[]).map(machine=>({sector:sector.name,productionCenter:center.name,workplace:workplace.name,line:line.name,machine}))))));
const commissioningTreeFromRows=(rows=[])=>{
  const sectors=[];
  const getOrCreate=(list,name,childKey)=>{
    let item=list.find(entry=>entry.name===name);
    if(!item){item={id:uid(),name,[childKey]:[]};list.push(item);}
    return item;
  };
  rows.forEach(row=>{
    if(!row.sector||!row.productionCenter||!row.workplace||!row.line||!row.machine?.name)return;
    const sector=getOrCreate(sectors,row.sector,"productionCenters");
    const center=getOrCreate(sector.productionCenters,row.productionCenter,"workplaces");
    const workplace=getOrCreate(center.workplaces,row.workplace,"lines");
    const line=getOrCreate(workplace.lines,row.line,"machines");
    line.machines.push({id:uid(),code:"",type:"physical",commissioned:false,commissionedAt:"",note:"",...row.machine});
  });
  return sectors;
};
const updateCommissioningNodes=(nodes,id,updater,level=0)=>(nodes||[]).map(node=>{
  if(node.id===id)return updater(node);
  const childKey=COMMISSIONING_LEVELS[level]?.childKey;
  return childKey&&node[childKey]?{...node,[childKey]:updateCommissioningNodes(node[childKey],id,updater,level+1)}:node;
});
const removeCommissioningNode=(nodes,id,level=0)=>(nodes||[]).filter(node=>node.id!==id).map(node=>{
  const childKey=COMMISSIONING_LEVELS[level]?.childKey;
  return childKey&&node[childKey]?{...node,[childKey]:removeCommissioningNode(node[childKey],id,level+1)}:node;
});

function CommissioningPanel({ project, canEdit, onChange }) {
  const sectors=project.commissioningTree||[];
  const [filter,setFilter]=useState("all");
  const [showForm,setShowForm]=useState(false);
  const [editingMachineId,setEditingMachineId]=useState("");
  const [form,setForm]=useState({sector:"",productionCenter:"",workplace:"",line:"",name:"",code:"",type:"physical",commissioned:false,note:""});
  const fileRef=useRef(null);
  const machines=commissioningMachines(sectors);
  const rows=commissioningRows(sectors);
  const commissioned=machines.filter(machine=>machine.commissioned).length;
  const physical=machines.filter(machine=>machine.type!=="virtual").length;
  const virtual=machines.filter(machine=>machine.type==="virtual").length;
  const percent=machines.length?Math.round(commissioned/machines.length*100):0;
  const update=(id,updater)=>onChange(updateCommissioningNodes(sectors,id,updater));
  const remove=(id)=>onChange(removeCommissioningNode(sectors,id));
  const visibleRows=rows.filter(row=>filter==="all"||(filter==="done"?row.machine.commissioned:!row.machine.commissioned));
  const addMachine=()=>{
    if(!form.sector.trim()||!form.productionCenter.trim()||!form.workplace.trim()||!form.line.trim()||!form.name.trim())return;
    const machine={id:editingMachineId||uid(),name:form.name.trim(),code:form.code.trim(),type:form.type,commissioned:form.commissioned,commissionedAt:form.commissioned?(rows.find(row=>row.machine.id===editingMachineId)?.machine.commissionedAt||todayStr()):"",note:form.note.trim()};
    const nextRows=[...rows.filter(row=>row.machine.id!==editingMachineId),{sector:form.sector.trim(),productionCenter:form.productionCenter.trim(),workplace:form.workplace.trim(),line:form.line.trim(),machine}];
    onChange(commissioningTreeFromRows(nextRows));
    setForm({sector:"",productionCenter:"",workplace:"",line:"",name:"",code:"",type:"physical",commissioned:false,note:""});
    setEditingMachineId("");
    setShowForm(false);
  };
  const editMachine=row=>{setEditingMachineId(row.machine.id);setForm({sector:row.sector,productionCenter:row.productionCenter,workplace:row.workplace,line:row.line,name:row.machine.name||"",code:row.machine.code||"",type:row.machine.type||"physical",commissioned:Boolean(row.machine.commissioned),note:row.machine.note||""});setShowForm(true);};
  const exportExcel=()=>{
    const data=[["Sektör","Üretim Merkezi","İşyeri","Hat","Makine Kodu","Makine Adı","Tip","Devreye Alındı","Devreye Alma Tarihi","Açıklama"]];
    rows.forEach(row=>data.push([row.sector,row.productionCenter,row.workplace,row.line,row.machine.code||"",row.machine.name,row.machine.type==="virtual"?"Sanal":"Fiziksel",row.machine.commissioned?"Evet":"Hayır",row.machine.commissionedAt||"",row.machine.note||""]));
    downloadXlsx(data,`${safeFileName(project.name)}-devreye-alma.xlsx`,"Devreye Alma");
  };
  const importExcel=(event)=>{
    const file=event.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const workbook=XLSX.read(reader.result,{type:"array"});
        const data=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
        const imported=data.map(item=>({sector:String(item["Sektör"]||item.Sektor||"").trim(),productionCenter:String(item["Üretim Merkezi"]||item["Uretim Merkezi"]||"").trim(),workplace:String(item["İşyeri"]||item.Isyeri||"").trim(),line:String(item.Hat||"").trim(),machine:{name:String(item["Makine Adı"]||item["Makine Adi"]||"").trim(),code:String(item["Makine Kodu"]||"").trim(),type:String(item.Tip||"").toLocaleLowerCase("tr-TR")==="sanal"?"virtual":"physical",commissioned:["evet","true","1"].includes(String(item["Devreye Alındı"]||item["Devreye Alindi"]||"").toLocaleLowerCase("tr-TR")),commissionedAt:String(item["Devreye Alma Tarihi"]||""),note:String(item["Açıklama"]||item.Aciklama||"")}})).filter(row=>row.machine.name);
        onChange(commissioningTreeFromRows([...rows,...imported]));
      }catch(error){alert(`Excel okunamadı: ${error.message}`);}
      event.target.value="";
    };
    reader.readAsArrayBuffer(file);
  };
  return <div style={{flex:1,overflow:"auto",padding:"clamp(14px,3vw,24px)",background:"#F8FAFC"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
      <div><h3 style={{margin:0,fontSize:17}}>Toplu Devreye Alma Takibi</h3><div style={{fontSize:11,color:"#64748B",marginTop:3}}>Tüm hiyerarşi tek listede; filtreleyin, işaretleyin veya Excel ile yönetin.</div></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}><Btn small variant="secondary" onClick={exportExcel}>Excel Dışa Aktar</Btn>{canEdit&&<><Btn small variant="secondary" onClick={()=>fileRef.current?.click()}>Excel İçe Aktar</Btn><input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={importExcel}/><Btn small onClick={()=>{setEditingMachineId("");setForm({sector:"",productionCenter:"",workplace:"",line:"",name:"",code:"",type:"physical",commissioned:false,note:""});setShowForm(value=>!value);}}>{showForm?"Formu Kapat":"+ Kayıt Ekle"}</Btn></>}</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:9,marginBottom:13}}>
      {[["İlerleme",`${percent}%`,"#4A6CF7"],["Devrede",`${commissioned}/${machines.length}`,"#059669"],["Fiziksel",physical,"#0369A1"],["Sanal",virtual,"#7C3AED"],["Bekleyen",machines.length-commissioned,"#EA6C00"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:11,padding:12}}><div style={{fontSize:10,color:"#64748B"}}>{label}</div><div style={{fontSize:21,fontWeight:800,color,marginTop:2}}>{value}</div></div>)}
    </div>
    <div style={{height:10,background:"#E2E8F0",borderRadius:10,overflow:"hidden",marginBottom:13}}><div style={{height:"100%",width:`${percent}%`,background:"linear-gradient(90deg,#4A6CF7,#10B981)",transition:"width .25s"}}/></div>
    <div style={{display:"flex",gap:6,marginBottom:13}}>{[["all","Tümü"],["pending","Devreye Alınacak"],["done","Devreye Alınan"]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} style={{border:0,borderRadius:8,padding:"7px 11px",background:filter===id?"#4A6CF7":"#fff",color:filter===id?"#fff":"#64748B",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>)}</div>
    {showForm&&<div style={{background:"#fff",border:"1px solid #DDE7F5",borderRadius:13,padding:15,marginBottom:14}}><div style={{fontSize:12,fontWeight:850,marginBottom:10}}>{editingMachineId?"Makine Kaydını Düzenle":"Yeni Makine Kaydı"}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:9}}>{[["sector","Sektör"],["productionCenter","Üretim Merkezi"],["workplace","İşyeri"],["line","Hat"],["name","Makine Adı"],["code","Makine Kodu"]].map(([key,label])=><Field key={key} label={label}><input style={iStyle} value={form[key]} onChange={event=>setForm(current=>({...current,[key]:event.target.value}))}/></Field>)}<Field label="Tip"><select style={iStyle} value={form.type} onChange={event=>setForm(current=>({...current,type:event.target.value}))}><option value="physical">Fiziksel</option><option value="virtual">Sanal</option></select></Field></div><Field label="Açıklama"><input style={iStyle} value={form.note} onChange={event=>setForm(current=>({...current,note:event.target.value}))}/></Field><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}><label style={{fontSize:12,fontWeight:700}}><input type="checkbox" checked={form.commissioned} onChange={event=>setForm(current=>({...current,commissioned:event.target.checked}))}/> Devreye alındı</label><Btn onClick={addMachine}>{editingMachineId?"Değişiklikleri Kaydet":"Kaydet"}</Btn></div></div>}
    <div style={{overflowX:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:13}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}><thead><tr>{["Durum","Sektör","Üretim Merkezi","İşyeri","Hat","Makine","Tip","Açıklama",""].map(label=><th key={label} style={{padding:"10px 9px",fontSize:10,color:"#64748B",background:"#F8FAFC",textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{visibleRows.map(row=><tr key={row.machine.id} style={{borderTop:"1px solid #EEF2F7"}}><td style={{padding:9}}><input type="checkbox" checked={Boolean(row.machine.commissioned)} disabled={!canEdit} onChange={event=>update(row.machine.id,current=>({...current,commissioned:event.target.checked,commissionedAt:event.target.checked?todayStr():""}))}/></td>{[row.sector,row.productionCenter,row.workplace,row.line].map((value,index)=><td key={index} style={{padding:9,fontSize:11,color:"#475569"}}>{value}</td>)}<td style={{padding:9}}><div style={{fontSize:11,fontWeight:800}}>{row.machine.name}</div><div style={{fontSize:9,color:"#94A3B8"}}>{row.machine.code||"Kod yok"}</div></td><td style={{padding:9,fontSize:11}}>{row.machine.type==="virtual"?"Sanal":"Fiziksel"}</td><td style={{padding:9,minWidth:190}}>{canEdit?<input style={{...iStyle,padding:"6px 8px",fontSize:10}} value={row.machine.note||""} onChange={event=>update(row.machine.id,current=>({...current,note:event.target.value}))}/>:<span style={{fontSize:10,color:"#64748B"}}>{row.machine.note||"-"}</span>}</td><td style={{padding:9}}>{canEdit&&<div style={{display:"flex",gap:7}}><button onClick={()=>editMachine(row)} style={{border:0,background:"transparent",color:"#4A6CF7",cursor:"pointer",fontSize:11}}>Düzenle</button><button onClick={()=>confirm("Makine silinsin mi?")&&remove(row.machine.id)} style={{border:0,background:"transparent",color:"#E11D48",cursor:"pointer",fontSize:11}}>Sil</button></div>}</td></tr>)}</tbody></table></div>
    {!visibleRows.length&&<div style={{padding:35,textAlign:"center",color:"#94A3B8"}}>Bu filtrede kayıt bulunmuyor.</div>}
  </div>;
}

function generateTeamCapacityReport(state,people){
  const tasks=state.projects.flatMap(project=>project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({task,project}))));
  const rows=people.map(person=>{
    const assigned=tasks.filter(({task})=>task.assignee===person.id);
    const active=assigned.filter(({task})=>task.status!=="Tamamland\u0131");
    const delayed=active.filter(({task})=>delayLvl(task.dueDate,task.status));
    const hours=assigned.reduce((total,{task})=>total+(task.timeEntries||[]).reduce((sum,entry)=>sum+(parseFloat(entry.hours)||0),0),0)
      +(state.fieldPlans||[]).filter(plan=>plan.userId===person.id&&(plan.status==="completed"||plan.completedAt)).reduce((total,plan)=>total+fieldPlanHours(plan),0);
    return {person,assigned:assigned.length,active:active.length,delayed:delayed.length,hours};
  }).filter(item=>item.assigned||item.hours).sort((a,b)=>b.active-a.active||b.hours-a.hours);
  const max=Math.max(1,...rows.map(item=>item.active));
  const cards=rows.map(item=>`<div class="person"><div class="head"><div class="avatar">${item.person.avatar||"?"}</div><div><b>${item.person.name}</b><small>${item.person.role||""}</small></div><strong>${item.active} aktif</strong></div><div class="track"><i style="width:${item.active/max*100}%;background:${item.delayed?"linear-gradient(90deg,#f59e0b,#ef4444)":"linear-gradient(90deg,#4f46e5,#7c3aed)"}"></i></div><div class="meta"><span>${item.assigned} toplam görev</span><span class="${item.delayed?"danger":""}">${item.delayed} gecikmiş</span><span>${item.hours} saat efor</span></div></div>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ekip Kapasite Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#eef2ff;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1100px;margin:auto}.hero{background:linear-gradient(125deg,#172554,#4338ca,#7c3aed);color:#fff;padding:28px;border-radius:22px;margin-bottom:18px}.hero h1{margin:0}.hero p{color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.person{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:17px}.head{display:flex;gap:10px;align-items:center}.head>div:nth-child(2){flex:1}.head small{display:block;color:#94a3b8;margin-top:2px}.head strong{color:#4338ca}.avatar{width:38px;height:38px;border-radius:50%;background:#eef2ff;color:#4338ca;display:grid;place-items:center;font-weight:900}.track{height:8px;background:#e2e8f0;border-radius:10px;overflow:hidden;margin:14px 0 8px}.track i{display:block;height:100%;border-radius:10px}.meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#64748b}.danger{color:#dc2626;font-weight:800}@media(max-width:700px){body{padding:14px}.grid{grid-template-columns:1fr}}@media print{body{background:#fff;padding:0}.print{display:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Ekip Kapasite Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · ${state.projects.length} proje · ${tasks.length} görev</p></div><div class="grid">${cards||"<div class='person'>Atanmış görev bulunmuyor.</div>"}</div></div></body></html>`;
  downloadTextFile(html,`ekip-kapasite-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

function generateRiskPortfolioReport(state){
  const risks=state.projects.flatMap(project=>(project.risks||[]).map(risk=>({risk,project})));
  const open=risks.filter(({risk})=>!["Kapal\u0131","Kapalı"].includes(risk.status));
  const high=open.filter(({risk})=>["Y\u00fcksek","Kritik"].includes(risk.level));
  const rows=risks.map(({risk,project})=>`<tr><td><b>${risk.title}</b><small>${risk.note||""}</small></td><td>${project.name}</td><td><span class="pill ${["Y\u00fcksek","Kritik"].includes(risk.level)?"red":risk.level==="Orta"?"orange":"green"}">${risk.level||"-"}</span></td><td>${risk.status||"Açık"}</td></tr>`).join("");
  const projectBars=state.projects.map(project=>{const count=(project.risks||[]).filter(risk=>!["Kapal\u0131","Kapalı"].includes(risk.status)).length;const critical=(project.risks||[]).filter(risk=>["Y\u00fcksek","Kritik"].includes(risk.level)&&!["Kapal\u0131","Kapalı"].includes(risk.status)).length;return `<div class="bar"><div><b>${project.name}</b><span>${count} açık · ${critical} yüksek</span></div><i><em style="width:${Math.min(100,count*20)}%;background:${critical?"#ef4444":count?"#f59e0b":"#10b981"}"></em></i></div>`}).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Risk Portföyü Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#fff7ed;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1200px;margin:auto}.hero{background:linear-gradient(125deg,#7c2d12,#ea580c,#f59e0b);color:#fff;padding:28px;border-radius:22px}.hero h1{margin:0}.hero p{color:#ffedd5}.print{float:right;border:0;border-radius:10px;background:#fff;color:#c2410c;padding:9px 15px;font-weight:800}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0}.stat{background:#fff;border-radius:15px;padding:17px;border:1px solid #fed7aa}.stat b{display:block;font-size:28px;color:#c2410c}.layout{display:grid;grid-template-columns:1fr 1.5fr;gap:14px}.card{background:#fff;border:1px solid #fed7aa;border-radius:17px;padding:19px}.bar{margin-bottom:13px}.bar div{display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px}.bar span{color:#64748b}.bar i{display:block;height:8px;background:#f1f5f9;border-radius:10px;overflow:hidden}.bar em{display:block;height:100%;border-radius:10px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ffedd5;text-align:left;font-size:11px}th{color:#64748b;background:#fffaf5}td small{display:block;color:#94a3b8;margin-top:3px}.pill{padding:3px 7px;border-radius:8px;font-weight:800}.red{background:#fff1f2;color:#dc2626}.orange{background:#fff7ed;color:#ea580c}.green{background:#ecfdf5;color:#059669}@media(max-width:760px){body{padding:14px}.stats,.layout{grid-template-columns:1fr}}@media print{body{background:#fff;padding:0}.print{display:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Risk Portföyü Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · Yönetici risk görünümü</p></div><div class="stats"><div class="stat"><b>${risks.length}</b>Toplam Risk</div><div class="stat"><b>${open.length}</b>Açık Risk</div><div class="stat"><b>${high.length}</b>Yüksek / Kritik</div></div><div class="layout"><div class="card"><h3>Proje Risk Yoğunluğu</h3>${projectBars||"Proje bulunmuyor."}</div><div class="card"><h3>Risk Envanteri</h3><div style="overflow:auto"><table><thead><tr><th>Risk</th><th>Proje</th><th>Seviye</th><th>Durum</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Risk bulunmuyor.</td></tr>"}</tbody></table></div></div></div></div></body></html>`;
  downloadTextFile(html,`risk-portfoyu-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

function generateSteercoReport(project,state,people){
  if(!project)return;
  const tasks=project.milestones.flatMap(milestone=>milestone.tasks.map(task=>({task,milestone})));
  const done=tasks.filter(({task})=>task.status==="Tamamlandı").length;
  const progress=tasks.length?Math.round(done/tasks.length*100):0;
  const delayed=tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const risks=(project.risks||[]).filter(risk=>!["Kapalı","Kapal\u0131"].includes(risk.status));
  const criticalRisks=risks.filter(risk=>["Yüksek","Kritik"].includes(risk.level));
  const actions=((state.projectActions||{})[project.id]||[]).slice().sort((a,b)=>String(b.actionAt||b.createdAt||"").localeCompare(String(a.actionAt||a.createdAt||""))).slice(0,8);
  const tickets=((state.projectTickets||{})[project.id]||[]);
  const openTickets=tickets.filter(ticket=>!["Tamamlandı","İptal Edildi","Done"].includes(ticket.status));
  const machines=project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[];
  const commissioned=machines.filter(machine=>machine.commissioned).length;
  const machineProgress=machines.length?Math.round(commissioned/machines.length*100):0;
  const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===project.id&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0);
  const taskHours=tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((total,entry)=>total+(parseFloat(entry.hours)||0),0),0);
  const actionHours=actions.reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
  const totalHours=Math.round((fieldHours+taskHours+actionHours)*10)/10;
  const health=progress>=75&&criticalRisks.length===0&&delayed.length<3?"Sağlıklı":criticalRisks.length||delayed.length>5?"Yönetici Aksiyonu Gerekli":"Dikkat";
  const statusColor=health==="Sağlıklı"?"#059669":health==="Dikkat"?"#EA6C00":"#E11D48";
  const nextTasks=tasks.filter(({task})=>task.status!=="Tamamlandı").sort((a,b)=>String(a.task.dueDate||"9999").localeCompare(String(b.task.dueDate||"9999"))).slice(0,8);
  const rows=nextTasks.map(({task,milestone})=>`<tr><td><b>${escapeHtml(task.title)}</b><small>${escapeHtml(milestone.name)}</small></td><td>${escapeHtml(people.find(person=>person.id===task.assignee)?.name||"-")}</td><td>${fmt(task.dueDate)}</td><td>${escapeHtml(task.status||"-")}</td></tr>`).join("");
  const actionRows=actions.map(action=>`<li><b>${fmt(action.actionAt||action.createdAt)}</b><span>${escapeHtml(action.text||"")}</span></li>`).join("");
  const riskRows=risks.slice(0,6).map(risk=>`<li><b>${escapeHtml(risk.level||"Risk")}</b><span>${escapeHtml(risk.title||"")} ${risk.note?`<small>${escapeHtml(risk.note)}</small>`:""}</span></li>`).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Steerco Raporu - ${escapeHtml(project.name)}</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#eef2ff;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1180px;margin:auto}.hero{background:linear-gradient(125deg,#0f172a,#4338ca,#06b6d4);color:#fff;padding:30px;border-radius:24px;margin-bottom:16px;box-shadow:0 24px 60px rgba(30,41,59,.18)}.hero h1{margin:0;font-size:32px}.hero p{color:#dbeafe;margin:8px 0 0}.print{float:right;border:0;border-radius:12px;background:#fff;color:#4338ca;padding:10px 16px;font-weight:900}.badge{display:inline-block;background:${statusColor};color:#fff;border-radius:999px;padding:7px 12px;font-weight:900;margin-bottom:14px}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px}.stat{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px}.stat b{display:block;font-size:25px;color:#4338ca}.stat span{font-size:11px;color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:19px}.card h2{font-size:16px;margin:0 0 12px}.bar{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden}.bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#4f46e5,#06b6d4)}ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}li{display:flex;gap:10px;font-size:12px;line-height:1.45}li b{min-width:92px;color:#4338ca}li small{display:block;color:#94a3b8;margin-top:3px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:12px}th{background:#f8fafc;color:#64748b}td small{display:block;color:#94a3b8;margin-top:3px}.wide{grid-column:1/-1}@media(max-width:820px){body{padding:14px}.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.hero h1{font-size:24px}}@media print{body{background:#fff;padding:0}.print{display:none}.hero{box-shadow:none}}</style></head><body><div class="wrap"><section class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><span class="badge">${health}</span><h1>Steerco Proje Durum Raporu</h1><p>${escapeHtml(project.name)} · ${new Date().toLocaleDateString("tr-TR")} · Yönetici karar toplantısı çıktısı</p></section><section class="stats"><div class="stat"><span>Genel İlerleme</span><b>%${progress}</b></div><div class="stat"><span>Devreye Alma</span><b>%${machineProgress}</b></div><div class="stat"><span>Geciken İş</span><b>${delayed.length}</b></div><div class="stat"><span>Açık Risk</span><b>${risks.length}</b></div><div class="stat"><span>Açık Ticket</span><b>${openTickets.length}</b></div><div class="stat"><span>Toplam Efor</span><b>${totalHours} sa</b></div></section><section class="grid"><div class="card"><h2>Proje İlerleme Özeti</h2><div class="bar"><i style="width:${progress}%"></i></div><p style="font-size:12px;color:#64748b;line-height:1.6">Tamamlanan görev sayısı ${done}/${tasks.length}. Makine/devreye alma kapsamı ${commissioned}/${machines.length||0}. Yönetim odağı: ${health}.</p></div><div class="card"><h2>Karar / Dikkat Gerektiren Konular</h2><ul>${riskRows||"<li><b>Risk</b><span>Açık kritik risk bulunmuyor.</span></li>"}${delayed.length?`<li><b>Termin</b><span>${delayed.length} geciken görev için aksiyon gerekli.</span></li>`:""}</ul></div><div class="card"><h2>Son Aksiyonlar</h2><ul>${actionRows||"<li><b>Aksiyon</b><span>Henüz aksiyon kaydı yok.</span></li>"}</ul></div><div class="card"><h2>Ticket ve Ürün Takibi</h2><ul><li><b>Açık</b><span>${openTickets.length} ticket açık durumda.</span></li><li><b>Jira</b><span>${tickets.filter(ticket=>ticket.jiraKey).length} ticket Jira ile ilişkilendirilmiş.</span></li><li><b>Müşteri Onayı</b><span>${tickets.filter(ticket=>String(ticket.status||"").toLocaleLowerCase("tr-TR").includes("müşteri")).length} kayıt müşteri aksiyonu bekliyor.</span></li></ul></div><div class="card wide"><h2>Yaklaşan / Açık İşler</h2><table><thead><tr><th>İş</th><th>Sorumlu</th><th>Termin</th><th>Durum</th></tr></thead><tbody>${rows||"<tr><td colspan='4'>Açık görev bulunmuyor.</td></tr>"}</tbody></table></div></section></div></body></html>`;
  downloadTextFile(html,`steerco-raporu-${safeFileName(project.name)}-${todayStr()}.html`,"text/html;charset=utf-8");
}

function downloadProjectActionsReport(state){
  const rows=[["Proje","Aksiyon Tarihi","Aksiyon","Efor (Saat)","Girişi Yapan"]];
  Object.entries(state.projectActions||{}).forEach(([projectId,actions])=>{
    const project=state.projects.find(item=>item.id===projectId);
    (actions||[]).forEach(action=>rows.push([project?.name||"Silinmiş proje",action.actionAt||action.createdAt||"",action.text||"",action.effortHours||0,action.authorName||""]));
  });
  downloadXlsx(rows,`proje-aksiyonlari-${todayStr()}.xlsx`,"Aksiyonlar");
}

function downloadFieldVisitsReport(state,people){
  const rows=[["Proje","Ziyaret Tarihi","Sorumlu","Başlangıç","Bitiş","Efor (Saat)","Ziyaret Notu"]];
  (state.fieldPlans||[]).filter(plan=>plan.status==="completed"||plan.completedAt).forEach(plan=>{
    rows.push([state.projects.find(project=>project.id===plan.projectId)?.name||"Silinmiş proje",plan.date||"",people.find(person=>person.id===plan.userId)?.name||"",plan.actualStartTime||plan.startTime||"",plan.actualEndTime||plan.endTime||"",fieldPlanHours(plan),plan.visitNotes||""]);
  });
  downloadXlsx(rows,`saha-ziyaretleri-${todayStr()}.xlsx`,"Saha Ziyaretleri");
}

const EMAIL_SAMPLE_VARIABLES = {
  recipient_name:"Ayşe Yılmaz",
  assigner_name:"Proje Yöneticisi",
  task_title:"Haftalık proje durumunu güncelle",
  task_description:"Güncel riskleri, eforları ve tamamlanan işleri rapora ekleyin.",
  due_date:"20.06.2026",
  project_name:"A Müşterisi MES Projesi",
  ticket_title:"Üretim ekranında veri gecikmesi",
  ticket_description:"Operatör ekranındaki üretim verileri geç güncelleniyor.",
  priority:"Yüksek",
  status:"Devam Ediyor",
  task_count:"3",
  task_list:"• Haftalık rapor · 2 gün gecikme\n• Sunucu kontrolü · 1 gün gecikme",
};

const EMAIL_VARIABLE_CATALOG = [
  ["recipient_name","Alıcı adı"],["assigner_name","Atayan kişi"],["project_name","Proje adı"],
  ["task_title","Görev başlığı"],["task_description","Görev açıklaması"],["due_date","Termin"],
  ["ticket_title","Ticket başlığı"],["ticket_description","Ticket açıklaması"],["priority","Öncelik"],
  ["status","Durum"],["task_count","Görev sayısı"],["task_list","Görev listesi"],
];

function MailCenterPage({state,setState}) {
  const tenant=resolveTenantProfile(state.tenantProfile);
  const templates=resolveEmailTemplates(state.emailTemplates);
  const [selectedId,setSelectedId]=useState(templates[0]?.id||"");
  const [draft,setDraft]=useState(templates.find(item=>item.id===selectedId)||templates[0]);
  const [recipient,setRecipient]=useState("");
  const [variablesText,setVariablesText]=useState(JSON.stringify(EMAIL_SAMPLE_VARIABLES,null,2));
  const [variableTarget,setVariableTarget]=useState("body");
  const [selectedVariable,setSelectedVariable]=useState("recipient_name");
  const [sendStatus,setSendStatus]=useState({loading:false,message:"",error:false});
  const fileInput=useRef();
  const selected=templates.find(item=>item.id===selectedId)||templates[0];
  const selectTemplate=(item)=>{setSelectedId(item.id);setDraft(item);setSendStatus({loading:false,message:"",error:false});};
  const variables=(()=>{try{return JSON.parse(variablesText||"{}");}catch{return EMAIL_SAMPLE_VARIABLES;}})();
  const preview=renderManagedTemplate({template:draft||selected,tenantProfile:tenant,variables,actionUrl:"https://www.corject.com"});
  const insertVariable=()=>{
    if(!draft)return;
    const token=`{{${selectedVariable}}}`;
    setDraft({...draft,[variableTarget]:`${draft[variableTarget]||""}${draft[variableTarget]?" ":""}${token}`});
  };
  const updateTenant=(patch)=>setState(current=>({...current,tenantProfile:{...resolveTenantProfile(current.tenantProfile),...patch}}));
  const saveTemplate=()=>{
    if(!draft?.name?.trim())return;
    setState(current=>{
      const currentTemplates=resolveEmailTemplates(current.emailTemplates);
      const exists=currentTemplates.some(item=>item.id===draft.id);
      return {...current,emailTemplates:exists?currentTemplates.map(item=>item.id===draft.id?draft:item):[...currentTemplates,draft]};
    });
    setSendStatus({loading:false,message:"Şablon kaydedildi.",error:false});
  };
  const addTemplate=()=>{
    const item={id:`custom_${uid()}`,name:"Yeni Şablon",category:"Özel",subject:"{{project_name}} bilgilendirmesi",eyebrow:"BİLGİLENDİRME",title:"{{project_name}} hakkında",intro:"Güncel bilgilendirme",body:"Merhaba {{recipient_name}},\n\nMesajınızı buraya yazın.",buttonLabel:"Detayı Aç",accentColor:tenant.accentColor,enabled:true};
    setState(current=>({...current,emailTemplates:[...resolveEmailTemplates(current.emailTemplates),item]}));
    selectTemplate(item);
  };
  const removeTemplate=()=>{
    if(DEFAULT_EMAIL_TEMPLATES.some(item=>item.id===draft.id)){setSendStatus({loading:false,message:"Sistem şablonları silinemez; pasif hale getirebilirsiniz.",error:true});return;}
    setState(current=>({...current,emailTemplates:resolveEmailTemplates(current.emailTemplates).filter(item=>item.id!==draft.id)}));
    const fallback=resolveEmailTemplates(state.emailTemplates).find(item=>item.id==="task_assignment");
    selectTemplate(fallback);
  };
  const uploadLogo=(file)=>{
    if(!file)return;
    if(file.size>150*1024){setSendStatus({loading:false,message:"Logo dosyası 150 KB'dan küçük olmalı.",error:true});return;}
    const reader=new FileReader();
    reader.onload=()=>updateTenant({logoUrl:String(reader.result||"")});
    reader.readAsDataURL(file);
  };
  const send=async()=>{
    if(!recipient.trim()){setSendStatus({loading:false,message:"Alıcı e-posta adresini girin.",error:true});return;}
    let parsed;
    try{parsed=JSON.parse(variablesText||"{}");}catch{setSendStatus({loading:false,message:"Değişkenler geçerli JSON olmalı.",error:true});return;}
    setSendStatus({loading:true,message:"Gönderiliyor...",error:false});
    try{
      const result=await sendManagedTemplateEmail({to:recipient.trim(),templateId:draft.id,template:draft,variables:parsed,actionUrl:"https://www.corject.com"});
      setSendStatus({loading:false,message:`Mail gönderildi${result.emailId?` · ${result.emailId}`:""}`,error:false});
    }catch(error){setSendStatus({loading:false,message:error.message,error:true});}
  };
  return <div style={{padding:"22px 26px",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap",marginBottom:18}}>
      <div><h1 style={{margin:0,fontSize:22}}>Mail Merkezi</h1><p style={{margin:"5px 0 0",fontSize:12,color:"#64748B"}}>Firma markası, dinamik şablonlar, önizleme ve manuel gönderim.</p></div>
      <Btn onClick={addTemplate}>+ Yeni Şablon</Btn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(280px,.8fr) minmax(380px,1.25fr)",gap:16,alignItems:"start"}} className="admin-main-grid">
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:12}}>Satın Alan Firma</div>
          <Field label="Firma Adı"><input style={iStyle} value={tenant.name} onChange={e=>updateTenant({name:e.target.value})} placeholder="A Firması"/></Field>
          <Field label="Logo">
            <div style={{display:"flex",gap:9,alignItems:"center"}}>
              <div style={{width:58,height:58,border:"1px solid #E2E8F0",borderRadius:13,display:"grid",placeItems:"center",overflow:"hidden",background:"#F8FAFC",flexShrink:0}}>{tenant.logoUrl?<img src={tenant.logoUrl} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}/>:<b style={{color:tenant.accentColor}}>{tenant.name.slice(0,2).toUpperCase()}</b>}</div>
              <div style={{flex:1}}><input style={iStyle} value={tenant.logoUrl.startsWith("data:")?"":tenant.logoUrl} onChange={e=>updateTenant({logoUrl:e.target.value})} placeholder="https://firma.com/logo.png"/><button onClick={()=>fileInput.current?.click()} style={{border:0,background:"transparent",color:"#4338CA",fontSize:10,fontWeight:800,cursor:"pointer",padding:"6px 0 0"}}>veya dosya yükle</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>uploadLogo(e.target.files?.[0])}/></div>
            </div>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
            <Field label="Marka Rengi"><input type="color" style={{...iStyle,padding:4,height:39}} value={tenant.accentColor} onChange={e=>updateTenant({accentColor:e.target.value})}/></Field>
            <Field label="Yanıt Adresi"><input type="email" style={iStyle} value={tenant.replyTo} onChange={e=>updateTenant({replyTo:e.target.value})} placeholder="info@firma.com"/></Field>
          </div>
          <div style={{fontSize:10,color:"#64748B",background:"#F8FAFC",borderRadius:9,padding:10}}>Gönderici teknik olarak <b>info@corject.com</b> kalır. Görünen marka firma olur; yanıtlar belirlediğiniz adrese yönlenir.</div>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Şablonlar</div>
          <div style={{display:"grid",gap:7}}>{templates.map(item=><button key={item.id} onClick={()=>selectTemplate(item)} style={{border:`1px solid ${selectedId===item.id?item.accentColor:"#E2E8F0"}`,borderLeft:`5px solid ${item.accentColor}`,borderRadius:10,background:selectedId===item.id?item.accentColor+"0D":"#fff",padding:"10px 11px",textAlign:"left",cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:11}}>{item.name}</b><span style={{fontSize:8,color:item.enabled===false?"#E11D48":"#059669",fontWeight:850}}>{item.enabled===false?"PASİF":"AKTİF"}</span></div><div style={{fontSize:9,color:"#94A3B8",marginTop:3}}>{item.category}</div></button>)}</div>
        </Card>
      </div>
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:12}}><b style={{fontSize:14}}>Şablon Düzenleyici</b><label style={{fontSize:10,fontWeight:800,color:"#64748B"}}><input type="checkbox" checked={draft?.enabled!==false} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/> Aktif</label></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><Field label="Şablon Adı"><input style={iStyle} value={draft?.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Kategori"><input style={iStyle} value={draft?.category||""} onChange={e=>setDraft({...draft,category:e.target.value})}/></Field></div>
          <Field label="Konu"><input style={iStyle} value={draft?.subject||""} onChange={e=>setDraft({...draft,subject:e.target.value})}/></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><Field label="Üst Etiket"><input style={iStyle} value={draft?.eyebrow||""} onChange={e=>setDraft({...draft,eyebrow:e.target.value})}/></Field><Field label="Vurgu Rengi"><input type="color" style={{...iStyle,padding:4,height:39}} value={draft?.accentColor||tenant.accentColor} onChange={e=>setDraft({...draft,accentColor:e.target.value})}/></Field></div>
          <Field label="Başlık"><input style={iStyle} value={draft?.title||""} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
          <Field label="Giriş"><input style={iStyle} value={draft?.intro||""} onChange={e=>setDraft({...draft,intro:e.target.value})}/></Field>
          <Field label="İçerik"><textarea style={{...iStyle,minHeight:120,resize:"vertical"}} value={draft?.body||""} onChange={e=>setDraft({...draft,body:e.target.value})}/></Field>
          <Field label="Buton Metni"><input style={iStyle} value={draft?.buttonLabel||""} onChange={e=>setDraft({...draft,buttonLabel:e.target.value})}/></Field>
          <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",padding:10,borderRadius:10}}><div style={{fontSize:10,fontWeight:850,color:"#475569",marginBottom:7}}>Dinamik alan ekle</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:7}}><select style={iStyle} value={selectedVariable} onChange={event=>setSelectedVariable(event.target.value)}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select style={iStyle} value={variableTarget} onChange={event=>setVariableTarget(event.target.value)}>{[["subject","Konu"],["eyebrow","Üst etiket"],["title","Başlık"],["intro","Giriş"],["body","İçerik"],["buttonLabel","Buton"]].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><Btn small variant="secondary" onClick={insertVariable}>Ekle</Btn></div><div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8}}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><button key={key} onClick={()=>{setSelectedVariable(key);setDraft({...draft,[variableTarget]:`${draft[variableTarget]||""}${draft[variableTarget]?" ":""}{{${key}}}`});}} style={{border:0,background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"4px 7px",fontSize:8,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div></div>
          <div style={{display:"flex",gap:8,marginTop:12}}><Btn onClick={saveTemplate}>Şablonu Kaydet</Btn><Btn variant="secondary" onClick={removeTemplate}>Sil</Btn></div>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Canlı Önizleme</div>
          <iframe title="Mail önizleme" srcDoc={preview.html} style={{width:"100%",height:560,border:"1px solid #E2E8F0",borderRadius:12,background:"#F1F5F9"}}/>
        </Card>
        <Card>
          <div style={{fontWeight:850,fontSize:14,marginBottom:10}}>Manuel Gönderim</div>
          <Field label="Alıcı"><input type="email" style={iStyle} value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="alici@firma.com"/></Field>
          <Field label="Önizleme ve test verileri"><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:7}}>{EMAIL_VARIABLE_CATALOG.map(([key,label])=><label key={key} style={{fontSize:9,color:"#64748B"}}>{label}<input style={{...iStyle,marginTop:3}} value={variables[key]||""} onChange={event=>setVariablesText(JSON.stringify({...variables,[key]:event.target.value},null,2))}/></label>)}</div><details style={{marginTop:8}}><summary style={{fontSize:9,color:"#64748B",cursor:"pointer"}}>Gelişmiş JSON görünümü</summary><textarea style={{...iStyle,minHeight:150,marginTop:6,fontFamily:"Consolas,monospace",fontSize:10}} value={variablesText} onChange={e=>setVariablesText(e.target.value)}/></details></Field>
          <Btn onClick={send} disabled={sendStatus.loading}>Gönder</Btn>
          {sendStatus.message&&<div style={{marginTop:9,fontSize:10,color:sendStatus.error?"#E11D48":"#059669"}}>{sendStatus.message}</div>}
        </Card>
      </div>
    </div>
  </div>;
}

function ReportsPage({ state, people, isAdmin }) {
  const [projectId,setProjectId]=useState(state.projects[0]?.id||"");
  const [group,setGroup]=useState("operations");
  const project=state.projects.find(p=>p.id===projectId);
  const tasks=project?project.milestones.flatMap(m=>m.tasks.map(task=>({task,project,milestone:m}))):[];
  const delayed=tasks.filter(({task})=>delayLvl(task.dueDate,task.status));
  const taskHours=tasks.reduce((sum,{task})=>sum+(task.timeEntries||[]).reduce((a,e)=>a+(parseFloat(e.hours)||0),0),0);
  const fieldHours=(state.fieldPlans||[]).filter(plan=>plan.projectId===projectId&&(plan.status==="completed"||plan.completedAt)).reduce((sum,plan)=>sum+fieldPlanHours(plan),0)
    +((state.projectActions||{})[projectId]||[]).reduce((sum,action)=>sum+(parseFloat(action.effortHours)||0),0);
  const hours=taskHours+fieldHours;
  const machines=project?(project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[]):[];
  const cards=[
    {group:"operations",title:"Gecikme Raporu",desc:"Geciken görevler, gecikme günleri, sorumlu ve bekleme nedeni.",color:"#E11D48",action:()=>downloadDelayReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Efor Raporu",desc:"Görev, saha ziyareti ve proje aksiyonlarından oluşan saat analizi.",color:"#7C3AED",action:()=>downloadEffortReport(state,people),label:"XLSX İndir"},
    {group:"operations",title:"Proje Aksiyonları",desc:"Tüm proje aksiyonları, tarihleri, sahipleri ve girilen eforlar.",color:"#0F766E",action:()=>downloadProjectActionsReport(state),label:"XLSX İndir"},
    {group:"operations",title:"Saha Ziyaretleri",desc:"Gerçekleşen ziyaretler, ziyaret notları ve proje eforları.",color:"#059669",action:()=>downloadFieldVisitsReport(state,people),label:"XLSX İndir"},
    {group:"technical",title:"Makine Devreye Alma",desc:"Fiziksel/sanal makineler, devre durumu ve devreye alınamama açıklamaları.",color:"#059669",action:()=>downloadMachineReport(state),label:"XLSX İndir"},
    {group:"project",title:"İç Operasyon Raporu",desc:"Grafikler, efor, gecikme, sorumlu, görev ve makine detaylarını içeren yönetim raporu.",color:"#0369A1",action:()=>project&&generateVisualReport(project,people,{fieldHours}),label:"HTML / PDF"},
    {group:"project",title:"Müşteri İlerleme Raporu",desc:"Renkli ilerleme grafikleri, teslim tarihleri ve makine durumunu sade müşteri görünümünde sunar.",color:"#EA6C00",action:()=>project&&generateVisualReport(project,people,{customer:true,fieldHours}),label:"HTML / PDF"},
    {group:"project",title:"Steerco Toplantı Raporu",desc:"Yönetim toplantısı için karar, risk, gecikme, ticket, efor ve sonraki adımları high-level özetler.",color:"#0F766E",action:()=>project&&generateSteercoReport(project,state,people),label:"HTML / PDF"},
    ...(isAdmin?[{group:"management",title:"Genel Durum Raporu",desc:"Tüm projeleri ilerleme, gecikme, makine ve efor göstergeleriyle karşılaştırır.",color:"#4338CA",action:()=>generatePortfolioReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Ticket Durum Raporu",desc:"Ticket yaşı, son aksiyon, sorumlu, proje ve Jira durumlarını tüm portföyde gösterir.",color:"#BE123C",action:()=>generateTicketStatusReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Ekip Kapasite Raporu",desc:"Kişi bazlı aktif iş yükü, gecikme yoğunluğu ve gerçekleşen eforu görselleştirir.",color:"#4F46E5",action:()=>generateTeamCapacityReport(state,people),label:"HTML / PDF"}]:[]),
    ...(isAdmin?[{group:"management",title:"Risk Portföyü Raporu",desc:"Açık riskleri proje ve önem seviyesine göre karşılaştırmalı gösterir.",color:"#C2410C",action:()=>generateRiskPortfolioReport(state),label:"HTML / PDF"}]:[]),
  ];
  return <div style={{padding:"clamp(16px, 4vw, 28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:12,marginBottom:20,flexWrap:"wrap"}}><div><h2 style={{margin:0,fontSize:21,display:"flex",alignItems:"center",gap:8}}><Icon name="reports" size={21}/>Raporlar</h2><p style={{margin:"4px 0 0",fontSize:12,color:"#64748B"}}>İç operasyon ve müşteri paylaşımı için güncel proje çıktıları.</p></div><div style={{minWidth:"min(240px,100%)",flex:"0 1 280px"}}><label style={lStyle}>Rapor Projesi</label><select style={iStyle} value={projectId} onChange={e=>setProjectId(e.target.value)}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10,marginBottom:20}}>{[["Geciken Görev",delayed.length,"#E11D48"],["Toplam Efor",`${hours} sa`,"#7C3AED"],["Makine",machines.length,"#0369A1"],["Devrede",machines.filter(m=>m.commissioned).length,"#059669"]].map(([label,value,color])=><div key={label} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:14}}><div style={{fontSize:11,color:"#64748B"}}>{label}</div><div style={{fontSize:24,fontWeight:800,color,marginTop:3}}>{value}</div></div>)}</div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>{[["operations","Operasyon"],["project","Proje ve Müşteri"],["technical","Teknik"],...(isAdmin?[["management","Yönetici"]]:[])].map(([id,label])=><button key={id} onClick={()=>setGroup(id)} style={{border:0,borderRadius:9,padding:"8px 12px",background:group===id?"#4338CA":"#F1F5F9",color:group===id?"#fff":"#64748B",fontSize:11,fontWeight:800,cursor:"pointer"}}>{label}</button>)}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>{cards.filter(card=>card.group===group).map(card=><div key={card.title} style={{background:"#fff",borderRadius:14,padding:18,border:"1.5px solid #E2E8F0",borderTop:`4px solid ${card.color}`,boxShadow:"0 2px 6px rgba(0,0,0,.04)"}}><div style={{fontWeight:800,fontSize:14,marginBottom:6}}>{card.title}</div><div style={{fontSize:12,color:"#64748B",lineHeight:1.5,minHeight:54}}>{card.desc}</div><Btn style={{marginTop:12,background:card.color}} disabled={!project&&card.title.includes("Raporu")} onClick={card.action}>{card.label}</Btn></div>)}</div>
  </div>;
}

function generateTicketStatusReport(state,people){
  const tickets=Object.entries(state.projectTickets||{}).flatMap(([projectId,list])=>{
    const project=state.projects.find(p=>p.id===projectId);
    return (list||[]).map(ticket=>({ticket,project}));
  });
  const open=tickets.filter(({ticket})=>!["Tamamlandı","İptal Edildi"].includes(ticket.status)).length;
  const acted=tickets.filter(({ticket})=>(ticket.updatedAt&&ticket.updatedAt!==ticket.ts)||ticket.jiraStatus).length;
  const rows=tickets.map(({ticket,project})=>{
    const age=Math.max(0,daysDiff(ticket.ts));
    const assignee=people.find(p=>p.id===ticket.assignedTo);
    return `<tr><td><b>${ticketNumber(ticket)}</b><br>${ticket.title}</td><td>${project?.name||"Silinmiş proje"}</td><td>${ticket.status||"Açık"}</td><td>${ticket.priority||"-"}</td><td>${assignee?.name||"Atanmamış"}</td><td>${new Date(ticket.ts).toLocaleDateString("tr-TR")}</td><td class="${age>=7?"danger":""}">${age} gün</td><td>${ticket.updatedAt?new Date(ticket.updatedAt).toLocaleString("tr-TR"):"Aksiyon yok"}</td><td>${ticket.jiraStatus||"-"}</td></tr>`;
  }).join("");
  const html=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Ticket Durum Raporu</title><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f1f5f9;color:#172033;font-family:Inter,Segoe UI,Arial}.wrap{max-width:1250px;margin:auto}.hero{background:linear-gradient(125deg,#172554,#4338ca,#7c3aed);color:#fff;padding:28px;border-radius:22px}.hero h1{margin:0}.hero p{color:#c7d2fe}.print{float:right;border:0;border-radius:10px;background:#fff;color:#4338ca;padding:9px 15px;font-weight:800}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat{color:#fff;border-radius:15px;padding:17px}.stat b{font-size:27px;display:block}.blue{background:linear-gradient(135deg,#2563eb,#4f46e5)}.orange{background:linear-gradient(135deg,#ea580c,#f59e0b)}.green{background:linear-gradient(135deg,#059669,#10b981)}.purple{background:linear-gradient(135deg,#7c3aed,#a855f7)}.card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:20px}.table{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #eef2f7;text-align:left;font-size:12px}th{background:#f8fafc;color:#64748b}.danger{color:#dc2626;font-weight:800}@media(max-width:760px){body{padding:14px}.stats{grid-template-columns:1fr 1fr}}@media print{body{padding:0;background:#fff}.print{display:none}}</style></head><body><div class="wrap"><div class="hero"><button class="print" onclick="window.print()">Yazdır / PDF</button><h1>Ticket Durum Raporu</h1><p>${new Date().toLocaleDateString("tr-TR")} · Tüm projeler</p></div><div class="stats"><div class="stat blue"><b>${tickets.length}</b>Toplam Ticket</div><div class="stat orange"><b>${open}</b>Açık Ticket</div><div class="stat green"><b>${tickets.length-open}</b>Kapanan Ticket</div><div class="stat purple"><b>${acted}</b>Aksiyon Alınan</div></div><div class="card"><div class="table"><table><thead><tr><th>Ticket</th><th>Proje</th><th>Durum</th><th>Öncelik</th><th>Sorumlu</th><th>Açılış</th><th>Geçen Süre</th><th>Son Aksiyon</th><th>Jira</th></tr></thead><tbody>${rows||"<tr><td colspan='9'>Ticket yok.</td></tr>"}</tbody></table></div></div></div></body></html>`;
  downloadTextFile(html,`ticket-durum-raporu-${todayStr()}.html`,"text/html;charset=utf-8");
}

function TicketsPage({state,setState,currentUser,isAdmin,initialMine=false}){
  const ticketLink=typeof window!=="undefined"?new URLSearchParams(window.location.search):null;
  const linkedProject=ticketLink?.get("project")||"";
  const linkedTicket=ticketLink?.get("ticket")||"";
  const linkedTicketData=linkedProject&&linkedTicket?((state.projectTickets||{})[linkedProject]||[]).find(ticket=>ticket.id===linkedTicket):null;
  const [activeTab,setActiveTab]=useState("tickets");
  const [projectFilters,setProjectFilters]=useState(linkedProject?[linkedProject]:[]);
  const [statusFilters,setStatusFilters]=useState([]);
  const [search,setSearch]=useState("");
  const [mailNotice,setMailNotice]=useState("");
  const [mineOnly,setMineOnly]=useState(initialMine);
  const [modal,setModal]=useState(linkedTicketData?{type:"detail",projectId:linkedProject,data:linkedTicketData}:null);
  const TYPES=["Bug","Görev","İyileştirme","Soru","Bilgi"];
  const PRIOS=["Düşük","Orta","Yüksek","Kritik"];
  const all=Object.entries(state.projectTickets||{}).flatMap(([projectId,list])=>{
    const project=state.projects.find(p=>p.id===projectId);
    return (list||[]).map(ticket=>({ticket,projectId,project}));
  });
  const filtered=all.filter(({ticket,projectId,project})=>{
    const haystack=`${ticket.ticketNo||""} ${ticket.title||""} ${ticket.description||""} ${project?.name||""} ${state.people.find(p=>p.id===ticket.assignedTo)?.name||""}`.toLocaleLowerCase("tr-TR");
    return (!projectFilters.length||projectFilters.includes(projectId))&&(!statusFilters.length||statusFilters.includes(ticket.status))&&(!mineOnly||ticket.assignedTo===currentUser.id||ticket.author===currentUser.name)&&(!search.trim()||haystack.includes(search.trim().toLocaleLowerCase("tr-TR")));
  });
  const save=(projectId,tickets)=>setState(s=>({...s,projectTickets:{...(s.projectTickets||{}),[projectId]:tickets}}));
  const add=async(projectId,data)=>{
    const createdAt=now();
    const ticket={id:uid(),ticketNo:nextTicketNumber(state),ts:createdAt,updatedAt:createdAt,author:currentUser.name,history:[{id:uid(),ts:createdAt,userId:currentUser.id,userName:currentUser.name,label:"Ticket",from:"-",to:"Oluşturuldu"}],...data};
    save(projectId,[...((state.projectTickets||{})[projectId]||[]),ticket]);
    const result=await createTicketWithNotification(projectId,ticket);
    if(result.ticket?.ticketNo)save(projectId,[...((state.projectTickets||{})[projectId]||[]),{...ticket,...result.ticket}]);
    setMailNotice(result.notification?.sent?"Ticket oluşturuldu ve atama maili gönderildi.":`Ticket oluşturuldu; mail gönderilemedi: ${result.notification?.reason||"Bilinmeyen hata"}`);
    return result;
  };
  const update=(projectId,id,data)=>{
    const tickets=(state.projectTickets||{})[projectId]||[];
    const old=tickets.find(t=>t.id===id);
    const workflowData=applyTicketWorkflow(data);
    const ticket={...old,...workflowData,updatedAt:now(),history:[...(old?.history||[]),...ticketChangeLog(old,workflowData,currentUser)]};
    save(projectId,tickets.map(t=>t.id===id?ticket:t));
    if(workflowData.assignedTo&&workflowData.assignedTo!==old?.assignedTo)notifyTicketAssignment(projectId,ticket).catch(error=>console.warn("Ticket maili gönderilemedi",error));
  };
  const remove=(projectId,id)=>save(projectId,((state.projectTickets||{})[projectId]||[]).filter(t=>t.id!==id));
  return <div style={{padding:"clamp(16px,4vw,28px)",flex:1,overflow:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
      <div><h2 style={{margin:0,fontSize:20,display:"flex",alignItems:"center",gap:8,color:"#1E293B"}}><Icon name="ticket" size={20}/>Ticketlar</h2><p style={{margin:"3px 0 0",fontSize:12,color:"#64748B"}}>{filtered.length} kayıt gösteriliyor</p></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{isAdmin&&<Btn variant="secondary" onClick={()=>generateTicketStatusReport(state,state.people)}>Durum Raporu</Btn>}<Btn onClick={()=>setModal({type:"add",projectId:state.projects[0]?.id||""})}>+ Ticket Ekle</Btn></div>
    </div>
    <div style={{display:"flex",gap:6,marginBottom:14,borderBottom:"1px solid #E2E8F0"}}>
      {[["tickets","Ticket Takibi"],["recurring","Tekrar Eden Problemler"]].map(([id,label])=><button key={id} onClick={()=>setActiveTab(id)} style={{border:0,borderBottom:`3px solid ${activeTab===id?"#4F46E5":"transparent"}`,background:"transparent",color:activeTab===id?"#4338CA":"#64748B",padding:"9px 12px",fontSize:11,fontWeight:850,cursor:"pointer"}}>{label}</button>)}
    </div>
    {activeTab==="tickets"&&<><div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
      <input style={{...iStyle,width:"auto",minWidth:220,flex:"1 1 220px"}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ticket, proje veya sorumlu ara..."/>
      <button onClick={()=>setMineOnly(v=>!v)} style={{border:0,borderRadius:8,padding:"8px 12px",cursor:"pointer",fontSize:11,fontWeight:700,background:mineOnly?"#4A6CF7":"#F1F5FF",color:mineOnly?"#fff":"#64748B"}}>Ticketlarım</button>
      <MultiChoiceFilter label="Projeler" options={state.projects.map(project=>({value:project.id,label:project.name}))} value={projectFilters} onChange={setProjectFilters}/>
      <MultiChoiceFilter label="Durumlar" options={TICKET_STATUSES.map(status=>({value:status,label:status}))} value={statusFilters} onChange={setStatusFilters}/>
    </div>
    {mailNotice&&<div style={{background:mailNotice.includes("gönderildi")?"#ECFDF5":"#FFF7ED",color:mailNotice.includes("gönderildi")?"#047857":"#C2410C",borderRadius:10,padding:"10px 13px",fontSize:11,fontWeight:700,marginBottom:12}}>{mailNotice}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(360px,100%),1fr))",gap:10}}>{[...filtered].sort((a,b)=>String(b.ticket.updatedAt||b.ticket.ts||"").localeCompare(String(a.ticket.updatedAt||a.ticket.ts||""))).map(({ticket,project,projectId})=>{const age=Math.max(0,daysDiff(ticket.ts));const assignee=state.people.find(p=>p.id===ticket.assignedTo);return <div key={`${projectId}-${ticket.id}`} onClick={()=>setModal({type:"detail",projectId,data:ticket})} style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:`3px solid ${project?.color||"#4A6CF7"}`,borderRadius:13,padding:"14px 15px",cursor:"pointer",boxShadow:"0 5px 16px rgba(15,23,42,.04)"}}>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:10,fontWeight:850,color:"#4338CA",background:"#EEF2FF",padding:"3px 7px",borderRadius:7}}>{ticketNumber(ticket)}</span><b style={{fontSize:13}}>{ticket.title}</b><select value={ticket.status||"Açık"} onClick={event=>event.stopPropagation()} onChange={event=>update(projectId,ticket.id,{status:event.target.value})} style={{fontSize:10,border:"1px solid #CBD5E1",borderRadius:7,padding:"3px 6px",background:"#fff"}}>{TICKET_STATUSES.map(status=><option key={status}>{status}</option>)}</select><span style={{fontSize:10,color:"#4A6CF7",background:"#EEF2FF",padding:"2px 7px",borderRadius:7}}>{project?.name||"Proje yok"}</span><span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:age>=7?"#E11D48":"#64748B"}}>{age} gündür açık</span></div>
      <div style={{display:"flex",gap:12,marginTop:7,flexWrap:"wrap",fontSize:11,color:"#64748B"}}><span>Sorumlu: <b>{assignee?.name||"Atanmamış"}</b></span><span>Son aksiyon: {ticket.updatedAt?new Date(ticket.updatedAt).toLocaleDateString("tr-TR"):"Yok"}</span><span>Jira: {ticket.jiraStatus||ticket.jiraKey||"-"}</span>{(isAdmin||ticket.author===currentUser.name)&&<button onClick={e=>{e.stopPropagation();if(confirm("Ticket silinsin mi?"))remove(projectId,ticket.id);}} style={{marginLeft:"auto",border:0,background:"transparent",color:"#E11D48",fontSize:11,fontWeight:700,cursor:"pointer"}}>Sil</button>}</div>
    </div>})}</div>
    {!filtered.length&&<div style={{padding:40,textAlign:"center",background:"#fff",border:"1.5px dashed #CBD5E1",borderRadius:12,color:"#94A3B8"}}>Filtreye uygun ticket yok.</div>}
    </>}
    {activeTab==="recurring"&&<RecurringProblemsPanel entries={all}/>}
    {modal?.type==="add"&&<Modal title="Ticket Ekle" onClose={()=>setModal(null)}><Field label="Proje"><select style={iStyle} value={modal.projectId} onChange={e=>setModal(m=>({...m,projectId:e.target.value}))}>{state.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><TicketForm project={state.projects.find(p=>p.id===modal.projectId)} types={TYPES} prios={PRIOS} people={state.people} onClose={()=>setModal(null)} onSave={async data=>{if(!modal.projectId)return;await add(modal.projectId,data);setModal(null);}}/></Modal>}
    {modal?.type==="detail"&&<TicketDetail ticket={((state.projectTickets||{})[modal.projectId]||[]).find(t=>t.id===modal.data.id)||modal.data} people={state.people} canEdit={isAdmin||modal.data.author===currentUser.name} types={TYPES} prios={PRIOS} onClose={()=>setModal(null)} onUpdate={data=>update(modal.projectId,modal.data.id,data)} onResend={()=>notifyTicketAssignment(modal.projectId,((state.projectTickets||{})[modal.projectId]||[]).find(t=>t.id===modal.data.id)||modal.data)}/>}
  </div>;
}

// Global style reset
const GlobalStyle = () => (
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

function AppLoadingScreen({progress=10,status="Oturum hazırlanıyor"}) {
  const safeProgress=Math.max(4,Math.min(100,Math.round(progress)));
  return <div style={{position:"fixed",inset:0,width:"100vw",height:"100dvh",display:"grid",placeItems:"center",boxSizing:"border-box",padding:20,fontFamily:"Inter,Segoe UI,sans-serif",background:"radial-gradient(circle at 50% 30%,#312E81 0,#172033 42%,#0F172A 100%)",color:"#fff",zIndex:9999,overflow:"hidden"}}>
    <div style={{width:"min(430px,100%)",textAlign:"center"}}>
      <img className="corject-loading-logo" src={corjectLogo} alt="Corject" style={{width:66,height:66,objectFit:"contain"}}/>
      <div style={{fontSize:14,fontWeight:900,letterSpacing:4,color:"#A5B4FC",marginTop:9}}>CORJECT</div>
      <div style={{fontSize:12,color:"#CBD5E1",margin:"25px 0 10px"}}>{status}</div>
      <div style={{height:9,borderRadius:20,background:"rgba(255,255,255,.1)",overflow:"hidden",border:"1px solid rgba(255,255,255,.08)"}}><div style={{height:"100%",width:`${safeProgress}%`,borderRadius:20,background:"linear-gradient(90deg,#4A6CF7,#8B5CF6,#22D3EE)",transition:"width .35s ease"}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#64748B",marginTop:7}}><span>Güvenli çalışma alanı yükleniyor</span><b style={{color:"#C4B5FD"}}>%{safeProgress}</b></div>
    </div>
  </div>;
}

export default function App() {
  const deepLink=typeof window!=="undefined"?new URLSearchParams(window.location.search):null;
  const [state,setState]=useState(load);
  const [view,setView]=useState(deepLink?.get("view")||"dashboard");
  const [selProject,setSelProject]=useState(null);
  const [selMilestone,setSelMilestone]=useState(null);
  const [projectTab,setProjectTab]=useState("tasks");
  const [modal,setModal]=useState(null);
  const [showDoneTasks,setShowDoneTasks]=useState(false);
  const [dataLoaded,setDataLoaded]=useState(false);
  const [loadProgress,setLoadProgress]=useState(REQUIRE_AUTH?8:20);
  const [syncStatus,setSyncStatus]=useState({ s:"idle", msg:"" });
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [mobileQuick,setMobileQuick]=useState(null);
  const [mobileQuickSheet,setMobileQuickSheet]=useState(false);
  const [adminSection,setAdminSection]=useState("overview");
  const [projectScope,setProjectScope]=useState("all");
  const [projectSearch,setProjectSearch]=useState("");
  const [projectSegment,setProjectSegment]=useState("all");
  const [projectViewMode,setProjectViewMode]=useState("cards");
  const [expandedProjectRows,setExpandedProjectRows]=useState({});
  const [ticketMineOnly,setTicketMineOnly]=useState(false);
  const [taskToOpen,setTaskToOpen]=useState("");
  const [responsibilityFilters,setResponsibilityFilters]=useState([]);
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<768);
  const [authSession,setAuthSession]=useState(null);
  const [authReady,setAuthReady]=useState(!REQUIRE_AUTH);
  const [loadError,setLoadError]=useState("");
  const [loadedAuthUserId,setLoadedAuthUserId]=useState("");
  const fileRef=useRef();
  const skipNextSave=useRef(true);
  const selectedProjectHistoryRef=useRef("");
  const touchStartRef=useRef(null);

  // Start waking the API while Supabase restores the persisted session.
  useEffect(()=>{
    if(USE_DATA_API)fetch(apiUrl("/health")).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(dataLoaded)return;
    const timer=setInterval(()=>setLoadProgress(value=>value<55?value+7:value<82?value+3:Math.min(94,value+1)),260);
    return ()=>clearInterval(timer);
  },[dataLoaded]);

  // Mobil algilama
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[authReady,authSession,dataLoaded]);

  useEffect(()=>{
    if(!REQUIRE_AUTH)return;
    supabase.auth.getSession().then(({data})=>{setAuthSession(data.session||null);setAuthReady(true);});
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{
      setAuthSession(session||null);
      setAuthReady(true);
    });
    return ()=>listener.subscription.unsubscribe();
  },[]);

  // Ilk yukleme: Supabase'den veri cek
  useEffect(()=>{
    if(REQUIRE_AUTH&&(!authReady||!authSession))return;
    let cancelled=false;
    // Once localStorage'dan kullanici kimligini geri yukle
    try{
      const savedUid=REQUIRE_AUTH?"":deepLink?.get("user")||localStorage.getItem("corject_uid");
      if(savedUid) setState(s=>({...s,currentUserId:savedUid}));
      if(!REQUIRE_AUTH&&deepLink?.get("user"))localStorage.setItem("corject_uid",deepLink.get("user"));
    }catch(e){}
    (async()=>{
      try{
        setLoadError("");
        setLoadProgress(value=>Math.max(value,48));
        const remote=await loadFromSupabase();
        if(cancelled)return;
        setLoadProgress(90);
        skipNextSave.current=true;
        // currentUserId'yi localStorage'dan koru, Supabase'den geleni kullanma
        let savedUid="";
        try{ savedUid=REQUIRE_AUTH?"":deepLink?.get("user")||localStorage.getItem("corject_uid")||""; }catch(e){}
        setState(s=>({ ...remote, currentUserId:savedUid||s.currentUserId }));
        setLoadedAuthUserId(authSession?.user?.id||"legacy");
        setDataLoaded(true);
      }catch(error){
        if(cancelled)return;
        console.error("Ilk veri yukleme hatasi:",error);
        setLoadError(error?.message||String(error));
      }
    })();
    return()=>{cancelled=true;};
  },[authReady,authSession]);

  useEffect(()=>{
    if(!REQUIRE_AUTH||!dataLoaded||!authSession?.user?.email)return;
    const email=authSession.user.email.trim().toLowerCase();
    const person=state.people.find(item=>item.email?.trim().toLowerCase()===email);
    if(!person)return;
    const avatarUrl=slackAvatarUrl(authSession.user);
    if(state.currentUserId!==person.id||(avatarUrl&&person.avatarUrl!==avatarUrl)){
      let cancelled=false;
      queueMicrotask(()=>{
        if(cancelled)return;
        setState(s=>({
          ...s,
          currentUserId:person.id,
          people:avatarUrl
            ?s.people.map(item=>item.id===person.id?{...item,avatarUrl}:item)
            :s.people,
        }));
      });
      return()=>{cancelled=true;};
    }
  },[authSession,dataLoaded,state.people,state.currentUserId]);

  // Degisiklikleri Supabase'e kaydet (ilk yuklemede atla)
  useEffect(()=>{
    if(!dataLoaded) return;
    if(skipNextSave.current){ skipNextSave.current=false; return; }
    saveToSupabase(state, (s,msg)=>setSyncStatus({s,msg:msg||""}));
  },[state, dataLoaded]);

  // Realtime version signal; periodic refresh remains as a recovery fallback.
  useEffect(()=>{
    if(!dataLoaded) return;
    let refreshTimer=null;
    let channel=null;
    const refresh=async()=>{
      const remote=await loadFromSupabase();
      if(remote){
        skipNextSave.current=true;
        let savedUid="";
        try{ savedUid=REQUIRE_AUTH?(state.currentUserId||""):localStorage.getItem("corject_uid")||""; }catch(e){}
        setState(s=>({ ...remote, currentUserId:savedUid||s.currentUserId }));
      }
    };
    if(USE_DATA_API&&REQUIRE_AUTH){
      channel=supabase.channel("corject-state-version")
        .on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_meta",filter:"id=eq.1"},payload=>{
          if(Number(payload.new?.state_version||0)>apiStateVersion)refresh();
        })
        .subscribe();
    }
    const interval=setInterval(async()=>{
      if(!refreshTimer)refreshTimer=setTimeout(()=>{refreshTimer=null;refresh();},50);
    }, USE_DATA_API?120000:30000);
    return ()=>{clearInterval(interval);if(refreshTimer)clearTimeout(refreshTimer);if(channel)supabase.removeChannel(channel);};
  },[dataLoaded]);

  const currentUser=state.people.find(p=>p.id===state.currentUserId);
  const isAdmin=currentUser?.isAdmin||false;
  const useAdminHome=isAdmin&&currentUser?.defaultDashboard==="admin";
  const tenantProfile=resolveTenantProfile(state.tenantProfile);
  useEffect(()=>{
    if(currentUser?.ticketOnly&&!["tickets","notifications"].includes(view)){
      setView("tickets");
      setSelProject(null);
    }
  },[currentUser?.ticketOnly,view]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    if(selProject&&selectedProjectHistoryRef.current!==selProject){
      selectedProjectHistoryRef.current=selProject;
      window.history.pushState({corjectProject:selProject},"",window.location.href);
    }
    if(!selProject)selectedProjectHistoryRef.current="";
  },[selProject]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const onPopState=()=>{
      if(selProject){
        setSelProject(null);
        setSelMilestone(null);
      }
    };
    window.addEventListener("popstate",onPopState);
    return ()=>window.removeEventListener("popstate",onPopState);
  },[selProject]);

  const addLog=(user,action,detail,project,milestone)=>{
    setState(s=>({...s,logs:[{id:uid(),ts:now(),user,userId:s.currentUserId,action,detail,project:project||"",milestone:milestone||""},...s.logs]}));
  };
  const addNotification=(userId,msg,projectName)=>{
    setState(s=>({...s,notifications:[{id:uid(),ts:now(),userId,msg,projectName,read:false},...(s.notifications||[])]}));
  };
  const markAllRead=()=>setState(s=>({...s,notifications:(s.notifications||[]).map(n=>isNotificationForUser(n,currentUser)?{...n,read:true}:n)}));
  const goBackInApp=useCallback(()=>{
    if(mobileQuickSheet){setMobileQuickSheet(false);return true;}
    if(mobileQuick){setMobileQuick(null);return true;}
    if(modal){setModal(null);return true;}
    if(selProject){
      if(projectTab!=="setup"){setProjectTab("setup");return true;}
      setSelProject(null);
      setSelMilestone(null);
      setView("projects");
      return true;
    }
    if(view&&view!=="dashboard"){
      setView("dashboard");
      setSelMilestone(null);
      setProjectScope("all");
      return true;
    }
    return false;
  },[mobileQuickSheet,mobileQuick,modal,selProject,projectTab,view]);
  const handleTouchStart=event=>{
    if(!isMobile)return;
    const touch=event.touches?.[0];
    if(!touch||touch.clientX>28)return;
    touchStartRef.current={x:touch.clientX,y:touch.clientY,at:Date.now()};
  };
  const handleTouchEnd=event=>{
    const start=touchStartRef.current;
    touchStartRef.current=null;
    if(!isMobile||!start)return;
    const touch=event.changedTouches?.[0];
    if(!touch)return;
    const dx=touch.clientX-start.x;
    const dy=Math.abs(touch.clientY-start.y);
    if(dx>72&&dy<70&&Date.now()-start.at<900){
      goBackInApp();
    }
  };
  const login=(id)=>{ setState(s=>({...s,currentUserId:id})); setView("dashboard"); try{localStorage.setItem("corject_uid",id);}catch(e){} };
  const logout=()=>{ if(REQUIRE_AUTH)supabase.auth.signOut();setState(s=>({...s,currentUserId:null})); try{localStorage.removeItem("corject_uid");}catch(e){} setView("dashboard"); setSelProject(null); };

  if(REQUIRE_AUTH&&!authReady)return <AppLoadingScreen progress={loadProgress} status="Oturum kontrol ediliyor"/>;
  if(REQUIRE_AUTH&&!authSession)return <AuthLoginScreen/>;
  if(loadError)return <div style={{height:"100vh",display:"grid",placeItems:"center",background:"#0F172A",color:"#F8FAFC",padding:20,fontFamily:"Inter,Segoe UI,sans-serif"}}>
    <div style={{maxWidth:520,textAlign:"center"}}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Veriler yüklenemedi</div>
      <div style={{fontSize:12,color:"#FCA5A5",lineHeight:1.6,marginBottom:16}}>{loadError}</div>
      <button onClick={()=>window.location.reload()} style={{border:0,borderRadius:10,padding:"10px 16px",background:"#4A6CF7",color:"#fff",fontWeight:800,cursor:"pointer"}}>Tekrar Dene</button>
    </div>
  </div>;
  if(!dataLoaded||(REQUIRE_AUTH&&loadedAuthUserId!==authSession?.user?.id)) return <AppLoadingScreen progress={loadProgress} status={loadProgress<45?"Güvenli bağlantı kuruluyor":loadProgress<82?"Projeler ve görevler yükleniyor":"Arayüz hazırlanıyor"}/>;
  if(!currentUser)return REQUIRE_AUTH?<div style={{height:"100vh",display:"grid",placeItems:"center",background:"#0F172A",color:"#FCA5A5",padding:20,textAlign:"center"}}>Bu e-posta için aktif Corject profili bulunamadı.</div>:<LoginScreen people={state.people} onLogin={login} />;

  // Project visibility filter
  const visibleProjects=state.projects;
  const myProjects=state.projects.filter(p=>projectPmIds(p).includes(currentUser.id)||projectStakeholders(p).some(item=>item.userId===currentUser.id)||(p.members||[]).includes(currentUser.id)||p.milestones.some(ms=>ms.tasks.some(t=>t.assignee===currentUser.id)));
  const listedProjects=(projectScope==="mine"?myProjects:visibleProjects)
    .filter(item=>projectSegment==="connected"?Boolean(item.connectedSupplier):projectSegment==="standard"?!item.connectedSupplier:true)
    .filter(item=>`${item.name||""} ${item.description||""} ${(item.customerProfile?.website)||""}`.toLocaleLowerCase("tr-TR").includes(projectSearch.trim().toLocaleLowerCase("tr-TR")));
  const exportListedProjects=()=>downloadXlsx([
    ["Proje","Müşteri","Durum","PM","Başlangıç","Hedef Bitiş","İlerleme %","Görev","Geciken","Ticket","Makine","Devrede"],
    ...listedProjects.map(project=>{
      const tasks=project.milestones.flatMap(milestone=>milestone.tasks||[]);
      const done=tasks.filter(task=>task.status==="Tamamlandı").length;
      const progress=tasks.length?Math.round(done/tasks.length*100):0;
      const delayed=tasks.filter(task=>delayLvl(task.dueDate,task.status)).length;
      const machines=project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[];
      const commissioned=machines.filter(machine=>machine.commissioned).length;
      const pms=projectPmIds(project).map(id=>state.people.find(person=>person.id===id)?.name).filter(Boolean).join(", ");
      return [project.name,project.customerProfile?.name||project.customerName||"",project.status||"",pms,project.startDate||"",project.endDate||"",progress,`${done}/${tasks.length}`,delayed,((state.projectTickets||{})[project.id]||[]).length,machines.length,commissioned];
    })
  ],`projeler-toplu-${todayStr()}.xlsx`,"Projeler");
  const taskDeadlineWarnings=visibleProjects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>delayLvl(t.dueDate,t.status)).map(t=>({...t,projectId:proj.id,projectName:proj.name,projectColor:proj.color,level:delayLvl(t.dueDate,t.status),days:daysDiff(t.dueDate)}))));
  const todoDeadlineWarnings=(((state.userNotes||{})[currentUser.id]?.todos)||[]).filter(t=>!t.done&&t.dueDate&&daysDiff(t.dueDate)>0).map(t=>({id:t.id,title:t.action||t.text,projectName:t.customer||"Kişisel To-Do",dueDate:t.dueDate,kind:"todo",level:daysDiff(t.dueDate)>=7?"critical":"normal",days:daysDiff(t.dueDate),status:"Bekliyor"}));
  const deadlineWarnings=[...taskDeadlineWarnings,...todoDeadlineWarnings].sort((a,b)=>b.days-a.days);

  const project=state.projects.find(p=>p.id===selProject);
  const milestone=project?.milestones.find(m=>m.id===selMilestone);
  const currentMs=project?.milestones.find(m=>m.status!=="Tamamland\u0131");
  const activePMs=project?projectPmIds(project).map(id=>state.people.find(p=>p.id===id)).filter(Boolean):[];
  const activeStakeholders=project?projectStakeholders(project).map(item=>({...item,person:state.people.find(p=>p.id===item.userId)})).filter(item=>item.person):[];
  const canManageProjectActions=isAdmin||(project?projectPmIds(project).includes(currentUser.id):false);
  const mutProject=(fn)=>setState(s=>({...s,projects:s.projects.map(p=>p.id===selProject?fn(p):p)}));

  const addProject=(data)=>{ const assigned=[...(data.pmIds||[]),...(data.stakeholders||[]).map(item=>item.userId)].filter(Boolean);const p={id:uid(),milestones:[],risks:[],machines:[],commissioningTree:[],commissioningTracking:false,pmIds:[],stakeholders:[],readinessChecklist:createReadinessChecklist(),readinessThreshold:80,raciContacts:[],documents:[],reportSchedules:[],...data,members:[...new Set([...(data.members||[]),...assigned])],pm:data.pmIds?.[0]||data.pm||""}; setState(s=>({...s,projects:[...s.projects,p]}));setSelProject(p.id);setView("projects");setProjectTab("setup");addLog(currentUser.name,"project_create",`${p.name} projesi oluşturuldu`,p.name); };
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
    people:s.people.filter(person=>person.id!==id).map(person=>person.managerId===id?{...person,managerId:""}:person),
    projects:s.projects.map(p=>({...p,pm:p.pm===id?"":p.pm,pmIds:projectPmIds(p).filter(pmId=>pmId!==id),stakeholders:projectStakeholders(p).filter(item=>item.userId!==id),members:(p.members||[]).filter(memberId=>memberId!==id),milestones:p.milestones.map(ms=>({...ms,tasks:ms.tasks.map(t=>t.assignee===id?{...t,assignee:""}:t)}))})),
    personalTasks:(s.personalTasks||[]).map(t=>t.assignee===id?{...t,assignee:""}:t)
  }));
  const updateProjectById=(id,data)=>{setState(s=>({...s,projects:s.projects.map(p=>{if(p.id!==id)return p;const assigned=[...(data.pmIds||[]),...(data.stakeholders||[]).map(item=>item.userId)].filter(Boolean);return {...p,...data,members:[...new Set([...(p.members||[]),...assigned])],pm:data.pmIds?.[0]||""};})}));addLog(currentUser.name,"general","Proje güncellendi",data.name);};
  const deleteProject=(id)=>{ if(!isAdmin)return; const name=state.projects.find(p=>p.id===id)?.name; setState(s=>{const projectActions={...(s.projectActions||{})};delete projectActions[id];return {...s,projects:s.projects.filter(p=>p.id!==id),fieldPlans:(s.fieldPlans||[]).filter(plan=>plan.projectId!==id),projectActions};}); setSelProject(null); setSelMilestone(null); addLog(currentUser.name,"general","Proje silindi: "+name); };
  const addRisk=(data)=>{ mutProject(p=>({...p,risks:[...(p.risks||[]),{id:uid(),...data}]})); addLog(currentUser.name,"risk_add",data.title,project?.name); };
  const updateRisk=(rId,data)=>mutProject(p=>({...p,risks:(p.risks||[]).map(r=>r.id===rId?{...r,...data}:r)}));
  const deleteRisk=(rId)=>mutProject(p=>({...p,risks:(p.risks||[]).filter(r=>r.id!==rId)}));
  const addMilestone=(data)=>{ const ms=normalizeMilestone({id:uid(),tasks:[],waitSource:"",...data}); mutProject(p=>({...p,milestones:[...p.milestones,ms]})); addLog(currentUser.name,"milestone_add",ms.name,project?.name); };
  const updateMilestone=(msId,data)=>{ const old=project?.milestones.find(m=>m.id===msId); mutProject(p=>({...p,milestones:p.milestones.map(m=>m.id===msId?normalizeMilestone({...m,...data,status:m.status}):m)})); addLog(currentUser.name,"general","Milestone güncellendi: "+(data.name||old?.name),project?.name); };
  const deleteMilestone=(msId)=>{ mutProject(p=>({...p,milestones:p.milestones.filter(m=>m.id!==msId)})); setSelMilestone(null); addLog(currentUser.name,"general","Milestone silindi",project?.name); };
  const addTask=(msId,data)=>{
    const task={id:uid(),waitSource:"",waitReason:"",waitingHistory:[],responsibilityGroup:"Proje Ekibi",...data};
    if(["Bekliyor","Engellendi"].includes(task.status))task.waitingHistory=[{id:uid(),source:task.waitSource||"Diğer",reason:task.waitReason||"Açıklama girilmedi",startAt:now(),endAt:"",createdBy:currentUser.name}];
    mutProject(p=>({...p,milestones:p.milestones.map(m=>m.id===msId?normalizeMilestone({...m,tasks:[...m.tasks,task]}):m)}));
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
        const newTasks=m.tasks.map(t=>{
          if(t.id!==taskId)return t;
          const next={...t,...data};
          const wasWaiting=["Bekliyor","Engellendi"].includes(t.status);
          const isWaiting=["Bekliyor","Engellendi"].includes(next.status);
          const history=[...(t.waitingHistory||[])];
          const openIndex=history.findIndex(entry=>!entry.endAt);
          if(isWaiting&&(!wasWaiting||openIndex<0||t.waitSource!==next.waitSource||t.waitReason!==next.waitReason)){
            if(openIndex>=0)history[openIndex]={...history[openIndex],endAt:now()};
            history.push({id:uid(),source:next.waitSource||"Diğer",reason:next.waitReason||"Açıklama girilmedi",startAt:now(),endAt:"",createdBy:currentUser.name});
          } else if(!isWaiting&&openIndex>=0) history[openIndex]={...history[openIndex],endAt:now()};
          return {...next,waitingHistory:history};
        });
        const next=normalizeMilestone({...m,tasks:newTasks});
        return {...next,...(next.status==="Tamamlandı"&&!m.actualEnd?{actualEnd:todayStr()}:{})};
      });
      return {...p,milestones:newMs};
    });
    if(data.status&&old?.status!==data.status){
      if(data.status==="Tamamlandı")addLog(currentUser.name,"task_done",`${old?.title} tamamlandı`,project?.name,project?.milestones.find(m=>m.id===msId)?.name);
      else addLog(currentUser.name,"status_change",`${old?.title}: ${old?.status} → ${data.status}`,project?.name,project?.milestones.find(m=>m.id===msId)?.name);
    } else addLog(currentUser.name,"general","Görev güncellendi: "+(data.title||old?.title),project?.name);
  };
  const deleteTask=(msId,taskId)=>mutProject(p=>({...p,milestones:p.milestones.map(ms=>ms.id===msId?normalizeMilestone({...ms,tasks:ms.tasks.filter(task=>task.id!==taskId)}):ms)}));

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
      // Milestone tarih ve durumu görevlerden otomatik hesaplanır.
      // cols: 0=ms_name,1=task_title,2=task_start,3=task_status,4=priority,
      //       5=assignee,6=task_due,7=task_wait,8=notes,9=tags,10=link
      if(!mm[n])mm[n]={id:uid(),name:n,startDate:"",dueDate:"",status:"Başlamadı",waitSource:"",tasks:[]};
      if(c[1])mm[n].tasks.push({
        id:uid(),
        title:String(c[1]),
        startDate:excelDateToStr(c[2]),
        status:STATUSES.includes(String(c[3]||""))?String(c[3]):"Başlamadı",
        priority:PRIORITIES.includes(String(c[4]||""))?String(c[4]):"Orta",
        assignee:state.people.find(person=>person.id===String(c[5]||"")||person.name.trim().toLocaleLowerCase("tr-TR")===String(c[5]||"").trim().toLocaleLowerCase("tr-TR"))?.id||"",
        dueDate:excelDateToStr(c[6]),
        waitSource:String(c[7]||""),
        notes:String(c[8]||""),
        tags:String(c[9]||""),
        link:String(c[10]||""),
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
    return Object.values(mm).map(normalizeMilestone);
  };

  const downloadTemplate=()=>{
    const rows=[
      ["Milestone Adı","Görev Adı","Görev Başlangıç","Görev Durumu","Öncelik","Sorumlu","Görev Termin","Görev Bekleme","Notlar","Etiketler","Bağlantı"],
      ["Kapsam ve Fizibilite","Süreç analizi","2026-07-01","Başlamadı","Yüksek","Hakan","2026-07-10","","Akış diyagramı","analiz",""],
      ["Kapsam ve Fizibilite","ROI hesaplama","2026-07-08","Başlamadı","Orta","Ayşe K.","2026-07-15","","","analiz",""],
      ["Altyapı Hazırlık","Sunucu kurulumu","2026-07-21","Başlamadı","Yüksek","Ayşe K.","2026-07-28","","","altyapı",""],
      ["Altyapı Hazırlık","OPC-UA altyapı","2026-07-28","Başlamadı","Yüksek","Ayşe K.","2026-08-10","Teknik","Port 4840","altyapı",""],
      ["Makine Entegrasyonu","CNC bağlantı","2026-08-18","Başlamadı","Yüksek","Hakan","2026-09-01","","","makine",""],
      ["Test ve Validasyon","Fonksiyonel testler","2026-09-22","Başlamadı","Yüksek","Hakan","2026-10-01","","","test",""],
      ["Canlıya Alış","Operatör eğitimi","2026-10-13","Başlamadı","Orta","Hakan","2026-10-20","","","eğitim",""]
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=[{wch:22},{wch:26},{wch:16},{wch:16},{wch:12},{wch:18},{wch:16},{wch:16},{wch:28},{wch:14},{wch:22}];
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
          return normalizeMilestone({...existing,waitSource:match.waitSource||existing.waitSource,tasks:[...mergedTasks,...newTasks]});
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
  const projectCommissioningMachines=project?.commissioningTracking?commissioningMachines(project.commissioningTree||[]):[];
  const projectCommissioningDone=projectCommissioningMachines.filter(machine=>machine.commissioned).length;
  const projectCommissioningPercent=projectCommissioningMachines.length?Math.round(projectCommissioningDone/projectCommissioningMachines.length*100):0;
  const myOpenTaskCount=(state.personalTasks||[]).filter(task=>task.assignee===currentUser.id&&task.status!=="Tamamlandı").length
    +state.projects.flatMap(item=>item.milestones.flatMap(ms=>ms.tasks)).filter(task=>task.assignee===currentUser.id&&task.status!=="Tamamlandı").length;
  const managerAssignedOpenCount=(state.personalTasks||[]).filter(task=>task.createdBy===currentUser.id&&task.status!=="Tamamlandı").length;
  const saveAdminAssignedTask=async(data)=>{
    const {assigneeIds=[],supportAssigneeIds=[],recurrence,...task}=data;
    const groupId=uid();
    const primaryResult=assigneeIds.length?await assignTasksWithNotification({task:{...task,assignmentRole:"Ana Sorumlu"},assigneeIds,recurrence,assignerId:currentUser.id,groupId}):{tasks:[],notifications:[]};
    const supportOnly=supportAssigneeIds.filter(id=>!assigneeIds.includes(id));
    const supportResult=supportOnly.length?await assignTasksWithNotification({task:{...task,assignmentRole:"Destek Sorumlusu"},assigneeIds:supportOnly,recurrence:null,assignerId:currentUser.id,groupId}):{tasks:[],notifications:[]};
    const result={tasks:[...primaryResult.tasks,...supportResult.tasks],notifications:[...primaryResult.notifications,...supportResult.notifications],recurringTemplate:primaryResult.recurringTemplate};
    setState(current=>{
      const localNotices=result.tasks.map(task=>({id:uid(),ts:now(),userId:task.assignee,msg:`"${task.title}" görevi size atandı.`,projectName:"Yönetici Ataması",taskId:task.id,type:"task_assignment",read:false}));
      return {...current,personalTasks:[...(current.personalTasks||[]),...result.tasks.filter(task=>!(current.personalTasks||[]).some(existing=>existing.id===task.id))],recurringTasks:result.recurringTemplate?[...(current.recurringTasks||[]).filter(item=>item.id!==result.recurringTemplate.id),result.recurringTemplate]:(current.recurringTasks||[]),notifications:[...localNotices,...(current.notifications||[])]};
    });
    addLog(currentUser.name,"task_add",`${task.title} (${result.tasks.length} kişi)`);
    return result;
  };
  const saveMobileQuickTodo=(data)=>{
    const todo={id:uid(),customer:data.customer||"",projectId:data.projectId||"",dueDate:data.dueDate||"",action:data.action,text:data.action,done:false,createdAt:now()};
    setState(current=>({...current,userNotes:{...(current.userNotes||{}),[currentUser.id]:{...((current.userNotes||{})[currentUser.id]||{}),todos:[...(((current.userNotes||{})[currentUser.id]?.todos)||[]),todo]}}}));
    setMobileQuick(null);
  };
  const saveMobileQuickAction=(data)=>{
    if(!data.projectId)return;
    const action={id:uid(),tag:data.tag||"Takip",text:data.text,effortHours:parseFloat(data.effortHours)||0,actionAt:now(),createdAt:now(),authorId:currentUser.id,authorName:currentUser.name};
    setState(current=>({...current,projectActions:{...(current.projectActions||{}),[data.projectId]:[action,...(((current.projectActions||{})[data.projectId])||[])]}}));
    setMobileQuick(null);
    setSelProject(data.projectId);
    setView("projects");
    setProjectTab("actions");
  };

  const fullNav=[
    {id:"dashboard",icon:"home",label:"Dashboard"},
    ...(isAdmin?[{id:"admin",icon:"admin",label:"Yönetim"}]:[]),
    {id:"todos",icon:"ticket",label:"To-Do"},
    {id:"projects",icon:"projects",label:"Projeler"},
    {id:"mytasks",icon:"tasks",label:`Görevlerim${myOpenTaskCount?` (${myOpenTaskCount})`:""}`},
    {id:"fieldops",icon:"calendar",label:"Saha Y\u00f6netimi"},
    {id:"deadlines",icon:"clock",label:`Termin Uyar\u0131lar\u0131${deadlineWarnings.length?` (${deadlineWarnings.length})`:""}`},
    {id:"tickets",icon:"ticket",label:"Ticketlar"},
    {id:"ai",icon:"activity",label:"AI Asistan"},
    ...(isAdmin?[{id:"import",icon:"reports",label:"Import Merkezi"}]:[]),
    ...(isAdmin?[{id:"mailcenter",icon:"mail",label:"Mail Merkezi"}]:[]),
    {id:"reports",icon:"reports",label:"Raporlar"},
    {id:"people",icon:"people",label:"Ekip"},
    {id:"logs",icon:"activity",label:"Aktivite"},
  ];
  const nav=currentUser.ticketOnly?fullNav.filter(item=>["tickets"].includes(item.id)):fullNav;

  return <><GlobalStyle /><div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ display:"flex", height:"100vh", width:"100vw", fontFamily:"Inter,Segoe UI,sans-serif", background:"#F8FAFC", color:"#1E293B", overflow:"hidden", position:"relative" }}>
    {/* Mobil ust bar */}
    {isMobile&&<div style={{ position:"fixed", top:0, left:0, right:0, height:58, background:"rgba(255,255,255,.94)", backdropFilter:"blur(18px)", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", padding:"0 14px", zIndex:900, gap:10 }}>
      <button onClick={()=>{setAdminSection("overview");setView("dashboard");setSelProject(null);}} style={{border:0,background:"transparent",display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:0}}><img src={tenantProfile.logoUrl||corjectLogo} alt="" style={{width:34,height:34,objectFit:"contain"}}/><span style={{fontFamily:"Aptos Display,Inter,Segoe UI,sans-serif",fontSize:18,fontWeight:950,color:"#111827",letterSpacing:.2,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tenantProfile.name}</span></button>
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={()=>{ setView("notifications"); setSelProject(null); }} style={{ background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:12, cursor:"pointer", position:"relative", padding:8, color:"#475569", display:"grid", placeItems:"center" }}>
          <Icon name="bell" size={17}/>
          {(state.notifications||[]).filter(n=>isNotificationForUser(n,currentUser)&&!n.read).length>0&&<span style={{ position:"absolute", top:5, right:5, width:8, height:8, background:"#E11D48", borderRadius:"50%" }} />}
        </button>
        <button title="Tüm özellikler" onClick={()=>{setSelProject(null);setSelMilestone(null);setView("mobilemenu");}} style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:12,cursor:"pointer",padding:"7px 9px",color:"#475569",display:"grid",placeItems:"center",fontSize:18,fontWeight:900,lineHeight:1}}>☰</button>
        <button title="Profilim" onClick={()=>setModal({type:"editProfile"})} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}><Avatar initials={currentUser.avatar} imageUrl={currentUser.avatarUrl} size={34} color={isAdmin?"#E11D48":"#4A6CF7"} /></button>
      </div>
    </div>}
    {/* Sidebar */}
    {!isMobile&&<div style={{ width:isMobile?220:254, background:"linear-gradient(180deg,#111827 0%,#172033 48%,#0F172A 100%)", display:"flex", flexDirection:"column", flexShrink:0,
      ...(isMobile?{ position:"fixed", top:0, left:mobileMenuOpen?0:-240, bottom:0, zIndex:960, transition:"left .25s ease", boxShadow:mobileMenuOpen?"4px 0 20px rgba(0,0,0,0.3)":"none" }:{}) }}>
      <div style={{ padding:"20px 16px 15px", borderBottom:"1px solid rgba(148,163,184,.18)", background:"radial-gradient(circle at top left,rgba(99,102,241,.28),transparent 42%)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button onClick={()=>{setAdminSection("overview");setView("dashboard");setSelProject(null);setMobileMenuOpen(false);}} style={{border:0,background:"transparent",display:"flex",alignItems:"center",gap:10,cursor:"pointer",minWidth:0}}><img src={tenantProfile.logoUrl||corjectLogo} alt="" style={{width:42,height:42,objectFit:"contain",filter:"drop-shadow(0 7px 14px rgba(99,102,241,.3))"}}/><span style={{fontFamily:"Aptos Display,Inter,Segoe UI,sans-serif",fontSize:18,fontWeight:850,color:"#fff",letterSpacing:.3,lineHeight:1,maxWidth:135,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tenantProfile.name}</span></button>
            <button onClick={()=>{ setView("notifications"); setSelProject(null); setMobileMenuOpen(false); }} style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:4 }}>
              <span style={{ color:"#94A3B8", display:"flex" }}><Icon name="bell" size={17} /></span>
              {(state.notifications||[]).filter(n=>isNotificationForUser(n,currentUser)&&!n.read).length>0&&<span style={{ position:"absolute", top:0, right:0, width:8, height:8, background:"#E11D48", borderRadius:"50%" }} />}
            </button>
          </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
          <button title="Profilim" onClick={()=>{setModal({type:"editProfile"});setMobileMenuOpen(false);}} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}><Avatar initials={currentUser.avatar} imageUrl={currentUser.avatarUrl} size={28} color={isAdmin?"#E11D48":"#4A6CF7"} /></button>
          <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", minHeight:28 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1 }}>{currentUser.name}</div>
          </div>
          <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", color:"#475569", fontSize:12, padding:2 }}>Çıkış</button>
        </div>
      </div>
      <nav className="sidebar-nav" style={{ padding:"12px 10px", flex:1, overflowY:"auto" }}>
        {nav.map(n=><button key={n.id} onClick={()=>{ if(n.id==="dashboard"||n.id==="admin")setAdminSection("overview"); setView(n.id); setSelProject(null); setSelMilestone(null); setMobileMenuOpen(false); if(n.id==="tickets")setTicketMineOnly(false); }}
          style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 11px", borderRadius:11, border:"1px solid "+(view===n.id&&!selProject?"rgba(255,255,255,.22)":"transparent"), cursor:"pointer", background:view===n.id&&!selProject?"linear-gradient(135deg,#4A6CF7,#7C3AED)":"transparent", color:view===n.id&&!selProject?"#fff":"#CBD5E1", fontSize:13, fontWeight:700, textAlign:"left", marginBottom:4, boxShadow:view===n.id&&!selProject?"0 10px 24px rgba(79,70,229,.28)":"none" }}>
          <span style={{ display:"flex", flexShrink:0, opacity:view===n.id&&!selProject?1:.82 }}><Icon name={n.icon} size={16} /></span> {n.label}
        </button>)}
      </nav>
    </div>}

    {/* Main */}
    <div style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column", paddingTop:isMobile?58:0, paddingBottom:isMobile?82:0 }}>
      {(view==="dashboard"||(view==="admin"&&!isAdmin))&&!selProject&&!useAdminHome&&(isMobile?<MobileHomePage state={state} setState={setState} currentUser={currentUser} myProjects={myProjects} deadlineWarnings={deadlineWarnings} onNavigate={v=>{setView(v);setSelProject(null);if(v==="projects")setProjectScope("all");if(v==="tickets")setTicketMineOnly(true);}} onOpenProject={id=>{setSelProject(id);setView("projects");setProjectTab("setup");}}/>:<DashboardPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} myProjects={myProjects} deadlineWarnings={deadlineWarnings} onNavigate={v=>{setView(v);setSelProject(null);if(v==="projects")setProjectScope("all");if(v==="tickets")setTicketMineOnly(true);}} onOpenProject={id=>{setSelProject(id);setView("projects");setProjectTab("setup");}}/>)}
      {((view==="admin"&&isAdmin)||(view==="dashboard"&&useAdminHome))&&!selProject&&<ManagementWorkspace state={state} setState={setState} currentUser={currentUser} initialSection={adminSection} onNavigate={v=>{if(v==="dashboard"||v==="admin")setAdminSection("overview");setView(v);setSelProject(null);}} onOpenProject={id=>{setSelProject(id);setView("projects");setProjectTab("setup");}} onEditPerson={person=>setModal({type:"editPerson",data:person})} onAddPerson={()=>setModal({type:"addPerson"})} onAssignTask={saveAdminAssignedTask}/>}
      {view==="todos"&&<TodoPage state={state} setState={setState} currentUser={currentUser}/>}
      {view==="mobilemenu"&&<MobileFeatureMenuPage isAdmin={isAdmin} onNavigate={target=>{setSelProject(null);setSelMilestone(null);if(target==="projects")setProjectScope("all");if(target==="tickets")setTicketMineOnly(true);setView(target);}}/>}
      {view==="ai"&&!selProject&&<AIWorkspace projects={visibleProjects}/>}
      {view==="import"&&isAdmin&&!selProject&&<ImportCenter state={state} setState={setState} currentUser={currentUser}/>}
      {view==="mailcenter"&&isAdmin&&!selProject&&<MailCenterPage state={state} setState={setState}/>}

      {/* PROJECT DETAIL */}
      {selProject&&project&&<div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <ProjectBusinessCard project={project} activePMs={activePMs} activeStakeholders={activeStakeholders} contacts={project.customerContacts||[]} progress={progress} doneT={doneT} totalT={totalT} currentMs={currentMs} readiness={readinessScore(project)} commissioningPercent={project.commissioningTracking?projectCommissioningPercent:null} overdueC={overdueC} criticalC={criticalC} canEdit={canManageProjectActions} onChange={data=>mutProject(item=>({...item,...data}))} onOpenSetup={()=>setProjectTab("setup")}/>
        <div style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:isMobile?"8px clamp(12px,2.2vw,22px) 10px":"0 clamp(12px,2.2vw,22px) 10px"}}>
          <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:3,scrollbarWidth:"thin"}}>
            {[["setup","projects","Proje Bilgileri"],["gantt","gantt","Proje Planı"],["tasks","tasks","Görevler"],["tickets","ticket","Ticketlar"],["actions","activity","Aksiyon"],["risks","risk","Riskler"],["notlar","notes","Notlar"],["projlogs","activity","Log"]].map(([id,icon,label])=><button key={id} onClick={()=>setProjectTab(id)} style={{padding:"7px 11px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:12,background:projectTab===id?(project.customerProfile?.accentColor||project.color):"#F1F5FF",color:projectTab===id?"#fff":"#64748B",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap",flexShrink:0}}><Icon name={icon} size={14}/>{label}</button>)}
          </div>
        </div>
        {false&&<div style={{ background:"#fff", borderBottom:"1px solid #E2E8F0", padding:"13px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{ width:11, height:11, borderRadius:"50%", background:project.color }} />
            <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"#1E293B", background:"#fff", borderRadius:6, padding:"2px 4px" }}>{project.name}</h2>
            <Badge label={project.status} />
            <button onClick={()=>setProjectTab("setup")} style={{border:0,background:readinessScore(project)>=Number(project.readinessThreshold||80)?"#ECFDF5":"#FFF1F2",color:readinessScore(project)>=Number(project.readinessThreshold||80)?"#047857":"#BE123C",borderRadius:12,padding:"3px 9px",fontSize:11,fontWeight:800,cursor:"pointer"}}>Başlangıç: {readinessScore(project)}/100</button>
            {project.commissioningTracking&&<span style={{background:"#ECFDF5",color:"#047857",borderRadius:12,padding:"3px 9px",fontSize:11,fontWeight:800}}>Devreye Alma: %{projectCommissioningPercent}</span>}
            {overdueC>0&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Gecikmiş: {overdueC}</span>}
            {criticalC>0&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Kritik: {criticalC}</span>}
          </div>
          <div style={{ display:"flex", gap:16, fontSize:12, color:"#64748B", flexWrap:"wrap", alignItems:"center" }}>
            {activePMs.length>0&&<span>PM: <b>{activePMs.map(p=>p.name).join(", ")}</b></span>}
            {activeStakeholders.map(item=><span key={item.id} style={{background:"#F8FAFC",borderRadius:7,padding:"2px 7px"}}>{item.role}: <b>{item.person.name}</b></span>)}
            {(project.customerContacts||[]).map(contact=><span key={contact.id} style={{background:"#F0F9FF",color:"#0369A1",borderRadius:7,padding:"3px 7px"}}><b>{contact.name}</b>{contact.title?` · ${contact.title}`:""}{contact.email?` · ${contact.email}`:""}{contact.phone?` · ${contact.phone}`:""}</span>)}
            <span>{fmt(project.startDate)} - {fmt(project.endDate)}</span>
            <span>{doneT}/{totalT} görev</span>
            {currentMs&&<span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"2px 9px", fontWeight:600 }}>Aktif: {currentMs.name} ({fmt(currentMs.dueDate)})</span>}
          </div>
          {totalT>0&&<div style={{ display:"flex", alignItems:"center", gap:9, marginTop:7 }}>
            <div style={{ flex:1, height:5, background:"#E2E8F0", borderRadius:10 }}><div style={{ width:`${progress}%`, height:"100%", background:project.color, borderRadius:10 }} /></div>
            <span style={{ fontSize:12, fontWeight:700, color:project.color }}>{progress}%</span>
          </div>}
          <div style={{ display:"flex", gap:5, marginTop:10, overflowX:"auto", paddingBottom:3, scrollbarWidth:"thin" }}>
            {[["setup","projects","Proje Bilgileri"],["gantt","gantt","Proje Planı"],["tasks","tasks","Görevler"],["tickets","ticket","Ticketlar"],["actions","activity","Aksiyon"],["risks","risk","Riskler"],["notlar","notes","Notlar"],["projlogs","activity","Log"]].map(([id,icon,label])=><button key={id} onClick={()=>setProjectTab(id)} style={{ padding:"7px 11px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:12, background:projectTab===id?project.color:"#F1F5FF", color:projectTab===id?"#fff":"#64748B", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap", flexShrink:0 }}><Icon name={icon} size={14}/>{label}</button>)}
          </div>
        </div>}

        {projectTab==="setup"&&<ProjectSetupPanel project={project} canEdit={canManageProjectActions} onChange={data=>mutProject(item=>({...item,...data}))} state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin}/>}
        {projectTab==="tasks"&&<div style={{ flex:1, overflow:"auto", padding:isMobile?"12px":"18px 22px" }}>
          <ResponsibilitySummary project={project} selected={responsibilityFilters} onChange={setResponsibilityFilters}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><h3 style={{margin:0,fontSize:15}}>Milestonelar</h3><span style={{fontSize:11,color:"#64748B"}}>Görevleri görmek için milestone seçin.</span></div>{isAdmin&&<Btn small onClick={()=>setModal({type:"addMilestone"})}>+ Milestone</Btn>}</div>
          {project.milestones.map(ms=>{const visibleTasks=responsibilityFilters.length?ms.tasks.filter(task=>responsibilityFilters.includes(task.responsibilityGroup||"Proje Ekibi")):ms.tasks;const filteredMilestone={...ms,tasks:visibleTasks};const open=selMilestone===ms.id;const done=visibleTasks.filter(t=>t.status==="Tamamland\u0131").length;if(responsibilityFilters.length&&!visibleTasks.length)return null;return <div key={ms.id} style={{background:"#fff",border:`1.5px solid ${open?project.color:"#E2E8F0"}`,borderRadius:12,marginBottom:9,overflow:"hidden"}}>
            <button onClick={()=>{setSelMilestone(open?null:ms.id);setShowDoneTasks(false);}} style={{width:"100%",border:"none",background:open?project.color+"0D":"#fff",padding:"13px 15px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left",fontFamily:"inherit"}}>
              <span style={{color:project.color,display:"flex"}}><Icon name="tasks" size={17}/></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:800,fontSize:13}}>{ms.name}</div><div style={{fontSize:11,color:"#64748B",marginTop:3}}>{fmt(ms.startDate)} - {fmt(ms.dueDate)} · {done}/{visibleTasks.length} tamamlandı</div></div><Badge label={ms.status}/><span style={{fontSize:17,color:"#64748B"}}>{open?"−":"+"}</span>
            </button>
            {open&&<div style={{padding:"13px 15px",borderTop:"1px solid #E2E8F0"}}><MilestoneTaskPanel milestone={filteredMilestone} project={project} people={state.people} isAdmin={isAdmin} showDone={showDoneTasks} setShowDone={setShowDoneTasks} onEdit={(item)=>setModal({type:"editMilestone",data:item})} onDelete={(id)=>{if(confirm("Silinsin mi?"))deleteMilestone(id);}} onAddTask={(msId)=>setModal({type:"addTask",msId})} onEditTask={(msId,task)=>setModal({type:"editTask",msId,data:task})} onDeleteTask={(msId,taskId)=>{if(confirm("Silinsin mi?"))deleteTask(msId,taskId);}} onCheckTask={(msId,taskId,c)=>updateTask(msId,taskId,{status:c?"Tamamland\u0131":"Bekliyor"})} onTimeTask={(msId,task)=>setModal({type:"timeLog",msId,data:task})}/></div>}
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

        {projectTab==="actions"&&<ProjectActionsPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} canManage={canManageProjectActions}/>}

        {projectTab==="risks"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px", maxWidth:680 }}>
          <RiskPanel risks={project.risks||[]} onAdd={()=>setModal({type:"addRisk"})} onUpdate={updateRisk} onDelete={deleteRisk} canEdit={isAdmin} />
        </div>}

        {projectTab==="tickets"&&<TicketsPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} />}
        {projectTab==="notlar"&&<ProjectNotesPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} canManage={canManageProjectActions} />}

        {projectTab==="projlogs"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
          <LogPage logs={state.logs.filter(l=>l.project===project.name)} projects={state.projects} />
        </div>}
      </div>}

      {/* PROJECTS LIST */}
      {view==="projects"&&!selProject&&<div style={{ padding:"22px 26px", flex:1, overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:18, flexWrap:"wrap" }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="projects" size={20}/>Projeler</h2><p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{listedProjects.length} proje</p></div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <input value={projectSearch} onChange={event=>setProjectSearch(event.target.value)} placeholder="Projelerde ara..." style={{...iStyle,width:220,maxWidth:"100%"}}/>
            <Btn variant="secondary" onClick={exportListedProjects}>XLSX İndir</Btn>
            <div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>
              {isAdmin&&<button onClick={()=>setProjectScope("all")} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontWeight:700,fontSize:11,background:projectScope==="all"?"#fff":"transparent",color:projectScope==="all"?"#4A6CF7":"#64748B"}}>Tüm Projeler</button>}
              <button onClick={()=>setProjectScope("mine")} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontWeight:700,fontSize:11,background:projectScope==="mine"||!isAdmin?"#fff":"transparent",color:projectScope==="mine"||!isAdmin?"#4A6CF7":"#64748B"}}>Projelerim</button>
            </div>
            <div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>
              {[["all","Tüm"],["connected","Connected Supplier"],["standard","Standart"]].map(([id,label])=><button key={id} onClick={()=>setProjectSegment(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontWeight:700,fontSize:11,background:projectSegment===id?"#fff":"transparent",color:projectSegment===id?"#4A6CF7":"#64748B"}}>{label}</button>)}
            </div>
            <div style={{display:"flex",background:"#E2E8F0",padding:3,borderRadius:10}}>
              {[["cards","Kart"],["list","Liste"]].map(([id,label])=><button key={id} onClick={()=>setProjectViewMode(id)} style={{border:0,borderRadius:8,padding:"7px 11px",cursor:"pointer",fontWeight:700,fontSize:11,background:projectViewMode===id?"#fff":"transparent",color:projectViewMode===id?"#4A6CF7":"#64748B"}}>{label}</button>)}
            </div>
            {isAdmin&&<Btn onClick={()=>setModal({type:"addProject"})}>+ Yeni Proje</Btn>}
          </div>
        </div>
        {listedProjects.length===0&&<div style={{ textAlign:"center", padding:"50px", background:"#fff", borderRadius:16, border:"1.5px dashed #E2E8F0" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Proje yok</div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addProject"})}>+ Proje Oluştur</Btn>}
        </div>}
        {projectViewMode==="list"&&<div style={{overflowX:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,marginBottom:14}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}><thead><tr>{["Proje","Müşteri","PM","Durum","İlerleme","Görev","Gecikme","Ticket","Makine"].map(label=><th key={label} style={{padding:"11px 10px",fontSize:10,color:"#64748B",background:"#F8FAFC",textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{listedProjects.map(project=>{const tasks=project.milestones.flatMap(milestone=>milestone.tasks||[]);const done=tasks.filter(task=>task.status==="Tamamlandı").length;const progress=tasks.length?Math.round(done/tasks.length*100):0;const delayed=tasks.filter(task=>delayLvl(task.dueDate,task.status)).length;const machines=project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[];const pms=projectPmIds(project).map(id=>state.people.find(person=>person.id===id)?.name).filter(Boolean).join(", ");return <tr key={project.id} onClick={()=>setExpandedProjectRows(current=>({...current,[project.id]:!current[project.id]}))} style={{borderTop:"1px solid #EEF2F7",cursor:"pointer"}}><td style={{padding:10,fontSize:12,fontWeight:850}}>{project.name}</td><td style={{padding:10,fontSize:11,color:"#64748B"}}>{project.customerProfile?.name||project.customerName||"-"}</td><td style={{padding:10,fontSize:11,color:"#475569"}}>{pms||"-"}</td><td style={{padding:10}}><Badge label={project.status}/></td><td style={{padding:10,fontSize:11,fontWeight:850,color:project.color}}>%{progress}</td><td style={{padding:10,fontSize:11}}>{done}/{tasks.length}</td><td style={{padding:10,fontSize:11,color:delayed?"#E11D48":"#64748B",fontWeight:delayed?850:600}}>{delayed}</td><td style={{padding:10,fontSize:11}}>{((state.projectTickets||{})[project.id]||[]).length}</td><td style={{padding:10,fontSize:11}}>{machines.filter(machine=>machine.commissioned).length}/{machines.length}</td></tr>;})}</tbody></table></div>}
        {projectViewMode==="list"&&listedProjects.filter(project=>expandedProjectRows[project.id]).map(project=><div key={`ms-${project.id}`} style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:14,padding:12,margin:"-4px 0 14px"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><b style={{fontSize:12}}>{project.name} · Milestonelar</b><Btn small onClick={()=>{setSelProject(project.id);setSelMilestone(null);setProjectTab("setup");}}>Projeyi Aç</Btn></div><div style={{display:"grid",gap:7}}>{project.milestones.map(milestone=>{const tasks=milestone.tasks||[];const done=tasks.filter(task=>task.status==="Tamamlandı").length;return <div key={milestone.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",gap:8,alignItems:"center",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"9px 10px"}}><span style={{minWidth:0,fontSize:11,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{milestone.name}</span><span style={{fontSize:10,color:"#64748B"}}>{done}/{tasks.length}</span><Badge label={milestone.status}/></div>;})}</div></div>)}
        <div style={{ display:projectViewMode==="cards"?"grid":"none", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:13 }}>
          {listedProjects.map(p=><ProjectListCard key={p.id} project={p} people={state.people} isAdmin={isAdmin} onOpen={()=>{setSelProject(p.id);setSelMilestone(null);setProjectTab("setup");}} onEdit={()=>setModal({type:"editProject",data:p})} onReport={()=>generateHTMLReport(p,state.people,state.logs)} onDelete={()=>confirm("Projeyi sil?")&&deleteProject(p.id)}/>)}
          {false&&listedProjects.map(p=>{
            const total=p.milestones.reduce((a,m)=>a+m.tasks.length,0);
            const done=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>t.status==="Tamamland\u0131").length,0);
            const prog=total?Math.round((done/total)*100):0;
            const overdue=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,0);
            const crit=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length,0);
            const pms=projectPmIds(p).map(id=>state.people.find(pe=>pe.id===id)).filter(Boolean);
            const stakeholders=projectStakeholders(p).map(item=>({...item,person:state.people.find(pe=>pe.id===item.userId)})).filter(item=>item.person);
            const aMs=p.milestones.find(m=>m.status!=="Tamamland\u0131");
            return <div key={p.id} onClick={()=>{ setSelProject(p.id); setSelMilestone(null); setProjectTab("setup"); }}
              style={{ background:"#fff", borderRadius:13, padding:"17px", border:"1.5px solid #E2E8F0", cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,0.04)", borderTop:`4px solid ${p.color}` }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none";}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:800, lineHeight:1.35, wordBreak:"break-word", overflowWrap:"anywhere" }}>{p.name}</h3><Badge label={p.status} />
              </div>
              {p.description&&<p style={{ margin:"0 0 7px", fontSize:12, color:"#64748B", lineHeight:1.45, wordBreak:"break-word", overflowWrap:"anywhere" }}>{p.description}</p>}
              {pms.length>0&&<div style={{ fontSize:11, color:"#64748B", marginBottom:3 }}>PM: <b>{pms.map(pm=>pm.name).join(", ")}</b></div>}
              {stakeholders.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>{stakeholders.slice(0,3).map(item=><span key={item.id} style={{fontSize:9,background:"#F1F5F9",color:"#64748B",borderRadius:6,padding:"2px 6px"}}>{item.role}: {item.person.name}</span>)}</div>}
              {aMs&&<div style={{ fontSize:11, color:"#4A6CF7", marginBottom:5, fontWeight:600 }}>Aktif: {aMs.name} — {fmt(aMs.dueDate)}</div>}
              <div style={{ display:"flex", gap:6, marginBottom:7, flexWrap:"wrap" }}>
                <span style={{background:readinessScore(p)>=Number(p.readinessThreshold||80)?"#ECFDF5":"#FFF1F2",color:readinessScore(p)>=Number(p.readinessThreshold||80)?"#047857":"#BE123C",borderRadius:10,padding:"2px 7px",fontSize:10,fontWeight:800}}>Başlangıç {readinessScore(p)}/100</span>
                {overdue>0&&<span style={{ background:"#FFF7ED", color:"#EA6C00", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>Gecikmiş: {overdue}</span>}
                {crit>0&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>Kritik: {crit}</span>}
              </div>
              <div style={{ height:4, background:"#F1F5FF", borderRadius:10 }}><div style={{ width:`${prog}%`, height:"100%", background:p.color, borderRadius:10 }} /></div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:7}}>
                <div style={{ fontSize:11, color:"#64748B" }}>{done}/{total} görev · {prog}%</div>
                {isAdmin&&<div style={{display:"flex",gap:4}}>
                  {[["edit","#EEF2FF","#4A6CF7",()=>setModal({type:"editProject",data:p}),"Düzenle"],["download","#ECFDF5","#059669",()=>generateHTMLReport(p,state.people,state.logs),"HTML rapor"],["trash","#FFF1F2","#E11D48",()=>confirm("Projeyi sil?")&&deleteProject(p.id),"Sil"]].map(([icon,bg,color,action,title])=><button key={icon} title={title} aria-label={title} onClick={e=>{e.stopPropagation();action();}} style={{width:28,height:28,border:0,borderRadius:7,background:bg,color,display:"grid",placeItems:"center",cursor:"pointer"}}><Icon name={icon} size={13}/></button>)}
                </div>}
              </div>
            </div>;
          })}
        </div>
      </div>}

      {view==="mytasks"&&<MyTasksPage currentUser={currentUser} state={state} setState={setState} addLog={addLog} isAdmin={isAdmin} initialTaskId={taskToOpen} onTaskOpened={()=>setTaskToOpen("")}/>}
      {view==="fieldops"&&<FieldOperationsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} onOpenProject={id=>{setSelProject(id);setView("projects");setProjectTab("actions");}}/>}
      {view==="fieldplan"&&<FieldPlanPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin}/>}
      {view==="fieldvisits"&&<FieldVisitsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} onOpenProject={id=>{setSelProject(id);setView("projects");setProjectTab("actions");}}/>}
      {view==="deadlines"&&<DeadlinePage warnings={deadlineWarnings} people={state.people} onOpenTask={id=>{setTaskToOpen(id);setView("mytasks");setSelProject(null);}} onOpenTodos={()=>setView("todos")}/>}
      {view==="tickets"&&<TicketsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} initialMine={ticketMineOnly}/>}
      {view==="reports"&&<ReportsPage state={state} people={state.people} isAdmin={isAdmin} />}

      {view==="people"&&<div style={{ padding:"22px 26px", flex:1, overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="people" size={20}/>Ekip</h2></div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addPerson"})}>+ Kişi Ekle</Btn>}
        </div>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:850,marginBottom:10}}>Organizasyonel Yapı</div>
          <SharedOrganizationPanel people={state.people} roles={organizationRoles(state)} onEdit={isAdmin?person=>setModal({type:"editPerson",data:person}):null}/>
        </div>
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
                <Avatar initials={p.avatar} imageUrl={p.avatarUrl} size={36} color={p.isAdmin?"#E11D48":"#4A6CF7"} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
                    {p.isAdmin&&<span style={{ background:"#FFF1F2", color:"#E11D48", borderRadius:6, padding:"1px 6px", fontSize:9, fontWeight:700 }}>YÖN</span>}
                  </div>
                  <div style={{ color:"#94A3B8", fontSize:11, marginTop:1 }}>{orgLevelLabel(p.orgLevel)}{p.email?` · ${p.email}`:""}{projC>0?` · ${projC} proje`:""}</div>
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
      {view==="notifications"&&<NotificationsPage notifications={state.notifications||[]} currentUser={currentUser} setState={setState} onOpenTask={id=>{setTaskToOpen(id);setView("mytasks");setSelProject(null);}} />}
    </div>

    {isMobile&&<MobileBottomNav view={view} isAdminMode={useAdminHome} taskCount={useAdminHome?managerAssignedOpenCount:myOpenTaskCount} deadlineCount={deadlineWarnings.length} onQuick={()=>setMobileQuickSheet(true)} onProfile={()=>setModal({type:"editProfile"})} onNavigate={target=>{setSelProject(null);setSelMilestone(null);if(target==="dashboard"){setAdminSection("overview");setView("dashboard");return;}if(target==="projects")setProjectScope("all");if(target==="tickets")setTicketMineOnly(true);if(target==="mytasks"&&useAdminHome){setAdminSection("assigned");setView("admin");return;}setView(target);}}/>}

    {/* MODALS */}
    {modal?.type==="addProject"&&<AddProjectModal onClose={()=>setModal(null)} onSave={addProject} people={state.people} roles={organizationRoles(state)} />}
    {modal?.type==="editProject"&&<ProjectModal title="Projeyi Düzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(data)=>updateProjectById(modal.data.id,data)} people={state.people} roles={organizationRoles(state)} />}
    {modal?.type==="addMilestone"&&<MilestoneModal title="Yeni Milestone" onClose={()=>setModal(null)} onSave={addMilestone} />}
    {modal?.type==="editMilestone"&&<MilestoneModal title="Milestone Duzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(d)=>updateMilestone(modal.data.id,d)} />}
    {modal?.type==="addTask"&&<SharedTaskModal title="Yeni Görev" onClose={()=>setModal(null)} onSave={(d)=>addTask(modal.msId,d)} people={state.people} waitOptions={WAIT} responsibilityGroups={RESPONSIBILITY_GROUPS} />}
    {modal?.type==="editTask"&&<SharedTaskModal title="Görevi Düzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(d)=>updateTask(modal.msId,modal.data.id,d)} people={state.people} waitOptions={WAIT} responsibilityGroups={RESPONSIBILITY_GROUPS} />}
    {modal?.type==="addPerson"&&<PersonModal people={state.people} roles={organizationRoles(state)} onClose={()=>setModal(null)} onSave={addPerson} />}
    {modal?.type==="editPerson"&&<UserEditModal title="Kullanıcıyı Düzenle" person={modal.data} people={state.people} roles={organizationRoles(state)} allowAdmin onClose={()=>setModal(null)} onSave={(d)=>updatePerson(modal.data.id,d)} />}
    {modal?.type==="personDetail"&&<PersonDetailModal person={modal.data} projects={state.projects} personalTasks={state.personalTasks} onClose={()=>setModal(null)} />}
    {modal?.type==="addRisk"&&<RiskModal onClose={()=>setModal(null)} onSave={addRisk} />}
    {modal?.type==="editProfile"&&<UserEditModal title="Profilimi Düzenle" person={currentUser} onClose={()=>setModal(null)} onSave={(d)=>updatePerson(currentUser.id,d)} />}
    {modal?.type==="timeLog"&&<SharedTimeLogModal task={(project?.milestones.find(m=>m.id===modal.msId)?.tasks.find(t=>t.id===modal.data.id))||modal.data} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onSave={(entries)=>updateTask(modal.msId,modal.data.id,{timeEntries:entries})} />}
    {modal?.type==="addPersonal"&&<SharedPersonalTaskModal title="Görev Ata" people={state.people} projects={state.projects} isAdmin currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} onClose={()=>setModal(null)} onSave={saveAdminAssignedTask} />}
    {mobileQuickSheet&&<MobileQuickSheet isAdminMode={useAdminHome} onClose={()=>setMobileQuickSheet(false)} onSelect={target=>{setMobileQuickSheet(false);if(target==="assign"){setModal({type:"addPersonal"});return;}if(target==="todo"||target==="action")setMobileQuick(target);else{setSelProject(null);setSelMilestone(null);if(target==="ticket")setTicketMineOnly(true);setView(target==="ticket"?"tickets":target);}}}/>}
    {mobileQuick==="todo"&&<QuickTodoModal projects={state.projects} onClose={()=>setMobileQuick(null)} onSave={saveMobileQuickTodo}/>}
    {mobileQuick==="action"&&<QuickActionModal projects={state.projects} onClose={()=>setMobileQuick(null)} onSave={saveMobileQuickAction}/>}
  </div></>;
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
  const [mailNotice,setMailNotice]=useState("");
  const tickets=((state.projectTickets||{})[project.id])||[];
  const saveTickets=(t)=>setState(s=>({...s,projectTickets:{...(s.projectTickets||{}),[project.id]:t}}));
  const addTicket=async(data)=>{
    const createdAt=now();
    const ticket={id:uid(),ticketNo:nextTicketNumber(state),ts:createdAt,updatedAt:createdAt,author:currentUser.name,history:[{id:uid(),ts:createdAt,userId:currentUser.id,userName:currentUser.name,label:"Ticket",from:"-",to:"Oluşturuldu"}],...data};
    saveTickets([...tickets,ticket]);
    const result=await createTicketWithNotification(project.id,ticket);
    if(result.ticket?.ticketNo)saveTickets([...tickets,{...ticket,...result.ticket}]);
    setMailNotice(result.notification?.sent?"Ticket oluşturuldu ve atama maili gönderildi.":`Ticket oluşturuldu; mail gönderilemedi: ${result.notification?.reason||"Bilinmeyen hata"}`);
    return result;
  };
  const updateTicket=(id,data)=>{
    const old=tickets.find(t=>t.id===id);
    const workflowData=applyTicketWorkflow(data);
    const updated={...old,...workflowData,updatedAt:now(),history:[...(old?.history||[]),...ticketChangeLog(old,workflowData,currentUser)]};
    saveTickets(tickets.map(t=>t.id===id?updated:t));
    if(workflowData.assignedTo&&workflowData.assignedTo!==old?.assignedTo)notifyTicketAssignment(project.id,updated).catch(error=>console.warn("Ticket maili gönderilemedi",error));
  };
  const deleteTicket=(id)=>saveTickets(tickets.filter(t=>t.id!==id));
  const TICKET_TYPES=["Bug","Görev","İyileştirme","Soru","Bilgi"];
  const TICKET_PRIOS=["Düşük","Orta","Yüksek","Kritik"];
  const TYPE_COLORS={"Bug":"#E11D48","Görev":"#4A6CF7","İyileştirme":"#059669","Soru":"#EA6C00","Bilgi":"#94A3B8"};
  return <div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
      <h3 style={{ margin:0, fontSize:15, fontWeight:800 }}>Ticketlar ({tickets.length})</h3>
      <Btn small onClick={()=>setModal({type:"add"})}>+ Ticket Ekle</Btn>
    </div>
    {mailNotice&&<div style={{background:mailNotice.includes("gönderildi")?"#ECFDF5":"#FFF7ED",color:mailNotice.includes("gönderildi")?"#047857":"#C2410C",borderRadius:10,padding:"10px 13px",fontSize:11,fontWeight:700,marginBottom:12}}>{mailNotice}</div>}
    <RecurringProblemsPanel entries={tickets.map(ticket=>({ticket,project}))}/>
    {tickets.length===0&&<div style={{ textAlign:"center", padding:"40px", background:"#fff", borderRadius:12, border:"1.5px dashed #E2E8F0", color:"#94A3B8" }}>Henüz ticket yok.</div>}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {[...tickets].sort((a,b)=>String(b.updatedAt||b.ts||"").localeCompare(String(a.updatedAt||a.ts||""))).map(t=><div key={t.id} onClick={()=>setModal({type:"detail",data:t})} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:"1.5px solid #E2E8F0", display:"flex", gap:12, alignItems:"flex-start", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", cursor:"pointer" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:TYPE_COLORS[t.type]||"#94A3B8", marginTop:4, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:4 }}>
            <span style={{background:"#EEF2FF",color:"#4338CA",borderRadius:7,padding:"2px 7px",fontSize:10,fontWeight:850}}>{ticketNumber(t)}</span>
            <span style={{ fontWeight:700, fontSize:13 }}>{t.title}</span>
            <span style={{ background:(TYPE_COLORS[t.type]||"#94A3B8")+"22", color:TYPE_COLORS[t.type]||"#94A3B8", borderRadius:8, padding:"1px 8px", fontSize:11, fontWeight:600 }}>{t.type}</span>
            <span style={{ background:"#F1F5FF", color:"#4A6CF7", borderRadius:8, padding:"1px 8px", fontSize:11 }}>{t.priority}</span>
            {(t.jiraKey||t.jiraId)&&<a href={t.jiraLink||"#"} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ background:"#DEEBFF", color:"#0052CC", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:700, textDecoration:"none" }}>{t.jiraKey||t.jiraId}</a>}
            {t.jiraStatus&&<span style={{ background:"#E8F5E9", color:"#16794A", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:700 }}>Jira: {t.jiraStatus}</span>}
            <select value={t.status||"Açık"} onClick={e=>e.stopPropagation()} onChange={e=>updateTicket(t.id,{status:e.target.value})} style={{ fontSize:11, borderRadius:6, border:"1px solid #E2E8F0", padding:"2px 6px", fontFamily:"inherit" }}>
              {!TICKET_STATUSES.includes(t.status)&&t.status&&<option>{t.status}</option>}
              {TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          {t.description&&<div style={{ fontSize:12, color:"#64748B", marginBottom:4 }}>{t.description}</div>}
          <div style={{ fontSize:11, color:"#94A3B8" }}>{t.author} · {new Date(t.ts).toLocaleDateString("tr-TR")}</div>
          {t.assignedTo&&<div style={{fontSize:11,color:"#4A6CF7",marginTop:3}}>Sorumlu: {state.people.find(p=>p.id===t.assignedTo)?.name||"Atanmamış"}</div>}
        </div>
        {(isAdmin||t.author===currentUser.name)&&<button onClick={e=>{e.stopPropagation();deleteTicket(t.id);}} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:16 }}>×</button>}
      </div>)}
    </div>
    {modal?.type==="add"&&<Modal title="Ticket Ekle" onClose={()=>setModal(null)}>
      <TicketForm project={project} onSave={async d=>{await addTicket(d);setModal(null);}} onClose={()=>setModal(null)} types={TICKET_TYPES} prios={TICKET_PRIOS} people={state.people} />
    </Modal>}
    {modal?.type==="detail"&&<TicketDetail ticket={tickets.find(t=>t.id===modal.data.id)||modal.data} canEdit={isAdmin||modal.data.author===currentUser.name} onClose={()=>setModal(null)} onUpdate={(data)=>updateTicket(modal.data.id,data)} onResend={()=>notifyTicketAssignment(project.id,tickets.find(t=>t.id===modal.data.id)||modal.data)} types={TICKET_TYPES} prios={TICKET_PRIOS} people={state.people} />}
  </div>;
}
function RecurringProblemsPanel({entries=[]}) {
  const normalize=value=>String(value||"").toLocaleLowerCase("tr-TR").replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const groups=new Map();
  entries.forEach(({ticket,project})=>{
    const explicit=String(ticket.recurrenceKey||"").trim();
    const key=explicit?`key:${normalize(explicit)}`:`title:${normalize(ticket.category)}:${normalize(ticket.title)}`;
    if(!normalize(ticket.title))return;
    const current=groups.get(key)||{label:explicit||ticket.title,explicit:Boolean(explicit),items:[],effort:0,projects:new Set()};
    current.items.push(ticket);
    current.effort+=Number(ticket.effortHours||0);
    if(project?.name)current.projects.add(project.name);
    groups.set(key,current);
  });
  const repeated=[...groups.values()].filter(group=>group.items.length>1).sort((a,b)=>b.effort-a.effort||b.items.length-a.items.length);
  if(!repeated.length)return <div style={{padding:42,textAlign:"center",background:"#fff",border:"1px dashed #CBD5E1",borderRadius:14,color:"#64748B"}}><b>Tekrar eden problem bulunmuyor.</b><div style={{fontSize:10,marginTop:5}}>Problem kodu veya benzer başlıkla eşleşen en az iki ticket burada görünür.</div></div>;
  return <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:16,marginBottom:13}}>
    <div style={{fontSize:14,fontWeight:900,color:"#172033",marginBottom:3}}>Tekrar Eden Problemler</div><div style={{fontSize:10,color:"#64748B",marginBottom:12}}>Yeniden efor harcanan konuları kök neden ve çözüm standardı için izleyin.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:9}}>{repeated.map(group=><div key={`${group.label}-${group.items.length}`} style={{background:"linear-gradient(145deg,#FFF7ED,#fff)",border:"1px solid #FED7AA",borderRadius:11,padding:"12px 13px",fontSize:10,color:"#475569"}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><b style={{fontSize:12,color:"#7C2D12"}}>{group.label}</b><span style={{background:"#FFEDD5",color:"#C2410C",borderRadius:12,padding:"2px 7px",fontWeight:900}}>{group.items.length} kez</span></div><div style={{marginTop:8}}>{group.effort.toFixed(1)} saat efor · {[...group.projects].length} proje</div><span style={{display:"block",color:"#94A3B8",marginTop:4}}>{group.explicit?"Ortak problem koduyla eşleşti":"Başlık benzerliğine göre aday"}</span></div>)}</div>
  </div>;
}
function TicketForm({ project, onSave, onClose, types, prios, people }) {
  const [f,setF]=useState({ title:"", customer:project?.customerProfile?.name||project?.customerName||project?.name||"", module:(project?.activeModules||[])[0]||"", subModule:"", functionButton:"", pageUrl:"", type:"Görev", category:"Operasyonel", ownerTeam:"Operasyon", priority:"Orta", description:"", requestRequirements:[""], completionCriteria:[""], status:"Açık", jiraKey:"", assignedTo:"", testResult:"", recurrenceKey:"", rootCause:"", resolution:"", effortHours:"" });
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  const updList=(key,index,value)=>setF(s=>({...s,[key]:(s[key]||[]).map((item,i)=>i===index?value:item)}));
  const addListItem=key=>setF(s=>({...s,[key]:[...(s[key]||[]),""]}));
  const removeListItem=(key,index)=>setF(s=>({...s,[key]:(s[key]||[]).filter((_,i)=>i!==index)}));
  const submit=async()=>{
    if(!f.title.trim())return;
    const jiraKey=f.jiraKey.trim().toUpperCase();
    const normalized={...f,requestRequirements:(f.requestRequirements||[]).map(item=>item.trim()).filter(Boolean),completionCriteria:(f.completionCriteria||[]).map(item=>item.trim()).filter(Boolean)};
    setSaving(true);setError("");
    try{await onSave({...normalized,jiraKey,jiraId:jiraKey});}
    catch(e){setError(e?.message||"Ticket oluşturulamadı.");}
    finally{setSaving(false);}
  };
  return <div>
    <Field label="Başlık *"><input style={iStyle} value={f.title} onChange={e=>upd("title",e.target.value)} /></Field>
    <div style={{background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:12,padding:12,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:900,color:"#475569",marginBottom:9}}>Standart Talep Bilgileri</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <Field label="Müşteri"><input style={iStyle} value={f.customer} onChange={e=>upd("customer",e.target.value)} /></Field>
        <Field label="İlgili Modül"><select style={iStyle} value={f.module} onChange={e=>upd("module",e.target.value)}><option value="">Modül seçin</option>{DEFAULT_ACTIVE_MODULES.map(module=><option key={module}>{module}</option>)}</select></Field>
        <Field label="İlgili Alt Modül"><input style={iStyle} value={f.subModule} onChange={e=>upd("subModule",e.target.value)} /></Field>
        <Field label="Fonksiyon / Buton"><input style={iStyle} value={f.functionButton} onChange={e=>upd("functionButton",e.target.value)} /></Field>
      </div>
      <Field label="Sistem Sayfa URL"><input style={iStyle} value={f.pageUrl} onChange={e=>upd("pageUrl",e.target.value)} placeholder="https://..." /></Field>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
      <Field label="Tip"><select style={iStyle} value={f.type} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
      <Field label="Öncelik"><select style={iStyle} value={f.priority} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
    </div>
    <Field label="Durum"><select style={iStyle} value={f.status} onChange={e=>upd("status",e.target.value)}>{TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
      <Field label="Kategori"><select style={iStyle} value={f.category} onChange={e=>upd("category",e.target.value)}>{TICKET_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></Field>
      <Field label="Sahip Ekip"><select style={iStyle} value={f.ownerTeam} onChange={e=>upd("ownerTeam",e.target.value)}>{["Operasyon","Ürün","Yazılım"].map(team=><option key={team}>{team}</option>)}</select></Field>
    </div>
    <Field label="Talep Açıklaması"><textarea style={{ ...iStyle, height:80, resize:"vertical" }} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <StepListEditor title="Talep İsterleri" items={f.requestRequirements} onAdd={()=>addListItem("requestRequirements")} onRemove={index=>removeListItem("requestRequirements",index)} onChange={(index,value)=>updList("requestRequirements",index,value)}/>
    <StepListEditor title="Tamamlanma Kriterleri" items={f.completionCriteria} onAdd={()=>addListItem("completionCriteria")} onRemove={index=>removeListItem("completionCriteria",index)} onChange={(index,value)=>updList("completionCriteria",index,value)}/>
    <Field label="Atanan Kullanıcı"><select style={iStyle} value={f.assignedTo} onChange={e=>upd("assignedTo",e.target.value)}><option value="">- Atanmamış -</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}{person.email?` · ${person.email}`:""}</option>)}</select></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
      <Field label="Tekrar Eden Problem Kodu"><input style={iStyle} value={f.recurrenceKey} onChange={e=>upd("recurrenceKey",e.target.value)} placeholder="Örn. VPN-KOPMA"/></Field>
      <Field label="Harcanan Efor (saat)"><input type="number" min="0" step="0.25" style={iStyle} value={f.effortHours} onChange={e=>upd("effortHours",e.target.value)}/></Field>
    </div>
    <Field label="Jira Task Key"><input style={iStyle} value={f.jiraKey} onChange={e=>upd("jiraKey",e.target.value)} placeholder="PROJ-123" /></Field>
    <div style={{ fontSize:11, color:"#64748B", marginBottom:11 }}>Mevcut bir Jira taskıyla ilişkilendirmek için issue key girin.</div>
    {error&&<div style={{background:"#FFF1F2",color:"#BE123C",borderRadius:8,padding:"8px 10px",fontSize:11,fontWeight:700,marginBottom:10}}>{error}</div>}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" disabled={saving} onClick={onClose}>İptal</Btn><Btn disabled={saving} onClick={submit}>{saving?"Kaydediliyor...":"Kaydet"}</Btn></div>
  </div>;
}

function StepListEditor({title,items=[],onAdd,onRemove,onChange}) {
  return <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}>
      <label style={{fontSize:12,fontWeight:750,color:"#334155"}}>{title}</label>
      <button type="button" onClick={onAdd} style={{border:0,borderRadius:8,background:"#EEF2FF",color:"#4338CA",fontSize:10,fontWeight:900,padding:"5px 8px",cursor:"pointer"}}>+ Adım</button>
    </div>
    <div style={{display:"grid",gap:7}}>
      {(items.length?items:[""]).map((item,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"auto minmax(0,1fr) auto",gap:7,alignItems:"center"}}>
        <span style={{width:22,height:22,borderRadius:8,display:"grid",placeItems:"center",background:"#F1F5F9",color:"#64748B",fontSize:10,fontWeight:900}}>{index+1}</span>
        <input style={{...iStyle,minWidth:0}} value={item} onChange={event=>onChange(index,event.target.value)} placeholder={`${title} adımı`}/>
        <button type="button" onClick={()=>onRemove(index)} style={{border:0,background:"transparent",color:"#E11D48",fontSize:16,cursor:"pointer"}}>×</button>
      </div>)}
    </div>
  </div>;
}

function TicketDetail({ ticket, canEdit, onClose, onUpdate, onResend, types, prios, people=[] }) {
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState(ticket);
  const [jira,setJira]=useState(null);
  const [loading,setLoading]=useState(Boolean(ticket.jiraKey||ticket.jiraId));
  const [error,setError]=useState("");
  const [mailStatus,setMailStatus]=useState({loading:false,message:"",error:false});
  const jiraKey=(ticket.jiraKey||ticket.jiraId||"").trim().toUpperCase();
  const upd=(k,v)=>setForm(s=>({...s,[k]:v}));
  const refreshJira=async()=>{
    if(!jiraKey)return;
    setLoading(true);
    setError("");
    try{
      const issue=await getJiraIssue(jiraKey);
      setJira(issue);
      onUpdate({jiraKey:issue.key,jiraId:issue.key,jiraIssueId:issue.id,jiraLink:issue.url,jiraStatus:issue.status,jiraSummary:issue.summary,jiraDescription:issue.description,jiraAssignee:issue.assignee,jiraIssueType:issue.issueType,jiraPriority:issue.priority,jiraUpdatedAt:now()});
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
      onUpdate({jiraKey:issue.key,jiraId:issue.key,jiraIssueId:issue.id,jiraLink:issue.url,jiraStatus:issue.status,jiraSummary:issue.summary,jiraDescription:issue.description,jiraAssignee:issue.assignee,jiraIssueType:issue.issueType,jiraPriority:issue.priority,jiraUpdatedAt:now()});
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
  const resend=async()=>{
    if(!ticket.assignedTo)return;
    setMailStatus({loading:true,message:"",error:false});
    try{
      const result=await onResend();
      setMailStatus({loading:false,message:`Mail gönderildi${result.emailId?` (${result.emailId})`:""}.`,error:false});
    }catch(e){
      setMailStatus({loading:false,message:e?.message||"Mail gönderilemedi.",error:true});
    }
  };
  return <Modal title={`${ticketNumber(ticket)} · ${ticket.title}`} onClose={onClose} wide>
    {editing?<div>
      <Field label="Başlık"><input style={iStyle} value={form.title||""} onChange={e=>upd("title",e.target.value)} /></Field>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
        <Field label="Tip"><select style={iStyle} value={form.type||"Görev"} onChange={e=>upd("type",e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Öncelik"><select style={iStyle} value={form.priority||"Orta"} onChange={e=>upd("priority",e.target.value)}>{prios.map(p=><option key={p}>{p}</option>)}</select></Field>
      </div>
      <Field label="Durum"><select style={iStyle} value={form.status||"Açık"} onChange={e=>upd("status",e.target.value)}>{!TICKET_STATUSES.includes(form.status)&&form.status&&<option>{form.status}</option>}{TICKET_STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <Field label="Kategori"><select style={iStyle} value={form.category||"Operasyonel"} onChange={e=>upd("category",e.target.value)}>{TICKET_CATEGORIES.map(category=><option key={category}>{category}</option>)}</select></Field>
        <Field label="Sahip Ekip"><select style={iStyle} value={form.ownerTeam||"Operasyon"} onChange={e=>upd("ownerTeam",e.target.value)}>{["Operasyon","Ürün","Yazılım"].map(team=><option key={team}>{team}</option>)}</select></Field>
      </div>
      <Field label="Açıklama"><textarea style={{...iStyle,height:90,resize:"vertical"}} value={form.description||""} onChange={e=>upd("description",e.target.value)} /></Field>
      <Field label="Atanan Kullanıcı"><select style={iStyle} value={form.assignedTo||""} onChange={e=>upd("assignedTo",e.target.value)}><option value="">- Atanmamış -</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <Field label="Test Sonucu"><select style={iStyle} value={form.testResult||""} onChange={e=>upd("testResult",e.target.value)}><option value="">- Test yok -</option>{["Bekliyor","Başarılı","Başarısız"].map(result=><option key={result}>{result}</option>)}</select></Field>
        <Field label="Efor (saat)"><input type="number" min="0" step="0.25" style={iStyle} value={form.effortHours||""} onChange={e=>upd("effortHours",e.target.value)}/></Field>
      </div>
      <Field label="Tekrar Eden Problem Kodu"><input style={iStyle} value={form.recurrenceKey||""} onChange={e=>upd("recurrenceKey",e.target.value)} placeholder="Aynı problem için ortak kod"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}><Field label="Müşteri Onay Yetkilisi"><input style={iStyle} value={form.customerApproval?.name||""} onChange={e=>upd("customerApproval",{...(form.customerApproval||{}),name:e.target.value})} placeholder="Ad Soyad"/></Field><Field label="Müşteri Onay E-postası"><input type="email" style={iStyle} value={form.customerApproval?.email||""} onChange={e=>upd("customerApproval",{...(form.customerApproval||{}),email:e.target.value})}/></Field></div>
      <Field label="Kök Neden"><textarea style={{...iStyle,height:65,resize:"vertical"}} value={form.rootCause||""} onChange={e=>upd("rootCause",e.target.value)}/></Field>
      <Field label="Kalıcı Çözüm"><textarea style={{...iStyle,height:65,resize:"vertical"}} value={form.resolution||""} onChange={e=>upd("resolution",e.target.value)}/></Field>
      <Field label="Jira Task Key"><input style={iStyle} value={form.jiraKey||form.jiraId||""} onChange={e=>upd("jiraKey",e.target.value)} placeholder="PROJ-123" /></Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7}}><Btn variant="ghost" onClick={()=>setEditing(false)}>İptal</Btn><Btn onClick={save}>Kaydet</Btn></div>
    </div>:<div>
      {ticket.description&&<div style={{fontSize:13,color:"#475569",lineHeight:1.6,marginBottom:16}}>{ticket.description}</div>}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><span style={{background:"#F1F5FF",color:"#4A6CF7",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.type}</span><span style={{background:"#FFF7ED",color:"#EA6C00",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.priority}</span><span style={{background:"#F8FAFC",color:"#64748B",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.status}</span><span style={{background:"#F5F3FF",color:"#7C3AED",borderRadius:8,padding:"3px 9px",fontSize:11}}>{ticket.category||"Operasyonel"} · {ticket.ownerTeam||"Operasyon"}</span>{ticket.testResult&&<span style={{background:ticket.testResult==="Başarısız"?"#FFF1F2":"#ECFDF5",color:ticket.testResult==="Başarısız"?"#BE123C":"#047857",borderRadius:8,padding:"3px 9px",fontSize:11}}>Test: {ticket.testResult}</span>}</div>
      {(ticket.customer||ticket.module||ticket.subModule||ticket.functionButton||ticket.pageUrl||(ticket.requestRequirements||[]).length||(ticket.completionCriteria||[]).length)&&<div style={{border:"1px solid #E2E8F0",borderRadius:12,padding:13,background:"#fff",marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:12,marginBottom:10}}>Standart Talep Bilgileri</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8,fontSize:11,color:"#475569",marginBottom:10}}>
          {ticket.customer&&<div><b>Müşteri:</b> {ticket.customer}</div>}
          {ticket.module&&<div><b>İlgili Modül:</b> {ticket.module}</div>}
          {ticket.subModule&&<div><b>İlgili Alt Modül:</b> {ticket.subModule}</div>}
          {ticket.functionButton&&<div><b>Fonksiyon / Buton:</b> {ticket.functionButton}</div>}
          {ticket.pageUrl&&<div><b>Sistem Sayfa URL:</b> <a href={ticket.pageUrl} target="_blank" rel="noreferrer" style={{color:"#4A6CF7"}}>{ticket.pageUrl}</a></div>}
        </div>
        {(ticket.requestRequirements||[]).length>0&&<div style={{marginTop:8}}><b style={{fontSize:11}}>Talep İsterleri</b><ol style={{margin:"6px 0 0 18px",fontSize:11,color:"#475569",lineHeight:1.6}}>{ticket.requestRequirements.map((item,index)=><li key={index}>{item}</li>)}</ol></div>}
        {(ticket.completionCriteria||[]).length>0&&<div style={{marginTop:8}}><b style={{fontSize:11}}>Tamamlanma Kriterleri</b><ol style={{margin:"6px 0 0 18px",fontSize:11,color:"#475569",lineHeight:1.6}}>{ticket.completionCriteria.map((item,index)=><li key={index}>{item}</li>)}</ol></div>}
      </div>}
      {ticket.assignedTo&&<div style={{fontSize:12,color:"#4A6CF7",marginBottom:14}}>Atanan: <b>{people.find(person=>person.id===ticket.assignedTo)?.name||"Bilinmiyor"}</b></div>}
      {mailStatus.message&&<div style={{fontSize:11,fontWeight:700,color:mailStatus.error?"#BE123C":"#059669",background:mailStatus.error?"#FFF1F2":"#ECFDF5",borderRadius:8,padding:"8px 10px",marginBottom:12}}>{mailStatus.message}</div>}
      <div style={{border:"1.5px solid #DDE7F5",borderRadius:12,padding:14,background:"#F8FBFF",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:jiraKey?10:0}}><div style={{fontWeight:800,fontSize:13,color:"#0052CC"}}>Jira Task</div>{jiraKey&&<button onClick={refreshJira} disabled={loading} style={{border:"none",background:"none",color:"#4A6CF7",fontSize:11,cursor:"pointer"}}>{loading?"Güncelleniyor...":"Yenile"}</button>}</div>
        {!jiraKey&&<div style={{fontSize:12,color:"#64748B"}}>Bu ticket henüz bir Jira taskıyla ilişkilendirilmemiş.</div>}
        {jiraKey&&error&&<div style={{fontSize:11,color:"#BE123C",background:"#FFF1F2",borderRadius:7,padding:"7px 9px",marginBottom:9}}>{error} Son alınan bilgiler gösteriliyor.</div>}
        {jiraKey&&<div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:8}}><strong style={{fontSize:13}}>{jiraKey}</strong><span style={{background:"#E8F5E9",color:"#16794A",borderRadius:7,padding:"2px 8px",fontSize:11,fontWeight:700}}>{jira?.status||ticket.jiraStatus||"Durum alınıyor..."}</span></div>
          {(jira?.summary||ticket.jiraSummary)&&<div style={{fontSize:12,fontWeight:750,color:"#334155",marginBottom:7}}>{jira?.summary||ticket.jiraSummary}</div>}
          {(jira?.description||ticket.jiraDescription)&&<div style={{fontSize:11,color:"#475569",lineHeight:1.55,whiteSpace:"pre-wrap",background:"#fff",borderRadius:8,padding:"9px 10px",marginBottom:9}}>{jira?.description||ticket.jiraDescription}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",fontSize:10,color:"#64748B",marginBottom:9}}>{(jira?.issueType||ticket.jiraIssueType)&&<span>Tip: <b>{jira?.issueType||ticket.jiraIssueType}</b></span>}{(jira?.priority||ticket.jiraPriority)&&<span>Öncelik: <b>{jira?.priority||ticket.jiraPriority}</b></span>}{(jira?.assignee||ticket.jiraAssignee)&&<span>Sorumlu: <b>{jira?.assignee||ticket.jiraAssignee}</b></span>}</div>
          {(jira?.url||ticket.jiraLink)&&<a href={jira?.url||ticket.jiraLink} target="_blank" rel="noreferrer" style={{display:"inline-block",background:"#0052CC",color:"#fff",borderRadius:8,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>Jira'da Aç</a>}
        </div>}
      </div>
      {(ticket.recurrenceKey||ticket.rootCause||ticket.resolution||ticket.effortHours)&&<div style={{border:"1px solid #E2E8F0",borderRadius:12,padding:13,background:"#fff",marginBottom:16}}><div style={{fontWeight:800,fontSize:12,marginBottom:8}}>Problem Bilgisi</div><div style={{display:"grid",gap:6,fontSize:11,color:"#475569"}}>{ticket.recurrenceKey&&<div>Tekrar kodu: <b>{ticket.recurrenceKey}</b></div>}{ticket.effortHours&&<div>Efor: <b>{ticket.effortHours} saat</b></div>}{ticket.rootCause&&<div><b>Kök neden:</b> {ticket.rootCause}</div>}{ticket.resolution&&<div><b>Kalıcı çözüm:</b> {ticket.resolution}</div>}</div></div>}
      <div style={{border:"1px solid #C7D2FE",borderRadius:12,padding:13,background:"#EEF2FF",marginBottom:16}}><div style={{fontWeight:800,fontSize:12,color:"#3730A3"}}>Müşteri Kabulü</div><div style={{fontSize:11,color:"#64748B",margin:"5px 0 10px"}}>{ticket.customerApproval?.name||"Onay yetkilisi belirlenmedi"}{ticket.customerApproval?.email?` · ${ticket.customerApproval.email}`:""} · {ticket.customerApproval?.status==="approved"?"Onaylandı":ticket.customerApproval?.status==="rejected"?"Reddedildi":ticket.customerApproval?.status==="pending"?"Onay bekleniyor":"Henüz istenmedi"}</div>{canEdit&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn small onClick={()=>onUpdate({status:"Müşteri Onayında",customerApproval:{...(ticket.customerApproval||{}),status:"pending",requestedAt:now()}})}>Onaya Gönder</Btn><Btn small variant="success" onClick={()=>onUpdate({status:"Tamamlandı",customerApproval:{...(ticket.customerApproval||{}),status:"approved",respondedAt:now()}})}>Onaylandı</Btn><Btn small variant="danger" onClick={()=>onUpdate({status:"Müşteri Reddetti",customerApproval:{...(ticket.customerApproval||{}),status:"rejected",respondedAt:now()}})}>Reddedildi</Btn></div>}</div>
      <div style={{border:"1px solid #E2E8F0",borderRadius:12,padding:13,background:"#F8FAFC",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:12,marginBottom:9}}>Ticket Geçmişi</div>
        <div style={{display:"grid",gap:7}}>{[...(ticket.history||[])].reverse().map(entry=><div key={entry.id} style={{fontSize:10,color:"#475569",display:"grid",gridTemplateColumns:"110px 1fr",gap:8}}><span style={{color:"#94A3B8"}}>{new Date(entry.ts).toLocaleString("tr-TR")}</span><span><b>{entry.userName||"Sistem"}</b> · {entry.label}: {entry.from} → {entry.to}</span></div>)}</div>
        {!ticket.history?.length&&<div style={{fontSize:11,color:"#94A3B8"}}>Henüz değişiklik kaydı yok.</div>}
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:7,flexWrap:"wrap"}}>{ticket.assignedTo&&onResend&&<Btn variant="success" disabled={mailStatus.loading} onClick={resend}>{mailStatus.loading?"Gönderiliyor...":"Atama Mailini Gönder"}</Btn>}{canEdit&&<Btn variant="secondary" onClick={()=>{setForm(ticket);setEditing(true);}}>Düzenle / Jira İlişkilendir</Btn>}<Btn variant="ghost" onClick={onClose}>Kapat</Btn></div>
    </div>}
  </Modal>;
}

// ─── User Edit Modal ──────────────────────────────────────────────────────────
function UserEditModal({ person, people=[], roles=ORG_LEVELS, onClose, onSave, title="Profilimi Düzenle", allowAdmin=false }) {
  const [name, setName] = useState(person.name);
  const [email,setEmail]=useState(person.email||"");
  const [phone,setPhone]=useState(person.phone||"");
  const [city,setCity]=useState(person.location?.city||person.city||"");
  const [district,setDistrict]=useState(person.location?.district||person.district||"");
  const [whatsappEnabled,setWhatsappEnabled]=useState(person.whatsappEnabled!==false);
  const [orgLevel,setOrgLevel]=useState(person.orgLevel||"");
  const [managerId,setManagerId]=useState(person.managerId||"");
  const [isAdmin,setIsAdmin]=useState(Boolean(person.isAdmin));
  const [ticketOnly,setTicketOnly]=useState(Boolean(person.ticketOnly));
  const [defaultDashboard,setDefaultDashboard]=useState(person.defaultDashboard||"team");
  const canChooseDashboard=Boolean(person.isAdmin||allowAdmin);
  return <Modal title={title} onClose={onClose} wide>
    <Field label="Ad Soyad *"><input style={iStyle} value={name} onChange={e=>setName(e.target.value)} /></Field>
    <Field label="E-posta"><input type="email" style={iStyle} value={email} onChange={e=>setEmail(e.target.value)} placeholder="kullanici@sirket.com" /></Field>
    <Field label="WhatsApp Telefonu"><input type="tel" style={iStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="905551234567" /></Field>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="İl"><input style={iStyle} value={city} onChange={e=>setCity(e.target.value)} placeholder="İstanbul"/></Field>
      <Field label="İlçe"><input style={iStyle} value={district} onChange={e=>setDistrict(e.target.value)} placeholder="Kadıköy"/></Field>
    </div>
    <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={whatsappEnabled} onChange={e=>setWhatsappEnabled(e.target.checked)}/> WhatsApp görev bildirimlerini al</label>
    {allowAdmin&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Field label="Organizasyon Seviyesi"><select style={iStyle} value={orgLevel} onChange={e=>setOrgLevel(e.target.value)}><option value="">- Atanmamış -</option>{roles.map(level=><option key={level.id} value={level.id}>{level.label}</option>)}</select></Field>
      <Field label="Bağlı Olduğu Yönetici"><select style={iStyle} value={managerId} onChange={e=>setManagerId(e.target.value)}><option value="">- Yönetici yok -</option>{people.filter(item=>item.id!==person.id).map(item=><option key={item.id} value={item.id}>{item.name} - {orgLevelLabel(item.orgLevel)}</option>)}</select></Field>
    </div>}
    {allowAdmin&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)}/> Yönetici yetkisi</label>}
    {allowAdmin&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={ticketOnly} onChange={e=>setTicketOnly(e.target.checked)}/> Yalnızca ticket modülünü kullanabilir</label>}
    {canChooseDashboard&&<Field label="Alt ana sayfa"><select style={iStyle} value={defaultDashboard} onChange={e=>setDefaultDashboard(e.target.value)}><option value="team">Ekip dashboardu</option><option value="admin">Yönetici dashboardu</option></select></Field>}
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!name.trim())return; onSave({name:name.trim(),email:email.trim(),phone:phone.replace(/\D/g,""),city:city.trim(),district:district.trim(),location:{...(person.location||{}),city:city.trim(),district:district.trim()},whatsappEnabled,defaultDashboard:canChooseDashboard?defaultDashboard:"team",...(allowAdmin?{isAdmin,orgLevel,managerId,ticketOnly,role:roles.find(item=>item.id===orgLevel)?.label||"Atanmamış"}:{})}); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}

// ─── Notifications Page ──────────────────────────────────────────────────────
function NotificationsPage({ notifications, currentUser, setState, onOpenTask }) {
  const mine=(notifications||[]).filter(n=>isNotificationForUser(n,currentUser));
  const markRead=(id)=>setState(s=>({...s,notifications:(s.notifications||[]).map(n=>n.id===id?{...n,read:true}:n)}));
  const deleteNotif=(id)=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>n.id!==id)}));
  return <div style={{ padding:"24px 28px", flex:1, overflow:"auto" }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div><h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Bildirimler</h2>
        <p style={{ margin:"3px 0 0", color:"#64748B", fontSize:13 }}>{mine.filter(n=>!n.read).length} okunmamış</p>
      </div>
      {mine.length>0&&<button onClick={()=>setState(s=>({...s,notifications:(s.notifications||[]).filter(n=>!isNotificationForUser(n,currentUser))}))} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", fontSize:12 }}>Tümünü Temizle</button>}
    </div>
    {mine.length===0&&<div style={{ textAlign:"center", padding:"50px", background:"#fff", borderRadius:16, border:"1.5px dashed #E2E8F0" }}>
      <div style={{ fontSize:32, marginBottom:10 }}>🔔</div>
      <div style={{ color:"#94A3B8" }}>Bildirim yok</div>
    </div>}
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {mine.map(n=><div key={n.id} style={{ background:"#fff", borderRadius:12, padding:"14px 18px", border:`1.5px solid ${n.read?"#E2E8F0":"#4A6CF7"}`, display:"flex", gap:12, alignItems:"flex-start", boxShadow:n.read?"none":"0 2px 8px rgba(74,108,247,0.1)", cursor:n.taskId?"pointer":"default" }} onClick={()=>{markRead(n.id);if(n.taskId)onOpenTask?.(n.taskId);}}>
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
function AddProjectModal({ onClose, onSave, people, roles }) {
  const [step,setStep]=useState("template");
  const [tplData,setTplData]=useState(null);
  const [f,setF]=useState({ name:"", description:"", color:"#4A6CF7", status:"Bekliyor", startDate:todayStr(), endDate:"", pmIds:[], stakeholders:[], customerContacts:[], commissioningTracking:false, connectedSupplier:false });
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
      <Field label="Proje Yöneticileri (birden fazla seçilebilir)"><PeopleMultiSelect people={people} value={f.pmIds} onChange={value=>upd("pmIds",value)}/></Field>
      <Field label="Proje Rolleri ve Katılımcılar"><StakeholderEditor people={people} roles={roles} value={f.stakeholders} onChange={value=>upd("stakeholders",value)} createId={uid}/></Field>
      <Field label="Müşteri Kontakları"><CustomerContactEditor value={f.customerContacts||[]} onChange={value=>upd("customerContacts",value)} createId={uid}/></Field>
      <label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F0FDFA",border:"1.5px solid #99F6E4",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.connectedSupplier)} onChange={e=>upd("connectedSupplier",e.target.checked)} style={{marginTop:2}}/><span><b>Connected Supplier</b><span style={{display:"block",color:"#0F766E",marginTop:3}}>Bu proje Connected Supplier kapsamında ayrı takip ve filtrelere dahil edilir.</span></span></label><label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.commissioningTracking)} onChange={e=>upd("commissioningTracking",e.target.checked)} style={{marginTop:2}}/><span><b>Hiyerarşik devreye alma takibi</b><span style={{display:"block",color:"#64748B",marginTop:3}}>Sektör, üretim merkezi, işyeri, hat ve makine bazında yüzdesel takip ekranını açar.</span></span></label>
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
function ProjectModal({ title, initial, onClose, onSave, people, roles }) {
  const [f,setF]=useState(()=>({ name:"", description:"", color:"#4A6CF7", status:"Bekliyor", startDate:"", endDate:"", ...initial, pmIds:projectPmIds(initial||{}), stakeholders:projectStakeholders(initial||{}) }));
  const upd=(k,v)=>setF(s=>({...s,[k]:v}));
  return <Modal title={title} onClose={onClose}>
    <Field label="Proje Adı *"><input style={iStyle} value={f.name} onChange={e=>upd("name",e.target.value)} /></Field>
    <Field label="Açıklama"><input style={iStyle} value={f.description} onChange={e=>upd("description",e.target.value)} /></Field>
    <Field label="Proje Yöneticileri (birden fazla seçilebilir)"><PeopleMultiSelect people={people} value={f.pmIds} onChange={value=>upd("pmIds",value)}/></Field>
    <Field label="Proje Rolleri ve Katılımcılar"><StakeholderEditor people={people} roles={roles} value={f.stakeholders} onChange={value=>upd("stakeholders",value)} createId={uid}/></Field>
    <Field label="Müşteri Kontakları"><CustomerContactEditor value={f.customerContacts||[]} onChange={value=>upd("customerContacts",value)} createId={uid}/></Field>
    <label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F0FDFA",border:"1.5px solid #99F6E4",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.connectedSupplier)} onChange={e=>upd("connectedSupplier",e.target.checked)} style={{marginTop:2}}/><span><b>Connected Supplier</b><span style={{display:"block",color:"#0F766E",marginTop:3}}>Bu proje Connected Supplier kapsamında ayrı takip ve filtrelere dahil edilir.</span></span></label><label style={{display:"flex",alignItems:"flex-start",gap:9,padding:"11px 12px",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:10,marginBottom:13,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={Boolean(f.commissioningTracking)} onChange={e=>upd("commissioningTracking",e.target.checked)} style={{marginTop:2}}/><span><b>Hiyerarşik devreye alma takibi</b><span style={{display:"block",color:"#64748B",marginTop:3}}>Sektör, üretim merkezi, işyeri, hat ve makine bazında yüzdesel takip ekranını açar.</span></span></label>
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
    <div style={{background:"#F1F5F9",borderRadius:9,padding:"9px 11px",fontSize:11,color:"#64748B",marginBottom:13}}>Milestone durumu içindeki görevlerin durumuna göre otomatik hesaplanır.</div>
    <Field label="Bekleme Kaynağı"><select style={iStyle} value={f.waitSource} onChange={e=>upd("waitSource",e.target.value)}><option value="">- Yok -</option>{WAIT.map(s=><option key={s}>{s}</option>)}</select></Field>
    <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}><Btn variant="ghost" onClick={onClose}>İptal</Btn><Btn onClick={()=>{ if(!f.name.trim())return; onSave(f); onClose(); }}>Kaydet</Btn></div>
  </Modal>;
}
function PersonModal({ people=[], roles=ORG_LEVELS, onClose, onSave }) {
  const [name, setName] = useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [city,setCity]=useState("");
  const [district,setDistrict]=useState("");
  const [whatsappEnabled,setWhatsappEnabled]=useState(true);
  const [orgLevel,setOrgLevel]=useState("");
  const [managerId,setManagerId]=useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [ticketOnly,setTicketOnly]=useState(false);
  return (
    <Modal title="Ekip Üyesi Ekle" onClose={onClose}>
      <Field label="Ad Soyad *">
        <input style={iStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Ad soyad" />
      </Field>
      <Field label="Organizasyon Seviyesi"><select style={iStyle} value={orgLevel} onChange={e=>setOrgLevel(e.target.value)}><option value="">- Atanmamış -</option>{roles.map(level=><option key={level.id} value={level.id}>{level.label}</option>)}</select></Field>
      <Field label="Bağlı Olduğu Yönetici"><select style={iStyle} value={managerId} onChange={e=>setManagerId(e.target.value)}><option value="">- Yönetici yok -</option>{people.map(item=><option key={item.id} value={item.id}>{item.name} · {orgLevelLabel(item.orgLevel)}</option>)}</select></Field>
      <Field label="E-posta">
        <input type="email" style={iStyle} value={email} onChange={e=>setEmail(e.target.value)} placeholder="kullanici@sirket.com" />
      </Field>
      <Field label="WhatsApp Telefonu">
        <input type="tel" style={iStyle} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="905551234567" />
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="İl"><input style={iStyle} value={city} onChange={e=>setCity(e.target.value)} placeholder="İstanbul"/></Field>
        <Field label="İlçe"><input style={iStyle} value={district} onChange={e=>setDistrict(e.target.value)} placeholder="Kadıköy"/></Field>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={whatsappEnabled} onChange={e=>setWhatsappEnabled(e.target.checked)}/> WhatsApp görev bildirimlerini al</label>
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
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:600,marginBottom:16}}><input type="checkbox" checked={ticketOnly} onChange={e=>setTicketOnly(e.target.checked)}/> Yalnızca ticket modülünü kullanabilir</label>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:7 }}>
        <Btn variant="ghost" onClick={onClose}>İptal</Btn>
        <Btn onClick={()=>{ if(!name.trim())return; onSave({name,email:email.trim(),phone:phone.replace(/\D/g,""),city:city.trim(),district:district.trim(),location:{city:city.trim(),district:district.trim()},whatsappEnabled,orgLevel,managerId,ticketOnly,role:roles.find(item=>item.id===orgLevel)?.label||"Atanmamış",isAdmin}); onClose(); }}>Kaydet</Btn>
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
