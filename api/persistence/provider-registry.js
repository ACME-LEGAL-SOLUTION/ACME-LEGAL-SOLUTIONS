"use strict";

const { SUPPORTED_PROVIDERS } = require("./driver-contract");
const { createProductionDriver } = require("./driver-factory");

function createProviderRegistry({ drivers = {} } = {}) {
  const registered = Object.freeze(
    SUPPORTED_PROVIDERS.filter((provider) => typeof drivers[provider] === "function")
  );

  return Object.freeze({
    providers: registered,
    has(provider) {
      return registered.includes(provider);
    },
    createDriver(config) {
      if (!config || !this.has(config.provider)) {
        throw new Error(`No production database driver is registered for provider: ${config && config.provider}`);
      }
      return createProductionDriver({ config, drivers });
    }
  });
}

module.exports = { createProviderRegistry };
