"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistence } = require("./production-bootstrap");

function completeDriverClient() {
  return {
    connect: async () => ({ query: async () => ({ rows: [] }), release: async () => {} }),
    close: async () => {},
    query: async () => ({ rows: [] })
  };
}

test("production bootstrap composes configured SQL client, repositories and storage", () => {
  const client = completeDriverClient();
  const result = createProductionPersistence({
    env: { ACME_ENV: "production", ACME_DB_PROVIDER: "postgresql", ACME_DB_URL: "postgresql://db/acme", ACME_DB_SSL: "false" },
    clientFactories: { postgresql: () => client }
  });
  assert.equal(result.config.provider, "postgresql");
  assert.equal(result.driver.provider, "postgresql");
  assert.equal(typeof result.repositories.clients.create, "function");
  assert.equal(result.storage.provider, "postgresql");
  assert.equal(result.storage.assertProductionReady(), true);
});

test("production bootstrap fails closed without a configured provider client", () => {
  assert.throws(
    () => createProductionPersistence({
      env: { ACME_ENV: "production", ACME_DB_PROVIDER: "mysql", ACME_DB_URL: "mysql://db/acme" },
      clientFactories: {}
    }),
    /No production SQL client factory is registered/
  );
});

test("SQLite production bootstrap requires an explicit cross-process lock factory", () => {
  assert.throws(
    () => createProductionPersistence({
      env: { ACME_ENV: "production", ACME_DB_PROVIDER: "sqlite", ACME_DB_URL: "file:///tmp/acme.db" },
      clientFactories: { sqlite: () => completeDriverClient() }
    }),
    /cross-process lock factory/
  );
});
