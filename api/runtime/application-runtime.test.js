"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");

function createApp() {
  return createApplicationRuntime({
    repositories: createApplicationRepositories(),
    provider: { execute: async () => ({ answer: "draft" }) }
  });
}

test("application runtime wires all executable service boundaries", () => {
  const app = createApp();
  for (const name of ["runtime", "crm", "intake", "consultation", "party", "relationship", "conflict", "document", "evidence", "ai", "source", "legalVersions", "authorities", "diary", "billing", "network"]) {
    assert.ok(app[name], `${name} service missing`);
  }
});

test("application runtime keeps AI behind review", async () => {
  const app = createApp();
  const result = await app.ai.execute({ matterId: "matter-1", actor: { id: "human-1" }, task: "research" });
  assert.equal(result.decisionState, "review_required");
  assert.equal(result.review.status, "pending");
});

test("application runtime exposes website consultation workflow", async () => {
  const app = createApp();
  const result = await app.consultation.submit({ name: "Client", email: "client@example.com", summary: "Need legal review" }, { id: "website-system" });
  assert.ok(result.clientId);
  assert.ok(result.matterId);
  assert.equal(result.intakeState, "intake");
});
