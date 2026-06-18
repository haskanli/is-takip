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
  });
});

test("routeFromLocation keeps legacy view query links working", () => {
  const route = routeFromLocation({
    pathname: "/",
    search: "?view=tickets&project=project-1&ticket=ticket-1",
  });
  assert.equal(route.view, "tickets");
  assert.equal(route.selProject, null);
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
    pathForRouteState({ view: "admin", adminSection: "assigned" }),
    "/admin/assigned",
  );
});
