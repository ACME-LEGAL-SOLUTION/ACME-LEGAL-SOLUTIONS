"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateQuery, handleLegalResearch } = require("./http-endpoint");

test("legal research validates query", () => {
  assert.equal(validateQuery("  cheque dishonour in Mumbai  "), "cheque dishonour in Mumbai");
  assert.throws(() => validateQuery(""), /query is required/i);
});

test("legal research returns classification, results and provenance", async () => {
  const response = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
  await handleLegalResearch(new URL("http://localhost/api/legal-research?q=cheque%20dishonour%20matter%20against%20a%20company%20in%20Mumbai%20under%20Section%20138"), response, (res, status, payload) => { res.writeHead(status); res.end(JSON.stringify(payload)); }, {
    search: async ({ query, limit }) => ({
      classification: { query, jurisdiction: "IN", state: "Maharashtra", court: null, matterType: "cheque dishonour", act: "Negotiable Instruments Act, 1881", section: "138" },
      source: "india-code",
      results: [{ title: "Negotiable Instruments Act, 1881 — Section 138", score: 3, provenance: { source: "India Code", verification: "source_returned" } }],
      limit
    })
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.classification.act, "Negotiable Instruments Act, 1881");
  assert.equal(response.body.classification.section, "138");
  assert.equal(response.body.results[0].provenance.source, "India Code");
});
