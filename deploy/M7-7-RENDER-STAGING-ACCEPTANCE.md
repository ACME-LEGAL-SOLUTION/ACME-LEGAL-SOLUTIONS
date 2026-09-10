# M7-7 Render Staging Acceptance

## Objective

Create and accept an isolated, non-production Render environment for ACME before any production infrastructure or DNS cutover.

This document is an acceptance runbook, not an infrastructure authorization. It contains no provider credentials and no production connection details.

## Provider model

- GitHub: source of truth and CI authority.
- Render Web Service: backend staging candidate.
- Render PostgreSQL: staging database candidate.
- Cloudflare Pages: separate public static-plane candidate; not part of this backend acceptance.

Render supports separate project environments so staging and production services can have environment-specific variables and credentials. Use a dedicated `staging` environment so staging credentials cannot accidentally be shared with production. citeturn0search9

## Required Render configuration

Create a Render project with a dedicated **Staging** environment.

### Backend service

Repository:

`ACME-LEGAL-SOLUTION/ACME-LEGAL-SOLUTIONS`

Branch:

`main`

Service type:

`Web Service`

Build command:

`npm install`

Start command:

`npm start`

Health-check path:

`/health`

Auto-deploy:

**After CI Checks Pass**.

Render can wait for GitHub Actions checks before deploying a linked branch; a failed check prevents the automatic deploy. citeturn0search0

### Database

Create a dedicated non-production Render PostgreSQL instance in the same staging environment.

Do not connect staging to any production database.

## Exact-commit acceptance

The accepted source commit for the first staging deployment must be the M7-6 merge commit:

`870390cf34dd29698868bc31d2a2b10e1836c8e1`

Acceptance must record:

- Render service ID;
- Render deployment ID;
- Git commit SHA reported by Render;
- deployment timestamp;
- staging hostname;
- PostgreSQL instance ID;
- database migration state.

If Render deploys a different commit, stop and correct the source configuration before testing application behavior.

## Environment and secret boundary

Configure environment variables only through Render's encrypted environment facility. Do not commit values to Git.

Required staging configuration includes:

- `ACME_ENV=production` for exercising the production security boundary in the isolated staging environment;
- `ACME_AUTH_MODULE` pointing to a dedicated staging authentication adapter;
- `ACME_OBJECT_STORAGE_MODULE` pointing to isolated staging object storage;
- `ACME_AI_PROVIDER_MODULE` pointing to a staging/test AI provider;
- `ACME_PAYMENT_PROVIDER_MODULE` pointing to a sandbox payment provider;
- `ACME_MESSAGING_PROVIDER_MODULE` pointing to staging/sandbox delivery providers;
- staging PostgreSQL connection information;
- any credentials required by the staging adapters.

Never place these values in GitHub source, static assets, command-line arguments, screenshots or documentation.

Render documents environment variables as the mechanism for runtime configuration and secret credentials, and explicitly warns against committing secret credentials to `render.yaml`. citeturn0search1

## Database acceptance

After PostgreSQL is available:

1. obtain the staging connection information through Render's secret/environment facility;
2. establish TLS connectivity;
3. run the ACME canonical migration engine;
4. verify every migration version against `migration-manifest.json`;
5. verify every migration checksum against its canonical schema source;
6. verify required tables and indexes;
7. specifically verify `work_packages`, `messages`, legal-source governance fields and payment governance fields;
8. run the real PostgreSQL integration suite;
9. capture migration output without exposing credentials.

No destructive down-migration is permitted as a normal rollback mechanism.

## Health acceptance

### `/health`

Must return HTTP 200 with the established ACME health response.

### `/ready`

Must not be accepted merely because the process is alive. Confirm that the production-readiness boundary sees all required provider modules and the staging persistence dependency as available.

Expected outcome:

- HTTP 200;
- readiness status `ready`;
- no secret values in the response;
- no provider credential leakage in logs.

## Security acceptance

Run authenticated staging tests for:

### Identity

- valid client identity;
- valid human professional identity;
- malformed identity rejection;
- unsupported role rejection;
- non-human professional rejection;
- production authentication fail-closed behavior when adapter is absent.

