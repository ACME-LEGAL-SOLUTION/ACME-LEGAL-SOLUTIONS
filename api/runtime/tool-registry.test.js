"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createToolRegistry, normalizeTool } = require("./tool-registry");
function tool(overrides = {}) { return { id: "legal-source-search", version: "1.0.0", purpose: "Search approved legal sources", capabilities: ["research"], matterScopes: ["assigned-matter"], dataClasses: ["legal-source"], humanApproval: { required: false, actions: [] }, limits: { timeoutMs: 1000, maxInputBytes: 10000, maxOutputBytes: 50000 }, execute: async () => ({ ok: true }), ...overrides }; }

test("tool registry registers immutable bounded tools", () => { const r = createToolRegistry(); const t = r.register(tool()); assert.equal(r.size(), 1); assert.equal(r.get("legal-source-search"), t); assert.equal(Object.isFrozen(t), true); assert.equal(r.list()[0].execute, undefined); });
test("duplicate and malformed tool definitions are rejected", () => { const r = createToolRegistry(); r.register(tool()); assert.throws(() => r.register(tool()), /already registered/); assert.throws(() => normalizeTool(tool({ id: "../admin" })), /invalid format/); assert.throws(() => normalizeTool(tool({ capabilities: [] })), /capabilities/); assert.throws(() => normalizeTool(tool({ execute: null })), /execute implementation/); });
test("undeclared authority fields cannot enter a tool definition", () => { assert.throws(() => normalizeTool(tool({ permissions: ["all"] })), /Unknown tool definition field/); });
test("registry lookup validates ids and missing tools fail closed", () => { const r = createToolRegistry(); assert.equal(r.get("missing"), null); assert.throws(() => r.get("ALL_TOOLS"), /invalid format/); assert.equal(r.has("missing"), false); });
test("tool execution limits and approval policy are mandatory", () => { assert.throws(() => normalizeTool(tool({ limits: { timeoutMs: 0, maxInputBytes: 1, maxOutputBytes: 1 } })), /timeoutMs/); assert.throws(() => normalizeTool(tool({ humanApproval: { required: "yes", actions: [] } })), /humanApproval/); });
