# Scope

## In Scope

- Define how Director Pack guardrails constrain Marketer Pack recommendations.
- Define how Marketer Pack carries ads, lead, order, profit, return, and cash-lag evidence.
- Define non-executable ChatGPT Web recommendation draft shape.
- Define approval-required rules.
- Define data maturity and confidence behavior.
- Define future ERP validation gate as a spec only.

## Out Of Scope

- Any backend/frontend code.
- ERP import endpoint.
- Approval workflow.
- Dry-run/live ads execution.
- Provider validation or mutation.
- OpenAI upload/API integration.
- New provider adapter.
- Phase 3.

## Inputs

Reviewed required source docs from Prompt 23-27, final BA closeout, manual ChatGPT Web acceptance, BA Master, and demo-data docs.

Missing optional/context inputs:

| File | Impact | Can continue |
| --- | --- | --- |
| `docs/ai-ads-v2/00-index.md` | Referenced by workspace AGENTS, absent in repo. Prompt 29 is no-code AI Data Pack BA/spec and required AI Data Pack docs were available. | true |
| `docs/ai-data-pack/chuoi-promt-codex-chatgptweb-ledger-v27.md` | Optional ledger absent. Prompt 23-28 chain was available. | true |
| `docs/ai-data-pack/lo-trinh-ai-data-pack-roadmap-v27.md` | Optional roadmap absent. Prompt 29 scope is explicit. | true |
| `docs/ai-data-pack/truc-giu-ba-ai-data-pack-v24.md` | Optional guardrail memo absent. BA Master and prior prompt outputs provide guardrail basis. | true |
