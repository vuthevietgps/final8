# 01 Scope

Allowed changes:

- `docs/ai-data-pack/ketquapromt14.md`
- `docs/ai-data-pack/ketquapromt14.json`
- `docs/ai-data-pack/review-packets/promt14/*`

No source code, migration, controller, route, service, schema, test, or artifact-rendering code was changed.

In scope:

- future create endpoint contract
- future status endpoint contract
- future job-detail endpoint contract
- future sync-summary endpoint contract
- response redaction policy
- endpoint RBAC and denial behavior
- endpoint audit events
- idempotency and rate limits
- future implementation test plan

Out of scope:

- download endpoint
- download token
- artifact bytes
- row-level redaction implementation
- OpenAI upload
- action import
- approval workflow
- dry-run/live execution
- provider mutation
- Phase 3
