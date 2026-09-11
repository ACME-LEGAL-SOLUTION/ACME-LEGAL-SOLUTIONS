"use strict";
function createEvaluationEngine({ checks = [] } = {}) {
  if (!Array.isArray(checks) || checks.some((c) => typeof c !== "function")) throw new TypeError("Evaluation checks must be functions");
  return Object.freeze({
    async evaluate({ requestId, result, context = {} } = {}) {
      if (!requestId || !result) throw new TypeError("requestId and result are required");
      const findings = [];
      for (let i = 0; i < checks.length; i += 1) {
        try { const verdict = await checks[i]({ requestId, result, context }); findings.push(Object.freeze({ check: i, passed: verdict === true, detail: verdict === true ? null : String(verdict || "failed") })); }
        catch (error) { findings.push(Object.freeze({ check: i, passed: false, detail: error?.message || "evaluation check failed" })); }
      }
      return Object.freeze({ requestId, passed: findings.every((f) => f.passed), findings: Object.freeze(findings) });
    }
  });
}
module.exports = { createEvaluationEngine };
