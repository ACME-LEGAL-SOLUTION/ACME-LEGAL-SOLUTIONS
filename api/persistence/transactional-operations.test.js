"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createTransactionalOperations } = require("./transactional-operations");

function setup() {
  const events = [];
  const transaction = {
    async run(work) {
      const tx = { id: "tx-1" };
      events.push("begin");
      try {
        const result = await work(tx);
        events.push("commit");
        return result;
      } catch (error) {
        events.push("rollback");
        throw error;
      }
    }
  };
  const records = [];
  const repositories = {
    clients: { create: async (value) => { records.push(["client", value]); return { id: value.id }; } },
    matters: { create: async (value) => { records.push(["matter", value]); return { id: value.id, clientId: value.clientId }; } }
  };
  return { events, records, transaction, repositories };
}

test("client and matter creation shares one transaction", async () => {
  const state = setup();
  const operations = createTransactionalOperations(state);
  const result = await operations.createClientMatter({
    client: { id: "client-1", clientType: "individual" },
    matter: { id: "matter-1", status: "lead" },
    actor: { id: "actor-1" }
  });
  assert.deepEqual(result, { client: { id: "client-1" }, matter: { id: "matter-1", clientId: "client-1" } });
  assert.deepEqual(state.events, ["begin", "commit"]);
  assert.equal(state.records[1][1].clientId, "client-1");
  assert.equal(state.records[0][1].transaction.id, "tx-1");
  assert.equal(state.records[1][1].transaction.id, "tx-1");
});

test("transaction-scoped repository factory is used for multi-step writes", async () => {
  const state = setup();
  const scopedRecords = [];
  const operations = createTransactionalOperations({
    ...state,
    repositoryFactory: (tx) => ({
      clients: { create: async (value) => { scopedRecords.push(["client", tx.id, value]); return { id: value.id }; } },
      matters: { create: async (value) => { scopedRecords.push(["matter", tx.id, value]); return { id: value.id, clientId: value.clientId }; } }
    })
  });
  await operations.createClientMatter({ client: { id: "client-1" }, matter: { id: "matter-1" }, actor: { id: "actor-1" } });
  assert.equal(state.records.length, 0);
  assert.equal(scopedRecords[0][1], "tx-1");
  assert.equal(scopedRecords[1][1], "tx-1");
});

test("failure in a multi-step operation rolls back", async () => {
  const state = setup();
  state.repositories.matters.create = async () => { throw new Error("matter write failed"); };
  const operations = createTransactionalOperations(state);
  await assert.rejects(
    operations.createClientMatter({ client: { id: "client-1" }, matter: { id: "matter-1" }, actor: { id: "actor-1" } }),
    /matter write failed/
  );
  assert.deepEqual(state.events, ["begin", "rollback"]);
});

test("generic transactional work receives the transaction and scoped repositories", async () => {
  const state = setup();
  const operations = createTransactionalOperations({
    ...state,
    repositoryFactory: () => ({ clients: { marker: true } })
  });
  const value = await operations.run(async ({ tx, repositories }) => ({ tx: tx.id, marker: repositories.clients.marker }));
  assert.deepEqual(value, { tx: "tx-1", marker: true });
});
