"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { createDocumentService } = require("./document-service");

test("document service creates a matter-scoped document record", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-06T00:00:00.000Z") });
  const service = createDocumentService({ repositories, clock: () => new Date("2026-01-06T00:00:00.000Z") });
  const document = await service.createDocument({
    matterId: "matter-1",
    name: "Order dated 6 January",
    type: "order",
    mimeType: "application/pdf",
    checksum: "sha256:test"
  }, { id: "human-doc-1" });

  assert.ok(document.id);
  assert.equal(document.matterId, "matter-1");
  assert.equal(document.status, "received");
  assert.equal(document.createdBy, "human-doc-1");
  assert.equal(document.createdAt, "2026-01-06T00:00:00.000Z");
});

test("document service rejects invalid document input", async () => {
  const repositories = createRepositories();
  const service = createDocumentService({ repositories });

  await assert.rejects(
    () => service.createDocument({ matterId: "matter-1", name: "x", type: "unknown" }, { id: "human-doc-2" }),
    /Invalid document type/
  );
  await assert.rejects(
    () => service.createDocument({ name: "x", type: "order" }, { id: "human-doc-2" }),
    /Matter id is required/
  );
});
