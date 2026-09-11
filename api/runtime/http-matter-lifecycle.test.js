"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpServer } = require("./http-server");

function request(server, { method = "GET", path = "/health", body } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ hostname: "127.0.0.1", port: address.port, path, method, headers: body === undefined ? {} : { "content-type": "application/json" } }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (body === undefined) req.end(); else req.end(JSON.stringify(body));
  });
}

async function running(application, authenticate) {
  const server = createHttpServer({ application, authenticate });
  await new Promise((resolve) => server.listen(0, resolve));
  return server;
}

async function createMatter(server, title) {
  const client = await request(server, { method: "POST", path: "/api/clients", body: { name: `${title} Client`, email: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@example.com` } });
  assert.equal(client.status, 200);
  const matter = await request(server, { method: "POST", path: "/api/matters", body: { clientId: client.body.id, title } });
  assert.equal(matter.status, 200);
  return matter.body;
}

test("HTTP matter transition advances through the governed lifecycle", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const actor = { id: "professional-lifecycle", roles: ["professional"] };
  const server = await running(application, async () => actor);
  t.after(() => server.close());

  const matter = await createMatter(server, "Lifecycle Matter");
  assert.equal(matter.status, "lead");

  const result = await request(server, { method: "POST", path: "/api/matters/transition", body: { matterId: matter.id, nextStatus: "verified" } });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "verified");
});

test("HTTP matter transition rejects invalid jumps and preserves human approval gates", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const actor = { id: "professional-approval", roles: ["professional"] };
  const server = await running(application, async () => actor);
  t.after(() => server.close());

  const matter = await createMatter(server, "Approval Matter");
  const invalid = await request(server, { method: "POST", path: "/api/matters/transition", body: { matterId: matter.id, nextStatus: "resolved" } });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.error, /Invalid matter transition/);

  let current = matter;
  for (const nextStatus of ["verified", "conflict_check", "matter_open", "active", "review"]) {
    const step = await request(server, { method: "POST", path: "/api/matters/transition", body: { matterId: current.id, nextStatus } });
    assert.equal(step.status, 200);
    current = step.body;
  }

  const blocked = await request(server, { method: "POST", path: "/api/matters/transition", body: { matterId: current.id, nextStatus: "resolved" } });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body.error, /Human review and approval are required/);

  const approved = await request(server, { method: "POST", path: "/api/matters/transition", body: { matterId: current.id, nextStatus: "resolved", review: { approved: true } } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.status, "resolved");
});
