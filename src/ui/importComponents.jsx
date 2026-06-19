import { useState } from "react";
import * as XLSX from "xlsx";
import { DEFAULT_ACTIVE_MODULES, normalizeMilestone } from "../appData.js";
import { Btn } from "./primitives.jsx";
import { PRIORITIES, STATUSES } from "./status.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const MES_READINESS_TEMPLATE = [
  {id:"scope",category:"Yönetişim",text:"Proje kapsamı, hedef KPI'lar, başarı ölçütleri ve kapsam dışı konular onaylandı.",weight:8},
  {id:"sponsor",category:"Yönetişim",text:"Proje sponsoru, karar mekanizması, RACI ve eskalasyon yolu belirlendi.",weight:7},
  {id:"process",category:"Süreç ve Model",text:"Mevcut ve hedef üretim süreçleri ile ISA-95 ekipman hiyerarşisi tanımlandı.",weight:8},
  {id:"usecases",category:"Süreç ve Model",text:"MES kullanım senaryoları, istisnalar ve operasyon kuralları onaylandı.",weight:7},
  {id:"masterdata",category:"Veri",text:"Malzeme, rota, operasyon, vardiya, personel ve ekipman ana verilerinin sahibi belirlendi.",weight:8},
  {id:"quality",category:"Veri",text:"Kaynak veri kalitesi kontrol edildi; temizleme ve migrasyon planı hazır.",weight:7},
  {id:"interfaces",category:"Entegrasyon",text:"ERP, kalite, bakım, depo ve diğer sistem entegrasyonlarının kapsamı ve veri yönü belirlendi.",weight:8},
  {id:"contracts",category:"Entegrasyon",text:"API/protokol, hata yönetimi, tekrar deneme, sahiplik ve test verileri tanımlandı.",weight:7},
  {id:"infrastructure",category:"OT Altyapı",text:"Sunucu, ağ, zaman senkronizasyonu, yedekleme, kapasite ve ortam ayrımı hazır.",weight:8},
  {id:"security",category:"OT Altyapı",text:"OT/IT ağ sınırları, uzaktan erişim, hesaplar, yetkiler ve siber güvenlik kontrolleri onaylandı.",weight:7},
  {id:"equipment",category:"Saha Hazırlığı",text:"Makine/PLC bağlantı envanteri, protokoller, sinyal listeleri ve fiziksel erişim hazır.",weight:6},
  {id:"owners",category:"Saha Hazırlığı",text:"Hat bazında teknik sorumlular ve planlı duruş/bağlantı zamanları belirlendi.",weight:4},
  {id:"test",category:"Test ve Kabul",text:"FAT/SAT/UAT senaryoları, kabul kriterleri, test sorumluları ve kanıt formatı hazır.",weight:6},
  {id:"cutover",category:"Test ve Kabul",text:"Canlıya geçiş, geri dönüş, veri doğrulama ve destek planı onaylandı.",weight:4},
  {id:"training",category:"Değişim Yönetimi",text:"Anahtar kullanıcılar, eğitim, iletişim ve vardiya bazlı benimseme planı hazır.",weight:3},
  {id:"support",category:"Değişim Yönetimi",text:"Hypercare, SLA, izleme, sorun sahipliği ve kalıcı destek modeli belirlendi.",weight:2},
];

const createReadinessChecklist = () => MES_READINESS_TEMPLATE.map(item=>({...item,status:"unanswered",note:""}));
const importSheetRows = (workbook,name) => workbook.Sheets[name] ? XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:""}) : [];
const importText = value => String(value ?? "").trim();
const importBool = value => ["evet","true","1","yes","x","var"].includes(importText(value).toLocaleLowerCase("tr-TR"));
const firstText = (...values) => values.map(importText).find(Boolean) || "";
const splitList = value => importText(value).split(/[,;\n]/).map(item=>item.trim()).filter(Boolean);
const rowText = (row,...keys) => firstText(...keys.map(key=>row[key]));
const nonEmpty = object => Object.fromEntries(Object.entries(object).filter(([,value])=>{
  if(value && typeof value === "object" && !Array.isArray(value)) return Object.keys(nonEmpty(value)).length > 0;
  return value !== "" && value !== undefined && value !== null;
}));

