"use strict";

const crypto = require("node:crypto");
const MODULE_ENV = "ACME_AI_PROVIDER_MODULE";
const DEFAULT_MAX_TOOL_COUNT = 16;
const DEFAULT_MAX_TASK_LENGTH = 12000;
const DEFAULT_MAX_CONTEXT_BYTES = 262144;
const DEFAULT_TIMEOUT_MS = 30000;

function createProductionAIProvider({ env = process.env, moduleLoader = require } = {}) {
  const modulePath = env[MODULE_ENV];
  if (!modulePath) throw new Error(`Production AI provider adapter is not configured (${MODULE_ENV})`);
  const loaded = moduleLoader(modulePath); const provider = loaded?.default || loaded;
  if (typeof provider?.execute !== "function") throw new TypeError("Production AI provider must implement execute");
  if (!provider.id || typeof provider.id !== "string") throw new TypeError("Production AI provider id is required");
  const allowedModels = new Set(Array.isArray(provider.allowedModels) ? provider.allowedModels : []);
  const allowedTools = new Set(Array.isArray(provider.allowedTools) ? provider.allowedTools : []);
  const maxToolCount = Number.isInteger(provider.maxToolCount) ? provider.maxToolCount : DEFAULT_MAX_TOOL_COUNT;
  const maxTaskLength = Number.isInteger(provider.maxTaskLength) ? provider.maxTaskLength : DEFAULT_MAX_TASK_LENGTH;
  const maxContextBytes = Number.isInteger(provider.maxContextBytes) ? provider.maxContextBytes : DEFAULT_MAX_CONTEXT_BYTES;
  const timeoutMs = Number.isInteger(provider.timeoutMs) ? provider.timeoutMs : DEFAULT_TIMEOUT_MS;
  return Object.freeze({
    id: provider.id,
    capabilities: Object.freeze(Array.isArray(provider.capabilities) ? [...provider.capabilities] : []),
    async execute(input = {}) {
      validateInput(input, { allowedModels, allowedTools, maxToolCount, maxTaskLength, maxContextBytes });
      const requestId = input.requestId || crypto.randomUUID();
      const call = Promise.resolve().then(() => provider.execute(Object.freeze({ matterId: input.matterId, actor: Object.freeze({ id: input.actor.id, role: input.actor.role, human: input.actor.human }), task: input.task, context: input.context || {}, tools: Object.freeze((input.tools || []).map((tool) => Object.freeze({ ...tool }))), model: input.model || null, requestId })));
      return withTimeout(call, timeoutMs, requestId);
    }
  });
}
function validateInput(input, policy) {
  if (!input?.matterId) throw new Error("Matter scope is required");
  if (!input.actor?.id) throw new Error("Authenticated actor is required");
  if (!input.task || input.task.length > policy.maxTaskLength) throw new Error("AI task exceeds configured limit");
  const tools = Array.isArray(input.tools) ? input.tools : [];
  if (tools.length > policy.maxToolCount) throw new Error("AI tool count exceeds configured limit");
  for (const tool of tools) { const name = typeof tool === "string" ? tool : tool?.name || tool?.action || tool?.id; if (!name || !policy.allowedTools.has(name)) throw new Error(`AI tool is not permitted: ${name || "unknown"}`); }
  if (input.model && policy.allowedModels.size && !policy.allowedModels.has(input.model)) throw new Error(`AI model is not permitted: ${input.model}`);
  const contextSize = Buffer.byteLength(JSON.stringify(input.context || {}), "utf8");
  if (contextSize > policy.maxContextBytes) throw new Error("AI context exceeds configured limit");
}
function withTimeout(promise, timeoutMs, requestId) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error(`AI provider timeout: ${requestId}`); error.code = "AI_PROVIDER_TIMEOUT"; reject(error); }, timeoutMs); })]).finally(() => clearTimeout(timer));
}
module.exports = { MODULE_ENV, createProductionAIProvider, validateInput };
