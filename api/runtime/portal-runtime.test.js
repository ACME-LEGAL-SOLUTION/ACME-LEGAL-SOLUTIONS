"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");

test("application runtime exposes client and professional portal surfaces", async () => {
  const repositories = createApplicationRepositories();
  const app = createApplicationRuntime({ repositories, provider: { execute: async () => ({ answer: "draft" }) } });
  const actor = { id: "system", role: "admin", human: true };
  const client = await app.crm.createClient({ name: "Client" }, actor);
  await app.crm.createMatter({ clientId: client.id, title: "Matter", issue: "Issue" }, actor);
  const dashboard = await app.portal.clientDashboard({ clientId: client.id, actor: { id: "client", clientId: client.id } });
  assert.equal(dashboard.matters.length, 1);
  const workspace = await app.portal.professionalWorkspace({ matterId: dashboard.matters[0].id, actor: { id: "professional", role: "professional", human: true } });
  assert.equal(workspace.matter.id, dashboard.matters[0].id);
});