const PROJECT_MODULES = DEFAULT_ACTIVE_MODULES?.length ? DEFAULT_ACTIVE_MODULES : ["Üretim Takip","Bakım","Kalite","İzlenebilirlik","Satın Alma","Connected Supplier"];
const PROJECT_COLUMNS = [
  "Proje Kodu",
  "Proje Adı",
  "Müşteri / Firma Adı",
  "Proje Açıklaması",
  "Müşteri Açıklaması",
  "Durum",
  "Başlangıç",
  "Bitiş",
  "Renk",
  "Vurgu Rengi",
  "Web Sitesi",
  "Logo URL",
  "Kullanılan Modüller",
  "Connected Supplier",
  "UAT Alındı",
  "UAT / Devir Tarihi",
  "Customer Success E-postaları",
  "Adres",
  "İlçe",
  "İl",
  "Ülke",
];
const PROJECT_SAMPLE = [
  "PRJ-001",
  "Örnek MES Projesi",
  "Örnek Müşteri A.Ş.",
  "Kapsam ve canlı geçiş takibi",
  "Otomotiv yan sanayi müşterisi",
  "Devam Ediyor",
  "2026-07-01",
  "2026-12-31",
  "#4A6CF7",
  "#4A6CF7",
  "https://ornek.com",
  "https://ornek.com/logo.png",
  "Üretim Takip, Kalite, Connected Supplier",
  "Evet",
  "Hayır",
  "",
  "cs@sirket.com",
  "Organize Sanayi Bölgesi No:1",
  "Nilüfer",
  "Bursa",
  "Türkiye",
];

const projectCodeFromRow = row => rowText(row,"Proje Kodu","Project Code","Kod");
const projectNameFromRow = row => rowText(row,"Proje Adı","Proje Adi","Müşteri / Firma Adı","Musteri / Firma Adi","Müşteri");
const customerNameFromRow = row => rowText(row,"Müşteri / Firma Adı","Musteri / Firma Adi","Müşteri","Musteri","Proje Adı","Proje Adi");
const projectDescriptionFromRow = row => rowText(row,"Proje Açıklaması","Proje Aciklamasi","Açıklama","Aciklama");

function buildProjectPatch(row,currentProject,projectId) {
  const color = rowText(row,"Renk") || currentProject?.color || "#4A6CF7";
  const accentColor = rowText(row,"Vurgu Rengi") || currentProject?.customerProfile?.accentColor || color;
  const customerName = customerNameFromRow(row);
  const modules = splitList(rowText(row,"Kullanılan Modüller","Kullanilan Moduller"));
  const locationPatch = nonEmpty({
    address: rowText(row,"Adres","Müşteri Adres","Musteri Adres"),
    district: rowText(row,"İlçe","Ilce"),
    city: rowText(row,"İl","Il","Şehir","Sehir"),
    country: rowText(row,"Ülke","Ulke") || "Türkiye",
  });
  const profilePatch = nonEmpty({
    name: customerName,
    description: rowText(row,"Müşteri Açıklaması","Musteri Aciklamasi"),
    website: rowText(row,"Web Sitesi","Website"),
    logoUrl: rowText(row,"Logo URL","Logo Url"),
    accentColor,
    location: locationPatch,
  });
  const activeModules = modules.length ? modules : currentProject?.activeModules || PROJECT_MODULES;
  const connectedSupplier = importBool(rowText(row,"Connected Supplier")) || activeModules.some(module=>module.toLocaleLowerCase("tr-TR").includes("connected supplier"));
  const uatValue = rowText(row,"UAT Alındı","UAT Alindi");
  const uatAccepted = uatValue ? importBool(uatValue) : Boolean(currentProject?.uatAccepted);
  return {
    importCode: projectCodeFromRow(row),
    name: projectNameFromRow(row),
    description: projectDescriptionFromRow(row) || currentProject?.description || "",
    status: rowText(row,"Durum") || currentProject?.status || "Başlamadı",
    startDate: rowText(row,"Başlangıç","Baslangic") || currentProject?.startDate || "",
    endDate: rowText(row,"Bitiş","Bitis") || currentProject?.endDate || "",
    color,
    customerId: currentProject?.customerId || projectId,
    customerName,
    customerProfile: {
      ...(currentProject?.customerProfile || {}),
      ...profilePatch,
      location: {
        ...(currentProject?.customerProfile?.location || {}),
        ...locationPatch,
      },
    },
    activeModules,
    connectedSupplier,
    uatAccepted,
    uatAcceptedAt: uatAccepted ? rowText(row,"UAT / Devir Tarihi","UAT Tarihi") || currentProject?.uatAcceptedAt || "" : currentProject?.uatAcceptedAt || "",
  };
}

