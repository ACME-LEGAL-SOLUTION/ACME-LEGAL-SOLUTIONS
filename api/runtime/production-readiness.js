"use strict";

const REQUIRED_ENV = Object.freeze([
  "ACME_ENV",
  "ACME_AUTH_MODULE",
  "ACME_OBJECT_STORAGE_MODULE",
  "ACME_AI_PROVIDER_MODULE",
  "ACME_PAYMENT_PROVIDER_MODULE",
  "ACME_MESSAGING_PROVIDER_MODULE"
]);

function configuredEnvironment(env = process.env) {
  return String(env.ACME_ENV || "development").toLowerCase();
}

function checkProductionConfiguration(env = process.env) {
  const environment = configuredEnvironment(env);
  if (environment !== "production") {
    return Object.freeze({ environment, ready: true, checks: Object.freeze({ production: false }) });
  }
  const missing = REQUIRED_ENV.filter((name) => !String(env[name] || "").trim());
  return Object.freeze({
    environment,
    ready: missing.length === 0,
    checks: Object.freeze({ production: true, requiredAdapters: missing.length === 0 }),
    missing: Object.freeze(missing)
  });
}

function createReadiness({ env = process.env, repositories = null, persistence = null } = {}) {
  return async function readiness() {
    const config = checkProductionConfiguration(env);
    const checks = { ...config.checks };
    if (config.environment === "production") {
      checks.persistence = Boolean(persistence?.driver && repositories);
      if (checks.persistence && typeof persistence.driver.healthCheck === "function") {
        try {
          await persistence.driver.healthCheck();
          checks.persistence = true;
        } catch {
          checks.persistence = false;
        }
      }
    }
    const ready = config.environment !== "production"
      ? true
      : config.ready && checks.persistence;
    return Object.freeze({ status: ready ? "ready" : "not_ready", environment: config.environment, checks: Object.freeze(checks), ...(config.missing?.length ? { missing: config.missing } : {}) });
  };
}

module.exports = { REQUIRED_ENV, checkProductionConfiguration, configuredEnvironment, createReadiness };
