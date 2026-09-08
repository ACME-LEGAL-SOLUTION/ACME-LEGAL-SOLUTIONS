"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDriverContract } = require("./driver-contract");

const fn = async () => undefined;

function valid(provider = "postgresql") {
  return createDriverContract({ provider, connect: fn, close: fn, query: fn, begin: fn, commit: fn, rollback: fn, ensureMigrationLedger: fn, readAppliedMigrations: fn, acquireLock: fn, releaseLock: fn });
}

test("driver contract accepts the complete provider-neutral production surface", () => {
  const driver = valid();
  assert.equal(driver.provider, "postgresql");
  for (const name of ["connect", "close", "query", "begin", "commit", "rollback", "ensureMigrationLedger", "readAppliedMigrations", "acquireLock", "releaseLock"]) assert.equal(typeof driver[name], "function");
});

test("driver contract rejects an unsupported provider", () => {
  assert.throws(() => valid("oracle"), /Unsupported production database provider/);
});

test("driver contract fails closed when a required capability is missing", () => {
  assert.throws(() => createDriverContract({ provider: "sqlite", connect: fn }), /requires close/);
});

test("driver contract preserves provider identity across supported engines", () => {
  for (const provider of ["postgresql", "mysql", "mariadb", "sqlite"]) assert.equal(valid(provider).provider, provider);
});
