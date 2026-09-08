"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");

const baseEnv = Object.freeze({
  ACME_ENV: "production",
  ACME_DB_PROVIDER: "postgresql",
  ACME_DB_URL: "postgresql://db.example/acme"
});

test("production persistence config resolves an approved provider", () => {
  const config = createProductionPersistenceConfig({ env: baseEnv });
  assert.deepEqual(config, {
    environment: "production",
    provider: "postgresql",
    connectionUrl: "postgresql://db.example/acme",
    sslRequired: true,
    migrationLockRequired: true
  });
});

test("production config fails closed outside production", () => {
  assert.throws(
    () => createProductionPersistenceConfig({ env: { ...baseEnv, ACME_ENV: "development" } }),
    /ACME_ENV=production/
  );
});

test("production config rejects an unapproved provider", () => {
  assert.throws(
    () => createProductionPersistenceConfig({ env: { ...baseEnv, ACME_DB_PROVIDER: "oracle" } }),
    /Unsupported production database provider/
  );
});

test("production config requires the database URL", () => {
  const env = { ...baseEnv };
  delete env.ACME_DB_URL;
  assert.throws(
    () => createProductionPersistenceConfig({ env }),
    /ACME_DB_URL/
  );
});

test("production config defaults safety controls on", () => {
  const config = createProductionPersistenceConfig({ env: baseEnv });
  assert.equal(config.sslRequired, true);
  assert.equal(config.migrationLockRequired, true);
});
