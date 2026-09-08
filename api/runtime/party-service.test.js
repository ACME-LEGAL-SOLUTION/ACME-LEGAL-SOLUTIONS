"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createRepositories } = require("./in-memory-repository");
const { createPartyService } = require("./party-service");

test("party service creates normalized person and organization parties", async () => {
  const repositories = createRepositories({ clock: () => new Date("2026-01-04T00:00:00.000Z") });
  repositories.parties = {
    records: new Map(),
    async create(input) { this.records.set(input.id || "party-1", input); return { ...input, id: input.id || "party-1" }; },
    async getById(id) { return this.records.get(id) || null; }
  };
  const service = createPartyService({ repositories, clock: () => new Date("2026-01-04T00:00:00.000Z") });

  const party = await service.createParty({ kind: "person", displayName: "  Test Person  " }, { id: "human-party-1" });
  assert.equal(party.displayName, "Test Person");
  assert.equal(party.createdBy, "human-party-1");
  assert.equal(party.createdAt, "2026-01-04T00:00:00.000Z");
});

test("party service rejects invalid identity input", async () => {
  const repositories = createRepositories();
  repositories.parties = { create: async (input) => input, getById: async () => null };
  const service = createPartyService({ repositories });

  await assert.rejects(
    () => service.createParty({ kind: "unknown", displayName: "Party" }, { id: "human-party-2" }),
    /Invalid party kind/
  );

  await assert.rejects(
    () => service.createParty({ kind: "person", displayName: "   " }, { id: "human-party-2" }),
    /Party displayName is required/
  );
});
