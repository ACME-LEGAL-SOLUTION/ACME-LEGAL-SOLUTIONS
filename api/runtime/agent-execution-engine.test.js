"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAgentRegistry } = require("./agent-registry");
const { createAgentExecutionEngine } = require("./agent-execution-engine");

function agent(overrides = {}) {
  return {
    id: "research", version: "1.0.0", purpose: "Bounded research", inputs: ["task"], outputs: ["result"],
    capabilities: ["legal-research"], tools: ["search"], matterScopes: ["assigned-matter"], dataClasses: ["matter-data"],
    humanApproval: { required: false, actions: [] }, limits: { maxInputBytes: 100, maxOutputBytes: 1000, timeoutMs: 50 }, ...overrides
  };
}

function engine(overrides = {}) {
  const registry = createAgentRegistry(); registry.register(agent(overrides.agent)); const calls = [];
  return { calls, execution: createAgentExecutionEngine({ registry, authorizeMatter: async () => true, authorizeTools: async () => true, humanGate: async () => true,
    execute: async (input) => ({ status: "completed", output: `ok:${input.input}`, provenance: { requestId: input.requestId } }),
    provenance: async (event) => calls.push(["provenance", event.status]), audit: async (event) => calls.push(["audit", event.status]), ...overrides }) };
}

const task = (overrides = {}) => ({ taskId: "task-1", matterId: "matter-1", agentId: "research", actor: { id: "lawyer-1", role: "lawyer", human: true }, input: "hello", tools: ["search"], matterScope: "assigned-matter", dataClass: "matter-data", ...overrides });

test("execution succeeds only through the registered contract", async () => {
  const { execution, calls } = engine(); const result = await execution.run(task({ requestId: "req-1" }));
  assert.equal(result.status, "completed"); assert.equal(result.provenance.requestId, "req-1"); assert.deepEqual(calls, [["provenance", "completed"], ["audit", "completed"]]);
});
test("unregistered agents are blocked", async () => { const { execution } = engine(); const result = await execution.run(task({ agentId: "admin" })); assert.equal(result.provenance.blockedReason, "AGENT_NOT_REGISTERED"); });
test("undeclared tools and scopes are blocked before authorization", async () => {
  let matterCalls = 0; const { execution } = engine({ authorizeMatter: async () => { matterCalls += 1; return true; } });
  assert.equal((await execution.run(task({ tools: ["delete-everything"] }))).provenance.blockedReason, "UNDECLARED_TOOL");
  assert.equal((await execution.run(task({ matterScope: "all-matters" }))).provenance.blockedReason, "UNDECLARED_MATTER_SCOPE"); assert.equal(matterCalls, 0);
});
test("matter and tool authorization failures fail closed", async () => {
  assert.equal((await engine({ authorizeMatter: async () => false }).execution.run(task())).provenance.blockedReason, "MATTER_AUTHORIZATION_DENIED");
  assert.equal((await engine({ authorizeTools: async () => false }).execution.run(task())).provenance.blockedReason, "TOOL_AUTHORIZATION_DENIED");
});
test("human approval is enforced before execution", async () => {
  let executed = false; const { execution } = engine({ agent: agent({ humanApproval: { required: true, actions: ["final-conclusion"] } }), humanGate: async () => false, execute: async () => { executed = true; } });
  assert.equal((await execution.run(task())).provenance.blockedReason, "HUMAN_APPROVAL_REQUIRED"); assert.equal(executed, false);
});
test("input and output limits are enforced", async () => {
  assert.equal((await engine({ agent: agent({ limits: { maxInputBytes: 3, maxOutputBytes: 1000, timeoutMs: 50 } }) }).execution.run(task({ input: "too long" }))).provenance.blockedReason, "INPUT_LIMIT_EXCEEDED");
  const outputLimited = engine({ agent: agent({ limits: { maxInputBytes: 100, maxOutputBytes: 3, timeoutMs: 50 } }), execute: async () => ({ status: "completed", output: "too long", provenance: { requestId: "req" } }) }).execution;
  assert.equal((await outputLimited.run(task({ requestId: "req" }))).status, "failed");
});
test("malformed provider results fail safely and are audited", async () => {
  const calls = []; const { execution } = engine({ execute: async () => ({ status: "completed", output: "missing provenance" }), audit: async (event) => calls.push(event.status) });
  assert.equal((await execution.run(task())).status, "failed"); assert.deepEqual(calls, ["failed"]);
});
test("execution timeout is converted to a bounded result", async () => {
  const { execution } = engine({ agent: agent({ limits: { maxInputBytes: 100, maxOutputBytes: 1000, timeoutMs: 5 } }), execute: () => new Promise((resolve) => setTimeout(() => resolve({ status: "completed", output: "late", provenance: { requestId: "never" } }), 30)) });
  assert.equal((await execution.run(task())).status, "timed_out");
});
test("missing execution dependencies fail closed at construction", () => { const registry = createAgentRegistry(); assert.throws(() => createAgentExecutionEngine({ registry }), /authorizeMatter dependency is required/); });
