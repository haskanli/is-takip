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
    { id: "cust-user", name: "Customer", userType: "customer", roleKey: "customer_viewer", customerId: "cust1" },
  ],
  customers: [{ id: "cust1", name: "Customer A" }],
  projects: [
    {
      id: "p1",
      name: "Visible",
      customerId: "cust1",
      pmIds: ["pm"],
      members: ["member"],
      remoteAccess: [
        { id: "r1", name: "VPN", username: "user", password: "plain-secret" },
      ],
      costItems: [{ id: "c1", amountUsd: 100 }],
      reportSchedules: [{ id: "rs1" }],
      trainings: [{ id: "tr1", title: "Operator training" }],
      raciContacts: [{ id: "rc1", name: "Customer Contact", side: "Müşteri" }],
      machines: [{ id: "machine1", name: "Machine" }],
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
    p1: [
      { id: "ticket1", assignedTo: "member", title: "Mine" },
      { id: "ticket-customer", title: "Visible to customer", customerVisible: true, customerId: "cust1" },
    ],
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

test("customer sees only linked project public data and visible tickets", () => {
  const filtered = filterStateForProfile(state, {
    ...member,
    legacy_id: "cust-user",
    name: "Customer",
  });
  assert.deepEqual(filtered.projects.map((item) => item.id), ["p1"]);
  assert.deepEqual(filtered.people.map((item) => item.id), ["cust-user"]);
  assert.equal(filtered.projects[0].remoteAccess, undefined);
  assert.equal(filtered.projects[0].costItems, undefined);
  assert.equal(filtered.projects[0].reportSchedules, undefined);
  assert.deepEqual(filtered.projects[0].trainings.map((item) => item.id), ["tr1"]);
  assert.deepEqual(filtered.projects[0].raciContacts.map((item) => item.id), ["rc1"]);
  assert.deepEqual(filtered.projects[0].machines.map((item) => item.id), ["machine1"]);
  assert.deepEqual(filtered.projectTickets.p1.map((ticket) => ticket.id), ["ticket-customer"]);
  assert.deepEqual(filtered.projectActions, {});
  assert.deepEqual(filtered.logs, []);
});

test("customer can add a new customer ticket but cannot edit project data", () => {
  const profile = { ...member, legacy_id: "cust-user", name: "Customer" };
  const incoming = filterStateForProfile(state, profile);
  incoming.projects[0].name = "Tampered customer project";
  incoming.projectTickets.p1.push({
    id: "ticket-new-customer",
    title: "New customer ticket",
    status: "Açık",
  });

  const merged = mergeStateForProfile(state, incoming, profile);
  assert.equal(merged.projects[0].name, "Visible");
  const added = merged.projectTickets.p1.find((ticket) => ticket.id === "ticket-new-customer");
  assert.equal(added.source, "customer");
  assert.equal(added.customerVisible, true);
  assert.equal(added.customerId, "cust1");
  assert.equal(added.author, "Customer");
});

test("member can mark assigned manager task seen when acting on it", () => {
  const current = {
    ...state,
    personalTasks: [
      ...state.personalTasks,
      {
        id: "pt-managed",
        assignee: "member",
        createdBy: "admin",
        title: "Assigned by manager",
        status: "Bekliyor",
      },
    ],
  };
  const incoming = filterStateForProfile(current, member);
  const task = incoming.personalTasks.find((item) => item.id === "pt-managed");
  task.status = "Devam Ediyor";
  task.firstSeenAt = "2026-06-18T09:00:00.000Z";
  task.statusUpdatedAt = "2026-06-18T09:01:00.000Z";
  task.statusUpdatedBy = "member";

  const merged = mergeStateForProfile(current, incoming, member);
  const updated = merged.personalTasks.find((item) => item.id === "pt-managed");

  assert.equal(updated.status, "Devam Ediyor");
  assert.equal(updated.firstSeenAt, "2026-06-18T09:00:00.000Z");
  assert.equal(updated.statusUpdatedAt, "2026-06-18T09:01:00.000Z");
  assert.equal(updated.statusUpdatedBy, "member");
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
