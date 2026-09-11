"use strict";

const crypto = require("node:crypto");

const STATUSES = Object.freeze(["completed", "blocked", "failed", "timed_out"]);
const REQUIRED_RESULT_KEYS = new Set(["status", "output", "provenance"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertTask(task) {
  if (!isPlainObject(task)) throw new TypeError("Execution task must be a plain object");
  for (const field of ["taskId", "matterId", "agentId", "actor"]) {
    if (!task[field]) throw new TypeError(`${field} is required`);
  }
  if (!isPlainObject(task.actor) || typeof task.actor.id !== "string" || typeof task.actor.role !== "string" || typeof task.actor.human !== "boolean") {
    throw new TypeError("Authenticated actor identity is required");
  }
  if (typeof task.input !== "string" || task.input.length === 0) throw new TypeError("Execution input is required");
  return task;
}

function normalizeTools(tools) {
  if (!Array.isArray(tools)) throw new TypeError("Requested tools must be an array");
  return tools.map((tool) => {
    if (typeof tool !== "string" || tool.length === 0) throw new TypeError("Requested tools must contain non-empty strings");
    return tool;
  });
}

function validateResult(result, requestId) {
  if (!isPlainObject(result)) throw new TypeError("Agent result must be a plain object");
  for (const key of REQUIRED_RESULT_KEYS) if (!(key in result)) throw new TypeError(`Agent result field is required: ${key}`);
  if (!STATUSES.includes(result.status)) throw new TypeError(`Invalid agent result status: ${result.status}`);
  if (!isPlainObject(result.provenance)) throw new TypeError("Agent result provenance is required");
  if (typeof result.provenance.requestId !== "string" || result.provenance.requestId !== requestId) {
    throw new TypeError("Agent result provenance must bind to the execution request");
  }
  return Object.freeze({
    status: result.status,
    output: result.output ?? null,
    provenance: Object.freeze({ ...result.provenance })
  });
}

function withTimeout(promise, timeoutMs, requestId) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`Agent execution timed out: ${requestId}`);
        error.code = "AGENT_EXECUTION_TIMEOUT";
        reject(error);
      }, timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function createAgentExecutionEngine({ registry, authorizeMatter, authorizeTools, humanGate, execute, provenance, audit, clock = () => new Date().toISOString() } = {}) {
  if (!registry?.get) throw new TypeError("Agent registry is required");
  for (const [name, dependency] of Object.entries({ authorizeMatter, authorizeTools, humanGate, execute, provenance, audit })) {
    if (typeof dependency !== "function") throw new TypeError(`${name} dependency is required`);
  }

  return Object.freeze({
    async run(task = {}) {
      assertTask(task);
      const requestId = typeof task.requestId === "string" && task.requestId.length > 0 ? task.requestId : crypto.randomUUID();
      const startedAt = clock();
      const agent = registry.get(task.agentId);
      if (!agent) return blocked("AGENT_NOT_REGISTERED", requestId, startedAt, clock());

      const tools = normalizeTools(task.tools || []);
      if (task.input.length > agent.limits.maxInputBytes) return blocked("INPUT_LIMIT_EXCEEDED", requestId, startedAt, clock());
      if (tools.some((tool) => !agent.tools.includes(tool))) return blocked("UNDECLARED_TOOL", requestId, startedAt, clock());
      if (task.dataClass && !agent.dataClasses.includes(task.dataClass)) return blocked("UNDECLARED_DATA_CLASS", requestId, startedAt, clock());
      if (task.matterScope && !agent.matterScopes.includes(task.matterScope)) return blocked("UNDECLARED_MATTER_SCOPE", requestId, startedAt, clock());

      const scope = { matterId: task.matterId, actor: task.actor, matterScope: task.matterScope || null, dataClass: task.dataClass || null };
      if (!(await authorizeMatter(scope))) return blocked("MATTER_AUTHORIZATION_DENIED", requestId, startedAt, clock());
      if (!(await authorizeTools({ ...scope, agent, tools }))) return blocked("TOOL_AUTHORIZATION_DENIED", requestId, startedAt, clock());
      if (agent.humanApproval.required && !(await humanGate({ ...scope, agent, actions: agent.humanApproval.actions }))) {
        return blocked("HUMAN_APPROVAL_REQUIRED", requestId, startedAt, clock());
      }

      const input = Object.freeze({ requestId, taskId: task.taskId, matterId: task.matterId, actor: Object.freeze({ ...task.actor }), agent, input: task.input, tools: Object.freeze([...tools]), context: task.context || {} });
      try {
        const raw = await withTimeout(Promise.resolve().then(() => execute(input)), agent.limits.timeoutMs, requestId);
        const result = validateResult(raw, requestId);
        const event = Object.freeze({ requestId, taskId: task.taskId, agentId: agent.id, agentVersion: agent.version, matterId: task.matterId, status: result.status, startedAt, completedAt: clock() });
        await provenance(event, result);
        await audit(event);
        return result;
      } catch (error) {
        const status = error?.code === "AGENT_EXECUTION_TIMEOUT" ? "timed_out" : "failed";
        const event = Object.freeze({ requestId, taskId: task.taskId, agentId: agent.id, agentVersion: agent.version, matterId: task.matterId, status, startedAt, completedAt: clock(), errorCode: error?.code || "AGENT_EXECUTION_FAILED" });
        await audit(event);
        return Object.freeze({ status, output: null, provenance: Object.freeze({ requestId, agentId: agent.id, agentVersion: agent.version, recordedAt: clock() }) });
      }
    }
  });
}

function blocked(reason, requestId, startedAt, completedAt) {
  return Object.freeze({
    status: "blocked",
    output: null,
    provenance: Object.freeze({ requestId, blockedReason: reason, startedAt, completedAt })
  });
}

module.exports = { STATUSES, createAgentExecutionEngine, validateResult };
