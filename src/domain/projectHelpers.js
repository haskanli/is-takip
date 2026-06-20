export const projectPmIds = (project) => [
  ...new Set([...(project?.pmIds || []), project?.pm].filter(Boolean)),
];

export const projectCustomerSuccessIds = (project) => [
  ...new Set([...(project?.customerSuccessIds || []), project?.customerSuccessId].filter(Boolean)),
];

export const projectResponsibleIds = (project) =>
  project?.uatAccepted ? projectCustomerSuccessIds(project) : projectPmIds(project);

export const projectStakeholders = (project) => project?.stakeholders || [];

export const fieldPlanHours = (plan) => {
  const explicit = parseFloat(plan?.effortHours);
  if (explicit > 0) return explicit;

  const start = plan?.actualStartTime || plan?.startTime;
  const end = plan?.actualEndTime || plan?.endTime;
  if (!start || !end) return 0;

  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return minutes > 0 ? Math.round(minutes / 6) / 10 : 0;
};

export const nextTicketNumber = (state) => {
  const tickets = Object.values(state?.projectTickets || {}).flat();
  const max = tickets
    .map((ticket) =>
      /^CJT-\d+$/.test(String(ticket.ticketNo || ""))
        ? parseInt(String(ticket.ticketNo).slice(4), 10)
        : 0,
    )
    .reduce((highest, value) => Math.max(highest, Number.isFinite(value) ? value : 0), tickets.length);
  return `CJT-${max + 1}`;
};

export const ticketNumber = (ticket) => {
  const raw = String(ticket?.ticketNo || "");
  const match = raw.match(/(\d+)$/);
  return match ? match[1].padStart(4, "0") : "0000";
};

export const commissioningMachines = (sectors = []) =>
  sectors.flatMap((sector) =>
    (sector.productionCenters || []).flatMap((center) =>
      (center.workplaces || []).flatMap((workplace) =>
        (workplace.lines || []).flatMap((line) => line.machines || []),
      ),
    ),
  );
