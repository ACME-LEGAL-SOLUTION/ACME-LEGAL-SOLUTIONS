"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createApplicationRuntime } = require("./application-runtime");

function repositories() {
  const collection = () => createCollection();
  const auditRepository = collection();
  const auditService = { append: (event) => auditRepository.create(event), list: () => auditRepository.list() };
  return {
    clients: collection(), relationships: collection(), parties: collection(), conflicts: collection(), documents: collection(), evidence: collection(),
    matters: { ...collection(), transition: async () => null }, aiInteractions: collection(), reviews: collection(), audit: collection(), auditService,
    sources: collection(), legalVersions: collection(), authorities: collection(), diary: collection(), invoices: collection(), payments: collection(), partners: collection()
  };
}

test("application runtime wires all executable service boundaries", () => {
  const app = createApplicationRuntime({ repositories: repositories(), provider: { execute: async () => ({}) } });
  assert.ok(app.runtime);
  assert.ok(app.ai);
  assert.ok(app.source);
  assert.ok(app.legalVersions);
  assert.ok(app.authorities);
  assert.ok(app.diary);
  assert.ok(app.billing);
  assert.ok(app.network);
});
