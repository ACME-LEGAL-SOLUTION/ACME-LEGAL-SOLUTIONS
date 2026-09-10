# M6-9 Production Data Retention, Privacy & Disaster Recovery

## Scope

M6-9 establishes provider-neutral application governance for retention, legal holds, export, secure destruction, backup verification, restore, and measurable recovery objectives.

## Retention

- Every governed data class must have an explicit retention policy.
- Retention is evaluated against a UTC cutoff derived from the policy and current clock.
- Legal-hold records are never eligible for automated destruction.
- Destruction is only recorded after the provider explicitly confirms `deleted: true`.
- Dry-run enforcement is the default and produces a review audit event without deleting data.
- Destruction audits contain a SHA-256 fingerprint of the record identifier, not the identifier itself or record contents.

## Privacy

- Export is provider-backed and audited.
- Audit metadata is sanitized to exclude credentials, authorization material, contact details, document/evidence content and request bodies.
- No record content is copied into the security audit event by the governance layer.

## Disaster recovery

The production backup provider must implement:

- `createBackup`
- `verifyBackup`
- `restoreBackup`

A backup is not accepted as recoverable unless verification returns `verified: true`. A restore is not accepted unless it returns `restored: true`.

Default recovery objectives:

- **RPO:** 15 minutes (900 seconds)
- **RTO:** 60 minutes (3600 seconds)

`assertRecoveryAcceptance()` rejects an exercise when observed RPO or RTO exceeds the accepted target or the backup was not verified.

## Provider acceptance still required

Application code cannot establish the operational properties of a real infrastructure provider. Production acceptance must verify:

1. encrypted database backups and object-storage backups;
2. KMS/HSM key ownership and rotation;
3. immutable/off-site backup retention appropriate to legal requirements;
4. restore into an isolated recovery environment;
5. object-storage recovery and document integrity;
6. deletion propagation and legal-hold preservation;
7. provider outage behavior;
8. measured RPO/RTO under a realistic recovery exercise;
9. access controls and separation of duties for backup/restore;
10. incident and recovery audit evidence.

No production credential, backup, customer data, or provider secret belongs in this repository.
