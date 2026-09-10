"use strict";

const { URL } = require("node:url");

const ROUTES = Object.freeze({
  "/api/portal/matter": Object.freeze({ method: "GET", audience: "matter", operation: "matterDetails" }),
  "/api/portal/work-package": Object.freeze({ method: "GET", audience: "professional", operation: "getWorkPackage" }),
  "/api/portal/work-package/action": Object.freeze({ method: "POST", audience: "professional", operation: "action" })
});

function createPortalMatterHttpBoundary({ portalMatter, authenticate } = {}) {
  if (!portalMatter) throw new Error("Portal matter service is required");
  if (typeof authenticate !== "function") throw new Error("Authentication adapter is required");

  async function dispatch(request, body = {}) {
    const url = new URL(request.url, "http://localhost");
    const route = ROUTES[url.pathname];
    if (!route) throw Object.assign(new Error("Unsupported portal matter route"), { statusCode: 404 });
    if (request.method !== route.method) throw Object.assign(new Error("Method not allowed"), { statusCode: 405 });
    const actor = await authenticate(request);
    if (!actor?.id) throw Object.assign(new Error("Authenticated actor is required"), { statusCode: 401 });

    const matterId = url.searchParams.get("matterId") || body.matterId;
    if (!matterId) throw Object.assign(new Error("matterId is required"), { statusCode: 400 });

    if (route.operation === "matterDetails") return portalMatter.matterDetails({ matterId, actor });
    if (route.operation === "getWorkPackage") {
      const details = await portalMatter.matterDetails({ matterId, actor });
      if (!actor.human || !["professional", "admin", "lawyer", "accountant"].includes(actor.role)) {
        throw Object.assign(new Error("Authorized human professional is required"), { statusCode: 403 });
      }
      return Object.freeze({ matterId, workPackage: details.workPackage });
    }

    if (body.operation === "create") {
      return portalMatter.createPackage({ matterId, input: body.workPackage || body, actor });
    }
    if (!["review", "modified", "approved", "finalized"].includes(body.operation)) {
      throw Object.assign(new Error("operation must be create, review, modified, approved or finalized"), { statusCode: 400 });
    }
    return portalMatter.transitionPackage({
      matterId,
      targetState: body.operation,
      actor,
      modification: body.modification || null,
      provenance: Array.isArray(body.provenance) ? body.provenance : []
    });
  }

  return Object.freeze({ routes: ROUTES, dispatch });
}

module.exports = { ROUTES, createPortalMatterHttpBoundary };
