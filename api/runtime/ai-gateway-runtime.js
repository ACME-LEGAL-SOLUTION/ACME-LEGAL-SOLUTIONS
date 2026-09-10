"use strict";

const { createGovernance } = require("./governance");
const { FINAL_ACTIONS } = require("./review-service");
const { createAIProviderContract } = require("./ai-provider-contract");

const DECISION_STATES = Object.freeze(["proposed", "review_required", "approved", "rejected"]);

function toolName(tool) {
  if (typeof tool === "string") return tool;
  if (!tool || typeof tool !== "object") return null;
  return tool.name || tool.action || tool.id || null;
}

function assertNoFinalActionTools(tools) {
  for (const tool of tools) {
    const name = toolName(tool);
    if (name && FINAL_ACTIONS.has(name)) {
      throw new Error(`AI cannot invoke final human action tool: ${name}`);
    }
  }
}

function createAIGateway({ repositories = {}, provider, specialistAgent = null, clock = () => new Date() } = {}) {
  if (!provider?.execute) throw new Error("AI provider adapter is not configured");
  if (!repositories.aiInteractions) throw new Error("AI interaction repository is required");
  const providerAdapter = createAIProviderContract(provider);
  if (specialistAgent && typeof specialistAgent.execute !== "function") throw new TypeError("Specialist agent is incomplete");

  const governance = createGovernance({ repositories, clock });

  async function execute({ matterId, actor, task, context = {}, tools = [] }) {
    if (!matterId) throw new Error("Matter scope is required");
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!task) throw new Error("AI task is required");
    if (!Array.isArray(tools)) throw new TypeError("AI tools must be an array");
    assertNoFinalActionTools(tools);

    const result = specialistAgent
      ? await specialistAgent.execute({ matterId, actor, task, context, tools })
      : await providerAdapter.execute({ matterId, actor, task, context, tools });
    const interaction = await repositories.aiInteractions.create({
      matterId,
      actorId: actor.id,
      task,
      context,
      tools,
      output: result,
      decisionState: "proposed",
      createdAt: clock().toISOString()
    });

    const review = await governance.reviews.create({
      matterId,
      aiInteractionId: interaction.id,
      proposedAction: task,
      output: result,
      actor
    });

    return { interaction, review, decisionState: "review_required" };
  }

  return Object.freeze({ execute, governance, DECISION_STATES, providerId: providerAdapter.id });
}

module.exports = { DECISION_STATES, createAIGateway, assertNoFinalActionTools };
