"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("../runtime/in-memory-repository");
const { createVerifiedLegalSourcePipeline } = require("./verified-legal-source-pipeline");

function setup() {
  const sources = createCollection();
  const legalVersions = createCollection();
  const audit = createCollection();
  return { sources, legalVersions, audit, pipeline: createVerifiedLegalSourcePipeline({ sources, legalVersions, audit, clock: () => new Date("2026-09-10T00:00:00.000Z"), acquisition: { fetch: async () => ({ body: Buffer.from("official source"), license: "official" }) } }) };
}

test("acquisition records checksum and starts unverified", async () => {
  const { pipeline } = setup();
  const source = await pipeline.acquire({ jurisdiction: "IN", locator: "official://act/1", title: "Act", sourceType: "primary_authority", actor: { id: "u", human: true } });
  assert.equal(source.verificationState, "unverified");
  assert.match(source.checksum, /^[a-f0-9]{64}$/);
});

test("only verified sources can publish legal versions", async () => {
  const { pipeline } = setup();
  const source = await pipeline.acquire({ jurisdiction: "IN", locator: "official://act/1", title: "Act", actor: { id: "u", human: true } });
  await assert.rejects(() => pipeline.publishVersion({ legalInstrumentId: "act-1", jurisdiction: "IN", title: "Act", validFrom: "2026-01-01", sourceId: source.id, actor: { id: "u", human: true } }), /verified sources/);
  await pipeline.verify({ sourceId: source.id, actor: { id: "verifier", human: true } });
  const version = await pipeline.publishVersion({ legalInstrumentId: "act-1", jurisdiction: "IN", title: "Act", validFrom: "2026-01-01", sourceId: source.id, actor: { id: "verifier", human: true } });
  assert.equal(version.sourceId, source.id);
});

test("reconcile rejects conflicting in-force versions", async () => {
  const { pipeline, legalVersions } = setup();
  const source = await pipeline.acquire({ jurisdiction: "IN", locator: "official://act/1", title: "Act", actor: { id: "u", human: true } });
  await pipeline.verify({ sourceId: source.id, actor: { id: "v", human: true } });
  await pipeline.publishVersion({ legalInstrumentId: "a", jurisdiction: "IN", title: "A", validFrom: "2026-01-01", sourceId: source.id, actor: { id: "v", human: true } });
  await legalVersions.create({ id: "v2", legalInstrumentId: "a", jurisdiction: "IN", title: "A2", validFrom: "2026-02-01", amendmentState: "in_force", sourceId: source.id });
  await assert.rejects(() => pipeline.reconcile({ legalInstrumentId: "a", jurisdiction: "IN", actor: { id: "v", human: true } }), /Multiple in-force/);
});

test("stale source is explicitly marked with reason", async () => {
  const { pipeline } = setup();
  const source = await pipeline.acquire({ jurisdiction: "IN", locator: "official://act/1", title: "Act", actor: { id: "u", human: true } });
  const stale = await pipeline.markStale({ sourceId: source.id, actor: { id: "v", human: true }, reason: "Superseded by newer official publication" });
  assert.equal(stale.verificationState, "stale");
  assert.equal(stale.staleReason, "Superseded by newer official publication");
});
