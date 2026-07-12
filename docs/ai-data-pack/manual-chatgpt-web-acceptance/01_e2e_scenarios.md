# E2E Scenarios

## Scenario A - Official JSON E2E

Status: accepted for ERP-side export and download.

Evidence:

- `export-job.service.spec.ts` test: `creates an official internal lifecycle job with a rendered redacted JSON artifact`.
- `export-job-endpoint.controller.spec.ts` test: `streams a newly rendered official redacted artifact`.

Verified behavior:

- Official export reaches `completed`.
- Artifact class is `downloadable_redacted_artifact`.
- Redaction runtime is `pre_rendered`.
- Artifact rendering is `rendered`.
- `downloadReady=true`.
- Download endpoint streams JSON for an authorized director/admin.
- Response includes checksum and `x-ai-data-pack-manifest-only=false`.
- Response headers do not expose storage path, public URL, or download token.
- Downloaded body is parsed as JSON by the test harness.

## Scenario B - Partial JSON E2E

Status: accepted for ERP-side export and render readiness; download uses the same direct authenticated endpoint gates.

Evidence:

- `export-job.service.spec.ts` test: `uses sync_if_stale for partial export and reclassifies weak source data as warnings`.
- Prompt 24/25 endpoint tests verify mode/profile download gates on the direct endpoint.

Verified behavior:

- Partial export can reach `completed_with_warnings`.
- Partial source blocking reasons can be downgraded to warnings.
- Artifact class is `downloadable_redacted_artifact`.
- Redaction runtime is `pre_rendered`.
- Artifact rendering is `rendered`.
- `downloadReady=true`.
- Redaction profile and section access profile remain `manager_marketer` for the partial actor.

## Scenario C - Negative Boundaries

Status: accepted by automated endpoint tests.

Verified behavior:

- Manager cannot download official/full director artifact.
- Investor remains status-only unless explicitly assigned and permitted.
- Unassigned reviewer receives no-leak denial.
- `system_internal_worker` is denied human download.
- Manifest-only/deferred official artifact returns `409`.
- Checksum mismatch returns `409`.
- Forbidden download query fields are rejected before job lookup.
- Storage paths, public URLs, artifact bytes, and download tokens are not exposed in JSON responses or download headers.

## Scenario D - Manual ChatGPT Web Workflow Package

Status: documented.

Created files:

- `04_manual_chatgpt_web_upload_guide.md`
- `05_chatgpt_web_analysis_prompt.md`
- `chatgpt-web-analysis-prompt.md`

Manual external execution status:

- Not executed by Codex.
- Human operator must upload the downloaded JSON manually to ChatGPT Web.
- Any ChatGPT Web output remains non-executable and must not be imported into ERP in this phase.

