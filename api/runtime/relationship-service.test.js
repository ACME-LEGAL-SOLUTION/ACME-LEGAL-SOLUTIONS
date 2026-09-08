"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { createRelationshipService } = require("./relationship-service");

test("relationship service creates and lists graph edges", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-05T00:00:00.000Z") });
  const service = createRelationshipService({
    repositories,
    clock: () => new Date("2026-01-05T00:00:00.000Z")
  });
  const actor = { id: "human-rel-1", role: "professional" };

  const relationship = await service.createRelationship({
    fromId: "party-a",
    toId: "party-b",
    type: "representative",
    metadata: { source: "verified-intake" }
  }, actor);

  assert.ok(relationship.id);
  assert.equal(relationship.createdBy, actor.id);
  assert.equal(relationship.createdAt, "2026-01-05T00:00:00.000Z");
  assert.deepEqual(await service.listForParty("party-a", actor), [relationship]);
  assert.deepEqual(await service.listForParty("party-b", actor), [relationship]);
});

test("relationship service rejects unsafe graph edges", async () => {
  const repositories = createRepositories();
  const service = createRelationshipService({ repositories });

  await assert.rejects(
    () => service.createRelationship({ fromId: "party-a", toId: "party-a", type: "client" }, { id: "human-rel-2" }),
    /Relationship endpoints must differ/
  );

  await assert.rejects(
    () => service.createRelationship({ fromId: "party-a", toId: "party-b", type: "unknown" }, { id: "human-rel-2" }),
    /Invalid relationship type/
  );
});

test("relationship service requires an authenticated actor", async () => {
  const repositories = createRepositories();
  const service = createRelationshipService({ repositories });

  await assert.rejects(
    () => service.listForParty("party-a", null),
    /Authenticated actor is required/
  );
});
