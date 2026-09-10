-- ACME legal source governance v3
-- Adds provenance, verification and acquisition metadata to sources.

ALTER TABLE sources ADD COLUMN issuing_authority VARCHAR(512);
ALTER TABLE sources ADD COLUMN locator VARCHAR(2048);
ALTER TABLE sources ADD COLUMN checksum VARCHAR(128);
ALTER TABLE sources ADD COLUMN license VARCHAR(512);
ALTER TABLE sources ADD COLUMN fetched_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN registered_by VARCHAR(64);
ALTER TABLE sources ADD COLUMN verified_by VARCHAR(64);
ALTER TABLE sources ADD COLUMN verified_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN verification_evidence TEXT;
ALTER TABLE sources ADD COLUMN stale_reason TEXT;
ALTER TABLE sources ADD COLUMN stale_at TIMESTAMP;
ALTER TABLE sources ADD COLUMN marked_stale_by VARCHAR(64);

CREATE INDEX idx_sources_jurisdiction_verification ON sources(jurisdiction_code, verification_state);
CREATE INDEX idx_sources_checksum ON sources(checksum);
