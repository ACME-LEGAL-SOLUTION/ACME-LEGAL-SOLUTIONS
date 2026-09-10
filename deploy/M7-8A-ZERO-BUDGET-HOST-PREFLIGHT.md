# M7-8A Zero-Budget Host & Database Preflight

## Objective

Validate whether the existing user-controlled host can provide the ACME backend and PostgreSQL runtime without introducing paid infrastructure.

**Hard constraint:** incremental infrastructure spend must remain $0. No paid managed database, paid VPS, paid Render plan, or credit-card-dependent free-tier assumption is accepted.

## Target shape

```text
GitHub
  |
  +--> Cloudflare Pages (public static plane)
  |
  +--> CI/release
          |
          v
     Existing ACME host
       |       |
       |       +--> PostgreSQL
       +----------> Node.js API
       |
       +--> cloudflared
              |
              v
       Cloudflare Tunnel
```

Cloudflare Tunnel is available on all Cloudflare plans and uses an outbound-only connection, so the origin does not require an exposed inbound application port. The production tunnel requires a Cloudflare account, domain, and a server/VM running `cloudflared`; quick tunnels are development-only. Cloudflare Pages static assets are free/unlimited, with a 500-build/month Free-plan limit. [Official sources reviewed 2026-09-10.]

## Gate A — Host inventory

Record and verify on the actual host:

- OS and exact version
- CPU model and logical cores
- installed RAM and available RAM
- system drive free space
- dedicated ACME runtime drive/path
- dedicated ACME persistent-data drive/path
- filesystem type
- available free space for PostgreSQL
- network adapter and LAN/WAN topology
- internet upload/download capability
- power-loss/reboot behavior
- Windows/Linux service-manager capability
- Node.js version
- npm version
- PostgreSQL version or installation state
- `cloudflared` installation state
- available backup destination

No acceptance may be inferred from historical machine information; the current host must be measured.

## Gate B — Storage separation

The authoritative PostgreSQL data directory, ACME application runtime, logs, backups and generated legal artifacts must have explicit paths.

Do not place persistent ACME data into the operating-system drive merely because it is the default location.

The deployment must prove:

1. PostgreSQL data survives API restart.
2. PostgreSQL data survives machine restart.
3. application deployment does not overwrite database data.
4. backup files are stored separately from the live database.
5. free-space thresholds are monitored.

## Gate C — PostgreSQL

Install/use the current supported PostgreSQL release compatible with ACME's driver and migration suite.

Acceptance requires:

- local-only database listener unless an explicit private-network requirement exists;
- non-superuser application role;
- separate backup role where practical;
- password authentication;
- TLS for any non-local database connection;
- no public `5432` exposure;
- migration checksum verification;
- required schema/index verification;
- successful ACME PostgreSQL integration suite;
- clean restart test.

PostgreSQL officially supports SQL dumps, filesystem backups and continuous archiving/PITR. Backup acceptance must include an actual restore test, not merely creation of a backup file.

## Gate D — Backup and recovery

At minimum implement:

- scheduled `pg_dump`/logical backup;
- global role/schema backup where required;
- backup integrity verification;
- retention rotation;
- restore into an isolated PostgreSQL instance;
- application migration verification after restore;
- measured restore time;
- measured data-loss window.

A local-only backup on the same physical disk is **not** considered disaster recovery. It protects against logical mistakes but not physical disk failure.

If no second storage target exists, production acceptance must remain blocked until a free, independently located backup target is available.

## Gate E — Node.js API

Validate:

- Node.js >=20;
- `npm install` succeeds;
- `npm start` succeeds;
- `PORT` is respected;
- `/health` returns 200;
- `/ready` remains not-ready until production dependencies are accepted;
- API restart preserves database state;
- no persistent state is written to ephemeral runtime directories;
- secrets are supplied through environment/service configuration and never committed.

## Gate F — Cloudflare Tunnel

Install `cloudflared` on the host and configure it as a persistent service.

Acceptance requires:

- outbound tunnel established;
- no inbound `3000` exposure;
- no inbound `5432` exposure;
- public hostname reaches only the API listener;
- tunnel automatically reconnects;
- host reboot automatically restarts the tunnel;
- API remains unreachable directly from the public Internet;
- `/health` works through the tunnel.

Cloudflare's official documentation states that Tunnel is available on all plans and requires no public IP/inbound port for the origin.

## Gate G — Automatic recovery

Test, do not assume:

1. API process termination -> automatic restart.
2. PostgreSQL restart -> database recovery.
3. `cloudflared` termination -> tunnel recovery.
4. host reboot -> all required services return automatically.
5. temporary Internet interruption -> tunnel reconnects.
6. disk-space warning -> alert/stop condition is visible.

## Gate H — Zero-budget acceptance

The following are hard failures:

- payment method required to create a required service;
- mandatory paid tier;
- hidden recurring infrastructure fee;
- mandatory paid object storage;
- mandatory paid database;
- requirement for a paid public IP;
- production dependency on a provider's promotional/free trial;
- backup strategy that requires paid storage before acceptance.

Cloudflare Free may be used only where the exact required feature remains available under its current free terms. Provider terms must be rechecked before production activation.

## Gate I — Security

Verify:

- Windows/Linux firewall blocks direct API/database ingress;
- PostgreSQL binds only where required;
- application runs with least privilege;
- backup credentials are not embedded in scripts or Git;
- logs contain no credentials/tokens/payment secrets/legal-document payloads;
- Cloudflare Tunnel token is stored outside Git;
- deployment artifacts contain no secrets.

## Gate J — Evidence package

Record:

- host inventory output;
- storage paths and free space;
- Node/PostgreSQL/cloudflared versions;
- PostgreSQL migration result;
- `/health` and `/ready` results;
- backup filename/checksum and verification result;
- restore duration;
- measured RPO;
- measured RTO;
- reboot recovery result;
- tunnel hostname and connectivity result;
- firewall exposure check;
- exact Git commit SHA deployed.

## Current status

- Zero-budget constraint: **HARD**
- Render managed PostgreSQL: **REJECTED** for zero-budget use
- Render backend: **REJECTED** for zero-budget use
- Cloudflare Pages: **candidate for static plane**
- Cloudflare Tunnel: **candidate for ingress**
- Existing host: **requires live preflight**
- PostgreSQL: **requires live preflight**
- Production DNS: **unchanged**
- Production data: **not authorized**

## Stop condition

Do not declare M7-8A complete until the actual host has been inspected and the PostgreSQL, API, backup, recovery, firewall and tunnel gates have evidence. If the host cannot satisfy the storage/recovery/security requirements without paid infrastructure, stop and redesign rather than weakening the zero-budget requirement.
