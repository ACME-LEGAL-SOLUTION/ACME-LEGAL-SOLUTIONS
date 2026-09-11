# ACME Specialist Agent Registry

The first implementation slice deliberately defines the registry contract before individual agents are created.

Each future agent descriptor must reference `.agents/agents/AGENT-CONTRACT.md` and provide:

- stable `id`
- one primary responsibility
- input/output contract
- permitted tools
- data/matter scope
- human approval points
- validation checks
- escalation conditions

Initial planned specialists:

- `architect`
- `research`
- `legal-knowledge`
- `security`
- `persistence`
- `infrastructure`
- `evaluation`
- `test`
- `reviewer`
- `release`

These names are design targets, not claims that runtime agents already exist.
