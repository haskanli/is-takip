import assert from "node:assert/strict";
import test from "node:test";
import { pathForRouteState, routeFromLocation } from "../src/routing.js";

test("routeFromLocation opens project detail tabs from URL", () => {
  const route = routeFromLocation({
    pathname: "/projects/project-1/tickets",
    search: "",
  });
  assert.deepEqual(route, {
    view: "projects",
    selProject: "project-1",
    projectTab: "tickets",
    ticketMineOnly: false,
    taskId: "",
    ticketProjectId: "",
    ticketId: "",
  });
});

test("routeFromLocation normalizes unknown project tabs", () => {
  const route = routeFromLocation({
    pathname: "/projects/project-1/unknown-tab",
    search: "",
  });
  assert.equal(route.projectTab, "setup");
});

test("routeFromLocation keeps legacy view query links working", () => {
  const route = routeFromLocation({
    pathname: "/",
    search: "?view=tickets&project=project-1&ticket=ticket-1",
  });
  assert.equal(route.view, "tickets");
  assert.equal(route.selProject, null);
});

test("routeFromLocation reads task and ticket deep links", () => {
  assert.deepEqual(routeFromLocation({
    pathname: "/my-tasks",
    search: "?task=task-1",
  }), {
    view: "mytasks",
    selProject: null,
    projectTab: "setup",
    adminSection: "overview",
    ticketMineOnly: false,
    taskId: "task-1",
    ticketProjectId: "",
    ticketId: "",
    ticketTab: "tickets",
    ticketSearch: "",
    ticketProjectFilters: [],
    ticketStatusFilters: [],
    fieldSection: "plan",
    fieldScope: "",
    fieldProject: "all",
    fieldPerson: "",
    fieldType: "all",
    fieldWeek: 0,
    importType: "all",
    reportProject: "",
    reportGroup: "operations",
    projectScope: "all",
    projectSegment: "all",
    projectSearch: "",
    projectViewMode: "cards",
  });
  assert.deepEqual(routeFromLocation({
    pathname: "/ticketlar",
    search: "?mine=1&project=project-1&ticket=ticket-1",
  }), {
    view: "tickets",
    selProject: null,
    projectTab: "setup",
    adminSection: "overview",
    ticketMineOnly: true,
    taskId: "",
    ticketProjectId: "project-1",
    ticketId: "ticket-1",
    ticketTab: "tickets",
    ticketSearch: "",
    ticketProjectFilters: [],
    ticketStatusFilters: [],
    fieldSection: "plan",
    fieldScope: "",
    fieldProject: "all",
    fieldPerson: "",
    fieldType: "all",
    fieldWeek: 0,
    importType: "all",
    reportProject: "",
    reportGroup: "operations",
    projectScope: "all",
    projectSegment: "all",
    projectSearch: "",
    projectViewMode: "cards",
  });
});

test("routeFromLocation reads ticket list filters", () => {
  const route = routeFromLocation({
    pathname: "/ticketlar",
    search: "?mine=1&tab=recurring&q=lisans&projects=project-1,project-2&statuses=Open,Done",
  });
  assert.equal(route.view, "tickets");
  assert.equal(route.ticketMineOnly, true);
  assert.equal(route.ticketTab, "recurring");
  assert.equal(route.ticketSearch, "lisans");
  assert.deepEqual(route.ticketProjectFilters, ["project-1", "project-2"]);
  assert.deepEqual(route.ticketStatusFilters, ["Open", "Done"]);
});

test("routeFromLocation reads field operations filters", () => {
  const route = routeFromLocation({
    pathname: "/field-operations",
    search: "?section=visits&scope=team&project=project-1&person=person-1&type=remote&week=2",
  });
  assert.equal(route.view, "fieldops");
  assert.equal(route.fieldSection, "visits");
  assert.equal(route.fieldScope, "team");
  assert.equal(route.fieldProject, "project-1");
  assert.equal(route.fieldPerson, "person-1");
  assert.equal(route.fieldType, "remote");
  assert.equal(route.fieldWeek, 2);
});

