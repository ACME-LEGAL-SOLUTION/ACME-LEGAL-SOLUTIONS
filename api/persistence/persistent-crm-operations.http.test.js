"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPersistentCrmOperations } = require("./persistent-crm-operations");

test("persistent CRM operation contract is HTTP-safe: caller identity and matter scope are explicit", async () => {
  const seen = [];
  const operations = createPersistentCrmOperations({
    transaction: { run: async (work) => work({ id: "tx-http" }) },
    repositories: { clients: {}, matters: {} },
    repositoryFactory: () => ({ clients: {}, matters: {} }),
    matterAuthorization: { assert: async (actor, matterId, action) => { seen.push({ actorId: actor.id, matterId, action }); return true; } }
  });

  const result = await operations.matterOperation({
    actor: { id: "actor-http" },
    matterId: "matter-http",
    action: "review",
    work: async ({ actor, matterId, tx }) => ({ actorId: actor.id, matterId, txId: tx.id })
  });

  assert.deepEqual(seen, [{ actorId: "actor-http", matterId: "matter-http", action: "review" }]);
  assert.deepEqual(result, { actorId: "actor-http", matterId: "matter-http", txId: "tx-http" });
});
