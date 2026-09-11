"use strict";

const TOOL_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set(["id", "version", "purpose", "capabilities", "matterScopes", "dataClasses", "humanApproval", "limits", "execute"]);
function plain(value) { if (!value || typeof value !== "object") return false; const p = Object.getPrototypeOf(value); return p === Object.prototype || p === null; }
function strings(value, field, allowEmpty = false) { if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((v) => typeof v !== "string" || !v)) throw new TypeError(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array of strings`); if (new Set(value).size !== value.length) throw new TypeError(`${field} must not contain duplicates`); }
function freeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; for (const v of Object.values(value)) freeze(v); return Object.freeze(value); }
function normalizeTool(input) {
  if (!plain(input)) throw new TypeError("Tool definition must be a plain object");
  for (const key of Object.keys(input)) if (!ALLOWED_KEYS.has(key)) throw new TypeError(`Unknown tool definition field: ${key}`);
  if (typeof input.id !== "string" || !TOOL_ID.test(input.id)) throw new TypeError("id has an invalid format");
  if (typeof input.version !== "string" || !/^\d+\.\d+\.\d+$/.test(input.version)) throw new TypeError("version has an invalid format");
  if (typeof input.purpose !== "string" || !input.purpose) throw new TypeError("purpose is required");
  strings(input.capabilities, "capabilities"); strings(input.matterScopes, "matterScopes"); strings(input.dataClasses, "dataClasses");
  if (!plain(input.humanApproval) || typeof input.humanApproval.required !== "boolean" || !Array.isArray(input.humanApproval.actions)) throw new TypeError("humanApproval is invalid");
  strings(input.humanApproval.actions, "humanApproval.actions", true);
  if (!plain(input.limits)) throw new TypeError("limits is required");
  for (const field of ["timeoutMs", "maxInputBytes", "maxOutputBytes"]) if (!Number.isInteger(input.limits[field]) || input.limits[field] <= 0) throw new TypeError(`limits.${field} must be positive`);
  if (typeof input.execute !== "function") throw new TypeError("execute implementation is required");
  return freeze({ ...input, humanApproval: { ...input.humanApproval, actions: [...input.humanApproval.actions] }, capabilities: [...input.capabilities], matterScopes: [...input.matterScopes], dataClasses: [...input.dataClasses], limits: { ...input.limits } });
}
function createToolRegistry() {
  const tools = new Map();
  return Object.freeze({
    register(definition) { const tool = normalizeTool(definition); if (tools.has(tool.id)) throw new Error(`Tool already registered: ${tool.id}`); tools.set(tool.id, tool); return tool; },
    get(id) { if (typeof id !== "string" || !TOOL_ID.test(id)) throw new TypeError("id has an invalid format"); return tools.get(id) || null; },
    has(id) { if (typeof id !== "string" || !TOOL_ID.test(id)) throw new TypeError("id has an invalid format"); return tools.has(id); },
    list() { return Object.freeze([...tools.values()].map(({ execute, ...publicDefinition }) => publicDefinition)); },
    size() { return tools.size; }
  });
}
module.exports = { TOOL_ID, normalizeTool, createToolRegistry };
