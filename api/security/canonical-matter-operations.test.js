"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ACTIONS, createMatterAuthorization, createMatterScopedOperations } = require("./matter-authorization");

test("canonical matter authorization accepts only the controlled action vocabulary", () => {
  assert.deepEqual(ACTIONS, ["read", "create", "update", "assign", "review", "close", "archive"]);
});

test("canonical gate authorizes before opening a transaction", async () => {
  const events = [];
  const authorization = createMatterAuthorization({ resolveAccess: async (input) => {
    events.push(["authorize", input]);
    return input.action === "review";
  }});
  const operations = createMatterScopedOperations({
    authorization,
    transaction: { run: async (work) => { events.push(["transaction"]); return work({ tx: {}, repositories: {} }); } }
  });
  await assert.rejects(() => operations.run({ actor: { id: "actor-2" }, matterId: "matter-1", action: "update", work: async () => "blocked" }), /Matter access denied: update/);
  assert.deepEqual(events, [["authorize", { actor: { id: "actor-2" }, matterId: "matter-1", action: "update" }]]);
  events.length = 0;
  assert.equal(await operations.run({ actor: { id: "actor-1" }, matterId: "matter-1", action: "review", work: async () => "approved" }), "approved");
  assert.equal(events[0][0], "authorize");
  assert.equal(events[1][0], "transaction");
});

test("canonical gate rejects unsupported action vocabulary", async () => {
  const authorization = createMatterAuthorization({ resolveAccess: async () => true });
  await assert.rejects(() => authorization.assert({ id: "actor-1" }, "matter-1", "document.write"), /Invalid matter action/);
});

test("canonical scoped operation forwards transaction repositories to domain work", async () => {
  const repository = { marker: "transaction-scoped" };
  const authorization = createMatterAuthorization({ resolveAccess: async () => true });
  const operations = createMatterScopedOperations({
    authorization,
    transaction: { run: async (work) => work({ query: () => {}, id: "tx-1" }) },
    repositoryFactory: () => repository
  });
  const result = await operations.run({ actor: { id: "actor-1" }, matterId: "matter-1", action: "update", work: async ({ tx, repositories, matterId }) => ({ tx, repositories, matterId }) });
  assert.equal(result.tx.id, "tx-1");
  assert.equal(result.repositories, repository);
  assert.equal(result.matterId, "matter-1");
});
