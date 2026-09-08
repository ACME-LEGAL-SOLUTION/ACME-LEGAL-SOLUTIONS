"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ACTIONS, createAccessControl } = require("./access-control");

test("matter access control delegates authorization to server policy", async () => {
  const calls = [];
  const access = createAccessControl({
    policy: {
      can: async (input) => {
        calls.push(input);
        return input.actor.id === "human-access-1" && input.action === "read";
      }
    }
  });

  assert.equal(await access.authorize({
    actor: { id: "human-access-1", role: "professional" },
    action: "read",
    matter: { id: "matter-1" }
  }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].matter.id, "matter-1");
});

test("matter access control denies unauthorized access", async () => {
  const access = createAccessControl({ policy: { can: async () => false } });

  await assert.rejects(
    () => access.authorize({ actor: { id: "intruder" }, action: "read", matter: { id: "matter-1" } }),
    (error) => error.code === "MATTER_ACCESS_DENIED"
  );
});

assert.ok(ACTIONS.includes("review"));
