"use strict";

function isPlainObject(value) { if (!value || typeof value !== "object") return false; const p = Object.getPrototypeOf(value); return p === Object.prototype || p === null; }
function cloneFreeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; if (Array.isArray(value)) { value.forEach(cloneFreeze); return Object.freeze(value); } Object.values(value).forEach(cloneFreeze); return Object.freeze(value); }
function createContextEngine({ maxBytes = 262144, authorize, resolveSource, clock = () => new Date().toISOString() } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new TypeError("maxBytes must be positive");
  if (typeof authorize !== "function") throw new TypeError("Context authorization dependency is required");
  if (typeof resolveSource !== "function") throw new TypeError("Context source resolver dependency is required");
  return Object.freeze({
    async build({ requestId, matterId, actor, dataClasses = [], sources = [] } = {}) {
      if (!requestId || !matterId || !isPlainObject(actor) || !actor.id) throw new TypeError("requestId, matterId and authenticated actor are required");
      if (!Array.isArray(dataClasses) || dataClasses.some((v) => typeof v !== "string" || !v)) throw new TypeError("dataClasses must be strings");
      if (!Array.isArray(sources) || sources.some((v) => typeof v !== "string" || !v)) throw new TypeError("sources must be strings");
      if (!(await authorize({ requestId, matterId, actor, dataClasses, sources }))) throw new Error("Context authorization denied");
      const resolved = [];
      for (const source of sources) {
        const item = await resolveSource({ matterId, actor, source, dataClasses });
        if (!isPlainObject(item) || typeof item.id !== "string" || typeof item.content !== "string") throw new TypeError("Resolved context source is malformed");
        resolved.push({ id: item.id, content: item.content, trusted: item.trusted === true, sourceType: item.sourceType || "unknown" });
      }
      const context = { requestId, matterId, actor: { id: actor.id, role: actor.role || null, human: actor.human === true }, dataClasses: [...dataClasses], sources: resolved, builtAt: clock() };
      const bytes = Buffer.byteLength(JSON.stringify(context), "utf8");
      if (bytes > maxBytes) throw new Error("Context exceeds configured byte limit");
      return cloneFreeze(context);
    }
  });
}
module.exports = { createContextEngine };
