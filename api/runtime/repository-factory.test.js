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

test("repository factory exposes the runtime matter transition contract", async () => {
  const repositories = createApplicationRepositories();
  const matter = await repositories.matters.create({ id: "matter-1", status: "lead" });
  const updated = await repositories.matters.transition("matter-1", "verified", { id: "user-1" });
  assert.equal(matter.status, "lead");
  assert.equal(updated.status, "verified");
  assert.equal(updated.lastTransitionBy, "user-1");
});
