"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProductionMessagingProvider, createMessagingGovernance, retryDelayMs } = require("./production-messaging");

function repos() {
  const rows = new Map();
  return {
    create: async (x) => (rows.set(x.id, { ...x }), rows.get(x.id)),
    getById: async (id) => rows.get(id) || null,
    list: async (f) => [...rows.values()].filter((x) => Object.entries(f).every(([k, v]) => x[k] === v)),
    update: async (id, c) => (rows.set(id, { ...rows.get(id), ...c }), rows.get(id))
  };
}

test("messaging provider fails closed without adapter", () => {
  assert.throws(() => createProductionMessagingProvider({ env: {} }), /not configured/);
});

test("provider sends only approved channel and scoped fields", async () => {
  let seen;
  const p = createProductionMessagingProvider({ env: {}, provider: {
    id: "p", send: async (x) => (seen = x, { id: "pm1" }), verifyWebhook: async () => ({ verified: true })
  }});
  await p.send({ channel: "email", recipientRef: "r", body: "hello", idempotencyKey: "k", metadata: { x: 1 } });
  assert.equal(seen.channel, "email");
  assert.equal(seen.body, "hello");
  assert.equal(seen.recipientRef, "r");
  assert.equal(seen.idempotencyKey, "k");
  await assert.rejects(() => p.send({ channel: "sms", recipientRef: "r", body: "x", idempotencyKey: "k" }), /Unsupported/);
});

test("provider requires webhook signature before verification", async () => {
  let called = false;
  const p = createProductionMessagingProvider({ env: {}, provider: {
    id: "p", send: async () => ({ id: "pm1" }), verifyWebhook: async () => (called = true, { verified: true })
  }});
  await assert.rejects(() => p.verifyWebhook({}), /Webhook signature is required/);
  assert.equal(called, false);
  assert.deepEqual(await p.verifyWebhook({ signature: "sig", rawBody: "{}" }), { verified: true });
  assert.equal(called, true);
});

test("queue is matter-authorized and idempotent", async () => {
  const r = repos();
  const audit = [];
  const g = createMessagingGovernance({
    messageRepository: r,
    matterAuthorization: { assert: async (actor, matterId, action) => {
      assert.equal(actor.id, "u1");
      assert.equal(action, "update");
      if (matterId !== "m1") throw new Error("denied");
    }},
    audit: { append: async (e) => audit.push(e) },
    clock: () => new Date("2026-01-01T00:00:00Z")
  });
  const a = { id: "u1", type: "user" };
  const x = await g.enqueue({ id: "m1-msg", matterId: "m1", channel: "whatsapp", provider: "p", recipientRef: "wa", idempotencyKey: "idem", actor: a, payload: { safe: true } });
  const y = await g.enqueue({ id: "m2-msg", matterId: "m1", channel: "whatsapp", provider: "p", recipientRef: "wa", idempotencyKey: "idem", actor: a });
  assert.equal(x.duplicate, false);
  assert.equal(y.duplicate, true);
  assert.equal(audit[0].eventType, "messaging.queued");
  assert.equal(JSON.stringify(audit).includes("wa"), false);
  assert.equal(JSON.stringify(audit).includes("safe"), false);
});

test("delivery state machine rejects invalid transitions and audits", async () => {
  const r = repos();
  const audit = [];
  const g = createMessagingGovernance({ messageRepository: r, matterAuthorization: { assert: async () => {} }, audit: { append: async (e) => audit.push(e) }, clock: () => new Date("2026-01-01T00:00:00Z") });
  await g.enqueue({ id: "x", matterId: "m", channel: "email", provider: "p", recipientRef: "r", idempotencyKey: "k", actor: { id: "u" } });
  await assert.rejects(() => g.transition({ id: "x", status: "delivered", actor: { id: "u" } }), /Invalid message transition/);
  await g.transition({ id: "x", status: "sending", actor: { id: "u" } });
  await g.transition({ id: "x", status: "sent", providerMessageId: "pm", actor: { id: "u" } });
  const d = await g.transition({ id: "x", status: "delivered", actor: { id: "u" } });
  assert.equal(d.status, "delivered");
  assert.equal(d.providerMessageId, "pm");
  assert.equal(audit.at(-1).eventType, "messaging.delivered");
});

