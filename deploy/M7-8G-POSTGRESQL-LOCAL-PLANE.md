# M7-8G — Zero-Budget Local PostgreSQL Plane

## Objective

Install and validate a local PostgreSQL 18.x runtime on the existing Windows host without introducing paid infrastructure and without using C: for persistent ACME database storage.

Current host evidence: Windows 11 Home, AMD Ryzen 5 5600H, 12 logical CPUs, 15.41 GB RAM, C: 35.14 GB free, E: 135.70 GB free, F: 140.61 GB free. PostgreSQL and `cloudflared` are absent. Node.js/npm are present.

## Approved target layout

Use E: for persistent PostgreSQL and ACME database state:

```text
E:\ACME\PostgreSQL\18\        PostgreSQL installation/binaries
E:\ACME\PostgreSQL\data\      PostgreSQL cluster/data
E:\ACME\backups\postgres\      PostgreSQL backup destination
E:\ACME\installers\            downloaded installers only
```

Do not place the PostgreSQL cluster on C:.

## Version policy

Use the latest supported PostgreSQL 18 maintenance release available from the official PostgreSQL Windows download page at installation time. As of 2026-09-11, PostgreSQL 18.6 is the current 18.x release. Do not use PostgreSQL 19 Beta for this production-bound host.

Official download: https://www.postgresql.org/download/windows/

The PostgreSQL project identifies the Windows installer as an EDB-hosted certified installer and supports PostgreSQL 18 on 64-bit Windows. PostgreSQL is distributed under the PostgreSQL License with no runtime license fee.

## Installation gate

1. Create only the required persistent directories on E:.
2. Download the official PostgreSQL Windows installer to `E:\ACME\installers\`.
3. Verify the installer is the 64-bit PostgreSQL 18.x installer before execution.
4. Run the installer as Administrator.
5. Set the installation directory to `E:\ACME\PostgreSQL\18`.
6. Set the database/data directory to `E:\ACME\PostgreSQL\data`.
7. Select PostgreSQL Server and Command Line Tools. pgAdmin is optional and should not be installed unless needed.
8. Use port `5432`.
9. Set a strong unique PostgreSQL superuser password. Do not put the password in Git, shell history, screenshots, or this repository.
10. Do not install StackBuilder packages unless a later ACME dependency explicitly requires one.
11. Complete installation and verify the PostgreSQL Windows service exists and is configured for automatic startup.

The installer may use Windows temporary directories during installation. That transient installer activity is not ACME persistent storage. The PostgreSQL installation and data directories must remain on E:.

## Local-only network gate

After installation, edit the PostgreSQL configuration so the database is local-only:

`E:\ACME\PostgreSQL\data\postgresql.conf`

Set:

```text
listen_addresses = '127.0.0.1'
port = 5432
```

Review `pg_hba.conf` and allow only local connections required by the ACME runtime. Do not add `0.0.0.0/0`, public CIDRs, or remote database access.

Restart the PostgreSQL service after configuration changes.

## Verification commands

Run in a new elevated PowerShell session:

```powershell
Get-Service | Where-Object { $_.Name -match 'postgres' } |
  Select-Object Name, Status, StartType, DisplayName

where.exe psql
where.exe pg_dump
psql --version
pg_dump --version

Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -eq 5432 } |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Expected network result:

```text
LocalAddress  LocalPort
------------  ---------
127.0.0.1     5432
```

A listener on `0.0.0.0:5432`, `[::]:5432`, or a public/non-loopback address is a hard security failure and must be corrected before proceeding.

## ACME database gate

Create a dedicated ACME database and non-superuser application role. The application role must not be the PostgreSQL superuser.

Do not place credentials in the repository. Use the production secret boundary already implemented by ACME and local environment/service configuration.

After creation, verify:

- ACME database exists.
- Application role can connect.
- Application role cannot perform superuser-only operations.
- PostgreSQL remains bound to loopback only.

## ACME migration gate

From the repository root:

```powershell
npm ci
npm test
npm run test:integration
```

The real PostgreSQL integration must validate the migration manifest and all canonical migration checksums, including the `work_packages` schema and subsequent production migrations.

No migration is accepted merely because the application starts.

## Backup gate — required before production acceptance

Create a backup directory on E: only after confirming sufficient free space:

```text
E:\ACME\backups\postgres\
```

Use `pg_dump` for logical backup validation. The backup must be copied to a location that is not the PostgreSQL data directory. A backup stored only beside the live database is not sufficient disaster recovery.

At minimum:

1. Create a test backup.
2. Verify the backup file exists and is readable.
3. Restore it into an isolated PostgreSQL database/cluster.
4. Validate schema and representative records.
5. Record elapsed backup/restore time.
6. Do not delete production data during the test.

Production RPO/RTO acceptance remains blocked until recovery has actually been tested.

## Firewall gate

PostgreSQL must not require an inbound Internet firewall exception. ACME's future public API ingress is through Cloudflare Tunnel, not direct port 5432 exposure.

After installation, inspect effective firewall rules affecting TCP 5432. If an inbound rule exposes PostgreSQL beyond localhost, stop and correct it.

## Zero-budget gate

M7-8G fails if completion requires:

- paid database hosting;
- paid VPS/VM;
- mandatory paid PostgreSQL software/license;
- paid backup storage;
- opening PostgreSQL to the public Internet;
- moving persistent database state to C: because E: is unavailable.

## Stop conditions

Stop immediately if:

- PostgreSQL cannot be installed with data on E:;
- PostgreSQL binds to a non-loopback address unexpectedly;
- `psql`/`pg_dump` cannot be validated;
- ACME real PostgreSQL migration tests fail;
- backup/restore cannot be completed safely;
- disk health or available space is inadequate;
- installation requires paid infrastructure;
- credentials would need to be committed to Git.

## Acceptance evidence

M7-8G is not complete until the following evidence exists:

- PostgreSQL version;
- installation path;
- data path;
- service status/start type;
- listener address/port;
- firewall result;
- ACME database/application-role validation;
- real PostgreSQL migration/integration result;
- backup creation result;
- isolated restore result;
- measured backup/restore timing;
- confirmation that no paid infrastructure was introduced.

## Current status

**M7-8F discovery: COMPLETE.** PostgreSQL is absent from the host.

**M7-8G implementation: repository runbook.** Actual installation must be executed on the user's Windows host and cannot be claimed complete from GitHub alone.
