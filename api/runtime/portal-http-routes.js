"use strict";

const CLIENT_PATH = "/api/portal/client";
const PROFESSIONAL_PATH = "/api/portal/professional";

function createPortalHttpRoutes({ portal } = {}) {
  if (!portal || typeof portal.clientDashboard !== "function" || typeof portal.professionalWorkspace !== "function") {
    throw new Error("Portal service with clientDashboard and professionalWorkspace is required");
  }
  return Object.freeze({
    [CLIENT_PATH]: async ({ input, actor }) => portal.clientDashboard({ clientId: input.clientId, actor }),
    [PROFESSIONAL_PATH]: async ({ input, actor }) => portal.professionalWorkspace({ matterId: input.matterId, actor })
  });
}

async function invokePortalRoute(routes, path, input, actor) {
  const handler = routes?.[path];
  if (typeof handler !== "function") throw Object.assign(new Error("Unsupported portal route"), { statusCode: 404 });
  return handler({ input: input || {}, actor });
}

module.exports = { CLIENT_PATH, PROFESSIONAL_PATH, createPortalHttpRoutes, invokePortalRoute };
