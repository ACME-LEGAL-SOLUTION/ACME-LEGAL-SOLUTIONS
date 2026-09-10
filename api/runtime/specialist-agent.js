"use strict";

const { createAIProviderContract } = require("./ai-provider-contract");

const SPECIALIST_ROLES = Object.freeze(["legal_research", "tax", "accounting", "corporate", "compliance", "cross_border"]);

function createSpecialistAgent({ role, provider, knowledgeGateway = null, clock = () => new Date() } = {}) {
  if (!SPECIALIST_ROLES.includes(role)) throw new Error(`Unsupported specialist role: ${role}`);
  const adapter = createAIProviderContract(provider);
  if (knowledgeGateway && typeof knowledgeGateway.retrieve !== "function") throw new TypeError("Knowledge gateway is incomplete");

  async function execute({ matterId, actor, task, context = {}, tools = [] } = {}) {
    if (!matterId) throw new Error("Matter scope is required");
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!task) throw new Error("Specialist task is required");
    const startedAt = clock().toISOString();
    let knowledge = null;
    if (knowledgeGateway && context.jurisdiction) {
      knowledge = await knowledgeGateway.retrieve({
        jurisdiction: context.jurisdiction,
        date: context.effectiveDate || context.date || null,
        actor,
        sourceIds: context.sourceIds || [],
        legalInstrumentIds: context.legalInstrumentIds || [],
        authorityIds: context.authorityIds || [],
        evidenceIds: context.evidenceIds || []
      });
    }
    return adapter.execute({
      matterId,
      actor,
      task,
      context: { ...context, specialistRole: role, governedKnowledge: knowledge },
      tools,
      metadata: { specialistRole: role, startedAt, provenance: knowledge?.provenance || [] }
    });
  }

  return Object.freeze({ role, providerId: adapter.id, execute });
}

module.exports = { SPECIALIST_ROLES, createSpecialistAgent };
