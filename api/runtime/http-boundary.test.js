"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createHttpBoundary } = require("./http-boundary");

test("HTTP boundary authenticates and resolves supported services", async () => {
  const service = {};
  const boundary = createHttpBoundary({ application: { clients: service }, authenticate: async () => ({ id: "u" }) });
  const result = await boundary.resolve("/api/clients", {});
  assert.equal(result.service, service);
  assert.equal(result.actor.id, "u");
});

test("HTTP boundary rejects unsupported routes and unauthenticated requests", async () => {
  const boundary = createHttpBoundary({ application: { clients: {} }, authenticate: async () => null });
  await assert.rejects(() => boundary.resolve("/api/unknown", {}), /Unsupported API route/);
  const authenticatedBoundary = createHttpBoundary({ application: { clients: {} }, authenticate: async () => null });
  await assert.rejects(() => authenticatedBoundary.resolve("/api/clients", {}), /Authenticated actor/);
});
