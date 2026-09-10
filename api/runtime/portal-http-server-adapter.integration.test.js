"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPortalInvoker, CLIENT_PATH, PROFESSIONAL_PATH } = require("./portal-http-server-adapter");

test("portal adapter exposes only the two governed portal entry points", async () => {
  const invoker = createPortalInvoker({ clientDashboard: async ({ clientId, actor }) => ({ clientId, actor: actor.id }), professionalWorkspace: async ({ matterId, actor }) => ({ matterId, actor: actor.id }) });
  assert.deepEqual(await invoker(CLIENT_PATH, { clientId: "c1" }, { id: "u1" }), { clientId: "c1", actor: "u1" });
  assert.deepEqual(await invoker(PROFESSIONAL_PATH, { matterId: "m1" }, { id: "p1" }), { matterId: "m1", actor: "p1" });
  await assert.rejects(() => invoker("/api/portal/client/../professional", {}, { id: "u1" }), /Unsupported portal route/);
});
