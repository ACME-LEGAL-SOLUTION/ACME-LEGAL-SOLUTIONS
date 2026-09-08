"use strict";

const TYPES = Object.freeze(["document", "statement", "image", "audio", "video", "record", "other"]);
const STATUSES = Object.freeze(["unverified", "verified", "disputed", "rejected"]);

function createEvidenceService({ repositories, clock = () => new Date() } = {}) {
  if (!repositories?.evidence?.create || !repositories?.evidence?.getById) {
    throw new Error("Evidence repository is required");
  }

  async function createEvidence(input, actor) {
    requireActor(actor);
    if (!input?.matterId) throw new Error("Matter id is required");
    if (!input?.type || !TYPES.includes(input.type)) throw new Error(`Invalid evidence type: ${input?.type}`);
    if (!input.title?.trim()) throw new Error("Evidence title is required");

    return repositories.evidence.create({
      matterId: input.matterId,
      documentId: input.documentId || null,
      type: input.type,
      title: input.title.trim(),
      status: input.status || "unverified",
      provenance: input.provenance || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
      createdBy: actor.id,
      createdAt: clock().toISOString()
    }, actor);
  }

  async function getEvidence(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Evidence id is required");
    return repositories.evidence.getById(id);
  }

  return { createEvidence, getEvidence };
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { TYPES, STATUSES, createEvidenceService };
