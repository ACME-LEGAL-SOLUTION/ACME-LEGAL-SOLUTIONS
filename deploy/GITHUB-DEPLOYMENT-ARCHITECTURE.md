# ACME GitHub Deployment Architecture

## Decision

The GoDaddy Node.js Hosting path is no longer the ACME deployment target.

GitHub remains the source of truth, CI/CD control plane and release authority. The public static experience must use a commercially suitable static hosting/CDN service with GitHub integration; GitHub Pages is not the ACME production target because GitHub's current Pages limitations do not permit using Pages as free web hosting for an online business or commercial SaaS.

Cloudflare Pages is the current public-host candidate because it supports GitHub integration, automatic deployments, pull-request previews, custom domains and static HTML. It remains replaceable and is not production-accepted until provider, account, security and DNS acceptance are completed.

The secure Node.js API, persistence, object storage, AI, payments, messaging, secrets and governance services remain separate server-side components.

## Target topology

```text
                         GitHub
             ACME-LEGAL-SOLUTION/ACME-LEGAL-SOLUTIONS
                              |
                    push to main / PR validation
                              |
                         GitHub Actions
                              |
                +-------------+-------------+
                |                           |
                v                           v
      Commercial Static Host             Node.js API
      (Cloudflare candidate)             external runtime
      Public HTML/CSS/JS                 /health /ready /api/*
                |                           |
                | HTTPS                     +-------------------+
                v                           |                   |
       acmesol.online                       v                   v
                                   PostgreSQL          provider boundaries
                                   persistent DB       object/AI/payment/
                                                       messaging/secrets
```

## Public deployment plane

The public host receives only deliberately public assets:

- `index.html`
- `styles/**`
- `scripts/**`
- explicitly approved static assets

It must never receive `api/**`, production credentials, provider tokens, database passwords, webhook secrets, payment credentials, private legal documents or other server-side application data.

The public host must deploy the exact accepted Git commit and must not become the source of truth.

## Backend deployment plane

GitHub Pages cannot execute the ACME Node.js API, so the API remains an independent Node.js web-service deployment.

The current server exposes `npm start` as `node api/runtime/http-server.js` and the repository includes a Docker deployment artifact. The backend provider therefore remains replaceable between a conventional Node.js runtime and Docker-compatible infrastructure.

Production acceptance requires persistent storage, secret management, backups, TLS, monitoring, RPO/RTO compliance and all provider capabilities required by M6.

## Database target

Production persistence must be an external durable managed PostgreSQL-compatible database. The repository migration engine and SQL adapter remain the canonical database contract.

Do not use a free/ephemeral SQLite filesystem as production persistence. Production acceptance requires migration/checksum compatibility, backup/restore, access controls, encryption and demonstrated RPO/RTO.

## Domains

Target separation:

- public website: `acmesol.online` / `www.acmesol.online`
- secure API: `api.acmesol.online`

Do not change DNS until the public deployment and backend have both passed acceptance.

## Deployment flow

1. Pull request runs the ACME test suite and production package validation.
2. Merge to `main`.
3. GitHub remains the release source of truth.
4. Public host deploys only the approved public artifact from the accepted commit.
5. Backend runtime deploys the same accepted commit.
6. Backend migrations run against the production database before traffic is accepted.
7. `/health` returns 200.
8. `/ready` returns 200 only when all required production adapters and persistence checks pass.
9. Auth/RBAC, matter authorization, object storage, AI, payment, messaging, retention/backup and audit E2E acceptance runs against the backend.
10. Only after all gates are green should the custom domain be switched to the accepted public site.

## GitHub role

GitHub is the authoritative control plane for source, review, CI, release commits and deployment provenance. A public hosting provider must not require the repository to become a mirror of provider-managed source.

## GoDaddy decommissioning rule

The existing GoDaddy Node.js app `am929rg5lx` is a deployment experiment only. It must not be published, connected to production DNS, or used as the ACME production runtime.

Do not purchase a GoDaddy Node.js Hosting plan for ACME.

Once the replacement public/backend deployment has passed acceptance and no GoDaddy data needs to be retained, the unused GoDaddy preview app can be deleted separately as a cleanup task.

## Acceptance evidence

Record:

- accepted Git commit SHA
- public-host deployment ID/URL
- public-host HTTPS/custom-domain status
- backend deployment ID and commit SHA
- backend `/health` and `/ready` responses
- migration versions/checksums
- provider adapter acceptance results
- backup/restore and RPO/RTO evidence
- authenticated E2E results
- confirmation that no secrets or private server-side files entered the public artifact

## Hard stop conditions

Stop deployment if:

- the public artifact contains server-side application files or secrets;
- the selected public host's terms are incompatible with ACME's commercial use;
- the backend is configured without a production identity adapter;
- persistence is ephemeral or migration checksums do not match;
- `/ready` reports not ready;
- provider credentials are placed in Git or client-side JavaScript;
- DNS is changed before application acceptance;
- the GoDaddy app is proposed as the production runtime;
- production data would depend on a free/ephemeral service that cannot satisfy ACME's retention, backup and RPO/RTO requirements.
