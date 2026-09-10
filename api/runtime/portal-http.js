"use strict";

const { URL } = require("node:url");

const ROUTES = Object.freeze({
  "/api/portal/client": Object.freeze({ audience: "client", operation: "clientDashboard" }),
  "/api/portal/professional": Object.freeze({ audience: "professional", operation: "professionalWorkspace" })
});

function createPortalHttpBoundary({ portal, authenticate } = {}) {
  if (!portal) throw new Error("Portal service is required");
  if (typeof authenticate !== "function") throw new Error("Authentication adapter is required");

  async function resolve(request) {
    const url = new URL(request.url, "http://localhost");
    const route = ROUTES[url.pathname];
    if (!route) throw Object.assign(new Error("Unsupported portal route"), { statusCode: 404 });
    const actor = await authenticate(request);
    if (!actor?.id) throw Object.assign(new Error("Authenticated actor is required"), { statusCode: 401 });
    return { route, actor, url };
  }

  async function dispatch(request) {
    const { route, actor, url } = await resolve(request);
    if (request.method !== "GET") throw Object.assign(new Error("Method not allowed"), { statusCode: 405 });

    if (route.operation === "clientDashboard") {
      if (!actor.clientId && actor.role !== "admin") throw Object.assign(new Error("Client identity is required"), { statusCode: 403 });
      const clientId = url.searchParams.get("clientId") || actor.clientId;
      if (clientId !== actor.clientId && actor.role !== "admin") throw Object.assign(new Error("Client access denied"), { statusCode: 403 });
      return portal.clientDashboard({ clientId, actor });
    }

    const matterId = url.searchParams.get("matterId");
    if (!matterId) throw Object.assign(new Error("matterId is required"), { statusCode: 400 });
    return portal.professionalWorkspace({ matterId, actor });
  }

  return Object.freeze({ routes: ROUTES, resolve, dispatch });
}

module.exports = { ROUTES, createPortalHttpBoundary };
