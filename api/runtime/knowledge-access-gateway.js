"use strict";

const { createProvenance, createProvenanceChain } = require("./provenance-contract");

function createKnowledgeAccessGateway({ sources, legalVersions, authorities, evidence } = {}) {
  const required = { sources, legalVersions, authorities, evidence };
  for (const [name, service] of Object.entries(required)) {
    if (!service) throw new Error(`${name} service is required`);
  }

  async function retrieve({ jurisdiction, date = null, actor, sourceIds = [], legalInstrumentIds = [], authorityIds = [], evidenceIds = [] } = {}) {
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!jurisdiction) throw new Error("Jurisdiction is required");
    const result = { sources: [], legalVersions: [], authorities: [], evidence: [], provenance: [] };

    if (sourceIds.length) {
      const all = await Promise.all(sourceIds.map((id) => sources.getById ? sources.getById(id) : null));
      result.sources = all.filter(Boolean).filter((item) => item.jurisdiction === jurisdiction);
    } else if (sources.listByJurisdiction) {
      result.sources = await sources.listByJurisdiction(jurisdiction);
    }

    if (legalInstrumentIds.length && legalVersions.effectiveAt) {
      const effectiveDate = date || new Date().toISOString().slice(0, 10);
      result.legalVersions = (await Promise.all(legalInstrumentIds.map((id) => legalVersions.effectiveAt({ legalInstrumentId: id, jurisdiction, date: effectiveDate })))).filter(Boolean);
    }

    if (authorityIds.length && authorities.getById) {
      result.authorities = (await Promise.all(authorityIds.map((id) => authorities.getById(id)))).filter(Boolean).filter((item) => item.jurisdiction === jurisdiction);
    } else if (authorities.listByJurisdiction) {
      result.authorities = await authorities.listByJurisdiction(jurisdiction);
    }

    if (evidenceIds.length && evidence.getEvidence) {
      result.evidence = (await Promise.all(evidenceIds.map((id) => evidence.getEvidence(id, actor)))).filter(Boolean);
    }

    for (const item of result.sources) result.provenance.push(createProvenance({ type: "source", id: item.id, jurisdiction, locator: item.locator }));
    for (const item of result.legalVersions) result.provenance.push(createProvenance({ type: "legal_version", id: item.id, jurisdiction, sourceId: item.sourceId, effectiveDate: item.validFrom }));
    for (const item of result.authorities) result.provenance.push(createProvenance({ type: "authority", id: item.id, jurisdiction, locator: item.locator }));
    for (const item of result.evidence) result.provenance.push(createProvenance({ type: "evidence", id: item.id, jurisdiction, evidenceId: item.id, sourceId: item.provenance?.sourceId || null }));
    result.provenance = createProvenanceChain(result.provenance);
    return Object.freeze(result);
  }

  return Object.freeze({ retrieve });
}

module.exports = { createKnowledgeAccessGateway };
