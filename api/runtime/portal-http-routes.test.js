"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { CLIENT_PATH, PROFESSIONAL_PATH, createPortalHttpRoutes, invokePortalRoute } = require("./portal-http-routes");

test("portal route handlers require the real portal service contract", () => {
  assert.throws(() => createPortalHttpRoutes(), /Portal service/);
  assert.throws(() => createPortalHttpRoutes({ portal: {} }), /Portal service/);
});

test("client and professional portal routes forward authenticated actor context", async () => {
  const calls = [];
  const portal = {
    clientDashboard: async (input) => { calls.push(["client", input]); return { audience: "client", clientId: input.clientId }; },
    professionalWorkspace: async (input) => { calls.push(["professional", input]); return { audience: "professional", matterId: input.matterId }; }
  };
  const routes = createPortalHttpRoutes({ portal });
  const clientActor = { id: "client-user", clientId: "client-1" };
  const professionalActor = { id: "pro-user", role: "professional", human: true };
  assert.deepEqual(await invokePortalRoute(routes, CLIENT_PATH, { clientId: "client-1" }, clientActor), { audience: "client", clientId: "client-1" });
  assert.deepEqual(await invokePortalRoute(routes, PROFESSIONAL_PATH, { matterId: "matter-1" }, professionalActor), { audience: "professional", matterId: "matter-1" });
  assert.deepEqual(calls, [
    ["client", { clientId: "client-1", actor: clientActor }],
    ["professional", { matterId: "matter-1", actor: professionalActor }]
  ]);
});

test("unknown portal route fails closed", async () => {
  const routes = createPortalHttpRoutes({ portal: { clientDashboard: async () => ({}), professionalWorkspace: async () => ({}) } });
  await assert.rejects(() => invokePortalRoute(routes, "/api/portal/unknown", {}, { id: "actor" }), /Unsupported portal route/);
});
