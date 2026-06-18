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
    projectScope: "all",
    projectSegment: "all",
    projectSearch: "",
    projectViewMode: "cards",
  });
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
    pathForRouteState({ view: "projects", projectScope: "mine", projectSegment: "connected", projectSearch: "gen", projectViewMode: "list" }),
    "/projects?scope=mine&segment=connected&q=gen&mode=list",
  );
});
