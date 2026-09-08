"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { ROUTES, createHttpBoundary } = require("./http-boundary");

function createBoundary() {
  const application = createApplicationRuntime({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) }
  });
  return createHttpBoundary({ application, authenticate: async () => ({ id: "human-http-1" }) });
}

test("HTTP boundary resolves every executable route to an existing service", async () => {
  const boundary = createBoundary();
  for (const path of Object.keys(ROUTES)) {
    const resolved = await boundary.resolve(path, {});
    assert.ok(resolved.service, `${path} resolved to no service`);
    assert.equal(resolved.actor.id, "human-http-1");
  }
});

test("HTTP boundary rejects unsupported and unauthenticated requests", async () => {
  const boundary = createBoundary();
  await assert.rejects(() => boundary.resolve("/api/unknown", {}), /Unsupported API route/);
  const unauthenticated = createHttpBoundary({ application: { crm: {} }, authenticate: async () => null });
  await assert.rejects(() => unauthenticated.resolve("/api/clients", {}), /Authenticated actor/);
});
