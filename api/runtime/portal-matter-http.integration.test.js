"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const http = require("node:http");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpServer } = require("./http-server");

function request(server, { method = "GET", path, body } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const headers = body === undefined ? {} : { "content-type": "application/json" };
    const req = http.request({ hostname: "127.0.0.1", port: address.port, path, method, headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (body !== undefined) req.end(JSON.stringify(body)); else req.end();
  });
}

test("portal matter HTTP endpoints execute against the application runtime", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const professional = { id: "professional-1", role: "professional", human: true };
  const client = await application.crm.createClient({ name: "Portal Client" }, professional);
  const matter = await application.crm.createMatter({ clientId: client.id, title: "Portal Matter", issue: "Agreement review", jurisdiction: "IN" }, professional);
  const server = createHttpServer({ application, authenticate: async () => professional });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const details = await request(server, { path: `/api/portal/matter?matterId=${matter.id}` });
  assert.equal(details.status, 200);
  assert.equal(details.body.matter.id, matter.id);

  const created = await request(server, {
    method: "POST",
    path: `/api/portal/work-package/action?matterId=${matter.id}`,
    body: { operation: "create", workPackage: { facts: [], evidence: [], authorities: [], specialistFindings: [], analysis: "Draft", uncertainty: [], confidence: 0.5, recommendedActions: [], requiredDocuments: [], requiredTasks: [] } }
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.state, "review");

  const approved = await request(server, { method: "POST", path: `/api/portal/work-package/action?matterId=${matter.id}`, body: { operation: "approved" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.state, "approved");
});
