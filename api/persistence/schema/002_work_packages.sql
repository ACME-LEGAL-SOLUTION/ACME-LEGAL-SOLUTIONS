-- ACME canonical relational schema v2: governed portal work packages.
CREATE TABLE work_packages (
  id VARCHAR(64) PRIMARY KEY,
  matter_id VARCHAR(64) NOT NULL REFERENCES matters(id),
  state VARCHAR(32) NOT NULL,
  issue VARCHAR(2048),
  jurisdiction VARCHAR(64),
  applicable_date DATE,
  payload_json TEXT NOT NULL,
  provenance_json TEXT NOT NULL,
  confidence NUMERIC(6,5),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  approved_by VARCHAR(64),
  finalized_by VARCHAR(64)
);
CREATE INDEX idx_work_packages_matter ON work_packages(matter_id);
CREATE INDEX idx_work_packages_state ON work_packages(matter_id, state);
