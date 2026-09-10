"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createWorkPackage, transitionWorkPackage } = require("./work-package-engine");

function base() {
  return { matterId: "m1", actor: { id: "system", human: false }, issue: "Issue", facts: ["fact"], jurisdiction: "IN", applicableDate: "2026-01-01", evidence: [{ id: "e1" }], authorities: [{ id: "a1" }], specialistFindings: [{ role: "legal_research", finding: "finding" }], analysis: "analysis", uncertainty: ["unknown"], confidence: 0.8, recommendedActions: [{ id: "act1" }], requiredDocuments: [{ id: "doc1" }], requiredTasks: [{ id: "task1" }], provenance: [{ sourceId: "s1" }] };
}

test("work package creates complete governed structure", () => {
  const wp = createWorkPackage(base());
  assert.equal(wp.state, "draft");
  assert.equal(wp.version, 1);
  assert.equal(wp.matterId, "m1");
  assert.equal(wp.audit[0].action, "created");
});

test("work package requires mandatory human approval and finalization", () => {
  const wp = createWorkPackage(base());
  const reviewed = transitionWorkPackage(wp, "review", { id: "ai", human: false });
  assert.throws(() => transitionWorkPackage(reviewed, "approved", { id: "ai", human: false }), /human action/);
  const approved = transitionWorkPackage(reviewed, "approved", { id: "lawyer", human: true });
  assert.equal(approved.state, "approved");
  assert.throws(() => transitionWorkPackage(approved, "finalized", { id: "ai", human: false }), /human action/);
  const finalized = transitionWorkPackage(approved, "finalized", { id: "lawyer", human: true });
  assert.equal(finalized.state, "finalized");
});

test("work package modification requires explicit modification details", () => {
  const wp = transitionWorkPackage(createWorkPackage(base()), "review", { id: "lawyer", human: true });
  assert.throws(() => transitionWorkPackage(wp, "modified", { id: "lawyer", human: true }), /Modification details/);
  const modified = transitionWorkPackage(wp, "modified", { id: "lawyer", human: true }, { analysis: "modified analysis" });
  assert.equal(modified.state, "modified");
  assert.equal(modified.analysis, "modified analysis");
});
