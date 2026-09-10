# ACME M6-8 — Secrets, Key Rotation & Security Monitoring

## Scope

M6-8 establishes provider-neutral production security boundaries for secret retrieval, secret rotation/revocation, non-reversible secret fingerprinting, security-event classification, anomaly detection, and incident declaration.

## Security boundaries

- Production secrets must come from `ACME_SECRET_PROVIDER_MODULE`; no credentials are embedded in ACME source.
- Secret values are returned only to the immediate provider consumer and are never included in metadata, fingerprints, or security audit payloads.
- Providers may implement `rotate` and `revoke`; rotation is version-aware and fails closed if the provider does not support the requested operation.
- Secret metadata is sanitized to prevent accidental value disclosure.
- Security events use a fixed allow-list of event types and severities.
- Security metadata strips credential/PII-shaped keys before audit.
- Repeated security failures within a bounded time window can declare a high/critical incident once per active trigger key.
- Security audit payloads contain identifiers and operational metadata, not credentials or request bodies.

## Provider responsibilities

The external secret-management provider remains responsible for KMS/HSM-backed encryption, access policy, storage durability, version activation, actual cryptographic key rotation, revocation semantics, and provider-side audit logs.

## Acceptance evidence

Tests cover provider fail-closed behavior, versioned retrieval, metadata sanitization, rotation/revocation boundaries, deterministic secret fingerprinting, plaintext leakage prevention, anomaly-window expiry, threshold escalation, incident declaration, and security metadata filtering.

M6-8 is not considered production-complete until the deployed provider is configured and operational controls for access policy, rotation cadence, backup/restore, incident response, and credential expiry alerting are accepted in the target environment.
