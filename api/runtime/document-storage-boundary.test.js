"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDocumentService } = require("./document-service");
const { createEvidenceService } = require("./evidence-service");

function repositories() {
  const documents = new Map(); const evidence = new Map();
  return { documents: { create: async (v) => { const x = { ...v, id: "doc-1" }; documents.set(x.id, x); return x; }, getById: async (id) => documents.get(id) || null }, evidence: { create: async (v) => { const x = { ...v, id: "ev-1" }; evidence.set(x.id, x); return x; }, getById: async (id) => evidence.get(id) || null } };
}

test("document and evidence operations use the canonical matter authorization boundary", async () => {
  const calls = [];
  const authorization = { assert: async (actor, matterId, action) => { calls.push([actor.id, matterId, action]); if (matterId !== "matter-1") throw Object.assign(new Error("Matter access denied"), { statusCode: 403 }); } };
  const repos = repositories();
  const documents = createDocumentService({ repositories: repos, matterAuthorization: authorization });
  const evidence = createEvidenceService({ repositories: repos, matterAuthorization: authorization });
  await documents.createDocument({ matterId: "matter-1", name: "Order", type: "order" }, { id: "u1" });
  await evidence.createEvidence({ matterId: "matter-1", title: "Photo", type: "image" }, { id: "u1" });
  await assert.rejects(() => documents.createDocument({ matterId: "matter-2", name: "Order", type: "order" }, { id: "u1" }), /Matter access denied/);
  assert.deepEqual(calls, [["u1", "matter-1", "create"], ["u1", "matter-1", "create"], ["u1", "matter-2", "create"]]);
});

test("document object operations authorize before provider access", async () => {
  const calls = []; const storage = { put: async (x) => { calls.push(["put", x]); return x; }, get: async (x) => { calls.push(["get", x]); return x; }, delete: async (x) => { calls.push(["delete", x]); return true; } };
  const authorization = { assert: async (_actor, matterId) => { if (matterId !== "matter-1") throw Object.assign(new Error("Matter access denied"), { statusCode: 403 }); } };
  const service = createDocumentService({ repositories: repositories(), objectStorage: storage, matterAuthorization: authorization });
  await service.putObject({ matterId: "matter-1", objectId: "doc-1", body: Buffer.from("x") }, { id: "u1" });
  await assert.rejects(() => service.getObject({ matterId: "matter-2", objectId: "doc-1" }, { id: "u1" }), /Matter access denied/);
  assert.equal(calls.length, 1);
});
