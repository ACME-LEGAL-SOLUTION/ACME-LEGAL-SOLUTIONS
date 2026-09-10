# GoDaddy Node.js Hosting Deployment Path

## Purpose

GoDaddy now offers managed Node.js Hosting as a separate deployment path from VPS. This path is suitable for ACME because the repository already has a `start` script and binds the HTTP server to `PORT`. GoDaddy's platform currently runs Node.js applications on Node.js 22, supports GitHub-connected deployment, encrypted environment secrets, managed MySQL, automatic HTTPS/CDN/WAF, private previews, and publish promotion.

## Repository compatibility

The application currently provides:

- `npm start` → `node api/runtime/http-server.js`
- Node.js engine requirement `>=20`
- `PORT` support through the HTTP server
- no requirement for a local persistent filesystem for core application state
- external persistence/provider boundaries for production services

Node.js 22 satisfies the repository's `>=20` engine requirement.

## Preferred managed deployment sequence

1. Connect the GoDaddy Node.js Hosting app to the GitHub repository.
2. Select the `main` branch only after the target commit has passed GitHub CI.
3. Import and deploy to the private preview environment.
4. Configure all production adapter environment variables as GoDaddy secrets.
5. Configure the production database and persistence connection through the platform secret mechanism.
6. Confirm the preview application boots and `/health` is HTTP 200.
7. Confirm `/ready` is HTTP 200 only after production persistence and adapter requirements are satisfied.
8. Execute authenticated E2E acceptance against non-production test records.
9. Verify application logs contain no credentials, tokens, customer documents, or sensitive payloads.
10. Publish only after all acceptance gates pass.
11. Connect the production custom domain and verify HTTPS.

## Important platform distinction

The managed Node.js Hosting path does not use the repository Dockerfile. Docker-based deployment remains supported by the VPS path. Do not attempt to make the managed platform run Docker merely because the repository contains a Dockerfile.

## Persistence requirements

GoDaddy Node.js Hosting provides managed MySQL, but ACME's migration contract must still be executed against the selected production database and all migration versions/checksums must be verified before production traffic. Application-local filesystem persistence must not be used for legal records, evidence, documents, payments, messages, or audit data.

## Secrets

Never commit provider credentials or database passwords. GoDaddy's managed Node.js Hosting secrets facility must be used for production environment values. Secret values must not be printed in build/runtime logs.

Required ACME adapter variables:

- `ACME_ENV=production`
- `ACME_AUTH_MODULE`
- `ACME_OBJECT_STORAGE_MODULE`
- `ACME_AI_PROVIDER_MODULE`
- `ACME_PAYMENT_PROVIDER_MODULE`
- `ACME_MESSAGING_PROVIDER_MODULE`

## Acceptance gates

- Exact Git commit deployed.
- Preview boot succeeds.
- `/health` returns 200.
- `/ready` returns 200 with production persistence healthy.
- Production database migrations verified.
- Identity and RBAC verified.
- Matter authorization verified.
- Object storage verified.
- AI policy boundary verified.
- Payment verification/idempotency/reconciliation verified.
- Messaging delivery/webhook/retry/audit verified.
- Backup/restore and measured RPO/RTO verified.
- HTTPS/custom domain verified.
- Publish performed only after all gates pass.

## Rollback

Use the platform's previous accepted application deployment/revision when possible. Never destructively roll back database migrations. If a migration compatibility issue occurs, stop publication and resolve forward or restore from an explicitly tested database backup according to the recovery procedure.

## Evidence required

Record:

- deployed Git commit SHA
- preview URL and publish status
- migration results
- `/health` and `/ready` responses
- database health
- authentication/RBAC results
- object storage results
- AI/payment/messaging results
- backup/restore evidence
- measured RPO/RTO
- HTTPS/domain evidence
- rollback readiness
