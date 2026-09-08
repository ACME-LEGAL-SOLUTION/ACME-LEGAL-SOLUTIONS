"use strict";

/**
 * Provider-neutral orchestration for multi-repository domain operations.
 * A transaction-scoped repository factory lets a persistence adapter bind
 * repository I/O to the active transaction without exposing a database driver
 * to domain services.
 */
function createTransactionalOperations({ transaction, repositories, repositoryFactory = null } = {}) {
  if (!transaction?.run) throw new TypeError("Transaction boundary is required");
  if (!repositories) throw new TypeError("Repositories are required");
  if (repositoryFactory !== null && typeof repositoryFactory !== "function") throw new TypeError("Repository factory must be a function");

  function scopedRepositories(tx) {
    if (!repositoryFactory) return repositories;
    const scoped = repositoryFactory(tx);
    if (!scoped) throw new Error("Transaction-scoped repositories are required");
    return scoped;
  }

  async function createClientMatter({ client, matter, actor }) {
    if (!client || !matter || !actor?.id) throw new TypeError("Client, matter and authenticated actor are required");
    return transaction.run(async (tx) => {
      const scoped = scopedRepositories(tx);
      const createdClient = await scoped.clients.create({ ...client, actorId: actor.id });
      const createdMatter = await scoped.matters.create({ ...matter, clientId: createdClient.id, actorId: actor.id });
      return { client: createdClient, matter: createdMatter };
    });
  }

  async function run(work) {
    if (typeof work !== "function") throw new TypeError("Transactional work function is required");
    return transaction.run((tx) => work({ tx, repositories: scopedRepositories(tx) }));
  }

  return Object.freeze({ createClientMatter, run });
}

module.exports = { createTransactionalOperations };
