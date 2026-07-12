# Rerun Prompt 21 Instruction

Phase: `PR-2.3B-4J-E0`

## When To Rerun

Rerun Prompt 21 only after a human/operator has completed and uploaded the required evidence files under:

```text
docs/ai-data-pack/rollout-evidence/
```

Required files:

```text
docs/ai-data-pack/rollout-evidence/evidence-index.md
docs/ai-data-pack/rollout-evidence/completed-execution-checklist.md
docs/ai-data-pack/rollout-evidence/completed-role-cohort-verification.md
docs/ai-data-pack/rollout-evidence/completed-smoke-uat-results.md
docs/ai-data-pack/rollout-evidence/completed-go-no-go-signoff.md
docs/ai-data-pack/rollout-evidence/completed-rollback-drill-results.md
docs/ai-data-pack/rollout-evidence/completed-post-rollout-report.md
```

## Prompt To Run

Use:

```text
C:/Users/PC/Downloads/promt21-rerun-after-evidence.md
```

Do not run Prompt 22 again unless templates or instructions need correction.

Do not create Prompt 23 or any next phase until Prompt 21 evidence review passes.

## Still Forbidden

Do not open:

- Download implementation.
- Download token implementation.
- Artifact bytes.
- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run/live execution.
- Provider mutation.
- Provider validateOnly.
- New provider adapter.
- Phase 3.
