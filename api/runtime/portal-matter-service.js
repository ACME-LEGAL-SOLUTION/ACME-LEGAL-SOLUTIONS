"use strict";

const { createWorkPackage, transitionWorkPackage } = require("./work-package-engine");
const { attachProvenance } = require("./work-package-provenance");
const { requireHumanGate } = require("./work-package-human-gate");

const PROFESSIONAL_ROLES = new Set(["professional", "admin", "lawyer", "accountant"]);

function createPortalMatterService({ crm, document, evidence, diary, repositories, clock = () => new Date(), transaction = null, repositoryFactory = null, matterAuthorization = null } = {}) {
  for (const [name, service] of Object.entries({ crm, document, evidence, diary })) {
    if (!service) throw new Error(`${name} service is required`);
  }
  if (!repositories?.matters?.list || !repositories?.documents?.list || !repositories?.evidence?.list) {
    throw new Error("Matter, document and evidence listing repositories are required");
  }
  if (!repositories?.workPackages?.create || !repositories?.workPackages?.getById || !repositories?.workPackages?.list || !repositories?.workPackages?.update) {
    throw new Error("Persistent work package repository is required");
  }
  if (transaction !== null && typeof transaction.run !== "function") throw new TypeError("Transaction boundary must expose run");
  if (repositoryFactory !== null && typeof repositoryFactory !== "function") throw new TypeError("Repository factory must be a function");
  if (matterAuthorization !== null && typeof matterAuthorization.assert !== "function") throw new TypeError("Matter authorization must expose assert");

  async function matterDetails({ matterId, actor }) {
    requireActor(actor);
    const matter = await crm.getMatter(matterId, actor);
    if (!matter) throw notFound("Matter was not found");
    await assertMatterAccess(matter, matterId, actor, "read");
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
    await assertMatterAccess(matter, matterId, actor, "create");
    const workPackage = createWorkPackage({
      ...input,
      matterId,
      issue: input.issue || matter.issue,
      jurisdiction: input.jurisdiction || matter.jurisdiction,
      applicableDate: input.applicableDate || clock().toISOString().slice(0, 10),
      actor
    });
    const reviewed = transitionWorkPackage(workPackage, "review", actor);
    return runMutation(async (scopedRepositories) => {
      await scopedRepositories.workPackages.create(toPersistentWorkPackage(reviewed, actor, clock));
      await appendAudit(scopedRepositories, "work_package.created", matterId, actor, reviewed);
      return reviewed;
    });
  }

  async function transitionPackage({ matterId, targetState, actor, modification = null, provenance = [] }) {
    requireProfessional(actor);
    const matter = await crm.getMatter(matterId, actor);
    if (!matter) throw notFound("Matter was not found");
    const action = targetState === "review" ? "review" : "update";
    await assertMatterAccess(matter, matterId, actor, action);
    if (targetState === "approved" || targetState === "finalized") requireHumanGate({ actor, action: targetState });

    return runMutation(async (scopedRepositories) => {
      const current = await latestWorkPackage(matterId, scopedRepositories);
      if (!current) throw notFound("Work package was not found");
      let next = transitionWorkPackage(current, targetState, actor, modification);
      if (provenance.length) next = attachProvenance(next, provenance);
      const patch = {
        state: next.state,
        issue: next.issue || null,
        jurisdiction: next.jurisdiction || null,
        applicableDate: next.applicableDate || null,
        payloadJson: stripGovernanceFields(next),
        provenanceJson: next.provenance || [],
        confidence: next.confidence ?? null,
        updatedAt: clock().toISOString(),
        approvedBy: next.state === "approved" ? actor.id : current.approvedBy || null,
        finalizedBy: next.state === "finalized" ? actor.id : current.finalizedBy || null
      };
      const stored = await scopedRepositories.workPackages.update(current.id, patch);
      await appendAudit(scopedRepositories, `work_package.${targetState}`, matterId, actor, next);
      return fromPersistentWorkPackage(stored);
    });
  }

  async function runMutation(work) {
    if (!transaction) return work(repositories);
    return transaction.run(async (tx) => work(repositoryFactory ? repositoryFactory(tx) : repositories));
  }

  async function latestWorkPackage(matterId, scopedRepositories = repositories) {
    const records = (await scopedRepositories.workPackages.list({ matterId }));
    if (!records.length) return null;
    records.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    return fromPersistentWorkPackage(records[0]);
  }

  async function appendAudit(scopedRepositories, eventType, matterId, actor, workPackage) {
    if (typeof scopedRepositories.audit?.create !== "function") return;
    await scopedRepositories.audit.create({
      id: `wp-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actorId: actor.id,
      actorType: actor.type || "user",
      matterId,
      eventType,
      payloadJson: { workPackageId: workPackage.id, state: workPackage.state },
      createdAt: clock().toISOString()
    }, actor);
  }

  async function assertMatterAccess(matter, matterId, actor, action) {
    if (matterAuthorization) return matterAuthorization.assert(actor, matterId, action);
    if (actor.role === "admin" || PROFESSIONAL_ROLES.has(actor.role)) return true;
    if (actor.clientId !== matter.clientId) throw accessDenied();
    return true;
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
    payloadJson: stripGovernanceFields(workPackage),
    provenanceJson: workPackage.provenance || [],
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
    ...(record.payloadJson || {}),
    id: record.id,
    matterId: record.matterId,
    state: record.state,
    issue: record.issue,
    jurisdiction: record.jurisdiction,
    applicableDate: record.applicableDate,
    confidence: record.confidence,
    provenance: record.provenanceJson || [],
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
