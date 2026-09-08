# ACME — Legal Solution

Premium international legal, accounting and business counsel platform.

## Build Status

This repository is the production implementation destination for ACME. The project is being built in staged, auditable commits from the approved ACME requirements baseline.

## Product Principles

- Premium, legitimate, luxury, institutional presentation
- AI-native intelligence with mandatory human professional control
- International-ready jurisdiction architecture
- Security and auditability by design
- No fabricated capabilities or regulatory claims
- Responsive, accessible and performance-conscious experience

## Current Build

**Phase 2 — Application Foundation / Persistent CRM integration in progress.**

Validated foundation currently includes:

- Premium public website prototype with responsive/accessibility structure
- Consultation / ASK ACME public intake boundary
- Executable CRM, matter, party, relationship, conflict, document and evidence service boundaries
- Canonical server-side, action-aware matter authorization boundary
- Persistent matter operations bound to transaction-scoped repositories
- Server-side authentication and matter-scope authorization contracts
- Governed AI Gateway with human-review/final-action controls
- Legal-source provenance and date-aware legal-version services
- Authority, diary, billing and partner-verification service boundaries
- Provider-neutral relational repository contract and SQL adapter
- Transaction boundary, migration runner and transaction-scoped repository composition
- HTTP server/dispatcher and integration-test coverage
- Automated GitHub Actions regression suite

The current persistent layer is **provider-neutral**. A production database engine/topology has not been selected, so the repository does not claim a live production database.

### Latest validated CI

- Commit: `bcfc5c31dbc01b244aa0408f343afba4a1f82384`
- Workflow: ACME Tests
- Result: **87 / 87 tests passed**

### Next implementation slice

**Phase 2D — Persistent CRM domain operations and HTTP integration:** matter lifecycle transitions, party/relationship persistence, conflict-check recording, document/evidence registration, audit consistency, rollback verification, and authenticated HTTP execution over the persistent composition.

See `docs/BUILD-PLAN.md` for the implementation roadmap and `docs/ARCHITECTURE.md` for the system boundary.
