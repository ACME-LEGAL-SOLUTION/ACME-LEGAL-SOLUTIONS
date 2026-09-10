"use strict";

const STATES = Object.freeze(["draft", "review", "modified", "approved", "finalized"]);
const REQUIRED_FIELDS = Object.freeze([
  "matterId", "issue", "facts", "jurisdiction", "applicableDate", "evidence",
  "authorities", "specialistFindings", "analysis", "uncertainty", "confidence",
  "recommendedActions", "requiredDocuments", "requiredTasks"
]);

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}

function createWorkPackage(input = {}) {
  for (const field of REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null) throw new TypeError(`Work package requires ${field}`);
  }
  if (!input.actor || !input.actor.id) throw new TypeError("Work package requires an actor");
  assertArray(input.evidence, "evidence");
  assertArray(input.authorities, "authorities");
  assertArray(input.specialistFindings, "specialistFindings");
  assertArray(input.recommendedActions, "recommendedActions");
  assertArray(input.requiredDocuments, "requiredDocuments");
  assertArray(input.requiredTasks, "requiredTasks");
  if (typeof input.confidence !== "number" || input.confidence < 0 || input.confidence > 1) {
    throw new TypeError("confidence must be a number between 0 and 1");
  }
  return Object.freeze({
    id: input.id || `wp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    version: 1,
    state: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    matterId: input.matterId,
    issue: input.issue,
    facts: input.facts,
    assumptions: input.assumptions || [],
    jurisdiction: input.jurisdiction,
    applicableDate: input.applicableDate,
    evidence: input.evidence,
    authorities: input.authorities,
    specialistFindings: input.specialistFindings,
    analysis: input.analysis,
    uncertainty: input.uncertainty,
    confidence: input.confidence,
    recommendedActions: input.recommendedActions,
    requiredDocuments: input.requiredDocuments,
    requiredTasks: input.requiredTasks,
    provenance: input.provenance || [],
    audit: [{ action: "created", actorId: input.actor.id, at: new Date().toISOString() }]
  });
}

function transitionWorkPackage(workPackage, targetState, actor, modification = null) {
  if (!workPackage || !STATES.includes(workPackage.state)) throw new TypeError("Invalid work package");
  if (!actor || !actor.id) throw new TypeError("Transition requires an actor");
  const allowed = {
    draft: ["review"], review: ["modified", "approved"], modified: ["review", "approved"], approved: ["finalized"], finalized: []
  };
  if (!allowed[workPackage.state].includes(targetState)) throw new Error(`Invalid work package transition: ${workPackage.state} -> ${targetState}`);
  if (targetState === "finalized" && actor.human !== true) throw new Error("Finalization requires explicit human action");
  if (targetState === "approved" && actor.human !== true) throw new Error("Approval requires explicit human action");
  if (targetState === "modified" && !modification) throw new TypeError("Modification details are required");
  const now = new Date().toISOString();
  return Object.freeze({
    ...workPackage,
    version: workPackage.version + 1,
    state: targetState,
    updatedAt: now,
    ...(targetState === "modified" ? modification : {}),
    audit: [...workPackage.audit, { action: targetState, actorId: actor.id, at: now, human: actor.human === true }]
  });
}

module.exports = { STATES, REQUIRED_FIELDS, createWorkPackage, transitionWorkPackage };
