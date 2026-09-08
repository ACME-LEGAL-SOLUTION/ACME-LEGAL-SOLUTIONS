"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createHttpService } = require("./http-service");

test("HTTP boundary rejects unauthenticated requests", async () => {
  const service = createHttpService({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) },
    authenticate: async () => null
  });
  const result = await service.handle({ method: "POST", path: "/api/clients", body: { name: "Client" } });
  assert.equal(result.status, 401);
});

test("HTTP boundary authenticates and routes client creation", async () => {
  const service = createHttpService({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) },
    authenticate: async () => ({ id: "actor-1" })
  });
  const result = await service.handle({ method: "POST", path: "/api/clients", body: { name: "Client" } });
  assert.equal(result.status, 201);
  assert.equal(result.body.createdBy, "actor-1");
});

test("HTTP boundary sends AI work into review-required state", async () => {
  const service = createHttpService({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) },
    authenticate: async () => ({ id: "actor-1" })
  });
  const result = await service.handle({ method: "POST", path: "/api/ai/research", body: { matterId: "matter-1", task: "research" } });
  assert.equal(result.status, 200);
  assert.equal(result.body.decisionState, "review_required");
});
