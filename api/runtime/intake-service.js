"use strict";

const INTAKE_STATES = Object.freeze([
  "intake", "verified", "conflict_check", "matter_open", "professional_work",
  "review", "approved", "final_action", "client_contact", "billing", "closed", "archived"
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  intake: ["verified"],
  verified: ["conflict_check"],
  conflict_check: ["matter_open"],
  matter_open: ["professional_work"],
  professional_work: ["review"],
  review: ["approved"],
  approved: ["final_action"],
  final_action: ["client_contact"],
  client_contact: ["billing"],
  billing: ["closed"],
  closed: ["archived"],
  archived: []
});

function createIntakeService({ repositories, clock = () => new Date(), conflictCheck = null } = {}) {
  if (!repositories?.clients?.create || !repositories?.matters?.create) {
    throw new Error("Client and matter repositories are required");
  }

  async function start(input, actor) {
    requireActor(actor);
    if (!input || typeof input !== "object") throw new TypeError("Intake input is required");
    const client = await repositories.clients.create({
      ...(input.client || {}),
      status: "prospective",
      createdBy: actor.id,
      createdAt: clock().toISOString()
    }, actor);
    const matter = await repositories.matters.create({
      ...(input.matter || {}),
      clientId: client.id,
      status: "lead",
      intakeState: "intake",
      ownerId: actor.id,
      createdBy: actor.id,
      createdAt: clock().toISOString()
    }, actor);
    return { client, matter, intakeState: "intake" };
  }

  async function transition(intake, nextState, actor, review = null) {
    requireActor(actor);
    if (!intake?.matter?.id) throw new Error("Intake matter is required");
    if (!INTAKE_STATES.includes(nextState)) throw new Error(`Invalid intake state: ${nextState}`);
    if (!(ALLOWED_TRANSITIONS[intake.intakeState] || []).includes(nextState)) {
      throw new Error(`Invalid intake transition: ${intake.intakeState} -> ${nextState}`);
    }
    if (["approved", "final_action", "closed", "archived"].includes(nextState) && !["approved", "modified"].includes(review?.status)) {
      throw new Error("Human review and approval are required before this intake transition");
    }
    if (nextState === "conflict_check" && conflictCheck) {
      const result = await conflictCheck({ matterId: intake.matter.id, actor });
      if (result?.blocked === true) throw new Error("Conflict check blocked matter progression");
    }
    return { ...intake, intakeState: nextState, updatedAt: clock().toISOString(), updatedBy: actor.id };
  }

  return Object.freeze({ start, transition });
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { INTAKE_STATES, ALLOWED_TRANSITIONS, createIntakeService };
