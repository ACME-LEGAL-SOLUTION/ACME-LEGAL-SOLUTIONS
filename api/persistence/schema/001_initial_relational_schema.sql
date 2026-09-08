-- ACME canonical relational schema v1
-- Vendor-neutral SQL contract. Do not run against production until a database
-- vendor, hosting topology, backup/DR and encryption configuration are approved.

CREATE TABLE acme_migrations (
  version VARCHAR(32) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL,
  checksum VARCHAR(128) NOT NULL
);

CREATE TABLE clients (
  id VARCHAR(64) PRIMARY KEY,
  client_type VARCHAR(32) NOT NULL,
  person_id VARCHAR(64),
  organization_id VARCHAR(64),
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE matters (
  id VARCHAR(64) PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id),
  status VARCHAR(32) NOT NULL,
  jurisdiction_code VARCHAR(32),
  assigned_user_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE parties (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  party_type VARCHAR(32) NOT NULL,
  display_name VARCHAR(512) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE relationships (
  id VARCHAR(64) PRIMARY KEY,
  source_party_id VARCHAR(64) NOT NULL REFERENCES parties(id),
  target_party_id VARCHAR(64) NOT NULL REFERENCES parties(id),
  relationship_type VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE conflicts (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  result VARCHAR(32) NOT NULL,
  checked_at TIMESTAMP NOT NULL,
  checked_by VARCHAR(64) NOT NULL
);

CREATE TABLE documents (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  document_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  storage_key VARCHAR(1024) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE evidence (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  evidence_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  source_document_id VARCHAR(64) REFERENCES documents(id),
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE ai_interactions (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) REFERENCES matters(id),
  interaction_type VARCHAR(64) NOT NULL,
  confidence NUMERIC(6,5),
  provenance_state VARCHAR(64),
  human_review_required BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE reviews (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) REFERENCES matters(id),
  ai_interaction_id VARCHAR(64) REFERENCES ai_interactions(id),
  reviewer_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  final_action_authorized BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  decided_at TIMESTAMP
);

CREATE TABLE audit_events (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(64) NOT NULL,
  actor_type VARCHAR(32) NOT NULL,
  matter_id VARCHAR(64) REFERENCES matters(id),
  event_type VARCHAR(128) NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE sources (
  id VARCHAR(64) PRIMARY KEY,
  source_type VARCHAR(64) NOT NULL,
  jurisdiction_code VARCHAR(32),
  title VARCHAR(1024) NOT NULL,
  verification_state VARCHAR(64) NOT NULL,
  effective_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE legal_versions (
  id VARCHAR(64) PRIMARY KEY,
  legal_instrument_id VARCHAR(64) NOT NULL,
  jurisdiction_code VARCHAR(32) NOT NULL,
  title VARCHAR(1024) NOT NULL,
  valid_from TIMESTAMP NOT NULL,
  valid_to TIMESTAMP,
  amendment_state VARCHAR(64) NOT NULL,
  source_id VARCHAR(64) NOT NULL REFERENCES sources(id),
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE authorities (
  id VARCHAR(64) PRIMARY KEY,
  jurisdiction_code VARCHAR(32) NOT NULL,
  name VARCHAR(512) NOT NULL,
  authority_type VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE diary_entries (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  entry_type VARCHAR(64) NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE hearings (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  authority_id VARCHAR(64) REFERENCES authorities(id),
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE invoices (
  id VARCHAR(64) PRIMARY KEY,
  client_id VARCHAR(64) NOT NULL REFERENCES clients(id),
  matter_id VARCHAR(64) REFERENCES matters(id),
  status VARCHAR(32) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  total_amount NUMERIC(18,2) NOT NULL,
  issued_at TIMESTAMP,
  due_at TIMESTAMP
);

CREATE TABLE payments (
  id VARCHAR(64) PRIMARY KEY,
  invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id),
  status VARCHAR(32) NOT NULL,
  currency_code VARCHAR(3) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  provider_reference VARCHAR(256),
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE partners (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  verification_state VARCHAR(64) NOT NULL,
  jurisdictions_json TEXT NOT NULL,
  specialties_json TEXT NOT NULL,
  contact_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_matters_client ON matters(client_id);
CREATE INDEX idx_matters_jurisdiction ON matters(jurisdiction_code);
CREATE INDEX idx_parties_matter ON parties(matter_id);
CREATE INDEX idx_documents_matter ON documents(matter_id);
CREATE INDEX idx_evidence_matter ON evidence(matter_id);
CREATE INDEX idx_audit_matter_created ON audit_events(matter_id, created_at);
CREATE INDEX idx_legal_versions_effective ON legal_versions(jurisdiction_code, legal_instrument_id, valid_from, valid_to);
CREATE INDEX idx_diary_matter_schedule ON diary_entries(matter_id, scheduled_at);
CREATE INDEX idx_hearings_matter_schedule ON hearings(matter_id, scheduled_at);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
