"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { createEvidenceService } = require("./evidence-service");
const allowMatter = { assert: async () => true };

test("evidence service creates an unverified matter-scoped evidence item", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-07T00:00:00.000Z") });
  const service = createEvidenceService({ repositories, matterAuthorization: allowMatter, clock: () => new Date("2026-01-07T00:00:00.000Z") });
  const evidence = await service.createEvidence({ matterId: "matter-1", documentId: "document-1", type: "document", title: "Client supplied agreement", provenance: "client-upload" }, { id: "human-evidence-1" });
  assert.ok(evidence.id); assert.equal(evidence.matterId, "matter-1"); assert.equal(evidence.status, "unverified"); assert.equal(evidence.provenance, "client-upload"); assert.equal(evidence.createdBy, "human-evidence-1");
});

test("evidence service rejects missing matter and invalid types", async () => {
  const repositories = createRepositories();
  const service = createEvidenceService({ repositories, matterAuthorization: allowMatter });
  await assert.rejects(() => service.createEvidence({ type: "document", title: "Evidence" }, { id: "human-evidence-2" }), /Matter id is required/);
  await assert.rejects(() => service.createEvidence({ matterId: "matter-1", type: "unknown", title: "Evidence" }, { id: "human-evidence-2" }), /Invalid evidence type/);
});

test("evidence service denies unauthorized matter access", async () => {
  const repositories = createRepositories();
  const service = createEvidenceService({ repositories, matterAuthorization: { assert: async () => { throw Object.assign(new Error("Matter access denied"), { statusCode: 403 }); } } });
  await assert.rejects(() => service.createEvidence({ matterId: "matter-1", type: "document", title: "Evidence" }, { id: "human-evidence-3" }), /Matter access denied/);
});
