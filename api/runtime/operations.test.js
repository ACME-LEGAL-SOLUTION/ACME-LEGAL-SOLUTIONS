"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createAuthorityService } = require("./authority-service");
const { createDiaryService } = require("./diary-service");

test("authority registry scopes lookup by jurisdiction", async () => {
  const service = createAuthorityService({ repository: createCollection() });
  await service.register({ name: "Authority A", jurisdiction: "IN", authorityType: "court", actor: { id: "u" } });
  await service.register({ name: "Authority B", jurisdiction: "HK", authorityType: "court", actor: { id: "u" } });
  assert.equal((await service.listByJurisdiction("IN")).length, 1);
});

test("diary schedules and updates matter hearings", async () => {
  const service = createDiaryService({ repository: createCollection() });
  const actor = { id: "u" };
  const item = await service.schedule({ matterId: "m", authorityId: "a", hearingAt: "2026-10-01T10:00:00Z", title: "Hearing", actor });
  assert.equal(item.status, "scheduled");
  const updated = await service.updateStatus(item, "completed", actor, "Completed");
  assert.equal(updated.status, "completed");
});
