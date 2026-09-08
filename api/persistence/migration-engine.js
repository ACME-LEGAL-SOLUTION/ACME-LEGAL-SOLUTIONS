"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function loadManifest(manifestPath) {
  const absolute = path.resolve(manifestPath);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function validateManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.migrations)) throw new TypeError("Migration manifest is invalid");
  const versions = manifest.migrations.map((migration) => migration.version);
  if (new Set(versions).size !== versions.length) throw new Error("Duplicate migration version");
  for (const migration of manifest.migrations) {
    if (!migration.version || !migration.file || !migration.schema || !migration.checksum) {
      throw new Error(`Incomplete migration: ${migration.version || "unknown"}`);
    }
  }
  return true;
}

function buildMigrationPlan({ manifest, rootDir }) {
  validateManifest(manifest);
  const migrations = [...manifest.migrations].sort((a, b) => a.version.localeCompare(b.version));
  return migrations.map((migration) => {
    const migrationPath = path.resolve(rootDir, migration.file);
    const schemaPath = path.resolve(rootDir, migration.schema);
    if (!fs.existsSync(migrationPath)) throw new Error(`Migration file missing: ${migration.file}`);
    if (!fs.existsSync(schemaPath)) throw new Error(`Schema file missing: ${migration.schema}`);
    return Object.freeze({ ...migration, migrationPath, schemaPath });
  });
}

function verifyAppliedMigrations({ manifest, applied }) {
  validateManifest(manifest);
  const expected = new Map(manifest.migrations.map((migration) => [migration.version, migration.checksum]));
  for (const record of applied || []) {
    const checksum = expected.get(record.version);
    if (!checksum) throw new Error(`Unknown applied migration: ${record.version}`);
    if (checksum !== record.checksum) throw new Error(`Migration checksum drift: ${record.version}`);
  }
  return true;
}

function pendingMigrations({ manifest, applied }) {
  verifyAppliedMigrations({ manifest, applied });
  const appliedVersions = new Set((applied || []).map((record) => record.version));
  return [...manifest.migrations]
    .filter((migration) => !appliedVersions.has(migration.version))
    .sort((a, b) => a.version.localeCompare(b.version));
}

function migrationChecksum(content) {
  return sha256(content);
}

module.exports = {
  loadManifest,
  validateManifest,
  buildMigrationPlan,
  verifyAppliedMigrations,
  pendingMigrations,
  migrationChecksum
};
