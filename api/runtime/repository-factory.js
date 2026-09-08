"use strict";

const { createCollection } = require("./in-memory-repository");

const COLLECTIONS = Object.freeze([
  "clients", "relationships", "parties", "conflicts", "documents", "evidence",
  "aiInteractions", "reviews", "audit", "sources", "legalVersions", "authorities",
  "diary", "hearings", "invoices", "payments", "partners"
]);

function createApplicationRepositories({ clock = () => new Date() } = {}) {
  const repositories = Object.fromEntries(COLLECTIONS.map((name) => [name, createCollection()]));
  repositories.auditService = {
    append: async (event) => repositories.audit.create(event),
    list: async () => repositories.audit.list()
  };

  const matters = createCollection();
  repositories.matters = {
    ...matters,
    async transition(id, status, actor, review = null) {
      return matters.update(id, {
        status,
        updatedAt: clock().toISOString(),
        lastTransitionBy: actor.id,
        lastReviewId: review?.id || null
      });
    }
  };

  return repositories;
}

module.exports = { COLLECTIONS, createApplicationRepositories };
