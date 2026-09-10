# M6-10 Production Deployment & E2E Acceptance

## Deployment boundary

ACME production must run with `ACME_ENV=production` and must fail closed unless the server-side adapters required by the production readiness boundary are configured:

- `ACME_AUTH_MODULE`
- `ACME_OBJECT_STORAGE_MODULE`
- `ACME_AI_PROVIDER_MODULE`
- `ACME_PAYMENT_PROVIDER_MODULE`
- `ACME_MESSAGING_PROVIDER_MODULE`

Provider credentials and secrets are deployment-time configuration only; they must never be committed to the repository.

## HTTP acceptance

- `/health` is a liveness endpoint and must not be used as proof that dependencies are ready.
- `/ready` is the readiness endpoint. In production it requires all configured provider boundaries and a production persistence/repository boundary.
- `/ready` returns HTTP `200` with `status=ready` when the application is ready and HTTP `503` with `status=not_ready` otherwise.
- API responses use `no-store`, `nosniff`, `DENY`, restrictive referrer/permissions policy, and a response CSP that prevents framing.
- HTTPS termination should occur at the GoDaddy/reverse-proxy edge; the origin must not be exposed directly to the public Internet.

## Release sequence

1. Provision DNS and TLS at the edge.
2. Configure deployment-time environment variables and provider secrets.
3. Deploy the immutable application revision.
4. Run database migrations using the application migration runner.
5. Poll `/ready` until ready; abort the release on `503`.
6. Run authenticated smoke/E2E checks for identity, matter authorization, documents/evidence, AI, billing and messaging boundaries.
7. Promote traffic only after all acceptance checks pass.
8. Retain the previous known-good revision for rollback.

## Rollback

Rollback must restore the previous application revision without deleting or rewriting production data. Database migrations are forward-compatible release gates; destructive schema changes require a separately approved migration plan and restore rehearsal.

## Infrastructure acceptance still required

Application tests cannot prove the deployed GoDaddy environment. Before production sign-off, independently verify DNS, TLS certificate renewal, reverse-proxy forwarding, firewall exposure, real provider credentials, encrypted object storage, backup/restore, RPO/RTO, monitoring/alert delivery, and authenticated browser E2E flows against the deployed environment.
