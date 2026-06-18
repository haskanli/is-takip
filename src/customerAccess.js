export const CUSTOMER_VISIBLE_PROJECT_TABS = new Set(["setup", "gantt", "tasks", "tickets"]);
export const CUSTOMER_VISIBLE_SETUP_SECTIONS = new Set([
  "overview",
  "readiness",
  "training",
  "raci",
  "machines",
  "commissioning",
]);

export const isCustomerUser = (user = {}) =>
  user.userType === "customer" || user.roleKey === "customer_viewer";

export const customerNameForProject = (project = {}, customers = []) => {
  const linked = customers.find((customer) => customer.id === project.customerId);
  return linked?.name || project.customerProfile?.name || project.customerName || project.name;
};

export const customerProfileForProject = (project = {}, customers = []) => {
  const linked = customers.find((customer) => customer.id === project.customerId);
  if (!linked) return project.customerProfile || {};
  return {
    ...(project.customerProfile || {}),
    name: linked.name,
    logoUrl: linked.logoUrl || project.customerProfile?.logoUrl || "",
    website: linked.website || project.customerProfile?.website || "",
    accentColor: linked.accentColor || project.customerProfile?.accentColor || project.color,
  };
};

export const canCustomerAccessProject = (user = {}, project = {}) =>
  isCustomerUser(user) && user.customerId && project.customerId === user.customerId;

export const visibleTicketsForUser = (tickets = [], user = {}) => {
  if (!isCustomerUser(user)) return tickets;
  return tickets.filter(
    (ticket) =>
      ticket.source === "customer" ||
      ticket.customerVisible === true ||
      (user.customerId && ticket.customerId === user.customerId),
  );
};
