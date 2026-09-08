"use strict";

const TYPES = Object.freeze(["client_identity", "pleading", "order", "contract", "evidence", "correspondence", "invoice", "other"]);
const STATUSES = Object.freeze(["received", "processing", "classified", "verified", "rejected", "archived"]);

function createDocumentService({ repositories, clock = () => new Date() } = {}) {
  if (!repositories?.documents?.create || !repositories?.documents?.getById) {
    throw new Error("Document repository is required");
  }

  async function createDocument(input, actor) {
    requireActor(actor);
    if (!input?.matterId) throw new Error("Matter id is required");
    if (!input.name?.trim()) throw new Error("Document name is required");
    if (!TYPES.includes(input.type)) throw new Error(`Invalid document type: ${input.type}`);

    return repositories.documents.create({
      matterId: input.matterId,
      name: input.name.trim(),
      type: input.type,
      status: input.status || "received",
      source: input.source || "client",
      storageKey: input.storageKey || null,
      mimeType: input.mimeType || null,
      checksum: input.checksum || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
      createdBy: actor.id,
      createdAt: clock().toISOString()
    }, actor);
  }

  async function getDocument(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Document id is required");
    return repositories.documents.getById(id);
  }

  return { createDocument, getDocument };
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { TYPES, STATUSES, createDocumentService };
