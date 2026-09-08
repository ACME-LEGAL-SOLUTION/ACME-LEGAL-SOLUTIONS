"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProviderDriver } = require("./provider-driver");

const complete = () => ({
  connect: async () => ({ connection: true }),
  close: async () => {},
  query: async () => ({ rows: [] }),
  begin: async () => ({ query: async () => ({ rows: [] }) }),
  commit: async () => {},
  rollback: async () => {},
  ensureMigrationLedger: async () => {},
  readAppliedMigrations: async () => [],
  acquireLock: async () => {},
  releaseLock: async () => {}
});

test("provider driver accepts every approved provider", () => {
  for (const provider of ["postgresql", "mysql", "mariadb", "sqlite"]) {
    const driver = createProviderDriver({ provider, ...complete() });
    assert.equal(driver.provider, provider);
  }
});

test("provider driver preserves the provider-neutral lifecycle and transaction capabilities", async () => {
  const driver = createProviderDriver({ provider: "postgresql", ...complete() });
  assert.equal((await driver.connect()).connection, true);
  assert.deepEqual(await driver.query("SELECT 1"), { rows: [] });
  const tx = await driver.begin();
  assert.deepEqual(await tx.query("SELECT 1"), { rows: [] });
  await driver.commit(tx);
  await driver.rollback(tx);
  await driver.ensureMigrationLedger({ migrationTable: "acme_migrations" });
  assert.deepEqual(await driver.readAppliedMigrations(), []);
  await driver.acquireLock();
  await driver.releaseLock();
  await driver.close();
});

test("provider driver rejects an unsupported provider", () => {
  assert.throws(() => createProviderDriver({ provider: "oracle", ...complete() }), /Unsupported production database provider/);
});

test("provider driver fails closed when a required capability is absent", () => {
  const driver = complete();
  delete driver.rollback;
  assert.throws(() => createProviderDriver({ provider: "sqlite", ...driver }), /requires rollback/);
});
