"use strict";

const { createGovernance } = require("./governance");

const DECISION_STATES = Object.freeze(["proposed", "review_required", "approved", "rejected"]);

function createAIGateway({ repositories = {}, provider, clock = () => new Date() } = {}) {
  if (!provider?.execute) throw new Error("AI provider adapter is not configured");
  if (!repositories.aiInteractions) throw new Error("AI interaction repository is required");

  const governance = createGovernance({ repositories, clock });

  async function execute({ matterId, actor, task, context = {}, tools = [] }) {
    if (!matterId) throw new Error("Matter scope is required");
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!task) throw new Error("AI task is required");

    const result = await provider.execute({ matterId, actor, task, context, tools });
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

  return Object.freeze({ execute, governance, DECISION_STATES });
}

module.exports = { DECISION_STATES, createAIGateway };
