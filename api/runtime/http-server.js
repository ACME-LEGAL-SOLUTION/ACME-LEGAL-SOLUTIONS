"use strict";

const http = require("node:http");
const { URL } = require("node:url");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpBoundary } = require("./http-boundary");

const MAX_BODY_BYTES = 64 * 1024;
const PUBLIC_ACTOR = Object.freeze({ id: "website-public-intake", type: "system", scope: "public-intake" });
const READ_OPERATIONS = new Set(["getClient", "getMatter", "getParty", "getRelationship", "getCheck", "getDocument", "getEvidence"]);
const OPERATIONS = Object.freeze({
  "/api/consultations": { POST: ["submit"] }, "/api/clients": { POST: ["createClient"], GET: ["getClient"] },
  "/api/matters": { POST: ["createMatter"], GET: ["getMatter"] }, "/api/parties": { POST: ["createParty"], GET: ["getParty"] },
  "/api/relationships": { POST: ["createRelationship"], GET: ["getRelationship"] }, "/api/conflicts": { POST: ["checkMatter"], GET: ["getCheck"] },
  "/api/documents": { POST: ["createDocument"], GET: ["getDocument"] }, "/api/evidence": { POST: ["createEvidence"], GET: ["getEvidence"] },
  "/api/authorities": { POST: ["register"], GET: ["listByJurisdiction"] }, "/api/hearings": { POST: ["schedule"] }, "/api/diary": { POST: ["schedule"] },
  "/api/sources": { POST: ["register"] }, "/api/legal-versions": { POST: ["create"] }, "/api/ai": { POST: ["execute"] },
  "/api/ai/intake": { POST: ["execute"] }, "/api/ai/research": { POST: ["execute"] }, "/api/ai/review": { POST: ["execute"] },
  "/api/reviews": { POST: ["create", "decide", "authorizeFinalAction"] }, "/api/partners": { POST: ["verify", "register"] },
  "/api/billing": { POST: ["createInvoice", "issue", "recordPayment"] }
});

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0; let body = ""; let rejected = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => { if (rejected) return; size += Buffer.byteLength(chunk); if (size > MAX_BODY_BYTES) { rejected = true; reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 })); request.resume(); return; } body += chunk; });
    request.on("end", () => { if (rejected) return; if (!body.trim()) return resolve({}); try { resolve(JSON.parse(body)); } catch { reject(Object.assign(new Error("Invalid JSON body"), { statusCode: 400 })); } });
    request.on("error", reject);
  });
}

function json(response, statusCode, payload) {
  const body = JSON.stringify(payload); response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "content-length": Buffer.byteLength(body) }); response.end(body);
}

function operationFor(path, method, input) {
  const choices = OPERATIONS[path]?.[method]; if (!choices?.length) throw Object.assign(new Error("Method not allowed"), { statusCode: 405 });
  if (choices.length === 1) return choices[0];
  if (!input?.operation || !choices.includes(input.operation)) throw Object.assign(new Error(`Operation is required; expected one of: ${choices.join(", ")}`), { statusCode: 400 });
  return input.operation;
}

async function invoke(service, operation, input, actor) {
  if (typeof service[operation] !== "function") throw Object.assign(new Error(`Service operation is not implemented: ${operation}`), { statusCode: 501 });
  if (READ_OPERATIONS.has(operation)) return service[operation](input.id || input.recordId, actor);
  if (operation === "submit") return service.submit(input, actor);
  if (operation === "execute") return service.execute({ ...input, actor });
  if (operation === "register") return service.register({ ...input, actor });
  if (operation === "create") return service.create({ ...input, actor });
  if (operation === "verify") return service.verify(input.record || input, actor, input.verificationState);
  if (operation === "schedule") return service.schedule({ ...input, actor });
  if (operation === "createClient" || operation === "createMatter" || operation === "createParty" || operation === "createRelationship" || operation === "checkMatter" || operation === "createDocument" || operation === "createEvidence") return service[operation](input, actor);
  if (operation === "createInvoice") return service.createInvoice({ ...input, actor });
  if (operation === "issue") return service.issue(input.invoice || input, actor);
  if (operation === "recordPayment") return service.recordPayment({ ...input, actor });
  if (operation === "decide") return service.decide(input.review || input, input.decision, actor, input.modification ?? null);
  if (operation === "authorizeFinalAction") return service.authorizeFinalAction(input.review || input, input.action, actor);
  throw Object.assign(new Error(`Unsupported service operation: ${operation}`), { statusCode: 501 });
}

function createHttpServer({ application, authenticate = async () => null, publicActor = PUBLIC_ACTOR } = {}) {
  const runtime = application || createApplicationRuntime({ repositories: createApplicationRepositories(), provider: { execute: async () => ({ answer: "draft" }) } });
  const boundary = createHttpBoundary({ application: runtime, authenticate, publicActor });
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") { response.writeHead(204, { "access-control-allow-methods": "POST,GET,OPTIONS", "access-control-allow-headers": "content-type,authorization" }); return response.end(); }
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/health") return json(response, 200, { status: "ok" });
      if (!Object.prototype.hasOwnProperty.call(boundary.routes, url.pathname)) return json(response, 404, { error: "Not found" });
      const input = request.method === "GET" ? Object.fromEntries(url.searchParams.entries()) : await (String(request.headers["content-type"] || "").toLowerCase().includes("application/json") ? readJsonBody(request) : Promise.reject(Object.assign(new Error("Content-Type must be application/json"), { statusCode: 415 })));
      const resolved = await boundary.resolve(url.pathname, request); const operation = operationFor(url.pathname, request.method, input);
      return json(response, 200, await invoke(resolved.service, operation, input, resolved.actor));
    } catch (error) { const status = Number.isInteger(error.statusCode) ? error.statusCode : /required|Invalid|incomplete/i.test(error.message || "") ? 400 : 500; return json(response, status, { error: error.message || "Internal server error" }); }
  });
}

if (require.main === module) { const port = Number(process.env.PORT || 3000); createHttpServer().listen(port, () => console.log(`ACME API listening on ${port}`)); }
module.exports = { MAX_BODY_BYTES, OPERATIONS, PUBLIC_ACTOR, createHttpServer, invoke, operationFor, readJsonBody };
