"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createSourceService } = require("./source-service");
const { createLegalVersionService } = require("./legal-version-service");

test("source provenance requires jurisdiction and controlled taxonomy", async () => {
  const repository = createCollection();
  const service = createSourceService({ repository });
  const source = await service.register({ title: "Act", sourceType: "primary_authority", jurisdiction: "IN", issuingAuthority: "Parliament", actor: { id: "u" } });
  assert.equal(source.verificationState, "unverified");
  await assert.rejects(() => service.register({ title: "x", sourceType: "unknown", jurisdiction: "IN", actor: { id: "u" } }), /Invalid source type/);
});

test("legal version resolves the law applicable on a specific date", async () => {
  const repository = createCollection();
  const service = createLegalVersionService({ repository });
  await service.create({ legalInstrumentId: "act-1", jurisdiction: "IN", title: "Old", validFrom: "2020-01-01", validTo: "2022-12-31", sourceId: "s1", actor: { id: "u" } });
  const current = await service.create({ legalInstrumentId: "act-1", jurisdiction: "IN", title: "New", validFrom: "2023-01-01", sourceId: "s2", actor: { id: "u" } });
  assert.equal((await service.effectiveAt({ legalInstrumentId: "act-1", jurisdiction: "IN", date: "2021-05-01" })).title, "Old");
  assert.equal((await service.effectiveAt({ legalInstrumentId: "act-1", jurisdiction: "IN", date: "2024-01-01" })).id, current.id);
});
