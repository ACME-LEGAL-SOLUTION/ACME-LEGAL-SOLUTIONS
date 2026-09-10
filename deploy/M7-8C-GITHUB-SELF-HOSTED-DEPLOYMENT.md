# M7-8C — GitHub-Controlled Zero-Budget Self-Hosted Deployment

## Decision

ACME production remains GitHub-controlled but does not use GitHub Pages, Codespaces, or a paid managed runtime as the application server.

The zero-budget target is:

```text
GitHub repository
      |
      +--> GitHub Actions CI / release authority
      |
      +--> Cloudflare Pages (public static frontend, when provisioned)
      |
      +--> self-hosted GitHub Actions runner on the existing ACME host
                    |
                    +--> Node.js API
                    +--> PostgreSQL
                    +--> local object/backup storage
                    +--> cloudflared outbound tunnel
```

Incremental infrastructure cost target: **$0**.

## Security boundary

The self-hosted runner is a deployment control plane, not a general-purpose development machine. It must be dedicated to ACME and protected as production infrastructure.

Do not put production credentials in GitHub repository files, workflow YAML, command arguments, logs, or committed `.env` files. Production secrets remain in the host's protected environment/secret mechanism and provider-specific modules.

Do not expose PostgreSQL (`5432`) or the Node.js origin (`3000`) directly to the Internet. Public API ingress is through the approved Cloudflare Tunnel boundary after its acceptance gates pass.

## Release flow

1. Developer changes are pushed to GitHub.
2. GitHub Actions runs the normal CI and real-database acceptance suite.
3. A production deployment is manually approved/triggered only after CI is green.
4. The self-hosted runner checks out the selected immutable Git ref.
5. Dependencies are installed with `npm ci --omit=dev`.
6. Application tests run before the service is restarted.
7. The deployment script starts/restarts the Windows Scheduled Task for the API.
8. `/health` is checked locally.
9. `/ready` must report ready before deployment is considered successful.
10. The deployment records the Git SHA, timestamp, health/readiness result, and host identity in the deployment log without recording secrets.

## Host requirements before acceptance

M7-8C cannot accept the host merely because the deployment script exists. The physical host must first pass the M7-8B inventory and the remaining zero-budget gates:

- supported Windows version and adequate CPU/RAM/disk
- Node.js >= 20 and npm
- PostgreSQL installed and locally reachable
- PostgreSQL `5432` not publicly exposed
- ACME API `3000` not publicly exposed
- dedicated persistent storage with adequate free space
- tested PostgreSQL backup and restore
- measured RPO <= 900 seconds and RTO <= 3600 seconds, or a formally approved exception
- automatic service recovery after process failure and Windows reboot
- Cloudflare Tunnel client installed and restartable
- Windows firewall enabled with least-privilege rules
- host account/runner protected and dedicated
- no production secrets committed to GitHub

## Rollback

Rollback is a Git release rollback, not a destructive database rollback.

The previous accepted application SHA must remain available. Database migrations must be backward-compatible with the rollback strategy or the release must be stopped before production migration.

## Stop conditions

Stop and do not publish production if any of these are true:

- the host requires paid infrastructure to satisfy the acceptance gates;
- PostgreSQL backup/restore has not been tested;
- RPO/RTO cannot be demonstrated;
- `5432` or `3000` is Internet-exposed;
- the runner is shared with untrusted workloads;
- production secrets would have to be placed in GitHub source or logs;
- `/ready` is not ready after deployment;
- CI is not green for the exact release SHA.

## Current status

- GitHub source of truth: accepted.
- GitHub Actions CI: accepted.
- GitHub Pages production: rejected for ACME commercial use.
- Render paid PostgreSQL: rejected under the zero-budget constraint.
- Existing host runtime: **pending physical-host acceptance**.
- Cloudflare Pages: candidate, not provisioned.
- Cloudflare Tunnel: candidate, not provisioned.
- Production DNS: unchanged.
- Production data migration: not authorized by this work package.
