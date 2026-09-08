"use strict";

const { SUPPORTED_PROVIDERS } = require("./driver-contract");
const {
  createPostgresqlAdapter,
  createMysqlAdapter,
  createMariadbAdapter,
  createSqliteAdapter
} = require("./sql-provider-adapters");

const ADAPTER_FACTORIES = Object.freeze({
  postgresql: createPostgresqlAdapter,
  mysql: createMysqlAdapter,
  mariadb: createMariadbAdapter,
  sqlite: createSqliteAdapter
});

function createSqlProviderRegistry({ clients = {}, sqliteLock } = {}) {
  const registered = Object.freeze(
    SUPPORTED_PROVIDERS.filter((provider) => typeof clients[provider] === "function")
  );

  return Object.freeze({
    providers: registered,
    has(provider) { return registered.includes(provider); },
    createAdapter(config) {
      if (!config || config.environment !== "production") {
        throw new Error("SQL provider registry requires production configuration");
      }
      const provider = config.provider;
      if (!registered.includes(provider)) {
        throw new Error(`No SQL client is registered for provider: ${provider}`);
      }
      const client = clients[provider]({ config });
      const factory = ADAPTER_FACTORIES[provider];
      const options = { config, client };
      if (provider === "sqlite") options.sqliteLock = sqliteLock;
      return factory(options);
    }
  });
}

module.exports = { ADAPTER_FACTORIES, createSqlProviderRegistry };
