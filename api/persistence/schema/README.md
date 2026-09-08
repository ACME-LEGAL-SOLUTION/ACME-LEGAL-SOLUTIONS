# Canonical Schema Rules

The SQL in this directory is the ACME logical relational model. It is a contract for the production adapter, not a claim that a particular database engine has been selected.

## Invariants

- Every persisted operational record has a stable application identifier.
- Matter-linked records carry an explicit matter relationship where applicable.
- Audit events are append-only at the service boundary.
- Legal versions retain validity intervals needed for date-specific resolution.
- Financial amounts retain an explicit ISO-style currency code.
- Documents reference storage keys rather than embedding file bytes in the relational database.
- Production adapters must preserve these invariants and may add engine-specific constraints/indexes after approval.

Do not put secrets, client documents, credentials or production connection details in this repository.
