import { useState } from "react";
import * as XLSX from "xlsx";
import { Btn, Field, iStyle } from "./primitives.jsx";
import { PRIORITIES, STATUSES } from "./status.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
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

const importSheetRows=(workbook,name)=>workbook.Sheets[name]?XLSX.utils.sheet_to_json(workbook.Sheets[name],{defval:""}):[];
const importText=(value)=>String(value??"").trim();
const importBool=(value)=>["evet","true","1","yes"].includes(importText(value).toLocaleLowerCase("tr-TR"));

export function ImportCenter({state,setState,currentUser}) {
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

// Global style reset
