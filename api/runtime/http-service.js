"use strict";

const { createApplicationRuntime } = require("./application-runtime");

function createHttpService({ repositories, provider, authenticate, clock = () => new Date(), conflictCheck = null } = {}) {
  if (typeof authenticate !== "function") throw new Error("Authentication adapter is required");
  const app = createApplicationRuntime({ repositories, provider, clock, conflictCheck });

  async function handle(request = {}) {
    const actor = await authenticate(request);
    if (!actor?.id) return response(401, { error: "Authentication required" });
    const method = String(request.method || "GET").toUpperCase();
    const path = String(request.path || "");

    if (method === "POST" && path === "/api/clients") {
      return response(201, await app.crm.createClient(request.body, actor));
    }
    if (method === "POST" && path === "/api/matters") {
      return response(201, await app.crm.createMatter(request.body, actor));
    }
    if (method === "POST" && path === "/api/ai/research") {
      return response(200, await app.ai.execute({ ...request.body, actor }));
    }
    if (method === "POST" && path === "/api/intake") {
      return response(201, await app.intake.start(request.body, actor));
    }

    return response(404, { error: "Route not found" });
  }

  return Object.freeze({ handle, app });
}

function response(status, body) {
  return { status, body };
}

module.exports = { createHttpService };
