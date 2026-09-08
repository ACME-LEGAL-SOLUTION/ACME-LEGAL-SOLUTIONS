"use strict";

function createAuthorityService({ repository, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Authority repository is not configured");
  return {
    async register({ name, jurisdiction, authorityType, locator = null, actor }) {
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!name || !jurisdiction || !authorityType) throw new Error("Authority name, jurisdiction and type are required");
      return repository.create({ name, jurisdiction, authorityType, locator, createdBy: actor.id, createdAt: clock().toISOString() });
    },
    async listByJurisdiction(jurisdiction) {
      if (!jurisdiction) throw new Error("Jurisdiction is required");
      return (await repository.list()).filter((item) => item.jurisdiction === jurisdiction);
    }
  };
}

module.exports = { createAuthorityService };