export function ImportCenter({state,setState,currentUser,importType: controlledImportType,onImportTypeChange}) {
  const [preview,setPreview] = useState(null);
  const [fileName,setFileName] = useState("");
  const [message,setMessage] = useState("");
  const [localImportType,setLocalImportType] = useState("all");
  const importType = controlledImportType ?? localImportType;
  const setImportType = onImportTypeChange || setLocalImportType;
  const importModules = [
    ["all","Tüm Veriler","Tüm modülleri tek çalışma kitabında taşıyın."],
    ["projects","Müşteri / Proje","Müşteri bilgileri, modüller, açıklamalar, lokasyon ve proje tarihleri."],
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
  const sheetDefinitions = {
    projects:["Projeler",[PROJECT_COLUMNS,PROJECT_SAMPLE]],
    people:["Kişiler",[["E-posta","Ad Soyad","Telefon","Rol"],["kullanici@sirket.com","Örnek Kullanıcı","+90 5xx","Proje Yöneticisi"]]],
    tasks:["Görevler",[["Proje Kodu","Milestone","Görev","Başlangıç","Termin","Durum","Öncelik","Sorumlu E-posta","Sorumluluk Grubu","Planlanan Efor"],["PRJ-001","Analiz","Süreç analizi","2026-07-01","2026-07-10","Başlamadı","Yüksek","kullanici@sirket.com","Proje Ekibi",8]]],
    tickets:["Ticketlar",[["Proje Kodu","Başlık","Açıklama","Kategori","Öncelik","Durum","Atanan E-posta","Açılış Tarihi"],["PRJ-001","Örnek ticket","Detay","Bug","Orta","Açık","kullanici@sirket.com","2026-07-02"]]],
    machines:["Makineler",[["Proje Kodu","Makine Kodu","Makine Adı","Tip","Devreye Alındı","Devreye Alma Tarihi","IP","İşletim Sistemi / Model","Ek Lisans","Açıklama"],["PRJ-001","MC-01","Paketleme Makinesi","Fiziksel","Hayır","","192.168.1.10","Windows 11 / IPC","OPC lisansı","Bağlantı bekleniyor"]]],
    actions:["Aksiyonlar",[["Proje Kodu","Tarih","Etiket","Aksiyon","Efor","Yapan E-posta"],["PRJ-001","2026-07-03 10:00","Toplantı","Kapsam toplantısı yapıldı",1.5,"kullanici@sirket.com"]]],
    risks:["Riskler",[["Proje Kodu","Risk","Seviye","Durum","Açıklama"],["PRJ-001","PLC erişimi gecikebilir","Yüksek","Açık","Teknik ekipten dönüş bekleniyor"]]],
    contacts:["RACI ve Kontaklar",[["Proje Kodu","Taraf","Ad Soyad","Unvan","Şirket","Departman","E-posta","Telefon","RACI","Sorumluluk Kapsamı"],["PRJ-001","Müşteri","Örnek Kontak","Üretim Müdürü","Müşteri A.Ş.","Üretim","kontak@musteri.com","+90 5xx","A","Kabul ve önceliklendirme"]]],
    documents:["Dokümanlar",[["Proje Kodu","Doküman Adı","Amaç","Etiketler","OneDrive URL","Sahibi","Versiyon"],["PRJ-001","Teknik Tasarım","Teknik mimari","tasarım,mimari","https://...","Örnek Kullanıcı","1.0"]]],
    plans:["Çalışma Planları",[["Proje Kodu","Kullanıcı E-posta","Çalışma Türü","Tarih","Başlangıç","Bitiş","Plan Notu","Durum","Gerçekleşen Efor","Gerçekleşme Notu"],["PRJ-001","kullanici@sirket.com","Uzaktan","2026-07-06","09:00","12:00","Entegrasyon kontrolü","Planlandı","",""]]],
    todos:["Kişisel To-Do",[["Kullanıcı E-posta","Proje Kodu","Müşteri","Termin","Aksiyon","Tamamlandı"],["kullanici@sirket.com","PRJ-001","Örnek Müşteri","2026-07-10","Müşteriden veri bekleniyor","Hayır"]]],
    personalTasks:["Yönetici Görevleri",[["Atanan E-posta","Atayan E-posta","Görev","Başlangıç","Termin","Durum","Öncelik","Planlanan Efor","Not"],["kullanici@sirket.com","yonetici@sirket.com","Haftalık raporu hazırla","2026-07-06","2026-07-10","Bekliyor","Orta",2,""]]],
  };

  const downloadTemplate = (type="all") => {
    const workbook = XLSX.utils.book_new();
    const definitions = type === "all" ? Object.values(sheetDefinitions) : [sheetDefinitions[type]];
    definitions.filter(Boolean).forEach(([name,rows])=>{
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"] = rows[0].map((_,index)=>({wch:index < 3 ? 24 : 20}));
      XLSX.utils.book_append_sheet(workbook,sheet,name);
    });
    XLSX.writeFile(workbook,type === "all" ? "corject-tum-veriler-import-sablonu.xlsx" : `corject-${type}-import-sablonu.xlsx`);
  };

  const readFile = event => {
    const file = event.target.files?.[0];
    if(!file) return;
    setMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result,{type:"array",cellDates:false});
        const data = Object.fromEntries(Object.keys(sheetDefinitions).map(key=>[key,[]]));
        if(importType === "all") Object.entries(sheetDefinitions).forEach(([key,[name]])=>{data[key] = importSheetRows(workbook,name);});
        else data[importType] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:""});
        const errors = [];
        const knownProjectCodes = new Set([...(state.projects || []).map(project=>project.importCode).filter(Boolean),...data.projects.map(projectCodeFromRow).filter(Boolean)]);
        const knownEmails = new Set([...(state.people || []).map(person=>person.email?.toLocaleLowerCase("tr-TR")).filter(Boolean),...data.people.map(row=>rowText(row,"E-posta").toLocaleLowerCase("tr-TR")).filter(Boolean)]);
        data.projects.forEach((row,index)=>{
          if(!projectCodeFromRow(row) || !projectNameFromRow(row)) errors.push(`Projeler satır ${index+2}: Proje Kodu ve Proje Adı zorunlu.`);
        });
        ["tasks","tickets","machines","actions","risks","contacts","documents","plans"].forEach(key=>data[key].forEach((row,index)=>{
          const code = projectCodeFromRow(row);
          if(!code) errors.push(`${sheetDefinitions[key][0]} satır ${index+2}: Proje Kodu zorunlu.`);
          else if(!knownProjectCodes.has(code)) errors.push(`${sheetDefinitions[key][0]} satır ${index+2}: ${code} proje kodu sistemde veya Projeler sayfasında bulunmuyor.`);
        }));
        data.plans.forEach((row,index)=>{
          const email = rowText(row,"Kullanıcı E-posta","Kullanici E-posta").toLocaleLowerCase("tr-TR");
          if(!knownEmails.has(email)) errors.push(`Çalışma Planları satır ${index+2}: ${email || "Kullanıcı e-postası"} ekipte bulunmuyor.`);
        });
        data.todos.forEach((row,index)=>{
          const email = rowText(row,"Kullanıcı E-posta","Kullanici E-posta").toLocaleLowerCase("tr-TR");
          if(!knownEmails.has(email)) errors.push(`Kişisel To-Do satır ${index+2}: ${email || "Kullanıcı e-postası"} ekipte bulunmuyor.`);
        });
        data.personalTasks.forEach((row,index)=>{
          const email = rowText(row,"Atanan E-posta").toLocaleLowerCase("tr-TR");
          if(!knownEmails.has(email)) errors.push(`Yönetici Görevleri satır ${index+2}: ${email || "Atanan e-posta"} ekipte bulunmuyor.`);
        });
        setPreview({...data,errors});
        setFileName(file.name);
      } catch(error) {
        setPreview(null);
        setMessage(`Dosya okunamadı: ${error.message}`);
      }
      event.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const applyImport = () => {
    if(!preview || preview.errors.length) return;
    setState(current=>{
      const people = [...current.people];
      const personByEmail = new Map(people.filter(person=>person.email).map(person=>[person.email.toLocaleLowerCase("tr-TR"),person]));
      preview.people.forEach(row=>{
        const email = rowText(row,"E-posta").toLocaleLowerCase("tr-TR");
        const name = rowText(row,"Ad Soyad");
        if(!email || !name || personByEmail.has(email)) return;
        const person = {id:uid(),email,name,phone:rowText(row,"Telefon"),role:rowText(row,"Rol") || "Kullanıcı",avatar:name.split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase(),isAdmin:false};
        people.push(person);
        personByEmail.set(email,person);
      });

      const projects = current.projects.map(project=>({
        ...project,
        milestones:(project.milestones || []).map(milestone=>({...milestone,tasks:[...(milestone.tasks || [])]})),
        machines:[...(project.machines || [])],
      }));
      const projectByCode = new Map(projects.filter(project=>project.importCode).map(project=>[project.importCode,project]));
      preview.projects.forEach(row=>{
        const code = projectCodeFromRow(row);
        if(!code) return;
        const existingByCode = projectByCode.get(code);
        const existingByName = projects.find(project=>project.name.toLocaleLowerCase("tr-TR") === projectNameFromRow(row).toLocaleLowerCase("tr-TR"));
        const target = existingByCode || existingByName;
        if(target) {
          const patch = buildProjectPatch(row,target,target.id);
          const customerSuccessIds = splitList(rowText(row,"Customer Success E-postaları","Customer Success E-postalari"))
            .map(email=>personByEmail.get(email.toLocaleLowerCase("tr-TR"))?.id)
            .filter(Boolean);
          Object.assign(target,patch,{customerSuccessIds:customerSuccessIds.length?customerSuccessIds:(target.customerSuccessIds || []),members:[...new Set([...(target.members || []),...customerSuccessIds])],customerProfile:{...(target.customerProfile || {}),...(patch.customerProfile || {})}});
          projectByCode.set(code,target);
          return;
        }
        const id = uid();
        const patch = buildProjectPatch(row,null,id);
        const customerSuccessIds = splitList(rowText(row,"Customer Success E-postaları","Customer Success E-postalari"))
          .map(email=>personByEmail.get(email.toLocaleLowerCase("tr-TR"))?.id)
          .filter(Boolean);
        const project = {
          id,
          ...patch,
          milestones:[],
          risks:[],
          machines:[],
          commissioningTree:[],
          commissioningTracking:false,
          members:customerSuccessIds,
          pmIds:[],
          customerSuccessIds,
          stakeholders:[],
          readinessChecklist:createReadinessChecklist(),
          readinessThreshold:80,
          raciContacts:[],
          documents:[],
          reportSchedules:[],
        };
        projects.push(project);
        projectByCode.set(code,project);
      });

      preview.tasks.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        if(!project) return;
        const milestoneName = rowText(row,"Milestone") || "Genel";
        let milestone = project.milestones.find(item=>item.name === milestoneName);
        if(!milestone) {
          milestone = {id:uid(),name:milestoneName,status:"Başlamadı",startDate:"",dueDate:"",tasks:[]};
          project.milestones.push(milestone);
        }
        const title = rowText(row,"Görev","Gorev");
        if(!title || milestone.tasks.some(task=>task.title === title && task.dueDate === rowText(row,"Termin"))) return;
        const person = personByEmail.get(rowText(row,"Sorumlu E-posta").toLocaleLowerCase("tr-TR"));
        const status = rowText(row,"Durum");
        const priority = rowText(row,"Öncelik","Oncelik");
        milestone.tasks.push({id:uid(),title,startDate:rowText(row,"Başlangıç","Baslangic"),dueDate:rowText(row,"Termin"),status:STATUSES.includes(status)?status:"Başlamadı",priority:PRIORITIES.includes(priority)?priority:"Orta",assignee:person?.id || "",responsibilityGroup:rowText(row,"Sorumluluk Grubu") || "Proje Ekibi",estimatedHours:Number(rowText(row,"Planlanan Efor")) || 0,timeEntries:[],waitingHistory:[]});
        Object.assign(milestone,normalizeMilestone(milestone));
      });
      preview.machines.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const name = rowText(row,"Makine Adı","Makine Adi");
        const code = rowText(row,"Makine Kodu");
        if(!project || !name || project.machines.some(machine=>machine.code && machine.code === code)) return;
        project.machines.push({id:uid(),code,name,type:rowText(row,"Tip").toLocaleLowerCase("tr-TR") === "sanal" ? "virtual" : "physical",commissioned:importBool(rowText(row,"Devreye Alındı","Devreye Alindi")),commissionedAt:rowText(row,"Devreye Alma Tarihi"),ip:rowText(row,"IP","Ip"),osModel:rowText(row,"İşletim Sistemi / Model","Isletim Sistemi / Model"),extraLicense:rowText(row,"Ek Lisans"),note:rowText(row,"Açıklama","Aciklama")});
      });
      preview.risks.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const title = rowText(row,"Risk");
        if(!project || !title || (project.risks || []).some(risk=>risk.title === title)) return;
        project.risks = [...(project.risks || []),{id:uid(),title,level:rowText(row,"Seviye") || "Orta",status:rowText(row,"Durum") || "Açık",note:rowText(row,"Açıklama","Aciklama")}];
      });
      preview.contacts.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const name = rowText(row,"Ad Soyad");
        const email = rowText(row,"E-posta");
        if(!project || !name || (project.raciContacts || []).some(contact=>contact.name === name && contact.email === email)) return;
        project.raciContacts = [...(project.raciContacts || []),{id:uid(),side:rowText(row,"Taraf") || "Müşteri",name,title:rowText(row,"Unvan"),company:rowText(row,"Şirket","Sirket"),department:rowText(row,"Departman"),email,phone:rowText(row,"Telefon"),raci:rowText(row,"RACI") || "I",scope:rowText(row,"Sorumluluk Kapsamı","Sorumluluk Kapsami")}];
      });
      preview.documents.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const name = rowText(row,"Doküman Adı","Dokuman Adi");
        const url = rowText(row,"OneDrive URL");
        if(!project || !name || (project.documents || []).some(document=>document.name === name && document.url === url)) return;
        project.documents = [...(project.documents || []),{id:uid(),name,purpose:rowText(row,"Amaç","Amac"),tags:splitList(rowText(row,"Etiketler")),url,owner:rowText(row,"Sahibi"),version:rowText(row,"Versiyon") || "1.0",createdAt:now()}];
      });

      const projectTickets = {...(current.projectTickets || {})};
      preview.tickets.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const title = rowText(row,"Başlık","Baslik");
        const openedAt = rowText(row,"Açılış Tarihi","Acilis Tarihi");
        if(!project || !title || (projectTickets[project.id] || []).some(ticket=>ticket.title === title && String(ticket.ts || "").slice(0,10) === openedAt.slice(0,10))) return;
        const person = personByEmail.get(rowText(row,"Atanan E-posta").toLocaleLowerCase("tr-TR"));
        projectTickets[project.id] = [...(projectTickets[project.id] || []),{id:uid(),title,description:rowText(row,"Açıklama","Aciklama"),category:rowText(row,"Kategori") || "Diğer",priority:rowText(row,"Öncelik","Oncelik") || "Orta",status:rowText(row,"Durum") || "Açık",assignedTo:person?.id || "",author:currentUser.name,ts:openedAt || now(),updatedAt:now(),history:[],customerVisible:false,source:"internal"}];
      });
      const projectActions = {...(current.projectActions || {})};
      preview.actions.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const text = rowText(row,"Aksiyon");
        const actionAt = rowText(row,"Tarih");
        if(!project || !text || (projectActions[project.id] || []).some(action=>action.text === text && String(action.actionAt || "").slice(0,16) === actionAt.slice(0,16))) return;
        const person = personByEmail.get(rowText(row,"Yapan E-posta").toLocaleLowerCase("tr-TR")) || currentUser;
        projectActions[project.id] = [...(projectActions[project.id] || []),{id:uid(),tag:rowText(row,"Etiket") || "Diğer",text,effortHours:Number(rowText(row,"Efor")) || 0,actionAt:actionAt || now(),createdAt:now(),authorId:person.id,authorName:person.name}];
      });
      const fieldPlans = [...(current.fieldPlans || [])];
      preview.plans.forEach(row=>{
        const project = projectByCode.get(projectCodeFromRow(row));
        const person = personByEmail.get(rowText(row,"Kullanıcı E-posta","Kullanici E-posta").toLocaleLowerCase("tr-TR"));
        const date = rowText(row,"Tarih");
        const startTime = rowText(row,"Başlangıç","Baslangic");
        if(!project || !person || !date || fieldPlans.some(plan=>plan.projectId === project.id && plan.userId === person.id && plan.date === date && plan.startTime === startTime)) return;
        const completed = rowText(row,"Durum").toLocaleLowerCase("tr-TR").includes("gerçek");
        fieldPlans.push({id:uid(),projectId:project.id,userId:person.id,workType:rowText(row,"Çalışma Türü","Calisma Turu").toLocaleLowerCase("tr-TR").includes("uzak") ? "remote" : "field",date,startTime:startTime || "09:00",endTime:rowText(row,"Bitiş","Bitis") || "17:00",note:rowText(row,"Plan Notu"),status:completed ? "completed" : "planned",effortHours:Number(rowText(row,"Gerçekleşen Efor","Gerceklesen Efor")) || 0,visitNotes:rowText(row,"Gerçekleşme Notu","Gerceklesme Notu"),createdAt:now(),...(completed ? {completedAt:now()} : {})});
      });
      const userNotes = {...(current.userNotes || {})};
      preview.todos.forEach(row=>{
        const person = personByEmail.get(rowText(row,"Kullanıcı E-posta","Kullanici E-posta").toLocaleLowerCase("tr-TR"));
        if(!person) return;
        const action = rowText(row,"Aksiyon");
        if(!action) return;
        const existing = userNotes[person.id] || {};
        const todos = [...(existing.todos || [])];
        if(todos.some(todo=>todo.action === action && todo.dueDate === rowText(row,"Termin"))) return;
        const project = projectByCode.get(projectCodeFromRow(row));
        todos.push({id:uid(),projectId:project?.id || "",customer:rowText(row,"Müşteri","Musteri") || project?.name || "",dueDate:rowText(row,"Termin"),action,text:action,done:importBool(rowText(row,"Tamamlandı","Tamamlandi")),createdAt:now()});
        userNotes[person.id] = {...existing,todos};
      });
      const personalTasks = [...(current.personalTasks || [])];
      preview.personalTasks.forEach(row=>{
        const assignee = personByEmail.get(rowText(row,"Atanan E-posta").toLocaleLowerCase("tr-TR"));
        const assigner = personByEmail.get(rowText(row,"Atayan E-posta").toLocaleLowerCase("tr-TR")) || currentUser;
        const title = rowText(row,"Görev","Gorev");
        const dueDate = rowText(row,"Termin");
        if(!assignee || !title || personalTasks.some(task=>task.assignee === assignee.id && task.title === title && task.dueDate === dueDate)) return;
        const status = rowText(row,"Durum");
        const priority = rowText(row,"Öncelik","Oncelik");
        personalTasks.push({id:uid(),title,startDate:rowText(row,"Başlangıç","Baslangic"),dueDate,status:STATUSES.includes(status)?status:"Bekliyor",priority:PRIORITIES.includes(priority)?priority:"Orta",estimatedHours:Number(rowText(row,"Planlanan Efor")) || 0,notes:rowText(row,"Not"),assignee:assignee.id,createdBy:assigner.id,createdByName:assigner.name,createdAt:now(),comments:[]});
      });
      return {...current,people,projects,projectTickets,projectActions,fieldPlans,userNotes,personalTasks};
    });
    setMessage("Import tamamlandı. Yeni kayıtlar mevcut verilerle birleştirildi.");
    setPreview(null);
    setFileName("");
  };

  const counts = preview && Object.entries(sheetDefinitions).map(([key,[label]])=>[label,preview[key].length]).filter(([,value])=>value > 0);
  return <div style={{padding:"clamp(18px,4vw,30px)",flex:1,overflow:"auto"}}>
    <div style={{maxWidth:980,margin:"0 auto"}}>
      <div style={{marginBottom:18}}>
        <h2 style={{margin:0,fontSize:22}}>Import Merkezi</h2>
        <p style={{margin:"5px 0 0",fontSize:12,color:"#64748B"}}>Başka uygulamalardaki temel operasyon verilerini kontrollü olarak Corject'e taşıyın.</p>
        <div style={{marginTop:9,display:"inline-block",background:"#FFF7ED",color:"#9A3412",borderRadius:8,padding:"6px 9px",fontSize:9,fontWeight:700}}>Güvenlik nedeniyle parola ve uzaktan erişim sırları Excel importuna dahil edilmez.</div>
      </div>
      <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:17,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:850,marginBottom:10}}>Import edilecek veri grubunu seçin</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:8}}>
          {importModules.map(([id,label,description])=><button key={id} onClick={()=>{setImportType(id);setPreview(null);setMessage("");}} style={{border:`1.5px solid ${importType===id?"#4A6CF7":"#E2E8F0"}`,background:importType===id?"#EEF2FF":"#fff",borderRadius:11,padding:11,textAlign:"left",cursor:"pointer"}}>
            <b style={{display:"block",fontSize:11,color:importType===id?"#4338CA":"#1E293B"}}>{label}</b>
            <span style={{display:"block",fontSize:9,color:"#64748B",lineHeight:1.4,marginTop:3}}>{description}</span>
          </button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginBottom:14}}>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:17}}>
          <b style={{fontSize:13}}>1. Şablonu indirin</b>
          <p style={{fontSize:11,color:"#64748B",lineHeight:1.55}}>Seçili veri grubunun kolonlarını değiştirmeden doldurun. Müşteri / Proje şablonu firma adı, kullanılan modüller, lokasyon, web sitesi ve logo bilgisini de taşır.</p>
          <Btn variant="secondary" onClick={()=>downloadTemplate(importType)}>Seçili XLSX Şablonunu İndir</Btn>
        </div>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:15,padding:17}}>
          <b style={{fontSize:13}}>2. Dolu dosyayı seçin</b>
          <p style={{fontSize:11,color:"#64748B",lineHeight:1.55}}>Önce önizleme yapılır; onay vermeden hiçbir kayıt değiştirilmez.</p>
          <label style={{display:"inline-flex",background:"#4A6CF7",color:"#fff",borderRadius:9,padding:"9px 12px",fontSize:11,fontWeight:800,cursor:"pointer"}}>XLSX Seç<input type="file" accept=".xlsx,.xls" onChange={readFile} style={{display:"none"}}/></label>
        </div>
      </div>
      {preview && <div style={{background:"#fff",border:`1.5px solid ${preview.errors.length?"#FDA4AF":"#C7D2FE"}`,borderRadius:15,padding:17}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div><b>{fileName}</b><div style={{fontSize:10,color:"#64748B",marginTop:3}}>Import önizlemesi</div></div>
          <Btn disabled={preview.errors.length>0} onClick={applyImport}>Importu Uygula</Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginTop:13}}>
          {counts.map(([label,value])=><div key={label} style={{background:"#F8FAFC",borderRadius:10,padding:10}}><b style={{fontSize:20,color:"#4F46E5"}}>{value}</b><div style={{fontSize:9,color:"#64748B"}}>{label}</div></div>)}
        </div>
        {preview.errors.length > 0 && <div style={{marginTop:12,background:"#FFF1F2",color:"#BE123C",borderRadius:10,padding:11,fontSize:10,lineHeight:1.6}}>{preview.errors.map(error=><div key={error}>{error}</div>)}</div>}
      </div>}
      {message && <div style={{marginTop:12,background:message.startsWith("Import")?"#ECFDF5":"#FFF1F2",color:message.startsWith("Import")?"#047857":"#BE123C",borderRadius:10,padding:12,fontSize:11}}>{message}</div>}
    </div>
  </div>;
}
