"use strict";

const { SUPPORTED_PROVIDERS, createDriverContract } = require("./driver-contract");

function createProviderDriver({ provider, connect, close, query, begin, commit, rollback, ensureMigrationLedger, readAppliedMigrations, acquireLock, releaseLock } = {}) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported production database provider: ${provider}`);
  }
  return createDriverContract({
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

module.exports = { createProviderDriver };
