"use strict";

const path = require("node:path");
const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createProductionPersistence } = require("../persistence/production-bootstrap");
const { createMigrationRunner } = require("../persistence/migration-runner");
const manifest = require("../persistence/migration-manifest.json");
const productionClients = require("../persistence/production-clients");

function createApplicationBootstrap({
  env = process.env,
  clock = () => new Date(),
  clientFactories = productionClients,
  sqliteLockFactory = productionClients.createSqliteLock,
  productionPersistenceFactory = createProductionPersistence,
  migrationManifest = manifest,
  rootDir = process.cwd()
} = {}) {
  const production = env.ACME_ENV === "production";

  async function start() {
    if (!production) {
      const repositories = createApplicationRepositories({ clock });
      return Object.freeze({
        environment: env.ACME_ENV || "development",
        application: createApplicationRuntime({ repositories, provider: null, clock }),
        repositories,
        persistence: null,
        async close() {}
      });
    }

    const persistence = productionPersistenceFactory({ env, clientFactories, sqliteLockFactory });
    try {
      const migrationRunner = createMigrationRunner({
        manifest: migrationManifest,
        rootDir,
        storage: persistence.storage,
        dialect: persistence.driver.dialect
      });
      await migrationRunner.migrate();
      const application = createApplicationRuntime({ repositories: persistence.repositories, provider: null, clock });
      return Object.freeze({
        environment: "production",
        application,
        repositories: persistence.repositories,
        persistence,
        migrationRunner,
        async close() { await persistence.driver.close(); }
      });
    } catch (error) {
      await persistence.driver.close().catch(() => {});
      throw error;
    }
  }

  return Object.freeze({ start });
}

module.exports = { createApplicationBootstrap };
