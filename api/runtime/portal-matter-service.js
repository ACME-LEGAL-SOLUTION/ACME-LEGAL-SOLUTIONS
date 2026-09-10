"use strict";

const { createWorkPackage, transitionWorkPackage } = require("./work-package-engine");
const { attachProvenance } = require("./work-package-provenance");
const { requireHumanGate } = require("./work-package-human-gate");

const PROFESSIONAL_ROLES = new Set(["professional", "admin", "lawyer", "accountant"]);

function createPortalMatterService({ crm, document, evidence, diary, repositories, clock = () => new Date() } = {}) {
  for (const [name, service] of Object.entries({ crm, document, evidence, diary })) {
    if (!service) throw new Error(`${name} service is required`);
  }
  if (!repositories?.matters?.list || !repositories?.documents?.list || !repositories?.evidence?.list) {
    throw new Error("Matter, document and evidence listing repositories are required");
  }
  if (!repositories?.workPackages?.create || !repositories?.workPackages?.getById || !repositories?.workPackages?.list || !repositories?.workPackages?.update) {
    throw new Error("Persistent work package repository is required");
  }

  async function matterDetails({ matterId, actor }) {
    requireActor(actor);
    const matter = await crm.getMatter(matterId, actor);
    if (!matter) throw notFound("Matter was not found");
    assertMatterAccess(matter, actor);
    const documents = (await repositories.documents.list()).filter((item) => item.matterId === matterId);
    const evidenceItems = (await repositories.evidence.list()).filter((item) => item.matterId === matterId);
    const diaryItems = await diary.listMatter(matterId);
    const workPackage = await latestWorkPackage(matterId);
    return Object.freeze({ matter, documents, evidence: evidenceItems, diary: diaryItems, workPackage });
  }

  async function createPackage({ matterId, input, actor }) {
    requireProfessional(actor);
    const matter = await crm.getMatter(matterId, actor);
    if (!matter) throw notFound("Matter was not found");
    const workPackage = createWorkPackage({
      ...input,
      matterId,
      issue: input.issue || matter.issue,
      jurisdiction: input.jurisdiction || matter.jurisdiction,
      applicableDate: input.applicableDate || clock().toISOString().slice(0, 10),
      actor
    });
    const reviewed = transitionWorkPackage(workPackage, "review", actor);
    await repositories.workPackages.create(toPersistentWorkPackage(reviewed, actor, clock));
    await appendAudit("work_package.created", matterId, actor, reviewed);
    return reviewed;
  }

  async function transitionPackage({ matterId, targetState, actor, modification = null, provenance = [] }) {
    requireProfessional(actor);
    const current = await latestWorkPackage(matterId);
    if (!current) throw notFound("Work package was not found");
    if (targetState === "approved" || targetState === "finalized") requireHumanGate({ actor, action: targetState });
    let next = transitionWorkPackage(current, targetState, actor, modification);
    if (provenance.length) next = attachProvenance(next, provenance);
    const patch = {
      state: next.state,
      issue: next.issue || null,
      jurisdiction: next.jurisdiction || null,
      applicableDate: next.applicableDate || null,
      payload: stripGovernanceFields(next),
      provenance: next.provenance || [],
      confidence: next.confidence ?? null,
      updatedAt: clock().toISOString(),
      approvedBy: next.state === "approved" ? actor.id : current.approvedBy || null,
      finalizedBy: next.state === "finalized" ? actor.id : current.finalizedBy || null
    };
    const stored = await repositories.workPackages.update(current.id, patch);
    await appendAudit(`work_package.${targetState}`, matterId, actor, next);
    return fromPersistentWorkPackage(stored);
  }

  async function latestWorkPackage(matterId) {
    const records = (await repositories.workPackages.list()).filter((item) => item.matterId === matterId);
    if (!records.length) return null;
    records.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    return fromPersistentWorkPackage(records[0]);
  }

  async function appendAudit(eventType, matterId, actor, workPackage) {
    if (typeof repositories.audit?.create !== "function") return;
    await repositories.audit.create({
      id: `wp-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorId: actor.id,
      actorType: actor.type || "user",
      matterId,
      eventType,
      payloadJson: { workPackageId: workPackage.id, state: workPackage.state },
      createdAt: clock().toISOString()
    }, actor);
  }

  function assertMatterAccess(matter, actor) {
    if (actor.role === "admin" || PROFESSIONAL_ROLES.has(actor.role)) return;
    if (actor.clientId !== matter.clientId) throw accessDenied();
  }

  return Object.freeze({ matterDetails, createPackage, transitionPackage });
}

function toPersistentWorkPackage(workPackage, actor, clock) {
  return {
    id: workPackage.id,
    matterId: workPackage.matterId,
    state: workPackage.state,
    issue: workPackage.issue || null,
    jurisdiction: workPackage.jurisdiction || null,
    applicableDate: workPackage.applicableDate || null,
    payload: stripGovernanceFields(workPackage),
    provenance: workPackage.provenance || [],
    confidence: workPackage.confidence ?? null,
    createdAt: workPackage.createdAt || clock().toISOString(),
    updatedAt: clock().toISOString(),
    createdBy: actor.id,
    approvedBy: null,
    finalizedBy: null
  };
}

function stripGovernanceFields(workPackage) {
  const { provenance, state, ...payload } = workPackage || {};
  return payload;
}

function fromPersistentWorkPackage(record) {
  if (!record) return null;
  return {
    ...(record.payload || {}),
    id: record.id,
    matterId: record.matterId,
    state: record.state,
    issue: record.issue,
    jurisdiction: record.jurisdiction,
    applicableDate: record.applicableDate,
    confidence: record.confidence,
    provenance: record.provenance || [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function requireActor(actor) {
  if (!actor?.id) throw Object.assign(new Error("Authenticated actor is required"), { statusCode: 401 });
}
function requireProfessional(actor) {
  requireActor(actor);
  if (!actor.human || !PROFESSIONAL_ROLES.has(actor.role)) throw Object.assign(new Error("Authorized human professional is required"), { statusCode: 403 });
}
function accessDenied() { return Object.assign(new Error("Matter access denied"), { statusCode: 403, code: "MATTER_ACCESS_DENIED" }); }
function notFound(message) { return Object.assign(new Error(message), { statusCode: 404 }); }

module.exports = { PROFESSIONAL_ROLES, createPortalMatterService };
