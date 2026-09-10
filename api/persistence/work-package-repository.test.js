"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createSqlRepositories } = require("./sql-repository-adapter");

function fakeExecutor() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("INSERT")) return { rows: [{ id: params[0], matter_id: params[1], state: params[2], payload_json: params[6], provenance_json: params[7], confidence: params[8], created_at: params[9], updated_at: params[10], created_by: params[11] }] };
      if (sql.startsWith("SELECT")) return { rows: [{ id: "wp-1", matter_id: "m1", state: "review", payload_json: JSON.stringify({ analysis: "A" }), provenance_json: JSON.stringify([{ type: "source", id: "s1" }]), confidence: 0.8 }] };
      return { rows: [{ id: "wp-1", matter_id: "m1", state: "approved" }] };
    }
  };
}

test("work package repository round-trips governed JSON fields", async () => {
  const executor = fakeExecutor();
  const { repositories } = createSqlRepositories({ executor });
  const created = await repositories.workPackages.create({
    id: "wp-1", matterId: "m1", state: "review", issue: "Issue", jurisdiction: "IN", applicableDate: "2026-09-10",
    payloadJson: { analysis: "A" }, provenanceJson: [{ type: "source", id: "s1" }], confidence: 0.8,
    createdAt: "2026-09-10T00:00:00.000Z", updatedAt: "2026-09-10T00:00:00.000Z", createdBy: "p1"
  });
  assert.equal(created.id, "wp-1");
  assert.match(executor.calls[0].sql, /work_packages/);
  const found = await repositories.workPackages.getById("wp-1");
  assert.deepEqual(found.payloadJson, { analysis: "A" });
  assert.deepEqual(found.provenanceJson, [{ type: "source", id: "s1" }]);
});
