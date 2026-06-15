import test from "node:test";
import assert from "node:assert/strict";
import {
  createJiraNewsletter,
  createProjectStatusReport,
  nextScheduledRun,
} from "../server/services/reporting.js";

const project = {
  name: "MES Fabrika",
  milestones: [{
    name: "Analiz",
    dueDate: "2026-06-30",
    tasks: [
      { title: "Akış analizi", status: "Tamamlandı", dueDate: "2026-06-10" },
      { title: "Sinyal listesi", status: "Bekliyor", dueDate: "2099-06-20" },
    ],
  }],
  risks: [{ title: "PLC erişimi", status: "Açık" }],
};

test("project status report renders progress and milestone details", () => {
  const html = createProjectStatusReport({
    project,
    tenantProfile: { name: "A Firması", accentColor: "#06b6d4" },
  });
  assert.match(html, /MES Fabrika/);
  assert.match(html, /%50/);
  assert.match(html, /Analiz/);
  assert.match(html, /A Firması/);
  assert.match(html, /Sent by/);
  assert.match(html, />Corject</);
  assert.match(html, /charset=UTF-8/i);
  assert.match(html, /OTOMATİK PROJE RAPORU/);
  assert.doesNotMatch(html, /�|Ã|Å/);
});

test("Jira newsletter includes recently completed work", () => {
  const html = createJiraNewsletter({
    project,
    tickets: [{
      ticketNo: "CJT-42",
      jiraKey: "MES-12",
      title: "Yeni kalite ekranı",
      description: "Operatör kalite kayıt ekranı tamamlandı.",
      jiraStatus: "Done",
      jiraUpdatedAt: new Date().toISOString(),
    }],
  });
  assert.match(html, /MES-12/);
  assert.match(html, /Yeni kalite ekranı/);
});

test("weekly schedules advance by seven days", () => {
  const current = new Date("2026-06-15T08:00:00.000Z");
  assert.equal(
    nextScheduledRun({ frequency: "weekly" }, current),
    "2026-06-22T08:00:00.000Z",
  );
});
