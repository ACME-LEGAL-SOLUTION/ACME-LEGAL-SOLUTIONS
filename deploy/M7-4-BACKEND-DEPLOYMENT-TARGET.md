# M7-4 Backend Deployment Target

## Decision

ACME has two separate deployment planes:

1. **Public experience:** GitHub Pages.
2. **Secure backend:** an external Node.js web-service runtime connected to the same GitHub repository.

GitHub remains the source of truth and release authority. GitHub Pages is not the backend runtime and must never receive production secrets, database credentials, provider credentials, private documents, or server-side code.

The backend target is deliberately **provider-neutral at the application boundary**. The first reference implementation is a conventional Docker-capable Node.js web service with managed PostgreSQL. The application must remain deployable from its existing Dockerfile or `npm start` contract without provider-specific application code.

## Reference provider profile

A managed Node.js service such as Render is an acceptable reference implementation because it can deploy a Node.js service from the Git repository or a Docker image, provides environment variables/secrets, custom domains/TLS, health checks, deploy/rollback controls, and managed PostgreSQL. Render is a deployment option, not an architectural dependency.

No Render account, GoDaddy plan, or other provider account is required to merge this architecture decision. Provider provisioning is a later acceptance task.

## Why GitHub Pages alone is insufficient

GitHub Pages is a static hosting service. It publishes HTML/CSS/JavaScript and does not execute the ACME Node.js API. Therefore a production architecture consisting only of GitHub Pages would leave authentication, matter authorization, persistence, payments, messaging, AI, object storage and governance without a runtime.

The Pages workflow must therefore remain limited to the public artifact while the API is deployed independently.

## Required backend contract

Any production backend provider MUST support all of the following:

### Runtime

- Node.js 20+ compatibility.
- `npm start` support or Docker support.
- HTTP binding through the platform `PORT` environment variable.
- Public HTTPS endpoint for the API.
- Graceful restart/deploy behavior.
- Health-check endpoint support.

### Application configuration

- Secure environment variables/secrets.
- No secrets committed to Git.
- No secrets exposed to browser JavaScript.
- Separate preview/staging and production configuration.
- Ability to rotate provider credentials without source-code changes.

### Persistence

- Durable PostgreSQL-compatible production database.
- TLS database connections.
- Connection-string secret management.
- ACME migration engine execution before accepting traffic.
- Migration checksum verification.
- Backup and restore capability.
- Ability to export the database in a portable PostgreSQL format.

### Operations

- Deployment status and deployment identity.
- Runtime logs.
- Health/readiness checks.
- HTTPS/custom-domain support.
- Rollback to a previously accepted application build.
- Monitoring sufficient to detect failed deployments and runtime outages.

### Disaster recovery

The production provider must demonstrate the M6 governance contract:

- RPO target: 900 seconds or better.
- RTO target: 3600 seconds or better.
- Tested database restore.
- Tested application recovery.
- External/portable backup strategy where provider-native retention is insufficient.
- No destructive database migration rollback.

## Provider comparison

| Capability | GitHub Pages | GoDaddy Node.js Hosting | Managed Node.js PaaS / Render reference |
|---|---|---|---|
| Public static site | Yes | Yes | Yes, but not required |
| Node.js API | No | Yes | Yes |
| GitHub-connected deployment | Yes | Yes | Yes |
| Environment secrets | Pages workflow/environment controls | Yes | Yes |
| Managed PostgreSQL | No | Account/platform dependent | Yes |
| Docker portability | N/A for Pages runtime | Platform-specific | Yes |
| Custom API hostname | DNS + Pages for site | Yes | Yes |
| Backend rollback | Workflow artifact rollback | Platform-specific | Yes |
| Production DR acceptance | Must be external | Must be proven | Can be built around managed DB + external backups |
| Vendor lock-in | Low | Higher | Low-to-moderate when Docker/external DB/provider adapters are used |
| ACME fit | Public site only | Not selected | Backend reference target |

## Target topology

```text
                          GitHub
                source + CI + release authority
                           |
             +-------------+-------------+
             |                           |
             v                           v
      GitHub Pages                 Backend deploy
      public HTML/CSS/JS           Node.js service
             |                           |
             |                           +---------------------+
             |                           |          |          |
             |                           v          v          v
             |                       PostgreSQL  Object     Provider
             |                       production  Storage    adapters
             |                                   AI/payment/
             |                                   messaging/etc.
             v
       acmesol.online

                              api.acmesol.online
```

## Repository portability requirements

The application MUST NOT introduce provider-specific imports into core runtime code merely to deploy the backend.

Provider integration belongs behind existing ACME boundaries:

- `ACME_AUTH_MODULE`
- `ACME_OBJECT_STORAGE_MODULE`
- `ACME_AI_PROVIDER_MODULE`
- `ACME_PAYMENT_PROVIDER_MODULE`
- `ACME_MESSAGING_PROVIDER_MODULE`
- `ACME_SECRET_PROVIDER_MODULE`

The deployment platform supplies configuration; the application remains portable.

The Docker image remains a portable fallback even when the selected PaaS deploys directly from GitHub. The image must continue to boot with:

```text
node api/runtime/http-server.js
```

and must continue to expose `/health` and `/ready`.

## Production acceptance gate

The backend is NOT production-approved merely because the provider can start Node.js.

Before production traffic is enabled, record objective evidence for:

1. accepted Git commit SHA;
2. backend deployment ID;
3. Node.js runtime version;
4. `/health` = HTTP 200;
5. `/ready` = HTTP 200;
6. migration versions and checksums;
7. authentication/RBAC acceptance;
8. matter-authorization acceptance;
9. object-storage authorization;
10. AI/tool security boundary;
11. payment idempotency/webhook verification/reconciliation;
12. messaging idempotency/webhook verification/retry;
13. retention/legal-hold/export governance;
14. backup verification and restore test;
15. measured RPO/RTO;
16. runtime log inspection;
17. HTTPS/custom API domain;
18. rollback test or documented rollback evidence.

## Cost policy

A free tier may be used for development or preview when its limitations are acceptable.

A free or ephemeral service MUST NOT be treated as production if it cannot satisfy ACME's persistence, backup, recovery, security, availability or RPO/RTO requirements.

For example, a provider's free PostgreSQL offering must not become the production database merely because it is available at zero cost. Production database durability and recovery are hard requirements.

## DNS policy

Do not change production DNS during this task.

The intended split is:

- `acmesol.online` → GitHub Pages public experience.
- `api.acmesol.online` → selected backend runtime.

DNS changes occur only after both planes have passed acceptance.

## GoDaddy status

The existing GoDaddy app is explicitly **not** the ACME production target.

Do not:

- purchase a GoDaddy Node.js Hosting plan for ACME;
- publish the existing GoDaddy preview app;
- connect production DNS to the GoDaddy app;
- put production secrets into that app;
- make application architecture depend on GoDaddy APIs.

The existing GoDaddy preview can be cleaned up later after confirming that no retained data or deployment evidence is required.

## M7-4 completion definition

M7-4 is complete when:

- GitHub Pages is established as the public deployment plane;
- the backend is defined as an independent Node.js deployment plane;
- PostgreSQL is explicitly external and durable;
- provider-specific functionality remains behind ACME adapter boundaries;
- Docker remains a portable backend deployment artifact;
- production acceptance gates include migrations, readiness, security, backup/restore and RPO/RTO;
- no GoDaddy dependency remains in the target architecture.

Provider provisioning and live backend acceptance are intentionally separate tasks. They must not be represented as complete by this architecture document alone.
