# ACME Production Migration Execution Contract

Production migration execution is provider-neutral until the approved database engine and topology are selected.

## Required adapter capabilities

A production adapter MUST provide:

- `readAppliedMigrations()` returning version/checksum records;
- `transaction.run(work)` with atomic commit/rollback semantics;
- `acquireLock()` and `releaseLock()` for serialized migration execution;
- a driver-specific SQL binding implementation behind the SQL dialect boundary;
- durable migration-record writes in the same transaction as schema changes.

## Fail-closed rules

- Canonical migration source checksum drift aborts before execution.
- Unknown applied migrations abort execution.
- Applied checksum drift aborts execution.
- Failed schema execution MUST roll back the migration transaction.
- Migration lock MUST be released even when execution fails.
- Production configuration MUST explicitly select an approved provider and connection URL.
- Destructive rollback remains forbidden by default until provider-specific rollback is approved.

## Bootstrap requirement

The first migration must bootstrap `acme_migrations` as part of the same provider-approved atomic initialization path. A production adapter must handle the first-run bootstrap explicitly; the provider-neutral runner does not assume that the migration ledger already exists.

## Parameter binding

Migration and application code must not depend on a driver's placeholder syntax. The selected adapter supplies the SQL dialect and parameter binding implementation.
