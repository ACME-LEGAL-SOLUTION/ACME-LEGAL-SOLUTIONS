"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createSpecialistAgent } = require("./specialist-agent");

test("specialist agent scopes execution to its declared role", async () => {
  let received;
  const agent = createSpecialistAgent({
    role: "legal_research",
    provider: { id: "provider-1", async execute(input) { received = input; return { answer: "draft" }; } }
  });
  const result = await agent.execute({ matterId: "matter-1", actor: { id: "human-1" }, task: "research" });
  assert.deepEqual(result, { answer: "draft" });
  assert.equal(received.context.specialistRole, "legal_research");
});

test("specialist agent rejects unsupported roles and missing scope", async () => {
  assert.throws(() => createSpecialistAgent({ role: "final_action", provider: { async execute() {} } }), /Unsupported specialist role/);
  const agent = createSpecialistAgent({ role: "tax", provider: { async execute() {} } });
  await assert.rejects(() => agent.execute({ task: "review", actor: { id: "u" } }), /Matter scope/);
});
