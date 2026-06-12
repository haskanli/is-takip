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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, ticket }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json();
  if (!result.sent) throw new Error(result.reason || "Atama e-postası gönderilemedi.");
  return result;
};
