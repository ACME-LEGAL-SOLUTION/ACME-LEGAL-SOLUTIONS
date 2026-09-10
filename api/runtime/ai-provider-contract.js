"use strict";

const SUPPORTED_PROVIDER_CAPABILITIES = Object.freeze(["chat", "research", "structured_output"]);

function createAIProviderContract(provider) {
  if (!provider || typeof provider.execute !== "function") {
    throw new TypeError("AI provider must expose execute(input)");
  }
  const capabilities = Object.freeze(Array.isArray(provider.capabilities) ? [...provider.capabilities] : []);
  for (const capability of capabilities) {
    if (!SUPPORTED_PROVIDER_CAPABILITIES.includes(capability)) {
      throw new Error(`Unsupported AI provider capability: ${capability}`);
    }
  }
  return Object.freeze({
    id: provider.id || "unidentified",
    capabilities,
    async execute(input) {
      if (!input || typeof input !== "object") throw new TypeError("AI provider input is required");
      const result = await provider.execute(input);
      if (result == null) throw new Error("AI provider returned no result");
      return result;
    }
  });
}

module.exports = { SUPPORTED_PROVIDER_CAPABILITIES, createAIProviderContract };
