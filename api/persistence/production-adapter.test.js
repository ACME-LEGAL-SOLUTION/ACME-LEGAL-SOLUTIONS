"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");
const { createProductionAdapter } = require("./production-adapter");

function config(provider = "postgresql") {
  return createProductionPersistenceConfig({ env: {
    ACME_ENV: "production",
    ACME_DB_PROVIDER: provider,
    ACME_DB_URL: `${provider}://db.example/acme`
  }});
}

function repositories() {
  return {
    clients: {}, matters: {}, relationships: {}, parties: {}, conflicts: {},
    documents: {}, evidence: {}, aiInteractions: {}, reviews: {}, audit: {},
    sources: {}, legalVersions: {}, authorities: {}, diary: {}, hearings: {},
    invoices: {}, payments: {}, partners: {}
  };
}

test("production adapter requires an explicit production transaction", () => {
  assert.throws(() => createProductionAdapter({
    config: config(), repositories: repositories(),
    readAppliedMigrations: async () => [],
    acquireLock: async () => {}, releaseLock: async () => {}
  }), /Transactional persistence provider is not configured/);
});

test("production adapter exposes transaction, migration controls, and PostgreSQL dialect", () => {
  const adapter = createProductionAdapter({
    config: config(), repositories: repositories(),
    transaction: { run: async (work) => work({ query: async () => {} }) },
    readAppliedMigrations: async () => [],
    acquireLock: async () => {}, releaseLock: async () => {}
  });
  assert.equal(adapter.provider, "postgresql");
  assert.equal(adapter.dialect.bind("SELECT ?", ["x"]).sql, "SELECT $1");
  assert.equal(typeof adapter.transaction.run, "function");
  assert.equal(typeof adapter.readAppliedMigrations, "function");
  assert.equal(typeof adapter.acquireLock, "function");
  assert.equal(typeof adapter.releaseLock, "function");
});

test("production adapter preserves question-mark binding for MySQL", () => {
  const adapter = createProductionAdapter({
    config: config("mysql"), repositories: repositories(),
    transaction: { run: async (work) => work({ query: async () => {} }) },
    readAppliedMigrations: async () => [],
    acquireLock: async () => {}, releaseLock: async () => {}
  });
  assert.equal(adapter.dialect.bind("SELECT ?", ["x"]).sql, "SELECT ?");
});
