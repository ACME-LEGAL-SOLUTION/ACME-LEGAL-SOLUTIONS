"use strict";

/**
 * Provider-neutral orchestration for multi-repository domain operations.
 * Callers supply domain work; this module guarantees one transaction boundary
 * around the complete operation without coupling services to a SQL driver.
 */
function createTransactionalOperations({ transaction, repositories } = {}) {
  if (!transaction?.run) throw new TypeError("Transaction boundary is required");
  if (!repositories) throw new TypeError("Repositories are required");

  async function createClientMatter({ client, matter, actor }) {
    if (!client || !matter || !actor?.id) throw new TypeError("Client, matter and authenticated actor are required");
    return transaction.run(async (tx) => {
      const createdClient = await repositories.clients.create({ ...client, actorId: actor.id, transaction: tx });
      const createdMatter = await repositories.matters.create({ ...matter, clientId: createdClient.id, actorId: actor.id, transaction: tx });
      return { client: createdClient, matter: createdMatter };
    });
  }

  async function run(work) {
    if (typeof work !== "function") throw new TypeError("Transactional work function is required");
    return transaction.run((tx) => work({ tx, repositories }));
  }

  return Object.freeze({ createClientMatter, run });
}

module.exports = { createTransactionalOperations };
