"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");
const { createProductionAdapter } = require("./production-adapter");

function config(provider = "postgresql") {
  return createProductionPersistenceConfig({ env: { ACME_ENV: "production", ACME_DB_PROVIDER: provider, ACME_DB_URL: `${provider}://db.example/acme` } });
}
function repositoryStub() { return { create: async (value) => value, getById: async () => null, list: async () => [], update: async (value) => value }; }
function repositories() {
  const collections = ["clients", "matters", "relationships", "parties", "conflicts", "documents", "evidence", "aiInteractions", "reviews", "audit", "sources", "legalVersions", "authorities", "diary", "hearings", "invoices", "payments", "partners"];
  const result = Object.fromEntries(collections.map((name) => [name, repositoryStub()]));
  result.matters.transition = async (value) => value;
  result.auditService = { append: async (event) => event };
  return result;
}
const migrationControls = { readAppliedMigrations: async () => [], ensureMigrationLedger: async () => {}, acquireLock: async () => {}, releaseLock: async () => {} };
const driver = (provider = "postgresql") => ({ provider, connect: async () => ({ id: "connection-1" }), close: async () => {}, query: async () => ({ rows: [] }), begin: async () => ({ query: async () => {} }), commit: async () => {}, rollback: async () => {}, ...migrationControls });

test("production adapter requires an explicit production transaction or complete driver", () => {
  assert.throws(() => createProductionAdapter({ config: config(), repositories: repositories() }), /requires connect/);
});

test("production adapter wires the complete PostgreSQL driver contract", () => {
  const adapter = createProductionAdapter({ config: config(), repositories: repositories(), driver: driver() });
  assert.equal(adapter.provider, "postgresql");
  assert.equal(adapter.driver.provider, "postgresql");
  assert.equal(adapter.dialect.bind("SELECT ?", ["x"]).sql, "SELECT $1");
  assert.equal(typeof adapter.connect, "function");
  assert.equal(typeof adapter.close, "function");
  assert.equal(typeof adapter.query, "function");
  assert.equal(typeof adapter.transaction.run, "function");
  assert.equal(typeof adapter.ensureMigrationLedger, "function");
});

test("driver-backed transaction commits on success and rolls back on failure", async () => {
  const events = [];
  const dbDriver = { ...driver(), begin: async () => ({ id: "tx-1" }), commit: async (tx) => events.push(["commit", tx.id]), rollback: async (tx) => events.push(["rollback", tx.id]) };
  const adapter = createProductionAdapter({ config: config(), repositories: repositories(), driver: dbDriver });
  await adapter.transaction.run(async (tx) => assert.equal(tx.id, "tx-1"));
  await assert.rejects(() => adapter.transaction.run(async () => { throw new Error("boom"); }), /boom/);
  assert.deepEqual(events, [["commit", "tx-1"], ["rollback", "tx-1"]]);
});

test("production adapter preserves question-mark binding for MySQL", () => {
  const adapter = createProductionAdapter({ config: config("mysql"), repositories: repositories(), driver: driver("mysql") });
  assert.equal(adapter.dialect.bind("SELECT ?", ["x"]).sql, "SELECT ?");
});
