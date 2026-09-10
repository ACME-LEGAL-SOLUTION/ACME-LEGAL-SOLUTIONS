"use strict";

const TYPES = Object.freeze(["document", "statement", "image", "audio", "video", "record", "other"]);
const STATUSES = Object.freeze(["unverified", "verified", "disputed", "rejected"]);

function createEvidenceService({ repositories, clock = () => new Date(), matterAuthorization = null, transaction = null, repositoryFactory = null } = {}) {
  if (!repositories?.evidence?.create || !repositories?.evidence?.getById) throw new Error("Evidence repository is required");
  if (matterAuthorization !== null && typeof matterAuthorization.assert !== "function") throw new TypeError("Matter authorization must expose assert");
  if (transaction !== null && typeof transaction.run !== "function") throw new TypeError("Transaction boundary must expose run");
  if (repositoryFactory !== null && typeof repositoryFactory !== "function") throw new TypeError("Repository factory must be a function");
  async function createEvidence(input, actor) {
    requireActor(actor); validateInput(input); await assertMatterAccess(input.matterId, actor, "create");
    const work = (repos) => repos.evidence.create({ matterId: input.matterId, documentId: input.documentId || null, type: input.type, title: input.title.trim(), status: input.status || "unverified", provenance: input.provenance || null, metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}, createdBy: actor.id, createdAt: clock().toISOString() }, actor);
    return transaction ? transaction.run(async (tx) => work(repositoryFactory ? repositoryFactory(tx) : repositories)) : work(repositories);
  }
  async function getEvidence(id, actor) { requireActor(actor); if (!id) throw new Error("Evidence id is required"); const evidence = await repositories.evidence.getById(id); if (!evidence) return null; await assertMatterAccess(evidence.matterId, actor, "read"); return evidence; }
  async function assertMatterAccess(matterId, actor, action) { if (matterAuthorization) return matterAuthorization.assert(actor, matterId, action); throw Object.assign(new Error("Matter access denied"), { statusCode: 403, code: "MATTER_ACCESS_DENIED" }); }
  return Object.freeze({ createEvidence, getEvidence });
}
function validateInput(input) { if (!input?.matterId) throw new Error("Matter id is required"); if (!input?.type || !TYPES.includes(input.type)) throw new Error(`Invalid evidence type: ${input?.type}`); if (!input.title?.trim()) throw new Error("Evidence title is required"); }
function requireActor(actor) { if (!actor?.id) throw new Error("Authenticated actor is required"); }
module.exports = { TYPES, STATUSES, createEvidenceService };
