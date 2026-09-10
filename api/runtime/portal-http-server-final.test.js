"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ROUTES } = require("./http-boundary");
const { CLIENT_PATH, PROFESSIONAL_PATH, createPortalHttpRoutes } = require("./portal-http-routes");

test("portal HTTP routes are present and map to the portal service", () => {
  assert.equal(ROUTES[CLIENT_PATH], "portal");
  assert.equal(ROUTES[PROFESSIONAL_PATH], "portal");
  const portal = { clientDashboard: async () => ({}), professionalWorkspace: async () => ({}) };
  const routes = createPortalHttpRoutes({ portal });
  assert.equal(typeof routes[CLIENT_PATH], "function");
  assert.equal(typeof routes[PROFESSIONAL_PATH], "function");
});
