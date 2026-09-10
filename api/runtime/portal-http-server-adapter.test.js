"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { CLIENT_PATH, PROFESSIONAL_PATH, extendPortalOperations, createPortalInvoker } = require("./portal-http-server-adapter");

test("portal HTTP adapter adds both authenticated endpoint definitions", () => {
  const operations = extendPortalOperations({ "/api/clients": { GET: ["getClient"] } });
  assert.deepEqual(operations[CLIENT_PATH], { GET: ["dashboard"] });
  assert.deepEqual(operations[PROFESSIONAL_PATH], { GET: ["workspace"] });
});

test("portal HTTP invoker delegates to portal service", async () => {
  const calls = [];
  const invoke = createPortalInvoker({
    clientDashboard: async (input) => { calls.push([CLIENT_PATH, input]); return { ok: true, audience: "client" }; },
    professionalWorkspace: async (input) => { calls.push([PROFESSIONAL_PATH, input]); return { ok: true, audience: "professional" }; }
  });
  const actor = { id: "u1", clientId: "c1" };
  assert.deepEqual(await invoke(CLIENT_PATH, { clientId: "c1" }, actor), { ok: true, audience: "client" });
  assert.deepEqual(await invoke(PROFESSIONAL_PATH, { matterId: "m1" }, { id: "p1", role: "professional", human: true }), { ok: true, audience: "professional" });
  assert.equal(calls.length, 2);
});
