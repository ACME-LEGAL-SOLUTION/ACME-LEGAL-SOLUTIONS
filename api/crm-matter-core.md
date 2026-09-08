# ACME CRM & Matter Core

## Purpose
Define the first operational application boundary for client, relationship, matter, party, document, evidence, task, diary, and assignment workflows.

## Core rules
- Client and matter data are server-side records; they are never treated as public website content.
- Matter access is authorized server-side and scoped to the matter/client relationship.
- Every matter has an accountable human owner and may have additional assigned professionals.
- Relationships support conflict-checking and party/network context.
- Documents and evidence retain provenance and metadata; AI extraction is not treated as verified fact until validated.
- Tasks, hearings, and diary entries remain subject to human override.
- Operational events that affect security, professional workflow, or accountability are auditable.

## Initial record lifecycle
`lead -> verified -> conflict_check -> matter_open -> active -> review -> resolved -> closed -> archived`

A record may not enter `resolved` where required professional work remains pending human review/approval.

## Next implementation boundaries
1. Server-side persistence adapter.
2. Authentication and authorization adapter.
3. Client/relationship/matter CRUD services.
4. Party and assignment services.
5. Document/evidence metadata services.
6. Task/hearing/diary services.
7. Audit events and notifications.
8. UI portals consuming these APIs.

Provider and infrastructure choices remain configuration boundaries until formally selected.
