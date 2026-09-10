"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createMatterAuthorization, createMatterScopedOperations } = require("./matter-authorization");

function transactionStub(events) {
  return { run: async (work) => { events.push("begin"); try { const result = await work({ id: "tx-1" }); events.push("commit"); return result; } catch (error) { events.push("rollback"); throw error; } } };
}

test("matter authorization denies before transactional work begins", async () => {
  const events = [];
  const authorization = createMatterAuthorization({ resolveAccess: async () => false });
  const operations = createMatterScopedOperations({ authorization, transaction: transactionStub(events) });
  await assert.rejects(
    () => operations.run({ actor: { id: "actor-1" }, matterId: "matter-2", work: async () => events.push("work") }),
    /Matter access denied/
  );
  assert.deepEqual(events, []);
});

test("matter authorization permits only the resolved matter scope", async () => {
  const events = [];
  const authorization = createMatterAuthorization({ resolveAccess: async ({ actor, matterId, action }) => actor.id === "actor-1" && matterId === "matter-1" && action === "update" });
  const operations = createMatterScopedOperations({ authorization, transaction: transactionStub(events) });
  const result = await operations.run({ actor: { id: "actor-1" }, matterId: "matter-1", action: "update", work: async ({ tx, matterId }) => ({ tx: tx.id, matterId }) });
  assert.deepEqual(result, { tx: "tx-1", matterId: "matter-1" });
  assert.deepEqual(events, ["begin", "commit"]);
});

test("matter authorization rolls back when authorized work fails", async () => {
  const events = [];
  const authorization = createMatterAuthorization({ resolveAccess: async () => true });
  const operations = createMatterScopedOperations({ authorization, transaction: transactionStub(events) });
  await assert.rejects(() => operations.run({ actor: { id: "actor-1" }, matterId: "matter-1", work: async () => { throw new Error("mutation failed"); } }), /mutation failed/);
  assert.deepEqual(events, ["begin", "rollback"]);
});

test("matter authorization rejects missing authentication and scope", async () => {
  const authorization = createMatterAuthorization({ resolveAccess: async () => true });
  await assert.rejects(() => authorization.assert(null, "matter-1"), /Authenticated actor is required/);
  await assert.rejects(() => authorization.assert({ id: "actor-1" }, ""), /Matter id is required/);
});
