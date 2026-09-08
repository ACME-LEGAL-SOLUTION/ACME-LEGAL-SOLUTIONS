# Canonical Matter-Scoped Operation Contract

ACME matter-scoped mutations follow one security and consistency path:

`Authenticated Actor → Matter Scope → Action Authorization → Transaction → Scoped Repository → Domain Mutation → Audit`

## Required rules

- Authorization is evaluated server-side before a transaction begins.
- Every protected operation carries an explicit `matterId` and action.
- Repository work inside a transaction uses the transaction-scoped repository factory.
- An authorization denial produces no transaction and no repository mutation.
- A failed multi-step operation rolls back and preserves the original domain error.
- Audit records are append-only and remain part of the governance boundary.
- Runtime access-control callers use the canonical security authorization implementation.

## Canonical action vocabulary

`read`, `create`, `update`, `assign`, `review`, `close`, `archive`

Specialized operations must map their intent to one of these canonical actions rather than introducing a parallel authorization vocabulary.

## Production boundary

The authorization contract is provider-neutral. Production identity, RBAC policy, database driver, and deployment topology remain configuration/architecture decisions and must not be fabricated by the application layer.
