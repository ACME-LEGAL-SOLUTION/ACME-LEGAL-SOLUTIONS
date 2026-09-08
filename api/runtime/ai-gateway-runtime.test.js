"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createAIGateway } = require("./ai-gateway-runtime");

function setup() {
  const repositories = {
    aiInteractions: createCollection(),
    reviews: createCollection(),
    audit: createCollection()
  };
  const gateway = createAIGateway({
    repositories,
    provider: { async execute(input) { return { answer: "draft", task: input.task }; } }
  });
  return { repositories, gateway };
}

test("AI gateway always creates a human review requirement", async () => {
  const { gateway, repositories } = setup();
  const result = await gateway.execute({ matterId: "matter-1", actor: { id: "ai-user" }, task: "research" });
  assert.equal(result.decisionState, "review_required");
  assert.equal(result.review.status, "pending");
  assert.equal((await repositories.aiInteractions.list()).length, 1);
});

test("AI gateway requires matter scope and authenticated actor", async () => {
  const { gateway } = setup();
  await assert.rejects(() => gateway.execute({ actor: { id: "u" }, task: "research" }), /Matter scope/);
  await assert.rejects(() => gateway.execute({ matterId: "m", task: "research" }), /Authenticated actor/);
});
