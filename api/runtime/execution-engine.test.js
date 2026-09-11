"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAgentRegistry } = require("./agent-registry");
const { createExecutionEngine } = require("./execution-engine");

const definition = {
  id: "research-agent",
  version: "1.0.0",
  purpose: "Perform bounded legal research",
  inputs: ["task"],
  outputs: ["research-result"],
  capabilities: ["research"],
  tools: ["legal-search"],
  matterScopes: ["matter"],
  dataClasses: ["legal-source"],
  humanApproval: { required: true, actions: ["consequential-action"] },
  limits: { maxInputBytes: 4096, maxOutputBytes: 4096, timeoutMs: 100 }
};

function request(overrides = {}) {
  return {
    taskId: "task-1", agentId: "research-agent", agentVersion: "1.0.0", actorId: "actor-1", matterId: "matter-1",
    requestedCapabilities: ["research"], requestedTools: ["legal-search"], dataClasses: ["legal-source"],
    limits: { maxInputBytes: 4096, maxOutputBytes: 4096, timeoutMs: 100 },
    humanApproval: { required: true, actions: ["consequential-action"] },
    provenance: { required: true }, audit: { required: true }, input: { task: "find authority" }, ...overrides
  };
}

function engine(execute) {
  const registry = createAgentRegistry();
  registry.register(definition);
  const events = { provenance: [], audit: [] };
  return {
    events,
    engine: createExecutionEngine({
      registry,
      authorize: async () => ({ allowed: true, humanApprovalGranted: true }),
      execute,
      recordProvenance: async (event) => { events.provenance.push(event); return `prov-${events.provenance.length}`; },
      recordAudit: async (event) => { events.audit.push(event); return `audit-${events.audit.length}`; }
    })
  };
}

test("executes only after independent authorization and declarations", async () => {
  const { engine, events } = engine(async () => ({ status: "succeeded", output: { answer: "ok" }, evidence: [], uncertainty: [] }));
  const result = await engine.run(request());
  assert.equal(result.status, "succeeded");
  assert.equal(result.provenanceEventId, "prov-1");
  assert.equal(result.auditEventId, "audit-1");
});

test("blocks undeclared tool", async () => {
  const { engine } = engine(async () => { throw new Error("must not execute"); });
  const result = await engine.run(request({ requestedTools: ["admin-tool"] }));
  assert.equal(result.status, "blocked");
  assert.equal(result.failure.code, "tool_not_declared");
});

test("blocks missing human approval", async () => {
  const registry = createAgentRegistry(); registry.register(definition);
  const { engine } = (() => {
    const events = { provenance: [], audit: [] };
    return { engine: createExecutionEngine({ registry, authorize: async () => ({ allowed: true, humanApprovalGranted: false }), execute: async () => { throw new Error("must not execute"); }, recordProvenance: async () => "p", recordAudit: async () => "a" }) };
  })();
  const result = await engine.run(request());
  assert.equal(result.status, "blocked");
  assert.equal(result.failure.code, "human_approval_required");
});

test("times out and aborts execution", async () => {
  const { engine, events } = engine(({ signal }) => new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve({ status: "cancelled", failure: { code: "aborted", message: "aborted" }, evidence: [], uncertainty: [] }), { once: true });
  }));
  const result = await engine.run(request({ limits: { maxInputBytes: 4096, maxOutputBytes: 4096, timeoutMs: 10 } }));
  assert.equal(result.status, "timed_out");
  assert.equal(events.provenance.length, 1);
  assert.equal(events.audit.length, 1);
});

test("fails closed on malformed agent result", async () => {
  const { engine } = engine(async () => ({ status: "succeeded", evidence: [], uncertainty: [] }));
  const result = await engine.run(request());
  assert.equal(result.status, "failed");
  assert.equal(result.failure.code, "malformed_result");
});

test("blocks requests that exceed registered agent limits", async () => {
  const { engine } = engine(async () => { throw new Error("must not execute"); });
  const result = await engine.run(request({ limits: { maxInputBytes: 8192, maxOutputBytes: 4096, timeoutMs: 100 } }));
  assert.equal(result.status, "blocked");
  assert.equal(result.failure.code, "execution_limit_exceeded");
});

test("records blocked outcomes for audit and provenance", async () => {
  const { engine, events } = engine(async () => { throw new Error("must not execute"); });
  const result = await engine.run(request({ requestedCapabilities: ["undeclared"] }));
  assert.equal(result.status, "blocked");
  assert.equal(events.provenance.length, 1);
  assert.equal(events.audit.length, 1);
});
