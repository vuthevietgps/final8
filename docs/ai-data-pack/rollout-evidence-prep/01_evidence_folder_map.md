# Evidence Folder Map

Phase: `PR-2.3B-4J-E0`

## Prep Folder

This folder contains templates and instructions only:

```text
docs/ai-data-pack/rollout-evidence-prep/
```

Files here are not completed rollout evidence.

## Completed Evidence Folder

Human/operator completed evidence must be stored here:

```text
docs/ai-data-pack/rollout-evidence/
```

Required destination files:

```text
docs/ai-data-pack/rollout-evidence/evidence-index.md
docs/ai-data-pack/rollout-evidence/completed-execution-checklist.md
docs/ai-data-pack/rollout-evidence/completed-role-cohort-verification.md
docs/ai-data-pack/rollout-evidence/completed-smoke-uat-results.md
docs/ai-data-pack/rollout-evidence/completed-go-no-go-signoff.md
docs/ai-data-pack/rollout-evidence/completed-rollback-drill-results.md
docs/ai-data-pack/rollout-evidence/completed-post-rollout-report.md
```

## Copy Rule

Use templates from:

```text
docs/ai-data-pack/rollout-evidence-prep/templates/
```

Copy them to the completed evidence folder only after human/operator execution. When copied, remove the `TEMPLATE_ONLY_NOT_EXECUTED` status and fill all required fields with actual observations, evidence paths, timestamps, and signoffs.

## Safety Rule

Do not store credentials, tokens, raw provider payloads, raw request headers, raw PII, artifact bytes, public URLs, or full storage paths in the evidence folder.
