"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createWorkPackage, transitionWorkPackage } = require("./work-package-engine");

const required = { matterId:"m", actor:{id:"ai"}, issue:"i", facts:[], jurisdiction:"IN", applicableDate:"2026-01-01", evidence:[], authorities:[], specialistFindings:[], analysis:"a", uncertainty:[], confidence:0.5, recommendedActions:[], requiredDocuments:[], requiredTasks:[] };

test("rejects incomplete work packages", () => assert.throws(() => createWorkPackage({ ...required, analysis: undefined }), /requires analysis/));
test("rejects invalid confidence", () => assert.throws(() => createWorkPackage({ ...required, confidence: 2 }), /confidence/));
test("prevents skipping review before approval", () => {
  const wp = createWorkPackage(required);
  assert.throws(() => transitionWorkPackage(wp, "approved", {id:"lawyer",human:true}), /Invalid work package transition/);
});
