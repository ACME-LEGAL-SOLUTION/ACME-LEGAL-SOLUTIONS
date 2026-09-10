"use strict";

const { randomUUID } = require("node:crypto");

const DEFINITIONS = Object.freeze({
  clients: { table: "clients", fields: { id: "id", clientType: "client_type", personId: "person_id", organizationId: "organization_id", status: "status", createdAt: "created_at", updatedAt: "updated_at" } },
  matters: { table: "matters", fields: { id: "id", clientId: "client_id", status: "status", jurisdictionCode: "jurisdiction_code", ownerId: "assigned_user_id", assignedUserId: "assigned_user_id", createdAt: "created_at", updatedAt: "updated_at" } },
  parties: { table: "parties", fields: { id: "id", matterId: "matter_id", partyType: "party_type", displayName: "display_name", createdAt: "created_at" } },
  relationships: { table: "relationships", fields: { id: "id", sourcePartyId: "source_party_id", targetPartyId: "target_party_id", relationshipType: "relationship_type", createdAt: "created_at" } },
  conflicts: { table: "conflicts", fields: { id: "id", matterId: "matter_id", result: "result", checkedAt: "checked_at", checkedBy: "checked_by" } },
  documents: { table: "documents", fields: { id: "id", matterId: "matter_id", documentType: "document_type", status: "status", storageKey: "storage_key", createdAt: "created_at" } },
  evidence: { table: "evidence", fields: { id: "id", matterId: "matter_id", evidenceType: "evidence_type", status: "status", sourceDocumentId: "source_document_id", createdAt: "created_at" } },
  aiInteractions: { table: "ai_interactions", fields: { id: "id", matterId: "matter_id", interactionType: "interaction_type", confidence: "confidence", provenanceState: "provenance_state", humanReviewRequired: "human_review_required", createdAt: "created_at" } },
  reviews: { table: "reviews", fields: { id: "id", matterId: "matter_id", aiInteractionId: "ai_interaction_id", reviewerId: "reviewer_id", status: "status", finalActionAuthorized: "final_action_authorized", createdAt: "created_at", decidedAt: "decided_at" } },
  audit: { table: "audit_events", fields: { id: "id", actorId: "actor_id", actorType: "actor_type", matterId: "matter_id", eventType: "event_type", payload: "payload_json", payloadJson: "payload_json", createdAt: "created_at" } },
  sources: { table: "sources", fields: { id: "id", sourceType: "source_type", jurisdictionCode: "jurisdiction_code", title: "title", verificationState: "verification_state", effectiveDate: "effective_date", createdAt: "created_at", issuingAuthority: "issuing_authority", locator: "locator", checksum: "checksum", license: "license", fetchedAt: "fetched_at", registeredBy: "registered_by", verifiedBy: "verified_by", verifiedAt: "verified_at", verificationEvidence: "verification_evidence", staleReason: "stale_reason", staleAt: "stale_at", markedStaleBy: "marked_stale_by" } },
  legalVersions: { table: "legal_versions", fields: { id: "id", legalInstrumentId: "legal_instrument_id", jurisdictionCode: "jurisdiction_code", title: "title", validFrom: "valid_from", validTo: "valid_to", amendmentState: "amendment_state", sourceId: "source_id", createdAt: "created_at" } },
  authorities: { table: "authorities", fields: { id: "id", jurisdictionCode: "jurisdiction_code", name: "name", authorityType: "authority_type", createdAt: "created_at" } },
  diary: { table: "diary_entries", fields: { id: "id", matterId: "matter_id", entryType: "entry_type", scheduledAt: "scheduled_at", status: "status", createdAt: "created_at" } },
  hearings: { table: "hearings", fields: { id: "id", matterId: "matter_id", authorityId: "authority_id", scheduledAt: "scheduled_at", status: "status", createdAt: "created_at" } },
  invoices: { table: "invoices", fields: { id: "id", clientId: "client_id", matterId: "matter_id", status: "status", currencyCode: "currency_code", totalAmount: "total_amount", issuedAt: "issued_at", dueAt: "due_at", createdAt: "created_at", updatedAt: "updated_at", issuedBy: "issued_by", idempotencyKey: "idempotency_key" } },
  payments: { table: "payments", fields: { id: "id", invoiceId: "invoice_id", status: "status", currencyCode: "currency_code", amount: "amount", providerReference: "provider_reference", createdAt: "created_at", provider: "provider", providerEventId: "provider_event_id", idempotencyKey: "idempotency_key", verifiedAt: "verified_at", reconciledAt: "reconciled_at", reconciledBy: "reconciled_by", failureReason: "failure_reason" } },
  partners: { table: "partners", fields: { id: "id", name: "name", verificationState: "verification_state", jurisdictions: "jurisdictions_json", jurisdictionsJson: "jurisdictions_json", specialties: "specialties_json", specialtiesJson: "specialties_json", contact: "contact_json", contactJson: "contact_json", createdAt: "created_at" } },
  workPackages: { table: "work_packages", fields: { id: "id", matterId: "matter_id", state: "state", issue: "issue", jurisdiction: "jurisdiction", applicableDate: "applicable_date", payload: "payload_json", payloadJson: "payload_json", provenance: "provenance_json", provenanceJson: "provenance_json", confidence: "confidence", createdAt: "created_at", updatedAt: "updated_at", createdBy: "created_by", approvedBy: "approved_by", finalizedBy: "finalized_by" } },
  messages: { table: "messages", fields: { id: "id", matterId: "matter_id", clientId: "client_id", channel: "channel", provider: "provider", templateId: "template_id", templateVersion: "template_version", recipientRef: "recipient_ref", status: "status", providerMessageId: "provider_message_id", idempotencyKey: "idempotency_key", attemptCount: "attempt_count", nextRetryAt: "next_retry_at", failureReason: "failure_reason", payload: "payload_json", payloadJson: "payload_json", createdAt: "created_at", updatedAt: "updated_at", verifiedAt: "verified_at", deliveredAt: "delivered_at", failedAt: "failed_at" } }
});

