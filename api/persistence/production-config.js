"use strict";

/**
 * Resolve production persistence configuration without selecting a database
 * vendor. Provider-specific adapters consume this contract at the boundary.
 */
const ALLOWED_PROVIDERS = Object.freeze(["postgresql", "mysql", "mariadb", "sqlite"]);

function requiredEnv(env, name) {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Production persistence setting is required: ${name}`);
  }
  return value.trim();
}

function createProductionPersistenceConfig({ env = process.env } = {}) {
  if (env.ACME_ENV !== "production") {
    throw new Error("Production persistence configuration requires ACME_ENV=production");
  }

  const provider = requiredEnv(env, "ACME_DB_PROVIDER").toLowerCase();
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported production database provider: ${provider}`);
  }

  const connectionUrl = requiredEnv(env, "ACME_DB_URL");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(connectionUrl)) {
    throw new Error("ACME_DB_URL must be a valid provider connection URL");
  }

  return Object.freeze({
    environment: "production",
    provider,
    connectionUrl,
    sslRequired: env.ACME_DB_SSL !== "false",
    migrationLockRequired: env.ACME_DB_MIGRATION_LOCK !== "false"
  });
}

module.exports = { ALLOWED_PROVIDERS, createProductionPersistenceConfig };
