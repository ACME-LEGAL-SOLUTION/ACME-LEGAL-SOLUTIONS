"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createWorkPackage } = require("./work-package-engine");
const { attachProvenance } = require("./work-package-provenance");

test("attaches provenance without replacing the existing chain", () => {
  const wp = createWorkPackage({ matterId:"m", actor:{id:"u"}, issue:"i", facts:[], jurisdiction:"IN", applicableDate:"2026-01-01", evidence:[], authorities:[], specialistFindings:[], analysis:"a", uncertainty:[], confidence:1, recommendedActions:[], requiredDocuments:[], requiredTasks:[], provenance:[{sourceId:"s1"}] });
  const next = attachProvenance(wp, [{authorityId:"a1"}]);
  assert.deepEqual(next.provenance, [{sourceId:"s1"},{authorityId:"a1"}]);
  assert.equal(next.version, 2);
});
