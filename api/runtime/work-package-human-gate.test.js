"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { requireHumanGate } = require("./work-package-human-gate");

test("rejects non-human final action", () => assert.throws(() => requireHumanGate({ actor:{id:"ai",human:false}, action:"finalize" }), /human action/));
test("accepts explicit human final action", () => assert.equal(requireHumanGate({ actor:{id:"lawyer",human:true}, action:"finalize" }).actorId, "lawyer"));
