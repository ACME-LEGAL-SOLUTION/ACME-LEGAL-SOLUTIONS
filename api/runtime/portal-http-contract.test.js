"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { CLIENT_PATH, PROFESSIONAL_PATH, extendPortalOperations, createPortalInvoker } = require("./portal-http-server-adapter");

test("portal HTTP contract remains authenticated and explicit", async () => {
  const operations = extendPortalOperations({});
  assert.deepEqual(operations[CLIENT_PATH], { GET: ["dashboard"] });
  assert.deepEqual(operations[PROFESSIONAL_PATH], { GET: ["workspace"] });
  const invoker = createPortalInvoker({ clientDashboard: async ({ clientId, actor }) => ({ clientId, actorId: actor.id }), professionalWorkspace: async ({ matterId, actor }) => ({ matterId, actorId: actor.id }) });
  const actor = { id: "actor-1", clientId: "client-1" };
  assert.deepEqual(await invoker(CLIENT_PATH, { clientId: "client-1" }, actor), { clientId: "client-1", actorId: "actor-1" });
  await assert.rejects(() => invoker("/api/portal/other", {}, actor), /Unsupported portal route/);
});
