"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { createEvidenceService } = require("./evidence-service");

test("evidence service creates an unverified matter-scoped evidence item", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-07T00:00:00.000Z") });
  const service = createEvidenceService({ repositories, clock: () => new Date("2026-01-07T00:00:00.000Z") });
  const evidence = await service.createEvidence({
    matterId: "matter-1",
    documentId: "document-1",
    type: "document",
    title: "Client supplied agreement",
    provenance: "client-upload"
  }, { id: "human-evidence-1" });

  assert.ok(evidence.id);
  assert.equal(evidence.matterId, "matter-1");
  assert.equal(evidence.status, "unverified");
  assert.equal(evidence.provenance, "client-upload");
  assert.equal(evidence.createdBy, "human-evidence-1");
});

test("evidence service rejects missing matter and invalid types", async () => {
  const repositories = createRepositories();
  const service = createEvidenceService({ repositories });

  await assert.rejects(
    () => service.createEvidence({ type: "document", title: "Evidence" }, { id: "human-evidence-2" }),
    /Matter id is required/
  );
  await assert.rejects(
    () => service.createEvidence({ matterId: "matter-1", type: "unknown", title: "Evidence" }, { id: "human-evidence-2" }),
    /Invalid evidence type/
  );
});
