"use strict";

/**
 * Server-side matter authorization boundary.
 *
 * Authorization is evaluated before any matter-scoped repository mutation.
 * The policy is deliberately provider-neutral: the caller supplies a
 * resolver that returns the actor's access decision for the requested matter.
 */
function createMatterAuthorization({ resolveAccess } = {}) {
  if (typeof resolveAccess !== "function") {
    throw new TypeError("resolveAccess function is required");
  }

  return Object.freeze({
    async assert(actor, matterId, action = "access") {
      if (!actor || !actor.id) throw new TypeError("Authenticated actor is required");
      if (!matterId) throw new TypeError("Matter id is required");
      const decision = await resolveAccess({ actor, matterId, action });
      if (decision !== true && decision?.allowed !== true) {
        throw new Error(`Matter access denied: ${action}`);
      }
      return true;
    }
  });
}

function createMatterScopedOperations({ authorization, transaction } = {}) {
  if (!authorization || typeof authorization.assert !== "function") throw new TypeError("Matter authorization is required");
  if (!transaction || typeof transaction.run !== "function") throw new TypeError("Transaction boundary is required");

  return Object.freeze({
    async run({ actor, matterId, action = "mutate", work } = {}) {
      if (typeof work !== "function") throw new TypeError("Matter operation work function is required");
      await authorization.assert(actor, matterId, action);
      return transaction.run((tx) => work({ tx, actor, matterId }));
    }
  });
}

module.exports = { createMatterAuthorization, createMatterScopedOperations };
