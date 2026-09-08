# ACME Production Readiness Gate

## Implemented foundation

- Domain model and API boundary
- Matter lifecycle and server-side matter authorization
- Client, party, relationship, conflict-check services
- Document and evidence boundaries
- Human review and final-action governance
- Append-only audit service boundary
- Provider-neutral AI runtime with mandatory review creation
- Source provenance and date-aware legal-version resolution
- Authority registry and matter diary/hearing boundary
- Partner verification boundary
- Billing invoice/payment boundary
- Application service composition and authenticated HTTP boundary

## Required before production

1. Production identity/authentication and RBAC implementation.
2. Real relational persistence with transactional integrity and migrations.
3. Object storage for client documents/evidence with encryption, retention and backup policy.
4. Production AI provider adapters, scoped tool permissions, rate limits and observability.
5. Verified legal-source acquisition/licensing and jurisdiction-specific update pipeline.
6. Production payment, invoicing, accounting and reconciliation integrations.
7. Messaging/email/WhatsApp provider integration and delivery audit.
8. Secrets management, key rotation, security monitoring and incident response.
9. Data retention/destruction, privacy controls, disaster recovery and RPO/RTO acceptance.
10. GoDaddy deployment, HTTPS, cache/CDN configuration and end-to-end acceptance testing.

No production credential, client operational data, or unsupported regulatory claim belongs in the public source repository.
