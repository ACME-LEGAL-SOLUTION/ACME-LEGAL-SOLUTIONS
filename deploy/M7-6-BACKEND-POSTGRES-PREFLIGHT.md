# M7-6 Backend + PostgreSQL Provider Selection & Preflight

## Decision

ACME's current production candidate is:

- **Public static plane:** Cloudflare Pages (candidate; not yet provisioned).
- **Backend plane:** Render Web Service (candidate; not yet provisioned).
- **Database plane:** Render Managed PostgreSQL on a paid plan (candidate; not yet provisioned).

This is a provider selection for the next acceptance stage, not a production deployment authorization. GitHub remains the source of truth and release authority. The application remains provider-neutral through its existing authentication, object-storage, AI, payment, messaging, secrets and persistence boundaries.

## Why Render is the backend/database candidate

Render supports Node.js web services connected directly to GitHub and supports `npm start` as the service start command. Render can deploy from a linked branch and can be configured to deploy only after GitHub CI checks pass. It also supports HTTP health checks, managed TLS, zero-downtime web-service deploys, environment secrets, managed PostgreSQL and point-in-time recovery.

Render's current documentation states that its platform is SOC 2 Type 2 and ISO 27001 compliant, with relevant compliance documents available to Pro workspaces and higher. Production acceptance still requires ACME to review the applicable terms, DPA, security documentation and account controls before processing production legal data.

## Why Cloudflare Pages remains the public-plane candidate

Cloudflare Pages supports GitHub integration, automatic deployments, pull-request previews and custom domains. Static asset requests are free and unlimited under the current Pages pricing model. It is therefore a suitable candidate for the deliberately public HTML/CSS/JS plane, while the secure API remains separate.

## Required production shape

```text
GitHub main
   |
   +--> Cloudflare Pages candidate
   |      public static assets only
   |
   +--> Render Web Service candidate
          Node.js API
          /health
          /ready
          /api/*
             |
             +--> Render Managed PostgreSQL candidate
             +--> object storage provider
             +--> AI provider
             +--> payment provider
             +--> messaging provider
             +--> secret provider
```

## Backend service preflight

Before creating the production service, verify:

1. Render account/workspace is appropriate for commercial production use.
2. Pro workspace or a higher plan is selected if required by the compliance/security evidence review.
3. Repository `ACME-LEGAL-SOLUTION/ACME-LEGAL-SOLUTIONS` is connected through the GitHub integration.
4. Production branch is `main`.
5. Auto-deploy policy is **After CI Checks Pass**, not blind deploy-on-push.
6. Build command is compatible with the repository package contract.
7. Start command is exactly `npm start`.
8. Node.js version satisfies the repository requirement (`>=20`).
9. Health check path is `/health`.
10. The service receives the platform `PORT` and does not hard-code a production port.
11. TLS/custom hostname capability is enabled.
12. Logs are reviewed for credentials, provider tokens, webhook secrets, passwords, payment data and unnecessary legal-document content.
13. No persistent disk is used for authoritative application state.
14. Production state is externalized to PostgreSQL and the existing provider boundaries.
15. Deployment provenance records the exact Git commit SHA.

## PostgreSQL preflight

Production PostgreSQL must satisfy all of the following:

- managed PostgreSQL;
- encrypted transport;
- encryption at rest;
- automated backups/PITR;
- tested restore procedure;
- access control and credential rotation;
- monitoring;
- retention policy;
- documented RPO/RTO;
- compatibility with ACME's migration engine;
- migration checksum verification before application traffic;
- no production dependence on SQLite or an ephemeral filesystem.

Render's current paid PostgreSQL offering provides continuous PITR. Current documented recovery windows are 3 days on Hobby and 7 days on Pro or higher. ACME production must use a paid configuration whose actual recovery window and backup controls are recorded during acceptance.

An additional logical backup/export mechanism should be configured for longer-term retention rather than relying solely on the provider's PITR window.

## ACME migration gate

The production database is not accepted merely because it is reachable.

The deployment must:

1. connect using the production secret facility;
2. run the canonical migration engine;
3. verify every manifest migration version;
4. verify every migration checksum against the canonical schema source;
5. verify required tables and indexes;
6. execute the real PostgreSQL integration suite where the environment permits;
7. record the resulting migration evidence;
8. only then permit `/ready` to become healthy.

