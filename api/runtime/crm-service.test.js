"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { createCrmService } = require("./crm-service");

test("CRM creates a client and links a matter to that client", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-02T00:00:00.000Z") });
  const service = createCrmService({
    repositories,
    clock: () => new Date("2026-01-02T00:00:00.000Z")
  });
  const actor = { id: "human-crm-1", role: "professional" };

  const client = await service.createClient({
    kind: "person",
    displayName: "Test Client"
  }, actor);

  assert.ok(client.id);
  assert.equal(client.createdBy, actor.id);

  const matter = await service.createMatter({
    clientId: client.id,
    title: "Initial consultation"
  }, actor);

  assert.ok(matter.id);
  assert.equal(matter.clientId, client.id);
  assert.equal(matter.ownerId, actor.id);
  assert.equal(matter.status, "lead");
});

test("CRM refuses a matter for a missing client", async () => {
  const repositories = createRepositories();
  const service = createCrmService({ repositories });

  await assert.rejects(
    () => service.createMatter({ clientId: "missing", title: "Invalid" }, { id: "human-crm-2" }),
    /Matter client was not found/
  );
});

test("CRM requires an authenticated actor", async () => {
  const repositories = createRepositories();
  const service = createCrmService({ repositories });

  await assert.rejects(
    () => service.createClient({ kind: "person" }, null),
    /Authenticated actor is required/
  );
});
