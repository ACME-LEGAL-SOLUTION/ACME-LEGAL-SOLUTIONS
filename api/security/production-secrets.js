"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const MODULE_ENV = "ACME_SECRET_PROVIDER_MODULE";
const REQUIRED_METHODS = Object.freeze(["get", "metadata"]);
const MAX_SECRET_NAME = 256;

function loadProvider({ env = process.env, moduleLoader = require } = {}) {
  const modulePath = String(env[MODULE_ENV] || "").trim();
  if (!modulePath) throw new Error(`Production secret provider is not configured (${MODULE_ENV})`);
  const resolved = path.isAbsolute(modulePath) ? modulePath : path.resolve(process.cwd(), modulePath);
  const loaded = moduleLoader(resolved);
  const provider = loaded?.default || loaded;
  for (const method of REQUIRED_METHODS) {
    if (typeof provider?.[method] !== "function") throw new TypeError(`Secret provider must implement ${method}`);
  }
  return provider;
}

function requireName(name) {
  if (typeof name !== "string" || !name.trim() || name.length > MAX_SECRET_NAME) {
    throw new TypeError("Secret name is invalid");
  }
  return name.trim();
}

function createProductionSecretProvider({ env = process.env, provider = null, moduleLoader = require, clock = () => new Date() } = {}) {
  const configured = provider || loadProvider({ env, moduleLoader });
  for (const method of REQUIRED_METHODS) {
    if (typeof configured?.[method] !== "function") throw new TypeError(`Secret provider must implement ${method}`);
  }
  return Object.freeze({
    async get(name, options = {}) {
      const secretName = requireName(name);
      const result = await configured.get(secretName, { version: options.version || null });
      if (!result || typeof result.value !== "string" || !result.value) throw new Error(`Secret provider returned no value for ${secretName}`);
      if (result.version !== undefined && (typeof result.version !== "string" || !result.version)) throw new Error("Secret version is invalid");
      return Object.freeze({ name: secretName, value: result.value, version: result.version || "unversioned", fetchedAt: clock().toISOString() });
    },
    async metadata(name) {
      const secretName = requireName(name);
      const result = await configured.metadata(secretName);
      if (!result || typeof result !== "object") throw new Error("Secret metadata is invalid");
      return sanitizeMetadata(secretName, result);
    },
    async rotate(name, options = {}) {
      const secretName = requireName(name);
      if (typeof configured.rotate !== "function") throw new Error("Configured secret provider does not support rotation");
      const result = await configured.rotate(secretName, { reason: options.reason || "scheduled_rotation", requestedBy: options.requestedBy || "system" });
      if (!result || typeof result.version !== "string" || !result.version) throw new Error("Secret rotation did not return a version");
      return Object.freeze({ name: secretName, version: result.version, rotatedAt: result.rotatedAt || clock().toISOString() });
    },
    async revoke(name, version) {
      const secretName = requireName(name);
      if (!version || typeof version !== "string") throw new TypeError("Secret version is required");
      if (typeof configured.revoke !== "function") throw new Error("Configured secret provider does not support revocation");
      return configured.revoke(secretName, version);
    }
  });
}

function sanitizeMetadata(name, metadata) {
  const result = {
    name,
    version: typeof metadata.version === "string" ? metadata.version : "unversioned",
    createdAt: metadata.createdAt || null,
    expiresAt: metadata.expiresAt || null,
    rotatedAt: metadata.rotatedAt || null,
    active: metadata.active !== false
  };
  if (result.expiresAt) {
    const timestamp = Date.parse(result.expiresAt);
    if (!Number.isFinite(timestamp)) throw new Error("Secret expiry metadata is invalid");
  }
  return Object.freeze(result);
}

function fingerprint(value) {
  if (typeof value !== "string" || !value) throw new TypeError("Secret value is required");
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function assertSecretNotPresent(text, secret) {
  if (typeof text !== "string" || typeof secret !== "string" || !secret) return true;
  if (text.includes(secret)) throw new Error("Secret value must not be written to logs or audit payloads");
  return true;
}

module.exports = { MODULE_ENV, createProductionSecretProvider, fingerprint, assertSecretNotPresent, sanitizeMetadata };