No destructive down-migration is permitted as a routine rollback mechanism.

## Required production environment boundary

The following must be configured only through the backend provider's encrypted secret/environment facility:

- `ACME_ENV=production`
- `ACME_AUTH_MODULE`
- `ACME_OBJECT_STORAGE_MODULE`
- `ACME_AI_PROVIDER_MODULE`
- `ACME_PAYMENT_PROVIDER_MODULE`
- `ACME_MESSAGING_PROVIDER_MODULE`
- production database connection information
- any provider credentials required by those adapters

No secret may be placed in GitHub source, public static assets, client-side JavaScript, committed configuration, deployment documentation, or shell history.

## Acceptance sequence

### Gate A — Provider/account

- confirm Render commercial terms and applicable compliance documents;
- confirm billing/account ownership;
- confirm production region;
- confirm support/escalation path;
- confirm provider status and incident procedures.

### Gate B — Database

- create a non-production PostgreSQL instance first;
- validate TLS and connection behavior;
- run the canonical migration suite;
- validate backup/PITR and restore into an isolated recovery instance;
- record RPO/RTO evidence;
- validate credential rotation.

### Gate C — Backend preview

- connect the repository;
- deploy a preview/staging service;
- configure secrets through the provider UI/API only;
- deploy the exact accepted Git commit;
- validate `/health`;
- validate `/ready`;
- validate security headers;
- validate production authentication failure-closed behavior;
- validate matter authorization;
- validate object storage authorization;
- validate AI security boundary;
- validate payment webhook governance;
- validate messaging delivery governance;
- validate retention/backup governance.

### Gate D — End-to-end

Execute authenticated acceptance tests covering:

- identity and RBAC;
- client/matter isolation;
- document upload/retrieval;
- object-storage checksum and authorization;
- work-package human approval/finalization gates;
- legal-source provenance;
- AI provider/tool restrictions;
- payment idempotency/reconciliation;
- email/WhatsApp delivery and webhook verification;
- audit safety;
- retention/legal hold;
- backup/restore.

### Gate E — Production

Production is authorized only when all previous gates are green and the following evidence is recorded:

- accepted Git commit SHA;
- backend deployment ID;
- backend public hostname;
- database instance identifier;
- migration versions/checksums;
- `/health` result;
- `/ready` result;
- backup/restore evidence;
- RPO/RTO evidence;
- E2E results;
- log-safety review;
- TLS/custom-domain evidence.

DNS remains unchanged until the public and backend acceptance packages are complete.

## Current status

| Component | Status |
|---|---|
| GitHub source of truth | Accepted |
| Cloudflare Pages | Candidate only |
| Render backend | Candidate only |
| Render PostgreSQL | Candidate only |
| Production account/provider credentials | Not configured |
| Production database | Not created |
| Backend deployment | Not created |
| DNS | Unchanged |
| GoDaddy Node.js Hosting | Prohibited as production target |

## Stop conditions

Stop immediately if:

- provider terms are incompatible with commercial legal-service use;
- production data would rely on an ephemeral filesystem;
- PostgreSQL backups/PITR cannot satisfy the accepted RPO/RTO;
- migration checksums do not match;
- secrets would enter Git or client-side assets;
- `/ready` is healthy before production dependencies are actually accepted;
- provider deployment cannot prove the exact Git commit;
- a failed deployment would require destructive database rollback;
- DNS would need to change before backend and public-host acceptance.

## Evidence sources

Official provider documentation reviewed on 2026-09-10:

- Cloudflare Pages GitHub integration: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- Cloudflare Pages pricing: https://developers.cloudflare.com/pages/functions/pricing/
- Render pricing: https://render.com/pricing
- Render Node.js deployment: https://render.com/docs/deploy-node-express-app
- Render deployment/CI controls: https://render.com/docs/deploys
- Render health checks: https://render.com/docs/health-checks
- Render PostgreSQL: https://render.com/docs/postgresql
- Render PostgreSQL recovery/backups: https://render.com/docs/postgresql-backups
- Render compliance: https://render.com/docs/certifications-compliance
- Render TLS: https://render.com/docs/tls

These sources establish candidate capability only. They do not constitute production acceptance or authorization to create infrastructure.