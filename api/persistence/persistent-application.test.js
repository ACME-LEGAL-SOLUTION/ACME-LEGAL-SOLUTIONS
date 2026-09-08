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
  const result = await app.operations.createClientMatter({
    client: { id: "client-2", clientType: "individual", status: "prospective" },
    matter: { id: "matter-2", status: "lead" },
    actor: { id: "actor-1" }
  });
  assert.equal(result.client.id, "client-2");
  assert.equal(result.client.clientType, "individual");
  assert.equal(result.client.status, "prospective");
  assert.equal(result.matter.id, "matter-2");
  assert.equal(result.matter.clientId, "client-2");
  assert.equal(result.matter.status, "lead");
  assert.equal(calls.filter((call) => call.sql.startsWith("INSERT INTO clients")).length, 1);
  assert.equal(calls.filter((call) => call.sql.startsWith("INSERT INTO matters")).length, 1);
  assert.deepEqual(events, [["commit", "tx-1"]]);
});

test("persistent application composes matter authorization when configured", async () => {
  const events = [];
  const executor = executorFromRows();
  const app = createPersistentApplication({
    executor,
    provider: testProvider,
    ...transactionProvider(events, executor),
    resolveMatterAccess: async ({ actor, matterId }) => actor.id === "actor-1" && matterId === "matter-1"
  });
  assert.ok(app.authorization);
  assert.ok(app.matterOperations);
  await assert.rejects(() => app.matterOperations.run({ actor: { id: "actor-2" }, matterId: "matter-1", work: async () => "no" }), /Matter access denied/);
  assert.deepEqual(events, []);
  assert.deepEqual(await app.matterOperations.run({ actor: { id: "actor-1" }, matterId: "matter-1", work: async ({ matterId }) => matterId }), "matter-1");
  assert.deepEqual(events, [["commit", "tx-1"]]);
});

test("persistent application refuses an incomplete transaction provider", () => {
  assert.throws(() => createPersistentApplication({ executor: executorFromRows(), provider: testProvider, begin: async () => ({}) }), /commit.*rollback functions are required/);
});
