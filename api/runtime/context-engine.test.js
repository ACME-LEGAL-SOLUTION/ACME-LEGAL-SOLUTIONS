"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContextEngine } = require("./context-engine");
const actor = { id: "lawyer-1", role: "lawyer", human: true };
function make(overrides = {}) { return createContextEngine({ authorize: async () => true, resolveSource: async ({ source }) => ({ id: source, content: `content:${source}`, trusted: source === "official", sourceType: source === "official" ? "authority" : "retrieved" }), ...overrides }); }
test("context is matter-bound, immutable and marks trust explicitly", async () => { const c = await make().build({ requestId: "r1", matterId: "m1", actor, dataClasses: ["matter-data"], sources: ["official", "search"] }); assert.equal(c.matterId, "m1"); assert.equal(c.sources[0].trusted, true); assert.equal(c.sources[1].trusted, false); assert.equal(Object.isFrozen(c), true); });
test("authorization denial fails closed before source resolution", async () => { let resolved = false; const e = make({ authorize: async () => false, resolveSource: async () => { resolved = true; } }); await assert.rejects(() => e.build({ requestId: "r1", matterId: "m1", actor }), /authorization denied/); assert.equal(resolved, false); });
test("malformed source records are rejected", async () => { const e = make({ resolveSource: async () => ({ id: "x" }) }); await assert.rejects(() => e.build({ requestId: "r1", matterId: "m1", actor, sources: ["x"] }), /malformed/); });
test("context size limit is enforced", async () => { const e = make({ maxBytes: 50, resolveSource: async () => ({ id: "x", content: "x".repeat(100) }) }); await assert.rejects(() => e.build({ requestId: "r1", matterId: "m1", actor, sources: ["x"] }), /byte limit/); });
test("request identity and input arrays are required", async () => { await assert.rejects(() => make().build({ matterId: "m1", actor }), /requestId/); await assert.rejects(() => make().build({ requestId: "r1", matterId: "m1", actor, sources: [null] }), /sources/); });
