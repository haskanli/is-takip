import assert from "node:assert/strict";
import test from "node:test";
import { askPortfolioAI, askProjectAI } from "../server/services/projectAI.js";

const response = (outputText = "Analiz hazır") => ({
  ok: true,
  json: async () => ({ output_text: outputText }),
});

test("askProjectAI sends only compact project data", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let requestBody;
  const answer = await askProjectAI({
    project: {
      name: "MES",
      status: "Devam Ediyor",
      remoteAccess: [{ username: "secret-user", password: "secret-password" }],
      milestones: [{ name: "Analiz", tasks: [{ title: "Akış", status: "Bekliyor" }] }],
    },
    tickets: [],
    question: "Risk nedir?",
  }, {
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response();
    },
  });

  assert.equal(answer, "Analiz hazır");
  assert.match(requestBody.input, /Akış/);
  assert.doesNotMatch(requestBody.input, /secret-user|secret-password/);
});

test("askPortfolioAI includes multiple accessible projects", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let requestBody;
  await askPortfolioAI({
    projects: [
      { id: "p1", name: "Bir", milestones: [] },
      { id: "p2", name: "İki", milestones: [] },
    ],
    projectTickets: {},
    question: "Öncelik nedir?",
  }, {
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response("Portföy analizi");
    },
  });

  assert.match(requestBody.input, /Bir/);
  assert.match(requestBody.input, /İki/);
});
