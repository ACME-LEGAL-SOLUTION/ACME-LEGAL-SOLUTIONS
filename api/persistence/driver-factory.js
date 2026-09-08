"use strict";

const { SUPPORTED_PROVIDERS, createDriverContract } = require("./driver-contract");

function createProductionDriver({ config, drivers = {} } = {}) {
  if (!config || config.environment !== "production") throw new Error("Production driver requires production persistence configuration");
  if (!SUPPORTED_PROVIDERS.includes(config.provider)) throw new Error(`Unsupported production database provider: ${config.provider}`);
  const factory = drivers[config.provider];
  if (typeof factory !== "function") {
    throw new Error(`No production database driver is registered for provider: ${config.provider}`);
  }
  const driver = factory({ config });
  return createDriverContract({ provider: config.provider, ...driver });
}

module.exports = { createProductionDriver };
