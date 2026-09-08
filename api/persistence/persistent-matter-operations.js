"use strict";

/**
 * Persistent matter-domain orchestration for party, relationship, conflict,
 * document, evidence and audit mutations. Compound workflows execute inside
 * one transaction and require canonical matter authorization before work.
 */
function createPersistentMatterOperations({ transaction, repositories, repositoryFactory, matterAuthorization = null, clock = () => new Date() } = {}) {
  if (!transaction?.run) throw new TypeError("Transaction boundary is required");
  if (!repositories?.parties || !repositories?.relationships || !repositories?.conflicts || !repositories?.documents || !repositories?.evidence || !repositories?.audit) {
    throw new TypeError("Party, relationship, conflict, document, evidence and audit repositories are required");
  }
  if (typeof repositoryFactory !== "function") throw new TypeError("Transaction-scoped repository factory is required");

  const authorize = async (actor, matterId, action) => {
    if (!actor?.id) throw new TypeError("Authenticated actor is required");
    if (!matterId) throw new TypeError("Matter id is required");
    if (matterAuthorization) await matterAuthorization.assert(actor, matterId, action);
  };

  async function run({ actor, matterId, action = "update", work } = {}) {
    if (typeof work !== "function") throw new TypeError("Matter operation work function is required");
    await authorize(actor, matterId, action);
    return transaction.run((tx) => work({ tx, actor, matterId, repositories: repositoryFactory(tx) }));
  }

  async function addParty({ actor, matterId, party } = {}) {
    return run({ actor, matterId, action: "update", work: ({ repositories: repos }) => repos.parties.create({
      id: party.id,
      matterId,
      partyType: party.kind || party.partyType,
      displayName: String(party.displayName || "").trim(),
      createdAt: party.createdAt || clock().toISOString()
    }, actor) });
  }

  async function addRelationship({ actor, matterId, relationship } = {}) {
    return run({ actor, matterId, action: "update", work: ({ repositories: repos }) => repos.relationships.create({
      id: relationship.id,
      sourcePartyId: relationship.fromId || relationship.sourcePartyId,
      targetPartyId: relationship.toId || relationship.targetPartyId,
      relationshipType: relationship.type || relationship.relationshipType,
      createdAt: relationship.createdAt || clock().toISOString()
    }, actor) });
  }

  async function recordConflictCheck({ actor, matterId, conflict } = {}) {
    return run({ actor, matterId, action: "review", work: ({ repositories: repos }) => repos.conflicts.create({
      id: conflict.id,
      matterId,
      result: conflict.result,
      checkedAt: conflict.checkedAt || clock().toISOString(),
      checkedBy: actor.id
    }, actor) });
  }

  async function addDocument({ actor, matterId, document } = {}) {
    if (!document?.storageKey) throw new TypeError("Document storageKey is required for persistent storage");
    return run({ actor, matterId, action: "update", work: ({ repositories: repos }) => repos.documents.create({
      id: document.id,
      matterId,
      documentType: document.type || document.documentType,
      status: document.status || "received",
      storageKey: document.storageKey,
      createdAt: document.createdAt || clock().toISOString()
    }, actor) });
  }

  async function addEvidence({ actor, matterId, evidence } = {}) {
    return run({ actor, matterId, action: "update", work: ({ repositories: repos }) => repos.evidence.create({
      id: evidence.id,
      matterId,
      evidenceType: evidence.type || evidence.evidenceType,
      status: evidence.status || "unverified",
      sourceDocumentId: evidence.documentId || evidence.sourceDocumentId || null,
      createdAt: evidence.createdAt || clock().toISOString()
    }, actor) });
  }

  async function appendAudit({ actor, matterId, event } = {}) {
    return run({ actor, matterId, action: "audit", work: ({ repositories: repos }) => repos.audit.create({
      id: event.id,
      actorId: actor.id,
      actorType: actor.type || "user",
      matterId,
      eventType: event.eventType,
      payloadJson: event.payload || event.payloadJson || {},
      createdAt: event.createdAt || clock().toISOString()
    }, actor) });
  }

  async function createMatterEvidenceChain({ actor, matterId, party, relationship, conflict, document, evidence, audit } = {}) {
    return run({ actor, matterId, action: "update", work: async ({ repositories: repos }) => {
      const createdParty = await repos.parties.create({ id: party.id, matterId, partyType: party.kind || party.partyType, displayName: String(party.displayName || "").trim(), createdAt: clock().toISOString() }, actor);
      const createdRelationship = await repos.relationships.create({ id: relationship.id, sourcePartyId: relationship.fromId || relationship.sourcePartyId, targetPartyId: relationship.toId || relationship.targetPartyId, relationshipType: relationship.type || relationship.relationshipType, createdAt: clock().toISOString() }, actor);
      const createdConflict = await repos.conflicts.create({ id: conflict.id, matterId, result: conflict.result, checkedAt: clock().toISOString(), checkedBy: actor.id }, actor);
      if (!document?.storageKey) throw new TypeError("Document storageKey is required for persistent storage");
      const createdDocument = await repos.documents.create({ id: document.id, matterId, documentType: document.type || document.documentType, status: document.status || "received", storageKey: document.storageKey, createdAt: clock().toISOString() }, actor);
      const createdEvidence = await repos.evidence.create({ id: evidence.id, matterId, evidenceType: evidence.type || evidence.evidenceType, status: evidence.status || "unverified", sourceDocumentId: document.id, createdAt: clock().toISOString() }, actor);
      const createdAudit = await repos.audit.create({ id: audit.id, actorId: actor.id, actorType: actor.type || "user", matterId, eventType: audit.eventType || "matter.evidence_chain.created", payloadJson: audit.payload || {}, createdAt: clock().toISOString() }, actor);
      return { party: createdParty, relationship: createdRelationship, conflict: createdConflict, document: createdDocument, evidence: createdEvidence, audit: createdAudit };
    } });
  }

  return Object.freeze({ run, addParty, addRelationship, recordConflictCheck, addDocument, addEvidence, appendAudit, createMatterEvidenceChain });
}

module.exports = { createPersistentMatterOperations };
