"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createAIGateway } = require("./ai-gateway-runtime");

function setup(provider = null) {
  const repositories = {
    aiInteractions: createCollection(),
    reviews: createCollection(),
    audit: createCollection()
  };
  const gateway = createAIGateway({
    repositories,
    provider: provider || { async execute(input) { return { answer: "draft", task: input.task }; } }
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

test("AI gateway rejects final human action tools before provider execution", async () => {
  let providerCalled = false;
  const { gateway } = setup({
    async execute() {
      providerCalled = true;
      return { answer: "should not execute" };
    }
  });

  await assert.rejects(
    () => gateway.execute({
      matterId: "matter-2",
      actor: { id: "user-1" },
      task: "resolve matter",
      tools: [{ name: "resolve" }]
    }),
    /AI cannot invoke final human action tool: resolve/
  );
  assert.equal(providerCalled, false);
});

test("AI gateway rejects malformed tool collections", async () => {
  const { gateway } = setup();
  await assert.rejects(
    () => gateway.execute({ matterId: "matter-3", actor: { id: "user-1" }, task: "research", tools: {} }),
    /AI tools must be an array/
  );
});
