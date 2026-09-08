# Security Boundary

ACME security is server-side and matter-scoped. The canonical matter operation path is:

`Authenticated Actor → Matter Scope → Action Authorization → Transaction → Scoped Repository → Domain Mutation → Audit`

The canonical authorization implementation is `matter-authorization.js`. `runtime/access-control.js` is a compatibility facade and must not introduce independent authorization semantics.

Production identity provider, RBAC policy, secrets, database credentials, and deployment topology remain external configuration concerns.
