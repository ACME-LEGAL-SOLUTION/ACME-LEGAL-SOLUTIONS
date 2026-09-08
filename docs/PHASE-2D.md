# Phase 2D — Persistent CRM Domain Operations

## Scope

The next implementation slice is the persistent CRM domain workflow:

`Client → Matter → Party → Relationship Graph → Conflict Check → Document → Evidence → Audit`

All protected matter mutations must use:

`Authenticated Actor → Matter Scope → Canonical Action Authorization → Transaction → Scoped Repository → Domain Mutation → Audit`

## Validation requirements

- Cross-matter access is denied server-side.
- Authorization happens before transaction work.
- Multi-step writes use one transaction-scoped repository set.
- Any failed step rolls back the complete operation.
- Audit records are append-only.
- HTTP integration exercises the persistent application composition rather than only in-memory services.
- No production database, provider, or deployment is implied by test fixtures.

## Exit criteria

Phase 2D is complete only when persistent CRM operations, rollback, authorization, audit, and authenticated HTTP integration are covered by automated tests and GitHub Actions is green.
