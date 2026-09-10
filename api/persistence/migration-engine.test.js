"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadManifest, validateManifest, buildMigrationPlan, verifyMigrationSources, verifyAppliedMigrations, pendingMigrations, migrationChecksum } = require("./migration-engine");
const rootDir = path.resolve(__dirname, "../..");
const manifest = loadManifest(path.join(rootDir, "api/persistence/migration-manifest.json"));
const versions = manifest.migrations.map((migration) => migration.version);

test("migration manifest validates and resolves all registered files", () => {
  assert.equal(validateManifest(manifest), true);
  const plan = buildMigrationPlan({ manifest, rootDir });
  assert.deepEqual(plan.map((migration) => migration.version), versions);
  assert.equal(plan.every((migration) => migration.checksumAlgorithm === "git-blob-sha1"), true);
});

test("canonical schema sources match manifest checksums", () => {
  const plan = buildMigrationPlan({ manifest, rootDir });
  assert.equal(verifyMigrationSources({ plan }), true);
  for (let i = 0; i < plan.length; i += 1) {
    const schema = fs.readFileSync(plan[i].schemaPath, "utf8");
    assert.equal(migrationChecksum(schema, "git-blob-sha1"), manifest.migrations[i].checksum);
  }
});

test("pending migrations are detected when nothing has been applied", () => {
  assert.deepEqual(pendingMigrations({ manifest, applied: [] }).map((m) => m.version), versions);
});

test("applied migration with matching canonical checksum is accepted", () => {
  assert.equal(verifyAppliedMigrations({ manifest, applied: [{ version: versions[0], checksum: manifest.migrations[0].checksum }] }), true);
});

test("checksum drift fails closed", () => {
  assert.throws(() => verifyAppliedMigrations({ manifest, applied: [{ version: versions[0], checksum: "tampered" }] }), /checksum drift/);
});

test("unknown applied migration fails closed", () => {
  assert.throws(() => verifyAppliedMigrations({ manifest, applied: [{ version: "999_unknown", checksum: "x" }] }), /Unknown applied migration/);
});

test("hashing is deterministic", () => {
  assert.equal(migrationChecksum("ACME"), migrationChecksum("ACME"));
  assert.notEqual(migrationChecksum("ACME"), migrationChecksum("ACME2"));
  assert.notEqual(migrationChecksum("ACME", "git-blob-sha1"), migrationChecksum("ACME2", "git-blob-sha1"));
});
