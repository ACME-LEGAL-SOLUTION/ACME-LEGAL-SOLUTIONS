"use strict";
const crypto = require("node:crypto");
function plain(v) { if (!v || typeof v !== "object") return false; const p = Object.getPrototypeOf(v); return p === Object.prototype || p === null; }
function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (plain(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`; return JSON.stringify(value); }
function createProvenanceEngine({ clock = () => new Date().toISOString(), hash = (v) => crypto.createHash("sha256").update(v, "utf8").digest("hex") } = {}) {
  return Object.freeze({
    record({ requestId, matterId, agentId, agentVersion, sources = [], inputs = [], outputs = [], confidence = null, conflicts = [] } = {}) {
      if (![requestId, matterId, agentId, agentVersion].every((v) => typeof v === "string" && v)) throw new TypeError("Provenance identity is required");
      if (![sources, inputs, outputs, conflicts].every(Array.isArray)) throw new TypeError("Provenance collections must be arrays");
      const event = { requestId, matterId, agentId, agentVersion, sources: [...sources], inputs: [...inputs], outputs: [...outputs], confidence, conflicts: [...conflicts], recordedAt: clock() };
      return Object.freeze({ ...event, fingerprint: hash(stable(event)) });
    }
  });
}
module.exports = { createProvenanceEngine };
