"use strict";

const { createProductionPersistenceConfig } = require("./production-config");
const { createProductionAdapter } = require("./production-adapter");
const { createSqlRepositories } = require("./sql-repository");
const { createSqlProviderAdapter } = require("./sql-provider-adapters");

const ADAPTER_FACTORIES = Object.freeze({
  postgresql: (options) => createSqlProviderAdapter({ ...options, provider: "postgresql" }),
  mysql: (options) => createSqlProviderAdapter({ ...options, provider: "mysql" }),
  mariadb: (options) => createSqlProviderAdapter({ ...options, provider: "mariadb" }),
  sqlite: (options) => createSqlProviderAdapter({ ...options, provider: "sqlite" })
});

function createProductionPersistence({ env = process.env, clientFactories = {}, sqliteLockFactory } = {}) {
  const config = createProductionPersistenceConfig({ env });
  const factory = clientFactories[config.provider];
  if (typeof factory !== "function") throw new Error(`No production SQL client factory is registered for provider: ${config.provider}`);
  const client = factory({ config });
  if (!client || typeof client.connect !== "function" || typeof client.close !== "function" || typeof client.query !== "function") {
    throw new TypeError(`Production SQL client for ${config.provider} is incomplete`);
  }

  let sqliteLock;
  if (config.provider === "sqlite") {
    if (typeof sqliteLockFactory !== "function") throw new Error("SQLite production persistence requires a cross-process lock factory");
    sqliteLock = sqliteLockFactory({ config });
  }

  const sqlAdapter = ADAPTER_FACTORIES[config.provider]({ config, client, sqliteLock });
  const repositories = createSqlRepositories({ query: sqlAdapter.query });
  const storage = createProductionAdapter({ config, repositories, driver: sqlAdapter });
  return Object.freeze({ config, client, driver: sqlAdapter, repositories, storage });
}

module.exports = { ADAPTER_FACTORIES, createProductionPersistence };
