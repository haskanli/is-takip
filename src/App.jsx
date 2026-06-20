import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { assignTasksWithNotification } from "./email";
import { apiHeaders, apiUrl, isPublicCorjectHost } from "./api";
import { COLORS, DEFAULT_ACTION_TAGS, DEFAULT_ACTIVE_MODULES, MES_TEMPLATES, ORG_LEVELS, RESPONSIBILITY_GROUPS, WAIT, buildFromTemplate, createReadinessChecklist, load, mapsUrl, normalizeMilestone, normalizeTicketNumbers, organizationRoles, orgLevelLabel, readinessScore } from "./appData.js";
import { CUSTOMER_VISIBLE_PROJECT_TABS, canCustomerAccessProject, isCustomerUser } from "./customerAccess.js";
import { DEFAULT_PROJECT_TAB, PROJECT_ROUTE_TABS, pathForRouteState, routeFromLocation } from "./routing.js";
import {
  commissioningMachines,
  fieldPlanHours,
  nextTicketNumber,
  projectCustomerSuccessIds,
  projectPmIds,
  projectResponsibleIds,
  projectStakeholders,
  ticketNumber,
} from "./domain/projectHelpers.js";
import { OrganizationPanel as SharedOrganizationPanel } from "./ui/managementComponents.jsx";
import { CustomerDashboardPage as SharedCustomerDashboardPage, DashboardPage as SharedDashboardPage, MobileHomePage as SharedMobileHomePage } from "./ui/dashboardComponents.jsx";
import { FieldOperationsPage as SharedFieldOperationsPage } from "./ui/fieldOperationsComponents.jsx";
import { ProjectActionsPanel as SharedProjectActionsPanel } from "./ui/projectActionsComponents.jsx";
import { RiskModal as SharedRiskModal, RiskPanel as SharedRiskPanel } from "./ui/riskComponents.jsx";
import { AuthLoginScreen, LoginScreen, PasswordRecoveryScreen } from "./ui/authComponents.jsx";
import { TicketsPage as SharedTicketsPage, TicketsPanel as SharedTicketsPanel } from "./ui/ticketComponents.jsx";
import { ProjectNotesPanel as SharedProjectNotesPanel, ProjectSetupPanel as SharedProjectSetupPanel, ResponsibilitySummary as SharedResponsibilitySummary } from "./ui/projectSetupComponents.jsx";
import { DeadlinePage as SharedDeadlinePage, LogPage as SharedLogPage, NotificationsPage as SharedNotificationsPage, PersonDetailModal as SharedPersonDetailModal, TodoPage as SharedTodoPage } from "./ui/miscPagesComponents.jsx";
import { RemindersPage as SharedRemindersPage } from "./ui/reminderComponents.jsx";
import { ImportCenter as SharedImportCenter } from "./ui/importComponents.jsx";
import { AIWorkspace as SharedAIWorkspace } from "./ui/aiComponents.jsx";
import { MyTasksPage as SharedMyTasksPage } from "./ui/myTasksComponents.jsx";
import { ManagementWorkspace as SharedManagementWorkspace } from "./ui/managementDashboardComponents.jsx";
import { AppLoadingScreen, GlobalStyle } from "./ui/appShellComponents.jsx";
import { CustomersPage as SharedCustomersPage } from "./ui/customerComponents.jsx";
import { AddProjectModal as SharedAddProjectModal, MilestoneModal as SharedMilestoneModal, PersonModal as SharedPersonModal, ProjectModal as SharedProjectModal, UserEditModal as SharedUserEditModal } from "./ui/projectModalComponents.jsx";
import {
  MailCenterPage as SharedMailCenterPage,
  ReportsPage as SharedReportsPage,
  downloadDelayReport,
  downloadEffortReport,
  downloadXlsx,
  generateHTMLReport,
  generatePortfolioReport,
  generateTicketStatusReport,
} from "./ui/reportComponents.jsx";
import { resolveTenantProfile } from "../server/services/emailTemplate.js";
import {
  EmptyMobileRow,
  MobileBottomNav,
  MobileFeatureMenuPage,
  MobileFeedCard,
  MobileFeedRow,
  MobileQuickSheet,
  QuickActionModal,
  QuickTodoModal,
} from "./ui/mobileComponents.jsx";
import {
  ProjectBusinessCard as SharedProjectBusinessCard,
  ProjectListCard as SharedProjectListCard,
} from "./ui/projectCards.jsx";
import { GanttChart as SharedGanttChart, MilestoneTaskPanel as SharedMilestoneTaskPanel, PlanListTable as SharedPlanListTable } from "./ui/projectPlanComponents.jsx";
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

const WEATHER_SCENES = [
  {
    ids: [0],
    scene: {
      image:
        "radial-gradient(circle at 18% 10%, rgb(222 245 248 / 52%) 0 20%, transparent 42%), radial-gradient(circle at 86% 12%, rgb(191 122 18 / 10%) 0 18%, transparent 42%), linear-gradient(150deg, #fbfcfc 0%, #f6fafb 48%, #eef4f5 100%)",
      overlay:
        "radial-gradient(circle at 10% 15%, rgb(11 138 148 / 8%), transparent 40%), linear-gradient(to right, rgb(255 255 255 / 18%), rgb(246 250 251 / 28%))",
      blur: "132px",
    },
  },
  {
    ids: [1, 2, 3],
    scene: {
      image:
        "radial-gradient(circle at 18% 14%, rgb(222 245 248 / 42%) 0 18%, transparent 40%), radial-gradient(circle at 76% 18%, rgb(207 224 227 / 36%) 0 18%, transparent 44%), linear-gradient(150deg, #fbfcfc 0%, #f6fafb 42%, #edf3f4 100%)",
      overlay:
        "radial-gradient(circle at 12% 12%, rgb(11 138 148 / 8%), transparent 36%), linear-gradient(to right, rgb(246 250 251 / 16%), rgb(222 245 248 / 18%))",
      blur: "132px",
    },
  },
  {
    ids: [45, 48, 51, 53, 55, 56, 57],
    scene: {
      image:
        "radial-gradient(circle at 20% 12%, rgb(207 224 227 / 44%) 0 16%, transparent 38%), radial-gradient(circle at 70% 78%, rgb(91 111 116 / 14%) 0 24%, transparent 42%), linear-gradient(150deg, #f5f7f7 0%, #edf3f4 48%, #e5ecee 100%)",
      overlay:
        "linear-gradient(to right, rgb(207 224 227 / 18%), rgb(91 111 116 / 10%)), radial-gradient(circle at 16% 78%, rgb(255 255 255 / 16%), transparent 44%)",
      blur: "136px",
    },
  },
  {
    ids: [61, 63, 65, 66, 67, 80, 81, 82],
    scene: {
      image:
        "radial-gradient(circle at 20% 14%, rgb(222 245 248 / 46%) 0 20%, transparent 42%), radial-gradient(circle at 76% 18%, rgb(25 131 92 / 12%) 0 18%, transparent 42%), linear-gradient(150deg, #f8fbfb 0%, #edf6f7 48%, #e3eff1 100%)",
      overlay:
        "radial-gradient(circle at 12% 14%, rgb(11 138 148 / 10%), transparent 34%), radial-gradient(circle at 84% 84%, rgb(25 131 92 / 8%), transparent 40%)",
      blur: "138px",
    },
  },
  {
    ids: [71, 73, 75, 77, 85, 86],
    scene: {
      image:
        "radial-gradient(circle at 16% 14%, rgb(246 250 251 / 72%) 0 20%, transparent 38%), radial-gradient(circle at 74% 18%, rgb(222 245 248 / 30%) 0 18%, transparent 44%), linear-gradient(150deg, #fbfcfc 0%, #f3f8f9 44%, #e8f1f2 100%)",
      overlay:
        "radial-gradient(circle at 12% 18%, rgb(222 245 248 / 22%), transparent 40%), radial-gradient(circle at 82% 78%, rgb(207 224 227 / 18%), transparent 42%)",
      blur: "140px",
    },
  },
  {
    ids: [95, 96, 99],
    scene: {
      image:
        "radial-gradient(circle at 20% 16%, rgb(207 224 227 / 46%) 0 18%, transparent 40%), radial-gradient(circle at 74% 20%, rgb(185 63 51 / 10%) 0 16%, transparent 40%), linear-gradient(150deg, #f7f9f9 0%, #edf3f4 46%, #e4ecee 100%)",
      overlay:
        "linear-gradient(to right, rgb(11 138 148 / 8%), rgb(185 63 51 / 7%)), radial-gradient(circle at 18% 78%, rgb(191 122 18 / 9%), transparent 44%)",
      blur: "142px",
    },
  },
];

const normalizeWeatherCode = (code) => {
  const numeric = Number(code);
  if (!Number.isFinite(numeric)) return 1;
  for (const theme of WEATHER_SCENES) {
    if (theme.ids.includes(numeric)) return theme.scene;
  }
  if (numeric >= 11 && numeric <= 24) return WEATHER_SCENES[1].scene;
  if (numeric >= 95 && numeric <= 99) return WEATHER_SCENES[5].scene;
  return WEATHER_SCENES[0].scene;
};

const WEATHER_CACHE_KEY = "corject:weatherScene";
const DEFAULT_WEATHER_CACHE_MS = 45 * 60 * 1000;
const FLAT_SCENE = {
  image:
    "radial-gradient(circle at 14% -12%, rgb(11 138 148 / 14%), transparent 34%), radial-gradient(circle at 96% -6%, rgb(191 122 18 / 10%), transparent 30%), var(--bg)",
  overlay: "none",
  blur: "0px",
};

const safeSetWeatherTheme = (scene) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!root?.style) return;
  const { image, overlay, blur } = FLAT_SCENE;
  if (image) root.style.setProperty("--scene-image", image);
  if (overlay) root.style.setProperty("--scene-overlay", overlay);
  if (blur) root.style.setProperty("--scene-blur", blur);
};

const applyWeatherThemeFromGeo = async () => {
  if (typeof navigator === "undefined" || typeof window === "undefined") return;
  const now = Date.now();
  const cached = (() => {
    try { return localStorage.getItem(WEATHER_CACHE_KEY); } catch { return null; }
  })();
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const isFresh = now - Number(parsed.ts || 0) < DEFAULT_WEATHER_CACHE_MS && parsed.scene;
      if (isFresh) {
        safeSetWeatherTheme(parsed.scene);
        return;
      }
    } catch {
      try { localStorage.removeItem(WEATHER_CACHE_KEY); } catch {}
    }
  }
  const geolocation = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
  });
  const { latitude, longitude } = geolocation.coords || {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
  );
  if (!response.ok) return;
  const payload = await response.json();
  const weatherCode = payload?.current_weather?.weathercode;
  const scene = normalizeWeatherCode(weatherCode);
  safeSetWeatherTheme(scene);
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ ts: now, scene }));
  } catch {}
};

