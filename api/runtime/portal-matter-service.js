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

  const workPackages = new Map();

  async function matterDetails({ matterId, actor }) {
    requireActor(actor);
    const matter = await crm.getMatter(matterId, actor);
    if (!matter) throw notFound("Matter was not found");
    assertMatterAccess(matter, actor);
    const documents = (await repositories.documents.list()).filter((item) => item.matterId === matterId);
    const evidenceItems = (await repositories.evidence.list()).filter((item) => item.matterId === matterId);
    const diaryItems = await diary.listMatter(matterId);
    return Object.freeze({ matter, documents, evidence: evidenceItems, diary: diaryItems, workPackage: workPackages.get(matterId) || null });
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
    workPackages.set(matterId, reviewed);
    return reviewed;
  }

  async function transitionPackage({ matterId, targetState, actor, modification = null, provenance = [] }) {
    requireProfessional(actor);
    const current = workPackages.get(matterId);
    if (!current) throw notFound("Work package was not found");
    if (targetState === "approved" || targetState === "finalized") requireHumanGate({ actor, action: targetState });
    let next = transitionWorkPackage(current, targetState, actor, modification);
    if (provenance.length) next = attachProvenance(next, provenance);
    workPackages.set(matterId, next);
    return next;
  }

  function assertMatterAccess(matter, actor) {
    if (actor.role === "admin" || PROFESSIONAL_ROLES.has(actor.role)) return;
    if (actor.clientId !== matter.clientId) throw accessDenied();
  }

  return Object.freeze({ matterDetails, createPackage, transitionPackage });
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
