import { getJiraConfig } from "../config.js";
import { getDatabaseClient } from "../database.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";
import { syncNormalizedState } from "./normalizedState.js";
import { decryptSecret, encryptSecret } from "../services/vault.js";

let mutationQueue = Promise.resolve();

const isRetryable = (error) =>
  !error?.status || error.status === 429 || error.status >= 500;

const runSupabase = (operation, event) =>
  withRetry(operation, {
    retries: 3,
    shouldRetry: isRetryable,
    onRetry: (error, attempt, delayMs) =>
      logger.warn(`${event}.retry`, {
        attempt,
        delayMs,
        status: error?.status,
      }),
  });

export const loadState = async () =>
  runSupabase(async () => {
    const { data, error } = await getDatabaseClient()
      .from("app_state")
      .select("data")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return data?.data || {};
  }, "database.app_state.load");

export const loadStateRecord = async () =>
  runSupabase(async () => {
    const { data, error } = await getDatabaseClient()
      .from("app_state")
      .select("data,version,updated_at")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return {
      state: data?.data || {},
      version: Number(data?.version || 1),
      updatedAt: data?.updated_at || null,
    };
  }, "database.app_state.record-load");

export const saveStateRecord = async ({ state, expectedVersion }) =>
  runSupabase(async () => {
    const nextVersion = Number(expectedVersion) + 1;
    const { data, error } = await getDatabaseClient()
      .from("app_state")
      .update({
        data: state,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .eq("version", Number(expectedVersion))
      .select("version,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw Object.assign(new Error("State changed by another user"), { status: 409 });
    }
    try {
      await syncNormalizedState(state);
    } catch (syncError) {
      logger.error("database.normalized-sync.failed", syncError, {
        version: nextVersion,
      });
    }
    const { error: metaError } = await getDatabaseClient().from("app_meta").upsert({
      id: 1,
      state_version: nextVersion,
      updated_at: new Date().toISOString(),
    });
    if (metaError) throw metaError;
    return { version: Number(data.version), updatedAt: data.updated_at };
  }, "database.app_state.record-save");

export const checkDatabase = async () =>
  runSupabase(async () => {
    const startedAt = Date.now();
    const { error } = await getDatabaseClient().from("app_state").select("id", { head: true }).eq("id", 1);
    if (error) throw error;
    return { ok: true, latencyMs: Date.now() - startedAt };
  }, "database.health");

export const createTicket = async ({ projectId, ticket }) =>
  mutateState((state) => {
    state.projectTickets ||= {};
    const tickets = state.projectTickets[projectId] || [];
    const existing = tickets.find((item) => item.id === ticket.id);
    if (existing) return existing;
    const allTickets = Object.values(state.projectTickets).flat();
    const highestNumber = allTickets.reduce((highest, item) => {
      const match = String(item.ticketNo || "").match(/^CJT-(\d+)$/);
      return Math.max(highest, match ? Number(match[1]) : 0);
    }, allTickets.length);
    const createdTicket = { ...ticket, ticketNo: `CJT-${highestNumber + 1}` };
    tickets.push(createdTicket);
    state.projectTickets[projectId] = tickets;
    logger.info("database.ticket.created", {
      projectId,
      ticketId: createdTicket.id,
      ticketNo: createdTicket.ticketNo,
      assignedTo: createdTicket.assignedTo || null,
    });
    return createdTicket;
  });

export const createAssignedTasks = async ({ tasks, recurringTemplate }) =>
  mutateState((state) => {
    state.personalTasks ||= [];
    const created = [];
    for (const task of tasks) {
      if (state.personalTasks.some((item) => item.id === task.id)) continue;
      state.personalTasks.push(task);
      created.push(task);
    }
    if (recurringTemplate) {
      state.recurringTasks ||= [];
      if (!state.recurringTasks.some((item) => item.id === recurringTemplate.id)) {
        state.recurringTasks.push(recurringTemplate);
      }
    }
    return created;
  });

export const generateRecurringTasks = async (today) =>
  mutateState((state) => {
    state.personalTasks ||= [];
    state.recurringTasks ||= [];
    const created = [];
    for (const template of state.recurringTasks) {
      if (!template.active || !template.nextRunDate) continue;
      while (template.nextRunDate <= today) {
        const runDate = template.nextRunDate;
        for (const assignee of template.assigneeIds || []) {
          const occurrenceKey = `${template.id}:${assignee}:${runDate}`;
          if (state.personalTasks.some((task) => task.occurrenceKey === occurrenceKey)) continue;
          created.push({
            ...template.task,
            id: `${template.id}-${assignee}-${runDate}`,
            assignee,
            status: "Bekliyor",
            startDate: runDate,
            dueDate: runDate,
            createdAt: new Date().toISOString(),
            recurringTemplateId: template.id,
            occurrenceKey,
            comments: [],
          });
        }
        const next = new Date(`${runDate}T00:00:00Z`);
        if (template.frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
        else if (template.frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
        else next.setUTCDate(next.getUTCDate() + 1);
        template.nextRunDate = next.toISOString().slice(0, 10);
      }
    }
    state.personalTasks.push(...created);
    return created;
  });

export const markReportScheduleSent = async ({
  projectId,
  scheduleId,
  sentAt,
  nextRunAt,
  error = "",
}) =>
  mutateState((state) => {
    const project = state.projects?.find((item) => item.id === projectId);
    if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
    const schedule = (project.reportSchedules || []).find(
      (item) => item.id === scheduleId,
    );
    if (!schedule) throw Object.assign(new Error("Report schedule not found"), { status: 404 });
    schedule.lastAttemptAt = sentAt;
    schedule.lastError = error;
    if (!error) {
      schedule.lastSentAt = sentAt;
      schedule.nextRunAt = nextRunAt;
    }
    return schedule;
  });

const mutateState = (mutator) => {
  const mutation = mutationQueue.then(async () => {
    const record = await loadStateRecord();
    const result = await mutator(record.state);
    await saveStateRecord({
      state: record.state,
      expectedVersion: record.version,
    });
    return result;
  });

  mutationQueue = mutation.catch(() => {});
  return mutation;
};

const mutateStateWithVersion = (mutator) => {
  const mutation = mutationQueue.then(async () => {
    const record = await loadStateRecord();
    const result = await mutator(record.state);
    const saved = await saveStateRecord({
      state: record.state,
      expectedVersion: record.version,
    });
    return { result, ...saved };
  });

  mutationQueue = mutation.catch(() => {});
  return mutation;
};

const publicRemoteAccess = (item, encryptedPassword = "") => ({
  ...item,
  password: encryptedPassword ? decryptSecret(encryptedPassword) : "",
});

export const getRemoteAccessRecords = async (projectId) => {
  const state = await loadState();
  const project = state.projects?.find((item) => item.id === projectId);
  if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
  const secrets = state.remoteAccessSecrets?.[projectId] || {};
  return (project.remoteAccess || []).map((item) =>
    publicRemoteAccess(item, secrets[item.id]),
  );
};

export const upsertRemoteAccessRecord = async ({
  projectId,
  record,
  actor,
}) =>
  mutateStateWithVersion((state) => {
    const project = state.projects?.find((item) => item.id === projectId);
    if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
    const records = project.remoteAccess || [];
    const current = records.find((item) => item.id === record.id);
    const next = {
      ...(current || {}),
      ...record,
      password: undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: actor?.name || "System",
    };
    delete next.password;
    if (!current) {
      next.createdAt = next.createdAt || new Date().toISOString();
      records.unshift(next);
    } else {
      project.remoteAccess = records.map((item) =>
        item.id === next.id ? next : item,
      );
    }
    project.remoteAccess ||= records;
    state.remoteAccessSecrets ||= {};
    state.remoteAccessSecrets[projectId] ||= {};
    if (record.password !== undefined) {
      state.remoteAccessSecrets[projectId][next.id] = encryptSecret(record.password);
    }
    return publicRemoteAccess(
      next,
      state.remoteAccessSecrets[projectId][next.id],
    );
  });

export const deleteRemoteAccessRecord = async ({ projectId, recordId }) =>
  mutateStateWithVersion((state) => {
    const project = state.projects?.find((item) => item.id === projectId);
    if (!project) throw Object.assign(new Error("Project not found"), { status: 404 });
    project.remoteAccess = (project.remoteAccess || []).filter(
      (item) => item.id !== recordId,
    );
    if (state.remoteAccessSecrets?.[projectId]) {
      delete state.remoteAccessSecrets[projectId][recordId];
    }
    return { id: recordId };
  });

export const saveJiraIssueToTicket = async ({
  projectId,
  ticket,
  issue,
}) =>
  mutateState((state) => {
    state.projectTickets ||= {};
    const tickets = state.projectTickets[projectId] || [];
    const jira = getJiraConfig();
    const savedTicket = {
      ...ticket,
      jiraId: issue.key,
      jiraKey: issue.key,
      jiraIssueId: issue.id,
      jiraLink: `${jira.baseUrl}/browse/${encodeURIComponent(issue.key)}`,
      jiraSyncedAt: new Date().toISOString(),
      jiraSyncError: null,
      status: "Jira'da Çalışılıyor",
      ownerTeam: "Ürün",
      history: [
        ...(ticket.history || []),
        {
          id: `jira-${Date.now()}`,
          ts: new Date().toISOString(),
          userName: "Jira",
          label: "Jira ilişkisi",
          from: "-",
          to: issue.key,
        },
      ],
    };
    const index = tickets.findIndex((item) => item.id === ticket.id);

    if (index === -1) tickets.push(savedTicket);
    else tickets[index] = { ...tickets[index], ...savedTicket };

    state.projectTickets[projectId] = tickets;
    logger.info("database.ticket.jira-linked", {
      projectId,
      ticketId: ticket.id,
      issueId: issue.id,
      issueKey: issue.key,
    });
    return savedTicket;
  });

export const updateTicketStatusByJiraKey = async ({
  issueKey,
  status,
  deliveryId,
}) =>
  mutateState((state) => {
    state.jiraWebhookDeliveries ||= [];
    if (
      deliveryId &&
      state.jiraWebhookDeliveries.some((item) => item.id === deliveryId)
    ) {
      return { duplicate: true, updated: false };
    }

    for (const [projectId, tickets] of Object.entries(
      state.projectTickets || {},
    )) {
      const ticket = tickets.find(
        (item) => (item.jiraKey || item.jiraId) === issueKey,
      );
      if (!ticket) continue;

      const previousStatus = ticket.status || "Açık";
      const normalized = String(status || "").toLocaleLowerCase("tr-TR");
      const workflow = normalized.includes("ready to release") ||
        normalized.includes("yayına hazır")
        ? { status: "Yayına Hazır", ownerTeam: "Ürün" }
        : ["done", "closed", "resolved", "tamamlandı"].some((item) =>
            normalized.includes(item),
          )
          ? { status: "Tamamlandı", ownerTeam: "Ürün" }
          : normalized.includes("test")
            ? {
                status: "Operasyon Testinde",
                ownerTeam: "Operasyon",
                testResult: "Bekliyor",
              }
            : { status: "Jira'da Çalışılıyor", ownerTeam: "Ürün" };
      ticket.jiraStatus = status;
      ticket.jiraUpdatedAt = new Date().toISOString();
      Object.assign(ticket, workflow);
      ticket.updatedAt = new Date().toISOString();
      ticket.history ||= [];
      ticket.history.push({
        id: `jira-webhook-${Date.now()}`,
        ts: ticket.updatedAt,
        userName: "Jira",
        label: "Durum",
        from: previousStatus,
        to: workflow.status,
      });
      if (deliveryId) {
        state.jiraWebhookDeliveries.push({
          id: deliveryId,
          receivedAt: new Date().toISOString(),
        });
        state.jiraWebhookDeliveries =
          state.jiraWebhookDeliveries.slice(-200);
      }

      logger.info("database.ticket.status-updated", {
        projectId,
        ticketId: ticket.id,
        issueKey,
        status,
      });
      return { duplicate: false, updated: true, projectId, ticketId: ticket.id };
    }

    return { duplicate: false, updated: false };
  });