const JSON_FIELDS = new Set([
  "audit.payload", "audit.payloadJson",
  "partners.jurisdictions", "partners.jurisdictionsJson", "partners.specialties", "partners.specialtiesJson", "partners.contact", "partners.contactJson",
  "workPackages.payload", "workPackages.payloadJson", "workPackages.provenance", "workPackages.provenanceJson",
  "messages.payload", "messages.payloadJson"
]);
const READ_ALIASES = Object.freeze({ assigned_user_id: "ownerId" });

function safeIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error("Unsafe SQL identifier");
  return value;
}
function serialize(name, field, value) {
  return JSON_FIELDS.has(`${name}.${field}`) && value !== null && value !== undefined ? JSON.stringify(value) : value;
}
function deserialize(name, row) {
  const definition = DEFINITIONS[name];
  const result = {};
  for (const [field, column] of Object.entries(definition.fields)) {
    if (!Object.prototype.hasOwnProperty.call(row, column)) continue;
    let value = row[column];
    if (JSON_FIELDS.has(`${name}.${field}`) && typeof value === "string") {
      try { value = JSON.parse(value); } catch { /* preserve malformed legacy data */ }
    }
    const outputField = ["payloadJson", "provenanceJson", "jurisdictionsJson", "specialtiesJson", "contactJson"].includes(field) ? field.replace(/Json$/, "") : (READ_ALIASES[column] || field);
    result[outputField] = value;
  }
  return result;
}
function createSqlRepository({ name, query } = {}) {
  const definition = DEFINITIONS[name];
  if (!definition) throw new Error(`Unsupported SQL repository: ${name}`);
  if (typeof query !== "function") throw new TypeError("SQL repository query function is required");
  const table = safeIdentifier(definition.table);
  const fields = definition.fields;
  function mapInput(input) {
    return Object.entries(input || {}).flatMap(([field, value]) => {
      const column = fields[field];
      return column ? [[safeIdentifier(column), serialize(name, field, value)]] : [];
    });
  }
  async function create(input = {}) {
    const record = { ...input, id: input.id || randomUUID() };
    const entries = mapInput(record);
    if (!entries.length) throw new Error(`No persistable fields supplied for repository: ${name}`);
    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value);
    const result = await query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.map(() => "?").join(", ")})`, values);
    return deserialize(name, (result.rows || [])[0] || record);
  }
  async function getById(id) {
    if (!id) throw new Error(`${name} id is required`);
    const result = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    return result.rows?.length ? deserialize(name, result.rows[0]) : null;
  }
  async function list() {
    const result = await query(`SELECT * FROM ${table}`);
    return (result.rows || []).map((row) => deserialize(name, row));
  }
  async function update(id, patch = {}) {
    if (!id) throw new Error(`${name} id is required`);
    const entries = mapInput(patch);
    if (!entries.length) return getById(id);
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
    const result = await query(`UPDATE ${table} SET ${assignments} WHERE id = ?`, [...values, id]);
    if (result.affectedRows === 0 || result.rowCount === 0) {
      const current = await getById(id);
      if (!current) throw new Error(`Record not found: ${id}`);
      return current;
    }
    return getById(id);
  }
  return Object.freeze({ create, getById, list, update });
}
function createSqlRepositories({ query } = {}) {
  const repositories = Object.fromEntries(Object.keys(DEFINITIONS).map((name) => [name, createSqlRepository({ name, query })]));
  const baseTransition = repositories.matters.update;
  repositories.matters = Object.freeze({
    ...repositories.matters,
    async transition(id, status, actor, review = null) {
      if (!actor?.id) throw new Error("Authenticated actor is required");
      return baseTransition(id, { status, updatedAt: new Date().toISOString(), lastTransitionBy: actor.id, lastReviewId: review?.id || null });
    }
  });
  repositories.auditService = Object.freeze({ append: (event) => repositories.audit.create(event), list: () => repositories.audit.list() });
  return Object.freeze(repositories);
}

module.exports = { DEFINITIONS, createSqlRepository, createSqlRepositories, deserialize, safeIdentifier };
