"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createApplicationBootstrap } = require("./bootstrap");

function fakePersistence() {
  const repositories = { aiInteractions: { create: async (value) => ({ id: "ai-1", ...value }) }, audit: { create: async (value) => value }, auditService: { append: async () => {} } };
  return {
    config: { provider: "sqlite", environment: "production" },
    repositories,
    driver: { dialect: { bind: (sql, params) => ({ sql, params }) }, close: async () => {} },
    storage: { readAppliedMigrations: async () => [], ensureMigrationLedger: async () => {}, acquireLock: async () => {}, releaseLock: async () => {}, transaction: { run: async () => {} } }
  };
}

test("non-production bootstrap keeps the in-memory repository path", async () => {
  const result = await createApplicationBootstrap({ env: { ACME_ENV: "test" } }).start();
  assert.equal(result.environment, "test");
  assert.equal(result.persistence, null);
  const matter = await result.application.runtime.createMatter({ id: "m-1" }, { id: "u-1" });
  assert.equal(matter.id, "m-1");
});

test("production bootstrap fails closed without an AI provider", async () => {
  await assert.rejects(() => createApplicationBootstrap({ env: { ACME_ENV: "production" }, productionPersistenceFactory: () => { throw new Error("should not be called"); } }).start(), /AI provider adapter/);
});

test("production bootstrap runs migrations before exposing the application", async () => {
  const persistence = fakePersistence();
  let migrated = false;
  const result = await createApplicationBootstrap({
    env: { ACME_ENV: "production", ACME_DB_PROVIDER: "sqlite", ACME_DB_URL: "file:///tmp/acme-test.db", ACME_DB_SSL: "false" },
    provider: { execute: async () => ({ answer: "draft" }) },
    productionPersistenceFactory: () => persistence,
    migrationManifest: { migrationTable: "acme_migrations", migrations: [] },
    rootDir: process.cwd()
  }).start();
  assert.ok(result.migrationRunner);
  assert.equal(typeof result.application.runtime.createMatter, "function");
  assert.equal(migrated, false);
  await result.close();
});
