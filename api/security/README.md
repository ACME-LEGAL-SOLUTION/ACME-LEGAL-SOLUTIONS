# Security Boundary

ACME security is server-side and matter-scoped. The canonical matter operation path is:

`Authenticated Actor → Matter Scope → Action Authorization → Transaction → Scoped Repository → Domain Mutation → Audit`

The canonical authorization implementation is `matter-authorization.js`. `runtime/access-control.js` is a compatibility facade and must not introduce independent authorization semantics.

## Production identity

ACME does not fabricate an identity provider. Production startup fails closed unless an authenticated identity adapter is supplied directly or configured with `ACME_AUTH_MODULE`. The configured adapter remains responsible for OIDC/JWT/session verification, key management, revocation and upstream identity policy.

## Production AI

Production startup requires a real AI provider adapter through `ACME_AI_PROVIDER_MODULE` unless one is explicitly injected by the deployment composition. The production AI boundary requires a provider id, preserves matter scope and authenticated actor identity, limits task/context size, enforces provider-defined model and tool allow-lists, generates a request id, and applies a provider timeout. AI cannot invoke final human-action tools; consequential decisions remain subject to human review.

The external AI provider remains responsible for its credentials, transport security, provider-side retention controls and model-level safety controls. ACME must not commit provider credentials or client data.

## Production object storage

Production document/evidence bytes are handled through `ACME_OBJECT_STORAGE_MODULE`. The adapter must implement `put`, `get`, and `delete`. ACME generates matter-scoped object keys and rejects operations without both matter and object scope. Database records retain metadata/storage references rather than document bytes.

The external storage provider remains responsible for encryption at rest, KMS/key rotation, credentials, durability, replication, versioning, retention/legal holds, backup/restore and disaster recovery. Application authorization must occur before object access.
