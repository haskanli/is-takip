export const PERMISSION_DEFINITIONS = [
  { key: "dashboard.view", label: "Dashboard" },
  { key: "projects.view", label: "Projeler" },
  { key: "project.overview.view", label: "Proje Özeti" },
  { key: "project.readiness.view", label: "Proje Sağlığı" },
  { key: "project.training.view", label: "Eğitimler" },
  { key: "project.raci.view", label: "RACI ve Kontaklar" },
  { key: "project.gantt.view", label: "Proje Planı / Gantt" },
  { key: "project.tasks.view", label: "Görevler" },
  { key: "project.machines.view", label: "Makineler" },
  { key: "project.tickets.view", label: "Ticketlar" },
  { key: "project.tickets.create", label: "Ticket Açma" },
  { key: "project.tickets.comment", label: "Ticket Yorumu" },
  { key: "project.actions.view", label: "Aksiyonlar" },
  { key: "project.risks.view", label: "Riskler" },
  { key: "project.notes.view", label: "Notlar" },
  { key: "project.remoteAccess.view", label: "Uzaktan Erişim" },
  { key: "project.cost.view", label: "Proje Maliyeti" },
  { key: "project.effort.view", label: "Efor" },
  { key: "project.logs.view", label: "Proje Logları" },
  { key: "reports.view", label: "Raporlar" },
  { key: "ai.view", label: "AI" },
  { key: "admin.view", label: "Yönetim" },
  { key: "customers.manage", label: "Müşteriler" },
  { key: "settings.permissions.manage", label: "Yetkiler" },
];

export const DEFAULT_PERMISSION_ROLES = {
  admin: {
    key: "admin",
    label: "Yönetici",
    permissions: PERMISSION_DEFINITIONS.map((item) => item.key),
  },
  team: {
    key: "team",
    label: "Ekip",
    permissions: [
      "dashboard.view",
      "projects.view",
      "project.overview.view",
      "project.readiness.view",
      "project.training.view",
      "project.raci.view",
      "project.gantt.view",
      "project.tasks.view",
      "project.machines.view",
      "project.tickets.view",
      "project.tickets.create",
      "project.tickets.comment",
      "project.actions.view",
      "project.risks.view",
      "project.notes.view",
      "project.remoteAccess.view",
      "project.effort.view",
      "reports.view",
      "ai.view",
    ],
  },
  customer_viewer: {
    key: "customer_viewer",
    label: "Müşteri Görüntüleyici",
    permissions: [
      "dashboard.view",
      "projects.view",
      "project.overview.view",
      "project.readiness.view",
      "project.training.view",
      "project.raci.view",
      "project.gantt.view",
      "project.machines.view",
      "project.tickets.view",
      "project.tickets.create",
    ],
  },
};

export const resolvePermissionRoles = (roles = {}) => ({
  ...DEFAULT_PERMISSION_ROLES,
  ...Object.fromEntries(
    Object.entries(roles || {}).map(([key, role]) => [
      key,
      {
        ...DEFAULT_PERMISSION_ROLES[key],
        ...role,
        key: role.key || key,
        permissions: [...new Set(role.permissions || DEFAULT_PERMISSION_ROLES[key]?.permissions || [])],
      },
    ]),
  ),
});

export const roleKeyForUser = (user = {}) => {
  if (user.isAdmin) return "admin";
  if (user.roleKey) return user.roleKey;
  if (user.userType === "customer") return "customer_viewer";
  return "team";
};

const list = (value) => (Array.isArray(value) ? value : []);

export const hasPermission = (user, permissionKey, context = {}) => {
  if (!user || user.active === false) return false;
  if (user.isAdmin) return true;
  const roleKey = roleKeyForUser(user);
  const roles = resolvePermissionRoles(context.state?.permissionRoles);
  const role = roles[roleKey] || roles.team;
  let allowed = new Set(role.permissions || []);
  const overrides = context.state?.permissionOverrides || {};
  const applyOverride = (override) => {
    list(override?.allow).forEach((key) => allowed.add(key));
    list(override?.deny).forEach((key) => allowed.delete(key));
  };
  applyOverride(overrides.roles?.[roleKey]);
  if (context.project?.id) {
    applyOverride(overrides.projects?.[context.project.id]?.roles?.[roleKey]);
    applyOverride(overrides.projects?.[context.project.id]?.users?.[user.id]);
  }
  applyOverride(overrides.users?.[user.id]);
  return allowed.has(permissionKey);
};

