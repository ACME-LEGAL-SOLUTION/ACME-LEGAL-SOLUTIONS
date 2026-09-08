"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");
const { SUPPORTED_PROVIDERS } = require("./driver-contract");
const { createProviderRegistry } = require("./provider-registry");

const completeDriver = () => ({
  connect: async () => {}, close: async () => {}, query: async () => {},
  begin: async () => {}, commit: async () => {}, rollback: async () => {},
  ensureMigrationLedger: async () => {}, readAppliedMigrations: async () => [],
  acquireLock: async () => {}, releaseLock: async () => {}
});

function config(provider) {
  return createProductionPersistenceConfig({
    env: { ACME_ENV: "production", ACME_DB_PROVIDER: provider, ACME_DB_URL: `${provider}://db.example/acme` }
  });
}

test("provider registry exposes only supported registered providers", () => {
  const registry = createProviderRegistry({ drivers: { postgresql: () => completeDriver(), sqlite: () => completeDriver(), oracle: () => completeDriver() } });
  assert.deepEqual(registry.providers, ["postgresql", "sqlite"]);
  assert.equal(registry.has("postgresql"), true);
  assert.equal(registry.has("oracle"), false);
});

test("provider registry creates a provider-neutral driver for every supported provider", () => {
  const drivers = Object.fromEntries(SUPPORTED_PROVIDERS.map((provider) => [provider, () => completeDriver()]));
  const registry = createProviderRegistry({ drivers });
  for (const provider of SUPPORTED_PROVIDERS) {
    const driver = registry.createDriver(config(provider));
    assert.equal(driver.provider, provider);
    assert.equal(typeof driver.begin, "function");
    assert.equal(typeof driver.ensureMigrationLedger, "function");
  }
});

test("provider registry fails closed for an unregistered supported provider", () => {
  const registry = createProviderRegistry({ drivers: { postgresql: () => completeDriver() } });
  assert.throws(() => registry.createDriver(config("mysql")), /No production database driver is registered/);
});
