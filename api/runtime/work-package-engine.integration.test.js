"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createWorkPackage, transitionWorkPackage } = require("./work-package-engine");
const { attachProvenance } = require("./work-package-provenance");
const { requireHumanGate } = require("./work-package-human-gate");
const { recordWorkPackageAction } = require("./work-package-audit");

test("end-to-end work package governance lifecycle", () => {
  let wp = createWorkPackage({ matterId:"m1", actor:{id:"system"}, issue:"Cross-border matter", facts:["f1"], assumptions:["a1"], jurisdiction:"IN", applicableDate:"2026-01-01", evidence:[{id:"e1"}], authorities:[{id:"a1"}], specialistFindings:[{role:"legal_research"}], analysis:"draft", uncertainty:["u1"], confidence:0.75, recommendedActions:[{id:"ra1"}], requiredDocuments:[{id:"d1"}], requiredTasks:[{id:"t1"}], provenance:[{sourceId:"s1"}] });
  wp = attachProvenance(wp, [{authorityId:"auth1"}]);
  wp = transitionWorkPackage(wp, "review", {id:"lawyer",human:true});
  wp = transitionWorkPackage(wp, "modified", {id:"lawyer",human:true}, {analysis:"human-modified analysis"});
  wp = transitionWorkPackage(wp, "review", {id:"lawyer",human:true});
  wp = transitionWorkPackage(wp, "approved", {id:"lawyer",human:true});
  const gate = requireHumanGate({actor:{id:"lawyer",human:true},action:"finalize"});
  wp = recordWorkPackageAction(wp, "final_action_authorized", {id:gate.actorId,human:true}, gate);
  wp = transitionWorkPackage(wp, "finalized", {id:"lawyer",human:true});
  assert.equal(wp.state, "finalized");
  assert.ok(wp.provenance.length >= 2);
  assert.ok(wp.audit.length >= 6);
});
