"use strict";

const SOURCE_TYPES = Object.freeze(["primary_authority", "secondary_authority", "commentary", "historical_material", "unverified_info", "ai_inference"]);

function createSourceService({ repository, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Source repository is not configured");

  return {
    async register({ title, sourceType, jurisdiction, issuingAuthority = null, effectiveDate = null, verificationState = "unverified", locator = null, actor }) {
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!title) throw new Error("Source title is required");
      if (!SOURCE_TYPES.includes(sourceType)) throw new Error(`Invalid source type: ${sourceType}`);
      if (!jurisdiction) throw new Error("Jurisdiction is required");
      return repository.create({ title, sourceType, jurisdiction, issuingAuthority, effectiveDate, verificationState, locator, registeredBy: actor.id, createdAt: clock().toISOString() });
    },
    async verify(source, actor, verificationState = "verified") {
      if (!source?.id) throw new Error("Source is required");
      if (!actor?.id) throw new Error("Authenticated verifier is required");
      if (!source.issuingAuthority && source.sourceType === "primary_authority") throw new Error("Primary authority requires issuing authority");
      return repository.update(source.id, { verificationState, verifiedBy: actor.id, verifiedAt: clock().toISOString() });
    },
    SOURCE_TYPES
  };
}

module.exports = { SOURCE_TYPES, createSourceService };
