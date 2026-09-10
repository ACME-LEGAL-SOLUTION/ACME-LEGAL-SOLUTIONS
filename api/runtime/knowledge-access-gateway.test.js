"use strict";

const assert = require("node:assert/strict");
const { createKnowledgeAccessGateway } = require("./knowledge-access-gateway");

describe("knowledge access gateway", () => {
  it("retrieves jurisdiction-scoped knowledge with provenance", async () => {
    const gateway = createKnowledgeAccessGateway({
      sources: { listByJurisdiction: async () => [{ id: "s1", jurisdiction: "IN", locator: "official" }] },
      legalVersions: { effectiveAt: async () => ({ id: "lv1", sourceId: "s1", validFrom: "2024-01-01" }) },
      authorities: { listByJurisdiction: async () => [{ id: "a1", jurisdiction: "IN", locator: "court" }] },
      evidence: { getEvidence: async () => ({ id: "e1", provenance: { sourceId: "s1" } }) }
    });
    const result = await gateway.retrieve({ jurisdiction: "IN", legalInstrumentIds: ["i1"], evidenceIds: ["e1"], actor: { id: "u1" } });
    assert.equal(result.sources.length, 1);
    assert.equal(result.legalVersions.length, 1);
    assert.equal(result.authorities.length, 1);
    assert.equal(result.evidence.length, 1);
    assert.equal(result.provenance.length, 4);
  });

  it("requires an authenticated actor and jurisdiction", async () => {
    const gateway = createKnowledgeAccessGateway({ sources: {}, legalVersions: {}, authorities: {}, evidence: {} });
    await assert.rejects(() => gateway.retrieve({ jurisdiction: "IN" }), /Authenticated actor/);
    await assert.rejects(() => gateway.retrieve({ actor: { id: "u1" } }), /Jurisdiction/);
  });
});
