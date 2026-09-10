"use strict";

const { createAIProviderContract } = require("./ai-provider-contract");

const SPECIALIST_ROLES = Object.freeze(["legal_research", "tax", "accounting", "corporate", "compliance", "cross_border"]);

function createSpecialistAgent({ role, provider, clock = () => new Date() } = {}) {
  if (!SPECIALIST_ROLES.includes(role)) throw new Error(`Unsupported specialist role: ${role}`);
  const adapter = createAIProviderContract(provider);

  async function execute({ matterId, actor, task, context = {}, tools = [] } = {}) {
    if (!matterId) throw new Error("Matter scope is required");
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!task) throw new Error("Specialist task is required");
    const startedAt = clock().toISOString();
    return adapter.execute({
      matterId,
      actor,
      task,
      context: { ...context, specialistRole: role },
      tools,
      metadata: { specialistRole: role, startedAt }
    });
  }

  return Object.freeze({ role, providerId: adapter.id, execute });
}

module.exports = { SPECIALIST_ROLES, createSpecialistAgent };
