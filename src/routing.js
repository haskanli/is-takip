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
    };
  }

  if (parts[0] === "admin") {
    return {
      view: "admin",
      selProject: null,
      projectTab: DEFAULT_PROJECT_TAB,
      adminSection: parts[1] || "overview",
      ticketMineOnly: false,
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
  };
};

export const pathForRouteState = ({
  view = "dashboard",
  selProject,
  projectTab = DEFAULT_PROJECT_TAB,
  adminSection = "overview",
  ticketMineOnly = false,
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
  if (view === "tickets" && ticketMineOnly) return `${base}?mine=1`;
  return base;
};
