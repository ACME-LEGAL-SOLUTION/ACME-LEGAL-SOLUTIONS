"use strict";

const { COLLECTIONS, assertRepositoryContract } = require("../runtime/persistence-contract");

const DEFINITIONS = Object.freeze({
  clients: { table: "clients", columns: ["id", "client_type", "person_id", "organization_id", "status", "created_at", "updated_at"] },
  matters: { table: "matters", columns: ["id", "client_id", "status", "jurisdiction_code", "assigned_user_id", "created_at", "updated_at"] },
  relationships: { table: "relationships", columns: ["id", "source_party_id", "target_party_id", "relationship_type", "created_at"] },
  parties: { table: "parties", columns: ["id", "matter_id", "party_type", "display_name", "created_at"] },
  conflicts: { table: "conflicts", columns: ["id", "matter_id", "result", "checked_at", "checked_by"] },
  documents: { table: "documents", columns: ["id", "matter_id", "document_type", "status", "storage_key", "created_at"] },
  evidence: { table: "evidence", columns: ["id", "matter_id", "evidence_type", "status", "source_document_id", "created_at"] },
  aiInteractions: { table: "ai_interactions", columns: ["id", "matter_id", "interaction_type", "confidence", "provenance_state", "human_review_required", "created_at"] },
  reviews: { table: "reviews", columns: ["id", "matter_id", "ai_interaction_id", "reviewer_id", "status", "final_action_authorized", "created_at", "decided_at"] },
  audit: { table: "audit_events", columns: ["id", "actor_id", "actor_type", "matter_id", "event_type", "payload_json", "created_at"] },
  sources: { table: "sources", columns: ["id", "source_type", "jurisdiction_code", "title", "verification_state", "effective_date", "created_at", "issuing_authority", "locator", "checksum", "license", "fetched_at", "registered_by", "verified_by", "verified_at", "verification_evidence", "stale_reason", "stale_at", "marked_stale_by"] },
  legalVersions: { table: "legal_versions", columns: ["id", "legal_instrument_id", "jurisdiction_code", "title", "valid_from", "valid_to", "amendment_state", "source_id", "created_at"] },
  authorities: { table: "authorities", columns: ["id", "jurisdiction_code", "name", "authority_type", "created_at"] },
  diary: { table: "diary_entries", columns: ["id", "matter_id", "entry_type", "scheduled_at", "status", "created_at"] },
  hearings: { table: "hearings", columns: ["id", "matter_id", "authority_id", "scheduled_at", "status", "created_at"] },
  invoices: { table: "invoices", columns: ["id", "client_id", "matter_id", "status", "currency_code", "total_amount", "issued_at", "due_at", "created_at", "updated_at", "issued_by", "idempotency_key"] },
  payments: { table: "payments", columns: ["id", "invoice_id", "status", "currency_code", "amount", "provider_reference", "created_at", "provider", "provider_event_id", "idempotency_key", "verified_at", "reconciled_at", "reconciled_by", "failure_reason"] },
  partners: { table: "partners", columns: ["id", "name", "verification_state", "jurisdictions_json", "specialties_json", "contact_json", "created_at"] },
  workPackages: { table: "work_packages", columns: ["id", "matter_id", "state", "issue", "jurisdiction", "applicable_date", "payload_json", "provenance_json", "confidence", "created_at", "updated_at", "created_by", "approved_by", "finalized_by"] },
  messages: { table: "messages", columns: ["id", "matter_id", "client_id", "channel", "provider", "template_id", "template_version", "recipient_ref", "status", "provider_message_id", "idempotency_key", "attempt_count", "next_retry_at", "failure_reason", "payload_json", "created_at", "updated_at", "verified_at", "delivered_at", "failed_at"] }
});

const TO_DB = Object.freeze({
  clientType: "client_type", personId: "person_id", organizationId: "organization_id", createdAt: "created_at", updatedAt: "updated_at",
  clientId: "client_id", jurisdictionCode: "jurisdiction_code", assignedUserId: "assigned_user_id", matterId: "matter_id", partyType: "party_type", displayName: "display_name",
  sourcePartyId: "source_party_id", targetPartyId: "target_party_id", relationshipType: "relationship_type", checkedAt: "checked_at", checkedBy: "checked_by",
  documentType: "document_type", storageKey: "storage_key", evidenceType: "evidence_type", sourceDocumentId: "source_document_id", interactionType: "interaction_type",
  provenanceState: "provenance_state", humanReviewRequired: "human_review_required", aiInteractionId: "ai_interaction_id", reviewerId: "reviewer_id", finalActionAuthorized: "final_action_authorized", decidedAt: "decided_at",
  actorId: "actor_id", actorType: "actor_type", eventType: "event_type", payloadJson: "payload_json", sourceType: "source_type", verificationState: "verification_state", effectiveDate: "effective_date",
  issuingAuthority: "issuing_authority", locator: "locator", checksum: "checksum", license: "license", fetchedAt: "fetched_at", registeredBy: "registered_by", verifiedBy: "verified_by", verifiedAt: "verified_at",
  verificationEvidence: "verification_evidence", staleReason: "stale_reason", staleAt: "stale_at", markedStaleBy: "marked_stale_by", legalInstrumentId: "legal_instrument_id", validFrom: "valid_from", validTo: "valid_to",
  amendmentState: "amendment_state", sourceId: "source_id", authorityId: "authority_id", authorityType: "authority_type", entryType: "entry_type", scheduledAt: "scheduled_at", currencyCode: "currency_code",
  totalAmount: "total_amount", issuedAt: "issued_at", dueAt: "due_at", invoiceId: "invoice_id", providerReference: "provider_reference", provider: "provider", providerEventId: "provider_event_id", idempotencyKey: "idempotency_key",
  reconciledAt: "reconciled_at", reconciledBy: "reconciled_by", failureReason: "failure_reason", issuedBy: "issued_by", jurisdictions: "jurisdictions_json", specialties: "specialties_json", contact: "contact_json",
  state: "state", issue: "issue", applicableDate: "applicable_date", provenanceJson: "provenance_json", confidence: "confidence", createdBy: "created_by", approvedBy: "approved_by", finalizedBy: "finalized_by",
  channel: "channel", templateId: "template_id", templateVersion: "template_version", recipientRef: "recipient_ref", status: "status", providerMessageId: "provider_message_id", attemptCount: "attempt_count",
  nextRetryAt: "next_retry_at", deliveredAt: "delivered_at", failedAt: "failed_at"
});

