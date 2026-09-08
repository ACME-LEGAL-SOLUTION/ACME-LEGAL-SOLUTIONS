# ACME Security Boundary

`Public → web/static delivery → authenticated application gateway → server-side authorization → matter scope → application services → AI Gateway → scoped specialist agents`

## Controls

- Browser clients never contain master secrets.
- Authorization is enforced server-side for every protected resource.
- Matter/document/evidence access is scoped to the authenticated principal and permitted matter relationships.
- AI tools are explicitly permitted per operation and recorded in the audit trail.
- Client operational data is never committed to Git.
- Secrets belong in deployment secret management, never source files.
- Audit events remain available independently of ordinary record deletion.
- Public website and authenticated operational services remain separate deployment/security surfaces.

This file is a control contract, not a claim that production infrastructure has already been provisioned.
