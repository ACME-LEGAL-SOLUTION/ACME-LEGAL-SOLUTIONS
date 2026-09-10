-- ACME messaging and delivery governance v5
CREATE TABLE messages (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) REFERENCES matters(id),
  client_id VARCHAR(64) REFERENCES clients(id),
  channel VARCHAR(32) NOT NULL,
  provider VARCHAR(128) NOT NULL,
  template_id VARCHAR(128),
  template_version VARCHAR(32),
  recipient_ref VARCHAR(512) NOT NULL,
  status VARCHAR(32) NOT NULL,
  provider_message_id VARCHAR(256),
  idempotency_key VARCHAR(256) NOT NULL,
  attempt_count INTEGER NOT NULL,
  next_retry_at TIMESTAMP,
  failure_reason VARCHAR(1024),
  payload_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP
);
CREATE UNIQUE INDEX uq_messages_idempotency ON messages(idempotency_key);
CREATE UNIQUE INDEX uq_messages_provider_message ON messages(provider, provider_message_id);
CREATE INDEX idx_messages_matter_status ON messages(matter_id, status);
CREATE INDEX idx_messages_retry ON messages(status, next_retry_at);
