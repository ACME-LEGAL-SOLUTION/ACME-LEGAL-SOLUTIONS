"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { COLLECTIONS, createApplicationRepositories } = require("./repository-factory");

test("repository factory exposes every application collection", async () => {
  const repositories = createApplicationRepositories();
  for (const name of COLLECTIONS) {
    assert.equal(typeof repositories[name]?.create, "function", `${name} repository missing`);
  }
  assert.equal(typeof repositories.auditService.append, "function");
  assert.equal(typeof repositories.auditService.list, "function");
});
