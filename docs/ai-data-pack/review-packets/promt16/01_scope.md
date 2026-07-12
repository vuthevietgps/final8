# Prompt 16 Scope

## In Scope

- Public endpoint hardening for existing AI Data Pack export endpoints.
- ERP role-to-permission binding for export create/status/audit/sync-detail access.
- Persistent audit records for endpoint attempts and denials.
- Rate-limit hardening for create, official create, status polling, sync summary, idempotency replay, and denial paths.
- Acceptance/regression tests proving fail-closed public behavior.
- Documentation and review packet outputs for Prompt 16.

## Out of Scope

- Download endpoints or download-token support.
- Artifact byte streaming.
- Public URL, storage path, or storage key exposure in public responses.
- Row rendering.
- OpenAI upload.
- Action import, approval, dry-run, live execution, or auto-publish.
- Provider mutation routes and validateOnly routes.
- New provider adapters.
- Performance Max, Shopping, Display, YouTube, delete actions, or Phase 3 behavior.

## Inputs Reviewed

Reviewed previous Prompt 13, Prompt 14, and Prompt 15 result documents and review packets. Also reviewed the master director document and available Prompt 15 handoff files.

Missing optional files were recorded in `docs/ai-data-pack/ketquapromt16.md` and `docs/ai-data-pack/ketquapromt16.json`. Their absence did not require scope expansion or block implementation.
