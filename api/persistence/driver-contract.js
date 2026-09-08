"use strict";

const SUPPORTED_PROVIDERS = Object.freeze(["postgresql", "mysql", "mariadb", "sqlite"]);

function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`Production database driver requires ${name}`);
}

function createDriverContract({ provider, connect, close, query, begin, commit, rollback, ensureMigrationLedger, readAppliedMigrations, acquireLock, releaseLock } = {}) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported production database provider: ${provider}`);
  }
  assertFunction(connect, "connect");
  assertFunction(close, "close");
  assertFunction(query, "query");
  assertFunction(begin, "begin");
  assertFunction(commit, "commit");
  assertFunction(rollback, "rollback");
  assertFunction(ensureMigrationLedger, "ensureMigrationLedger");
  assertFunction(readAppliedMigrations, "readAppliedMigrations");
  assertFunction(acquireLock, "acquireLock");
  assertFunction(releaseLock, "releaseLock");

  return Object.freeze({
    provider,
    connect,
    close,
    query,
    begin,
    commit,
    rollback,
    ensureMigrationLedger,
    readAppliedMigrations,
    acquireLock,
    releaseLock
  });
}

module.exports = { SUPPORTED_PROVIDERS, createDriverContract };
