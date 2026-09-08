"use strict";

/**
 * Provider-neutral conflict-check boundary.
 *
 * A production implementation must resolve relationships, parties and
 * jurisdiction-specific conflict policy through injected repositories. This
 * service deliberately does not decide that a matter is conflict-free on its
 * own; it records a deterministic check result and leaves final professional
 * action to the configured workflow.
 */

const RESULTS = Object.freeze(["clear", "potential", "blocked"]);

function createConflictService({ repositories, clock = () => new Date() } = {}) {
  if (!repositories?.conflicts?.create || !repositories?.conflicts?.getById) {
    throw new Error("Conflict repository is required");
  }

  async function checkMatter(input, actor) {
    requireActor(actor);
    if (!input?.matterId) throw new Error("Matter id is required");
    if (!Array.isArray(input.partyIds) || input.partyIds.length === 0) {
      throw new Error("At least one party is required for conflict checking");
    }
    if (!RESULTS.includes(input.result)) {
      throw new Error(`Invalid conflict result: ${input.result}`);
    }

    return repositories.conflicts.create({
      matterId: input.matterId,
      partyIds: [...new Set(input.partyIds)],
      result: input.result,
      matches: Array.isArray(input.matches) ? input.matches : [],
      notes: input.notes || null,
      checkedBy: actor.id,
      checkedAt: clock().toISOString()
    }, actor);
  }

  async function getCheck(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Conflict check id is required");
    return repositories.conflicts.getById(id);
  }

  return { checkMatter, getCheck };
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { RESULTS, createConflictService };
