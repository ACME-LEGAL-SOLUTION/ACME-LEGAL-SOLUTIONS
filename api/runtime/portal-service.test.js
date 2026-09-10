"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createPortalService } = require("./portal-service");

function services() {
  return {
    crm: { getMatter: async () => ({ id: "m1", clientId: "c1", title: "Matter", status: "open" }) },
    document: { list: async () => [{ id: "d1" }] },
    evidence: { list: async () => [{ id: "e1" }] },
    diary: { listMatter: async () => [{ id: "h1" }] },
    billing: {},
    repositories: { matters: { list: async () => [{ id: "m1", clientId: "c1", title: "Matter", status: "open" }] } }
  };
}

test("client portal is scoped to the authenticated client", async () => {
  const portal = createPortalService(services());
  const result = await portal.clientDashboard({ clientId: "c1", actor: { id: "client-user", clientId: "c1" } });
  assert.equal(result.audience, "client");
  assert.equal(result.matters.length, 1);
  assert.deepEqual(result.matters[0].documents, [{ id: "d1" }]);
  await assert.rejects(() => portal.clientDashboard({ clientId: "c2", actor: { id: "client-user", clientId: "c1" } }), /access denied/);
});

test("professional workspace requires an authorized human professional", async () => {
  const portal = createPortalService(services());
  const result = await portal.professionalWorkspace({ matterId: "m1", actor: { id: "lawyer-1", human: true, role: "professional" } });
  assert.equal(result.audience, "professional");
  assert.equal(result.matter.id, "m1");
  await assert.rejects(() => portal.professionalWorkspace({ matterId: "m1", actor: { id: "ai", human: false, role: "professional" } }), /human professional/);
});