const restoreDefaultWeatherTheme = () => {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;
  root.style.setProperty("--scene-image", FLAT_SCENE.image);
  root.style.setProperty("--scene-overlay", FLAT_SCENE.overlay);
  root.style.setProperty("--scene-blur", FLAT_SCENE.blur);
};

const isNotificationForUser = (notification, user) => {
  if (!notification || !user) return false;
  if (notification.userId && notification.userId === user.id) return true;
  const noticeEmail = String(notification.userEmail || "").trim().toLowerCase();
  const userEmail = String(user.email || "").trim().toLowerCase();
  return Boolean(noticeEmail && userEmail && noticeEmail === userEmail);
};


let apiStateVersion = 0;
const authHeaders = async () => {
  const {data}=await supabase.auth.getSession();
  return data.session?.access_token?{Authorization:`Bearer ${data.session.access_token}`}:{};
};
const ensureAuthUserForPerson = async (person) => {
  const email = String(person?.email || "").trim();
  if (!REQUIRE_AUTH || !email) return { skipped: true };
  const response = await fetch(apiUrl("/api/auth/users/ensure"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ person }),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 404) {
      console.warn("Auth sync endpoint bulunamadı, profil kaydı yerelde güncellendi.", text);
      return { skipped: true, reason: "auth_endpoint_not_found" };
    }
    throw new Error(`Auth kullanıcısı oluşturulamadı (${response.status}): ${text}`);
  }
  return response.json();
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

