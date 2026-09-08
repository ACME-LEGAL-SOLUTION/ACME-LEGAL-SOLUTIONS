"use strict";

/**
 * Persistent CRM orchestration. Every compound CRM mutation executes against
 * one transaction-scoped repository set and is optionally protected by the
 * canonical matter authorization boundary.
 */
function createPersistentCrmOperations({ transaction, repositories, repositoryFactory, matterAuthorization = null, clock = () => new Date() } = {}) {
  if (!transaction?.run) throw new TypeError("Transaction boundary is required");
  if (!repositories?.clients || !repositories?.matters) throw new TypeError("Client and matter repositories are required");
  if (typeof repositoryFactory !== "function") throw new TypeError("Transaction-scoped repository factory is required");

  const scoped = (tx) => repositoryFactory(tx);
  const authorize = async (actor, matterId, action) => {
    if (!matterAuthorization) return true;
    return matterAuthorization.assert(actor, matterId, action);
  };

  async function createClient({ client, actor } = {}) {
    if (!client || !actor?.id) throw new TypeError("Client and authenticated actor are required");
    return transaction.run(async (tx) => scoped(tx).clients.create({ ...client, createdAt: client.createdAt || clock().toISOString(), createdBy: actor.id }, actor));
  }

  async function createMatter({ matter, actor } = {}) {
    if (!matter || !actor?.id) throw new TypeError("Matter and authenticated actor are required");
    if (!matter.clientId) throw new TypeError("Matter clientId is required");
    return transaction.run(async (tx) => scoped(tx).matters.create({ ...matter, createdAt: matter.createdAt || clock().toISOString(), createdBy: actor.id }, actor));
  }

  async function createClientMatter({ client, matter, actor } = {}) {
    if (!client || !matter || !actor?.id) throw new TypeError("Client, matter and authenticated actor are required");
    return transaction.run(async (tx) => {
      const repos = scoped(tx);
      const createdClient = await repos.clients.create({ ...client, createdAt: client.createdAt || clock().toISOString(), createdBy: actor.id }, actor);
      const createdMatter = await repos.matters.create({ ...matter, clientId: createdClient.id, createdAt: matter.createdAt || clock().toISOString(), createdBy: actor.id }, actor);
      return { client: createdClient, matter: createdMatter };
    });
  }

  async function matterOperation({ actor, matterId, action = "update", work } = {}) {
    if (typeof work !== "function") throw new TypeError("Matter operation work function is required");
    await authorize(actor, matterId, action);
    return transaction.run((tx) => work({ tx, actor, matterId, repositories: scoped(tx) }));
  }

  return Object.freeze({ createClient, createMatter, createClientMatter, matterOperation });
}

module.exports = { createPersistentCrmOperations };
