"use strict";

const ROUTES = Object.freeze({
  "/api/consultations": "consultation",
  "/api/clients": "crm",
  "/api/matters": "crm",
  "/api/matters/transition": "crm",
  "/api/parties": "party",
  "/api/relationships": "relationship",
  "/api/conflicts": "conflict",
  "/api/documents": "document",
  "/api/evidence": "evidence",
  "/api/authorities": "authorities",
  "/api/hearings": "diary",
  "/api/diary": "diary",
  "/api/sources": "source",
  "/api/legal-versions": "legalVersions",
  "/api/ai": "ai",
  "/api/ai/intake": "intake",
  "/api/ai/research": "ai",
  "/api/ai/review": "ai",
  "/api/reviews": "reviews",
  "/api/partners": "network",
  "/api/billing": "billing",
  "/api/portal/client": "portal",
  "/api/portal/professional": "portal"
});

const PROTECTED_PORTAL_ROUTES = new Set([
  "/api/portal/client",
  "/api/portal/professional"
]);

function createHttpBoundary({ application, authenticate, publicActor = null } = {}) {
  if (!application) throw new Error("Application runtime is required");
  if (typeof authenticate !== "function") throw new Error("Authentication adapter is required");
  return {
    async resolve(path, request) {
      const serviceName = ROUTES[path];
      if (!serviceName || !application[serviceName]) throw new Error(`Unsupported API route: ${path}`);
      const actor = path === "/api/consultations" && publicActor ? publicActor : await authenticate(request);
      if (!actor?.id) throw new Error("Authenticated actor is required");
      return { service: application[serviceName], actor, path };
    },
    routes: ROUTES,
    protectedPortalRoutes: PROTECTED_PORTAL_ROUTES
  };
}

module.exports = { ROUTES, PROTECTED_PORTAL_ROUTES, createHttpBoundary };
