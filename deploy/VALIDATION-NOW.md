# ACME — Current Validation Gate

This file is intentionally temporary for the M7-9.9 validation cycle.

- HTTP matter lifecycle transition is exposed at `POST /api/matters/transition`.
- The endpoint is authenticated and delegates to the governed matter state machine.
- Final-state transitions remain human-approval gated.
- CI must validate the exact branch before merge.
