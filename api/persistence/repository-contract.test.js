"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("../runtime/in-memory-repository");
const { COLLECTIONS, METHODS, assertRepositoryContract } = require("../runtime/persistence-contract");

function buildCompleteRepositories() {
  const base = createRepositories();
  const names = COLLECTIONS.filter((name) => !["clients", "matters", "relationships", "parties", "conflicts", "documents", "evidence"].includes(name));
  for (const name of names) base[name] = {};
  // Preserve the special matter transition repository and populate every other
  // required collection with the same provider-neutral CRUD contract.
  const { createCollection } = require("../runtime/in-memory-repository");
  for (const name of names) base[name] = createCollection();
  base.auditService = { append: async (event) => event };
  return base;
}

test("complete repository adapter satisfies the persistence contract", () => {
  const repositories = buildCompleteRepositories();
  assert.equal(assertRepositoryContract(repositories), true);
});

test("every collection exposes the required CRUD operations", () => {
  const repositories = buildCompleteRepositories();
  for (const name of COLLECTIONS) {
    for (const method of METHODS) assert.equal(typeof repositories[name][method], "function", `${name}.${method}`);
  }
});

test("repository CRUD preserves IDs and rejects duplicate creation", async () => {
  const { createCollection } = require("../runtime/in-memory-repository");
  const repository = createCollection();
  const created = await repository.create({ id: "client-1", status: "lead" });
  assert.equal(created.id, "client-1");
  await assert.rejects(() => repository.create({ id: "client-1", status: "duplicate" }), /already exists/);
  const updated = await repository.update("client-1", { status: "verified" });
  assert.equal(updated.id, "client-1");
  assert.equal(updated.status, "verified");
  assert.equal((await repository.getById("client-1")).status, "verified");
});

test("missing repository fails closed", () => {
  const repositories = buildCompleteRepositories();
  delete repositories.parties;
  assert.throws(() => assertRepositoryContract(repositories), /Repository is missing: parties/);
});

test("missing method fails closed", () => {
  const repositories = buildCompleteRepositories();
  delete repositories.documents.update;
  assert.throws(() => assertRepositoryContract(repositories), /documents.update is required/);
});

test("matter transition remains part of the contract", async () => {
  const repositories = buildCompleteRepositories();
  const matter = await repositories.matters.create({ id: "matter-1", status: "lead" });
  const transitioned = await repositories.matters.transition(matter.id, "verified", { id: "reviewer-1" });
  assert.equal(transitioned.id, "matter-1");
  assert.equal(transitioned.status, "verified");
  assert.equal(transitioned.lastTransitionBy, "reviewer-1");
});
