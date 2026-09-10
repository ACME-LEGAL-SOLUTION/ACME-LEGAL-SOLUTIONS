"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildKey, createProductionObjectStorage, digest } = require("./production-object-storage");

test("production object storage fails closed without provider", () => {
  assert.throws(() => createProductionObjectStorage({ env: {} }), /ACME_OBJECT_STORAGE_MODULE/);
});

test("production object storage enforces matter-scoped immutable keys", async () => {
  const calls = [];
  const storage = createProductionObjectStorage({
    env: { ACME_OBJECT_STORAGE_MODULE: "provider" },
    moduleLoader: () => ({
      put: async (input) => { calls.push(["put", input]); return { key: input.key }; },
      get: async (input) => { calls.push(["get", input]); return { key: input.key }; },
      delete: async (input) => { calls.push(["delete", input]); return true; }
    })
  });
  const body = Buffer.from("evidence");
  await storage.put({ matterId: "matter-1", objectId: "doc-1", body });
  await storage.get({ matterId: "matter-1", objectId: "doc-1" });
  await storage.delete({ matterId: "matter-1", objectId: "doc-1" });
  assert.equal(calls[0][1].key, "matters/matter-1/objects/doc-1");
  assert.equal(calls[0][1].checksum, digest(body));
  assert.equal(calls[1][1].key, calls[0][1].key);
  assert.equal(calls[2][1].key, calls[0][1].key);
});

test("production object storage rejects missing scope", async () => {
  const storage = createProductionObjectStorage({ env: { ACME_OBJECT_STORAGE_MODULE: "provider" }, moduleLoader: () => ({ put: async () => {}, get: async () => {}, delete: async () => {} }) });
  await assert.rejects(() => storage.get({ objectId: "doc-1" }), /Matter id is required/);
  await assert.rejects(() => storage.get({ matterId: "matter-1" }), /Object id is required/);
});

test("object key encoding prevents path ambiguity", () => {
  assert.equal(buildKey("matter/a", "doc/b"), "matters/matter%2Fa/objects/doc%2Fb");
});
