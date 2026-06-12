import { createClient } from "@supabase/supabase-js";
import { getJiraConfig, getSupabaseConfig } from "../config.js";
import { logger } from "../logger.js";
import { withRetry } from "../retry.js";

let client;
let mutationQueue = Promise.resolve();

const getClient = () => {
  if (!client) {
    const config = getSupabaseConfig();
    client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

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
    const { data, error } = await getClient()
      .from("app_state")
      .select("data")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return data?.data || {};
  }, "database.app_state.load");

export const createTicket = async ({ projectId, ticket }) =>
  mutateState((state) => {
    state.projectTickets ||= {};
    const tickets = state.projectTickets[projectId] || [];
    const existing = tickets.find((item) => item.id === ticket.id);
    if (existing) return existing;
    tickets.push(ticket);
    state.projectTickets[projectId] = tickets;
    logger.info("database.ticket.created", {
      projectId,
      ticketId: ticket.id,
      assignedTo: ticket.assignedTo || null,
    });
    return ticket;
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

const saveState = async (state) =>
  runSupabase(async () => {
    const { error } = await getClient().from("app_state").upsert({
      id: 1,
      data: state,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }, "database.app_state.save");

const mutateState = (mutator) => {
  const mutation = mutationQueue.then(async () => {
    const state = await loadState();
    const result = await mutator(state);
    await saveState(state);
    return result;
  });

  mutationQueue = mutation.catch(() => {});
  return mutation;
};

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

      ticket.jiraStatus = status;
      ticket.jiraUpdatedAt = new Date().toISOString();
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
