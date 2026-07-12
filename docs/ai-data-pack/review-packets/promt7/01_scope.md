# Scope

## Implemented

- Generic read-only adapter contract and internal tokens.
- Narrow Google Ads adapter module around `GoogleAdsReadonlySyncService`.
- Input, permission, scope, date, deadline, retry, lock, transport, local-write, and error guards.
- Focused unit and source-guard tests.
- Prompt 7 report and review packet.

## Explicitly Not Implemented

- Official or partial exports.
- Public endpoint, polling, or download endpoint.
- ExportJob or source-registry runtime integration.
- Provider calls or real sync during tests.
- Provider mutation, validateOnly, action import, approval, dry-run, or live execution.
- OpenAI/upload or Phase 3.
- Migration or schema changes.

All production code changes are under `backend/src/ai-data-pack/provider-adapters/`.

