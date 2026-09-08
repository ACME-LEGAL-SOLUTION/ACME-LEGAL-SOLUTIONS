"use strict";

const VERIFICATION_STATES = Object.freeze(["pending", "verified", "rejected", "expired"]);

function createNetworkService({ repository, audit = null, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Partner repository is not configured");
  async function auditEvent(type, payload, actor) {
    if (audit?.append) await audit.append({ type, actorId: actor.id, payload, occurredAt: clock().toISOString() });
  }
  return {
    async registerPartner({ name, jurisdictions = [], specialties = [], contact = null, actor }) {
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!name) throw new Error("Partner name is required");
      const partner = await repository.create({ name, jurisdictions, specialties, contact, verificationState: "pending", createdBy: actor.id, createdAt: clock().toISOString() });
      await auditEvent("partner.registered", partner, actor);
      return partner;
    },
    async verifyPartner(partner, actor, verificationState = "verified", evidence = []) {
      if (!partner?.id) throw new Error("Partner is required");
      if (!actor?.id) throw new Error("Authenticated verifier is required");
      if (!VERIFICATION_STATES.includes(verificationState)) throw new Error(`Invalid verification state: ${verificationState}`);
      if (verificationState === "verified" && evidence.length === 0) throw new Error("Verification evidence is required");
      const updated = await repository.update(partner.id, { verificationState, verificationEvidence: evidence, verifiedBy: actor.id, verifiedAt: clock().toISOString() });
      await auditEvent("partner.verification_changed", updated, actor);
      return updated;
    },
    VERIFICATION_STATES
  };
}

module.exports = { VERIFICATION_STATES, createNetworkService };
