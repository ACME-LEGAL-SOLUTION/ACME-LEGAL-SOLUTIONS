"use strict";

const FINAL_ACTIONS = new Set(["resolve", "close", "archive"]);
const STATUSES = Object.freeze(["pending", "approved", "rejected", "modified"]);

function createReviewService({ repository, audit = null, clock = () => new Date() } = {}) {
  if (!repository?.create) throw new Error("Review repository is not configured");

  async function recordAudit(type, payload, actor) {
    if (!audit?.append) return;
    await audit.append({ type, actorId: actor.id, payload, occurredAt: clock().toISOString() });
  }

  return {
    async create({ matterId, aiInteractionId, proposedAction, output, actor }) {
      if (!matterId) throw new Error("Matter is required");
      if (!actor?.id) throw new Error("Authenticated reviewer is required");
      if (!proposedAction) throw new Error("Proposed action is required");
      const review = await repository.create({
        matterId,
        aiInteractionId: aiInteractionId || null,
        proposedAction,
        originalOutput: output ?? null,
        status: "pending",
        createdBy: actor.id,
        createdAt: clock().toISOString()
      });
      await recordAudit("human_review.created", review, actor);
      return review;
    },

    async decide(review, decision, actor, modification = null) {
      if (!review?.id) throw new Error("Review is required");
      if (!actor?.id) throw new Error("Authenticated reviewer is required");
      if (!["approved", "rejected", "modified"].includes(decision)) {
        throw new Error(`Invalid review decision: ${decision}`);
      }
      if (decision === "modified" && modification == null) {
        throw new Error("Modification is required for a modified review");
      }
      const updated = await repository.update(review.id, {
        status: decision,
        reviewedBy: actor.id,
        reviewedAt: clock().toISOString(),
        modifiedOutput: decision === "modified" ? modification : null
      });
      await recordAudit(`human_review.${decision}`, updated, actor);
      return updated;
    },

    async authorizeFinalAction(review, action, actor) {
      if (!review?.id) throw new Error("Review is required");
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!FINAL_ACTIONS.has(action)) throw new Error(`Unsupported final action: ${action}`);
      if (!review.reviewedBy || review.reviewedBy !== actor.id) {
        throw new Error("Final action requires the reviewing human actor");
      }
      if (!["approved", "modified"].includes(review.status)) {
        throw new Error("Final human action requires an approved or modified review");
      }
      await recordAudit("human_review.final_action_authorized", { reviewId: review.id, action }, actor);
      return { authorized: true, reviewId: review.id, action, actorId: actor.id };
    },

    STATUSES
  };
}

module.exports = { FINAL_ACTIONS, STATUSES, createReviewService };
