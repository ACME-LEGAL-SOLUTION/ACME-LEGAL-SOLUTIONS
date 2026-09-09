"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadManifest } = require("./migration-engine");
const { createMigrationRunner } = require("./migration-runner");
const { createProductionPersistenceConfig } = require("./production-config");
const { createSqlProviderRegistry } = require("./sql-provider-registry");

const rootDir = path.resolve(__dirname, "../..");
const manifest = loadManifest(path.join(rootDir, "api/persistence/migration-manifest.json"));
const provider = process.env.ACME_REAL_DB_PROVIDER;
const clientModule = process.env.ACME_REAL_DB_CLIENT_MODULE;
const mutationEnabled = process.env.ACME_REAL_DB_ALLOW_MUTATION === "true";

function requiredRealIntegrationConfig() {
  return provider && clientModule && mutationEnabled;
}

if (!requiredRealIntegrationConfig()) {
  test("real database integration harness is opt-in", { skip: true }, () => {});
} else {
  test(`real ${provider} engine executes the ACME migration contract`, async () => {
    const clientModulePath = path.isAbsolute(clientModule)
      ? clientModule
      : path.resolve(rootDir, clientModule);
    const clients = require(clientModulePath);
    const factory = clients.createClient || clients.default || clients;
    assert.equal(typeof factory, "function", "ACME_REAL_DB_CLIENT_MODULE must export a client factory");

    const config = createProductionPersistenceConfig({
      env: {
        ACME_ENV: "production",
        ACME_DB_PROVIDER: provider,
        ACME_DB_URL: process.env.ACME_REAL_DB_URL,
        ACME_DB_SSL: process.env.ACME_REAL_DB_SSL,
        ACME_DB_MIGRATION_LOCK: process.env.ACME_REAL_DB_MIGRATION_LOCK
      }
    });

    const client = await factory({ config });
    const sqliteLock = clients.createSqliteLock ? await clients.createSqliteLock({ config }) : undefined;
    const registry = createSqlProviderRegistry({
      clients: { [provider]: () => client },
      sqliteLock
    });
    const adapter = registry.createAdapter(config);
    const runner = createMigrationRunner({ manifest, rootDir, storage: adapter, dialect: adapter.dialect });

    try {
      await adapter.connect();
      const first = await runner.migrate();
      const second = await runner.migrate();
      assert.deepEqual(first, { applied: ["001_initial_relational_schema"], pending: [] });
      assert.deepEqual(second, { applied: [], pending: [] });

      const applied = await adapter.readAppliedMigrations();
      assert.equal(applied.length, 1);
      assert.equal(applied[0].version, "001_initial_relational_schema");
      assert.equal(applied[0].checksum, manifest.migrations[0].checksum);

      const result = await adapter.query("SELECT COUNT(*) AS count FROM clients");
      assert.equal(Array.isArray(result.rows), true);
      assert.equal(Number(result.rows[0].count), 0);
    } finally {
      await adapter.close();
    }
  });
}
