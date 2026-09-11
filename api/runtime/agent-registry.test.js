"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createAgentRegistry, normalizeDefinition } = require("./agent-registry");

function validAgent(overrides = {}) {
  return {
    id: "research",
    version: "1.0.0",
    purpose: "Perform bounded legal research tasks",
    inputs: ["task"],
    outputs: ["research-result"],
    capabilities: ["legal-research"],
    tools: ["legal-source-search"],
    matterScopes: ["assigned-matter"],
    dataClasses: ["legal-source", "matter-data"],
    humanApproval: { required: true, actions: ["final-legal-conclusion"] },
    limits: { maxInputBytes: 65536, maxOutputBytes: 131072, timeoutMs: 30000 },
    ...overrides
  };
}

test("agent registry registers and returns an immutable definition", () => {
  const registry = createAgentRegistry();
  const registered = registry.register(validAgent());
  assert.equal(registry.size(), 1);
  assert.equal(registry.has("research"), true);
  assert.equal(registry.get("research").version, "1.0.0");
  assert.equal(Object.isFrozen(registered), true);
  assert.equal(Object.isFrozen(registered.humanApproval), true);
  assert.throws(() => { registered.tools.push("admin-tool"); }, TypeError);
});

test("duplicate agent ids are rejected even when versions differ", () => {
  const registry = createAgentRegistry();
  registry.register(validAgent());
  assert.throws(() => registry.register(validAgent({ version: "1.1.0" })), /already registered/);
});

test("unknown fields are rejected to prevent undeclared authority", () => {
  assert.throws(() => normalizeDefinition(validAgent({ permissions: ["everything"] })), /Unknown agent definition field/);
});

test("malformed identities and versions are rejected", () => {
  assert.throws(() => normalizeDefinition(validAgent({ id: "../admin" })), /invalid format/);
  assert.throws(() => normalizeDefinition(validAgent({ version: "latest" })), /invalid format/);
});

test("empty capabilities, tools, scopes and data classes are rejected", () => {
  for (const field of ["capabilities", "tools", "matterScopes", "dataClasses"]) {
    assert.throws(() => normalizeDefinition(validAgent({ [field]: [] })), new RegExp(`${field} must be`));
  }
});

test("human approval and execution limits are mandatory and typed", () => {
  assert.throws(() => normalizeDefinition(validAgent({ humanApproval: { required: "yes", actions: [] } })), /required must be boolean/);
  assert.throws(() => normalizeDefinition(validAgent({ limits: { maxInputBytes: 0, maxOutputBytes: 1, timeoutMs: 1 } })), /maxInputBytes/);
});

test("registry list is immutable and missing agents return null", () => {
  const registry = createAgentRegistry();
  registry.register(validAgent());
  const list = registry.list();
  assert.equal(list.length, 1);
  assert.equal(registry.get("missing"), null);
  assert.throws(() => list.push(validAgent({ id: "other" })), TypeError);
});
