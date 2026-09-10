# ACME GitHub Deployment Architecture

## Decision

The GoDaddy Node.js Hosting path is no longer the ACME deployment target.

ACME will use GitHub as the source of truth and GitHub Pages as the hosting platform for the public static experience. The existing GoDaddy Node.js preview app is not part of the target architecture and must not be published or used as the production runtime.

GitHub Pages is a static hosting service. ACME's secure Node.js API, persistence, object storage, AI, payments, messaging, secrets and governance services therefore remain separate server-side components. GitHub Pages must never receive production credentials or private application data.

## Target topology

```text
                         GitHub
             ACME-LEGAL-SOLUTION/ACME-LEGAL-SOLUTIONS
                              |
                    push to main / PR validation
                              |
                    GitHub Actions CI + Pages
                              |
                +-------------+-------------+
                |                           |
                v                           v
       GitHub Pages                    Node.js API
       Public Experience              external runtime
       HTML/CSS/JS                    /health /ready /api/*
                |                           |
                | HTTPS                     +-------------------+
                |                           |                   |
                v                           v                   v
       acmesol.online                 PostgreSQL          provider boundaries
                                     persistent DB       object/AI/payment/
                                                         messaging/secrets
```

## What GitHub hosts

GitHub Pages hosts only the public website assets:

- `index.html`
- `styles/**`
- `scripts/**`

The Pages workflow deliberately stages only these public assets. It does not publish `api/**`, `docs/**`, deployment files, the Dockerfile, or other server-side repository content.

The repository is already structured for this split: the public root contains a static `index.html` and the Node.js API starts through `npm start` as `node api/runtime/http-server.js`.

## What GitHub does not host

GitHub Pages cannot execute the ACME Node.js API. The following remain server-side:

- identity/authentication adapters
- RBAC and matter authorization
- PostgreSQL persistence and migrations
- object storage
- AI provider and tool security
- payments and accounting reconciliation
- email/WhatsApp delivery
- secrets and key rotation
- retention, privacy, backup and disaster recovery

No secret, API credential, database password, provider token, webhook secret, or document content may be embedded in the Pages artifact.

## Backend runtime target

The backend runtime must be a Node.js web service connected to this repository. The current ACME server already exposes `npm start` and reads the platform `PORT` environment variable, so a conventional Node.js web-service runtime is the least disruptive target.

A free runtime may be used for development/preview only. It must not be treated as production merely because it has a free tier. Production acceptance requires persistent storage, secret management, backups, TLS, monitoring, RPO/RTO compliance and the provider capabilities required by M6.

The backend provider remains replaceable behind the existing provider boundaries. This keeps GitHub as the source of truth without coupling the application architecture to a hosting vendor.

## Database target

Production persistence must be an external managed PostgreSQL-compatible database. The repository's migration engine and SQL adapter remain the canonical database contract.

Do not use a free/ephemeral SQLite filesystem as production persistence. The application already supports PostgreSQL, MySQL, MariaDB and SQLite at the persistence boundary, but production acceptance requires a durable provider and the existing migration/checksum governance.

## Domains

The intended public website domain can be attached to GitHub Pages after the Pages deployment is accepted. DNS remains a DNS concern; changing nameservers is not required merely because the site is hosted on GitHub Pages.

The API should use a separate hostname, for example `api.acmesol.online`, so browser traffic to the public site and authenticated server traffic remain cleanly separated.

Do not change DNS until the GitHub Pages deployment is green and the API endpoint has passed its own acceptance tests.

## Deployment flow

1. Pull request runs the existing ACME test suite and production package validation.
2. Merge to `main`.
3. GitHub Pages workflow stages only public static assets.
4. GitHub Pages deploys the public artifact.
5. Backend runtime pulls the same `main` commit through its Git integration.
6. Backend deploy runs migrations against the production database before traffic is accepted.
7. `/health` must return 200.
8. `/ready` must return 200 only when all required production adapters and persistence checks pass.
9. Auth/RBAC, matter authorization, object storage, AI, payment, messaging, retention/backup and audit E2E acceptance runs against the backend.
10. Only after both public and backend gates are green should the custom domain be switched to the new public site.

## GitHub Pages configuration

In repository **Settings → Pages**:

- Source: **GitHub Actions**
- Do not use a branch-root deployment for this repository.
- The `github-pages` environment should be protected so only the intended deployment path can publish.

The workflow is `.github/workflows/github-pages.yml`.

## GoDaddy decommissioning rule

The existing GoDaddy Node.js app `am929rg5lx` is a deployment experiment only. It must not be published, connected to production DNS, or used as the ACME production runtime.

Do not purchase a GoDaddy Node.js Hosting plan for ACME.

Once GitHub Pages and the replacement backend have passed acceptance and no GoDaddy data needs to be retained, the unused GoDaddy preview app can be deleted separately as a cleanup task.

## Acceptance evidence

Record:

- Git commit SHA deployed to Pages
- GitHub Pages workflow run URL/status
- Pages URL and custom-domain HTTPS status
- backend deployment ID and commit SHA
- backend `/health` and `/ready` responses
- migration versions/checksums
- provider adapter acceptance results
- backup/restore and RPO/RTO evidence
- authenticated E2E results
- confirmation that no secrets or private server-side files entered the Pages artifact

## Hard stop conditions

Stop deployment if:

- the Pages artifact contains server-side application files or secrets;
- the backend is configured without a production identity adapter;
- persistence is ephemeral or migration checksums do not match;
- `/ready` reports not ready;
- provider credentials are placed in Git or client-side JavaScript;
- DNS is changed before application acceptance;
- the GoDaddy app is proposed as the production runtime;
- production data would depend on a free/ephemeral service that cannot satisfy ACME's retention, backup and RPO/RTO requirements.
