"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { RESULTS, createConflictService } = require("./conflict-service");

test("conflict service records a deterministic check", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-03T00:00:00.000Z") });
  const service = createConflictService({
    repositories,
    clock: () => new Date("2026-01-03T00:00:00.000Z")
  });

  const result = await service.checkMatter({
    matterId: "matter-1",
    partyIds: ["party-a", "party-a", "party-b"],
    result: "clear"
  }, { id: "human-conflict-1" });

  assert.match(result.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(result.partyIds, ["party-a", "party-b"]);
  assert.equal(result.checkedBy, "human-conflict-1");
  assert.equal(result.checkedAt, "2026-01-03T00:00:00.000Z");
});

test("conflict service rejects incomplete or unauthenticated checks", async () => {
  const repositories = createRepositories();
  const service = createConflictService({ repositories });

  await assert.rejects(
    () => service.checkMatter({ matterId: "matter-1", partyIds: [], result: "clear" }, { id: "human-1" }),
    /At least one party is required/
  );

  await assert.rejects(
    () => service.checkMatter({ matterId: "matter-1", partyIds: ["party-a"], result: "clear" }, null),
    /Authenticated actor is required/
  );
});

assert.deepEqual(RESULTS, ["clear", "potential", "blocked"]);
