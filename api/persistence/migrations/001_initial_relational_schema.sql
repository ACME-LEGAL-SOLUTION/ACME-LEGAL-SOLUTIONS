-- Migration 001: canonical ACME relational foundation.
-- This migration is intentionally vendor-neutral. Production execution requires
-- approval of the database engine, hosting topology and operational controls.

CREATE TABLE acme_migrations (
  version VARCHAR(32) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL,
  checksum VARCHAR(128) NOT NULL
);

-- The canonical table definitions are maintained in
-- api/persistence/schema/001_initial_relational_schema.sql.
-- A production migration runner must apply that schema atomically, record its
-- checksum in acme_migrations, and reject checksum drift or partial upgrades.

INSERT INTO acme_migrations (version, applied_at, checksum)
VALUES ('001_initial_relational_schema', CURRENT_TIMESTAMP, 'CANONICAL_SCHEMA_V1');
