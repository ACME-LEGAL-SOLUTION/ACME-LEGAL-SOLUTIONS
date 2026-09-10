"use strict";

function recordWorkPackageAction(workPackage, action, actor, details = {}) {
  if (!workPackage || !Array.isArray(workPackage.audit)) throw new TypeError("Invalid work package audit state");
  if (!actor || !actor.id) throw new TypeError("Audit action requires an actor");
  const event = Object.freeze({ action, actorId: actor.id, human: actor.human === true, at: new Date().toISOString(), details: { ...details } });
  return Object.freeze({ ...workPackage, version: workPackage.version + 1, updatedAt: event.at, audit: [...workPackage.audit, event] });
}

module.exports = { recordWorkPackageAction };
