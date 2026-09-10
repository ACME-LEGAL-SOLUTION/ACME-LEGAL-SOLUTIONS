"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProductionAuthenticator } = require("./production-authentication");

function adapter(actor) { return { authenticate: async () => actor }; }

test("production authentication fails closed when no identity adapter is configured", () => {
  assert.throws(() => createProductionAuthenticator({ env: {} }), /ACME_AUTH_MODULE/);
});

test("production authentication loads only the configured adapter and normalizes identity", async () => {
  const authenticate = createProductionAuthenticator({
    env: { ACME_AUTH_MODULE: "./trusted-idp.js" },
    requireFn: () => adapter({ id: "u-1", role: "professional", human: true, type: "oidc", subject: "sub-1", scopes: ["matter:read"] })
  });
  const actor = await authenticate({ headers: {} });
  assert.deepEqual(actor, {
    id: "u-1", role: "professional", human: true, type: "oidc", subject: "sub-1",
    scopes: ["matter:read"], clientId: undefined
  });
  assert.equal(Object.isFrozen(actor), true);
});

test("production authentication rejects malformed or unsupported identities", async () => {
  for (const actor of [null, {}, { id: "u", role: "professional" }, { id: "u", role: "unknown", human: true }, { id: "u", role: "professional", human: false }]) {
    const authenticate = createProductionAuthenticator({ env: { ACME_AUTH_MODULE: "idp" }, requireFn: () => adapter(actor) });
    await assert.rejects(() => authenticate({}), /Authenticated identity|Unsupported authenticated role|Professional identities must be human/);
  }
});

test("client identities may be non-human while retaining their client scope", async () => {
  const authenticate = createProductionAuthenticator({
    env: { ACME_AUTH_MODULE: "idp" },
    requireFn: () => adapter({ id: "c-1", role: "client", human: false, clientId: "client-1" })
  });
  const actor = await authenticate({});
  assert.equal(actor.clientId, "client-1");
  assert.equal(actor.role, "client");
  assert.equal(actor.human, false);
});
