"use strict";

function createCrmService({ repositories, clock = () => new Date() } = {}) {
  if (!repositories?.clients?.create || !repositories?.matters?.create) {
    throw new Error("Client and matter repositories are required");
  }

  async function createClient(input, actor) {
    requireActor(actor);
    if (!input || typeof input !== "object") throw new TypeError("Client input is required");
    const record = {
      ...input,
      status: input.status || "active",
      createdAt: clock().toISOString(),
      createdBy: actor.id
    };
    return repositories.clients.create(record, actor);
  }

  async function getClient(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Client id is required");
    if (!repositories.clients.getById) throw new Error("Client lookup repository is not configured");
    return repositories.clients.getById(id);
  }

  async function createMatter(input, actor) {
    requireActor(actor);
    if (!input || typeof input !== "object") throw new TypeError("Matter input is required");
    if (!input.clientId) throw new Error("Matter clientId is required");

    const client = await getClient(input.clientId, actor);
    if (!client) throw new Error("Matter client was not found");

    return repositories.matters.create({
      ...input,
      status: input.status || "lead",
      ownerId: input.ownerId || actor.id,
      createdAt: clock().toISOString(),
      createdBy: actor.id
    }, actor);
  }

  async function getMatter(id, actor) {
    requireActor(actor);
    if (!id) throw new Error("Matter id is required");
    if (!repositories.matters.getById) throw new Error("Matter lookup repository is not configured");
    return repositories.matters.getById(id);
  }

  return { createClient, getClient, createMatter, getMatter };
}

function requireActor(actor) {
  if (!actor?.id) throw new Error("Authenticated actor is required");
}

module.exports = { createCrmService };
