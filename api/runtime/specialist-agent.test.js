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

test("specialist agent injects governed knowledge and provenance", async () => {
  let received;
  const agent = createSpecialistAgent({
    role: "legal_research",
    provider: { async execute(input) { received = input; return { answer: "draft" }; } },
    knowledgeGateway: {
      async retrieve(input) {
        assert.equal(input.jurisdiction, "IN");
        return { sources: [{ id: "s1" }], provenance: [{ type: "source", id: "s1", jurisdiction: "IN" }] };
      }
    }
  });
  await agent.execute({ matterId: "matter-1", actor: { id: "human-1" }, task: "research", context: { jurisdiction: "IN", sourceIds: ["s1"] } });
  assert.equal(received.context.governedKnowledge.sources[0].id, "s1");
  assert.equal(received.metadata.provenance[0].type, "source");
});

test("specialist agent rejects unsupported roles and missing scope", async () => {
  assert.throws(() => createSpecialistAgent({ role: "final_action", provider: { async execute() {} } }), /Unsupported specialist role/);
  const agent = createSpecialistAgent({ role: "tax", provider: { async execute() {} } });
  await assert.rejects(() => agent.execute({ task: "review", actor: { id: "u" } }), /Matter scope/);
});
