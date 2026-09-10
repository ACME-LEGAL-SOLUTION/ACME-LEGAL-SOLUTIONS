"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createProductionRetentionProvider,
  createProductionBackupProvider,
  createDataGovernance,
  assertRecoveryAcceptance,
  sanitize,
  stableFingerprint
} = require("./production-data-governance");

function harness() {
  const auditEvents = [];
  const deleted = [];
  const backups = new Map();
  const retentionProvider = createProductionRetentionProvider({
    provider: {
      id: "retention-test",
      async listExpired() { return [
        { id: "old-1", createdAt: "2020-01-01T00:00:00Z" },
        { id: "held-1", createdAt: "2020-01-01T00:00:00Z", legalHold: true }
      ]; },
      async deleteRecord(input) { deleted.push(input); return { deleted: true }; },
      async exportRecord(input) { return { id: input.id, exported: true }; }
    }
  });
  const backupProvider = createProductionBackupProvider({
    provider: {
      id: "backup-test",
      async createBackup(input) { const backup = { id: `b-${backups.size + 1}`, status: "created", requestedAt: input.requestedAt }; backups.set(backup.id, backup); return backup; },
      async verifyBackup({ backupId }) { return { backupId, verified: backups.has(backupId) }; },
      async restoreBackup({ backupId }) { return { backupId, restored: backups.has(backupId) }; }
    }
  });
  const governance = createDataGovernance({
    retentionProvider,
    backupProvider,
    audit: { async append(event) { auditEvents.push(event); } },
    clock: () => Date.parse("2026-09-10T00:00:00Z"),
    policies: { client_records: { retentionMs: 365 * 24 * 60 * 60 * 1000, legalHoldRequired: true } },
    rpoSeconds: 900,
    rtoSeconds: 3600
  });
  return { governance, auditEvents, deleted, backups };
}

test("provider boundaries fail closed", () => {
  assert.throws(() => createProductionRetentionProvider(), /not configured/);
  assert.throws(() => createProductionBackupProvider(), /not configured/);
  assert.throws(() => createDataGovernance({ retentionProvider: {}, backupProvider: {} }), /audit\.append/);
});

test("retention dry-run excludes legal holds", async () => {
  const { governance, auditEvents, deleted } = harness();
  const result = await governance.enforceRetention({ actor: { id: "system", type: "system" }, dataClass: "client_records", dryRun: true });
  assert.equal(result.candidateCount, 2);
  assert.equal(result.eligibleCount, 1);
  assert.equal(deleted.length, 0);
  assert.equal(auditEvents.at(-1).eventType, "retention.reviewed");
});

test("retention enforcement requires confirmed deletion and preserves legal holds", async () => {
  const { governance, auditEvents, deleted } = harness();
  const result = await governance.enforceRetention({ actor: { id: "system", type: "system" }, dataClass: "client_records", dryRun: false });
  assert.equal(result.destroyedCount, 1);
  assert.deepEqual(deleted.map((item) => item.id), ["old-1"]);
  assert.equal(auditEvents.filter((event) => event.eventType === "data.destroyed").length, 1);
});

test("missing retention policy is rejected", async () => {
  const { governance } = harness();
  await assert.rejects(() => governance.enforceRetention({ dataClass: "unknown", dryRun: true }), /No retention policy/);
});

test("data export is audited without exporting record content into audit", async () => {
  const { governance, auditEvents } = harness();
  const result = await governance.exportData({ actor: { id: "u1", type: "user" }, dataClass: "client_records", id: "secret-record" });
  assert.equal(result.exported, true);
  assert.equal(auditEvents.at(-1).eventType, "data.exported");
  assert.equal(auditEvents.at(-1).payloadJson.recordFingerprint, stableFingerprint("secret-record"));
  assert.equal(JSON.stringify(auditEvents.at(-1)).includes("secret-record"), false);
});

test("backup creation, verification and restore are governed", async () => {
  const { governance } = harness();
  const backup = await governance.createBackup({ actor: { id: "system", type: "system" } });
  assert.equal(backup.status, "created");
  assert.equal((await governance.verifyBackup({ actor: { id: "system" }, backupId: backup.id })).verified, true);
  assert.equal((await governance.restoreBackup({ actor: { id: "system" }, backupId: backup.id, target: { environment: "recovery" } })).restored, true);
});

test("backup verification failure fails closed", async () => {
  const { governance } = harness();
  await assert.rejects(() => governance.verifyBackup({ backupId: "missing" }), /verification failed/);
});

test("recovery acceptance enforces RPO, RTO and verified backup", () => {
  assert.deepEqual(assertRecoveryAcceptance({ observedRpoSeconds: 300, observedRtoSeconds: 1800, rpoSeconds: 900, rtoSeconds: 3600 }), {
    accepted: true, observedRpoSeconds: 300, observedRtoSeconds: 1800, rpoSeconds: 900, rtoSeconds: 3600
  });
  assert.throws(() => assertRecoveryAcceptance({ observedRpoSeconds: 901, observedRtoSeconds: 1800, rpoSeconds: 900, rtoSeconds: 3600 }), /RPO/);
  assert.throws(() => assertRecoveryAcceptance({ observedRpoSeconds: 300, observedRtoSeconds: 3601, rpoSeconds: 900, rtoSeconds: 3600 }), /RTO/);
  assert.throws(() => assertRecoveryAcceptance({ observedRpoSeconds: 300, observedRtoSeconds: 1800, rpoSeconds: 900, rtoSeconds: 3600, backupVerified: false }), /verified backup/);
});

test("security metadata sanitization blocks sensitive fields and remains bounded", () => {
  const input = { token: "TOP-SECRET", password: "pw", email: "person@example.com", safe: "ok", nested: { authorization: "Bearer secret", value: 1 } };
  const output = sanitize(input);
  assert.equal(output.token, undefined);
  assert.equal(output.password, undefined);
  assert.equal(output.email, undefined);
  assert.equal(output.safe, "ok");
  assert.equal(output.nested.authorization, undefined);
  assert.equal(output.nested.value, 1);
});

test("retention deletion failure does not claim destruction", async () => {
  const retentionProvider = createProductionRetentionProvider({
    provider: {
      async listExpired() { return [{ id: "old" }]; },
      async deleteRecord() { return { deleted: false }; },
      async exportRecord() { return {}; }
    }
  });
  const backupProvider = createProductionBackupProvider({
    provider: {
      async createBackup() { return { id: "b" }; },
      async verifyBackup() { return { verified: true }; },
      async restoreBackup() { return { restored: true }; }
    }
  });
  const audit = { events: [], async append(event) { this.events.push(event); } };
  const governance = createDataGovernance({ retentionProvider, backupProvider, audit, policies: { records: { retentionMs: 1000 } } });
  await assert.rejects(() => governance.enforceRetention({ dataClass: "records", dryRun: false }), /not confirmed/);
  assert.equal(audit.events.some((event) => event.eventType === "data.destroyed"), false);
});
