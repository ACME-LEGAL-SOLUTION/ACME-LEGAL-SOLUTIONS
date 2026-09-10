# M6-3 Production Object Storage Boundary

Status: implementation complete at the adapter/application boundary; provider deployment remains required.

## Contract

Production uses `ACME_OBJECT_STORAGE_MODULE`. The adapter must expose `put`, `get`, and `delete`.

ACME generates matter-scoped keys as `matters/<matterId>/objects/<objectId>` with path-segment encoding and supplies SHA-256 checksums for writes when absent.

Document and evidence services enforce matter authorization before protected operations. Document object access is routed through the storage adapter rather than treating the database as a binary store.

## Deployment responsibilities

The external storage provider must provide encryption at rest, KMS/key rotation, credentials, durability, replication, versioning where required, retention/legal-hold enforcement, backup/restore, lifecycle deletion, and operational monitoring. ACME does not commit provider credentials or client data.

## Remaining production acceptance

Before production go-live, configure a vetted provider adapter and execute restore, retention/deletion, encryption, access-control, and failure-injection tests against the actual deployment topology.
