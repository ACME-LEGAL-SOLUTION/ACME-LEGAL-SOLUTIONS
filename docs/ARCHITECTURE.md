# ACME Architecture

## Experience
- Public Website
- Client Portal
- Professional Portal
- Director / Master Command Center
- Mobile
- Desktop

## ACME Core
- Identity
- CRM
- Relationships
- Matters
- Parties
- Tasks
- Calendar / Diary
- Billing
- Accounting
- Notifications
- Audit

## Intelligence
- AI Gateway
- Provider Router
- Context Builder
- Tool Permission Layer
- Provenance
- Confidence
- Human Gate
- Specialist Agents

## Knowledge & Evidence
- Jurisdictions
- Authorities
- Legal instruments
- Historical legal versions
- Sources and citations
- Knowledge records
- Documents
- Evidence
- Verification

## Security Boundary
Public website → authenticated application gateway → server-side authorization / matter scope → application services → AI Gateway → scoped specialist agents.

Browser clients must never contain master secrets. Client documents are operational object data, not repository content. AI tool access is scoped and auditable.

## Governance
AI assistance → human professional review → human modification/approval → final human action.

The system distinguishes source authority, historical material, commentary, unverified information and AI inference. No unsupported capability or legal/regulatory status is represented as fact.

## Deployment Direction
GitHub is the source-control system. GoDaddy is the target public hosting direction. Production client intake/API services remain behind the authenticated application boundary.
