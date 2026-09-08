# ACME Runtime Boundary Map

The executable runtime remains provider-neutral. External persistence, authentication, AI providers, payments, messaging, and deployment infrastructure are injected at application boundaries.

## Implemented runtime domains

- CRM: clients, matters, parties, relationships, conflicts
- Security: matter-scoped access control
- Documents and evidence: matter-linked records
- Governance: human review, modification, approval, final-action authorization, append-only audit
- AI: provider-neutral execution gateway that creates a mandatory review record
- Knowledge: source provenance and date-aware legal versions
- Operations: authority registry and matter diary/hearing records
- Network: partner registration and evidence-backed verification
- Billing: invoice and payment lifecycle

## Governance rule

AI output is a proposal. The runtime records it and routes it to human review. A final action is authorized only after an eligible human reviewer has approved or modified the proposal. Provider credentials and client operational data are not stored in source-controlled runtime code.

## Production boundary

These runtime services are executable foundations, not a declaration that production infrastructure is complete. Production database/object storage, authentication provider, AI provider mix, payment gateway, messaging providers, retention/DR policy, and jurisdiction-specific source licensing remain deployment/configuration decisions.