test("delivery provider failure schedules bounded exponential retry without leaking PII to audit", async () => {
  const r = repos();
  const audit = [];
  const g = createMessagingGovernance({ messageRepository: r, matterAuthorization: { assert: async () => {} }, audit: { append: async (e) => audit.push(e) }, clock: () => new Date("2026-01-01T00:00:00Z"), maxAttempts: 3, retryBaseMs: 1000, retryMaxMs: 2500 });
  await g.enqueue({ id: "retry-1", matterId: "m", channel: "email", provider: "p", recipientRef: "PII-EMAIL-REF", idempotencyKey: "retry-key", actor: { id: "u" }, payload: { body: "private body" } });
  const failed = await g.deliver({ id: "retry-1", actor: { id: "u" }, deliveryProvider: { send: async () => { throw new Error("provider unavailable"); } } });
  assert.equal(failed.status, "failed");
  assert.equal(failed.attemptCount, 1);
  assert.equal(failed.nextRetryAt, "2026-01-01T00:00:01.000Z");
  assert.equal(JSON.stringify(audit).includes("PII-EMAIL-REF"), false);
  assert.equal(JSON.stringify(audit).includes("private body"), false);
  assert.deepEqual([retryDelayMs(1, 1000, 2500), retryDelayMs(2, 1000, 2500), retryDelayMs(3, 1000, 2500)], [1000, 2000, 2500]);
});

test("retry is due-gated and resets failure metadata", async () => {
  const r = repos();
  let now = new Date("2026-01-01T00:00:00Z");
  const g = createMessagingGovernance({ messageRepository: r, matterAuthorization: { assert: async () => {} }, clock: () => now, retryBaseMs: 1000, retryMaxMs: 5000 });
  await g.enqueue({ id: "retry-2", matterId: "m", channel: "whatsapp", provider: "p", recipientRef: "r", idempotencyKey: "k2", actor: { id: "u" } });
  await g.transition({ id: "retry-2", status: "sending", actor: { id: "u" } });
  const failed = await g.transition({ id: "retry-2", status: "failed", actor: { id: "u" }, failureReason: "temporary" });
  assert.equal(failed.nextRetryAt, "2026-01-01T00:00:01.000Z");
  await assert.rejects(() => g.retry({ id: "retry-2", actor: { id: "u" } }), /not due/);
  now = new Date("2026-01-01T00:00:01Z");
  const queued = await g.retry({ id: "retry-2", actor: { id: "u" } });
  assert.equal(queued.status, "queued");
  assert.equal(queued.nextRetryAt, null);
  assert.equal(queued.failureReason, null);
});

test("verified webhook updates only the message bound to the verified provider id", async () => {
  const r = repos();
  const audit = [];
  let webhookPhase = false;
  const g = createMessagingGovernance({
    messageRepository: r,
    matterAuthorization: { assert: async () => { if (webhookPhase) throw new Error("must not be called for verified provider callback"); } },
    audit: { append: async (e) => audit.push(e) },
    provider: { verifyWebhook: async (input) => input.signature === "good" ? { verified: true, providerMessageId: "pm-7", status: "delivered" } : { verified: false } }
  });
  await g.enqueue({ id: "webhook-1", matterId: "m", channel: "email", provider: "p", recipientRef: "r", idempotencyKey: "wk", actor: { id: "u" } });
  await g.transition({ id: "webhook-1", status: "sending", actor: { id: "u" } });
  await g.transition({ id: "webhook-1", status: "sent", actor: { id: "u" }, providerMessageId: "pm-7" });
  await assert.rejects(() => g.handleWebhook({ input: { signature: "bad" } }), /verification failed/);
  webhookPhase = true;
  const delivered = await g.handleWebhook({ input: { signature: "good" } });
  assert.equal(delivered.status, "delivered");
  assert.equal(delivered.providerMessageId, "pm-7");
  assert.equal(audit.at(-1).eventType, "messaging.delivered");
});

test("webhook cannot fabricate a non-delivery state", async () => {
  const g = createMessagingGovernance({ messageRepository: repos(), provider: { verifyWebhook: async () => ({ verified: true, providerMessageId: "pm", status: "queued" }) } });
  await assert.rejects(() => g.handleWebhook({ input: { signature: "good" } }), /Unsupported verified webhook status/);
});
