"use strict";

const TYPES = Object.freeze(["client_identity", "pleading", "order", "contract", "evidence", "correspondence", "invoice", "other"]);
const STATUSES = Object.freeze(["received", "processing", "classified", "verified", "rejected", "archived"]);

function createDocumentService({ repositories, clock = () => new Date(), objectStorage = null, matterAuthorization = null, transaction = null, repositoryFactory = null } = {}) {
  if (!repositories?.documents?.create || !repositories?.documents?.getById) throw new Error("Document repository is required");
  if (objectStorage !== null && !["put", "get", "delete"].every((method) => typeof objectStorage[method] === "function")) throw new TypeError("Object storage adapter is incomplete");
  if (matterAuthorization !== null && typeof matterAuthorization.assert !== "function") throw new TypeError("Matter authorization must expose assert");
  if (transaction !== null && typeof transaction.run !== "function") throw new TypeError("Transaction boundary must expose run");
  if (repositoryFactory !== null && typeof repositoryFactory !== "function") throw new TypeError("Repository factory must be a function");

  async function createDocument(input, actor) {
    requireActor(actor); validateInput(input); await assertMatterAccess(input.matterId, actor, "create");
    const work = (repos) => repos.documents.create({ matterId: input.matterId, name: input.name.trim(), type: input.type, status: input.status || "received", source: input.source || "client", storageKey: input.storageKey || null, mimeType: input.mimeType || null, checksum: input.checksum || null, metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}, createdBy: actor.id, createdAt: clock().toISOString() }, actor);
    return transaction ? transaction.run(async (tx) => work(repositoryFactory ? repositoryFactory(tx) : repositories)) : work(repositories);
  }

  async function getDocument(id, actor) {
    requireActor(actor); if (!id) throw new Error("Document id is required");
    const document = await repositories.documents.getById(id); if (!document) return null;
    await assertMatterAccess(document.matterId, actor, "read"); return document;
  }
  async function putObject({ matterId, objectId, body, contentType, checksum }, actor) { requireActor(actor); requireStorage(); await assertMatterAccess(matterId, actor, "update"); return objectStorage.put({ matterId, objectId, body, contentType, checksum }); }
  async function getObject({ matterId, objectId }, actor) { requireActor(actor); requireStorage(); await assertMatterAccess(matterId, actor, "read"); return objectStorage.get({ matterId, objectId }); }
  async function deleteObject({ matterId, objectId }, actor) { requireActor(actor); requireStorage(); await assertMatterAccess(matterId, actor, "update"); return objectStorage.delete({ matterId, objectId }); }
  async function assertMatterAccess(matterId, actor, action) { if (matterAuthorization) return matterAuthorization.assert(actor, matterId, action); throw Object.assign(new Error("Matter access denied"), { statusCode: 403, code: "MATTER_ACCESS_DENIED" }); }
  function requireStorage() { if (!objectStorage) throw new Error("Production object storage adapter is required"); }
  return Object.freeze({ createDocument, getDocument, putObject, getObject, deleteObject });
}
function validateInput(input) { if (!input?.matterId) throw new Error("Matter id is required"); if (!input.name?.trim()) throw new Error("Document name is required"); if (!TYPES.includes(input.type)) throw new Error(`Invalid document type: ${input.type}`); }
function requireActor(actor) { if (!actor?.id) throw new Error("Authenticated actor is required"); }
module.exports = { TYPES, STATUSES, createDocumentService };
