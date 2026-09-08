"use strict";

/**
 * ACME runtime foundation.
 *
 * This module deliberately contains no provider-specific database, auth, AI,
 * payment, or messaging implementation. Those dependencies are injected at
 * the application boundary so the platform remains replaceable and testable.
 */

const STATES = Object.freeze([
  "lead",
  "verified",
  "conflict_check",
  "matter_open",
  "active",
  "review",
  "resolved",
  "closed",
  "archived"
]);

const HUMAN_GATED_STATES = new Set(["resolved", "closed", "archived"]);

function createRuntime({ repositories = {}, audit = null, clock = () => new Date() } = {}) {
  const runtime = {
    repositories,
    audit,
    clock,

    async createMatter(input, actor) {
      if (!input || typeof input !== "object") {
        throw new TypeError("Matter input is required");
      }
      if (!actor || !actor.id) {
        throw new Error("Authenticated actor is required");
      }
      if (!repositories.matters?.create) {
        throw new Error("Matter repository is not configured");
      }

      const matter = {
        ...input,
        status: input.status || "lead",
        ownerId: input.ownerId || actor.id,
        createdAt: clock().toISOString()
      };

      if (!STATES.includes(matter.status)) {
        throw new Error(`Invalid matter status: ${matter.status}`);
      }

      const created = await repositories.matters.create(matter, actor);
      await auditEvent("matter.created", created, actor);
      return created;
    },

    async transitionMatter(matter, nextStatus, actor, review = null) {
      if (!matter?.id) throw new Error("Matter is required");
      if (!STATES.includes(nextStatus)) throw new Error(`Invalid matter status: ${nextStatus}`);
      if (!actor?.id) throw new Error("Authenticated actor is required");

      if (HUMAN_GATED_STATES.has(nextStatus) && review?.approved !== true) {
        throw new Error("Human review and approval are required before this transition");
      }

      if (!repositories.matters?.transition) {
        throw new Error("Matter transition repository is not configured");
      }

      const updated = await repositories.matters.transition(matter.id, nextStatus, actor, review);
      await auditEvent("matter.transitioned", { id: matter.id, from: matter.status, to: nextStatus }, actor);
      return updated;
    }
  };

  async function auditEvent(type, payload, actor) {
    if (!audit?.append) return;
    await audit.append({ type, actorId: actor.id, payload, occurredAt: clock().toISOString() });
  }

  return runtime;
}

module.exports = { STATES, createRuntime };
