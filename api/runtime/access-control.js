"use strict";

/**
 * Matter-scoped authorization boundary.
 *
 * Authorization is evaluated server-side against an injected policy/repository
 * adapter. This module intentionally does not trust browser-supplied scope or
 * roles and never exposes a persistence implementation to callers.
 */

const ACTIONS = Object.freeze(["read", "create", "update", "assign", "review", "close", "archive"]);

function createAccessControl({ policy } = {}) {
  if (!policy?.can) throw new Error("Authorization policy is required");

  async function authorize({ actor, action, matter }) {
    if (!actor?.id) throw new Error("Authenticated actor is required");
    if (!ACTIONS.includes(action)) throw new Error(`Invalid access action: ${action}`);
    if (!matter?.id) throw new Error("Matter is required");

    const allowed = await policy.can({ actor, action, matter });
    if (allowed !== true) {
      const error = new Error("Matter access denied");
      error.code = "MATTER_ACCESS_DENIED";
      throw error;
    }

    return true;
  }

  return { authorize };
}

module.exports = { ACTIONS, createAccessControl };
