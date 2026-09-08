"use strict";

const { createSqlDialect } = require("./sql-dialect");
const { createTransactionalStorage } = require("./transactional-storage");
const { createDriverContract } = require("./driver-contract");

const PLACEHOLDER_FACTORIES = Object.freeze({
  postgresql: (index) => `$${index}`,
  mysql: () => "?",
  mariadb: () => "?",
  sqlite: () => "?"
});

function createProductionAdapter({ config, repositories, transaction, driver } = {}) {
  if (!config || config.environment !== "production") {
    throw new Error("Production adapter requires production persistence configuration");
  }
  const placeholder = PLACEHOLDER_FACTORIES[config.provider];
  if (!placeholder) throw new Error(`Unsupported production database provider: ${config.provider}`);
  const resolvedDriver = driver || {};
  const contract = createDriverContract({ ...resolvedDriver, provider: config.provider });
  const resolvedTransaction = transaction || {
    run: async (work) => {
      const connection = await contract.begin();
      try {
        const result = await work(connection);
        await contract.commit(connection);
        return result;
      } catch (error) {
        await contract.rollback(connection);
        throw error;
      }
    }
  };

  const storage = createTransactionalStorage({ repositories, transaction: resolvedTransaction });
  storage.assertProductionReady();

  return Object.freeze({
    ...storage,
    config,
    provider: config.provider,
    driver: contract,
    connect: contract.connect,
    close: contract.close,
    query: contract.query,
    readAppliedMigrations: contract.readAppliedMigrations,
    ensureMigrationLedger: contract.ensureMigrationLedger,
    acquireLock: contract.acquireLock,
    releaseLock: contract.releaseLock,
    dialect: createSqlDialect({ provider: config.provider, placeholder })
  });
}

module.exports = { PLACEHOLDER_FACTORIES, createProductionAdapter };
