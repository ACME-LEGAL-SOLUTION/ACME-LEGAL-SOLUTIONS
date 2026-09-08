"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { assertRepositoryContract, createRepositoryAdapter } = require("./persistence-contract");

test("application repositories satisfy the provider-neutral persistence contract", () => {
  const repositories = createApplicationRepositories();
  assert.equal(assertRepositoryContract(repositories), true);
  assert.equal(createRepositoryAdapter({ repositories }).assert(), true);
});

test("persistence contract rejects incomplete adapters", () => {
  assert.throws(() => assertRepositoryContract({}), /Repository is missing: clients/);
});
