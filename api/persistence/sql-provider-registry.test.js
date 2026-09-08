"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");
const { SUPPORTED_PROVIDERS } = require("./driver-contract");
const { createSqlProviderRegistry } = require("./sql-provider-registry");

const client = () => ({
  connect: async () => ({ query: async () => ({ rows: [] }), release: async () => {} }),
  close: async () => {},
  query: async () => ({ rows: [] })
});

const config = (provider) => createProductionPersistenceConfig({
  env: { ACME_ENV: "production", ACME_DB_PROVIDER: provider, ACME_DB_URL: `${provider}://integration.invalid/acme` }
});

test("SQL provider registry exposes only registered approved providers", () => {
  const registry = createSqlProviderRegistry({ clients: { postgresql: client, mysql: client } });
  assert.deepEqual(registry.providers, ["postgresql", "mysql"]);
  assert.equal(registry.has("postgresql"), true);
  assert.equal(registry.has("sqlite"), false);
});

test("SQL provider registry creates the correct adapter boundary", () => {
  const registry = createSqlProviderRegistry({
    clients: Object.fromEntries(SUPPORTED_PROVIDERS.map((provider) => [provider, client])),
    sqliteLock: { held: false, acquire: async () => {}, release: async () => {} }
  });
  for (const provider of SUPPORTED_PROVIDERS) {
    const adapter = registry.createAdapter(config(provider));
    assert.equal(adapter.provider, provider);
    assert.equal(typeof adapter.transaction.run, "function");
    assert.equal(typeof adapter.ensureMigrationLedger, "function");
  }
});

test("SQL provider registry fails closed for an unregistered provider", () => {
  const registry = createSqlProviderRegistry({ clients: { postgresql: client } });
  assert.throws(() => registry.createAdapter(config("mysql")), /No SQL client is registered/);
});
