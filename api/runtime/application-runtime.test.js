"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");

test("application runtime wires all executable service boundaries", () => {
  const app = createApplicationRuntime({ repositories: createApplicationRepositories(), provider: { execute: async () => ({}) } });
  assert.ok(app.runtime);
  assert.ok(app.crm);
  assert.ok(app.intake);
  assert.ok(app.ai);
  assert.ok(app.source);
  assert.ok(app.legalVersions);
  assert.ok(app.authorities);
  assert.ok(app.diary);
  assert.ok(app.billing);
  assert.ok(app.network);
});
