"use strict";

function createAgentOrchestrationEngine({ contextEngine, agentExecutionEngine, evaluationEngine, audit = async () => {}, clock = () => new Date().toISOString() } = {}) {
  if (!contextEngine?.build) throw new TypeError("contextEngine dependency is required");
  if (!agentExecutionEngine?.run) throw new TypeError("agentExecutionEngine dependency is required");
  if (!evaluationEngine?.evaluate) throw new TypeError("evaluationEngine dependency is required");
  if (typeof audit !== "function") throw new TypeError("audit dependency is required");

  return Object.freeze({
    async run({ requestId, task, sources = [] } = {}) {
      if (!requestId || !task) throw new TypeError("requestId and task are required");
      const startedAt = clock();
      try {
        const context = await contextEngine.build({ ...task, requestId, sources });
        const result = await agentExecutionEngine.run({ ...task, requestId, context });
        const evaluation = await evaluationEngine.evaluate({ requestId, result, context });
        const status = evaluation.passed ? result.status : "failed";
        const completedAt = clock();
        const outcome = Object.freeze({ requestId, status, result, evaluation, startedAt, completedAt });
        await audit(Object.freeze({ requestId, taskId: task.taskId, matterId: task.matterId, status, evaluationPassed: evaluation.passed, startedAt, completedAt }));
        return outcome;
      } catch (error) {
        const completedAt = clock();
        const failure = Object.freeze({ requestId, status: "failed", error: error?.message || "orchestration failed", startedAt, completedAt });
        await audit(Object.freeze({ requestId, taskId: task.taskId, matterId: task.matterId, status: "failed", evaluationPassed: false, startedAt, completedAt, error: failure.error }));
        return failure;
      }
    }
  });
}

module.exports = { createAgentOrchestrationEngine };
