"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createMatterWorkflow } = require("./matter-workflow");

test("matter workflow executes complete governed path", async () => {
  const calls = [];
  const workflow = createMatterWorkflow({
    crm: { createMatter: async () => ({ id: "m1", clientId: "c1", issue: "Tax dispute", jurisdiction: "IN" }) },
    conflict: { check: async () => ({ conflict: false, blocked: false }) },
    document: {}, evidence: {},
    specialistRouter: { execute: async (x) => { calls.push(x); return { specialistRole: "tax" }; } },
    knowledge: {}
  });
  const actor = { id: "lawyer", human: true };
  const started = await workflow.start({ clientId: "c1", issue: "Tax dispute", jurisdiction: "IN" }, actor);
  const result = await workflow.run({ ...started, facts: ["f1"], evidence: [{ id: "e1" }], authorities: [{ id: "a1" }], specialistFindings: [{ role: "tax", finding: "f" }], analysis: "a", uncertainty: [], confidence: .9, recommendedActions: [{ id: "r1" }], requiredDocuments: [], requiredTasks: [] }, actor);
  assert.equal(result.state, "closed");
  assert.equal(result.workPackage.state, "finalized");
  assert.ok(result.events.some((e) => e.state === "conflict_check"));
  assert.ok(result.events.some((e) => e.state === "human_review"));
  assert.ok(result.events.some((e) => e.state === "human_approved"));
  assert.ok(result.events.some((e) => e.state === "final_action"));
  assert.equal(calls[0].matterId, "m1");
});

test("matter workflow blocks conflicted matters", async () => {
  const workflow = createMatterWorkflow({ crm: { createMatter: async () => ({ id: "m1", clientId: "c1", issue: "Issue" }) }, conflict: { check: async () => ({ conflict: true }) }, document: {}, evidence: {}, specialistRouter: {}, knowledge: {} });
  const started = await workflow.start({ clientId: "c1", issue: "Issue" }, { id: "u", human: true });
  await assert.rejects(() => workflow.run(started, { id: "u", human: true }), /blocked by conflict check/);
});
