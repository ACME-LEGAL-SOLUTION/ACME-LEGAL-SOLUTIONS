"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRuntime } = require("./index");
const { createRepositories } = require("./in-memory-repository");

test("matter lifecycle follows the governed transition path", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-01T00:00:00.000Z") });
  const events = [];
  const runtime = createRuntime({
    repositories,
    audit: { append: async (event) => events.push(event) },
    clock: () => new Date("2026-01-01T00:00:00.000Z")
  });
  const actor = { id: "human-1", role: "professional" };

  let matter = await runtime.createMatter({ title: "Test matter" }, actor);
  assert.equal(matter.status, "lead");
  assert.equal(matter.ownerId, actor.id);

  for (const status of [
    "verified",
    "conflict_check",
    "matter_open",
    "active",
    "review"
  ]) {
    matter = await runtime.transitionMatter(matter, status, actor);
    assert.equal(matter.status, status);
  }

  await assert.rejects(
    () => runtime.transitionMatter(matter, "resolved", actor),
    /Human review and approval are required/
  );

  matter = await runtime.transitionMatter(matter, "resolved", actor, {
    id: "review-1",
    approved: true
  });
  assert.equal(matter.status, "resolved");
  assert.equal(events.length, 7);
});

test("invalid lifecycle jumps are rejected", async () => {
  const repositories = createRepositories();
  const runtime = createRuntime({ repositories });
  const actor = { id: "human-2" };
  const matter = await runtime.createMatter({ title: "Test matter" }, actor);

  await assert.rejects(
    () => runtime.transitionMatter(matter, "active", actor),
    /Invalid matter transition: lead -> active/
  );
});
