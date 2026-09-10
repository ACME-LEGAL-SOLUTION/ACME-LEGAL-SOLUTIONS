-- ACME payment governance v4
-- Adds immutable payment idempotency, webhook verification and reconciliation metadata.

ALTER TABLE invoices ADD COLUMN created_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN updated_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN issued_by VARCHAR(64);
ALTER TABLE invoices ADD COLUMN idempotency_key VARCHAR(256);

ALTER TABLE payments ADD COLUMN provider VARCHAR(128);
ALTER TABLE payments ADD COLUMN provider_event_id VARCHAR(256);
ALTER TABLE payments ADD COLUMN idempotency_key VARCHAR(256);
ALTER TABLE payments ADD COLUMN verified_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN reconciled_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN reconciled_by VARCHAR(64);
ALTER TABLE payments ADD COLUMN failure_reason VARCHAR(1024);

CREATE UNIQUE INDEX uq_invoices_idempotency ON invoices(idempotency_key);
CREATE UNIQUE INDEX uq_payments_provider_event ON payments(provider, provider_event_id);
CREATE UNIQUE INDEX uq_payments_idempotency ON payments(idempotency_key);
CREATE INDEX idx_payments_reconciliation ON payments(reconciled_at, status);
