"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createAIProviderContract } = require("./ai-provider-contract");

test("AI provider contract validates execute and preserves capabilities", async () => {
  const provider = createAIProviderContract({ id: "test", capabilities: ["chat"], async execute(input) { return { task: input.task }; } });
  assert.equal(provider.id, "test");
  assert.deepEqual(provider.capabilities, ["chat"]);
  assert.deepEqual(await provider.execute({ task: "research" }), { task: "research" });
});

test("AI provider contract rejects invalid providers and capabilities", () => {
  assert.throws(() => createAIProviderContract(), /execute/);
  assert.throws(() => createAIProviderContract({ async execute() {}, capabilities: ["final_action"] }), /Unsupported AI provider capability/);
});
