"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createAuditService } = require("./audit-service");
const { createReviewService } = require("./review-service");

function setup() {
  const auditRepo = createCollection();
  const reviewRepo = createCollection();
  const audit = createAuditService({ repository: auditRepo });
  const reviews = createReviewService({ repository: reviewRepo, audit });
  return { auditRepo, reviews };
}

test("human review records and approves an AI proposal", async () => {
  const { auditRepo, reviews } = setup();
  const actor = { id: "reviewer-1" };
  const review = await reviews.create({ matterId: "matter-1", aiInteractionId: "ai-1", proposedAction: "resolve", output: { recommendation: "resolution draft" }, actor });
  const approved = await reviews.decide(review, "approved", actor);
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewedBy, actor.id);
  const events = await auditRepo.list();
  assert.equal(events.length, 2);
  assert.ok(events.every((event) => event.id && event.eventType && event.actorId && event.createdAt));
  assert.equal(events[0].eventType, "human_review.created");
  assert.equal(events[1].eventType, "human_review.approved");
});

test("modified review requires explicit human modification", async () => {
  const { reviews } = setup();
  const actor = { id: "reviewer-2" };
  const review = await reviews.create({ matterId: "matter-2", proposedAction: "close", output: "AI draft", actor });
  await assert.rejects(() => reviews.decide(review, "modified", actor), /Modification is required/);
  const modified = await reviews.decide(review, "modified", actor, "human revised draft");
  assert.equal(modified.status, "modified");
});

test("final action cannot proceed without human approval", async () => {
  const { reviews } = setup();
  const actor = { id: "reviewer-3" };
  const review = await reviews.create({ matterId: "matter-3", proposedAction: "resolve", output: "AI result", actor });
  const unauthorizedActor = { id: "different-reviewer" };
  await assert.rejects(() => reviews.authorizeFinalAction(review, "resolve", unauthorizedActor), /reviewing human actor/);
  const approved = await reviews.decide(review, "approved", actor);
  const authorization = await reviews.authorizeFinalAction(approved, "resolve", actor);
  assert.equal(authorization.authorized, true);
});

test("final action rejects a different actor", async () => {
  const { reviews } = setup();
  const actor = { id: "reviewer-4" };
  const review = await reviews.create({ matterId: "matter-4", proposedAction: "archive", output: "AI result", actor });
  const approved = await reviews.decide(review, "approved", actor);
  await assert.rejects(() => reviews.authorizeFinalAction(approved, "archive", { id: "other-user" }), /reviewing human actor/);
});