const FROM_DB = Object.freeze(Object.fromEntries(Object.entries(TO_DB).map(([key, value]) => [value, key])));
const camel = (column) => FROM_DB[column] || column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

function requireExecutor(executor) {
  if (!executor || typeof executor.query !== "function") {
    throw new TypeError("SQL executor with query(sql, params) is required");
  }
}

function encodeValue(key, value) {
  if (value === undefined) return null;
  if (["payloadJson", "provenanceJson", "jurisdictions", "specialties", "contact"].includes(key) && value !== null && typeof value !== "string") {
    return JSON.stringify(value);
  }
  return value;
}

function decodeRow(row) {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([column, value]) => {
    const key = camel(column);
    if (["payloadJson", "provenanceJson", "jurisdictions", "specialties", "contact"].includes(key) && typeof value === "string") {
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, value];
      }
    }
    return [key, value];
  }));
}

function createCollection(executor, name) {
  const definition = DEFINITIONS[name];
  return Object.freeze({
    async create(input) {
      if (!input || !input.id) throw new TypeError(`${name}.create requires id`);
      const columns = definition.columns.filter((column) => input[camel(column)] !== undefined);
      const params = columns.map((column) => encodeValue(camel(column), input[camel(column)]));
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const result = await executor.query(`INSERT INTO ${definition.table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`, params);
      return decodeRow(result.rows?.[0]);
    },
    async getById(id) {
      if (!id) throw new TypeError(`${name}.getById requires id`);
      const result = await executor.query(`SELECT * FROM ${definition.table} WHERE id = $1`, [id]);
      return decodeRow(result.rows?.[0]);
    },
    async list(filters = {}) {
      const entries = Object.entries(filters).filter(([key]) => definition.columns.includes(TO_DB[key] || key));
      const where = entries.length
        ? ` WHERE ${entries.map(([key], index) => `${TO_DB[key] || key} = $${index + 1}`).join(" AND ")}`
        : "";
      const params = entries.map(([key, value]) => encodeValue(key, value));
      const result = await executor.query(`SELECT * FROM ${definition.table}${where} ORDER BY id`, params);
      return (result.rows || []).map(decodeRow);
    },
    async update(id, changes) {
      if (!id) throw new TypeError(`${name}.update requires id`);
      if (!changes || typeof changes !== "object") throw new TypeError(`${name}.update requires changes`);
      const columns = Object.keys(changes).map((key) => TO_DB[key] || key).filter((column) => definition.columns.includes(column) && column !== "id");
      if (!columns.length) return this.getById(id);
      const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(", ");
      const params = columns.map((column) => encodeValue(FROM_DB[column] || column, changes[FROM_DB[column] || column]));
      params.push(id);
      const result = await executor.query(`UPDATE ${definition.table} SET ${assignments} WHERE id = $${params.length} RETURNING *`, params);
      return decodeRow(result.rows?.[0]);
    }
  });
}

function createSqlRepositories({ executor } = {}) {
  requireExecutor(executor);
  const repositories = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection(executor, name)]));
  repositories.matters = Object.freeze({
    ...repositories.matters,
    async transition(id, nextStatus) {
      if (!id || !nextStatus) throw new TypeError("matters.transition requires id and nextStatus");
      const result = await executor.query("UPDATE matters SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *", [nextStatus, new Date().toISOString(), id]);
      return decodeRow(result.rows?.[0]);
    }
  });
  repositories.auditService = Object.freeze({
    async append(event) {
      if (!event || !event.id || !event.actorId || !event.actorType || !event.eventType) throw new TypeError("audit event is incomplete");
      return repositories.audit.create({
        ...event,
        payloadJson: event.payloadJson ?? event.payload ?? {},
        createdAt: event.createdAt ?? new Date().toISOString()
      });
    }
  });
  assertRepositoryContract(repositories);
  return Object.freeze({ repositories });
}

module.exports = { DEFINITIONS, createSqlRepositories, decodeRow };
