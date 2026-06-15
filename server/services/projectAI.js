import { getAIConfig } from "../config.js";
import { withRetry } from "../retry.js";

const compactProject = (project, tickets = []) => {
  const tasks = (project.milestones || []).flatMap((milestone) =>
    (milestone.tasks || []).map((task) => ({
      milestone: milestone.name,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      responsibilityGroup: task.responsibilityGroup,
      waitSource: task.waitSource,
      waitReason: task.waitReason,
      estimatedHours: task.estimatedHours,
    })),
  );
  return {
    name: project.name,
    status: project.status,
    readinessChecklist: (project.readinessChecklist || []).map((item) => ({
      category: item.category,
      item: item.text,
      status: item.status,
      weight: item.weight,
      note: item.note,
    })),
    milestones: (project.milestones || []).map((item) => ({
      name: item.name,
      status: item.status,
      dueDate: item.dueDate,
    })),
    tasks,
    risks: project.risks || [],
    tickets: tickets.map((ticket) => ({
      ticketNo: ticket.ticketNo,
      title: ticket.title,
      status: ticket.status,
      jiraStatus: ticket.jiraStatus,
      customerApproval: ticket.customerApproval?.status,
    })),
  };
};

export const askProjectAI = async ({ project, tickets, question }, { fetchImpl = fetch } = {}) => {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not configured"), { status: 503 });
  }
  const response = await withRetry(
    () => fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        instructions: "You are a read-only MES project analyst. Answer in Turkish. Use only the supplied project data, state uncertainty clearly, never invent facts, and provide concise prioritized actions. Never request or reveal credentials.",
        input: `Soru: ${question}\n\nProje verisi:\n${JSON.stringify(compactProject(project, tickets))}`,
      }),
    }),
    {
      retries: 2,
      shouldRetry: (error) => !error?.status || error.status === 429 || error.status >= 500,
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`AI request failed (${response.status}): ${detail}`), {
      status: response.status,
    });
  }
  const result = await response.json();
  return result.output_text ||
    result.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") ||
    "Yanıt üretilemedi.";
};

export const askPortfolioAI = async ({ projects, projectTickets, question }, { fetchImpl = fetch } = {}) => {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not configured"), { status: 503 });
  }
  const portfolio = (projects || []).map((project) =>
    compactProject(project, projectTickets?.[project.id] || []));
  const response = await withRetry(
    () => fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        instructions: "You are a read-only MES portfolio analyst. Answer in Turkish. Compare only the supplied projects, state uncertainty clearly, never invent facts, and provide concise prioritized actions. Never request or reveal credentials.",
        input: `Soru: ${question}\n\nErişilebilir proje portföyü:\n${JSON.stringify(portfolio)}`,
      }),
    }),
    {
      retries: 2,
      shouldRetry: (error) => !error?.status || error.status === 429 || error.status >= 500,
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`AI request failed (${response.status}): ${detail}`), {
      status: response.status,
    });
  }
  const result = await response.json();
  return result.output_text ||
    result.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") ||
    "Yanıt üretilemedi.";
};
