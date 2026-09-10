"use strict";

const path = require("node:path");

/**
 * Production identity-provider seam.
 *
 * ACME deliberately does not implement or invent an identity provider here.
 * Production deployments must configure ACME_AUTH_MODULE to a trusted server-side
 * adapter. The adapter may be a JWT/OIDC/session verifier and must return a
 * normalized actor object after independently authenticating the request.
 */
const REQUIRED_ACTOR_FIELDS = Object.freeze(["id", "role"]);
const ALLOWED_ROLES = new Set(["client", "professional", "admin", "lawyer", "accountant"]);

function createProductionAuthenticator({ env = process.env, requireFn = require } = {}) {
  const modulePath = String(env.ACME_AUTH_MODULE || "").trim();
  if (!modulePath) throw new Error("Production identity adapter is not configured (ACME_AUTH_MODULE)");

  const resolvedPath = path.isAbsolute(modulePath) ? modulePath : path.resolve(process.cwd(), modulePath);
  const loaded = requireFn(resolvedPath);
  const authenticate = typeof loaded === "function" ? loaded : loaded?.authenticate;
  if (typeof authenticate !== "function") throw new Error("Configured production identity adapter must export authenticate(request)");

  return async function authenticateProductionRequest(request) {
    const actor = await authenticate(request);
    if (!actor || typeof actor !== "object") throw unauthorized();
    for (const field of REQUIRED_ACTOR_FIELDS) {
      if (typeof actor[field] !== "string" || !actor[field].trim()) throw unauthorized();
    }
    if (!ALLOWED_ROLES.has(actor.role)) throw forbidden("Unsupported authenticated role");
    if (typeof actor.human !== "boolean") throw forbidden("Authenticated identity must declare human status");
    if (actor.role !== "client" && !actor.human) throw forbidden("Professional identities must be human");
    return Object.freeze({
      id: actor.id,
      role: actor.role,
      human: actor.human,
      type: typeof actor.type === "string" ? actor.type : "user",
      clientId: typeof actor.clientId === "string" ? actor.clientId : undefined,
      subject: typeof actor.subject === "string" ? actor.subject : undefined,
      scopes: Array.isArray(actor.scopes) ? Object.freeze([...actor.scopes]) : Object.freeze([])
    });
  };
}

function unauthorized() {
  return Object.assign(new Error("Authenticated identity is required"), { statusCode: 401, code: "AUTHENTICATION_REQUIRED" });
}
function forbidden(message) {
  return Object.assign(new Error(message), { statusCode: 403, code: "AUTHORIZATION_DENIED" });
}

module.exports = { ALLOWED_ROLES, REQUIRED_ACTOR_FIELDS, createProductionAuthenticator };
