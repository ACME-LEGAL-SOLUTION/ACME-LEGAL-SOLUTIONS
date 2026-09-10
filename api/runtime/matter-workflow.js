"use strict";

const { createWorkPackage, transitionWorkPackage } = require("./work-package-engine");
const { attachProvenance } = require("./work-package-provenance");
const { requireHumanGate } = require("./work-package-human-gate");

const STATES = Object.freeze(["intake", "matter", "conflict_check", "evidence", "routing", "knowledge", "work_package", "human_review", "human_modified", "human_approved", "final_action", "closed"]);

function createMatterWorkflow({ crm, conflict, document, evidence, specialistRouter, knowledge, clock = () => new Date() } = {}) {
  for (const [name, service] of Object.entries({ crm, conflict, document, evidence, specialistRouter, knowledge })) {
    if (!service) throw new Error(`${name} service is required`);
  }

  async function start(input, actor) {
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!input?.clientId || !input.issue) throw new Error("clientId and issue are required");
    const matter = await crm.createMatter({ clientId: input.clientId, title: input.title || input.issue, issue: input.issue, jurisdiction: input.jurisdiction, urgency: input.urgency }, actor);
    return Object.freeze({ id: matter.id, matter, state: "matter", events: [{ state: "matter", at: clock().toISOString(), actorId: actor.id }] });
  }

  async function run(context, actor) {
    if (!context?.matter?.id) throw new Error("Matter workflow context is required");
    const events = [...(context.events || [])];
    const emit = (state, extra = {}) => events.push({ state, at: clock().toISOString(), actorId: actor.id, ...extra });
    emit("conflict_check");
    const conflictResult = context.conflictResult || await conflict.check({ matterId: context.matter.id, clientId: context.matter.clientId }, actor);
    if (conflictResult?.blocked === true || conflictResult?.conflict === true) throw new Error("Matter is blocked by conflict check");
    emit("evidence");
    const evidenceItems = context.evidence || [];
    emit("routing");
    const routed = context.routing || await specialistRouter.execute({ matterId: context.matter.id, actor, task: context.matter.issue, context: { jurisdiction: context.matter.jurisdiction } });
    emit("knowledge");
    const knowledgeResult = context.knowledgeResult || { jurisdiction: context.matter.jurisdiction, routedRole: routed?.specialistRole || routed?.context?.routedSpecialistRole || null };
    emit("work_package");
    let workPackage = context.workPackage || createWorkPackage({ matterId: context.matter.id, actor, issue: context.matter.issue, facts: context.facts || [], assumptions: context.assumptions || [], jurisdiction: context.matter.jurisdiction, applicableDate: context.applicableDate || clock().toISOString().slice(0, 10), evidence: evidenceItems, authorities: context.authorities || [], specialistFindings: context.specialistFindings || [routed], analysis: context.analysis || "", uncertainty: context.uncertainty || [], confidence: typeof context.confidence === "number" ? context.confidence : 0, recommendedActions: context.recommendedActions || [], requiredDocuments: context.requiredDocuments || [], requiredTasks: context.requiredTasks || [], provenance: context.provenance || [] });
    emit("human_review");
    workPackage = transitionWorkPackage(workPackage, "review", actor);
    if (context.modification) {
      workPackage = transitionWorkPackage(workPackage, "modified", actor, context.modification);
      emit("human_modified");
      workPackage = transitionWorkPackage(workPackage, "review", actor);
    }
    const approvalGate = requireHumanGate({ actor, action: "approve" });
    workPackage = transitionWorkPackage(workPackage, "approved", actor);
    emit("human_approved", { gate: approvalGate });
    const finalGate = requireHumanGate({ actor, action: "finalize" });
    workPackage = transitionWorkPackage(workPackage, "finalized", actor);
    emit("final_action", { gate: finalGate });
    workPackage = attachProvenance(workPackage, [{ workflowState: "final_action", knowledge: knowledgeResult }]);
    emit("closed");
    return Object.freeze({ ...context, state: "closed", conflictResult, routing: routed, knowledgeResult, workPackage, events });
  }

  return Object.freeze({ states: STATES, start, run });
}

module.exports = { STATES, createMatterWorkflow };
