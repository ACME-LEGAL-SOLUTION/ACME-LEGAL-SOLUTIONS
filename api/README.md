# ACME Application Boundary

This directory defines the server-side contract boundary for authenticated ACME services.

## Implemented contract groups
- `/api/auth`
- `/api/clients`
- `/api/relationships`
- `/api/matters`
- `/api/parties`
- `/api/authorities`
- `/api/hearings`
- `/api/diary`
- `/api/documents`
- `/api/evidence`
- `/api/knowledge`
- `/api/sources`
- `/api/legal-versions`
- `/api/ai/intake`
- `/api/ai/research`
- `/api/ai/review`
- `/api/reviews`
- `/api/partners`
- `/api/billing`
- `/api/payments`
- `/api/accounting`
- `/api/notifications`
- `/api/audit`

Provider, database, object-storage, payment, messaging and model choices intentionally remain configuration boundaries until the unresolved decisions in the master dossier are finalized.
