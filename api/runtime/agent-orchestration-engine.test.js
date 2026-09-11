"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAgentOrchestrationEngine } = require("./agent-orchestration-engine");

function task() {
  return { taskId: "task-1", matterId: "matter-1", agentId: "agent-1", actor: { id: "human-1", role: "lawyer", human: true }, input: "review", dataClasses: ["matter"], tools: [] };
}

function deps({ evaluationPassed = true, executionResult } = {}) {
  const calls = [];
  return {
    calls,
    contextEngine: { build: async (value) => { calls.push(["context", value]); return Object.freeze({ requestId: value.requestId, matterId: value.matterId }); } },
    agentExecutionEngine: { run: async (value) => { calls.push(["execution", value]); return executionResult || { status: "completed", output: "ok", provenance: { requestId: value.requestId } }; } },
    evaluationEngine: { evaluate: async (value) => { calls.push(["evaluation", value]); return { passed: evaluationPassed, findings: [] }; } },
    audit: async (value) => calls.push(["audit", value])
  };
}

test("orchestrates context, execution, evaluation and audit in order", async () => {
  const d = deps();
  const engine = createAgentOrchestrationEngine({ ...d, clock: () => "2026-09-12T00:00:00.000Z" });
  const result = await engine.run({ requestId: "req-1", task: task(), sources: ["doc-1"] });
  assert.equal(result.status, "completed");
  assert.deepEqual(d.calls.map(([name]) => name), ["context", "execution", "evaluation", "audit"]);
  assert.equal(d.calls[1][1].context.requestId, "req-1");
  assert.equal(d.calls[2][1].context.requestId, "req-1");
  assert.equal(d.calls[3][1].requestId, "req-1");
});

test("evaluation failure gates successful agent result", async () => {
  const d = deps({ evaluationPassed: false });
  const engine = createAgentOrchestrationEngine(d);
  const result = await engine.run({ requestId: "req-2", task: task() });
  assert.equal(result.status, "failed");
  assert.equal(result.evaluation.passed, false);
  assert.equal(d.calls.at(-1)[0], "audit");
  assert.equal(d.calls.at(-1)[1].evaluationPassed, false);
});

test("dependency failure is converted to audited failed outcome", async () => {
  const audits = [];
  const engine = createAgentOrchestrationEngine({
    contextEngine: { build: async () => { throw new Error("context unavailable"); } },
    agentExecutionEngine: { run: async () => { throw new Error("must not execute"); } },
    evaluationEngine: { evaluate: async () => { throw new Error("must not evaluate"); } },
    audit: async (event) => audits.push(event)
  });
  const result = await engine.run({ requestId: "req-3", task: task() });
  assert.equal(result.status, "failed");
  assert.equal(result.error, "context unavailable");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].status, "failed");
});

test("rejects missing request or task", async () => {
  const engine = createAgentOrchestrationEngine({ contextEngine: { build() {} }, agentExecutionEngine: { run() {} }, evaluationEngine: { evaluate() {} } });
  await assert.rejects(() => engine.run({ task: task() }), /requestId and task are required/);
  await assert.rejects(() => engine.run({ requestId: "req-4" }), /requestId and task are required/);
});
