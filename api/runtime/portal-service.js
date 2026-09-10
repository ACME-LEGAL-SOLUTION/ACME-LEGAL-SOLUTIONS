"use strict";

const CLIENT_VIEWS = Object.freeze(["matter", "documents", "tasks", "communications", "billing", "notifications"]);
const PROFESSIONAL_VIEWS = Object.freeze(["queue", "matter", "evidence", "specialists", "knowledge", "work_package", "approval", "final_action", "audit"]);

function createPortalService({ crm, document, evidence, diary, billing, repositories } = {}) {
  for (const [name, service] of Object.entries({ crm, document, evidence, diary, billing })) if (!service) throw new Error(`${name} service is required`);
  if (!repositories?.matters?.list) throw new Error("Matter listing repository is required");

  async function clientDashboard({ clientId, actor }) {
    requireActor(actor);
    if (actor.clientId !== clientId && actor.role !== "admin") throw new Error("Client access denied");
    const matters = (await repositories.matters.list()).filter((matter) => matter.clientId === clientId);
    const dashboards = await Promise.all(matters.map((matter) => matterSummary(matter, actor)));
    return Object.freeze({ audience: "client", clientId, views: CLIENT_VIEWS, matters: dashboards });
  }

  async function professionalWorkspace({ matterId, actor }) {
    requireProfessional(actor);
    const matter = await crm.getMatter(matterId, actor);
    if (!matter) throw new Error("Matter was not found");
    const diaryItems = await diary.listMatter(matterId);
    return Object.freeze({ audience: "professional", matter, views: PROFESSIONAL_VIEWS, diary: diaryItems, workPackage: null });
  }

  async function matterSummary(matter, actor) {
    const documents = document.list ? await document.list(matter.id, actor) : [];
    const evidenceItems = evidence.list ? await evidence.list(matter.id, actor) : [];
    const diaryItems = await diary.listMatter(matter.id);
    return { id: matter.id, title: matter.title || matter.issue, status: matter.status, intakeState: matter.intakeState || null, documents, evidence: evidenceItems, diary: diaryItems, billing: [] };
  }

  return Object.freeze({ CLIENT_VIEWS, PROFESSIONAL_VIEWS, clientDashboard, professionalWorkspace });
}

function requireActor(actor) { if (!actor?.id) throw new Error("Authenticated actor is required"); }
function requireProfessional(actor) { requireActor(actor); if (!actor.human || !["professional", "admin", "lawyer", "accountant"].includes(actor.role)) throw new Error("Authorized human professional is required"); }

module.exports = { CLIENT_VIEWS, PROFESSIONAL_VIEWS, createPortalService };
