# ACME Persistence Layer

This directory defines the canonical relational persistence contract without prematurely selecting a database vendor or hosting topology.

## Implemented

- Canonical v1 relational schema covering the current executable domains.
- Versioned migration entry point and manifest.
- Migration planning, ordering, checksum validation and fail-closed drift detection.
- Canonical schema source verification before execution.
- Provider-neutral repository contract test harness.
- Provider-neutral transaction boundary with explicit commit/rollback semantics.
- Production persistence configuration contract with explicit provider selection.
- Foreign-key relationships for matter-scoped operational data.
- Indexes for common matter, audit, legal-version and diary queries.

## Production gate

The repository deliberately does **not** select a production database vendor, hosting topology, credentials, backup topology, encryption implementation or disaster-recovery configuration. `production-config.js` defines the configuration boundary; it does not provision or connect to a database.

Before production client data is stored, implement a provider-specific adapter behind `api/runtime/persistence-contract.js` and `api/runtime/storage-provider.js`, with:

1. atomic migrations and provider-native locking;
2. real transactions around multi-record domain operations;
3. foreign-key, uniqueness and check constraints appropriate to the approved database;
4. encryption and secret management;
5. backup/restore and DR controls;
6. adapter contract tests against the real engine;
7. production configuration that selects the approved provider rather than in-memory storage.

The in-memory repository remains a development/test adapter and must not be treated as production persistence.
