# ACME Runtime Foundation

This directory contains executable, provider-neutral application services.

## Current capability

`index.js` provides authenticated actor enforcement, matter creation, controlled state transitions, human gates, injected persistence, audit integration, and an injectable clock.

The runtime now also contains governed AI execution, human review/final-action authorization, legal-source provenance, date-aware legal versions, authority registration, matter diary/hearing records, partner verification, billing/invoice/payment boundaries, and an application service composition boundary.

## Governance

AI output is a proposal and is persisted with a mandatory human-review record. A final professional action must be explicitly approved or modified by an authorized human reviewer. Audit events are append-only at the service boundary.

## Knowledge

Legal sources use a controlled provenance taxonomy. Legal versions carry jurisdiction and validity dates so historical questions can be resolved against the law applicable at a specified date rather than silently using the current law.

## Boundary

The runtime does **not** select a database, authentication vendor, AI provider, payment provider, messaging provider, or object-storage vendor. Those choices remain deployment configuration and must not be hard-coded into domain logic.

## Production status

These services are the executable application foundation. Production infrastructure, provider credentials, real persistence, external integrations, jurisdiction-specific source licensing, retention/destruction policy, disaster recovery, and deployment acceptance remain separate production work.

## Security principle

Repositories are server-side dependencies. Browser code must not bypass the application authorization boundary to access matter records or operational data.
