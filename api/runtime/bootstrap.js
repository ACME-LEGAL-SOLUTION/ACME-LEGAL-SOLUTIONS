"use strict";

const { createApplicationRepositories } = require("./repository-factory");
const { createApplicationRuntime } = require("./application-runtime");
const { createProductionPersistence } = require("../persistence/production-bootstrap");
const { createMigrationRunner } = require("../persistence/migration-runner");
const { createProductionAuthenticator } = require("../security/production-authentication");
const { createProductionMatterAuthorization } = require("../security/production-matter-authorization");
const { createProductionAIProvider } = require("../security/production-ai-security");
const manifest = require("../persistence/migration-manifest.json");
const productionClients = require("../persistence/production-clients");

const DEVELOPMENT_AI_PROVIDER = Object.freeze({ execute: async () => ({ answer: "draft" }) });

function createApplicationBootstrap({ env = process.env, clock = () => new Date(), provider = null, authenticate = null, matterAuthorization = null, clientFactories = productionClients, sqliteLockFactory = productionClients.createSqliteLock, productionPersistenceFactory = createProductionPersistence, applicationRuntimeFactory = createApplicationRuntime, migrationManifest = manifest, rootDir = process.cwd(), aiProviderFactory = createProductionAIProvider } = {}) {
  const production = env.ACME_ENV === "production";
  async function start() {
    if (!production) {
      const repositories = createApplicationRepositories({ clock });
      return Object.freeze({ environment: env.ACME_ENV || "development", application: applicationRuntimeFactory({ repositories, provider: provider || DEVELOPMENT_AI_PROVIDER, clock, matterAuthorization }), repositories, persistence: null, authenticate, matterAuthorization, async close() {} });
    }
    const productionProvider = provider || aiProviderFactory({ env });
    if (!productionProvider?.execute) throw new Error("Production application requires an AI provider adapter");
    const productionAuthenticator = authenticate || createProductionAuthenticator({ env });
    const persistence = productionPersistenceFactory({ env, clientFactories, sqliteLockFactory });
    try {
      const migrationRunner = createMigrationRunner({ manifest: migrationManifest, rootDir, storage: persistence.storage, dialect: persistence.driver.dialect });
      await migrationRunner.migrate();
      const productionMatterAuthorization = matterAuthorization || createProductionMatterAuthorization({ matters: persistence.repositories.matters });
      const application = applicationRuntimeFactory({ repositories: persistence.repositories, provider: productionProvider, clock, matterAuthorization: productionMatterAuthorization });
      return Object.freeze({ environment: "production", application, repositories: persistence.repositories, persistence, migrationRunner, authenticate: productionAuthenticator, matterAuthorization: productionMatterAuthorization, provider: productionProvider, async close() { await persistence.driver.close(); } });
    } catch (error) {
      await persistence.driver.close().catch(() => {});
      throw error;
    }
  }
  return Object.freeze({ start });
}
module.exports = { DEVELOPMENT_AI_PROVIDER, createApplicationBootstrap };