export default function App() {
  const initialRoute=useRef(typeof window!=="undefined"?routeFromLocation(window.location):routeFromLocation()).current;
  const initialSearch=useRef(typeof window!=="undefined"?new URLSearchParams(window.location.search):new URLSearchParams()).current;
  const [state,setState]=useState(load);
  const [view,setView]=useState(initialRoute.view||"dashboard");
  const [selProject,setSelProject]=useState(initialRoute.selProject||null);
  const [selMilestone,setSelMilestone]=useState(null);
  const [projectTab,setProjectTab]=useState(initialRoute.projectTab||DEFAULT_PROJECT_TAB);
  const [modal,setModal]=useState(null);
  const [showDoneTasks,setShowDoneTasks]=useState(false);
  const [dataLoaded,setDataLoaded]=useState(false);
  const [loadProgress,setLoadProgress]=useState(REQUIRE_AUTH?8:20);
  const [syncStatus,setSyncStatus]=useState({ s:"idle", msg:"" });
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [mobileQuick,setMobileQuick]=useState(null);
  const [mobileQuickSheet,setMobileQuickSheet]=useState(false);
  const [adminSection,setAdminSection]=useState(initialRoute.adminSection||"overview");
  const [projectScope,setProjectScope]=useState(initialRoute.projectScope||"all");
  const [projectSearch,setProjectSearch]=useState(initialRoute.projectSearch||"");
  const [projectSegment,setProjectSegment]=useState(initialRoute.projectSegment||"all");
  const [projectViewMode,setProjectViewMode]=useState(initialRoute.projectViewMode||"cards");
  const [expandedProjectRows,setExpandedProjectRows]=useState({});
  const [ticketMineOnly,setTicketMineOnly]=useState(Boolean(initialRoute.ticketMineOnly));
  const [ticketTab,setTicketTab]=useState(initialRoute.ticketTab||"tickets");
  const [ticketSearch,setTicketSearch]=useState(initialRoute.ticketSearch||"");
  const [ticketProjectFilters,setTicketProjectFilters]=useState(initialRoute.ticketProjectFilters||[]);
  const [ticketStatusFilters,setTicketStatusFilters]=useState(initialRoute.ticketStatusFilters||[]);
  const [fieldSection,setFieldSection]=useState(initialRoute.fieldSection||"plan");
  const [fieldScope,setFieldScope]=useState(initialRoute.fieldScope||"");
  const [fieldProject,setFieldProject]=useState(initialRoute.fieldProject||"all");
  const [fieldPerson,setFieldPerson]=useState(initialRoute.fieldPerson||"");
  const [fieldType,setFieldType]=useState(initialRoute.fieldType||"all");
  const [fieldWeek,setFieldWeek]=useState(initialRoute.fieldWeek||0);
  const [importType,setImportType]=useState(initialRoute.importType||"all");
  const [reportProject,setReportProject]=useState(initialRoute.reportProject||"");
  const [reportGroup,setReportGroup]=useState(initialRoute.reportGroup||"operations");
  const [taskToOpen,setTaskToOpen]=useState(initialRoute.taskId||"");
  const [ticketToOpen,setTicketToOpen]=useState({projectId:initialRoute.ticketProjectId||"",ticketId:initialRoute.ticketId||""});
  const [responsibilityFilters,setResponsibilityFilters]=useState([]);
  const [previewCustomerProjectId,setPreviewCustomerProjectId]=useState("");
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<768);
  const [authSession,setAuthSession]=useState(null);
  const [authReady,setAuthReady]=useState(!REQUIRE_AUTH);
  const [passwordRecovery,setPasswordRecovery]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [loadedAuthUserId,setLoadedAuthUserId]=useState("");
  const fileRef=useRef();
  const skipNextSave=useRef(true);
  const routeApplyingRef=useRef(false);
  const touchStartRef=useRef(null);

  // Start waking the API while Supabase restores the persisted session.
  useEffect(()=>{
    if(USE_DATA_API)fetch(apiUrl("/health")).catch(()=>{});
  },[]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await applyWeatherThemeFromGeo();
      } catch (error) {
        if (!active) return;
        if (error?.code === 1 || error?.code === 2) {
          console.info("Konum izni reddedildi, varsayilan arkaplan kullaniliyor.");
          return;
        }
        console.warn("Hava durumu teması uygulanirken hata:", error);
      }
    })();
    const timer = setInterval(() => {
      if (!active) return;
      applyWeatherThemeFromGeo().catch(() => {});
    }, 30 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => () => restoreDefaultWeatherTheme(), []);

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
    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
      setAuthSession(session||null);
      setAuthReady(true);
      if(event==="PASSWORD_RECOVERY")setPasswordRecovery(true);
      if(event==="SIGNED_OUT")setPasswordRecovery(false);
    });
    return ()=>listener.subscription.unsubscribe();
  },[]);

  // Ilk yukleme: Supabase'den veri cek
  useEffect(()=>{
    if(REQUIRE_AUTH&&(!authReady||!authSession))return;
    let cancelled=false;
    // Once localStorage'dan kullanici kimligini geri yukle
    try{
      const savedUid=REQUIRE_AUTH?"":initialSearch.get("user")||localStorage.getItem("corject_uid");
      if(savedUid) setState(s=>({...s,currentUserId:savedUid}));
      if(!REQUIRE_AUTH&&initialSearch.get("user"))localStorage.setItem("corject_uid",initialSearch.get("user"));
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
        try{ savedUid=REQUIRE_AUTH?"":initialSearch.get("user")||localStorage.getItem("corject_uid")||""; }catch(e){}
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
  const internalPeople=state.people.filter(person=>person.userType!=="customer");
  const isAdmin=currentUser?.isAdmin||false;
  const customerPreviewProject=previewCustomerProjectId?state.projects.find(project=>project.id===previewCustomerProjectId):null;
  const customerView=Boolean(currentUser&&(isCustomerUser(currentUser)||customerPreviewProject));
  const effectiveCustomerId=customerPreviewProject?.id||currentUser?.customerId||"";
  const useAdminHome=isAdmin&&!customerView&&currentUser?.defaultDashboard==="admin";
  const tenantProfile=resolveTenantProfile(state.tenantProfile);
  useEffect(()=>{
    if(currentUser?.ticketOnly&&!["tickets","notifications"].includes(view)){
      setView("tickets");
      setSelProject(null);
    }
    if(customerView&&!selProject&&!["dashboard","tickets","notifications"].includes(view)){
      setView("dashboard");
      setSelProject(null);
    }
  },[currentUser?.ticketOnly,customerView,view,selProject]);

  useEffect(()=>{
    if(!customerView||CUSTOMER_VISIBLE_PROJECT_TABS.has(projectTab))return;
    setProjectTab("setup");
  },[customerView,projectTab]);

  useEffect(()=>{
    if(!dataLoaded||!currentUser||!selProject)return;
    const routeProject=state.projects.find(item=>item.id===selProject);
    const allowedProject=routeProject&&(
      !customerView||
      routeProject.id===effectiveCustomerId||
      routeProject.customerId===effectiveCustomerId||
      canCustomerAccessProject(currentUser,routeProject)
    );
    if(!allowedProject){
      setSelProject(null);
      setSelMilestone(null);
      setProjectTab(DEFAULT_PROJECT_TAB);
      setView("projects");
      return;
    }
    if(!PROJECT_ROUTE_TABS.has(projectTab))setProjectTab(DEFAULT_PROJECT_TAB);
  },[dataLoaded,currentUser,selProject,projectTab,customerView,effectiveCustomerId,state.projects]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const onPopState=()=>{
      const next=routeFromLocation(window.location);
      routeApplyingRef.current=true;
      setView(next.view||"dashboard");
      setSelProject(next.selProject||null);
      setSelMilestone(null);
      setProjectTab(next.projectTab||DEFAULT_PROJECT_TAB);
      setAdminSection(next.adminSection||"overview");
      setTicketMineOnly(Boolean(next.ticketMineOnly));
      setTicketTab(next.ticketTab||"tickets");
      setTicketSearch(next.ticketSearch||"");
      setTicketProjectFilters(next.ticketProjectFilters||[]);
      setTicketStatusFilters(next.ticketStatusFilters||[]);
      setFieldSection(next.fieldSection||"plan");
      setFieldScope(next.fieldScope||"");
      setFieldProject(next.fieldProject||"all");
      setFieldPerson(next.fieldPerson||"");
      setFieldType(next.fieldType||"all");
      setFieldWeek(next.fieldWeek||0);
      setImportType(next.importType||"all");
      setReportProject(next.reportProject||"");
      setReportGroup(next.reportGroup||"operations");
      setTaskToOpen(next.taskId||"");
      setTicketToOpen({projectId:next.ticketProjectId||"",ticketId:next.ticketId||""});
      setProjectScope(next.projectScope||"all");
      setProjectSearch(next.projectSearch||"");
      setProjectSegment(next.projectSegment||"all");
      setProjectViewMode(next.projectViewMode||"cards");
    };
    window.addEventListener("popstate",onPopState);
    return ()=>window.removeEventListener("popstate",onPopState);
  },[]);

  useEffect(()=>{
    if(typeof window==="undefined")return;
    const nextPath=pathForRouteState({view,selProject,projectTab,adminSection,ticketMineOnly,ticketTab,ticketSearch,ticketProjectFilters,ticketStatusFilters,fieldSection,fieldScope,fieldProject,fieldPerson,fieldType,fieldWeek,importType,reportProject,reportGroup,taskId:taskToOpen,ticketProjectId:ticketToOpen.projectId,ticketId:ticketToOpen.ticketId,projectScope,projectSearch,projectSegment,projectViewMode});
    const currentPath=`${window.location.pathname}${window.location.search}`;
    const applying=routeApplyingRef.current;
    routeApplyingRef.current=false;
    if(currentPath===nextPath)return;
    const method=applying?"replaceState":"pushState";
    window.history[method]({corjectRoute:true},"",nextPath);
  },[view,selProject,projectTab,adminSection,ticketMineOnly,ticketTab,ticketSearch,ticketProjectFilters,ticketStatusFilters,fieldSection,fieldScope,fieldProject,fieldPerson,fieldType,fieldWeek,importType,reportProject,reportGroup,taskToOpen,ticketToOpen.projectId,ticketToOpen.ticketId,projectScope,projectSearch,projectSegment,projectViewMode]);

  const navigateTo=(target,options={})=>{
    const nextView=target==="ticket"?"tickets":target;
    if(nextView==="dashboard"||nextView==="admin")setAdminSection(options.adminSection||"overview");
    else if(options.adminSection)setAdminSection(options.adminSection);
    if(nextView==="projects"&&options.projectScope)setProjectScope(options.projectScope);
    if(nextView==="tickets")setTicketMineOnly(Boolean(options.ticketMineOnly));
    if(nextView!=="mytasks"&&!options.taskId)setTaskToOpen("");
    else if(options.taskId)setTaskToOpen(options.taskId);
    if(nextView!=="tickets"&&!options.ticketId)setTicketToOpen({projectId:"",ticketId:""});
    else if(options.ticketId)setTicketToOpen({projectId:options.ticketProjectId||"",ticketId:options.ticketId});
    setView(nextView);
    setSelProject(null);
    setSelMilestone(null);
    if(options.closeMobile!==false)setMobileMenuOpen(false);
  };
  const openProject=(projectId,tab=DEFAULT_PROJECT_TAB,options={})=>{
    if(options.projectScope)setProjectScope(options.projectScope);
    setView("projects");
    setSelProject(projectId);
    setSelMilestone(null);
    setTaskToOpen("");
    setTicketToOpen({projectId:"",ticketId:""});
    setProjectTab(tab);
    if(options.closeMobile!==false)setMobileMenuOpen(false);
  };
  const openProjectTab=(tab=DEFAULT_PROJECT_TAB)=>{
    setProjectTab(PROJECT_ROUTE_TABS.has(tab)?tab:DEFAULT_PROJECT_TAB);
  };

  const addLog=(user,action,detail,project,milestone)=>{
    setState(s=>({...s,logs:[{id:uid(),ts:now(),user,userId:s.currentUserId,action,detail,project:project||"",milestone:milestone||""},...s.logs]}));
  };
  const addNotification=(userId,msg,projectName)=>{
    setState(s=>({...s,notifications:[{id:uid(),ts:now(),userId,msg,projectName,read:false},...(s.notifications||[])]}));
  };
  const dateFieldsChanged=(oldItem={},data={})=>["startDate","dueDate","actualStart","actualEnd"].some(key=>Object.prototype.hasOwnProperty.call(data,key)&&String(data[key]||"")!==String(oldItem[key]||""));
  const managerForUser=(user=currentUser)=>{
    if(user?.managerId)return user.managerId;
    return state.people.find(person=>person.isAdmin&&person.id!==user?.id)?.id||user?.id;
  };
  const requestDateChange=({kind,projectId,projectName,milestoneId,milestoneName,taskId,taskTitle,oldItem,data})=>{
    const requestId=uid();
    const managerId=managerForUser();
    const changedFields=["startDate","dueDate","actualStart","actualEnd"].filter(key=>Object.prototype.hasOwnProperty.call(data,key)&&String(data[key]||"")!==String(oldItem?.[key]||""));
    const request={id:requestId,kind,projectId,projectName,milestoneId,milestoneName,taskId,taskTitle,oldValues:Object.fromEntries(changedFields.map(key=>[key,oldItem?.[key]||""])),data:Object.fromEntries(changedFields.map(key=>[key,data[key]||""])),requestedBy:currentUser.id,requestedByName:currentUser.name,managerId,status:"pending",createdAt:now()};
    setState(s=>({...s,dateChangeRequests:[request,...(s.dateChangeRequests||[])],notifications:[{id:uid(),ts:now(),userId:managerId,msg:`${currentUser.name}, ${projectName} projesinde ${kind==="milestone"?"milestone":"görev"} tarihi değişikliği için onay bekliyor.`,projectName,type:"date_change_request",requestId,read:false},...(s.notifications||[])]}));
    addLog(currentUser.name,"general",`Tarih değişikliği onaya gönderildi: ${taskTitle||milestoneName}`,projectName,milestoneName);
  };
  const resolveDateChangeRequest=(requestId,approved)=>{
    const request=(state.dateChangeRequests||[]).find(item=>item.id===requestId);
    if(!request||request.status!=="pending")return;
    if(approved){
      setState(s=>({...s,
        projects:s.projects.map(projectItem=>{
          if(projectItem.id!==request.projectId)return projectItem;
          if(request.kind==="milestone"){
            return {...projectItem,milestones:projectItem.milestones.map(ms=>ms.id===request.milestoneId?normalizeMilestone({...ms,...request.data,status:ms.status}):ms)};
          }
          return {...projectItem,milestones:projectItem.milestones.map(ms=>ms.id===request.milestoneId?normalizeMilestone({...ms,tasks:ms.tasks.map(task=>task.id===request.taskId?{...task,...request.data}:task)}):ms)};
        }),
        dateChangeRequests:(s.dateChangeRequests||[]).map(item=>item.id===requestId?{...item,status:"approved",resolvedAt:now(),resolvedBy:currentUser.id}:item),
        notifications:[{id:uid(),ts:now(),userId:request.requestedBy,msg:`Tarih değişikliği onaylandı: ${request.taskTitle||request.milestoneName}`,projectName:request.projectName,type:"date_change_result",read:false},...(s.notifications||[]).map(item=>item.requestId===requestId?{...item,read:true}:item)]
      }));
      addLog(currentUser.name,"general",`Tarih değişikliği onaylandı: ${request.taskTitle||request.milestoneName}`,request.projectName,request.milestoneName);
    } else {
      setState(s=>({...s,dateChangeRequests:(s.dateChangeRequests||[]).map(item=>item.id===requestId?{...item,status:"rejected",resolvedAt:now(),resolvedBy:currentUser.id}:item),notifications:[{id:uid(),ts:now(),userId:request.requestedBy,msg:`Tarih değişikliği reddedildi: ${request.taskTitle||request.milestoneName}`,projectName:request.projectName,type:"date_change_result",read:false},...(s.notifications||[]).map(item=>item.requestId===requestId?{...item,read:true}:item)]}));
      addLog(currentUser.name,"general",`Tarih değişikliği reddedildi: ${request.taskTitle||request.milestoneName}`,request.projectName,request.milestoneName);
    }
  };
  const markAllRead=()=>setState(s=>({...s,notifications:(s.notifications||[]).map(n=>isNotificationForUser(n,currentUser)?{...n,read:true}:n)}));
  const goBackInApp=useCallback(()=>{
    if(mobileQuickSheet){setMobileQuickSheet(false);return true;}
    if(mobileQuick){setMobileQuick(null);return true;}
    if(modal){setModal(null);return true;}
    if(selProject){
      if(projectTab!=="setup"){openProjectTab("setup");return true;}
      navigateTo("projects",{closeMobile:false});
      return true;
    }
    if(view&&view!=="dashboard"){
      navigateTo("dashboard",{closeMobile:false});
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
  const login=(id)=>{ setState(s=>({...s,currentUserId:id})); navigateTo("dashboard"); try{localStorage.setItem("corject_uid",id);}catch(e){} };
  const logout=()=>{ if(REQUIRE_AUTH)supabase.auth.signOut();setState(s=>({...s,currentUserId:null})); try{localStorage.removeItem("corject_uid");}catch(e){} navigateTo("dashboard"); };

  if(REQUIRE_AUTH&&!authReady)return <AppLoadingScreen progress={loadProgress} status="Oturum kontrol ediliyor" logoSrc={corjectLogo}/>;
  if(REQUIRE_AUTH&&!authSession)return <AuthLoginScreen appVersion={APP_VERSION}/>;
  if(REQUIRE_AUTH&&passwordRecovery)return <PasswordRecoveryScreen onDone={()=>setPasswordRecovery(false)}/>;
  if(loadError)return <div style={{height:"100vh",display:"grid",placeItems:"center",background:"var(--text)",color:"var(--surface-soft)",padding:20,fontFamily:"Inter,Segoe UI,sans-serif"}}>
    <div style={{maxWidth:520,textAlign:"center"}}>
      <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Veriler yüklenemedi</div>
      <div style={{fontSize:12,color:"var(--danger)",lineHeight:1.6,marginBottom:16}}>{loadError}</div>
      <button onClick={()=>window.location.reload()} style={{border:0,borderRadius:10,padding:"10px 16px",background:"var(--accent)",color:"#fff",fontWeight:800,cursor:"pointer"}}>Tekrar Dene</button>
    </div>
  </div>;
  if(!dataLoaded||(REQUIRE_AUTH&&loadedAuthUserId!==authSession?.user?.id)) return <AppLoadingScreen progress={loadProgress} status={loadProgress<45?"Güvenli bağlantı kuruluyor":loadProgress<82?"Projeler ve görevler yükleniyor":"Arayüz hazırlanıyor"} logoSrc={corjectLogo}/>;
  if(!currentUser)return REQUIRE_AUTH?<div style={{height:"100vh",display:"grid",placeItems:"center",background:"var(--text)",color:"var(--danger)",padding:20,textAlign:"center"}}>Bu e-posta için aktif Corject profili bulunamadı.</div>:<LoginScreen people={state.people} onLogin={login} appVersion={APP_VERSION} />;

  // Project visibility filter
  const visibleProjects=customerView
    ? state.projects.filter(project=>project.id===effectiveCustomerId||project.customerId===effectiveCustomerId||canCustomerAccessProject(currentUser,project))
    : state.projects;
  const myProjects=customerView?visibleProjects:state.projects.filter(p=>projectPmIds(p).includes(currentUser.id)||projectCustomerSuccessIds(p).includes(currentUser.id)||projectStakeholders(p).some(item=>item.userId===currentUser.id)||(p.members||[]).includes(currentUser.id)||p.milestones.some(ms=>ms.tasks.some(t=>t.assignee===currentUser.id)));
  const listedProjects=(projectScope==="mine"?myProjects:visibleProjects)
    .filter(item=>projectSegment==="connected"?Boolean(item.connectedSupplier):projectSegment==="uat"?Boolean(item.uatAccepted):projectSegment==="standard"?!item.connectedSupplier&&!item.uatAccepted:true)
    .filter(item=>`${item.name||""} ${item.description||""} ${(item.customerProfile?.website)||""}`.toLocaleLowerCase("tr-TR").includes(projectSearch.trim().toLocaleLowerCase("tr-TR")));
  const exportListedProjects=()=>downloadXlsx([
    ["Proje","Müşteri","Durum","Sorumluluk","Sorumlu","UAT / Devir","Başlangıç","Hedef Bitiş","İlerleme %","Görev","Geciken","Ticket","Makine","Devrede"],
    ...listedProjects.map(project=>{
      const tasks=project.milestones.flatMap(milestone=>milestone.tasks||[]);
      const done=tasks.filter(task=>task.status==="Tamamlandı").length;
      const progress=tasks.length?Math.round(done/tasks.length*100):0;
      const delayed=tasks.filter(task=>delayLvl(task.dueDate,task.status)).length;
      const machines=project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[];
      const commissioned=machines.filter(machine=>machine.commissioned).length;
      const responsibles=projectResponsibleIds(project).map(id=>state.people.find(person=>person.id===id)?.name).filter(Boolean).join(", ");
      return [project.name,project.customerProfile?.name||project.customerName||"",project.status||"",project.uatAccepted?"Customer Success":"PM",responsibles,project.uatAcceptedAt||"",project.startDate||"",project.endDate||"",progress,`${done}/${tasks.length}`,delayed,((state.projectTickets||{})[project.id]||[]).length,machines.length,commissioned];
    })
  ],`projeler-toplu-${todayStr()}.xlsx`,"Projeler");
  const taskDeadlineWarnings=visibleProjects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>delayLvl(t.dueDate,t.status)).map(t=>({...t,projectId:proj.id,projectName:proj.name,projectColor:proj.color,level:delayLvl(t.dueDate,t.status),days:daysDiff(t.dueDate)}))));
  const todoDeadlineWarnings=(((state.userNotes||{})[currentUser.id]?.todos)||[]).filter(t=>!t.done&&t.dueDate&&daysDiff(t.dueDate)>0).map(t=>({id:t.id,title:t.action||t.text,projectName:t.customer||"Kişisel To-Do",dueDate:t.dueDate,kind:"todo",level:daysDiff(t.dueDate)>=7?"critical":"normal",days:daysDiff(t.dueDate),status:"Bekliyor"}));
  const deadlineWarnings=[...taskDeadlineWarnings,...todoDeadlineWarnings].sort((a,b)=>b.days-a.days);

  const project=state.projects.find(p=>p.id===selProject);
  const milestone=project?.milestones.find(m=>m.id===selMilestone);
  const currentMs=project?.milestones.find(m=>m.status!=="Tamamland\u0131");
  const activePMs=project?projectResponsibleIds(project).map(id=>state.people.find(p=>p.id===id)).filter(Boolean):[];
  const activeStakeholders=project?projectStakeholders(project).map(item=>({...item,person:state.people.find(p=>p.id===item.userId)})).filter(item=>item.person):[];
  const canManageProjectActions=!customerView&&(isAdmin||(project?projectResponsibleIds(project).includes(currentUser.id):false));
  const mutProject=(fn)=>setState(s=>({...s,projects:s.projects.map(p=>p.id===selProject?fn(p):p)}));
  const projectTabs=[
    ["setup","projects","Proje Bilgileri"],
    ["gantt","gantt","Proje Planı"],
    ["tasks","tasks","Görevler"],
    ["tickets","ticket","Ticketlar"],
    ["actions","activity","Aksiyon"],
    ["risks","risk","Riskler"],
    ["notlar","notes","Notlar"],
    ["projlogs","activity","Log"],
  ].filter(([id])=>!customerView||CUSTOMER_VISIBLE_PROJECT_TABS.has(id));

  const addProject=(data)=>{ const assigned=[...(data.pmIds||[]),...(data.customerSuccessIds||[]),...(data.stakeholders||[]).map(item=>item.userId)].filter(Boolean);const p={id:uid(),milestones:[],risks:[],machines:[],commissioningTree:[],commissioningTracking:false,pmIds:[],customerSuccessIds:[],stakeholders:[],readinessChecklist:createReadinessChecklist(),readinessThreshold:80,raciContacts:[],documents:[],reportSchedules:[],...data,members:[...new Set([...(data.members||[]),...assigned])],pm:data.pmIds?.[0]||data.pm||""}; setState(s=>({...s,projects:[...s.projects,p]}));openProject(p.id,"setup");addLog(currentUser.name,"project_create",`${p.name} projesi oluşturuldu`,p.name); };
  const addPerson=async(data)=>{
    const avatar=data.name.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase();
    const person={id:uid(),avatar,...data};
    setState(s=>({...s,people:[...s.people,person]}));
    addLog(currentUser.name,"general",`${data.userType==="customer"?"Müşteri kullanıcısı":"Ekip üyesi"} eklendi: ${data.name}`);
    try{
      const authResult=await ensureAuthUserForPerson(person);
      if(authResult?.avatarUrl)setState(s=>({...s,people:s.people.map(item=>item.id===person.id?{...item,avatarUrl:authResult.avatarUrl,slackUserId:authResult.slackUserId||item.slackUserId}:item)}));
    }catch(error){
      console.warn("Auth kullanıcısı oluşturulamadı",error);
      if (data.userType !== "customer") alert(`Kişi eklendi ancak giriş hesabı oluşturulamadı: ${error.message}`);
    }
  };
  const updatePerson=async(id,data)=>{
    const avatar=data.name.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase();
    const existing=state.people.find(person=>person.id===id)||{};
    const person={...existing,...data,avatar,id};
    setState(s=>({...s,people:s.people.map(item=>item.id===id?person:item)}));
    addLog(currentUser.name,"general",`Kişi güncellendi: ${data.name}`);
    try{
      const authResult=await ensureAuthUserForPerson(person);
      if(authResult?.avatarUrl)setState(s=>({...s,people:s.people.map(item=>item.id===person.id?{...item,avatarUrl:authResult.avatarUrl,slackUserId:authResult.slackUserId||item.slackUserId}:item)}));
    }catch(error){
      console.warn("Auth kullanıcısı güncellenemedi",error);
    }
  };
  const deletePerson=(id)=>setState(s=>({...s,
    people:s.people.filter(person=>person.id!==id).map(person=>person.managerId===id?{...person,managerId:""}:person),
    projects:s.projects.map(p=>({...p,pm:p.pm===id?"":p.pm,pmIds:projectPmIds(p).filter(pmId=>pmId!==id),customerSuccessIds:projectCustomerSuccessIds(p).filter(userId=>userId!==id),stakeholders:projectStakeholders(p).filter(item=>item.userId!==id),members:(p.members||[]).filter(memberId=>memberId!==id),milestones:p.milestones.map(ms=>({...ms,tasks:ms.tasks.map(t=>t.assignee===id?{...t,assignee:""}:t)}))})),
    personalTasks:(s.personalTasks||[]).map(t=>t.assignee===id?{...t,assignee:""}:t)
  }));
  const updateProjectById=(id,data)=>{setState(s=>({...s,projects:s.projects.map(p=>{if(p.id!==id)return p;const assigned=[...(data.pmIds||[]),...(data.customerSuccessIds||[]),...(data.stakeholders||[]).map(item=>item.userId)].filter(Boolean);return {...p,...data,members:[...new Set([...(p.members||[]),...assigned])],pm:data.pmIds?.[0]||""};})}));addLog(currentUser.name,"general","Proje güncellendi",data.name);};
  const deleteProject=(id)=>{ if(!isAdmin)return; const name=state.projects.find(p=>p.id===id)?.name; setState(s=>{const projectActions={...(s.projectActions||{})};delete projectActions[id];return {...s,projects:s.projects.filter(p=>p.id!==id),fieldPlans:(s.fieldPlans||[]).filter(plan=>plan.projectId!==id),projectActions};}); navigateTo("projects"); addLog(currentUser.name,"general","Proje silindi: "+name); };
  const addRisk=(data)=>{ mutProject(p=>({...p,risks:[...(p.risks||[]),{id:uid(),...data}]})); addLog(currentUser.name,"risk_add",data.title,project?.name); };
  const updateRisk=(rId,data)=>mutProject(p=>({...p,risks:(p.risks||[]).map(r=>r.id===rId?{...r,...data}:r)}));
  const deleteRisk=(rId)=>mutProject(p=>({...p,risks:(p.risks||[]).filter(r=>r.id!==rId)}));
  const addMilestone=(data)=>{ const ms=normalizeMilestone({id:uid(),tasks:[],waitSource:"",...data}); mutProject(p=>({...p,milestones:[...p.milestones,ms]})); addLog(currentUser.name,"milestone_add",ms.name,project?.name); };
  const updateMilestone=(msId,data)=>{
    const old=project?.milestones.find(m=>m.id===msId);
    if(!isAdmin&&dateFieldsChanged(old,data)){
      requestDateChange({kind:"milestone",projectId:project.id,projectName:project.name,milestoneId:msId,milestoneName:old?.name||data.name,oldItem:old,data});
      return;
    }
    mutProject(p=>({...p,milestones:p.milestones.map(m=>m.id===msId?normalizeMilestone({...m,...data,status:m.status}):m)}));
    addLog(currentUser.name,"general","Milestone güncellendi: "+(data.name||old?.name),project?.name);
  };
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
    const milestoneForTask=project?.milestones.find(m=>m.id===msId);
    if(!isAdmin&&dateFieldsChanged(old,data)){
      requestDateChange({kind:"task",projectId:project.id,projectName:project.name,milestoneId:msId,milestoneName:milestoneForTask?.name,taskId,taskTitle:old?.title||data.title,oldItem:old,data});
      return;
    }
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
    openProject(data.projectId,"actions");
  };

  const fullNav=[
    {id:"dashboard",icon:"home",label:"Dashboard"},
    ...(isAdmin?[{id:"admin",icon:"admin",label:"Yönetim"}]:[]),
    ...(isAdmin?[{id:"customers",icon:"people",label:"Müşteriler"}]:[]),
    {id:"todos",icon:"ticket",label:"To-Do"},
    {id:"projects",icon:"projects",label:"Projeler"},
    {id:"mytasks",icon:"tasks",label:`Görevlerim${myOpenTaskCount?` (${myOpenTaskCount})`:""}`},
    {id:"fieldops",icon:"calendar",label:"Saha Y\u00f6netimi"},
    {id:"deadlines",icon:"clock",label:`Termin Uyar\u0131lar\u0131${deadlineWarnings.length?` (${deadlineWarnings.length})`:""}`},
    {id:"reminders",icon:"bell",label:"Hatırlatıcılar"},
    {id:"tickets",icon:"ticket",label:"Ticketlar"},
    {id:"ai",icon:"activity",label:"AI Asistan"},
    ...(isAdmin?[{id:"import",icon:"reports",label:"Import Merkezi"}]:[]),
    ...(isAdmin?[{id:"mailcenter",icon:"mail",label:"Mail Merkezi"}]:[]),
    {id:"reports",icon:"reports",label:"Raporlar"},
    {id:"people",icon:"people",label:"Ekip"},
    {id:"logs",icon:"activity",label:"Aktivite"},
  ];
  const nav=customerView
    ? fullNav.filter(item=>["dashboard","tickets"].includes(item.id)).map(item=>item.id==="dashboard"?{...item,label:"Özet"}:item)
    : currentUser.ticketOnly?fullNav.filter(item=>["tickets"].includes(item.id)):fullNav;

  return <><GlobalStyle /><div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ display:"flex", height:"100vh", width:"100vw", fontFamily:"var(--font-ui, Manrope, Segoe UI, sans-serif)", background:"transparent", color:"var(--text, #112327)", overflow:"hidden", position:"relative" }}>
    {/* Mobil ust bar */}
    {isMobile&&<div className="glass-surface mobile-glass-topbar" style={{ position:"fixed", top:0, left:0, right:0, height:58, borderTop:0, borderLeft:0, borderRight:0, display:"flex", alignItems:"center", padding:"0 14px", zIndex:900, gap:10 }}>
      <button className="mobile-brand-button" onClick={()=>navigateTo("dashboard")} style={{border:0,background:"transparent",display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:0}}><img src={tenantProfile.logoUrl||corjectLogo} alt="" style={{width:34,height:34,objectFit:"contain"}}/><span style={{fontFamily:"var(--font-display, 'Plus Jakarta Sans', Manrope, sans-serif)",fontSize:20,fontWeight:800,color:"var(--text, #112327)",letterSpacing:"-.035em",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tenantProfile.name}</span></button>
      <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
        <button className="mobile-icon-button" onClick={()=>navigateTo("notifications")} style={{ background:"var(--surface-soft, #f6fafb)", border:"1px solid var(--border, #cfe0e3)", borderRadius:12, cursor:"pointer", position:"relative", padding:8, color:"var(--muted, #5b6f74)", display:"grid", placeItems:"center" }}>
          <Icon name="bell" size={17}/>
          {(state.notifications||[]).filter(n=>isNotificationForUser(n,currentUser)&&!n.read).length>0&&<span style={{ position:"absolute", top:5, right:5, width:8, height:8, background:"var(--danger)", borderRadius:"50%" }} />}
        </button>
        <button className="mobile-icon-button" title="Tüm özellikler" onClick={()=>navigateTo("mobilemenu")} style={{background:"var(--surface-soft, #f6fafb)",border:"1px solid var(--border, #cfe0e3)",borderRadius:12,cursor:"pointer",padding:"7px 9px",color:"var(--muted, #5b6f74)",display:"grid",placeItems:"center",fontSize:18,fontWeight:900,lineHeight:1}}>☰</button>
        <button className="mobile-profile-button" title="Profilim" onClick={()=>setModal({type:"editProfile"})} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}><Avatar initials={currentUser.avatar} imageUrl={currentUser.avatarUrl} size={34} color={isAdmin?"var(--danger, #b93f33)":"var(--accent, #0b8a94)"} /></button>
      </div>
    </div>}
    {/* Sidebar */}
    {!isMobile&&<div className="glass-surface" style={{ width:isMobile?220:254, display:"flex", flexDirection:"column", flexShrink:0, borderTop:0, borderBottom:0, borderLeft:0,
      ...(isMobile?{ position:"fixed", top:0, left:mobileMenuOpen?0:-240, bottom:0, zIndex:960, transition:"left .25s ease", boxShadow:mobileMenuOpen?"4px 0 20px rgba(0,0,0,0.3)":"none" }:{}) }}>
      <div style={{ padding:"20px 16px 15px", borderBottom:"1px solid var(--glass-border, rgb(207 224 227 / 68%))", background:"radial-gradient(circle at top left,rgb(11 138 148 / 12%),transparent 44%),radial-gradient(circle at 90% 12%,rgb(191 122 18 / 10%),transparent 34%)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button onClick={()=>navigateTo("dashboard")} style={{border:0,background:"transparent",display:"flex",alignItems:"center",gap:10,cursor:"pointer",minWidth:0}}><img src={tenantProfile.logoUrl||corjectLogo} alt="" style={{width:42,height:42,objectFit:"contain",filter:"drop-shadow(0 7px 14px rgb(11 138 148 / 28%))"}}/><span style={{fontFamily:"var(--font-display, 'Plus Jakarta Sans', Manrope, sans-serif)",fontSize:20,fontWeight:800,color:"var(--text, #112327)",letterSpacing:"-.025em",lineHeight:1,maxWidth:135,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tenantProfile.name}</span></button>
            <button onClick={()=>navigateTo("notifications")} style={{ background:"none", border:"none", cursor:"pointer", position:"relative", padding:4 }}>
              <span style={{ color:"var(--muted, #5b6f74)", display:"flex" }}><Icon name="bell" size={17} /></span>
              {(state.notifications||[]).filter(n=>isNotificationForUser(n,currentUser)&&!n.read).length>0&&<span style={{ position:"absolute", top:0, right:0, width:8, height:8, background:"var(--danger)", borderRadius:"50%" }} />}
            </button>
          </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
          <button title="Profilim" onClick={()=>{setModal({type:"editProfile"});setMobileMenuOpen(false);}} style={{background:"none",border:"none",padding:0,cursor:"pointer"}}><Avatar initials={currentUser.avatar} imageUrl={currentUser.avatarUrl} size={28} color={isAdmin?"var(--danger, #b93f33)":"var(--accent, #0b8a94)"} /></button>
          <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", minHeight:28 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"var(--text, #112327)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1 }}>{currentUser.name}</div>
          </div>
          <button onClick={logout} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--muted, #5b6f74)", fontSize:12, padding:2 }}>Çıkış</button>
        </div>
      </div>
      <nav className="sidebar-nav" style={{ padding:"12px 10px", flex:1, overflowY:"auto" }}>
        {nav.map(n=><button key={n.id} onClick={()=>navigateTo(n.id,{ticketMineOnly:false})}
          style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 11px", borderRadius:13, border:"1px solid "+(view===n.id&&!selProject?"var(--glass-border, rgb(207 224 227 / 68%))":"transparent"), cursor:"pointer", background:view===n.id&&!selProject?"linear-gradient(135deg,var(--accent-ink, #def5f8),rgb(255 255 255 / 62%))":"transparent", color:view===n.id&&!selProject?"var(--accent, #0b8a94)":"var(--muted, #5b6f74)", fontSize:13, fontWeight:850, textAlign:"left", marginBottom:4, boxShadow:view===n.id&&!selProject?"0 16px 34px -30px rgb(11 138 148 / 72%)":"none" }}>
          <span style={{ display:"flex", flexShrink:0, opacity:view===n.id&&!selProject?1:.82 }}><Icon name={n.icon} size={16} /></span> {n.label}
        </button>)}
      </nav>
    </div>}

    {/* Main */}
    <div style={{ flex:1, overflow:"auto", display:"flex", flexDirection:"column", paddingTop:isMobile?58:0, paddingBottom:isMobile?82:0 }}>
      {customerPreviewProject&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:"var(--accent-ink)",color:"var(--accent)",borderBottom:"1px solid color-mix(in srgb, var(--accent) 22%, var(--border))",padding:"9px 14px",fontSize:12,fontWeight:850}}>
        <span>Müşteri görünümü: {customerPreviewProject.customerProfile?.name||customerPreviewProject.customerName||customerPreviewProject.name}</span>
        <button onClick={()=>{setPreviewCustomerProjectId("");navigateTo("customers");}} style={{border:0,borderRadius:8,background:"#fff",color:"var(--accent)",fontWeight:900,padding:"6px 10px",cursor:"pointer"}}>Yöneticiye Dön</button>
      </div>}
      {(view==="dashboard"||(view==="admin"&&!isAdmin))&&!selProject&&!useAdminHome&&(customerView?<SharedCustomerDashboardPage state={state} currentUser={currentUser} projects={visibleProjects} onNavigate={v=>navigateTo(v,{ticketMineOnly:v==="tickets"})} onOpenProject={id=>openProject(id,"setup")}/>:isMobile?<SharedMobileHomePage state={state} setState={setState} currentUser={currentUser} myProjects={myProjects} deadlineWarnings={deadlineWarnings} onNavigate={v=>navigateTo(v,{projectScope:v==="projects"?"all":undefined,ticketMineOnly:v==="tickets"})} onOpenProject={id=>openProject(id,"setup")}/>:<SharedDashboardPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} myProjects={myProjects} deadlineWarnings={deadlineWarnings} onNavigate={v=>navigateTo(v,{projectScope:v==="projects"?"all":undefined,ticketMineOnly:v==="tickets"})} onOpenProject={id=>openProject(id,"setup")}/>)}
      {((view==="admin"&&isAdmin)||(view==="dashboard"&&useAdminHome))&&!selProject&&<SharedManagementWorkspace state={state} setState={setState} currentUser={currentUser} initialSection={adminSection} onNavigate={v=>navigateTo(v)} onOpenProject={id=>openProject(id,"setup")} onEditPerson={person=>setModal({type:"editPerson",data:person})} onAddPerson={()=>setModal({type:"addPerson"})} onAssignTask={saveAdminAssignedTask}/>}
      {view==="todos"&&<SharedTodoPage state={state} setState={setState} currentUser={currentUser}/>}
      {view==="mobilemenu"&&<MobileFeatureMenuPage isAdmin={isAdmin} onNavigate={target=>navigateTo(target,{projectScope:target==="projects"?"all":undefined,ticketMineOnly:target==="tickets"})}/>}
      {view==="ai"&&!selProject&&<SharedAIWorkspace projects={visibleProjects}/>}
      {view==="import"&&isAdmin&&!selProject&&<SharedImportCenter state={state} setState={setState} currentUser={currentUser} importType={importType} onImportTypeChange={setImportType}/>}
      {view==="mailcenter"&&isAdmin&&!selProject&&<SharedMailCenterPage state={state} setState={setState}/>}

      {/* PROJECT DETAIL */}
      {selProject&&project&&<div className="project-workspace" style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <SharedProjectBusinessCard project={project} activePMs={activePMs} activeStakeholders={activeStakeholders} contacts={(project.raciContacts||[]).filter(contact=>contact.side==="Müşteri")} progress={progress} doneT={doneT} totalT={totalT} currentMs={currentMs} readiness={readinessScore(project)} commissioningPercent={project.commissioningTracking?projectCommissioningPercent:null} overdueC={overdueC} criticalC={criticalC} canEdit={canManageProjectActions} onChange={data=>mutProject(item=>({...item,...data}))} onOpenSetup={()=>openProjectTab("setup")} formatDate={fmt} mapsUrlForLocation={mapsUrl} moduleOptions={DEFAULT_ACTIVE_MODULES}/>
        <div className="project-tab-shell" style={{padding:isMobile?"9px clamp(12px,2.2vw,22px) 11px":"0 clamp(12px,2.2vw,22px) 12px"}}>
          <div className="project-tab-scroll">
            {projectTabs.map(([id,icon,label])=><button key={id} className={`project-tab ${projectTab===id?"is-active":""}`} onClick={()=>openProjectTab(id)}><Icon name={icon} size={14}/>{label}</button>)}
          </div>
        </div>
        {false&&<div style={{ background:"#fff", borderBottom:"1px solid var(--border)", padding:"13px 20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{ width:11, height:11, borderRadius:"50%", background:project.color }} />
            <h2 style={{ margin:0, fontSize:17, fontWeight:800, color:"var(--text)", background:"#fff", borderRadius:6, padding:"2px 4px" }}>{project.name}</h2>
            <Badge label={project.status} />
            <button onClick={()=>openProjectTab("setup")} style={{border:0,background:readinessScore(project)>=Number(project.readinessThreshold||80)?"color-mix(in srgb, var(--success) 10%, white 90%)":"color-mix(in srgb, var(--danger) 9%, white 91%)",color:readinessScore(project)>=Number(project.readinessThreshold||80)?"var(--success)":"var(--danger)",borderRadius:12,padding:"3px 9px",fontSize:11,fontWeight:800,cursor:"pointer"}}>Başlangıç: {readinessScore(project)}/100</button>
            {project.commissioningTracking&&<span style={{background:"color-mix(in srgb, var(--success) 10%, white 90%)",color:"var(--success)",borderRadius:12,padding:"3px 9px",fontSize:11,fontWeight:800}}>Devreye Alma: %{projectCommissioningPercent}</span>}
            {overdueC>0&&<span style={{ background:"color-mix(in srgb, var(--warning) 10%, white 90%)", color:"var(--warning)", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Gecikmiş: {overdueC}</span>}
            {criticalC>0&&<span style={{ background:"color-mix(in srgb, var(--danger) 9%, white 91%)", color:"var(--danger)", borderRadius:12, padding:"2px 9px", fontSize:11, fontWeight:700 }}>Kritik: {criticalC}</span>}
          </div>
          <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--muted)", flexWrap:"wrap", alignItems:"center" }}>
            {activePMs.length>0&&<span>{project.uatAccepted?"Customer Success":"PM"}: <b>{activePMs.map(p=>p.name).join(", ")}</b></span>}
            {activeStakeholders.map(item=><span key={item.id} style={{background:"var(--surface-soft)",borderRadius:7,padding:"2px 7px"}}>{item.role}: <b>{item.person.name}</b></span>)}
            {(project.customerContacts||[]).map(contact=><span key={contact.id} style={{background:"var(--accent-ink)",color:"var(--accent)",borderRadius:7,padding:"3px 7px"}}><b>{contact.name}</b>{contact.title?` · ${contact.title}`:""}{contact.email?` · ${contact.email}`:""}{contact.phone?` · ${contact.phone}`:""}</span>)}
            <span>{fmt(project.startDate)} - {fmt(project.endDate)}</span>
            <span>{doneT}/{totalT} görev</span>
            {currentMs&&<span style={{ background:"var(--accent-ink)", color:"var(--accent)", borderRadius:8, padding:"2px 9px", fontWeight:600 }}>Aktif: {currentMs.name} ({fmt(currentMs.dueDate)})</span>}
          </div>
          {totalT>0&&<div style={{ display:"flex", alignItems:"center", gap:9, marginTop:7 }}>
            <div style={{ flex:1, height:5, background:"var(--border)", borderRadius:10 }}><div style={{ width:`${progress}%`, height:"100%", background:project.color, borderRadius:10 }} /></div>
            <span style={{ fontSize:12, fontWeight:700, color:project.color }}>{progress}%</span>
          </div>}
          <div style={{ display:"flex", gap:5, marginTop:10, overflowX:"auto", paddingBottom:3, scrollbarWidth:"thin" }}>
            {[["setup","projects","Proje Bilgileri"],["gantt","gantt","Proje Planı"],["tasks","tasks","Görevler"],["tickets","ticket","Ticketlar"],["actions","activity","Aksiyon"],["risks","risk","Riskler"],["notlar","notes","Notlar"],["projlogs","activity","Log"]].map(([id,icon,label])=><button key={id} onClick={()=>openProjectTab(id)} style={{ padding:"7px 11px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:12, background:projectTab===id?project.color:"var(--accent-ink)", color:projectTab===id?"#fff":"var(--muted)", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6, whiteSpace:"nowrap", flexShrink:0 }}><Icon name={icon} size={14}/>{label}</button>)}
          </div>
        </div>}

        {projectTab==="setup"&&<SharedProjectSetupPanel project={project} canEdit={canManageProjectActions} customerView={customerView} onChange={data=>mutProject(item=>({...item,...data}))} state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin&&!customerView} authHeaders={authHeaders} updateApiStateVersion={value=>{apiStateVersion=value||apiStateVersion;}} AIWorkspaceComponent={SharedAIWorkspace}/>}
        {projectTab==="tasks"&&<div className="project-section" style={{padding:isMobile?"14px 12px 18px":"18px 22px"}}>
          <SharedResponsibilitySummary project={project} selected={responsibilityFilters} onChange={setResponsibilityFilters}/>
          <div className="liquid-card" style={{borderRadius:18,padding:16,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h3 style={{margin:0,fontSize:16}}>Milestonelar</h3><span style={{fontSize:11,color:"var(--muted, #5b6f74)"}}>Görevleri görmek için milestone seçin. Açık kartlar daha detaylı görünür.</span></div>{isAdmin&&!customerView&&<Btn small onClick={()=>setModal({type:"addMilestone"})}>+ Milestone</Btn>}</div>
          {project.milestones.map(ms=>{const visibleTasks=responsibilityFilters.length?ms.tasks.filter(task=>responsibilityFilters.includes(task.responsibilityGroup||"Proje Ekibi")):ms.tasks;const filteredMilestone={...ms,tasks:visibleTasks};const open=selMilestone===ms.id;const done=visibleTasks.filter(t=>t.status==="Tamamland\u0131").length;const percent=visibleTasks.length?Math.round(done/visibleTasks.length*100):0;if(responsibilityFilters.length&&!visibleTasks.length)return null;return <div key={ms.id} className={`milestone-card ${open?"is-open":""}`}>
            <button className="milestone-trigger" onClick={()=>{setSelMilestone(open?null:ms.id);setShowDoneTasks(false);}}>
              <span style={{width:34,height:34,borderRadius:12,color:"var(--accent, #0b8a94)",background:"var(--accent-ink, #def5f8)",display:"grid",placeItems:"center",flexShrink:0}}><Icon name="tasks" size={17}/></span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:850,fontSize:13,color:"var(--text, #112327)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ms.name}</div><div style={{fontSize:11,color:"var(--muted, #5b6f74)",marginTop:4}}>{fmt(ms.startDate)} - {fmt(ms.dueDate)} · {done}/{visibleTasks.length} tamamlandı</div><div style={{height:5,background:"var(--surface-soft, #f6fafb)",borderRadius:10,overflow:"hidden",marginTop:8}}><span style={{display:"block",height:"100%",width:`${percent}%`,background:"var(--accent, #0b8a94)"}}/></div></div><Badge label={ms.status}/><span style={{fontSize:17,color:"var(--muted, #5b6f74)"}}>{open?"−":"+"}</span>
            </button>
            {open&&<div style={{padding:"14px 16px",borderTop:"1px solid var(--border, #cfe0e3)",background:"rgb(246 250 251 / 54%)"}}><SharedMilestoneTaskPanel milestone={filteredMilestone} project={project} people={state.people} isAdmin={isAdmin&&!customerView} showDone={showDoneTasks} setShowDone={setShowDoneTasks} onEdit={(item)=>setModal({type:"editMilestone",data:item})} onDelete={(id)=>{if(confirm("Silinsin mi?"))deleteMilestone(id);}} onAddTask={(msId)=>setModal({type:"addTask",msId})} onEditTask={(msId,task)=>setModal({type:"editTask",msId,data:task})} onDeleteTask={(msId,taskId)=>{if(confirm("Silinsin mi?"))deleteTask(msId,taskId);}} onCheckTask={(msId,taskId,c)=>updateTask(msId,taskId,{status:c?"Tamamland\u0131":"Bekliyor"})} onTimeTask={(msId,task)=>setModal({type:"timeLog",msId,data:task})} formatDate={fmt} formatFullDate={fmtFull}/></div>}
          </div>;})}
          {!project.milestones.length&&<div className="liquid-card" style={{padding:40,textAlign:"center",color:"var(--muted, #5b6f74)",borderRadius:18}}>Milestone yok.</div>}
        </div>}

        {projectTab==="gantt"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ margin:"0 0 3px", fontSize:14, fontWeight:800 }}>Proje Planı (Gantt)</h3>
            {!customerView&&<div style={{ display:"flex", gap:7, alignItems:"center" }}>
              <Btn small variant="secondary" onClick={downloadTemplate}>Şablon İndir (Excel)</Btn>
              <Btn small variant="primary" onClick={()=>fileRef.current?.click()}>Excel/CSV Yükle</Btn>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:"none" }} onChange={handleImport} />
            </div>}
          </div>
          <SharedGanttChart project={project} />
          {/* Plan listesi - expandable */}
          <SharedPlanListTable project={project} people={state.people} />
          <div style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
            {[[project.color,"Devam Ediyor"],["var(--success)","Tamamlandı"],["var(--warning)","Gecikmiş"],["var(--danger)","Kritik"]].map(([c,l])=><div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:12, height:8, borderRadius:3, background:c }} /><span style={{ fontSize:11, color:"var(--muted)" }}>{l}</span></div>)}
          </div>
        </div>}

        {!customerView&&projectTab==="actions"&&<SharedProjectActionsPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} canManage={canManageProjectActions}/>}

        {!customerView&&projectTab==="risks"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px", maxWidth:680 }}>
          <SharedRiskPanel risks={project.risks||[]} milestones={project.milestones||[]} onAdd={()=>setModal({type:"addRisk"})} onUpdate={updateRisk} onDelete={deleteRisk} canEdit={isAdmin} />
        </div>}

        {projectTab==="tickets"&&<SharedTicketsPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin&&!customerView} customerMode={customerView} />}
        {!customerView&&projectTab==="notlar"&&<SharedProjectNotesPanel project={project} currentUser={currentUser} state={state} setState={setState} isAdmin={isAdmin} canManage={canManageProjectActions} />}

        {!customerView&&projectTab==="projlogs"&&<div style={{ flex:1, overflow:"auto", padding:"20px 24px" }}>
          <SharedLogPage logs={state.logs.filter(l=>l.project===project.name)} projects={state.projects} />
        </div>}
      </div>}

      {/* PROJECTS LIST */}
      {view==="projects"&&!selProject&&<div className="project-workspace project-section theme-work-page projects-theme-page">
        <div className="project-filter-shell unified-page-header projects-page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:18, flexWrap:"wrap", padding:"15px 16px" }}>
          <div className="unified-title-row">
            <div><h2 style={{ margin:0, fontSize:22, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="projects" size={20}/>Projeler</h2><p style={{ margin:"3px 0 0", color:"var(--muted)", fontSize:13 }}>{listedProjects.length} proje</p></div>
            {isAdmin&&<Btn className="icon-only-action" title="Yeni proje" aria-label="Yeni proje" onClick={()=>setModal({type:"addProject"})}>+</Btn>}
          </div>
          <div className="unified-filter-row projects-filter-row" style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <input value={projectSearch} onChange={event=>setProjectSearch(event.target.value)} placeholder="Projelerde ara..." style={{...iStyle,width:220,maxWidth:"100%"}}/>
            <Btn className="compact-tool-button" variant="secondary" title="XLSX indir" onClick={exportListedProjects}>XLSX</Btn>
            <div className="segmented-control">
              {isAdmin&&<button onClick={()=>setProjectScope("all")} className={projectScope==="all"?"is-active":""}>Tüm Projeler</button>}
              <button onClick={()=>setProjectScope("mine")} className={projectScope==="mine"||!isAdmin?"is-active":""}>Projelerim</button>
            </div>
            <div className="segmented-control">
              {[["all","Tüm"],["connected","Connected Supplier"],["uat","UAT Alınanlar"],["standard","Standart"]].map(([id,label])=><button key={id} onClick={()=>setProjectSegment(id)} className={projectSegment===id?"is-active":""}>{label}</button>)}
            </div>
            <div className="segmented-control">
              {[["cards","Kart"],["list","Liste"]].map(([id,label])=><button key={id} onClick={()=>setProjectViewMode(id)} className={projectViewMode===id?"is-active":""}>{label}</button>)}
            </div>
          </div>
        </div>
        {listedProjects.length===0&&<div className="liquid-card" style={{ textAlign:"center", padding:"50px", borderRadius:16, borderStyle:"dashed" }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Proje yok</div>
          {isAdmin&&<Btn onClick={()=>setModal({type:"addProject"})}>+ Proje Oluştur</Btn>}
        </div>}
        {projectViewMode==="list"&&<div className="liquid-card" style={{overflowX:"auto",borderRadius:15,marginBottom:14}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1040}}><thead><tr>{["Proje","Müşteri","Sorumluluk","Sorumlu","Durum","İlerleme","Görev","Gecikme","Ticket","Makine"].map(label=><th key={label} style={{padding:"11px 10px",fontSize:10,color:"var(--muted)",background:"rgb(255 255 255 / 46%)",textAlign:"left"}}>{label}</th>)}</tr></thead><tbody>{listedProjects.map(project=>{const tasks=project.milestones.flatMap(milestone=>milestone.tasks||[]);const done=tasks.filter(task=>task.status==="Tamamlandı").length;const progress=tasks.length?Math.round(done/tasks.length*100):0;const delayed=tasks.filter(task=>delayLvl(task.dueDate,task.status)).length;const machines=project.commissioningTracking?commissioningMachines(project.commissioningTree||[]):project.machines||[];const responsibles=projectResponsibleIds(project).map(id=>state.people.find(person=>person.id===id)?.name).filter(Boolean).join(", ");return <tr key={project.id} onClick={()=>setExpandedProjectRows(current=>({...current,[project.id]:!current[project.id]}))} style={{borderTop:"1px solid var(--glass-border)",cursor:"pointer"}}><td style={{padding:10,fontSize:12,fontWeight:850,color:"var(--text)"}}>{project.name}</td><td style={{padding:10,fontSize:11,color:"var(--muted)"}}>{project.customerProfile?.name||project.customerName||"-"}</td><td style={{padding:10,fontSize:11,fontWeight:850,color:project.uatAccepted?"var(--accent)":"var(--muted)"}}>{project.uatAccepted?"Customer Success":"PM"}</td><td style={{padding:10,fontSize:11,color:"var(--muted)"}}>{responsibles||"-"}</td><td style={{padding:10}}><Badge label={project.status}/></td><td style={{padding:10,fontSize:11,fontWeight:850,color:"var(--accent)"}}>%{progress}</td><td style={{padding:10,fontSize:11}}>{done}/{tasks.length}</td><td style={{padding:10,fontSize:11,color:delayed?"var(--danger)":"var(--muted)",fontWeight:delayed?850:600}}>{delayed}</td><td style={{padding:10,fontSize:11}}>{((state.projectTickets||{})[project.id]||[]).length}</td><td style={{padding:10,fontSize:11}}>{machines.filter(machine=>machine.commissioned).length}/{machines.length}</td></tr>;})}</tbody></table></div>}
        {projectViewMode==="list"&&listedProjects.filter(project=>expandedProjectRows[project.id]).map(project=><div key={`ms-${project.id}`} className="liquid-card" style={{borderRadius:14,padding:12,margin:"-4px 0 14px"}}><div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:8}}><b style={{fontSize:12}}>{project.name} · Milestonelar</b><Btn small onClick={()=>openProject(project.id,"setup")}>Projeyi Aç</Btn></div><div style={{display:"grid",gap:7}}>{project.milestones.map(milestone=>{const tasks=milestone.tasks||[];const done=tasks.filter(task=>task.status==="Tamamlandı").length;return <div key={milestone.id} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto auto",gap:8,alignItems:"center",background:"rgb(255 255 255 / 70%)",border:"1px solid var(--border)",borderRadius:10,padding:"9px 10px"}}><span style={{minWidth:0,fontSize:11,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{milestone.name}</span><span style={{fontSize:10,color:"var(--muted)"}}>{done}/{tasks.length}</span><Badge label={milestone.status}/></div>;})}</div></div>)}
        <div style={{ display:projectViewMode==="cards"?"grid":"none", gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))", gap:13 }}>
          {listedProjects.map(p=><SharedProjectListCard key={p.id} project={p} people={state.people} isAdmin={isAdmin} onOpen={()=>openProject(p.id,"setup")} onEdit={()=>setModal({type:"editProject",data:p})} onReport={()=>generateHTMLReport(p,state.people,state.logs)} onDelete={()=>confirm("Projeyi sil?")&&deleteProject(p.id)} formatDate={fmt} readinessScoreForProject={readinessScore}/>)}
          {false&&listedProjects.map(p=>{
            const total=p.milestones.reduce((a,m)=>a+m.tasks.length,0);
            const done=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>t.status==="Tamamland\u0131").length,0);
            const prog=total?Math.round((done/total)*100):0;
            const overdue=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)).length,0);
            const crit=p.milestones.reduce((a,m)=>a+m.tasks.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length,0);
            const pms=projectPmIds(p).map(id=>state.people.find(pe=>pe.id===id)).filter(Boolean);
            const stakeholders=projectStakeholders(p).map(item=>({...item,person:state.people.find(pe=>pe.id===item.userId)})).filter(item=>item.person);
            const aMs=p.milestones.find(m=>m.status!=="Tamamland\u0131");
            return <div key={p.id} onClick={()=>openProject(p.id,"setup")}
              style={{ background:"#fff", borderRadius:13, padding:"17px", border:"1.5px solid var(--border)", cursor:"pointer", boxShadow:"0 2px 6px rgba(0,0,0,0.04)", borderTop:`4px solid ${p.color}` }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 16px rgba(0,0,0,0.1)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none";}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:800, lineHeight:1.35, wordBreak:"break-word", overflowWrap:"anywhere" }}>{p.name}</h3><Badge label={p.status} />
              </div>
              {p.description&&<p style={{ margin:"0 0 7px", fontSize:12, color:"var(--muted)", lineHeight:1.45, wordBreak:"break-word", overflowWrap:"anywhere" }}>{p.description}</p>}
              {pms.length>0&&<div style={{ fontSize:11, color:"var(--muted)", marginBottom:3 }}>PM: <b>{pms.map(pm=>pm.name).join(", ")}</b></div>}
              {stakeholders.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>{stakeholders.slice(0,3).map(item=><span key={item.id} style={{fontSize:9,background:"var(--surface-soft)",color:"var(--muted)",borderRadius:6,padding:"2px 6px"}}>{item.role}: {item.person.name}</span>)}</div>}
              {aMs&&<div style={{ fontSize:11, color:"var(--accent)", marginBottom:5, fontWeight:600 }}>Aktif: {aMs.name} — {fmt(aMs.dueDate)}</div>}
              <div style={{ display:"flex", gap:6, marginBottom:7, flexWrap:"wrap" }}>
                {overdue>0&&<span style={{ background:"color-mix(in srgb, var(--warning) 10%, white 90%)", color:"var(--warning)", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>Gecikmiş: {overdue}</span>}
                {crit>0&&<span style={{ background:"color-mix(in srgb, var(--danger) 9%, white 91%)", color:"var(--danger)", borderRadius:10, padding:"2px 7px", fontSize:10, fontWeight:700 }}>Kritik: {crit}</span>}
              </div>
              <div style={{ height:4, background:"var(--accent-ink)", borderRadius:10 }}><div style={{ width:`${prog}%`, height:"100%", background:p.color, borderRadius:10 }} /></div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:7}}>
                <div style={{ fontSize:11, color:"var(--muted)" }}>{done}/{total} görev · {prog}%</div>
                {isAdmin&&<div style={{display:"flex",gap:4}}>
                  {[["edit","var(--accent-ink)","var(--accent)",()=>setModal({type:"editProject",data:p}),"Düzenle"],["download","color-mix(in srgb, var(--success) 10%, white 90%)","var(--success)",()=>generateHTMLReport(p,state.people,state.logs),"HTML rapor"],["trash","color-mix(in srgb, var(--danger) 9%, white 91%)","var(--danger)",()=>confirm("Projeyi sil?")&&deleteProject(p.id),"Sil"]].map(([icon,bg,color,action,title])=><button key={icon} title={title} aria-label={title} onClick={e=>{e.stopPropagation();action();}} style={{width:28,height:28,border:0,borderRadius:7,background:bg,color,display:"grid",placeItems:"center",cursor:"pointer"}}><Icon name={icon} size={13}/></button>)}
                </div>}
              </div>
            </div>;
          })}
        </div>
      </div>}

      {view==="mytasks"&&<SharedMyTasksPage currentUser={currentUser} state={state} setState={setState} addLog={addLog} isAdmin={isAdmin} initialTaskId={taskToOpen} onTaskOpened={()=>setTaskToOpen("")}/>}
      {view==="fieldops"&&<SharedFieldOperationsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} section={fieldSection} onSectionChange={setFieldSection} scope={fieldScope} onScopeChange={setFieldScope} projectFilter={fieldProject} onProjectFilterChange={setFieldProject} personFilter={fieldPerson} onPersonFilterChange={setFieldPerson} typeFilter={fieldType} onTypeFilterChange={setFieldType} weekOffset={fieldWeek} onWeekOffsetChange={setFieldWeek} onOpenProject={id=>openProject(id,"actions")}/>}
      {view==="fieldplan"&&<SharedFieldOperationsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} section="plan" onSectionChange={setFieldSection} scope={fieldScope} onScopeChange={setFieldScope} projectFilter={fieldProject} onProjectFilterChange={setFieldProject} personFilter={fieldPerson} onPersonFilterChange={setFieldPerson} typeFilter={fieldType} onTypeFilterChange={setFieldType} weekOffset={fieldWeek} onWeekOffsetChange={setFieldWeek} onOpenProject={id=>openProject(id,"actions")}/>}
      {view==="fieldvisits"&&<SharedFieldOperationsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin} section="visits" onSectionChange={setFieldSection} scope={fieldScope} onScopeChange={setFieldScope} projectFilter={fieldProject} onProjectFilterChange={setFieldProject} personFilter={fieldPerson} onPersonFilterChange={setFieldPerson} typeFilter={fieldType} onTypeFilterChange={setFieldType} weekOffset={fieldWeek} onWeekOffsetChange={setFieldWeek} onOpenProject={id=>openProject(id,"actions")}/>}
      {view==="deadlines"&&<SharedDeadlinePage warnings={deadlineWarnings} people={state.people} onOpenTask={id=>navigateTo("mytasks",{taskId:id})} onOpenTodos={()=>navigateTo("todos")}/>}
      {view==="reminders"&&!customerView&&<SharedRemindersPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin}/>}
      {view==="tickets"&&<SharedTicketsPage state={state} setState={setState} currentUser={currentUser} isAdmin={isAdmin&&!customerView} customerMode={customerView} customerProjects={customerView?visibleProjects:undefined} initialMine={ticketMineOnly} initialProjectId={ticketToOpen.projectId} initialTicketId={ticketToOpen.ticketId} activeTab={ticketTab} onActiveTabChange={setTicketTab} projectFilters={ticketProjectFilters} onProjectFiltersChange={setTicketProjectFilters} statusFilters={ticketStatusFilters} onStatusFiltersChange={setTicketStatusFilters} search={ticketSearch} onSearchChange={setTicketSearch} mineOnly={ticketMineOnly} onMineOnlyChange={setTicketMineOnly} onTicketOpened={()=>setTicketToOpen({projectId:"",ticketId:""})} generateTicketStatusReport={generateTicketStatusReport}/>}
      {view==="reports"&&<SharedReportsPage state={state} people={state.people} isAdmin={isAdmin} projectId={reportProject} onProjectIdChange={setReportProject} group={reportGroup} onGroupChange={setReportGroup} />}
      {view==="customers"&&isAdmin&&!selProject&&<SharedCustomersPage state={state} setState={setState} onInviteUser={addPerson} onPreviewCustomer={projectId=>{setPreviewCustomerProjectId(projectId);navigateTo("dashboard");}}/>}

      {view==="people"&&<div style={{ padding:"22px 26px", flex:1, overflow:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div><h2 style={{ margin:0, fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><Icon name="people" size={20}/>Ekip</h2></div>
          {isAdmin&&<Btn className="icon-only-action" title="Kişi ekle" aria-label="Kişi ekle" onClick={()=>setModal({type:"addPerson"})}>+</Btn>}
        </div>
        <div style={{background:"#fff",border:"1px solid var(--border)",borderRadius:15,padding:14,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:850,marginBottom:10}}>Organizasyonel Yapı</div>
          <SharedOrganizationPanel people={internalPeople} roles={organizationRoles(state)} onEdit={isAdmin?person=>setModal({type:"editPerson",data:person}):null}/>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {internalPeople.map(p=>{
            const allT=[...state.projects.flatMap(proj=>proj.milestones.flatMap(ms=>ms.tasks.filter(t=>t.assignee===p.id))),...(state.personalTasks||[]).filter(t=>t.assignee===p.id)];
            const active=allT.filter(t=>t.status==="Devam Ediyor").length;
            const waiting=allT.filter(t=>t.status==="Bekliyor").length;
            const delayed=allT.filter(t=>delayLvl(t.dueDate,t.status)==="normal").length;
            const crit=allT.filter(t=>delayLvl(t.dueDate,t.status)==="critical").length;
            const comp=allT.filter(t=>t.status==="Tamamlandı").length;
            const projC=[...new Set(state.projects.filter(proj=>proj.milestones.some(ms=>ms.tasks.some(t=>t.assignee===p.id))).map(pr=>pr.id))].length;
            const stats=[["Aktif",active,"var(--accent)"],["Bekl.",waiting,"var(--muted)"],["Gec.",delayed,"var(--warning)"],["Krit.",crit,"var(--danger)"],["Bitti",comp,"var(--success)"]].filter(([,c])=>c>0);
            return (
              <div key={p.id} style={{ background:"#fff", borderRadius:12, padding:"11px 14px", border:"1.5px solid var(--border)", display:"flex", alignItems:"center", gap:12 }}>
                <Avatar initials={p.avatar} imageUrl={p.avatarUrl} size={36} color={p.isAdmin?"var(--danger)":"var(--accent)"} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:13 }}>{p.name}</span>
                    {p.isAdmin&&<span style={{ background:"color-mix(in srgb, var(--danger) 9%, white 91%)", color:"var(--danger)", borderRadius:6, padding:"1px 6px", fontSize:9, fontWeight:700 }}>YÖN</span>}
                  </div>
                  <div style={{ color:"var(--muted)", fontSize:11, marginTop:1 }}>{orgLevelLabel(p.orgLevel)}{p.email?` · ${p.email}`:""}{projC>0?` · ${projC} proje`:""}</div>
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

      {view==="logs"&&<SharedLogPage logs={state.logs} projects={state.projects} />}
      {view==="notifications"&&<SharedNotificationsPage notifications={state.notifications||[]} currentUser={currentUser} setState={setState} dateChangeRequests={state.dateChangeRequests||[]} onResolveDateChange={resolveDateChangeRequest} onOpenTask={id=>navigateTo("mytasks",{taskId:id})} />}
    </div>

    {isMobile&&<MobileBottomNav view={view} isAdminMode={useAdminHome} taskCount={useAdminHome?managerAssignedOpenCount:myOpenTaskCount} deadlineCount={deadlineWarnings.length} onQuick={()=>setMobileQuickSheet(true)} onProfile={()=>setModal({type:"editProfile"})} onNavigate={target=>{if(target==="mytasks"&&useAdminHome){navigateTo("admin",{adminSection:"assigned"});return;}navigateTo(target,{projectScope:target==="projects"?"all":undefined,ticketMineOnly:target==="tickets"});}}/>}

    {/* MODALS */}
    {modal?.type==="addProject"&&<SharedAddProjectModal onClose={()=>setModal(null)} onSave={addProject} people={state.people} roles={organizationRoles(state)} templates={MES_TEMPLATES} buildFromTemplate={buildFromTemplate} colors={COLORS} createId={uid} todayString={todayStr} />}
    {modal?.type==="editProject"&&<SharedProjectModal title="Projeyi Düzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(data)=>updateProjectById(modal.data.id,data)} people={state.people} roles={organizationRoles(state)} colors={COLORS} createId={uid} />}
    {modal?.type==="addMilestone"&&<SharedMilestoneModal title="Yeni Milestone" onClose={()=>setModal(null)} onSave={addMilestone} waitOptions={WAIT} />}
    {modal?.type==="editMilestone"&&<SharedMilestoneModal title="Milestone Duzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(d)=>updateMilestone(modal.data.id,d)} waitOptions={WAIT} />}
    {modal?.type==="addTask"&&<SharedTaskModal title="Yeni Görev" onClose={()=>setModal(null)} onSave={(d)=>addTask(modal.msId,d)} people={state.people} waitOptions={WAIT} responsibilityGroups={RESPONSIBILITY_GROUPS} milestone={project?.milestones.find(item=>item.id===modal.msId)} />}
    {modal?.type==="editTask"&&<SharedTaskModal title="Görevi Düzenle" initial={modal.data} onClose={()=>setModal(null)} onSave={(d)=>updateTask(modal.msId,modal.data.id,d)} people={state.people} waitOptions={WAIT} responsibilityGroups={RESPONSIBILITY_GROUPS} milestone={project?.milestones.find(item=>item.id===modal.msId)} />}
    {modal?.type==="addPerson"&&<SharedPersonModal people={state.people} roles={organizationRoles(state)} onClose={()=>setModal(null)} onSave={addPerson} />}
    {modal?.type==="editPerson"&&<SharedUserEditModal title="Kullanıcıyı Düzenle" person={modal.data} people={state.people} roles={organizationRoles(state)} allowAdmin onClose={()=>setModal(null)} onSave={(d)=>updatePerson(modal.data.id,d)} />}
    {modal?.type==="personDetail"&&<SharedPersonDetailModal person={modal.data} projects={state.projects} personalTasks={state.personalTasks} onClose={()=>setModal(null)} />}
    {modal?.type==="addRisk"&&<SharedRiskModal onClose={()=>setModal(null)} onSave={addRisk} milestones={project?.milestones||[]} />}
    {modal?.type==="editProfile"&&<SharedUserEditModal title="Profilimi Düzenle" person={currentUser} onClose={()=>setModal(null)} onSave={(d)=>updatePerson(currentUser.id,d)} />}
    {modal?.type==="timeLog"&&<SharedTimeLogModal task={(project?.milestones.find(m=>m.id===modal.msId)?.tasks.find(t=>t.id===modal.data.id))||modal.data} currentUser={currentUser} createId={uid} getTimestamp={now} formatDate={fmt} onClose={()=>setModal(null)} onSave={(entries)=>updateTask(modal.msId,modal.data.id,{timeEntries:entries})} />}
    {modal?.type==="addPersonal"&&<SharedPersonalTaskModal title="Görev Ata" people={state.people} projects={state.projects} isAdmin currentUser={currentUser} waitOptions={WAIT} todayString={todayStr} currentTimeString={currentTimeStr} lockStartAt onClose={()=>setModal(null)} onSave={saveAdminAssignedTask} />}
    {mobileQuickSheet&&<MobileQuickSheet isAdminMode={useAdminHome} onClose={()=>setMobileQuickSheet(false)} onSelect={target=>{setMobileQuickSheet(false);if(target==="assign"){setModal({type:"addPersonal"});return;}if(target==="todo"||target==="action")setMobileQuick(target);else navigateTo(target==="ticket"?"tickets":target,{ticketMineOnly:target==="ticket"});}}/>}
    {mobileQuick==="todo"&&<QuickTodoModal projects={state.projects} onClose={()=>setMobileQuick(null)} onSave={saveMobileQuickTodo}/>}
    {mobileQuick==="action"&&<QuickActionModal projects={state.projects} actionTags={DEFAULT_ACTION_TAGS} onClose={()=>setMobileQuick(null)} onSave={saveMobileQuickAction}/>}
  </div></>;
}



// ─── Plan List Table ─────────────────────────────────────────────────────────
