"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProductionMatterAuthorization } = require("./production-matter-authorization");

function matterRepository(records) {
  return { getById: async (id) => records.find((matter) => matter.id === id) || null };
}

test("client is limited to read access on its own matter", async () => {
  const authorization = createProductionMatterAuthorization({ matters: matterRepository([{ id: "m-1", clientId: "c-1", assignedUserId: "lawyer-1" }]) });
  const actor = { id: "client-1", role: "client", human: false, clientId: "c-1" };
  await assert.doesNotReject(() => authorization.assert(actor, "m-1", "read"));
  await assert.rejects(() => authorization.assert(actor, "m-1", "update"), /Matter access denied/);
  await assert.rejects(() => authorization.assert(actor, "m-2", "read"), /Matter access denied/);
});

test("assigned human professional can operate only its assigned matter", async () => {
  const authorization = createProductionMatterAuthorization({ matters: matterRepository([
    { id: "m-1", clientId: "c-1", assignedUserId: "lawyer-1" },
    { id: "m-2", clientId: "c-1", assignedUserId: "lawyer-2" }
  ]) });
  const actor = { id: "lawyer-1", role: "lawyer", human: true };
  await assert.doesNotReject(() => authorization.assert(actor, "m-1", "review"));
  await assert.rejects(() => authorization.assert(actor, "m-2", "review"), /Matter access denied/);
});

test("admin has full matter action access while non-human professionals fail closed", async () => {
  const authorization = createProductionMatterAuthorization({ matters: matterRepository([{ id: "m-1", clientId: "c-1", assignedUserId: "lawyer-1" }]) });
  await assert.doesNotReject(() => authorization.assert({ id: "admin-1", role: "admin", human: true }, "m-1", "archive"));
  await assert.rejects(() => authorization.assert({ id: "lawyer-1", role: "lawyer", human: false }, "m-1", "read"), /Matter access denied/);
});
