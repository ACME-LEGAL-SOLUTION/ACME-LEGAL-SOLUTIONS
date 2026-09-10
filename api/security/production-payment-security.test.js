"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createProductionPaymentProvider, createPaymentGovernance } = require("./production-payment-security");

test("production payment provider fails closed without configured adapter", () => {
  assert.throws(() => createProductionPaymentProvider({ env: {} }), /ACME_PAYMENT_PROVIDER_MODULE/);
});

test("payment provider validates amount and idempotency before provider execution", async () => {
  let calls = 0;
  const provider = createProductionPaymentProvider({ provider: { id: "test", createPayment: async (input) => { calls++; return input; }, verifyWebhook: async () => true } });
  await assert.rejects(() => provider.createPayment({ invoiceId: "i-1", currency: "INR", amount: 0, idempotencyKey: "k" }), /amount/);
  await assert.rejects(() => provider.createPayment({ invoiceId: "i-1", currency: "INR", amount: 10 }), /idempotencyKey/);
  assert.equal(calls, 0);
});

test("HMAC webhook verification is timing-safe and rejects tampering", () => {
  const secret = "test-secret";
  const provider = createProductionPaymentProvider({ env: { ACME_PAYMENT_WEBHOOK_SECRET: secret }, provider: { id: "test", createPayment: async () => ({}), verifyWebhook: async () => true } });
  const body = JSON.stringify({ id: "evt-1" });
  const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(provider.verifyHmac(body, signature), true);
  assert.throws(() => provider.verifyHmac(body + "x", signature), /Invalid payment webhook signature/);
});

test("payment webhook is idempotent and prevents overpayment", async () => {
  const invoices = new Map([["i-1", { id: "i-1", currency: "INR", total: 100, status: "issued" }]]);
  const payments = [];
  const invoiceRepository = { getById: async (id) => invoices.get(id) || null, update: async (id, changes) => { const next = { ...invoices.get(id), ...changes }; invoices.set(id, next); return next; } };
  const paymentRepository = { create: async (p) => { payments.push(p); return p; }, list: async (filter = {}) => payments.filter((p) => Object.entries(filter).every(([k, v]) => p[k] === v)) };
  const governance = createPaymentGovernance({ invoiceRepository, paymentRepository });
  const event = { id: "p-1", invoiceId: "i-1", provider: "test", providerEventId: "evt-1", amount: 40, currency: "INR" };
  const first = await governance.recordWebhook({ event });
  const duplicate = await governance.recordWebhook({ event });
  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(payments.length, 1);
  await assert.rejects(() => governance.recordWebhook({ event: { ...event, id: "p-2", providerEventId: "evt-2", amount: 70 } }), /exceeds invoice balance/);
});

test("reconciliation derives invoice status from successful payments", async () => {
  const invoice = { id: "i-2", currency: "INR", total: 100, status: "issued" };
  const payments = [{ id: "p-1", invoiceId: "i-2", status: "succeeded", amount: 100 }];
  const invoiceRepository = { getById: async () => invoice, update: async (_, changes) => Object.assign(invoice, changes) };
  const paymentRepository = { list: async () => payments, create: async (p) => p };
  const governance = createPaymentGovernance({ invoiceRepository, paymentRepository });
  const updated = await governance.reconcile({ invoiceId: "i-2", actor: { id: "u-1" } });
  assert.equal(updated.status, "paid");
  assert.equal(updated.paidAmount, 100);
  assert.equal(updated.reconciledBy, "u-1");
});
