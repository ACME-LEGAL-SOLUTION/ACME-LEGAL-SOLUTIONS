# ACME Legal Knowledge Foundation

This directory is the governed data contract and source manifest for Ask ACME. It is intentionally separate from application code so published legal material can be acquired, verified, versioned, indexed and reconciled without embedding legal assertions in prompts or UI code.

## Retrieval chain

`question -> jurisdiction -> court/authority -> matter type -> legal instrument -> section/rule -> effective version -> authority/evidence -> provenance -> answer`

Ask ACME must never treat an unverified source as authoritative. The runtime already provides source registration, date-aware legal versions, authority ranking, provenance chains, knowledge authorization and a verified-source publication boundary.

## Published-source policy

1. Prefer first-party government/court/regulator publications.
2. Record the canonical locator, issuing authority, jurisdiction, retrieval time and checksum.
3. Keep historical versions and effective dates; never overwrite an earlier legal state.
4. A human verifier must promote an acquired source to `verified` before it can publish a legal version.
5. Rejected or stale sources remain auditable and are excluded from authoritative retrieval.
6. Answers must carry jurisdiction and provenance through the retrieval pipeline.

## Initial India source families

The first acquisition targets are recorded in `source-registry.json`:

- India Code: Acts, sections, subordinate legislation, notifications, orders and other Union/State legal material.
- Supreme Court of India: judgments, orders and court publications.
- eCourts / eCommittee: court hierarchy, case status, orders/judgments and court metadata.

These are source targets, not copied legal content. The acquisition pipeline must fetch and checksum the published material before verification.

## Classification contract

Ask ACME's classifier must produce structured signals, with confidence and provenance:

- `jurisdiction`
- `stateOrTerritory`
- `courtOrForum`
- `matterType`
- `legalInstrument`
- `sectionOrRule`
- `issue`
- `dateContext`
- `authorityLevel`

Missing or ambiguous fields must remain unresolved rather than being guessed. The UI should ask a targeted clarification question when the unresolved field materially changes the legal result.
