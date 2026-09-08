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
  let lockHeld = false;

  const query = (sql, params = []) => {
    const bound = sqlDialect.bind(sql, params);
    return client.query(bound.sql, bound.params);
  };

  const begin = async () => {
    const connection = await client.connect();
    if (!connection || typeof connection.query !== "function") throw new TypeError("SQL connection must expose query");
    await connection.query("BEGIN");
    return connection;
  };
  const commit = async (connection) => { await connection.query("COMMIT"); };
  const rollback = async (connection) => { await connection.query("ROLLBACK"); };

  const ensureMigrationLedger = async ({ migrationTable = "acme_migrations" } = {}) => {
    const table = safeIdentifier(migrationTable);
    const transaction = await begin();
    try {
      await transaction.query(`CREATE TABLE IF NOT EXISTS ${table} (version VARCHAR(32) PRIMARY KEY, applied_at TIMESTAMP NOT NULL, checksum VARCHAR(128) NOT NULL)`);
      await commit(transaction);
    } catch (error) {
      await rollback(transaction);
      throw error;
    }
  };

  const readAppliedMigrations = async ({ migrationTable = "acme_migrations" } = {}) => {
    const table = safeIdentifier(migrationTable);
    const result = await query(`SELECT version, checksum FROM ${table}`);
    return Array.isArray(result && result.rows) ? result.rows : (Array.isArray(result) ? result : []);
  };

  const acquireLock = async () => {
    if (lockHeld) throw new Error("Migration lock already held");
    if (provider === "sqlite") {
      await sqliteLock.acquire(migrationLockKey);
    } else {
      const result = await query(dialect.lock, [migrationLockKey]);
      const value = result && result.rows && result.rows[0] && Object.values(result.rows[0])[0];
      if (value === false || value === 0 || value === null) throw new Error(`Unable to acquire ${provider} migration lock`);
    }
    lockHeld = true;
  };

  const releaseLock = async () => {
    if (!lockHeld) return;
    try {
      if (provider === "sqlite") await sqliteLock.release(migrationLockKey);
      else await query(dialect.unlock, [migrationLockKey]);
    } finally {
      lockHeld = false;
    }
  };

  const transaction = createTransactionBoundary({ begin, commit, rollback });
  return Object.freeze({
    provider,
    dialect: sqlDialect,
    connect: client.connect,
    close: client.close,
    query,
    begin,
    commit,
    rollback,
    transaction,
    ensureMigrationLedger,
    readAppliedMigrations,
    acquireLock,
    releaseLock,
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
