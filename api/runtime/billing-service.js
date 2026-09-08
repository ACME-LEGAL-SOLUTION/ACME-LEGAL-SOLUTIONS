"use strict";

const STATUSES = Object.freeze(["draft", "issued", "partially_paid", "paid", "void"]);

function createBillingService({ invoiceRepository, paymentRepository, audit = null, clock = () => new Date() } = {}) {
  if (!invoiceRepository?.create || !paymentRepository?.create) throw new Error("Billing repositories are not configured");
  async function auditEvent(type, payload, actor) {
    if (audit?.append) await audit.append({ type, actorId: actor.id, payload, occurredAt: clock().toISOString() });
  }
  return {
    async createInvoice({ clientId, matterId = null, currency, lines, actor }) {
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!clientId || !currency || !Array.isArray(lines) || lines.length === 0) throw new Error("Client, currency and invoice lines are required");
      const total = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
      if (!Number.isFinite(total) || total < 0) throw new Error("Invalid invoice total");
      const invoice = await invoiceRepository.create({ clientId, matterId, currency, lines, total, status: "draft", createdBy: actor.id, createdAt: clock().toISOString() });
      await auditEvent("billing.invoice_created", invoice, actor);
      return invoice;
    },
    async issue(invoice, actor) {
      if (!invoice?.id) throw new Error("Invoice is required");
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (invoice.status !== "draft") throw new Error("Only draft invoices can be issued");
      const updated = await invoiceRepository.update(invoice.id, { status: "issued", issuedBy: actor.id, issuedAt: clock().toISOString() });
      await auditEvent("billing.invoice_issued", updated, actor);
      return updated;
    },
    async recordPayment({ invoice, amount, reference = null, actor }) {
      if (!invoice?.id) throw new Error("Invoice is required");
      if (!actor?.id) throw new Error("Authenticated actor is required");
      if (!(amount > 0) || amount > invoice.total) throw new Error("Payment amount must be positive and not exceed invoice total");
      const payment = await paymentRepository.create({ invoiceId: invoice.id, amount, currency: invoice.currency, reference, recordedBy: actor.id, createdAt: clock().toISOString() });
      const status = amount === invoice.total ? "paid" : "partially_paid";
      const updatedInvoice = await invoiceRepository.update(invoice.id, { status, paidAmount: amount, updatedAt: clock().toISOString() });
      await auditEvent("billing.payment_recorded", { payment, invoice: updatedInvoice }, actor);
      return { payment, invoice: updatedInvoice };
    },
    STATUSES
  };
}

module.exports = { STATUSES, createBillingService };
