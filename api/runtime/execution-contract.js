"use strict";

const EXECUTION_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ALLOWED_STATUSES = new Set(["succeeded", "blocked", "partial", "failed", "cancelled", "timed_out"]);
const ALLOWED_KEYS = new Set([
  "taskId", "agentId", "agentVersion", "actorId", "matterId",
  "requestedCapabilities", "requestedTools", "dataClasses",
  "limits", "humanApproval", "provenance", "audit", "input"
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertString(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} must be a non-empty string`);
}

function assertStringArray(value, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((v) => typeof v !== "string" || v.length === 0)) {
    throw new TypeError(`${field} must be an ${allowEmpty ? "array" : "non-empty array"} of strings`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${field} must not contain duplicates`);
}

function normalizeExecutionRequest(input) {
  if (!isPlainObject(input)) throw new TypeError("Execution request must be a plain object");
  for (const key of Object.keys(input)) if (!ALLOWED_KEYS.has(key)) throw new TypeError(`Unknown execution request field: ${key}`);

  for (const field of ["taskId", "agentId", "agentVersion", "actorId", "matterId"]) assertString(input[field], field);
  assertStringArray(input.requestedCapabilities, "requestedCapabilities");
  assertStringArray(input.requestedTools, "requestedTools", { allowEmpty: true });
  assertStringArray(input.dataClasses, "dataClasses");

  if (!isPlainObject(input.limits)) throw new TypeError("limits must be an object");
  for (const key of ["maxInputBytes", "maxOutputBytes", "timeoutMs"]) {
    if (!Number.isInteger(input.limits[key]) || input.limits[key] <= 0) throw new TypeError(`limits.${key} must be a positive integer`);
  }

  if (!isPlainObject(input.humanApproval)) throw new TypeError("humanApproval must be an object");
  if (typeof input.humanApproval.required !== "boolean") throw new TypeError("humanApproval.required must be boolean");
  assertStringArray(input.humanApproval.actions, "humanApproval.actions", { allowEmpty: true });

  if (!isPlainObject(input.provenance) || typeof input.provenance.required !== "boolean") throw new TypeError("provenance.required must be boolean");
  if (!isPlainObject(input.audit) || typeof input.audit.required !== "boolean") throw new TypeError("audit.required must be boolean");
  if (!Object.prototype.hasOwnProperty.call(input, "input")) throw new TypeError("input is required");

  return Object.freeze(structuredClone(input));
}

function normalizeExecutionResult(result) {
  if (!isPlainObject(result)) throw new TypeError("Execution result must be a plain object");
  for (const key of Object.keys(result)) if (!["status", "taskId", "agentId", "output", "evidence", "uncertainty", "failure", "provenanceEventId", "auditEventId"].includes(key)) throw new TypeError(`Unknown execution result field: ${key}`);
  assertString(result.status, "status");
  if (!ALLOWED_STATUSES.has(result.status)) throw new TypeError(`Invalid execution result status: ${result.status}`);
  for (const field of ["taskId", "agentId"]) assertString(result[field], field);
  if (!Array.isArray(result.evidence)) throw new TypeError("evidence must be an array");
  if (!Array.isArray(result.uncertainty)) throw new TypeError("uncertainty must be an array");
  if (["succeeded", "partial"].includes(result.status) && !Object.prototype.hasOwnProperty.call(result, "output")) throw new TypeError("output is required for successful or partial results");
  if (["blocked", "failed", "cancelled", "timed_out"].includes(result.status) && !result.failure) throw new TypeError("failure is required for non-success results");
  return Object.freeze(structuredClone(result));
}

module.exports = { normalizeExecutionRequest, normalizeExecutionResult, EXECUTION_ID, ALLOWED_STATUSES };
