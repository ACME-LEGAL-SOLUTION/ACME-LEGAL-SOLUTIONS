# ACME Production Persistence Roadmap

## Current state

The application services use a provider-neutral repository boundary. The default adapter is in-memory and is suitable for deterministic tests/development only; it is not production persistence.

## Production gate

Before production client data is accepted, select and approve the production relational database and hosting topology. The repository contract must remain stable while the production adapter is substituted.

Required production work:

1. Define normalized relational schema for the ACME domain entities.
2. Add versioned migrations and rollback strategy.
3. Implement repository adapter against the approved database.
4. Add transaction boundaries for multi-record workflows (consultation intake, matter opening, review/final action, billing/payment, audit).
5. Add constraints and indexes for identity, matter scope, jurisdiction, dates, and audit integrity.
6. Encrypt sensitive data at rest where provided by the selected platform and protect application secrets server-side.
7. Add backup/restore and disaster-recovery procedures once the hosting topology is selected.
8. Run repository contract tests against both the in-memory and production adapters.
9. Only then switch the deployment configuration from the development adapter to production persistence.

## Non-negotiable boundary

No production database vendor, credentials, storage endpoint, retention period, RPO/RTO, or regulatory data-hosting claim is invented here. Those remain explicit deployment decisions until confirmed.
