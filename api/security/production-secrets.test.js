"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionSecretProvider, fingerprint, assertSecretNotPresent } = require("./production-secrets");

test("secret provider fails closed when not configured", () => {
  assert.throws(() => createProductionSecretProvider({ env: {} }), /not configured/);
});

test("secret provider returns versioned values and sanitized metadata", async () => {
  const provider = createProductionSecretProvider({
    env: {},
    provider: {
      async get(name) { return { value: `value-for-${name}`, version: "v2" }; },
      async metadata() { return { version: "v2", expiresAt: "2030-01-01T00:00:00Z", active: true, value: "must-not-leak" }; },
      async rotate() { return { version: "v3", rotatedAt: "2026-09-10T00:00:00Z" }; },
      async revoke(name, version) { return { name, version, revoked: true }; }
    }
  });
  const secret = await provider.get("PAYMENT_KEY");
  assert.equal(secret.version, "v2");
  assert.equal(secret.value, "value-for-PAYMENT_KEY");
  const metadata = await provider.metadata("PAYMENT_KEY");
  assert.equal(metadata.version, "v2");
  assert.equal(Object.hasOwn(metadata, "value"), false);
  const rotated = await provider.rotate("PAYMENT_KEY", { reason: "expiry" });
  assert.equal(rotated.version, "v3");
  assert.deepEqual(await provider.revoke("PAYMENT_KEY", "v2"), { name: "PAYMENT_KEY", version: "v2", revoked: true });
});

test("secret fingerprint is deterministic without exposing the secret", () => {
  const value = "sensitive-value";
  assert.equal(fingerprint(value), fingerprint(value));
  assert.equal(fingerprint(value).length, 64);
  assert.doesNotMatch(fingerprint(value), /sensitive-value/);
});

test("secret logging guard rejects plaintext secret leakage", () => {
  assert.throws(() => assertSecretNotPresent("failed with sensitive-value", "sensitive-value"), /must not be written/);
  assert.equal(assertSecretNotPresent("failed with fingerprint abc", "sensitive-value"), true);
});
