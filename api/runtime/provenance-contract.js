"use strict";

const PROVENANCE_TYPES = Object.freeze([
  "source",
  "legal_version",
  "authority",
  "evidence"
]);

function createProvenance(input = {}) {
  if (!input || typeof input !== "object") throw new TypeError("Provenance must be an object");
  const type = input.type;
  if (!PROVENANCE_TYPES.includes(type)) throw new Error(`Invalid provenance type: ${type}`);
  if (!input.id) throw new Error("Provenance id is required");
  if (!input.jurisdiction) throw new Error("Provenance jurisdiction is required");
  return Object.freeze({
    type,
    id: String(input.id),
    jurisdiction: String(input.jurisdiction),
    sourceId: input.sourceId ? String(input.sourceId) : null,
    legalVersionId: input.legalVersionId ? String(input.legalVersionId) : null,
    authorityId: input.authorityId ? String(input.authorityId) : null,
    evidenceId: input.evidenceId ? String(input.evidenceId) : null,
    effectiveDate: input.effectiveDate || null,
    locator: input.locator || null
  });
}

function createProvenanceChain(items = []) {
  if (!Array.isArray(items)) throw new TypeError("Provenance chain must be an array");
  const chain = items.map(createProvenance);
  const jurisdictions = new Set(chain.map((item) => item.jurisdiction));
  if (jurisdictions.size > 1) throw new Error("Provenance chain cannot mix jurisdictions");
  return Object.freeze(chain);
}

module.exports = { PROVENANCE_TYPES, createProvenance, createProvenanceChain };
