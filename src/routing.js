const VIEW_TO_PATH = {
  dashboard: "/",
  admin: "/admin",
  todos: "/todos",
  projects: "/projects",
  mytasks: "/my-tasks",
  fieldops: "/field-operations",
  fieldplan: "/field-operations",
  fieldvisits: "/field-operations",
  deadlines: "/deadlines",
  reminders: "/reminders",
  tickets: "/ticketlar",
  ai: "/ai",
  import: "/import",
  mailcenter: "/mail-center",
  reports: "/reports",
  people: "/people",
  logs: "/activity",
  notifications: "/notifications",
  customers: "/customers",
  mobilemenu: "/menu",
};

const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([view, path]) => [path, view]),
);
PATH_TO_VIEW["/field-operations"] = "fieldops";

const splitListParam = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const setListParam = (search, key, values) => {
  const list = Array.isArray(values) ? values.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (list.length) search.set(key, list.join(","));
};

export const DEFAULT_PROJECT_TAB = "setup";
export const PROJECT_ROUTE_TABS = new Set([
  "setup",
  "gantt",
  "tasks",
  "tickets",
  "actions",
  "risks",
  "notlar",
  "projlogs",
]);

export const routeFromLocation = (locationLike) => {
  const pathname = locationLike?.pathname || "/";
  const search = new URLSearchParams(locationLike?.search || "");
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const legacyView = search.get("view");

  if (parts[0] === "projects" && parts[1]) {
    const tab = PROJECT_ROUTE_TABS.has(parts[2]) ? parts[2] : DEFAULT_PROJECT_TAB;
    return {
      view: "projects",
      selProject: parts[1],
      projectTab: tab,
      ticketMineOnly: false,
      taskId: "",
      ticketProjectId: "",
      ticketId: "",
    };
  }

  if (parts[0] === "admin") {
    return {
      view: "admin",
      selProject: null,
      projectTab: DEFAULT_PROJECT_TAB,
      adminSection: parts[1] || "overview",
      ticketMineOnly: false,
      taskId: "",
      ticketProjectId: "",
      ticketId: "",
    };
  }

  const path = pathname.replace(/\/+$/, "") || "/";
  const view = (path === "/" && legacyView) || PATH_TO_VIEW[path] || legacyView || "dashboard";
  return {
    view,
    selProject: null,
    projectTab: DEFAULT_PROJECT_TAB,
    adminSection: "overview",
    ticketMineOnly: view === "tickets" && search.get("mine") === "1",
    taskId: view === "mytasks" ? search.get("task") || "" : "",
    ticketProjectId: view === "tickets" ? search.get("project") || "" : "",
    ticketId: view === "tickets" ? search.get("ticket") || "" : "",
    ticketTab: view === "tickets" ? search.get("tab") || "tickets" : "tickets",
    ticketSearch: view === "tickets" ? search.get("q") || "" : "",
    ticketProjectFilters: view === "tickets" ? splitListParam(search.get("projects")) : [],
    ticketStatusFilters: view === "tickets" ? splitListParam(search.get("statuses")) : [],
    fieldSection: view === "fieldops" ? search.get("section") || "plan" : "plan",
    fieldScope: view === "fieldops" ? search.get("scope") || "" : "",
    fieldProject: view === "fieldops" ? search.get("project") || "all" : "all",
    fieldPerson: view === "fieldops" ? search.get("person") || "" : "",
    fieldType: view === "fieldops" ? search.get("type") || "all" : "all",
    fieldWeek: view === "fieldops" ? Number(search.get("week") || 0) || 0 : 0,
    importType: view === "import" ? search.get("type") || "all" : "all",
    reportProject: view === "reports" ? search.get("project") || "" : "",
    reportGroup: view === "reports" ? search.get("group") || "operations" : "operations",
    projectScope: view === "projects" ? search.get("scope") || "all" : "all",
    projectSegment: view === "projects" ? search.get("segment") || "all" : "all",
    projectSearch: view === "projects" ? search.get("q") || "" : "",
    projectViewMode: view === "projects" ? search.get("mode") || "cards" : "cards",
  };
};

export const pathForRouteState = ({
  view = "dashboard",
  selProject,
  projectTab = DEFAULT_PROJECT_TAB,
  adminSection = "overview",
  ticketMineOnly = false,
  taskId = "",
  ticketProjectId = "",
  ticketId = "",
  ticketTab = "tickets",
  ticketSearch = "",
  ticketProjectFilters = [],
  ticketStatusFilters = [],
  fieldSection = "plan",
  fieldScope = "",
  fieldProject = "all",
  fieldPerson = "",
  fieldType = "all",
  fieldWeek = 0,
  importType = "all",
  reportProject = "",
  reportGroup = "operations",
  projectScope = "all",
  projectSegment = "all",
  projectSearch = "",
  projectViewMode = "cards",
}) => {
  if (selProject) {
    const tab = PROJECT_ROUTE_TABS.has(projectTab) ? projectTab : DEFAULT_PROJECT_TAB;
    return `/projects/${encodeURIComponent(selProject)}/${encodeURIComponent(tab)}`;
  }
  if (view === "admin") {
    return adminSection && adminSection !== "overview"
      ? `/admin/${encodeURIComponent(adminSection)}`
      : "/admin";
  }
  const base = VIEW_TO_PATH[view] || "/";
  const search = new URLSearchParams();
  if (view === "tickets" && ticketMineOnly) search.set("mine", "1");
  if (view === "tickets" && ticketProjectId) search.set("project", ticketProjectId);
  if (view === "tickets" && ticketId) search.set("ticket", ticketId);
  if (view === "tickets" && ticketTab && ticketTab !== "tickets") search.set("tab", ticketTab);
  if (view === "tickets" && ticketSearch.trim()) search.set("q", ticketSearch.trim());
  if (view === "tickets") setListParam(search, "projects", ticketProjectFilters);
  if (view === "tickets") setListParam(search, "statuses", ticketStatusFilters);
  if (view === "fieldops" && fieldSection && fieldSection !== "plan") search.set("section", fieldSection);
  if (view === "fieldops" && fieldScope) search.set("scope", fieldScope);
  if (view === "fieldops" && fieldProject && fieldProject !== "all") search.set("project", fieldProject);
  if (view === "fieldops" && fieldPerson) search.set("person", fieldPerson);
  if (view === "fieldops" && fieldType && fieldType !== "all") search.set("type", fieldType);
  if (view === "fieldops" && Number(fieldWeek)) search.set("week", String(Number(fieldWeek)));
  if (view === "import" && importType && importType !== "all") search.set("type", importType);
  if (view === "reports" && reportProject) search.set("project", reportProject);
  if (view === "reports" && reportGroup && reportGroup !== "operations") search.set("group", reportGroup);
  if (view === "mytasks" && taskId) search.set("task", taskId);
  if (view === "projects" && projectScope && projectScope !== "all") search.set("scope", projectScope);
  if (view === "projects" && projectSegment && projectSegment !== "all") search.set("segment", projectSegment);
  if (view === "projects" && projectSearch.trim()) search.set("q", projectSearch.trim());
  if (view === "projects" && projectViewMode && projectViewMode !== "cards") search.set("mode", projectViewMode);
  const query = search.toString();
  if (query) return `${base}?${query}`;
  return base;
};
