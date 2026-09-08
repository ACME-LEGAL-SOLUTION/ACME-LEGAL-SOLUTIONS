"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createIntakeService } = require("./intake-service");

test("intake creates a prospective client and lead matter", async () => {
  const repositories = createApplicationRepositories();
  const intake = createIntakeService({ repositories });
  const result = await intake.start({ client: { name: "Test Client" }, matter: { title: "Consultation" } }, { id: "actor-1" });
  assert.equal(result.client.status, "prospective");
  assert.equal(result.matter.status, "lead");
  assert.equal(result.matter.intakeState, "intake");
  assert.equal(result.matter.clientId, result.client.id);
});

test("intake requires human approval before final action", async () => {
  const repositories = createApplicationRepositories();
  const intake = createIntakeService({ repositories });
  const initial = await intake.start({ client: { name: "Test Client" }, matter: { title: "Consultation" } }, { id: "actor-1" });
  const verified = await intake.transition(initial, "verified", { id: "actor-1" });
  const conflict = await intake.transition(verified, "conflict_check", { id: "actor-1" });
  const opened = await intake.transition(conflict, "matter_open", { id: "actor-1" });
  const work = await intake.transition(opened, "professional_work", { id: "actor-1" });
  const review = await intake.transition(work, "review", { id: "actor-1" });
  const approved = await intake.transition(review, "approved", { id: "actor-1" }, { status: "approved" });
  assert.equal(approved.intakeState, "approved");
  await assert.rejects(
    () => intake.transition(approved, "final_action", { id: "actor-1" }),
    /Human review and approval are required/
  );
  const finalAction = await intake.transition(approved, "final_action", { id: "actor-1" }, { status: "approved" });
  assert.equal(finalAction.intakeState, "final_action");
});
