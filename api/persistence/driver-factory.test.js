"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");
const { createProductionDriver } = require("./driver-factory");

const config = (provider = "postgresql") => createProductionPersistenceConfig({ env: { ACME_ENV: "production", ACME_DB_PROVIDER: provider, ACME_DB_URL: `${provider}://db.example/acme` } });
const complete = () => ({ connect: async () => {}, close: async () => {}, query: async () => {}, begin: async () => {}, commit: async () => {}, rollback: async () => {}, ensureMigrationLedger: async () => {}, readAppliedMigrations: async () => [], acquireLock: async () => {}, releaseLock: async () => {} });

test("driver factory fails closed when no approved implementation is registered", () => {
  assert.throws(() => createProductionDriver({ config: config() }), /No production database driver is registered/);
});

test("driver factory passes configuration to the provider implementation", () => {
  let received;
  const driver = createProductionDriver({ config: config("sqlite"), drivers: { sqlite: ({ config }) => { received = config; return complete(); } } });
  assert.equal(received.provider, "sqlite");
  assert.equal(driver.provider, "sqlite");
});

test("driver factory validates the returned provider-neutral capability set", () => {
  assert.throws(() => createProductionDriver({ config: config("mysql"), drivers: { mysql: () => ({ connect: async () => {} }) } }), /requires close/);
});
