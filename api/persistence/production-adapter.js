"use strict";

const { createSqlDialect } = require("./sql-dialect");
const { createTransactionalStorage } = require("./transactional-storage");

const PLACEHOLDER_FACTORIES = Object.freeze({
  postgresql: (index) => `$${index}`,
  mysql: () => "?",
  mariadb: () => "?",
  sqlite: () => "?"
});

function createProductionAdapter({ config, repositories, transaction, readAppliedMigrations, acquireLock, releaseLock } = {}) {
  if (!config || config.environment !== "production") {
    throw new Error("Production adapter requires production persistence configuration");
  }
  const placeholder = PLACEHOLDER_FACTORIES[config.provider];
  if (!placeholder) throw new Error(`Unsupported production database provider: ${config.provider}`);
  if (typeof readAppliedMigrations !== "function") throw new TypeError("Production adapter requires readAppliedMigrations");
  if (typeof acquireLock !== "function" || typeof releaseLock !== "function") {
    throw new TypeError("Production adapter requires acquireLock and releaseLock");
  }

  const storage = createTransactionalStorage({ repositories, transaction });
  storage.assertProductionReady();

  return Object.freeze({
    ...storage,
    readAppliedMigrations,
    acquireLock,
    releaseLock,
    dialect: createSqlDialect({ provider: config.provider, placeholder })
  });
}

module.exports = { PLACEHOLDER_FACTORIES, createProductionAdapter };
