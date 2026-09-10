"use strict";

const crypto = require("node:crypto");

const DEFAULT_RPO_SECONDS = 900;
const DEFAULT_RTO_SECONDS = 3600;
const MAX_RETENTION_MS = 100 * 365 * 24 * 60 * 60 * 1000;
const DESTRUCTION_REASONS = Object.freeze(["retention_expiry", "client_request", "legal_directive", "incident_cleanup"]);
const BACKUP_STATUSES = Object.freeze(["created", "verified", "failed", "restored"]);

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`Production data governance requires ${name}`);
}

function assertId(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 256) {
    throw new TypeError(`${name} must be a non-empty string of at most 256 characters`);
  }
  return value;
}

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

function stableFingerprint(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sanitize(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  const blocked = /password|secret|token|authorization|cookie|body|content|document|evidence|recipient|phone|email|address/i;
  return Object.fromEntries(Object.entries(value).slice(0, 40).filter(([key]) => !blocked.test(key)).map(([key, item]) => [key, sanitize(item, depth + 1)]));
}

function createProductionRetentionProvider({ provider } = {}) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Production retention provider is not configured");
  }
  ["listExpired", "deleteRecord", "exportRecord"].forEach((name) => assertFunction(provider[name], `retention provider ${name}`));
  return Object.freeze({
    id: provider.id || "retention-provider",
    async listExpired(input) { return provider.listExpired(input); },
    async deleteRecord(input) { return provider.deleteRecord(input); },
    async exportRecord(input) { return provider.exportRecord(input); }
  });
}

function createProductionBackupProvider({ provider } = {}) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Production backup provider is not configured");
  }
  ["createBackup", "verifyBackup", "restoreBackup"].forEach((name) => assertFunction(provider[name], `backup provider ${name}`));
  return Object.freeze({
    id: provider.id || "backup-provider",
    async createBackup(input) { return provider.createBackup(input); },
    async verifyBackup(input) { return provider.verifyBackup(input); },
    async restoreBackup(input) { return provider.restoreBackup(input); }
  });
}

