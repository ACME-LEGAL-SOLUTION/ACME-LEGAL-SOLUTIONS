"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProvenanceEngine } = require("./provenance-engine");
test("provenance binds identity, evidence and a deterministic fingerprint", () => { const p = createProvenanceEngine({ clock: () => "2026-09-12T00:00:00Z" }); const a = p.record({ requestId: "r1", matterId: "m1", agentId: "research", agentVersion: "1.0.0", sources: ["s1"], inputs: ["i1"], outputs: ["o1"], confidence: 0.8 }); const b = p.record({ requestId: "r1", matterId: "m1", agentId: "research", agentVersion: "1.0.0", sources: ["s1"], inputs: ["i1"], outputs: ["o1"], confidence: 0.8 }); assert.equal(a.fingerprint, b.fingerprint); assert.equal(a.matterId, "m1"); assert.equal(Object.isFrozen(a), true); });
test("missing identity and malformed collections fail closed", () => { const p = createProvenanceEngine(); assert.throws(() => p.record({ matterId: "m1" }), /identity/); assert.throws(() => p.record({ requestId: "r", matterId: "m", agentId: "a", agentVersion: "1.0.0", sources: null }), /collections/); });
