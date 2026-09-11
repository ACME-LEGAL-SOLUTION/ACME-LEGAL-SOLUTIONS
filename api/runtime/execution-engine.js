"use strict";

const { normalizeExecutionRequest, normalizeExecutionResult } = require("./execution-contract");

function createExecutionEngine({ registry, authorize, execute, recordProvenance, recordAudit, clock = () => Date.now() } = {}) {
  if (!registry?.get) throw new Error("Agent registry is required");
  if (typeof authorize !== "function") throw new Error("Authorization function is required");
  if (typeof execute !== "function") throw new Error("Agent executor is required");
  if (typeof recordProvenance !== "function") throw new Error("Provenance recorder is required");
  if (typeof recordAudit !== "function") throw new Error("Audit recorder is required");

  async function run(rawRequest) {
    let request;
    try {
      request = normalizeExecutionRequest(rawRequest);
    } catch (error) {
      return blockedResult(rawRequest, "invalid_execution_request", error.message);
    }

    const agent = registry.get(request.agentId);
    if (!agent) return blockedResult(request, "agent_not_registered", `Agent not registered: ${request.agentId}`);
    if (agent.version !== request.agentVersion) return blockedResult(request, "agent_version_mismatch", "Requested agent version is not registered");

    const start = clock();
    let authorization;
    try {
      authorization = await authorize({ request, agent });
    } catch (error) {
      return blockedResult(request, "authorization_failed", error.message);
    }
    if (authorization !== true && authorization?.allowed !== true) {
      return blockedResult(request, "authorization_denied", authorization?.reason || "Execution is not authorized");
    }

    if (request.requestedCapabilities.some((c) => !agent.capabilities.includes(c))) return blockedResult(request, "capability_not_declared", "Requested capability is not declared by the agent");
    if (request.requestedTools.some((t) => !agent.tools.includes(t))) return blockedResult(request, "tool_not_declared", "Requested tool is not declared by the agent");
    if (request.dataClasses.some((d) => !agent.dataClasses.includes(d))) return blockedResult(request, "data_class_not_allowed", "Requested data class is not allowed by the agent");
    if (request.humanApproval.required && !agent.humanApproval.required) return blockedResult(request, "human_gate_mismatch", "Execution request requires human approval not declared by the agent");
    if (request.provenance.required === false || request.audit.required === false) return blockedResult(request, "governance_bypass", "Provenance and audit are mandatory execution controls");

    let rawResult;
    try {
      rawResult = await execute({ request, agent, signal: undefined });
    } catch (error) {
      return finalize(request, { status: "failed", taskId: request.taskId, agentId: request.agentId, evidence: [], uncertainty: [], failure: { code: "execution_error", message: error.message } }, start);
    }

    let result;
    try {
      result = normalizeExecutionResult({ ...rawResult, taskId: request.taskId, agentId: request.agentId });
    } catch (error) {
      return finalize(request, { status: "failed", taskId: request.taskId, agentId: request.agentId, evidence: [], uncertainty: [], failure: { code: "malformed_result", message: error.message } }, start);
    }

    return finalize(request, result, start);
  }

  async function finalize(request, result, startedAt) {
    const event = {
      taskId: request.taskId,
      agentId: request.agentId,
      status: result.status,
      startedAt,
      completedAt: clock()
    };
    try {
      const provenanceEventId = await recordProvenance({ request, result, event });
      const auditEventId = await recordAudit({ request, result, event });
      return Object.freeze({ ...result, provenanceEventId, auditEventId });
    } catch (error) {
      return Object.freeze({
        taskId: request.taskId,
        agentId: request.agentId,
        status: "failed",
        output: undefined,
        evidence: result.evidence || [],
        uncertainty: result.uncertainty || [],
        failure: { code: "governance_recording_failed", message: error.message }
      });
    }
  }

  return Object.freeze({ run });
}

function blockedResult(request, code, message) {
  return Object.freeze({
    taskId: request?.taskId || "unknown-task",
    agentId: request?.agentId || "unknown-agent",
    status: "blocked",
    evidence: [],
    uncertainty: [],
    failure: { code, message }
  });
}

module.exports = { createExecutionEngine };
