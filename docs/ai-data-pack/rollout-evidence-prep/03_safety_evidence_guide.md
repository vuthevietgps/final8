# Safety Evidence Guide

Phase: `PR-2.3B-4J-E0`

This guide tells the operator how to prove the controlled rollout stayed inside the safe no-download/no-action/no-provider-mutation scope.

## References

- OWASP Logging Cheat Sheet: use logs for security and operational analysis while excluding or masking sensitive data.
- NIST SP 800-61 Rev. 3: preserve evidence and support detection, response, and recovery activities during incident handling.

## Prove Absence Of Unsafe Surfaces

For each item, capture at least one sanitized response sample, audit/log sample, static grep result if the operator can run it, or screenshot/log reference with sensitive data redacted.

| Unsafe surface | Evidence to capture | Pass condition |
|---|---|---|
| Download route/token | Route inventory, response sample, static grep, or release note. | No download route or token appears. |
| Artifact bytes | Response samples from status/detail/sync-summary. | No artifact bytes are returned. |
| Public URL/storage path | Response and audit/log samples. | No public URL, storage path, storage key, or full object key appears. |
| OpenAI upload | Static grep, service dependency review, or logs. | No OpenAI upload path is invoked. |
| Action import | Static grep or response/log review. | No action import surface appears. |
| Approval/dry-run/live | Response/log/dependency review. | No approval workflow, dry-run, or live execution appears. |
| Provider mutation | Static grep, provider log review, or dependency review. | No provider mutation is called from public surface. |
| Provider validateOnly | Static grep, provider log review, or dependency review. | No provider validateOnly path is opened. |
| New provider adapter | Release/file inventory. | No new provider adapter is included. |
| Phase 3 | Release/change inventory. | No Phase 3 scope appears. |

## Static Safety Checks If Operator Can Run Them

Example commands to run from repo root, if appropriate for the operator environment:

```text
rg -n "download|downloadToken|artifactBytes|publicUrl|storageLocation|storageKey" backend/src/ai-data-pack docs/ai-data-pack
```

```text
rg -n "OpenAI|upload|action import|dry-run|live execution|validateOnly|mutate|provider adapter|Phase 3" backend/src/ai-data-pack docs/ai-data-pack
```

Expected result:

- Matches in template warnings, forbidden-scope lists, tests, or docs are acceptable.
- Matches that expose a live route, response field, provider mutation path, or execution dependency must be recorded as a blocker.

## Redaction Rules

Evidence must not include:

- Credentials, tokens, API keys, or cookies.
- Raw request headers or raw request body with sensitive data.
- Raw IP/user-agent if policy treats it as sensitive.
- Raw provider payload/query.
- Raw PII.
- Storage bucket/key/path that can retrieve artifacts.
- Artifact bytes or generated files.

Use sanitized excerpts, internal evidence ids, screenshots with sensitive fields redacted, or bounded summaries.

## Evidence Classification

Classify each safety claim:

| Claim type | Expected classification |
|---|---|
| Sanitized response showing absence of unsafe fields | `direct_evidence` |
| Audit/log sample showing sanitized event | `direct_evidence` |
| Static grep result from operator environment | `direct_evidence` |
| Operator-written summary with links to samples | `operator_report` |
| Blank checklist or template | `template_only` |
| Claim copied only from Codex result docs | `reported_by_codex_only` |
| Missing sample or missing log reference | `missing_evidence` |
| Evidence conflicts with another sample | `contradicted` |
