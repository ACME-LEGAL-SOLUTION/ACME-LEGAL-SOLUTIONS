# M7-2 GoDaddy Infrastructure Preflight

## Purpose

This document is the execution gate for moving ACME from repository-side production acceptance to a real GoDaddy-hosted production environment. It contains no credentials, private keys, customer data, or provider secrets.

## Current repository gate

- Release commit: `465883ab8d230d1759fa8c25804d7bccedf12164`
- Production container workflow: accepted
- Application CI: accepted
- Four real database migration integrations: accepted
- Live infrastructure: **not yet accepted**

## Required GoDaddy infrastructure inputs

Before deployment, obtain from the GoDaddy account/server:

1. Hosting product: VPS / dedicated / other.
2. Linux distribution and version if VPS/dedicated.
3. Server public IPv4 and, if enabled, IPv6.
4. SSH/admin access method.
5. Domain name and authoritative DNS provider.
6. Existing A/AAAA/CNAME/MX/TXT/CAA records that must not be disrupted.
7. Production database endpoint, database name, TLS mode, and credentials supplied through the secret facility.
8. Production secret/adaptor modules for:
   - `ACME_AUTH_MODULE`
   - `ACME_OBJECT_STORAGE_MODULE`
   - `ACME_AI_PROVIDER_MODULE`
   - `ACME_PAYMENT_PROVIDER_MODULE`
   - `ACME_MESSAGING_PROVIDER_MODULE`

## GoDaddy DNS gate

If GoDaddy is authoritative for the domain, configure only the records required for the release and preserve existing mail/service records. GoDaddy documents A/AAAA/CNAME records for routing and notes that DNS propagation can take up to 48 hours. Do not change nameservers unless the complete replacement zone is prepared and approved.

## Server gate

For a Linux VPS deployment:

- SSH access works.
- Administrative access is available for initial provisioning.
- Docker Engine is installed and trusted.
- Firewall exposes only required public services, normally HTTPS and SSH administration as separately controlled.
- Application origin port `3000` is not publicly exposed when firewalling permits.
- Reverse proxy terminates TLS and forwards to the application container.
- Server time synchronization is enabled.
- Disk capacity is sufficient for the image, logs, temporary files, and operational headroom.

## Deployment gate

1. Pull/build the exact accepted release commit.
2. Inject production secrets through the host secret mechanism.
3. Verify the production adapter modules are loadable without printing their secrets.
4. Run migrations against the persistent production database.
5. Start the application container.
6. Verify `/health` returns HTTP 200.
7. Verify `/ready` returns HTTP 200 and production persistence is healthy.
8. Enable HTTPS routing.
9. Verify TLS and security headers.
10. Execute authenticated E2E acceptance using non-production test records before production traffic.

## E2E acceptance

- Identity: actor normalization and role enforcement.
- Matter authorization: cross-matter access denied.
- Documents: authorized object put/get/delete only.
- AI: approved model/tool policy enforced; unauthorized tool rejected.
- Payments: webhook verification, idempotency, overpayment prevention, reconciliation.
- Messaging: email/WhatsApp delivery state machine, webhook verification, retry and PII-safe audit.
- Data governance: backup creation, verification, restore, legal hold and retention controls.

## Recovery gate

Production acceptance requires evidence for:

- verified backup
- successful restore exercise
- measured RPO
- measured RTO
- object-storage recovery
- rollback to the previous application release without destructive database migration rollback

## Stop conditions

Stop deployment if any of the following occurs:

- production adapter is missing or untrusted
- `/ready` is not healthy
- migration is incompatible or partially applied
- authentication/authorization boundary fails
- TLS is invalid
- sensitive data appears in logs/audit output
- backup/restore cannot be verified
- provider credentials would need to be committed to Git

## External reference

GoDaddy's current documentation confirms that VPS products support SSH/admin access and server setup, while DNS records are managed through the domain/DNS control plane when GoDaddy is authoritative.
