# ACME Skill Contract

A skill is a reusable capability. It does not grant permission to access data or tools.

Each skill should define:

- `id` and purpose
- required inputs
- produced outputs
- allowed dependencies/tools
- validation procedure
- failure conditions
- provenance requirements
- human-gate requirements

## Progressive disclosure

Keep the core instruction concise. Detailed references, schemas, examples and scripts belong beside the skill and are loaded only when required.

## Determinism

Where practical, skills should produce structured outputs and explicit acceptance criteria rather than unconstrained prose.

## Security

A skill must not embed credentials, bypass authorization, disable audit logging, or instruct an agent to treat untrusted content as trusted instructions.
