"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSqlRepositories, createSqlRepository } = require("./sql-repository");

function fakeQuery() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/^SELECT \* FROM clients WHERE id/.test(sql)) return { rows: [{ id: "c1", client_type: "organization", status: "active", created_at: "2026-01-01", updated_at: "2026-01-01" }] };
      if (/^UPDATE/.test(sql)) return { affectedRows: 1 };
      if (/^SELECT \* FROM audit_events/.test(sql)) return { rows: [{ id: "a1", actor_id: "u1", actor_type: "human", event_type: "matter.created", payload_json: '{"ok":true}', created_at: "2026-01-01" }] };
      return { rows: [] };
    }
  };
}

test("SQL repository explicitly maps domain fields to relational columns", async () => {
  const fake = fakeQuery();
  const repository = createSqlRepository({ name: "clients", query: (sql, params) => fake.query(sql, params) });
  await repository.create({ id: "c1", clientType: "organization", personId: null, organizationId: "o1", status: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01", unsupported: "discarded" });
  assert.deepEqual(fake.calls[0], {
    sql: "INSERT INTO clients (id, client_type, person_id, organization_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    params: ["c1", "organization", null, "o1", "active", "2026-01-01", "2026-01-01"]
  });
});

test("SQL repository hydrates relational rows back into domain fields", async () => {
  const fake = fakeQuery();
  const repository = createSqlRepository({ name: "clients", query: (sql, params) => fake.query(sql, params) });
  assert.deepEqual(await repository.getById("c1"), {
    id: "c1", clientType: "organization", status: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01"
  });
});

test("SQL repository serializes and deserializes structured audit payloads", async () => {
  const fake = fakeQuery();
  const repository = createSqlRepository({ name: "audit", query: (sql, params) => fake.query(sql, params) });
  await repository.create({ id: "a1", actorId: "u1", actorType: "human", eventType: "matter.created", payload: { ok: true }, createdAt: "2026-01-01" });
  assert.equal(fake.calls[0].params[4], '{"ok":true}');
  assert.deepEqual(await repository.getById("a1"), { id: "a1", actorId: "u1", actorType: "human", eventType: "matter.created", payload: { ok: true }, createdAt: "2026-01-01" });
});

test("SQL repositories expose all persistence collections and matter transition", async () => {
  const fake = fakeQuery();
  const repositories = createSqlRepositories({ query: (sql, params) => fake.query(sql, params) });
  for (const name of ["clients", "matters", "relationships", "parties", "conflicts", "documents", "evidence", "aiInteractions", "reviews", "audit", "sources", "legalVersions", "authorities", "diary", "hearings", "invoices", "payments", "partners"]) {
    assert.equal(typeof repositories[name].create, "function");
    assert.equal(typeof repositories[name].getById, "function");
    assert.equal(typeof repositories[name].list, "function");
    assert.equal(typeof repositories[name].update, "function");
  }
  assert.equal(typeof repositories.matters.transition, "function");
  assert.equal(typeof repositories.auditService.append, "function");
  await repositories.matters.transition("m1", "active", { id: "u1" });
  assert.match(fake.calls.at(-2).sql, /^UPDATE matters SET status = \?, updated_at = \? WHERE id = \?$/);
});

test("SQL repository rejects unsupported collection names", () => {
  assert.throws(() => createSqlRepository({ name: "unknown", query: async () => ({ rows: [] }) }), /Unsupported SQL repository/);
});
