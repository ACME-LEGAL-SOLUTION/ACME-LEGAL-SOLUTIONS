"use strict";

const { createMatterAuthorization } = require("./matter-authorization");

const PROFESSIONAL_ROLES = new Set(["professional", "lawyer", "accountant"]);
const ACTIONS = Object.freeze({
  client: new Set(["read"]),
  professional: new Set(["read", "create", "update", "review", "close", "archive"]),
  admin: new Set(["read", "create", "update", "assign", "review", "close", "archive"])
});

function createProductionMatterAuthorization({ matters } = {}) {
  if (!matters?.getById) throw new TypeError("Matter repository is required");

  return createMatterAuthorization({
    resolveAccess: async ({ actor, matterId, action }) => {
      const matter = await matters.getById(matterId);
      if (!matter) return false;
      if (actor.human !== true && actor.role !== "client") return false;

      const role = actor.role === "admin" ? "admin" : actor.role === "client" ? "client" : PROFESSIONAL_ROLES.has(actor.role) ? "professional" : null;
      if (!role || !ACTIONS[role].has(action)) return false;

      if (role === "admin") return true;
      if (role === "client") return actor.clientId === matter.clientId;
      return actor.id === matter.assignedUserId || actor.id === matter.ownerId;
    }
  });
}

module.exports = { ACTIONS, PROFESSIONAL_ROLES, createProductionMatterAuthorization };
