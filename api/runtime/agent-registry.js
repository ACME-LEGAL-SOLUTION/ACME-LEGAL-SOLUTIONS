"use strict";

const AGENT_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const ALLOWED_KEYS = new Set([
  "id", "version", "purpose", "inputs", "outputs", "capabilities",
  "tools", "matterScopes", "dataClasses", "humanApproval", "limits"
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertString(value, field, { pattern = null } = {}) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) throw new TypeError(`${field} has an invalid format`);
}

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new TypeError(`${field} must be a non-empty array of strings`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${field} must not contain duplicates`);
}

function normalizeDefinition(input) {
  if (!isPlainObject(input)) throw new TypeError("Agent definition must be a plain object");
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`Unknown agent definition field: ${key}`);
  }

  assertString(input.id, "id", { pattern: AGENT_ID });
  assertString(input.version, "version", { pattern: VERSION });
  assertString(input.purpose, "purpose");
  assertStringArray(input.inputs, "inputs");
  assertStringArray(input.outputs, "outputs");
  assertStringArray(input.capabilities, "capabilities");
  assertStringArray(input.tools, "tools");
  assertStringArray(input.matterScopes, "matterScopes");
  assertStringArray(input.dataClasses, "dataClasses");

  if (!isPlainObject(input.humanApproval)) throw new TypeError("humanApproval must be an object");
  if (typeof input.humanApproval.required !== "boolean") throw new TypeError("humanApproval.required must be boolean");
  if (!Array.isArray(input.humanApproval.actions) || input.humanApproval.actions.some((item) => typeof item !== "string")) {
    throw new TypeError("humanApproval.actions must be an array of strings");
  }
  if (new Set(input.humanApproval.actions).size !== input.humanApproval.actions.length) {
    throw new TypeError("humanApproval.actions must not contain duplicates");
  }

  if (!isPlainObject(input.limits)) throw new TypeError("limits must be an object");
  const limitKeys = ["maxInputBytes", "maxOutputBytes", "timeoutMs"];
  for (const key of limitKeys) {
    if (!Number.isInteger(input.limits[key]) || input.limits[key] <= 0) {
      throw new TypeError(`limits.${key} must be a positive integer`);
    }
  }

  return deepFreeze(structuredClone(input));
}

function createAgentRegistry() {
  const agents = new Map();

  return Object.freeze({
    register(definition) {
      const normalized = normalizeDefinition(definition);
      if (agents.has(normalized.id)) throw new Error(`Agent already registered: ${normalized.id}`);
      agents.set(normalized.id, normalized);
      return normalized;
    },
    get(id) {
      assertString(id, "id", { pattern: AGENT_ID });
      return agents.get(id) || null;
    },
    has(id) {
      assertString(id, "id", { pattern: AGENT_ID });
      return agents.has(id);
    },
    list() {
      return Object.freeze([...agents.values()]);
    },
    size() {
      return agents.size;
    }
  });
}

module.exports = { createAgentRegistry, normalizeDefinition, AGENT_ID, VERSION };
