const readError = async (response) => {
  try {
    const body = await response.json();
    return body.error || `Mail isteği başarısız (${response.status})`;
  } catch {
    return `Mail isteği başarısız (${response.status})`;
  }
};

export const notifyTicketAssignment = async (projectId, ticket) => {
  const response = await fetch("/email/ticket-assigned", {
    method: "POST",
    keepalive: true,
    headers: await apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ projectId, ticket }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json();
  if (!result.sent) throw new Error(result.reason || "Atama e-postası gönderilemedi.");
  return result;
};

export const createTicketWithNotification = async (projectId, ticket) => {
  const response = await fetch("/tickets", {
    method: "POST",
    headers: await apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ projectId, ticket }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
};

export const assignTasksWithNotification = async (payload) => {
  const response = await fetch("/tasks/assign", {
    method: "POST",
    headers: await apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
};
import { apiHeaders } from "./api.js";
