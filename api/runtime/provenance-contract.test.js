"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProvenance, createProvenanceChain } = require("./provenance-contract");

test("provenance contract normalizes a governed provenance record", () => {
  const item = createProvenance({ type: "legal_version", id: "lv1", jurisdiction: "IN", sourceId: "s1", effectiveDate: "2024-01-01" });
  assert.equal(item.type, "legal_version");
  assert.equal(item.sourceId, "s1");
  assert(Object.isFrozen(item));
});

test("provenance contract rejects invalid or jurisdiction-mixed provenance", () => {
  assert.throws(() => createProvenance({ type: "unknown", id: "x", jurisdiction: "IN" }));
  assert.throws(() => createProvenance({ type: "source", id: "x" }));
  assert.throws(() => createProvenanceChain([
    { type: "source", id: "s1", jurisdiction: "IN" },
    { type: "authority", id: "a1", jurisdiction: "HK" }
  ]));
});
