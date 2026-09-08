"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPersistentApplication } = require("./persistent-application");

function executorFromRows(calls = []) {
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("INSERT INTO clients")) return { rows: [{ id: params[0], client_type: params[1], status: params[2], created_at: params[3], updated_at: params[4] }] };
      if (sql.startsWith("INSERT INTO matters")) return { rows: [{ id: params[0], client_id: params[1], status: params[2] }] };
      if (sql.startsWith("SELECT * FROM clients")) return { rows: [{ id: params[0], client_type: "individual", status: "prospective" }] };
      return { rows: [] };
    }
  };
}

const testProvider = Object.freeze({ execute: async ({ task }) => ({ task, output: "test" }) });

function transactionProvider(events, txExecutor) {
  return {
    begin: async () => ({ id: "tx-1", query: txExecutor.query.bind(txExecutor) }),
    commit: async (tx) => events.push(["commit", tx.id]),
    rollback: async (tx) => events.push(["rollback", tx.id])
  };
}

test("persistent application composes the full runtime over SQL repositories", async () => {
  const executor = executorFromRows();
  const events = [];
  const app = createPersistentApplication({ executor, provider: testProvider, ...transactionProvider(events, executor) });
  assert.ok(app.application.crm);
  assert.ok(app.application.intake);
  assert.ok(app.application.document);
  assert.ok(app.application.evidence);
  assert.ok(app.repositories.clients);
  assert.ok(app.crmOperations);
  assert.equal(app.storage.assertProductionReady(), true);

  const client = await app.repositories.clients.create({ id: "client-1", clientType: "individual", status: "prospective", createdAt: "2026-09-09T00:00:00.000Z", updatedAt: "2026-09-09T00:00:00.000Z" });
  assert.equal(client.id, "client-1");
  assert.match(executor.calls[0].sql, /^INSERT INTO clients/);
  assert.deepEqual(executor.calls[0].params.slice(0, 3), ["client-1", "individual", "prospective"]);
  assert.equal((await app.repositories.clients.getById("client-1")).id, "client-1");
  assert.equal(events.length, 0);
});

test("persistent client-matter operation binds both writes to the transaction executor", async () => {
  const calls = [];
  const executor = executorFromRows(calls);
  const events = [];
  const app = createPersistentApplication({ executor, provider: testProvider, ...transactionProvider(events, executor) });
  const result = await app.operations.createClientMatter({ client: { id: "client-2", clientType: "individual", status: "prospective" }, matter: { id: "matter-2", status: "lead" }, actor: { id: "actor-1" } });
  assert.equal(result.client.id, "client-2");
  assert.equal(result.matter.clientId, "client-2");
  assert.deepEqual(events, [["commit", "tx-1"]]);
});

test("persistent CRM composition exposes the transaction-scoped client-matter operation", async () => {
  const calls = [];
  const executor = executorFromRows(calls);
  const events = [];
  const app = createPersistentApplication({ executor, provider: testProvider, ...transactionProvider(events, executor) });
  const result = await app.crmOperations.createClientMatter({ client: { id: "client-3", clientType: "individual", status: "prospective" }, matter: { id: "matter-3", status: "lead" }, actor: { id: "actor-1" } });
  assert.equal(result.matter.clientId, "client-3");
  assert.equal(calls.filter((call) => call.sql.startsWith("INSERT INTO clients")).length, 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("INSERT INTO matters")).length, 1);
  assert.deepEqual(events, [["commit", "tx-1"]]);
});

test("persistent matter authorization denies before transaction and preserves action", async () => {
  const events = [];
  const calls = [];
  const executor = executorFromRows(calls);
  const decisions = [];
  const app = createPersistentApplication({
    executor,
    provider: testProvider,
    ...transactionProvider(events, executor),
    resolveMatterAccess: async (input) => { decisions.push(input); return input.actor.id === "actor-1" && input.matterId === "matter-1" && input.action === "update"; }
  });
  await assert.rejects(() => app.matterOperations.run({ actor: { id: "actor-2" }, matterId: "matter-1", action: "update", work: async () => "no" }), /Matter access denied: update/);
  assert.deepEqual(events, []);
  assert.deepEqual(calls, []);
  assert.deepEqual(decisions[0], { actor: { id: "actor-2" }, matterId: "matter-1", action: "update" });
  const result = await app.matterOperations.run({ actor: { id: "actor-1" }, matterId: "matter-1", action: "update", work: async ({ tx }) => tx.id });
  assert.equal(result, "tx-1");
  assert.deepEqual(events, [["commit", "tx-1"]]);
});

test("persistent application refuses an incomplete transaction provider", () => {
  assert.throws(() => createPersistentApplication({ executor: executorFromRows(), provider: testProvider, begin: async () => ({}) }), /commit.*rollback functions are required/);
});
