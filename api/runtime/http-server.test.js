"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpServer, operationFor } = require("./http-server");

function request(server, { method = "GET", path = "/health", body, contentType = "application/json" } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ hostname: "127.0.0.1", port: address.port, path, method, headers: body === undefined ? {} : { "content-type": contentType } }, (res) => {
      let data = ""; res.setEncoding("utf8"); res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject); if (body !== undefined) req.end(JSON.stringify(body)); else req.end();
  });
}
async function running(application, authenticate) { const server = createHttpServer({ application, authenticate }); await new Promise((resolve) => server.listen(0, resolve)); return server; }

test("HTTP server health and public consultation flow work end-to-end", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const server = await running(application); t.after(() => server.close());
  assert.deepEqual((await request(server)).body, { status: "ok", persistence: "provider-boundary" });
  const result = await request(server, { method: "POST", path: "/api/consultations", body: { name: "Test Client", email: "CLIENT@EXAMPLE.COM", summary: "Need agreement review", jurisdiction: "IN", urgency: "urgent" } });
  assert.equal(result.status, 200); assert.ok(result.body.clientId); assert.ok(result.body.matterId); assert.equal(result.body.intakeState, "intake");
});

test("HTTP server dispatches authenticated CRM and party operations", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const actor = { id: "professional-1", roles: ["professional"] };
  const server = await running(application, async () => actor); t.after(() => server.close());
  const client = await request(server, { method: "POST", path: "/api/clients", body: { name: "Acme Client", email: "client@example.com" } });
  assert.equal(client.status, 200); assert.ok(client.body.id);
  const party = await request(server, { method: "POST", path: "/api/parties", body: { kind: "person", displayName: "Party One" } });
  assert.equal(party.status, 200); assert.ok(party.body.id);
  const found = await request(server, { method: "GET", path: `/api/clients?id=${encodeURIComponent(client.body.id)}` });
  assert.equal(found.status, 200); assert.equal(found.body.id, client.body.id);
});

test("HTTP server enforces authentication on non-public routes", async (t) => {
  const server = await running(); t.after(() => server.close());
  const result = await request(server, { method: "POST", path: "/api/clients", body: { name: "Blocked" } });
  assert.equal(result.status, 401); assert.match(result.body.error, /Authenticated actor/);
});

test("HTTP dispatcher rejects invalid method, content type and ambiguous operation", async (t) => {
  const server = await running(); t.after(() => server.close());
  assert.equal((await request(server, { method: "GET", path: "/api/consultations" })).status, 405);
  assert.equal((await request(server, { method: "POST", path: "/api/consultations", body: { name: "x" }, contentType: "text/plain" })).status, 415);
  assert.throws(() => operationFor("/api/reviews", "POST", {}), /Operation is required/);
});
