# ACME Consultation Intake Runtime

The executable intake service implements the server-side progression of a professional consultation from initial intake toward human-controlled professional action.

## Runtime states

`intake → verified → conflict_check → matter_open → professional_work → review → approved → final_action → client_contact → billing → closed → archived`

The sequence is intentionally explicit and monotonic. A caller cannot skip a state through the intake service.

## Governance

- Every mutating operation requires an authenticated actor.
- Conflict checking can be injected as a provider-neutral service before matter progression.
- `approved`, `final_action`, `closed`, and `archived` require an approved or modified human review object.
- The intake service does not itself deliver final legal/professional resolution.
- AI remains an assistive capability behind the governed AI Gateway and human review boundary.

## Production boundary

The current implementation is deliberately storage/provider neutral. Production authentication, persistent database, document/object storage, messaging, payments, and external legal-source providers remain configuration decisions and must not be hard-coded into the runtime foundation.
