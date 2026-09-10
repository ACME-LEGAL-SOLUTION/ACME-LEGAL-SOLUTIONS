"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { checkProductionConfiguration, createReadiness } = require("./production-readiness");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createHttpServer } = require("./http-server");

const productionEnv = {
  ACME_ENV: "production",
  ACME_AUTH_MODULE: "./auth",
  ACME_OBJECT_STORAGE_MODULE: "./storage",
  ACME_AI_PROVIDER_MODULE: "./ai",
  ACME_PAYMENT_PROVIDER_MODULE: "./payments",
  ACME_MESSAGING_PROVIDER_MODULE: "./messaging"
};

function request(server, path) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = require("node:http").request({ hostname: "127.0.0.1", port: address.port, path }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("production configuration fails closed when a required adapter is absent", () => {
  const result = checkProductionConfiguration({ ...productionEnv, ACME_AI_PROVIDER_MODULE: "" });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ["ACME_AI_PROVIDER_MODULE"]);
});

test("development readiness remains available without production adapters", async () => {
  const readiness = createReadiness({ env: { ACME_ENV: "development" } });
  assert.deepEqual(await readiness(), { status: "ready", environment: "development", checks: { production: false } });
});

test("production readiness requires persistence and all provider boundaries", async () => {
  const readiness = createReadiness({ env: productionEnv, repositories: {}, persistence: {} });
  const result = await readiness();
  assert.equal(result.status, "ready");
  assert.equal(result.checks.requiredAdapters, true);
  assert.equal(result.checks.persistence, true);
});

test("HTTP boundary exposes readiness and security headers", async (t) => {
  const repositories = createApplicationRepositories();
  const application = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const server = createHttpServer({ application });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const result = await request(server, "/ready");
  assert.equal(result.status, 200);
  assert.equal(result.body.status, "ready");
  assert.equal(result.headers["x-content-type-options"], "nosniff");
  assert.equal(result.headers["x-frame-options"], "DENY");
  assert.equal(result.headers["cache-control"], "no-store");
  assert.match(result.headers["content-security-policy"], /frame-ancestors 'none'/);
});
