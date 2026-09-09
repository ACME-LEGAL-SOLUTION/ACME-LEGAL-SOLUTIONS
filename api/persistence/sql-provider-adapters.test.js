"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionPersistenceConfig } = require("./production-config");
const {
  createPostgresqlAdapter,
  createMysqlAdapter,
  createMariadbAdapter,
  createSqliteAdapter
} = require("./sql-provider-adapters");

function config(provider) {
  return createProductionPersistenceConfig({
    env: { ACME_ENV: "production", ACME_DB_PROVIDER: provider, ACME_DB_URL: `${provider}://integration.invalid/acme` }
  });
}

function fakeClient({ rows = [{ version: "001", checksum: "abc" }], failCommit = false } = {}) {
  const state = { poolQueries: [], connections: [], closed: false };
  const client = {
    state,
    connect: async () => {
      const connection = {
        queries: [],
        released: false,
        closed: false,
        query: async (sql, params = []) => {
          connection.queries.push({ sql, params });
          if (sql === "COMMIT" && failCommit) throw new Error("commit failed");
          return { rows };
        },
        release: async () => { connection.released = true; },
        close: async () => { connection.closed = true; }
      };
      state.connections.push(connection);
      return connection;
    },
    close: async () => { state.closed = true; },
    query: async (sql, params = []) => {
      state.poolQueries.push({ sql, params });
      return { rows };
    }
  };
  return client;
}

test("PostgreSQL adapter uses native placeholders and a dedicated lock session", async () => {
  const client = fakeClient();
  const adapter = createPostgresqlAdapter({ provider: "postgresql", config: config("postgresql"), client });
  await adapter.acquireLock();
  assert.equal(client.state.connections.length, 1);
  assert.equal(client.state.connections[0].queries[0].sql, "SELECT pg_advisory_lock(hashtextextended($1, 0))");
  assert.deepEqual(client.state.connections[0].queries[0].params, ["acme_migration_lock"]);
  await adapter.releaseLock();
  assert.equal(client.state.connections[0].queries[1].sql, "SELECT pg_advisory_unlock(hashtextextended($1, 0))");
  assert.equal(client.state.connections[0].released, true);
});

test("MySQL and MariaDB adapters use GET_LOCK on a dedicated session", async () => {
  for (const create of [createMysqlAdapter, createMariadbAdapter]) {
    const provider = create === createMysqlAdapter ? "mysql" : "mariadb";
    const client = fakeClient();
    const adapter = create({ config: config(provider), client });
    await adapter.acquireLock();
    assert.equal(client.state.connections[0].queries[0].sql, "SELECT GET_LOCK(?, 30)");
    await adapter.releaseLock();
    assert.equal(client.state.connections[0].queries[1].sql, "SELECT RELEASE_LOCK(?)");
    assert.equal(client.state.connections[0].released, true);
  }
});

test("SQLite adapter requires an explicit cross-process lock implementation", () => {
  assert.throws(
    () => createSqliteAdapter({ config: config("sqlite"), client: fakeClient() }),
    /cross-process migration lock/
  );
});

test("SQLite adapter delegates locking and all adapters expose provider-neutral transactions", async () => {
  const lock = {
    held: false,
    acquire: async () => { lock.held = true; },
    release: async () => { lock.held = false; }
  };
  const client = fakeClient();
  const adapter = createSqliteAdapter({ config: config("sqlite"), client, sqliteLock: lock });
  await adapter.acquireLock();
  assert.equal(lock.held, true);
  await adapter.releaseLock();

  await adapter.ensureMigrationLedger();
  const rows = await adapter.readAppliedMigrations();
  assert.deepEqual(rows, [{ version: "001", checksum: "abc" }]);
  const transactionResult = await adapter.transaction.run(async (tx) => {
    await tx.query("SELECT 1");
    return "ok";
  });
  assert.equal(transactionResult, "ok");
  assert.equal(client.state.connections.length, 2);
  assert.equal(client.state.connections[0].queries[0].sql, "BEGIN");
  assert.equal(client.state.connections[0].queries[1].sql.startsWith("CREATE TABLE IF NOT EXISTS acme_migrations"), true);
  assert.equal(client.state.connections[0].queries.at(-1).sql, "COMMIT");
  assert.equal(client.state.connections[1].queries[0].sql, "BEGIN");
  assert.equal(client.state.connections[1].queries.at(-1).sql, "COMMIT");
});

test("adapter rejects mismatched production configuration", () => {
  assert.throws(
    () => createPostgresqlAdapter({ config: config("mysql"), client: fakeClient() }),
    /matching production configuration/
  );
});

test("adapter releases a transaction connection on rollback", async () => {
  const client = fakeClient();
  const adapter = createPostgresqlAdapter({ config: config("postgresql"), client });
  await assert.rejects(() => adapter.transaction.run(async () => { throw new Error("boom"); }), /boom/);
  const connection = client.state.connections[0];
  assert.equal(connection.queries.at(-1).sql, "ROLLBACK");
  assert.equal(connection.released, true);
});

test("adapter rolls back safely when COMMIT fails and releases only afterward", async () => {
  const client = fakeClient({ failCommit: true });
  const adapter = createPostgresqlAdapter({ config: config("postgresql"), client });
  await assert.rejects(() => adapter.transaction.run(async (tx) => { await tx.query("SELECT 1"); }), /commit failed/);
  const connection = client.state.connections[0];
  assert.deepEqual(connection.queries.map((entry) => entry.sql), ["BEGIN", "SELECT 1", "COMMIT", "ROLLBACK"]);
  assert.equal(connection.released, true);
});

test("adapter can close dedicated connections that expose close instead of release", async () => {
  const client = fakeClient();
  client.connect = async () => {
    const connection = {
      queries: [], closed: false,
      query: async (sql, params = []) => { connection.queries.push({ sql, params }); return { rows: [] }; },
      close: async () => { connection.closed = true; }
    };
    client.state.connections.push(connection);
    return connection;
  };
  const adapter = createPostgresqlAdapter({ config: config("postgresql"), client });
  await adapter.transaction.run(async (tx) => { await tx.query("SELECT 1"); });
  assert.equal(client.state.connections[0].closed, true);
});
