"use strict";

const assert = require("node:assert/strict");
const { SPECIALIST_ROLES, createSpecialistAgent } = require("./specialist-agent");
const { createSpecialistRouter } = require("./specialist-router");

describe("specialist router", () => {
  function makeSpecialists(calls) {
    const provider = { id: "test", capabilities: ["chat"], async execute(input) { calls.push(input); return { ok: true }; } };
    return Object.fromEntries(SPECIALIST_ROLES.map((role) => [role, createSpecialistAgent({ role, provider })]));
  }

  it("routes domain-specific work to the strongest specialist", async () => {
    const calls = [];
    const router = createSpecialistRouter({ specialists: makeSpecialists(calls) });
    await router.execute({ matterId: "m1", actor: { id: "u1" }, task: "Review GST tax compliance filing" });
    assert.equal(calls[0].context.routedSpecialistRole, "tax");
  });

  it("honors an explicit specialist role", async () => {
    const calls = [];
    const router = createSpecialistRouter({ specialists: makeSpecialists(calls) });
    await router.execute({ matterId: "m1", actor: { id: "u1" }, task: "Review a shareholder agreement", context: { specialistRole: "corporate" } });
    assert.equal(calls[0].context.routedSpecialistRole, "corporate");
  });

  it("rejects unsupported explicit roles", async () => {
    const router = createSpecialistRouter({ specialists: makeSpecialists([]) });
    await assert.rejects(() => router.execute({ matterId: "m1", actor: { id: "u1" }, task: "Review", context: { specialistRole: "unknown" } }), /Unsupported specialist role/);
  });
});
