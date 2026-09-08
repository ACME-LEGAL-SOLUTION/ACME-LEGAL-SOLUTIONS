"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTransactionBoundary, createUnsupportedTransactionBoundary } = require("./transaction-contract");

test("transaction commits after successful work", async () => {
  const calls = [];
  const tx = createTransactionBoundary({
    begin: async () => { calls.push("begin"); return { id: "tx-1" }; },
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback")
  });
  const result = await tx.run(async (transaction) => { calls.push(transaction.id); return "ok"; });
  assert.equal(result, "ok");
  assert.deepEqual(calls, ["begin", "tx-1", "commit"]);
});

test("transaction rolls back and preserves the original error", async () => {
  const calls = [];
  const expected = new Error("failure");
  const tx = createTransactionBoundary({
    begin: async () => { calls.push("begin"); return {}; },
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback")
  });
  await assert.rejects(() => tx.run(async () => { throw expected; }), (error) => error === expected);
  assert.deepEqual(calls, ["begin", "rollback"]);
});

test("transaction work must be callable", async () => {
  const tx = createTransactionBoundary({ begin: async () => ({}), commit: async () => {}, rollback: async () => {} });
  await assert.rejects(() => tx.run(null), /Transaction work function is required/);
});

test("unconfigured production transaction boundary fails closed", async () => {
  await assert.rejects(
    () => createUnsupportedTransactionBoundary().run(async () => "unsafe"),
    /Transactional persistence provider is not configured/
  );
});
