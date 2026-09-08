# ACME Persistence Layer

This directory defines the canonical relational persistence contract without prematurely selecting a database vendor or hosting topology.

## Implemented

- Canonical v1 relational schema covering the current executable domains.
- Versioned migration entry point and manifest.
- Migration planning, ordering, checksum validation and fail-closed drift detection.
- Provider-neutral repository contract test harness.
- Provider-neutral transaction boundary with explicit commit/rollback semantics.
- Foreign-key relationships for matter-scoped operational data.
- Indexes for common matter, audit, legal-version and diary queries.

## Production gate

The repository deliberately does **not** choose PostgreSQL, MySQL, a managed provider, credentials, backup topology, encryption implementation or disaster-recovery configuration. Those decisions remain an approved production architecture gate.

Before production client data is stored, implement a provider-specific adapter behind `api/runtime/persistence-contract.js` and `api/runtime/storage-provider.js`, with:

1. atomic migrations and rollback strategy;
2. real transactions around multi-record domain operations;
3. foreign-key, uniqueness and check constraints appropriate to the approved database;
4. encryption and secret management;
5. backup/restore and DR controls;
6. adapter contract tests against the real engine;
7. production configuration that selects the approved provider rather than in-memory storage.

The in-memory repository remains a development/test adapter and must not be treated as production persistence.
