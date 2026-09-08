"use strict";

/**
 * Canonical server-side matter authorization boundary.
 *
 * This is the single authorization contract used by persistent matter-scoped
 * operations. Policy decisions remain provider-neutral and are evaluated
 * before a transaction begins.
 */
const ACTIONS = Object.freeze(["read", "create", "update", "assign", "review", "close", "archive"]);

function createMatterAuthorization({ resolveAccess } = {}) {
  if (typeof resolveAccess !== "function") throw new TypeError("resolveAccess function is required");

  return Object.freeze({
    async assert(actor, matterId, action = "update") {
      if (!actor?.id) throw new TypeError("Authenticated actor is required");
      if (!matterId) throw new TypeError("Matter id is required");
      if (!ACTIONS.includes(action)) throw new TypeError(`Invalid matter action: ${action}`);

      const decision = await resolveAccess({ actor, matterId, action });
      if (decision !== true && decision?.allowed !== true) {
        const error = new Error(`Matter access denied: ${action}`);
        error.code = "MATTER_ACCESS_DENIED";
        throw error;
      }
      return true;
    }
  });
}

function createMatterScopedOperations({ authorization, transaction, repositoryFactory = null } = {}) {
  if (!authorization?.assert) throw new TypeError("Matter authorization is required");
  if (!transaction?.run) throw new TypeError("Transaction boundary is required");
  if (repositoryFactory !== null && typeof repositoryFactory !== "function") throw new TypeError("Repository factory must be a function");

  return Object.freeze({
    async run({ actor, matterId, action = "update", work } = {}) {
      if (typeof work !== "function") throw new TypeError("Matter operation work function is required");
      await authorization.assert(actor, matterId, action);
      return transaction.run(async (tx) => work({
        tx,
        actor,
        matterId,
        repositories: repositoryFactory ? repositoryFactory(tx) : undefined
      }));
    }
  });
}

module.exports = { ACTIONS, createMatterAuthorization, createMatterScopedOperations };
