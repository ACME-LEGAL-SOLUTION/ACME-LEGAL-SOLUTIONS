"use strict";

/**
 * Relationship service for the ACME party/client graph.
 *
 * Relationships are first-class records so conflict checking, client context,
 * reassignment and matter authorization can consume the same server-side
 * relationship graph without coupling domain logic to a storage vendor.
 */

const TYPES = Object.freeze([
  "client",
  "representative",
  "employee",
  "director",
  "owner",
  "beneficial_owner",
  "parent",
  "subsidiary",
  "affiliate",
  "opposing_party",
  "counsel",
  "witness",
  "other"
]);

function createRelationshipService({ repositories, clock = () => new Date() } = {}) {
  if (!repositories?.relationships?.create || !repositories?.relationships?.getById) {
    throw new Error("Relationship repository is required");
  }

  async function createRelationship(input, actor) {
    requireActor(actor);
    if (!input?.fromId || !input?.toId) throw new Error("Relationship endpoints are required");
    if (input.fromId === input.toId) throw new Error("Relationship endpoints must differ");
    if (!TYPES.includes(input.type)) throw new Error(`Invalid relationship type: ${input.type}`);

    return repositories.relationships.create({
      fromId: input.fromId,
      toId: input.toId,
      type: input.type,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
      createdBy: actor.id,
      createdAt: clock().toISOString()
    }, actor);
  }

  async function getRelationship(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Relationship id is required");
    return repositories.relationships.getById(id);
  }

  async function listForParty(partyId, actor) {
    requireActor(actor);
    if (!partyId) throw new Error("Party id is required");
    if (!repositories.relationships.list) throw new Error("Relationship listing repository is not configured");
    const records = await repositories.relationships.list();
    return records.filter((record) => record.fromId === partyId || record.toId === partyId);
  }

  return { createRelationship, getRelationship, listForParty };
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { TYPES, createRelationshipService };
