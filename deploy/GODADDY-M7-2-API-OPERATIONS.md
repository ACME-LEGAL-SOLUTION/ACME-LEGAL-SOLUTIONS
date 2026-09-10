# GoDaddy M7-2 API Operations Runbook

## Purpose

This runbook is the execution companion for `GODADDY-NODEJS-HOSTING.md`. It uses GoDaddy's Node.js Hosting API/CLI only after the ACME release commit has passed repository CI.

## Security boundary

Never place a GoDaddy PAT, database password, provider credential, signing secret, or ACME adapter secret in Git, this repository, command arguments, workflow logs, or documentation.

GoDaddy's Node.js Hosting API authenticates with a Personal Access Token and supports granular scopes. Use the minimum scopes required for the operation. Secret values are not returned by the secrets API.

Recommended deployment scopes are limited to the required app read/create/update permissions, code write, deployment execute, secrets write, and logs read. Do not grant delete unless destructive app lifecycle operations are explicitly required.

## Preflight

Record these values outside the repository:

- accepted ACME Git commit SHA
- GoDaddy app ID
- preview URL
- publish URL after production acceptance
- database identifier/host metadata (never credentials)
- deployment ID

The accepted repository release must be verified before any publish action.

## CLI authentication

GoDaddy provides the `gddy` CLI. Authenticate interactively with:

```text
gddy auth login
gddy auth status
```

For non-interactive environments, use a PAT through the CLI credential mechanism or the supported `GDDY_PAT` environment variable. Never echo the token.

Inspect the installed command tree before executing hosting operations because CLI command syntax evolves independently:

```text
gddy hosting nodejs --help
gddy tree
```

## API deployment lifecycle

The Node.js Hosting API is asynchronous for long-running writes. Do not treat an accepted request as a completed deployment.

### 1. Discover existing apps

Use the Node.js Hosting apps read operation and identify the intended ACME app. Do not create a second production app when an existing app is already the accepted target.

### 2. Create only when required

Creating an app returns a job. Poll the app job until the app reaches a terminal success state before continuing.

### 3. Connect GitHub / select source

Use the managed GitHub connection where available. The production branch is `main`, but only deploy after the target commit has passed ACME CI.

### 4. Preview first

Use the `preview` variant for all first deployments and configuration changes. Never publish merely because source upload succeeded.

### 5. Configure secrets

Configure the preview secrets required for the application to boot:

```text
ACME_ENV=production
ACME_AUTH_MODULE=<provider module reference>
ACME_OBJECT_STORAGE_MODULE=<provider module reference>
ACME_AI_PROVIDER_MODULE=<provider module reference>
ACME_PAYMENT_PROVIDER_MODULE=<provider module reference>
ACME_MESSAGING_PROVIDER_MODULE=<provider module reference>
```

Add persistence connection settings using the GoDaddy secret facility or the approved external persistence provider. Do not commit the values.

### 6. Verify preview runtime

Require all of the following before considering preview accepted:

- application starts successfully
- `/health` returns HTTP 200
- `/ready` returns HTTP 200
- migrations are applied and checksum-verified
- no credentials or sensitive legal payloads appear in build/runtime logs

### 7. Run E2E acceptance

Execute against non-production/test records:

- authentication and identity normalization
- client/professional/admin RBAC
- matter authorization
- document/object-storage authorization
- work-package human approval gates
- legal-source provenance
- AI provider/tool policy boundary
- payment idempotency/webhook/reconciliation
- messaging authorization/idempotency/retry/webhook audit
- retention/legal hold/export/backup governance

### 8. Inspect deployment status

A successful deployment record must identify the expected Git commit. If the deployed commit does not equal the accepted ACME release SHA, stop publication.

### 9. Inspect logs

Read preview logs and reject the deployment if logs expose:

- passwords
- PATs
- API keys
- access/refresh tokens
- webhook secrets
- payment credentials
- customer document contents
- unnecessary PII

### 10. Publish

Publish only after every acceptance gate is green. The publish operation deploys the latest uploaded source; therefore verify the source/deployment record immediately before invoking publish.

### 11. Post-publish validation

Record:

- published deployment ID
- deployed Git commit hash
- production status
- production URL
- HTTPS result
- `/health` result
- `/ready` result
- authentication smoke result
- critical E2E result
- runtime log inspection result

## Failure handling

If an asynchronous create/upload/deployment job fails:

1. capture the job/deployment ID
2. inspect the reported failure stage
3. inspect relevant logs
4. fix the repository or configuration
5. redeploy the corrected commit

Do not repeatedly resubmit a write without checking its current state.

If a deployment is unhealthy, keep the previous accepted production deployment in place where possible. Never destructively roll back database migrations.

## Publish gate

Publication is prohibited when any of these are unresolved:

- CI failure
- wrong Git commit
- migration/checksum mismatch
- `/health` failure
- `/ready` failure
- missing production adapter
- failed identity/RBAC test
- failed matter authorization
- failed object storage authorization
- failed AI policy boundary
- failed payment verification/idempotency
- failed messaging verification/idempotency
- backup/restore not demonstrated
- RPO/RTO not measured
- sensitive data exposed in logs
- HTTPS/custom-domain acceptance incomplete

## Evidence package

The final M7-2 acceptance record must contain objective evidence rather than screenshots alone:

- repository commit SHA
- GoDaddy app/deployment IDs
- deployment status
- migration verification output
- health/readiness responses
- E2E result summary
- log inspection result
- backup/restore evidence
- measured RPO/RTO
- domain/HTTPS evidence
- rollback reference

This runbook intentionally contains no real credentials or customer data.
