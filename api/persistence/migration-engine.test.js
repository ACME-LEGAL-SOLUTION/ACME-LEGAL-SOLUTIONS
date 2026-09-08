"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  loadManifest,
  validateManifest,
  buildMigrationPlan,
  verifyMigrationSources,
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
  assert.equal(plan[0].checksumAlgorithm, "git-blob-sha1");
});

test("canonical schema source matches the manifest checksum", () => {
  const plan = buildMigrationPlan({ manifest, rootDir });
  assert.equal(verifyMigrationSources({ plan }), true);
  const schema = fs.readFileSync(plan[0].schemaPath, "utf8");
  assert.equal(migrationChecksum(schema, "git-blob-sha1"), manifest.migrations[0].checksum);
});

test("pending migration is detected when nothing has been applied", () => {
  assert.deepEqual(pendingMigrations({ manifest, applied: [] }).map((m) => m.version), ["001_initial_relational_schema"]);
});

test("applied migration with matching canonical checksum is accepted", () => {
  assert.equal(verifyAppliedMigrations({
    manifest,
    applied: [{ version: "001_initial_relational_schema", checksum: manifest.migrations[0].checksum }]
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
  assert.notEqual(migrationChecksum("ACME", "git-blob-sha1"), migrationChecksum("ACME2", "git-blob-sha1"));
});
