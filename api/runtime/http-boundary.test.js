"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { ROUTES, createHttpBoundary } = require("./http-boundary");

function createBoundary(options = {}) {
  const application = createApplicationRuntime({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) }
  });
  return createHttpBoundary({ application, authenticate: async () => ({ id: "human-http-1" }), ...options });
}

test("HTTP boundary resolves every executable route to an existing service", async () => {
  const boundary = createBoundary();
  for (const path of Object.keys(ROUTES)) {
    const resolved = await boundary.resolve(path, {});
    assert.ok(resolved.service, `${path} resolved to no service`);
    assert.equal(resolved.actor.id, "human-http-1");
  }
});

test("consultation route may use only the explicitly configured public actor", async () => {
  const boundary = createBoundary({ publicActor: { id: "public-intake" } });
  const resolved = await boundary.resolve("/api/consultations", {});
  assert.equal(resolved.actor.id, "public-intake");
});

test("review route resolves to the governed review service", async () => {
  const boundary = createBoundary();
  const resolved = await boundary.resolve("/api/reviews", {});
  assert.equal(typeof resolved.service.create, "function");
  assert.equal(typeof resolved.service.decide, "function");
  assert.equal(typeof resolved.service.authorizeFinalAction, "function");
});

test("HTTP boundary rejects unsupported and unauthenticated requests", async () => {
  const boundary = createBoundary();
  await assert.rejects(() => boundary.resolve("/api/unknown", {}), /Unsupported API route/);
  const unauthenticated = createHttpBoundary({ application: { crm: {} }, authenticate: async () => null });
  await assert.rejects(() => unauthenticated.resolve("/api/clients", {}), /Authenticated actor/);
  const noPublicActor = createBoundary({ authenticate: async () => null });
  await assert.rejects(() => noPublicActor.resolve("/api/consultations", {}), /Authenticated actor/);
});
