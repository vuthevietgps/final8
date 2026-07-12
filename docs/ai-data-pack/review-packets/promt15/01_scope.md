# Scope

In scope:

- Public create/status/detail/sync-summary endpoints under `ai-data-pack/exports`.
- Endpoint RBAC and response redaction.
- Request validation, idempotency reuse, and conservative in-memory abuse controls.
- Sanitized endpoint audit events.
- Focused tests for public endpoint safety.

Out of scope:

- Download endpoint.
- Download token.
- Artifact byte rendering.
- Public URL or full storage path disclosure.
- Row-level redaction/rendering.
- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run/live execution.
- Provider mutation or validateOnly.
- New provider adapter.
- Phase 3.

Missing input noted:

```text
docs/ai-data-pack/ba-master-addendum-prompt13-review-prompt14-public-endpoint-spec-20260613.md
```
