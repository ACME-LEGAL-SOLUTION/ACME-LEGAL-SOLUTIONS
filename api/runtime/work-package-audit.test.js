"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createWorkPackage } = require("./work-package-engine");
const { recordWorkPackageAction } = require("./work-package-audit");

test("records auditable work package action", () => {
  const wp = createWorkPackage({ matterId:"m", actor:{id:"u"}, issue:"i", facts:[], jurisdiction:"IN", applicableDate:"2026-01-01", evidence:[], authorities:[], specialistFindings:[], analysis:"a", uncertainty:[], confidence:1, recommendedActions:[], requiredDocuments:[], requiredTasks:[] });
  const next = recordWorkPackageAction(wp, "reviewed", {id:"lawyer",human:true}, {note:"review complete"});
  assert.equal(next.audit.at(-1).action, "reviewed");
  assert.equal(next.audit.at(-1).actorId, "lawyer");
  assert.equal(next.version, 2);
});
