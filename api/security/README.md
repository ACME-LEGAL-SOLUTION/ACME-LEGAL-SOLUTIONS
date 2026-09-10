# Security Boundary

ACME security is server-side and matter-scoped. The canonical matter operation path is:

`Authenticated Actor → Matter Scope → Action Authorization → Transaction → Scoped Repository → Domain Mutation → Audit`

The canonical authorization implementation is `matter-authorization.js`. `runtime/access-control.js` is a compatibility facade and must not introduce independent authorization semantics.

## Production identity

ACME does not fabricate an identity provider. Production startup now fails closed unless an authenticated identity adapter is supplied directly or configured with `ACME_AUTH_MODULE`.

The configured adapter must export `authenticate(request)` and return a normalized identity containing:

- `id`
- `role`: `client`, `professional`, `admin`, `lawyer`, or `accountant`
- `human`: boolean
- optional `type`, `subject`, `clientId`, and `scopes`

The application validates the adapter output before exposing it to protected application services. The adapter remains responsible for the actual OIDC/JWT/session verification, key management, token/session revocation, and upstream identity-provider policy.

No credentials or client identity data belong in the repository.
