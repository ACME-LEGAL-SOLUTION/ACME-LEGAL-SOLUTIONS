"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { classifyQuery, scoreRecord, searchIndiaCode } = require("./free-source-retrieval");

test("classifies an Indian cheque dishonour query", () => {
  const result = classifyQuery("Cheque dishonour matter against a company in Mumbai under Section 138");
  assert.equal(result.jurisdiction, "IN");
  assert.equal(result.state, "Maharashtra");
  assert.equal(result.matterType, "cheque dishonour");
  assert.equal(result.act, "Negotiable Instruments Act, 1881");
  assert.equal(result.section, "138");
});

test("scores records deterministically", () => {
  assert.equal(scoreRecord({ title: "Negotiable Instruments Act section 138" }, "section 138 cheque dishonour"), 3);
  assert.equal(scoreRecord({ title: "Companies Act" }, "section 138 cheque dishonour"), 0);
});

test("retrieves and adds provenance from an India Code compatible response", async () => {
  const result = await searchIndiaCode({
    query: "BNS cheating",
    fetchImpl: async () => ({ ok: true, json: async () => ({ results: [{ title: "Bharatiya Nyaya Sanhita cheating", id: "bns-test" }] }) })
  });
  assert.equal(result.source, "india-code");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].provenance.source, "India Code");
  assert.equal(result.results[0].provenance.verification, "source_returned");
});
