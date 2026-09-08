"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpBoundary } = require("./http-boundary");

const MAX_BODY_BYTES = 64 * 1024;
const PUBLIC_ACTOR = Object.freeze({ id: "website-public-intake", type: "system", scope: "public-intake" });

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      if (!body.trim()) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 })); }
    });
    request.on("error", reject);
  });
}

function json(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

function createHttpServer({ application, authenticate = async () => null, publicActor = PUBLIC_ACTOR } = {}) {
  const runtime = application || createApplicationRuntime({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) }
  });
  const boundary = createHttpBoundary({ runtime, application: runtime, authenticate, publicActor });

  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, { "access-control-allow-methods": "POST,GET,OPTIONS", "access-control-allow-headers": "content-type,authorization" });
        return response.end();
      }
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/health") return json(response, 200, { status: "ok" });
      if (!Object.prototype.hasOwnProperty.call(boundary.routes, url.pathname)) return json(response, 404, { error: "Not found" });
      if (request.method !== "POST") return json(response, 405, { error: "Method not allowed" });
      if (!String(request.headers["content-type"] || "").toLowerCase().includes("application/json")) return json(response, 415, { error: "Content-Type must be application/json" });

      const input = await readJsonBody(request);
      const resolved = await boundary.resolve(url.pathname, request);
      let result;
      if (url.pathname === "/api/consultations") result = await resolved.service.submit(input, resolved.actor);
      else throw Object.assign(new Error("Route handler is not implemented"), { statusCode: 501 });
      return json(response, 200, result);
    } catch (error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : /required|Invalid|incomplete/i.test(error.message || "") ? 400 : 500;
      return json(response, status, { error: error.message || "Internal server error" });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createHttpServer().listen(port, () => console.log(`ACME API listening on ${port}`));
}

module.exports = { MAX_BODY_BYTES, PUBLIC_ACTOR, createHttpServer, readJsonBody };
