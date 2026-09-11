"use strict";

const { normalizeExecutionRequest, normalizeExecutionResult } = require("./execution-contract");

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

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
      return governBlocked(rawRequest, "invalid_execution_request", error.message);
    }

    if (byteLength(request.input) > request.limits.maxInputBytes) return governBlocked(request, "input_limit_exceeded", "Input exceeds execution limit");

    const agent = registry.get(request.agentId);
    if (!agent) return governBlocked(request, "agent_not_registered", `Agent not registered: ${request.agentId}`);
    if (agent.version !== request.agentVersion) return governBlocked(request, "agent_version_mismatch", "Requested agent version is not registered");
    if (request.limits.maxInputBytes > agent.limits.maxInputBytes || request.limits.maxOutputBytes > agent.limits.maxOutputBytes || request.limits.timeoutMs > agent.limits.timeoutMs) {
      return governBlocked(request, "execution_limit_exceeded", "Requested execution limits exceed the registered agent limits");
    }

    const start = clock();
    let authorization;
    try {
      authorization = await authorize({ request, agent });
    } catch (error) {
      return governBlocked(request, "authorization_failed", error.message);
    }
    if (authorization !== true && authorization?.allowed !== true) return governBlocked(request, "authorization_denied", authorization?.reason || "Execution is not authorized");

    if (request.requestedCapabilities.some((c) => !agent.capabilities.includes(c))) return governBlocked(request, "capability_not_declared", "Requested capability is not declared by the agent");
    if (request.requestedTools.some((t) => !agent.tools.includes(t))) return governBlocked(request, "tool_not_declared", "Requested tool is not declared by the agent");
    if (request.dataClasses.some((d) => !agent.dataClasses.includes(d))) return governBlocked(request, "data_class_not_allowed", "Requested data class is not allowed by the agent");
    if (request.humanApproval.required && !agent.humanApproval.required) return governBlocked(request, "human_gate_mismatch", "Execution request requires human approval not declared by the agent");
    if (request.humanApproval.required && authorization.humanApprovalGranted !== true) return governBlocked(request, "human_approval_required", "Required human approval is not present");
    if (request.provenance.required !== true || request.audit.required !== true) return governBlocked(request, "governance_bypass", "Provenance and audit are mandatory execution controls");

    const controller = new AbortController();
    let timer;
    try {
      const execution = Promise.resolve().then(() => execute({ request, agent, signal: controller.signal }));
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Object.assign(new Error("Execution timed out"), { code: "execution_timeout" }));
        }, request.limits.timeoutMs);
      });
      const rawResult = await Promise.race([execution, timeout]);

      let result;
      try {
        result = normalizeExecutionResult({ ...rawResult, taskId: request.taskId, agentId: request.agentId });
      } catch (error) {
        return finalize(request, {
          status: "failed",
          taskId: request.taskId,
          agentId: request.agentId,
          evidence: [],
          uncertainty: [],
          failure: { code: "malformed_result", message: error.message }
        }, start);
      }

      if (result.output !== undefined && byteLength(result.output) > request.limits.maxOutputBytes) {
        return finalize(request, {
          status: "failed",
          taskId: request.taskId,
          agentId: request.agentId,
          evidence: result.evidence,
          uncertainty: result.uncertainty,
          failure: { code: "output_limit_exceeded", message: "Output exceeds execution limit" }
        }, start);
      }
      return finalize(request, result, start);
    } catch (error) {
      const status = error.code === "execution_timeout" ? "timed_out" : "failed";
      return finalize(request, {
        status,
        taskId: request.taskId,
        agentId: request.agentId,
        evidence: [],
        uncertainty: [],
        failure: { code: error.code || "execution_error", message: error.message }
      }, start);
    } finally {
      clearTimeout(timer);
    }
  }

  async function governBlocked(rawRequest, code, message) {
    const request = rawRequest && typeof rawRequest === "object" && typeof rawRequest.taskId === "string" && typeof rawRequest.agentId === "string"
      ? rawRequest
      : { taskId: "unknown-task", agentId: "unknown-agent" };
    return finalize(request, {
      taskId: request.taskId,
      agentId: request.agentId,
      status: "blocked",
      evidence: [],
      uncertainty: [],
      failure: { code, message }
    }, clock());
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
        evidence: result.evidence || [],
        uncertainty: result.uncertainty || [],
        failure: { code: "governance_recording_failed", message: error.message }
      });
    }
  }

  return Object.freeze({ run });
}

module.exports = { createExecutionEngine, byteLength };
