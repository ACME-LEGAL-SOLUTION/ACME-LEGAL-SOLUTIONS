"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  loadManifest,
  validateManifest,
  buildMigrationPlan,
  verifyAppliedMigrations,
  pendingMigrations,
  migrationChecksum
} = require("./migration-engine");

const rootDir = path.resolve(__dirname, "../..");
const manifest = loadManifest(path.join(rootDir, "api/persistence/migration-manifest.json"));

test("migration manifest validates and resolves its files", () => {
  assert.equal(validateManifest(manifest), true);
  const plan = buildMigrationPlan({ manifest, rootDir });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].version, "001_initial_relational_schema");
});

test("pending migration is detected when nothing has been applied", () => {
  assert.deepEqual(pendingMigrations({ manifest, applied: [] }).map((m) => m.version), ["001_initial_relational_schema"]);
});

test("applied migration with matching checksum is accepted", () => {
  assert.equal(verifyAppliedMigrations({
    manifest,
    applied: [{ version: "001_initial_relational_schema", checksum: "CANONICAL_SCHEMA_V1" }]
  }), true);
});

test("checksum drift fails closed", () => {
  assert.throws(
    () => verifyAppliedMigrations({
      manifest,
      applied: [{ version: "001_initial_relational_schema", checksum: "tampered" }]
    }),
    /checksum drift/
  );
});

test("unknown applied migration fails closed", () => {
  assert.throws(
    () => verifyAppliedMigrations({
      manifest,
      applied: [{ version: "999_unknown", checksum: "x" }]
    }),
    /Unknown applied migration/
  );
});

test("hashing is deterministic", () => {
  assert.equal(migrationChecksum("ACME"), migrationChecksum("ACME"));
  assert.notEqual(migrationChecksum("ACME"), migrationChecksum("ACME2"));
});
