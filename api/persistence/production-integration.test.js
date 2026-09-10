"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadManifest } = require("./migration-engine");
const { createMigrationRunner } = require("./migration-runner");
const { createProductionAdapter } = require("./production-adapter");
const { createProductionPersistenceConfig } = require("./production-config");
const { createProductionDriver } = require("./production-driver");
const rootDir = path.resolve(__dirname, "../..");
const manifest = loadManifest(path.join(rootDir, "api/persistence/migration-manifest.json"));
const versions = manifest.migrations.map((migration) => migration.version);

function createFakeSqlDriver(options = {}) {
  const state = { ledger: false, committed: false, rolledBack: false, lock: false, applied: [] };
  const driver = {
    provider: "postgresql",
    connect: async () => driver,
    close: async () => {},
    begin: async () => ({ query: async (sql, params = []) => {
      if (options.failMigration && sql.includes("CREATE TABLE")) throw new Error("synthetic migration failure");
      if (sql.includes("INSERT INTO acme_migrations")) { state.applied.push({ version: params[0], checksum: params[1] }); }
    }}),
    commit: async () => { state.committed = true; },
    rollback: async () => { state.rolledBack = true; state.applied = []; },
    query: async (sql) => { if (sql.includes("CREATE TABLE acme_migrations")) state.ledger = true; return { rows: [] }; },
    acquireLock: async () => { state.lock = true; },
    releaseLock: async () => { state.lock = false; },
    readAppliedMigrations: async () => state.applied,
    ensureMigrationLedger: async () => { state.ledger = true; }
  };
  return { driver, state };
}
function createAdapter(driver) {
  const config = createProductionPersistenceConfig({ env: { ACME_ENV: "production", ACME_DB_PROVIDER: "postgresql", ACME_DB_URL: "postgresql://integration.invalid/acme" } });
  const resolvedDriver = createProductionDriver({ config, drivers: { postgresql: () => driver } });
  return { config, adapter: createProductionAdapter({ config, driver: resolvedDriver }) };
}

test("provider-neutral integration harness completes driver lifecycle and complete canonical migration", async () => {
  const { driver, state } = createFakeSqlDriver();
  const { adapter } = createAdapter(driver);
  await adapter.connect();
  const result = await createMigrationRunner({ manifest, rootDir, storage: adapter, dialect: adapter.dialect }).migrate();
  await adapter.close();
  assert.deepEqual(result, { applied: versions, pending: [] });
  assert.equal(state.ledger, true); assert.equal(state.committed, true); assert.equal(state.rolledBack, false); assert.equal(state.lock, false);
  assert.deepEqual(state.applied.map((record) => record.version), versions);
});

test("provider-neutral integration harness rolls back failed canonical migration and releases lock", async () => {
  const { driver, state } = createFakeSqlDriver({ failMigration: true });
  const { adapter } = createAdapter(driver);
  const runner = createMigrationRunner({ manifest, rootDir, storage: adapter, dialect: adapter.dialect });
  await assert.rejects(() => runner.migrate(), /synthetic migration failure/);
  assert.equal(state.rolledBack, true); assert.equal(state.committed, false); assert.equal(state.lock, false); assert.deepEqual(state.applied, []);
});
