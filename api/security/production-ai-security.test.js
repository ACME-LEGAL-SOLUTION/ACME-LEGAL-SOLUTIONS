"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProductionAIProvider } = require("./production-ai-security");

test("production AI provider fails closed without configured adapter", () => {
  assert.throws(() => createProductionAIProvider({ env: {} }), /ACME_AI_PROVIDER_MODULE/);
});

test("production AI provider enforces model, tool, matter and context policy", async () => {
  const calls = [];
  const provider = createProductionAIProvider({
    env: { ACME_AI_PROVIDER_MODULE: "provider" },
    moduleLoader: () => ({
      id: "approved-provider",
      capabilities: ["chat"],
      allowedModels: ["approved-model"],
      allowedTools: ["read_matter"],
      maxToolCount: 1,
      maxTaskLength: 100,
      maxContextBytes: 1000,
      execute: async (input) => { calls.push(input); return { answer: "ok" }; }
    })
  });

  const result = await provider.execute({
    matterId: "matter-1",
    actor: { id: "human-1", role: "lawyer", human: true },
    task: "research",
    model: "approved-model",
    tools: [{ name: "read_matter" }],
    context: { jurisdiction: "IN" },
    requestId: "req-1"
  });
  assert.deepEqual(result, { answer: "ok" });
  assert.equal(calls[0].matterId, "matter-1");
  assert.equal(calls[0].requestId, "req-1");
  assert.equal(calls[0].actor.id, "human-1");
});

test("production AI provider rejects unapproved tools and models before provider execution", async () => {
  let called = false;
  const provider = createProductionAIProvider({
    env: { ACME_AI_PROVIDER_MODULE: "provider" },
    moduleLoader: () => ({ id: "p", allowedModels: ["m1"], allowedTools: ["read_matter"], execute: async () => { called = true; } })
  });
  await assert.rejects(() => provider.execute({ matterId: "m", actor: { id: "a" }, task: "x", model: "bad", tools: [{ name: "delete_matter" }] }), /AI tool is not permitted/);
  assert.equal(called, false);
  await assert.rejects(() => provider.execute({ matterId: "m", actor: { id: "a" }, task: "x", model: "bad", tools: [] }), /AI model is not permitted/);
  assert.equal(called, false);
});
