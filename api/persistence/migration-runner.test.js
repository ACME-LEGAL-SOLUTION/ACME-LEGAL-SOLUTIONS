"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadManifest } = require("./migration-engine");
const { createMigrationRunner } = require("./migration-runner");
const { createSqlDialect } = require("./sql-dialect");
const rootDir = path.resolve(__dirname, "../..");
const manifest = loadManifest(path.join(rootDir, "api/persistence/migration-manifest.json"));
const dialect = createSqlDialect({ provider: "postgresql", placeholder: (index) => `$${index}` });
const versions = manifest.migrations.map((migration) => migration.version);

function storageWith({ applied = [], queries = [], failQuery = false } = {}) {
  const calls = [];
  return {
    calls,
    ensureMigrationLedger: async ({ migrationTable }) => calls.push(["ensure-ledger", migrationTable]),
    readAppliedMigrations: async () => applied,
    acquireLock: async () => calls.push("lock"),
    releaseLock: async () => calls.push("unlock"),
    transaction: { run: async (work) => {
      calls.push("begin");
      const tx = { query: async (sql, params) => { calls.push([sql, params]); queries.push([sql, params]); if (failQuery) throw new Error("query failed"); } };
      try { const result = await work(tx); calls.push("commit"); return result; } catch (error) { calls.push("rollback"); throw error; }
    }}
  };
}

test("migration runner requires a SQL dialect", () => {
  assert.throws(() => createMigrationRunner({ manifest, rootDir, storage: storageWith() }), /SQL dialect is required/);
});
test("migration runner requires explicit migration ledger bootstrap", () => {
  const storage = storageWith(); delete storage.ensureMigrationLedger;
  assert.throws(() => createMigrationRunner({ manifest, rootDir, storage, dialect }), /ensureMigrationLedger/);
});
test("migration runner executes every pending canonical migration and records checksums atomically", async () => {
  const storage = storageWith();
  const result = await createMigrationRunner({ manifest, rootDir, storage, dialect }).migrate();
  assert.deepEqual(result.applied, versions);
  assert.deepEqual(storage.calls.slice(0, 2), ["lock", ["ensure-ledger", "acme_migrations"]]);
  assert.equal(storage.calls.at(-1), "unlock");
  assert.equal(storage.calls.filter((call) => call === "commit").length, versions.length);
  const inserts = storage.calls.filter((call) => Array.isArray(call) && String(call[0]).startsWith("INSERT INTO acme_migrations"));
  assert.equal(inserts.length, versions.length);
  for (let i = 0; i < versions.length; i += 1) {
    assert.equal(inserts[i][1][0], versions[i]);
    assert.equal(inserts[i][1][1], manifest.migrations[i].checksum);
  }
});
test("migration runner rolls back failed migration work and releases lock", async () => {
  const storage = storageWith({ failQuery: true });
  await assert.rejects(() => createMigrationRunner({ manifest, rootDir, storage, dialect }).migrate(), /query failed/);
  assert.equal(storage.calls.includes("rollback"), true); assert.equal(storage.calls.at(-1), "unlock");
});
test("migration runner rejects checksum drift before execution", () => {
  const badManifest = JSON.parse(JSON.stringify(manifest)); badManifest.migrations[0].checksum = "tampered";
  assert.throws(() => createMigrationRunner({ manifest: badManifest, rootDir, storage: storageWith(), dialect }), /Migration source checksum drift/);
});
test("migration runner leaves already applied migrations untouched", async () => {
  const storage = storageWith({ applied: manifest.migrations.map(({ version, checksum }) => ({ version, checksum })) });
  const result = await createMigrationRunner({ manifest, rootDir, storage, dialect }).migrate();
  assert.deepEqual(result, { applied: [], pending: [] });
  assert.deepEqual(storage.calls, ["lock", ["ensure-ledger", "acme_migrations"], "unlock"]);
});
