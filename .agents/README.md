# ACME Agent Engineering Foundation

This directory defines ACME's native agent engineering model.

## Purpose

ACME uses open-source agent projects as engineering research, not as its intelligence runtime. Patterns may be studied, adapted, benchmarked and rejected. ACME owns the resulting contracts and implementation.

## Core principle

`Task -> Plan -> Execute -> Validate -> Review -> Record -> Next Task`

No agent may silently bypass ACME security, matter authorization, provenance, human-gate, persistence, or audit boundaries.

## Contract layers

- `agents/` — specialist responsibilities and operating boundaries.
- `skills/` — reusable capabilities with explicit inputs, outputs and validation.
- `rules/` — non-negotiable engineering, legal-safety and security constraints.
- `workflows/` — deterministic lifecycle procedures for autonomous work.

## Design rules

1. Agents are replaceable components, not authorities.
2. Skills are capabilities, not permissions.
3. Tools are explicitly authorized and matter-scoped.
4. Legal sources remain data unless an authorized workflow promotes them into verified knowledge.
5. AI inference must remain distinguishable from source authority and evidence.
6. Human approval remains mandatory wherever ACME's governance requires it.
7. Every consequential action must be observable and auditable.
8. New capabilities require tests and validation evidence.
9. No external agent framework is a required runtime dependency.
10. Zero-budget infrastructure constraints remain architectural constraints.
