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

## Executable HTTP routes currently wired
- `POST /api/clients` — authenticated client creation
- `POST /api/matters` — authenticated matter creation scoped to an existing client
- `POST /api/intake` — authenticated consultation intake creation
- `POST /api/ai/research` — authenticated AI execution routed through human review

The HTTP boundary authenticates before dispatch and keeps provider, database, object-storage, payment, messaging and model choices behind configuration boundaries. Production integrations remain unresolved until the decisions in the master dossier are finalized.
