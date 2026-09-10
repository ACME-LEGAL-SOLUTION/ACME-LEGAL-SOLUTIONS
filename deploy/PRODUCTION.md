# ACME Production Deployment Runbook

## Scope

This runbook covers the repository-side production packaging and the acceptance sequence for a GoDaddy-hosted Node.js deployment. It intentionally contains no credentials, provider secrets, customer data, certificates, or database passwords.

## Origin requirements

- Node.js 20 or newer.
- The application process listens on `PORT` (default `3000`).
- A reverse proxy terminates HTTPS and forwards only application traffic to the origin port.
- The public hostname must use a valid TLS certificate with automated renewal.
- Production must set `ACME_ENV=production`.
- All required provider adapter variables must be supplied through the host secret/environment facility, never committed to Git.
- The production database must be external/persistent and must pass the migration integration contract before traffic is enabled.

## Required production adapters

`ACME_AUTH_MODULE`

`ACME_OBJECT_STORAGE_MODULE`

`ACME_AI_PROVIDER_MODULE`

`ACME_PAYMENT_PROVIDER_MODULE`

`ACME_MESSAGING_PROVIDER_MODULE`

The `/ready` endpoint must return HTTP 200 only when the production adapter boundary and persistence health checks succeed. `/health` is a liveness check and must not be used as the deployment acceptance gate.

## Deployment sequence

1. Build the exact Git commit selected for release.
2. Install production dependencies from the lockfile when one is present; otherwise use the repository package manifest without adding ad-hoc dependencies.
3. Configure secrets and provider adapters in the host environment.
4. Run the migration process against the production database before enabling application traffic.
5. Start the application on an internal origin port.
6. Verify `GET /health` returns HTTP 200.
7. Verify `GET /ready` returns HTTP 200 and reports production persistence as healthy.
8. Route the public hostname through the HTTPS reverse proxy.
9. Verify the TLS certificate, redirect policy, and security headers.
10. Execute authenticated client and professional portal smoke flows.
11. Execute matter authorization, document/object-storage, payment, messaging, and AI boundary checks with non-production test records.
12. Record measured backup/RPO/RTO evidence before production acceptance.

## Reverse-proxy rules

- Redirect HTTP to HTTPS.
- Do not expose the origin port publicly when the hosting platform permits firewalling it.
- Forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and request identifiers as supported by the proxy.
- Preserve request bodies and authorization headers for API routes.
- Do not cache authenticated API responses or `/health` and `/ready`.
- Do not cache responses containing client, matter, document, evidence, payment, or messaging data.

## Acceptance gates

| Gate | Evidence required | Pass condition |
|---|---|---|
| Build | exact release commit | reproducible successful build |
| Migration | production DB migration log | all migrations applied exactly once |
| Liveness | `/health` response | HTTP 200 |
| Readiness | `/ready` response | HTTP 200, persistence healthy |
| TLS | certificate/protocol inspection | valid certificate and HTTPS only |
| Identity | authenticated test account | correct actor and role |
| Matter authorization | client + professional test accounts | cross-matter access denied |
| Documents | test object | scoped upload/read/delete succeeds |
| AI | approved test request | policy boundary enforced |
| Payments | sandbox/test transaction | verification + idempotency + reconciliation pass |
| Messaging | provider test message | delivery state/audit pass without PII leakage |
| Recovery | backup + restore exercise | restore verified and measured RPO/RTO within policy |
| Rollback | previous release | previous release can start and pass readiness |

## Rollback

If readiness, migration compatibility, authentication, authorization, or data-integrity acceptance fails, stop public traffic and revert to the last accepted application release. Do not roll back database migrations destructively. Resolve forward with a compatible migration unless the database restore procedure has been explicitly approved and tested.

## Secrets rule

Never place provider credentials, signing secrets, API tokens, private keys, database passwords, client documents, or exported backups in this repository, Docker image layers, or deployment documentation.
