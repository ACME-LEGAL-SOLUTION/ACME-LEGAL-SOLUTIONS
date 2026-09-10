"use strict";

const READ_ACTIONS = Object.freeze([
  "read_source",
  "read_legal_version",
  "read_authority",
  "read_evidence"
]);

function createKnowledgeAuthorization({ policy } = {}) {
  if (typeof policy?.can !== "function") throw new Error("Knowledge authorization policy is required");

  function assert(actor, action, resource = null) {
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!READ_ACTIONS.includes(action)) throw new Error(`Unsupported knowledge action: ${action}`);
    if (!policy.can({ actor, action, resource })) throw new Error(`Knowledge access denied: ${action}`);
    return true;
  }

  return Object.freeze({ assert, READ_ACTIONS });
}

module.exports = { READ_ACTIONS, createKnowledgeAuthorization };
