"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransactionalStorage } = require("./transactional-storage");


test("transactional storage exposes the repository contract", () => {
  const storage = createTransactionalStorage();
  assert.equal(typeof storage.assert, "function");
  assert.equal(typeof storage.transaction.run, "function");
  assert.throws(() => storage.assertProductionReady(), /Transactional persistence provider is not configured/);
});

test("transactional storage accepts an explicit provider boundary", async () => {
  const calls = [];
  const transaction = {
    run: async (work) => {
      calls.push("run");
      return work({ id: "tx-1" });
    }
  };
  const storage = createTransactionalStorage({ transaction });
  assert.equal(storage.assertProductionReady(), true);
  assert.equal(await storage.transaction.run(async (tx) => tx.id), "tx-1");
  assert.deepEqual(calls, ["run"]);
});
