"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadManifest } = require("./migration-engine");
const { createMigrationRunner } = require("./migration-runner");
const { createProductionPersistenceConfig } = require("./production-config");
const { createProductionAdapter } = require("./production-adapter");
const { createProductionDriver } = require("./driver-factory");

const rootDir = path.resolve(__dirname, "../..");
const manifest = loadManifest(path.join(rootDir, "api/persistence/migration-manifest.json"));

function createFakeSqlDriver({ failMigration = false } = {}) {
  const state = { ledger: false, applied: [], lock: false, committed: false, rolledBack: false, executed: [] };

  return {
    state,
    connect: async () => ({ id: "fake-connection" }),
    close: async () => {},
    query: async () => ({ rows: [] }),
    begin: async () => ({
      query: async (sql, params = []) => {
        state.executed.push({ sql, params });
        if (failMigration && String(sql).includes("CREATE TABLE")) throw new Error("synthetic migration failure");
        if (String(sql).startsWith("INSERT INTO acme_migrations")) {
          state.applied.push({ version: params[0], checksum: params[1] });
        }
      }
    }),
    commit: async () => { state.committed = true; },
    rollback: async () => { state.rolledBack = true; },
    ensureMigrationLedger: async () => { state.ledger = true; },
    readAppliedMigrations: async () => state.applied.slice(),
    acquireLock: async () => { if (state.lock) throw new Error("migration lock already held"); state.lock = true; },
    releaseLock: async () => { state.lock = false; }
  };
}

function createAdapter(driver) {
  const config = createProductionPersistenceConfig({
    env: {
      ACME_ENV: "production",
      ACME_DB_PROVIDER: "postgresql",
      ACME_DB_URL: "postgresql://integration.invalid/acme"
    }
  });
  const resolvedDriver = createProductionDriver({ config, drivers: { postgresql: () => driver } });
  return { config, adapter: createProductionAdapter({ config, driver: resolvedDriver }) };
}

test("provider-neutral integration harness completes driver lifecycle and canonical migration", async () => {
  const driver = createFakeSqlDriver();
  const { adapter } = createAdapter(driver);
  assert.equal(adapter.provider, "postgresql");
  await adapter.connect();
  const runner = createMigrationRunner({ manifest, rootDir, storage: adapter, dialect: adapter.dialect });
  const result = await runner.migrate();
  await adapter.close();

  assert.deepEqual(result, { applied: ["001_initial_relational_schema"], pending: [] });
  assert.equal(driver.state.ledger, true);
  assert.equal(driver.state.committed, true);
  assert.equal(driver.state.rolledBack, false);
  assert.equal(driver.state.lock, false);
  assert.equal(driver.state.applied[0].checksum, manifest.migrations[0].checksum);
});

test("provider-neutral integration harness rolls back failed canonical migration and releases lock", async () => {
  const driver = createFakeSqlDriver({ failMigration: true });
  const { adapter } = createAdapter(driver);
  const runner = createMigrationRunner({ manifest, rootDir, storage: adapter, dialect: adapter.dialect });

  await assert.rejects(() => runner.migrate(), /synthetic migration failure/);
  assert.equal(driver.state.rolledBack, true);
  assert.equal(driver.state.committed, false);
  assert.equal(driver.state.lock, false);
  assert.deepEqual(driver.state.applied, []);
});

test("provider-neutral integration harness is idempotent after migration recording", async () => {
  const driver = createFakeSqlDriver();
  const { adapter } = createAdapter(driver);
  const runner = createMigrationRunner({ manifest, rootDir, storage: adapter, dialect: adapter.dialect });

  await runner.migrate();
  driver.state.committed = false;
  const second = await runner.migrate();

  assert.deepEqual(second, { applied: [], pending: [] });
  assert.equal(driver.state.committed, false);
  assert.equal(driver.state.lock, false);
});
