# Director To Marketer Guardrail And Ads Recommendation Draft Overview

Phase: `PR-2.4A`.

Status: BA/spec only. No product code, no action import, no approval workflow implementation, no dry-run/live execution, no provider mutation, no provider `validateOnly`, no OpenAI upload/API integration, and no Phase 3 behavior.

## Business Intent

Director Pack provides finance, risk, budget, and data maturity guardrails. Marketer Pack provides ads, lead, order, profit, return, and cash-lag evidence. ChatGPT Web may produce an advisory-only ads recommendation draft that says what to increase, decrease, keep, pause, investigate, or test.

The output must answer:

- Which campaign/adset/adgroup/ad should change.
- Increase, decrease, keep, pause, investigate, or test.
- Recommended budget delta and rationale.
- Whether the recommendation is within Director guardrails.
- Whether director approval is required.
- Confidence and missing data.

## Closed Branch Preserved

The previous branch remains closed:

```text
Manual JSON ChatGPT Web Export Loop = BA closed
```

Prompt 29 opens only a no-code advisory action-draft spec branch. It does not reopen ERP import or execution.

## System Boundary

```text
Director Pack -> guardrails, finance mode, risk thresholds, data maturity
Marketer Pack -> ads, lead, order, profit, return, cash-lag evidence
ChatGPT Web -> advisory recommendation draft only
ERP future gate -> validate/log/approval policy later, no execution by default
```

## Non-Executable Invariants

Every recommendation draft governed by this spec must state:

```text
This is not executable.
This is not import-ready.
This is not provider mutation.
```

It must not contain provider credentials, access tokens, refresh tokens, OpenAI upload metadata, dry-run/live execution flags, or provider mutate payloads.

## Source Inputs Reviewed

Reviewed and available:

- `docs/ai-data-pack/final-ba-closeout/*`
- `docs/ai-data-pack/ketquapromt27.md`
- `docs/ai-data-pack/ketquapromt27.json`
- `docs/ai-data-pack/manual-chatgpt-web-acceptance/*`
- `docs/ai-data-pack/ketquapromt26.md`
- `docs/ai-data-pack/ketquapromt26.json`
- `docs/ai-data-pack/ketquapromt25.md`
- `docs/ai-data-pack/ketquapromt25.json`
- `docs/ai-data-pack/ketquapromt24.md`
- `docs/ai-data-pack/ketquapromt24.json`
- `docs/ai-data-pack/ketquapromt23.md`
- `docs/ai-data-pack/ketquapromt23.json`
- `docs/ai-data-pack/ba-master-director-ai-data-pack-dropship-20260612.md`
- `docs/ai-data-pack/demo-data/*`

Missing optional/context inputs:

| File | Impact | Can continue |
| --- | --- | --- |
| `docs/ai-ads-v2/00-index.md` | Workspace AGENTS references this index, but this Prompt 29 phase is no-code AI Data Pack BA/spec and the AI Data Pack source docs are available. | true |
| `docs/ai-data-pack/chuoi-promt-codex-chatgptweb-ledger-v27.md` | Optional ledger unavailable. Prompt 23-28 result chain and closeout docs define current scope. | true |
| `docs/ai-data-pack/lo-trinh-ai-data-pack-roadmap-v27.md` | Optional roadmap unavailable. Prompt 29 stays within requested PR-2.4A spec. | true |
| `docs/ai-data-pack/truc-giu-ba-ai-data-pack-v24.md` | Optional guardrail memo unavailable. This spec derives guardrails from BA Master and Prompt 23-28 closeout constraints. | true |

## Acceptance Criteria

This spec is accepted when:

- Director Guardrail Contract is explicit.
- Marketer Pack Contract is explicit.
- Guardrail inheritance and snapshot rules are explicit.
- ChatGPT Web recommendation schema is explicit and non-executable.
- Approval-required rules are complete.
- Scenario library has at least 40 cases.
- Data maturity and confidence rules are explicit.
- Future ERP validation gate is specified without implementation.
- No product code is changed.