### Matter authorization

- client can access only its own matter;
- assigned professional can access only assigned matter;
- unauthorized matter access is denied;
- admin access follows the defined policy;
- non-human professional access is denied.

### Documents/object storage

- matter-scoped object keys;
- authorized upload;
- authorized retrieval;
- unauthorized retrieval denied;
- checksum verification;
- object deletion authorization.

### Work packages

- package creation;
- review transition;
- unauthorized approval rejected;
- human professional approval accepted;
- unauthorized finalization rejected;
- human finalization accepted;
- provenance and audit records persisted.

## Provider-boundary acceptance

### AI

Verify:

- provider adapter loads;
- allowed model enforcement;
- allowed tool enforcement;
- task/context limits;
- timeout handling;
- request scoping;
- no unauthorized tool invocation.

### Payments

Use sandbox provider credentials only.

Verify:

- idempotency;
- webhook signature verification;
- provider event binding;
- duplicate event handling;
- overpayment prevention;
- reconciliation;
- billing audit safety.

### Messaging

Use sandbox/staging delivery only.

Verify:

- email channel governance;
- WhatsApp channel governance;
- authorization;
- idempotency;
- retry limits;
- signed webhook verification;
- provider message binding;
- PII-safe audit output.

## Backup and recovery acceptance

The staging PostgreSQL environment must be used to validate the recovery procedure before production is considered.

Render's paid PostgreSQL service provides continuous PITR. Current documented recovery windows are 3 days for Hobby workspaces and 7 days for Pro or higher; free instances do not provide PITR. citeturn0search4turn0search5

For staging:

1. create representative non-sensitive test data;
2. capture a logical backup/export where available;
3. perform a controlled recovery test;
4. restore into an isolated recovery instance;
5. verify migration/schema state;
6. verify representative records;
7. verify application connectivity against the recovery database;
8. record elapsed recovery time;
9. document the resulting RPO/RTO evidence.

Do not use real client/legal data for this exercise.

## Log-safety acceptance

Review staging logs for:

- passwords;
- database URLs containing credentials;
- API keys;
- bearer tokens;
- webhook secrets;
- payment credentials;
- private object-storage credentials;
- legal-document contents;
- unnecessary personal information.

Any secret or sensitive-data leakage is a blocking failure.

## Evidence package

M7-7 cannot be marked accepted until the following evidence exists:

- Render project/environment identifier;
- staging service identifier;
- staging database identifier;
- exact Git commit deployed;
- deployment identifier;
- `/health` result;
- `/ready` result;
- migration versions/checksums;
- PostgreSQL integration result;
- authentication/RBAC result;
- matter-isolation result;
- object-storage result;
- work-package human-gate result;
- AI result;
- payment sandbox result;
- messaging sandbox result;
- backup/recovery result;
- RPO/RTO measurement;
- log-safety review;
- no-DNS-change confirmation.

## Stop conditions

Stop immediately if:

- staging connects to production data;
- staging credentials overlap production credentials;
- the deployed commit differs from the accepted SHA;
- `/ready` is healthy without required dependencies;
- migrations/checksums differ;
- any provider boundary is bypassed;
- real payment/messaging delivery is accidentally enabled;
- any secret appears in logs or source;
- recovery cannot be demonstrated;
- DNS or production traffic would need to change to continue staging acceptance.

## Current state

| Gate | Status |
|---|---|
| M7-6 provider selection | Accepted |
| M7-6 merge commit | `870390cf34dd29698868bc31d2a2b10e1836c8e1` |
| Render connection | Pending external account connection |
| Staging PostgreSQL | Not created |
| Staging backend | Not created |
| Secrets | Not configured |
| DNS | Unchanged |
| Production data | Not permitted |
| M7-7 acceptance | Blocked until Render connection/infrastructure exists |

## References

- Render deploys and CI-gated auto-deploy: https://render.com/docs/deploys
- Render environment variables and secrets: https://render.com/docs/configure-environment-variables
- Render projects and environments: https://render.com/docs/projects
- Render PostgreSQL: https://render.com/docs/postgresql
- Render PostgreSQL recovery/backups: https://render.com/docs/postgresql-backups
