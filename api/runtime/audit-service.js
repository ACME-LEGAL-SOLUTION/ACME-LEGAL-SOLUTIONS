"use strict";

const { randomUUID } = require("node:crypto");

/**
 * Append-only audit boundary. Persistence is injected so production storage
 * can be replaced without changing governance semantics.
 */
function createAuditService({ repository, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Audit repository is not configured");

  return {
    async append({ type, actorId, actorType = "user", payload = {}, occurredAt = clock().toISOString() }) {
      if (!type) throw new Error("Audit event type is required");
      if (!actorId) throw new Error("Authenticated actor is required");
      const event = {
        id: randomUUID(),
        eventType: type,
        actorId,
        actorType,
        payloadJson: payload,
        createdAt: occurredAt,
        appendOnly: true
      };
      return repository.create(event);
    },

    async list() {
      if (!repository.list) throw new Error("Audit repository listing is not configured");
      return repository.list();
    }
  };
}

module.exports = { createAuditService };
