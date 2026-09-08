"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createStorageProvider } = require("./storage-provider");

test("storage provider returns a validated repository adapter", () => {
  const provider = createStorageProvider();
  assert.equal(typeof provider.repositories.clients.create, "function");
  assert.equal(typeof provider.repositories.matters.transition, "function");
  assert.equal(typeof provider.repositories.auditService.append, "function");
});
