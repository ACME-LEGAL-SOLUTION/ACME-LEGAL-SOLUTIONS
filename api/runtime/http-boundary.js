"use strict";

const ROUTES = Object.freeze({
  "/api/clients": "clients",
  "/api/matters": "matters",
  "/api/parties": "parties",
  "/api/authorities": "authorities",
  "/api/hearings": "diary",
  "/api/diary": "diary",
  "/api/documents": "documents",
  "/api/evidence": "evidence",
  "/api/sources": "source",
  "/api/legal-versions": "legalVersions",
  "/api/ai": "ai",
  "/api/reviews": "reviews",
  "/api/partners": "network",
  "/api/billing": "billing"
});

function createHttpBoundary({ application, authenticate }) {
  if (!application) throw new Error("Application runtime is required");
  if (typeof authenticate !== "function") throw new Error("Authentication adapter is required");
  return {
    async resolve(path, request) {
      const serviceName = ROUTES[path];
      if (!serviceName || !application[serviceName]) throw new Error(`Unsupported API route: ${path}`);
      const actor = await authenticate(request);
      if (!actor?.id) throw new Error("Authenticated actor is required");
      return { service: application[serviceName], actor, path };
    },
    routes: ROUTES
  };
}

module.exports = { ROUTES, createHttpBoundary };
