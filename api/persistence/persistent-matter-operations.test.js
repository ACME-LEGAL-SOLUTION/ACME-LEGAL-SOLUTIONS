"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPersistentMatterOperations } = require("./persistent-matter-operations");

function repos(calls) {
  const make = (name) => ({ create: async (value) => { calls.push([name, value]); return value; }, getById: async (id) => ({ id }) });
  return { parties: make("party"), relationships: make("relationship"), conflicts: make("conflict"), documents: make("document"), evidence: make("evidence"), audit: make("audit") };
}

function operation(calls, authorize = null) {
  const root = repos(calls);
  const scoped = repos(calls);
  return createPersistentMatterOperations({
    transaction: { run: async (work) => work({ id: "tx-1", query() {} }) },
    repositories: root,
    repositoryFactory: () => scoped,
    matterAuthorization: authorize ? { assert: authorize } : null,
    clock: () => new Date("2026-09-09T00:00:00.000Z")
  });
}

test("matter evidence chain uses one transaction and writes party through audit", async () => {
  const calls = [];
  const ops = operation(calls);
  const result = await ops.createMatterEvidenceChain({
    actor: { id: "actor-1" }, matterId: "matter-1",
    party: { id: "party-1", kind: "person", displayName: "Client Party" },
    relationship: { id: "rel-1", fromId: "party-1", toId: "party-2", type: "client" },
    conflict: { id: "conflict-1", result: "clear" },
    document: { id: "doc-1", type: "pleading", storageKey: "matter-1/doc-1" },
    evidence: { id: "evidence-1", type: "document" },
    audit: { id: "audit-1", eventType: "matter.evidence_chain.created" }
  });
  assert.equal(result.party.matterId, "matter-1");
  assert.equal(result.evidence.sourceDocumentId, "doc-1");
  assert.equal(calls.length, 6);
  assert.deepEqual(calls.map(([name]) => name), ["party", "relationship", "conflict", "document", "evidence", "audit"]);
});

test("matter evidence chain authorizes before transaction", async () => {
  const calls = [];
  const events = [];
  const ops = createPersistentMatterOperations({
    transaction: { run: async () => { events.push("transaction"); return "bad"; } },
    repositories: repos(calls), repositoryFactory: () => repos(calls),
    matterAuthorization: { assert: async (actor, matterId, action) => { events.push([actor.id, matterId, action]); throw new Error("Matter access denied: update"); } }
  });
  await assert.rejects(() => ops.createMatterEvidenceChain({ actor: { id: "actor-2" }, matterId: "matter-1", party: { id: "p", kind: "person", displayName: "P" }, relationship: { id: "r", fromId: "p", toId: "q", type: "other" }, conflict: { id: "c", result: "potential" }, document: { id: "d", type: "order", storageKey: "d" }, evidence: { id: "e", type: "document" }, audit: { id: "a" } }), /Matter access denied: update/);
  assert.deepEqual(events, [["actor-2", "matter-1", "update"]]);
  assert.equal(calls.length, 0);
});

test("matter evidence chain propagates failure for rollback", async () => {
  let rollback = false;
  const calls = [];
  const root = repos(calls);
  const scoped = repos(calls);
  scoped.documents.create = async () => { throw new Error("document failure"); };
  const ops = createPersistentMatterOperations({
    transaction: { run: async (work) => { try { return await work({ id: "tx-1", query() {} }); } catch (error) { rollback = true; throw error; } } },
    repositories: root, repositoryFactory: () => scoped
  });
  await assert.rejects(() => ops.createMatterEvidenceChain({ actor: { id: "actor-1" }, matterId: "matter-1", party: { id: "p", kind: "person", displayName: "P" }, relationship: { id: "r", fromId: "p", toId: "q", type: "other" }, conflict: { id: "c", result: "clear" }, document: { id: "d", type: "order", storageKey: "d" }, evidence: { id: "e", type: "document" }, audit: { id: "a" } }), /document failure/);
  assert.equal(rollback, true);
  assert.deepEqual(calls.map(([name]) => name), ["party", "relationship", "conflict"]);
});
