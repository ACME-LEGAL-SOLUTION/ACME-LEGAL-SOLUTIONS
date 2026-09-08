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

function repositoryStub() {
  return {
    create: async (value) => value,
    getById: async () => null,
    list: async () => [],
    update: async (value) => value
  };
}

function repositories() {
  const collections = [
    "clients", "matters", "relationships", "parties", "conflicts", "documents", "evidence",
    "aiInteractions", "reviews", "audit", "sources", "legalVersions", "authorities",
    "diary", "hearings", "invoices", "payments", "partners"
  ];
  const result = Object.fromEntries(collections.map((name) => [name, repositoryStub()]));
  result.matters.transition = async (value) => value;
  result.auditService = { append: async (event) => event };
  return result;
}

const migrationControls = {
  readAppliedMigrations: async () => [],
  ensureMigrationLedger: async () => {},
  acquireLock: async () => {},
  releaseLock: async () => {}
};

test("production adapter requires an explicit production transaction", () => {
  assert.throws(() => createProductionAdapter({
    config: config(), repositories: repositories(), ...migrationControls
  }), /Transactional persistence provider is not configured/);
});

test("production adapter exposes transaction, migration controls, and PostgreSQL dialect", () => {
  const adapter = createProductionAdapter({
    config: config(), repositories: repositories(),
    transaction: { run: async (work) => work({ query: async () => {} }) },
    ...migrationControls
  });
  assert.equal(adapter.provider, "postgresql");
  assert.equal(adapter.dialect.bind("SELECT ?", ["x"]).sql, "SELECT $1");
  assert.equal(typeof adapter.transaction.run, "function");
  assert.equal(typeof adapter.readAppliedMigrations, "function");
  assert.equal(typeof adapter.ensureMigrationLedger, "function");
  assert.equal(typeof adapter.acquireLock, "function");
  assert.equal(typeof adapter.releaseLock, "function");
});

test("production adapter preserves question-mark binding for MySQL", () => {
  const adapter = createProductionAdapter({
    config: config("mysql"), repositories: repositories(),
    transaction: { run: async (work) => work({ query: async () => {} }) },
    ...migrationControls
  });
  assert.equal(adapter.dialect.bind("SELECT ?", ["x"]).sql, "SELECT ?");
});
