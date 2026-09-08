"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createApplicationRepositories } = require("./repository-factory");
const { createIntakeService } = require("./intake-service");
const { createConsultationService } = require("./consultation-service");

test("consultation submission creates prospective client and lead matter", async () => {
  const clock = () => new Date("2026-09-09T00:00:00.000Z");
  const repositories = createApplicationRepositories({ clock });
  const service = createConsultationService({ intake: createIntakeService({ repositories, clock }), clock });
  const result = await service.submit({
    name: "Test Client",
    email: " TEST@EXAMPLE.COM ",
    phone: "123",
    subject: "Contract review",
    summary: "Please review the agreement.",
    jurisdiction: "IN",
    urgency: "urgent"
  }, { id: "website-system" });
  assert.ok(result.clientId);
  assert.ok(result.matterId);
  assert.equal(result.intakeState, "intake");
  const client = await repositories.clients.getById(result.clientId);
  const matter = await repositories.matters.getById(result.matterId);
  assert.equal(client.email, "test@example.com");
  assert.equal(matter.jurisdiction, "IN");
  assert.equal(matter.urgency, "urgent");
});

test("consultation submission rejects incomplete public intake", async () => {
  const repositories = createApplicationRepositories();
  const service = createConsultationService({ intake: createIntakeService({ repositories }) });
  await assert.rejects(() => service.submit({ email: "x@example.com", summary: "Matter" }, { id: "website-system" }), /Name is required/);
  await assert.rejects(() => service.submit({ name: "Client", summary: "Matter" }, { id: "website-system" }), /Email is required/);
  await assert.rejects(() => service.submit({ name: "Client", email: "x@example.com" }, { id: "website-system" }), /Matter summary is required/);
});
