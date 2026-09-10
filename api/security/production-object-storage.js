"use strict";

const crypto = require("node:crypto");

const PROVIDER_MODULE_ENV = "ACME_OBJECT_STORAGE_MODULE";
const METHODS = Object.freeze(["put", "get", "delete"]);

function createProductionObjectStorage({ env = process.env, moduleLoader = require } = {}) {
  const modulePath = env[PROVIDER_MODULE_ENV];
  if (!modulePath) throw new Error(`Production object storage adapter is not configured (${PROVIDER_MODULE_ENV})`);
  const adapter = moduleLoader(modulePath);
  const provider = adapter?.default || adapter;
  for (const method of METHODS) {
    if (typeof provider?.[method] !== "function") throw new TypeError(`Object storage adapter must implement ${method}`);
  }
  return Object.freeze({
    async put({ matterId, objectId, body, contentType, checksum } = {}) {
      validateScope(matterId, objectId);
      if (body === undefined || body === null) throw new TypeError("Object body is required");
      const key = buildKey(matterId, objectId);
      return provider.put({ key, body, contentType: contentType || "application/octet-stream", checksum: checksum || digest(body) });
    },
    async get({ matterId, objectId } = {}) {
      validateScope(matterId, objectId);
      return provider.get({ key: buildKey(matterId, objectId) });
    },
    async delete({ matterId, objectId } = {}) {
      validateScope(matterId, objectId);
      return provider.delete({ key: buildKey(matterId, objectId) });
    }
  });
}

function buildKey(matterId, objectId) {
  return `matters/${encodeURIComponent(matterId)}/objects/${encodeURIComponent(objectId)}`;
}
function validateScope(matterId, objectId) {
  if (!matterId) throw new TypeError("Matter id is required");
  if (!objectId) throw new TypeError("Object id is required");
}
function digest(body) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

module.exports = { PROVIDER_MODULE_ENV, buildKey, createProductionObjectStorage, digest };
