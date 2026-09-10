"use strict";

function requireHumanGate({ actor, action }) {
  if (!actor || actor.human !== true || !actor.id) {
    throw new Error(`${action} requires explicit human action`);
  }
  return Object.freeze({ action, actorId: actor.id, human: true, at: new Date().toISOString() });
}

module.exports = { requireHumanGate };
