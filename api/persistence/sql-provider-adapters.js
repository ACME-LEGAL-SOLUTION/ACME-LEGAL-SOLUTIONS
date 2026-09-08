"use strict";

const { SUPPORTED_PROVIDERS } = require("./driver-contract");
const { createProviderDriver } = require("./provider-driver");
const { createSqlDialect } = require("./sql-dialect");
const { createTransactionBoundary } = require("./transaction-contract");

const DIALECTS = Object.freeze({
  postgresql: Object.freeze({ placeholder: (i) => `$${i}`, lock: "SELECT pg_advisory_lock(?)", unlock: "SELECT pg_advisory_unlock(?)" }),
  mysql: Object.freeze({ placeholder: () => "?", lock: "SELECT GET_LOCK(?, 30)", unlock: "SELECT RELEASE_LOCK(?)" }),
  mariadb: Object.freeze({ placeholder: () => "?", lock: "SELECT GET_LOCK(?, 30)", unlock: "SELECT RELEASE_LOCK(?)" }),
  sqlite: Object.freeze({ placeholder: () => "?", lock: null, unlock: null })
});

function assertClient(client) {
  if (!client || typeof client.connect !== "function" || typeof client.close !== "function" || typeof client.query !== "function") {
    throw new TypeError("SQL provider adapter requires connect, close and query client operations");
  }
}

function safeIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error("Unsafe SQL identifier");
  return value;
}

function createSqlProviderAdapter({ provider, config, client, migrationLockKey = "acme_migration_lock", sqliteLock } = {}) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) throw new Error(`Unsupported production database provider: ${provider}`);
  if (!config || config.environment !== "production" || config.provider !== provider) throw new Error("Provider adapter requires matching production configuration");
  assertClient(client);
  if (provider === "sqlite" && (!sqliteLock || typeof sqliteLock.acquire !== "function" || typeof sqliteLock.release !== "function")) {
    throw new Error("SQLite production adapter requires an explicit cross-process migration lock implementation");
  }

  const dialect = DIALECTS[provider];
  const sqlDialect = createSqlDialect({ provider, placeholder: dialect.placeholder });
  let lockConnection = null;

  const query = (sql, params = []) => {
    const bound = sqlDialect.bind(sql, params);
    return client.query(bound.sql, bound.params);
  };

  const begin = async () => {
    const connection = await client.connect();
    if (!connection || typeof connection.query !== "function") throw new TypeError("SQL connection must expose query");
    try {
      await connection.query("BEGIN");
      return connection;
    } catch (error) {
      await releaseConnection(connection);
      throw error;
    }
  };

  const releaseConnection = async (connection) => {
    if (!connection) return;
    if (typeof connection.release === "function") {
      await connection.release();
      return;
    }
    if (typeof connection.close === "function") {
      await connection.close();
    }
  };

  const commit = async (connection) => {
    if (!connection || typeof connection.query !== "function") throw new TypeError("Transaction connection is required");
    await connection.query("COMMIT");
    await releaseConnection(connection);
  };

  const rollback = async (connection) => {
    if (!connection || typeof connection.query !== "function") throw new TypeError("Transaction connection is required");
    try {
      await connection.query("ROLLBACK");
    } finally {
      await releaseConnection(connection);
    }
  };

  const ensureMigrationLedger = async ({ migrationTable = "acme_migrations" } = {}) => {
    const table = safeIdentifier(migrationTable);
    const transaction = await begin();
    try {
      await transaction.query(`CREATE TABLE IF NOT EXISTS ${table} (version VARCHAR(32) PRIMARY KEY, applied_at TIMESTAMP NOT NULL, checksum VARCHAR(128) NOT NULL)`);
      await commit(transaction);
    } catch (error) {
      try {
        await rollback(transaction);
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    }
  };

  const readAppliedMigrations = async ({ migrationTable = "acme_migrations" } = {}) => {
    const table = safeIdentifier(migrationTable);
    const result = await query(`SELECT version, checksum FROM ${table}`);
    return Array.isArray(result && result.rows) ? result.rows : (Array.isArray(result) ? result : []);
  };

  const acquireLock = async () => {
    if (lockConnection || (provider === "sqlite" && sqliteLock.held)) throw new Error("Migration lock already held");
    if (provider === "sqlite") {
      await sqliteLock.acquire(migrationLockKey);
    } else {
      lockConnection = await client.connect();
      if (!lockConnection || typeof lockConnection.query !== "function") {
        lockConnection = null;
        throw new TypeError("SQL lock connection must expose query");
      }
      try {
        const bound = sqlDialect.bind(dialect.lock, [migrationLockKey]);
        const result = await lockConnection.query(bound.sql, bound.params);
        const value = result && result.rows && result.rows[0] && Object.values(result.rows[0])[0];
        if (value === false || value === 0 || value === null) throw new Error(`Unable to acquire ${provider} migration lock`);
      } catch (error) {
        const connection = lockConnection;
        lockConnection = null;
        await releaseConnection(connection);
        throw error;
      }
    }
  };

  const releaseLock = async () => {
    if (provider === "sqlite") {
      if (sqliteLock.held) await sqliteLock.release(migrationLockKey);
      return;
    }
    if (!lockConnection) return;
    const connection = lockConnection;
    try {
      const bound = sqlDialect.bind(dialect.unlock, [migrationLockKey]);
      await connection.query(bound.sql, bound.params);
    } finally {
      lockConnection = null;
      await releaseConnection(connection);
    }
  };

  const transaction = createTransactionBoundary({ begin, commit, rollback });
  const driver = createProviderDriver({ provider, connect: client.connect, close: client.close, query, begin, commit, rollback, ensureMigrationLedger, readAppliedMigrations, acquireLock, releaseLock });

  return Object.freeze({
    ...driver,
    dialect: sqlDialect,
    transaction,
    migrationLockKey
  });
}

function createPostgresqlAdapter(options = {}) { return createSqlProviderAdapter({ ...options, provider: "postgresql" }); }
function createMysqlAdapter(options = {}) { return createSqlProviderAdapter({ ...options, provider: "mysql" }); }
function createMariadbAdapter(options = {}) { return createSqlProviderAdapter({ ...options, provider: "mariadb" }); }
function createSqliteAdapter(options = {}) { return createSqlProviderAdapter({ ...options, provider: "sqlite" }); }

module.exports = {
  DIALECTS,
  createSqlProviderAdapter,
  createPostgresqlAdapter,
  createMysqlAdapter,
  createMariadbAdapter,
  createSqliteAdapter
};
