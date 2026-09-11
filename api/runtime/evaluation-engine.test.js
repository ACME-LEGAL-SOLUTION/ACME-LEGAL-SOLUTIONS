"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createEvaluationEngine } = require("./evaluation-engine");
test("evaluation returns a deterministic pass/fail report", async () => { const e = createEvaluationEngine({ checks: [async ({ result }) => result.ok === true, ({ result }) => result.cited === true] }); const r = await e.evaluate({ requestId: "r1", result: { ok: true, cited: false } }); assert.equal(r.passed, false); assert.equal(r.findings[0].passed, true); assert.equal(r.findings[1].passed, false); });
test("failed checks are captured without aborting evaluation", async () => { const e = createEvaluationEngine({ checks: [() => { throw new Error("citation missing"); }, () => true] }); const r = await e.evaluate({ requestId: "r1", result: {} }); assert.equal(r.passed, false); assert.equal(r.findings.length, 2); assert.match(r.findings[0].detail, /citation missing/); });
test("invalid evaluator configuration fails closed", () => { assert.throws(() => createEvaluationEngine({ checks: [null] }), /functions/); });
