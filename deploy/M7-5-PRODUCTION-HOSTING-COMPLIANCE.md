# M7-5 Production Hosting Compliance

## Decision

ACME will keep GitHub as the source-of-truth repository, CI/CD control plane and release authority, but GitHub Pages is **not** the production public-hosting target.

GitHub's current Pages limitations state that Pages is not intended or allowed to be used as free web hosting for an online business or a site primarily directed at facilitating commercial transactions or providing commercial SaaS. ACME is a commercial legal-services application, so the repository must not represent GitHub Pages as its production hosting plane.

## Public web plane

The production-compatible direction is a commercially suitable static hosting/CDN service with native GitHub integration. Cloudflare Pages is the current candidate because its official documentation supports GitHub repository integration, automatic deployments, pull-request previews, custom domains and static HTML hosting.

Cloudflare Pages remains a replaceable deployment target. No Cloudflare account, API token, DNS change or production deployment is authorized by this document alone.

## GitHub's role

GitHub remains authoritative for source code, pull requests and review, automated tests, production-package validation, release commits, deployment provenance and public-site artifact validation. The production public host must deploy from the exact accepted Git commit. The host must not become the source of truth.

## Public artifact boundary

The public deployment may contain only deliberately public static assets such as `index.html`, `styles/**`, `scripts/**` and other explicitly approved public assets. It must never contain `api/**`, database credentials, provider API keys, authentication secrets, webhook secrets, payment credentials, private legal documents or production database connection strings.

## Backend plane

The secure Node.js backend remains an independent deployment plane. Its production provider must support Node.js 20+ or a compatible Docker runtime, `npm start` or the repository Docker entrypoint, HTTPS and custom hostname, encrypted environment secrets, persistent external PostgreSQL, migration execution before traffic, `/health` and `/ready`, application logs without credential/PII leakage, rollback without destructive database rollback, backup/restore, monitoring and ACME's M6 RPO/RTO requirements.

No backend provider is accepted for production until these capabilities are demonstrated.

## Database plane

Production persistence must use durable managed PostgreSQL or PostgreSQL-compatible managed storage with encrypted transport, encryption at rest, automated backups, tested restore, retention policy, access control, monitoring, documented RPO/RTO and migration/checksum compatibility with ACME's canonical migration engine. Ephemeral SQLite/filesystem persistence is prohibited for production.

## DNS policy

Do not change `acmesol.online` or any API hostname until both public and backend deployment acceptance is complete.

Target separation:

- public website: `acmesol.online` / `www.acmesol.online`;
- secure API: `api.acmesol.online`.

The public site must never receive backend credentials. Browser authentication and API traffic must use the secure API origin.

## GoDaddy policy

The existing GoDaddy Node.js application is not a production target and must not be published or connected to production DNS.

No GoDaddy Node.js Hosting plan is required for ACME.

The existing preview app may be retained temporarily for investigation, but it is outside the production architecture. Cleanup/deletion is a separate controlled task after confirming no required evidence or data remains there.

## Acceptance gates

1. Verify provider commercial/acceptable-use terms.
2. Verify GitHub integration or deterministic GitHub Actions deployment.
3. Verify exact-commit deployment provenance.
4. Verify preview/staging deployment.
5. Verify HTTPS/custom domain support.
6. Verify secrets handling.
7. Verify backend runtime compatibility where applicable.
8. Verify durable PostgreSQL.
9. Verify object-storage/provider integrations.
10. Verify backup/restore.
11. Verify RPO/RTO.
12. Verify `/health` and `/ready`.
13. Run authenticated E2E acceptance.
14. Inspect logs for credentials and unnecessary PII.
15. Only then approve DNS changes.

## Current status

- GitHub source of truth: **accepted**.
- GitHub Pages as ACME production host: **rejected** for commercial production use.
- Cloudflare Pages as public-host candidate: **candidate, not yet accepted**.
- Backend provider: **not yet selected**.
- Production PostgreSQL provider: **not yet selected**.
- DNS: **unchanged**.
- GoDaddy production deployment: **prohibited**.

## Required release evidence

Record the accepted Git commit, public-host deployment ID/URL, backend deployment ID/URL, database migration evidence, `/health` and `/ready` results, backup/restore evidence, RPO/RTO evidence, authenticated E2E results, HTTPS status and confirmation that no secrets or private data entered the public artifact.
