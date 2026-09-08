"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");

test("application runtime composes without provider or storage vendor coupling", () => {
  const repositories = createApplicationRepositories();
  const provider = { execute: async () => ({ answer: "draft" }) };
  const app = createApplicationRuntime({ repositories, provider });
  assert.ok(app.runtime);
  assert.ok(app.ai);
  assert.ok(app.source);
  assert.ok(app.legalVersions);
  assert.ok(app.authorities);
  assert.ok(app.diary);
  assert.ok(app.billing);
  assert.ok(app.network);
});

test("AI execution enters human review rather than final action", async () => {
  const repositories = createApplicationRepositories();
  const provider = { execute: async () => ({ answer: "draft" }) };
  const app = createApplicationRuntime({ repositories, provider });
  const result = await app.ai.execute({
    matterId: "matter-1",
    actor: { id: "user-1" },
    task: "research",
    context: { jurisdiction: "IN" }
  });
  assert.equal(result.decisionState, "review_required");
  assert.equal(result.review.status, "pending");
  assert.equal(result.interaction.decisionState, "proposed");
});