test("routeFromLocation reads report and import filters", () => {
  const reportRoute = routeFromLocation({
    pathname: "/reports",
    search: "?project=project-1&group=management",
  });
  assert.equal(reportRoute.view, "reports");
  assert.equal(reportRoute.reportProject, "project-1");
  assert.equal(reportRoute.reportGroup, "management");

  const importRoute = routeFromLocation({
    pathname: "/import",
    search: "?type=machines",
  });
  assert.equal(importRoute.view, "import");
  assert.equal(importRoute.importType, "machines");
});

test("routeFromLocation reads project list filters", () => {
  const route = routeFromLocation({
    pathname: "/projects",
    search: "?scope=mine&segment=connected&q=gen&mode=list",
  });
  assert.equal(route.view, "projects");
  assert.equal(route.selProject, null);
  assert.equal(route.projectScope, "mine");
  assert.equal(route.projectSegment, "connected");
  assert.equal(route.projectSearch, "gen");
  assert.equal(route.projectViewMode, "list");
});

test("routeFromLocation opens reminders page", () => {
  const route = routeFromLocation({
    pathname: "/reminders",
    search: "",
  });
  assert.equal(route.view, "reminders");
  assert.equal(pathForRouteState({ view: "reminders" }), "/reminders");
});

test("pathForRouteState builds stable app URLs", () => {
  assert.equal(pathForRouteState({ view: "dashboard" }), "/");
  assert.equal(pathForRouteState({ view: "tickets" }), "/ticketlar");
  assert.equal(pathForRouteState({ view: "tickets", ticketMineOnly: true }), "/ticketlar?mine=1");
  assert.equal(
    pathForRouteState({ view: "projects", selProject: "project-1", projectTab: "setup" }),
    "/projects/project-1/setup",
  );
  assert.equal(
    pathForRouteState({ view: "projects", selProject: "customer/project 1", projectTab: "unknown" }),
    "/projects/customer%2Fproject%201/setup",
  );
  assert.equal(
    pathForRouteState({ view: "admin", adminSection: "assigned" }),
    "/admin/assigned",
  );
  assert.equal(
    pathForRouteState({ view: "mytasks", taskId: "task-1" }),
    "/my-tasks?task=task-1",
  );
  assert.equal(
    pathForRouteState({ view: "tickets", ticketMineOnly: true, ticketProjectId: "project-1", ticketId: "ticket-1" }),
    "/ticketlar?mine=1&project=project-1&ticket=ticket-1",
  );
  assert.equal(
    pathForRouteState({ view: "tickets", ticketMineOnly: true, ticketTab: "recurring", ticketSearch: "lisans", ticketProjectFilters: ["project-1", "project-2"], ticketStatusFilters: ["Open", "Done"] }),
    "/ticketlar?mine=1&tab=recurring&q=lisans&projects=project-1%2Cproject-2&statuses=Open%2CDone",
  );
  assert.equal(
    pathForRouteState({ view: "fieldops", fieldSection: "visits", fieldScope: "team", fieldProject: "project-1", fieldPerson: "person-1", fieldType: "remote", fieldWeek: 2 }),
    "/field-operations?section=visits&scope=team&project=project-1&person=person-1&type=remote&week=2",
  );
  assert.equal(
    pathForRouteState({ view: "reports", reportProject: "project-1", reportGroup: "management" }),
    "/reports?project=project-1&group=management",
  );
  assert.equal(
    pathForRouteState({ view: "import", importType: "machines" }),
    "/import?type=machines",
  );
  assert.equal(
    pathForRouteState({ view: "projects", projectScope: "mine", projectSegment: "connected", projectSearch: "gen", projectViewMode: "list" }),
    "/projects?scope=mine&segment=connected&q=gen&mode=list",
  );
});
