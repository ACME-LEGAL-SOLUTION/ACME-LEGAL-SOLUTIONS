"use strict";

const crypto = require("node:crypto");

const DEFAULT_MAX_AMOUNT = 1000000000;

function requireText(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${name} is required`);
  return value.trim();
}

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > DEFAULT_MAX_AMOUNT) throw new TypeError("Payment amount is invalid");
  return Math.round(amount * 100) / 100;
}

function timingSafeEqualHex(actual, expected) {
  const a = Buffer.from(actual, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createProductionPaymentProvider({ env = process.env, provider = null, secret = env.ACME_PAYMENT_WEBHOOK_SECRET || null } = {}) {
  const configured = provider || (() => {
    const moduleName = env.ACME_PAYMENT_PROVIDER_MODULE;
    if (!moduleName) throw new Error("Production payment provider adapter is not configured (ACME_PAYMENT_PROVIDER_MODULE)");
    return require(moduleName);
  })();
  if (!configured || typeof configured.createPayment !== "function" || typeof configured.verifyWebhook !== "function") {
    throw new TypeError("Payment provider must expose createPayment and verifyWebhook");
  }
  return Object.freeze({
    id: requireText(configured.id || env.ACME_PAYMENT_PROVIDER_ID || "payment-provider", "Payment provider id"),
    async createPayment(input = {}) {
      requireText(input.invoiceId, "invoiceId");
      requireText(input.currency, "currency");
      const amount = parseAmount(input.amount);
      requireText(input.idempotencyKey, "idempotencyKey");
      return configured.createPayment({ invoiceId: input.invoiceId, amount, currency: input.currency.toUpperCase(), idempotencyKey: input.idempotencyKey, metadata: input.metadata || {} });
    },
    async verifyWebhook({ rawBody, signature, headers = {} } = {}) {
      if (rawBody === undefined || rawBody === null) throw new TypeError("Webhook body is required");
      requireText(signature || headers["x-payment-signature"] || headers["X-Payment-Signature"], "Webhook signature");
      return configured.verifyWebhook({ rawBody, signature: signature || headers["x-payment-signature"] || headers["X-Payment-Signature"], headers });
    },
    verifyHmac(rawBody, signature) {
      if (!secret) throw new Error("Payment webhook secret is not configured");
      requireText(signature, "Webhook signature");
      const expected = crypto.createHmac("sha256", secret).update(String(rawBody)).digest("hex");
      if (!timingSafeEqualHex(expected, signature.replace(/^sha256=/, ""))) throw new Error("Invalid payment webhook signature");
      return true;
    }
  });
}

function createPaymentGovernance({ invoiceRepository, paymentRepository, transaction = null, audit = null, clock = () => new Date() } = {}) {
  if (!invoiceRepository?.getById || !invoiceRepository?.update || !paymentRepository?.create || !paymentRepository?.list) throw new Error("Payment governance repositories are not configured");
  const run = transaction || (async (work) => work({ invoiceRepository, paymentRepository }));
  async function recordWebhook({ event, actor }) {
    if (!event?.id || !event.invoiceId || !event.provider || !event.providerEventId) throw new TypeError("Payment webhook event is incomplete");
    const invoice = await invoiceRepository.getById(event.invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    if (!["issued", "partially_paid"].includes(invoice.status)) throw new Error("Invoice is not payable");
    const amount = parseAmount(event.amount);
    if (String(event.currency).toUpperCase() !== String(invoice.currency || invoice.currencyCode).toUpperCase()) throw new Error("Payment currency does not match invoice");
    const existing = await paymentRepository.list({ provider: event.provider, providerEventId: event.providerEventId });
    if (existing.length) return { duplicate: true, payment: existing[0], invoice };
    const payments = await paymentRepository.list({ invoiceId: invoice.id });
    const paid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (paid + amount > Number(invoice.total || invoice.totalAmount)) throw new Error("Payment exceeds invoice balance");
    return run(async ({ invoiceRepository: invoices, paymentRepository: paymentsRepo }) => {
      const payment = await paymentsRepo.create({ id: event.id, invoiceId: invoice.id, status: event.status || "succeeded", currencyCode: String(event.currency).toUpperCase(), amount, provider: event.provider, providerEventId: event.providerEventId, providerReference: event.providerReference || null, idempotencyKey: event.idempotencyKey || `${event.provider}:${event.providerEventId}`, verifiedAt: clock().toISOString(), createdAt: clock().toISOString() });
      const total = paid + amount;
      const nextStatus = total === Number(invoice.total || invoice.totalAmount) ? "paid" : "partially_paid";
      const updated = await invoices.update(invoice.id, { status: nextStatus, paidAmount: total, updatedAt: clock().toISOString() });
      if (audit?.append) await audit.append({ type: "billing.payment_webhook_recorded", actorId: actor?.id || "system", payload: { provider: event.provider, providerEventId: event.providerEventId, invoiceId: invoice.id, paymentId: payment.id, amount }, occurredAt: clock().toISOString() });
      return { duplicate: false, payment, invoice: updated };
    });
  }
  async function reconcile({ invoiceId, actor }) {
    if (!actor?.id) throw new Error("Authenticated actor is required");
    const invoice = await invoiceRepository.getById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");
    const payments = await paymentRepository.list({ invoiceId });
    const paidAmount = payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const total = Number(invoice.total || invoice.totalAmount);
    const expectedStatus = paidAmount === 0 ? "issued" : paidAmount >= total ? "paid" : "partially_paid";
    const updated = await invoiceRepository.update(invoiceId, { status: expectedStatus, paidAmount, reconciledAt: clock().toISOString(), reconciledBy: actor.id, updatedAt: clock().toISOString() });
    if (audit?.append) await audit.append({ type: "billing.reconciled", actorId: actor.id, payload: { invoiceId, paidAmount, total, status: expectedStatus }, occurredAt: clock().toISOString() });
    return updated;
  }
  return Object.freeze({ recordWebhook, reconcile });
}

module.exports = { DEFAULT_MAX_AMOUNT, createProductionPaymentProvider, createPaymentGovernance };
