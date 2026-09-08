"use strict";

/**
 * Server-side party registry boundary used by matters and conflict checks.
 * A party can be a person or organization; identity resolution remains an
 * injected repository concern so the domain layer stays provider-neutral.
 */

const KINDS = Object.freeze(["person", "organization"]);

function createPartyService({ repositories, clock = () => new Date() } = {}) {
  if (!repositories?.parties?.create || !repositories?.parties?.getById) {
    throw new Error("Party repository is required");
  }

  async function createParty(input, actor) {
    requireActor(actor);
    if (!input || typeof input !== "object") throw new TypeError("Party input is required");
    if (!KINDS.includes(input.kind)) throw new Error(`Invalid party kind: ${input.kind}`);
    if (!input.displayName?.trim()) throw new Error("Party displayName is required");

    return repositories.parties.create({
      ...input,
      displayName: input.displayName.trim(),
      createdBy: actor.id,
      createdAt: clock().toISOString()
    }, actor);
  }

  async function getParty(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Party id is required");
    return repositories.parties.getById(id);
  }

  return { createParty, getParty };
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { KINDS, createPartyService };
