export const isCustomerUser = (user = {}) =>
  user.userType === "customer" || user.roleKey === "customer_viewer";

export const projectBelongsToCustomer = (project = {}, userOrCustomerId = {}) => {
  const customerId =
    typeof userOrCustomerId === "string" ? userOrCustomerId : userOrCustomerId?.customerId;
  if (!customerId) return false;
  return (
    project.customerId === customerId ||
    project.customerProfile?.customerId === customerId ||
    project.customerProfile?.id === customerId
  );
};

export const isCustomerVisibleTicket = (ticket = {}, customerId = "") => {
  if (!customerId) return false;
  return (
    ticket.customerVisible === true ||
    ticket.source === "customer" ||
    ticket.customerId === customerId
  );
};

export const filterCustomerTickets = (tickets = [], customerId = "") =>
  (tickets || []).filter((ticket) => isCustomerVisibleTicket(ticket, customerId));

export const sanitizeProjectForCustomer = (project = {}) => {
  const safe = structuredClone(project);
  safe.milestones = (safe.milestones || []).map((milestone) => ({
    ...milestone,
    tasks: (milestone.tasks || []).map((task) => {
      const item = { ...task };
      delete item.timeEntries;
      delete item.estimatedHours;
      delete item.waitingHistory;
      delete item.waitReason;
      delete item.notes;
      return item;
    }),
  }));
  delete safe.remoteAccess;
  delete safe.reportSchedules;
  delete safe.costItems;
  delete safe.costSettings;
  delete safe.billingMilestones;
  delete safe.invoiceMilestones;
  delete safe.documents;
  delete safe.risks;
  delete safe.lessonsLearned;
  delete safe.internalNotes;
  return safe;
};
