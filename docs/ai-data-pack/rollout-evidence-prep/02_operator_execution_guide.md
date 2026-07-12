# Operator Execution Guide

Phase: `PR-2.3B-4J-E0`

This guide helps a human/operator collect completed rollout evidence. It is not an instruction for Codex to execute rollout.

## Before Execution

Confirm:

- Controlled internal/admin rollout only.
- High-volume public rollout remains blocked.
- Download phase remains unopened.
- No production code changes are being made by this evidence prep phase.
- Prompt 20 execution checklist and templates are available.

## Required Capture Fields

For every executed check or test case, capture:

| Field | Required content |
|---|---|
| Environment | Target environment name and release/build identifier. |
| Operator | Human/operator name or internal identifier. |
| Time | Timestamp with timezone. |
| Endpoint/request summary | Endpoint and sanitized request purpose. |
| Actor/cohort used | Role/cohort under test. |
| Expected result | Expected status/behavior from Prompt 20. |
| Actual result | Observed status/behavior. |
| Evidence link/path | Path to sanitized response, screenshot, audit record, or log reference. |
| Audit/log reference | Sanitized audit/log id, query, or screenshot path. |
| Pass/fail | `pass`, `fail`, or `not_applicable_with_owner_approval`. |
| Notes | Bounded notes without secrets or raw PII. |

## Safe Execution Steps

1. Create or identify the completed evidence folder:

   ```text
   docs/ai-data-pack/rollout-evidence/
   ```

2. Copy templates from:

   ```text
   docs/ai-data-pack/rollout-evidence-prep/templates/
   ```

   to the destination filenames listed in `01_evidence_folder_map.md`.

3. Remove `STATUS: TEMPLATE_ONLY_NOT_EXECUTED` only after a human/operator has actually performed the check.

4. Fill `evidence-index.md` first so every completed file has an owner, timestamp, and evidence classification.

5. Execute only the existing controlled create/status/detail/sync-summary checks from Prompt 20.

6. Record sanitized request/response summaries, audit references, and log references.

7. Mark any failed blocking item as failed and stop controlled rollout until the owner records a fix, explicit risk acceptance, or rollback decision.

## Forbidden During Evidence Capture

Do not require or perform:

- Download.
- Artifact bytes retrieval.
- Public URL or storage path exposure.
- OpenAI upload.
- Action import.
- Approval workflow expansion.
- Dry-run/live execution.
- Provider mutation.
- Provider validateOnly.
- New provider adapter.
- Phase 3 behavior.