function createDataGovernance({ retentionProvider, backupProvider, audit, clock = Date.now, policies = {}, rpoSeconds = DEFAULT_RPO_SECONDS, rtoSeconds = DEFAULT_RTO_SECONDS } = {}) {
  if (!retentionProvider) throw new Error("Retention provider is required");
  if (!backupProvider) throw new Error("Backup provider is required");
  assertFunction(audit?.append, "audit.append");
  if (!Number.isInteger(rpoSeconds) || rpoSeconds < 60) throw new RangeError("rpoSeconds must be at least 60 seconds");
  if (!Number.isInteger(rtoSeconds) || rtoSeconds < 60) throw new RangeError("rtoSeconds must be at least 60 seconds");

  const policyMap = new Map(Object.entries(policies).map(([dataClass, policy]) => {
    assertId(dataClass, "dataClass");
    const retentionMs = Number(policy?.retentionMs);
    if (!Number.isSafeInteger(retentionMs) || retentionMs < 0 || retentionMs > MAX_RETENTION_MS) {
      throw new RangeError(`Invalid retention policy for ${dataClass}`);
    }
    return [dataClass, Object.freeze({ retentionMs, legalHoldRequired: policy?.legalHoldRequired !== false })];
  }));

  async function auditEvent(actor, eventType, metadata) {
    await audit.append({
      id: `sec-${crypto.randomUUID()}`,
      actorId: actor?.id || "system",
      actorType: actor?.type || "system",
      eventType,
      payloadJson: sanitize(metadata),
      createdAt: nowIso(clock)
    });
  }

  async function evaluateRetention({ dataClass, records = [], now = clock() } = {}) {
    assertId(dataClass, "dataClass");
    const policy = policyMap.get(dataClass);
    if (!policy) throw new Error(`No retention policy configured for ${dataClass}`);
    const cutoff = new Date(now - policy.retentionMs).toISOString();
    return records.map((record) => {
      const eligible = Boolean(record && record.createdAt && new Date(record.createdAt).getTime() <= now - policy.retentionMs && !record.legalHold);
      return Object.freeze({ id: record?.id, dataClass, eligible, legalHold: Boolean(record?.legalHold), cutoff });
    });
  }

  async function enforceRetention({ actor, dataClass, before, dryRun = true } = {}) {
    assertId(dataClass, "dataClass");
    const policy = policyMap.get(dataClass);
    if (!policy) throw new Error(`No retention policy configured for ${dataClass}`);
    const cutoff = before ? new Date(before).toISOString() : new Date(clock() - policy.retentionMs).toISOString();
    const candidates = await retentionProvider.listExpired({ dataClass, before: cutoff });
    if (!Array.isArray(candidates)) throw new Error("Retention provider returned invalid candidates");
    const eligible = candidates.filter((record) => !record?.legalHold);
    if (dryRun) {
      await auditEvent(actor, "retention.reviewed", { dataClass, candidateCount: candidates.length, eligibleCount: eligible.length, cutoff, dryRun: true });
      return Object.freeze({ dataClass, cutoff, dryRun: true, candidateCount: candidates.length, eligibleCount: eligible.length });
    }
    const destroyed = [];
    for (const record of eligible) {
      const result = await retentionProvider.deleteRecord({ dataClass, id: assertId(record.id, "record.id"), reason: "retention_expiry" });
      if (!result || result.deleted !== true) throw new Error(`Retention deletion was not confirmed for ${record.id}`);
      destroyed.push(record.id);
      await auditEvent(actor, "data.destroyed", { dataClass, recordFingerprint: stableFingerprint(record.id), reason: "retention_expiry" });
    }
    return Object.freeze({ dataClass, cutoff, dryRun: false, candidateCount: candidates.length, destroyedCount: destroyed.length, destroyed });
  }

  async function exportData({ actor, dataClass, id } = {}) {
    assertId(dataClass, "dataClass");
    assertId(id, "id");
    const result = await retentionProvider.exportRecord({ dataClass, id });
    await auditEvent(actor, "data.exported", { dataClass, recordFingerprint: stableFingerprint(id) });
    return result;
  }

  async function createBackup({ actor, reason = "scheduled" } = {}) {
    const backup = await backupProvider.createBackup({ requestedAt: nowIso(clock), reason });
    if (!backup || !backup.id) throw new Error("Backup provider returned invalid backup");
    await auditEvent(actor, "backup.created", { backupId: backup.id, provider: backupProvider.id, reason });
    return backup;
  }

  async function verifyBackup({ actor, backupId } = {}) {
    assertId(backupId, "backupId");
    const result = await backupProvider.verifyBackup({ backupId });
    if (!result || result.verified !== true) {
      await auditEvent(actor, "backup.verification_failed", { backupId, provider: backupProvider.id });
      throw new Error("Backup verification failed");
    }
    await auditEvent(actor, "backup.verified", { backupId, provider: backupProvider.id });
    return result;
  }

  async function restoreBackup({ actor, backupId, target } = {}) {
    assertId(backupId, "backupId");
    const result = await backupProvider.restoreBackup({ backupId, target });
    if (!result || result.restored !== true) throw new Error("Backup restore was not confirmed");
    await auditEvent(actor, "backup.restored", { backupId, provider: backupProvider.id, target: sanitize(target) });
    return result;
  }

  function acceptanceCriteria() {
    return Object.freeze({ rpoSeconds, rtoSeconds, retentionPolicyCount: policyMap.size, requiresVerifiedBackup: true, requiresLegalHoldRespect: true, requiresDeletionConfirmation: true });
  }

  return Object.freeze({ evaluateRetention, enforceRetention, exportData, createBackup, verifyBackup, restoreBackup, acceptanceCriteria });
}

function assertRecoveryAcceptance({ observedRpoSeconds, observedRtoSeconds, rpoSeconds, rtoSeconds, backupVerified = true } = {}) {
  if (!Number.isFinite(observedRpoSeconds) || !Number.isFinite(observedRtoSeconds)) throw new TypeError("Observed RPO/RTO values are required");
  if (!backupVerified) throw new Error("Recovery acceptance requires a verified backup");
  if (observedRpoSeconds > rpoSeconds) throw new Error("Observed RPO exceeds accepted target");
  if (observedRtoSeconds > rtoSeconds) throw new Error("Observed RTO exceeds accepted target");
  return Object.freeze({ accepted: true, observedRpoSeconds, observedRtoSeconds, rpoSeconds, rtoSeconds });
}

module.exports = {
  DEFAULT_RPO_SECONDS,
  DEFAULT_RTO_SECONDS,
  MAX_RETENTION_MS,
  DESTRUCTION_REASONS,
  BACKUP_STATUSES,
  createProductionRetentionProvider,
  createProductionBackupProvider,
  createDataGovernance,
  assertRecoveryAcceptance,
  sanitize,
  stableFingerprint
};
