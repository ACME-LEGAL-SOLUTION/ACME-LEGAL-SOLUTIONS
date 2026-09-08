"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPersistentCrmOperations } = require("./persistent-crm-operations");

function makeRepositories(calls) {
  return {
    clients: { create: async (value) => { calls.push(["client", value]); return { ...value, id: value.id || "client-generated" }; } },
    matters: { create: async (value) => { calls.push(["matter", value]); return { ...value, id: value.id || "matter-generated" }; } }
  };
}

test("persistent CRM client creation uses the transaction-scoped repositories", async () => {
  const calls = [];
  const repositories = makeRepositories(calls);
  const scoped = makeRepositories(calls);
  const operations = createPersistentCrmOperations({
    transaction: { run: async (work) => work({ id: "tx-1", query() {} }) },
    repositories,
    repositoryFactory: () => scoped,
    clock: () => new Date("2026-09-09T00:00:00.000Z")
  });
  const client = await operations.createClient({ client: { id: "client-1" }, actor: { id: "actor-1" } });
  assert.equal(client.id, "client-1");
  assert.equal(calls[0][0], "client");
  assert.equal(calls[0][1].createdBy, "actor-1");
});

test("persistent CRM client-matter creation is atomic", async () => {
  const calls = [];
  const repositories = makeRepositories(calls);
  const txRepositories = makeRepositories(calls);
  let committed = false;
  let rolledBack = false;
  const operations = createPersistentCrmOperations({
    transaction: { run: async (work) => { const tx = { id: "tx-1", query() {} }; try { const result = await work(tx); committed = true; return result; } catch (error) { rolledBack = true; throw error; } } },
    repositories,
    repositoryFactory: () => txRepositories
  });
  const result = await operations.createClientMatter({ client: { id: "client-1" }, matter: { id: "matter-1" }, actor: { id: "actor-1" } });
  assert.equal(result.matter.clientId, "client-1");
  assert.equal(committed, true);
  assert.equal(rolledBack, false);
  assert.deepEqual(calls.map(([kind]) => kind), ["client", "matter"]);
});

test("matter authorization is evaluated before persistent transaction", async () => {
  const events = [];
  const operations = createPersistentCrmOperations({
    transaction: { run: async () => { events.push("transaction"); return "should-not-run"; } },
    repositories: makeRepositories([]),
    repositoryFactory: () => makeRepositories([]),
    matterAuthorization: { assert: async (actor, matterId, action) => { events.push(["authorize", actor.id, matterId, action]); throw new Error("Matter access denied: update"); } }
  });
  await assert.rejects(() => operations.matterOperation({ actor: { id: "actor-2" }, matterId: "matter-1", action: "update", work: async () => "blocked" }), /Matter access denied: update/);
  assert.deepEqual(events, [["authorize", "actor-2", "matter-1", "update"]]);
});

test("failed persistent CRM work propagates error for transaction rollback", async () => {
  let rolledBack = false;
  const operations = createPersistentCrmOperations({
    transaction: { run: async (work) => { try { return await work({ id: "tx-1", query() {} }); } catch (error) { rolledBack = true; throw error; } } },
    repositories: makeRepositories([]),
    repositoryFactory: () => makeRepositories([])
  });
  await assert.rejects(() => operations.matterOperation({ actor: { id: "actor-1" }, matterId: "matter-1", action: "update", work: async () => { throw new Error("domain failure"); } }), /domain failure/);
  assert.equal(rolledBack, true);
});
