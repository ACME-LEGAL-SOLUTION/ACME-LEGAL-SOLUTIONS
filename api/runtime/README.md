# ACME Runtime Foundation

This directory contains executable, provider-neutral application services.

## Current capability

`index.js` provides a runtime factory with:

- authenticated-actor enforcement;
- matter creation;
- controlled matter-state transitions;
- human approval gates for resolution/closure/archive transitions;
- injected persistence repositories;
- injected append-only audit sink;
- injectable clock for deterministic tests.

## Boundary

The runtime does **not** select a database, authentication vendor, AI provider,
payment provider, messaging provider, or object-storage vendor. Those choices
remain deployment configuration and must not be hard-coded into domain logic.

## Security principle

Repositories are server-side dependencies. Browser code must not bypass the
application authorization boundary to access matter records or operational data.
