"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createAskAcmeClassifier } = require("./ask-acme-classifier");

test("classifies jurisdiction and matter type without inventing an authority", async () => {
  const classifier = createAskAcmeClassifier();
  const result = await classifier.classify({ question: "A cheque dishonour matter in India involving a company" });
  assert.equal(result.jurisdiction, "IN");
  assert.equal(result.matterType, "commercial");
  assert.equal(result.legalInstrument, null);
  assert.equal(result.requiresClarification, true);
});

test("uses source-backed resolvers for court and instrument selection", async () => {
  const classifier = createAskAcmeClassifier({
    resolveAuthority: async () => ({ id: "court-1", authorityType: "appellate_court" }),
    resolveInstrument: async () => ({ id: "instrument-1", sectionOrRule: "Section 138" })
  });
  const result = await classifier.classify({ question: "Cheque dishonour under Section 138 in India", stateOrTerritory: "MH" });
  assert.equal(result.jurisdiction, "IN");
  assert.equal(result.legalInstrument, "instrument-1");
  assert.equal(result.sectionOrRule, "Section 138");
  assert.equal(result.courtOrForum, "court-1");
  assert.equal(result.requiresClarification, false);
});
