"use strict";

const fs = require("node:fs");
const { buildMigrationPlan, verifyAppliedMigrations } = require("./migration-engine");

function createMigrationRunner({ manifest, rootDir, storage }) {
  if (!storage || typeof storage.readAppliedMigrations !== "function" || !storage.transaction || typeof storage.transaction.run !== "function") {
    throw new TypeError("Migration storage must expose readAppliedMigrations and transaction.run");
  }
  if (typeof storage.acquireLock !== "function" || typeof storage.releaseLock !== "function") {
    throw new TypeError("Migration storage must expose acquireLock and releaseLock");
  }
  const plan = buildMigrationPlan({ manifest, rootDir });
  const migrationTable = manifest.migrationTable;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(migrationTable)) throw new Error("Unsafe migration table name");

  async function migrate() {
    await storage.acquireLock();
    try {
      const applied = await storage.readAppliedMigrations();
      verifyAppliedMigrations({ manifest, applied });
      const appliedVersions = new Set((applied || []).map((record) => record.version));
      const pending = plan.filter((migration) => !appliedVersions.has(migration.version));
      for (const migration of pending) {
        const sql = fs.readFileSync(migration.migrationPath, "utf8").trim();
        if (!sql) throw new Error(`Migration is empty: ${migration.version}`);
        await storage.transaction.run(async (tx) => {
          if (!tx || typeof tx.query !== "function") throw new Error("Transaction executor must expose query");
          await tx.query(sql);
          await tx.query(`INSERT INTO ${migrationTable} (version, checksum, applied_at) VALUES (?, ?, CURRENT_TIMESTAMP)`, [migration.version, migration.checksum]);
        });
      }
      return { applied: pending.map((migration) => migration.version), pending: [] };
    } finally {
      await storage.releaseLock();
    }
  }
  return Object.freeze({ migrate });
}

module.exports = { createMigrationRunner };
