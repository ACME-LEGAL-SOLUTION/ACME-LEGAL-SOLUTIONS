"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpServer } = require("./http-server");

function request(server, { method = "GET", path = "/health", body, contentType = "application/json" } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = require("node:http").request({ hostname: "127.0.0.1", port: address.port, path, method, headers: body === undefined ? {} : { "content-type": contentType } }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (body !== undefined) req.end(JSON.stringify(body)); else req.end();
  });
}

test("HTTP server exposes health endpoint", async (t) => {
  const server = createHttpServer();
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const result = await request(server);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { status: "ok" });
});

test("HTTP server completes public consultation end-to-end", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const server = createHttpServer({ application });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const result = await request(server, {
    method: "POST",
    path: "/api/consultations",
    body: { name: "Test Client", email: "CLIENT@EXAMPLE.COM", subject: "Contract", summary: "Need agreement review", jurisdiction: "IN", urgency: "urgent" }
  });
  assert.equal(result.status, 200);
  assert.ok(result.body.clientId);
  assert.ok(result.body.matterId);
  assert.equal(result.body.intakeState, "intake");
  assert.equal((await repositories.clients.list()).length, 1);
  assert.equal((await repositories.matters.list()).length, 1);
});

test("HTTP server rejects malformed consultation requests", async (t) => {
  const server = createHttpServer();
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const invalidJson = await new Promise((resolve, reject) => {
    const address = server.address();
    const req = require("node:http").request({ hostname: "127.0.0.1", port: address.port, path: "/api/consultations", method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on("error", reject);
    req.end("{bad");
  });
  assert.equal(invalidJson.status, 400);
  assert.match(invalidJson.body.error, /Invalid JSON/);
  const unsupported = await request(server, { method: "GET", path: "/api/consultations" });
  assert.equal(unsupported.status, 405);
});
