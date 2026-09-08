"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPersistentApplication } = require("./persistent-application");

function executorFromRows() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("INSERT INTO clients")) return { rows: [{ id: params[0], client_type: params[1], status: params[2], created_at: params[3], updated_at: params[4] }] };
      if (sql.startsWith("SELECT * FROM clients")) return { rows: [{ id: params[0], client_type: "individual", status: "prospective" }] };
      return { rows: [] };
    }
  };
}

const testProvider = Object.freeze({ execute: async ({ task }) => ({ task, output: "test" }) });

test("persistent application composes the full runtime over SQL repositories", async () => {
  const executor = executorFromRows();
  const events = [];
  const app = createPersistentApplication({
    executor,
    provider: testProvider,
    begin: async () => ({ id: "tx-1" }),
    commit: async (tx) => events.push(["commit", tx.id]),
    rollback: async (tx) => events.push(["rollback", tx.id])
  });

  assert.ok(app.application.crm);
  assert.ok(app.application.intake);
  assert.ok(app.application.document);
  assert.ok(app.application.evidence);
  assert.ok(app.repositories.clients);
  assert.equal(app.storage.assertProductionReady(), true);

  const client = await app.repositories.clients.create({
    id: "client-1",
    clientType: "individual",
    status: "prospective",
    createdAt: "2026-09-09T00:00:00.000Z",
    updatedAt: "2026-09-09T00:00:00.000Z"
  });
  assert.equal(client.id, "client-1");
  assert.match(executor.calls[0].sql, /^INSERT INTO clients/);
  assert.deepEqual(executor.calls[0].params.slice(0, 3), ["client-1", "individual", "prospective"]);

  const found = await app.repositories.clients.getById("client-1");
  assert.equal(found.id, "client-1");
  assert.equal(events.length, 0);
});

test("persistent application refuses an incomplete transaction provider", () => {
  const executor = executorFromRows();
  assert.throws(
    () => createPersistentApplication({ executor, provider: testProvider, begin: async () => ({}) }),
    /commit.*rollback functions are required/
  );
});
