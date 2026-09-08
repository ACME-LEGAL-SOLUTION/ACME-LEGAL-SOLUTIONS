"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createSqlRepositories } = require("./sql-repository-adapter");

function executor() {
  const calls = [];
  return { calls, async query(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT * FROM clients WHERE id")) return { rows: [{ id: "client-1", client_type: "person", status: "active", created_at: "2026-01-01" }] };
    if (sql.startsWith("INSERT INTO clients")) return { rows: [{ id: "client-1", client_type: "person", status: "active" }] };
    if (sql.startsWith("UPDATE matters SET status")) return { rows: [{ id: "matter-1", status: "closed", updated_at: "2026-01-01" }] };
    if (sql.startsWith("INSERT INTO audit_events")) return { rows: [{ id: "audit-1", actor_id: "human-1", actor_type: "human", event_type: "review", payload_json: "{\"approved\":true}" }] };
    return { rows: [] };
  }};
}

test("SQL adapter exposes every provider-neutral collection", () => {
  const { repositories } = createSqlRepositories({ executor: executor() });
  assert.equal(typeof repositories.clients.create, "function");
  assert.equal(typeof repositories.partners.update, "function");
  assert.equal(typeof repositories.matters.transition, "function");
  assert.equal(typeof repositories.auditService.append, "function");
});

test("SQL adapter parameterizes CRUD and maps domain fields", async () => {
  const db = executor(); const { repositories } = createSqlRepositories({ executor: db });
  const created = await repositories.clients.create({ id: "client-1", clientType: "person", status: "active" });
  assert.equal(created.clientType, "person");
  assert.match(db.calls[0].sql, /INSERT INTO clients/);
  assert.deepEqual(db.calls[0].params, ["client-1", "person", "active"]);
  const loaded = await repositories.clients.getById("client-1");
  assert.equal(loaded.clientType, "person");
});

test("SQL adapter scopes updates and matter transitions by id", async () => {
  const db = executor(); const { repositories } = createSqlRepositories({ executor: db });
  await repositories.matters.update("matter-1", { status: "review" });
  await repositories.matters.transition("matter-1", "closed");
  assert.match(db.calls[0].sql, /WHERE id = \$2/);
  assert.match(db.calls[1].sql, /WHERE id = \$3/);
});

test("SQL adapter records structured audit payloads", async () => {
  const db = executor(); const { repositories } = createSqlRepositories({ executor: db });
  await repositories.auditService.append({ id: "audit-1", actorId: "human-1", actorType: "human", eventType: "review", payload: { approved: true }, createdAt: "2026-01-01" });
  assert.match(db.calls[0].sql, /INSERT INTO audit_events/);
  assert.equal(db.calls[0].params[4], JSON.stringify({ approved: true }));
});

test("SQL adapter fails closed without an executor", () => {
  assert.throws(() => createSqlRepositories(), /SQL executor/);
});
