"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createKnowledgeAuthorization } = require("./knowledge-authorization");

test("knowledge authorization permits explicitly allowed read actions", () => {
  const auth = createKnowledgeAuthorization({ policy: { can: ({ action }) => action === "read_source" } });
  assert.equal(auth.assert({ id: "u1" }, "read_source", { id: "s1" }), true);
});

test("knowledge authorization fails closed for denied or unsupported actions", () => {
  const auth = createKnowledgeAuthorization({ policy: { can: () => false } });
  assert.throws(() => auth.assert({ id: "u1" }, "read_source"), /access denied/);
  assert.throws(() => auth.assert({ id: "u1" }, "resolve"), /Unsupported knowledge action/);
  assert.throws(() => auth.assert(null, "read_source"), /Authenticated actor/);
});
