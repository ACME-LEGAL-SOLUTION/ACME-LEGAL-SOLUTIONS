"use strict";

/**
 * Compatibility facade for existing runtime callers.
 * Canonical matter authorization lives in ../security/matter-authorization.
 */
const { ACTIONS, createMatterAuthorization } = require("../security/matter-authorization");

function createAccessControl({ policy } = {}) {
  if (!policy?.can) throw new Error("Authorization policy is required");
  const authorization = createMatterAuthorization({
    resolveAccess: ({ actor, matterId, action }) => policy.can({ actor, action, matter: { id: matterId } })
  });

  return Object.freeze({
    authorize: async ({ actor, action, matter }) => authorization.assert(actor, matter?.id, action)
  });
}

module.exports = { ACTIONS, createAccessControl };
