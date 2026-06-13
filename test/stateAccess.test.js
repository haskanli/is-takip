import test from "node:test";
import assert from "node:assert/strict";
import {
  filterStateForProfile,
  mergeStateForProfile,
} from "../server/stateAccess.js";

const state = {
  people: [
    { id: "admin", name: "Admin" },
    { id: "pm", name: "PM" },
    { id: "member", name: "Member" },
    { id: "other", name: "Other" },
    { id: "product", name: "Product", ticketOnly: true },
  ],
  projects: [
    {
      id: "p1",
      name: "Visible",
      pmIds: ["pm"],
      members: ["member"],
      remoteAccess: [
        { id: "r1", name: "VPN", username: "user", password: "plain-secret" },
      ],
      milestones: [
        {
          id: "m1",
          name: "Milestone",
          tasks: [
            { id: "t1", assignee: "member", status: "Bekliyor", title: "Own" },
            { id: "t2", assignee: "other", status: "Bekliyor", title: "Other" },
          ],
        },
      ],
    },
    {
      id: "p2",
      name: "Hidden",
      pmIds: ["other"],
      milestones: [],
    },
  ],
  personalTasks: [
    { id: "pt1", assignee: "member", title: "Mine" },
    { id: "pt2", assignee: "other", title: "Not mine" },
  ],
  fieldPlans: [
    { id: "fp1", userId: "member", projectId: "p1" },
    { id: "fp2", userId: "other", projectId: "p2" },
    { id: "fp3", userId: "other", projectId: "p1" },
  ],
  userNotes: { member: { notes: "mine" }, other: { notes: "secret" } },
  notifications: [
    { id: "n1", userId: "member" },
    { id: "n2", userId: "other" },
  ],
  projectTickets: {
    p1: [{ id: "ticket1", assignedTo: "member", title: "Mine" }],
    p2: [{ id: "ticket2", assignedTo: "other", title: "Hidden" }],
  },
  projectActions: { p1: [{ id: "a1" }], p2: [{ id: "a2" }] },
  recurringTasks: [],
  logs: [],
  remoteAccessSecrets: { p1: { r1: "encrypted-secret" } },
};

const member = {
  id: "uuid-member",
  legacy_id: "member",
  name: "Member",
  is_admin: false,
};

test("filters state to the authenticated user's scope", () => {
  const filtered = filterStateForProfile(state, member);
  assert.deepEqual(filtered.projects.map((item) => item.id), ["p1"]);
  assert.deepEqual(filtered.personalTasks.map((item) => item.id), ["pt1"]);
  assert.deepEqual(filtered.fieldPlans.map((item) => item.id), ["fp1"]);
  assert.deepEqual(Object.keys(filtered.userNotes), ["member"]);
  assert.deepEqual(Object.keys(filtered.projectTickets), ["p1"]);
  assert.deepEqual(Object.keys(filtered.projectActions), ["p1"]);
  assert.equal(filtered.remoteAccessSecrets, undefined);
  assert.equal(filtered.projects[0].remoteAccess[0].password, undefined);
});

test("admin state also excludes remote access secrets", () => {
  const filtered = filterStateForProfile(state, {
    ...member,
    legacy_id: "admin",
    is_admin: true,
  });
  assert.equal(filtered.remoteAccessSecrets, undefined);
  assert.equal(filtered.projects[0].remoteAccess[0].password, undefined);
});

test("ticket-only users see tickets without project details", () => {
  const filtered = filterStateForProfile(state, {
    ...member,
    legacy_id: "product",
    name: "Product",
  });
  assert.deepEqual(Object.keys(filtered.projectTickets).sort(), ["p1", "p2"]);
  assert.equal(filtered.projects.length, 2);
  assert.deepEqual(filtered.projects[0].milestones, []);
  assert.deepEqual(filtered.personalTasks, []);
  assert.deepEqual(filtered.projectActions, {});
});

test("member cannot change another user's task or hidden project", () => {
  const incoming = filterStateForProfile(state, member);
  incoming.people.find((person) => person.id === "member").avatarUrl =
    "https://avatars.slack-edge.com/member.png";
  incoming.people.find((person) => person.id === "other").avatarUrl =
    "https://avatars.slack-edge.com/other.png";
  incoming.projects[0].name = "Tampered";
  incoming.projects[0].milestones[0].tasks[0].status = "Devam Ediyor";
  incoming.projects[0].milestones[0].tasks[1].status = "Tamamlandı";
  const merged = mergeStateForProfile(state, incoming, member);

  assert.equal(merged.projects[0].name, "Visible");
  assert.equal(
    merged.projects[0].milestones[0].tasks[0].status,
    "Devam Ediyor",
  );
  assert.equal(merged.projects[0].milestones[0].tasks[1].status, "Bekliyor");
  assert.equal(merged.projects[1].name, "Hidden");
  assert.equal(
    merged.people.find((person) => person.id === "member").avatarUrl,
    "https://avatars.slack-edge.com/member.png",
  );
  assert.equal(
    merged.people.find((person) => person.id === "other").avatarUrl,
    undefined,
  );
});

test("member cannot save an unsafe profile image URL", () => {
  const incoming = filterStateForProfile(state, member);
  incoming.people.find((person) => person.id === "member").avatarUrl =
    "javascript:alert(1)";
  const merged = mergeStateForProfile(state, incoming, member);
  assert.equal(
    merged.people.find((person) => person.id === "member").avatarUrl,
    undefined,
  );
});

test("project manager can update only a managed project", () => {
  const profile = { ...member, legacy_id: "pm", name: "PM" };
  const incoming = filterStateForProfile(state, profile);
  assert.deepEqual(incoming.fieldPlans.map((item) => item.id), ["fp1", "fp3"]);
  incoming.projects[0].name = "Updated by PM";
  incoming.fieldPlans.find((item) => item.id === "fp3").visitNotes =
    "Tampered visit";
  const merged = mergeStateForProfile(state, incoming, profile);
  assert.equal(merged.projects[0].name, "Updated by PM");
  assert.equal(merged.projects[1].name, "Hidden");
  assert.equal(
    merged.fieldPlans.find((item) => item.id === "fp3").visitNotes,
    undefined,
  );
});
