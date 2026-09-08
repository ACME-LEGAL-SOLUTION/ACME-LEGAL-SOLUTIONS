"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCollection } = require("./in-memory-repository");
const { createBillingService } = require("./billing-service");

test("billing creates and issues an invoice", async () => {
  const service = createBillingService({ invoiceRepository: createCollection(), paymentRepository: createCollection() });
  const actor = { id: "u" };
  const invoice = await service.createInvoice({ clientId: "c", currency: "INR", lines: [{ description: "Fee", amount: 1000 }], actor });
  assert.equal(invoice.total, 1000);
  const issued = await service.issue(invoice, actor);
  assert.equal(issued.status, "issued");
});

test("billing records full payment and closes invoice", async () => {
  const service = createBillingService({ invoiceRepository: createCollection(), paymentRepository: createCollection() });
  const actor = { id: "u" };
  const invoice = await service.createInvoice({ clientId: "c", currency: "INR", lines: [{ description: "Fee", amount: 1000 }], actor });
  const issued = await service.issue(invoice, actor);
  const result = await service.recordPayment({ invoice: issued, amount: 1000, reference: "P-1", actor });
  assert.equal(result.invoice.status, "paid");
});
