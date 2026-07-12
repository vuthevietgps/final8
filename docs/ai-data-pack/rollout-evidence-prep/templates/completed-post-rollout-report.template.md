STATUS: TEMPLATE_ONLY_NOT_EXECUTED
This file is not rollout evidence until completed by a human/operator and copied to docs/ai-data-pack/rollout-evidence/.

# Completed Post-Rollout Report Template

Destination filename:

```text
docs/ai-data-pack/rollout-evidence/completed-post-rollout-report.md
```

## Report Metadata

| Field | Value |
|---|---|
| Environment |  |
| Monitoring window |  |
| Report owner |  |
| Evidence folder/link |  |
| Report timestamp |  |

## Test Results Summary

| Test group | Passed | Failed | Not applicable | Evidence link/path | Notes |
|---|---:|---:|---:|---|---|
| Director/admin create/read |  |  |  |  |  |
| Manager allow/deny behavior |  |  |  |  |  |
| Investor status-only |  |  |  |  |  |
| Unbound/system/reviewer denial |  |  |  |  |  |
| Redaction and manifest-only response |  |  |  |  |  |
| Sync-summary privilege |  |  |  |  |  |
| Idempotency |  |  |  |  |  |
| Rate-limit observable |  |  |  |  |  |
| Audit/log evidence |  |  |  |  |  |

## Audit/Log Sample References

| Signal/event | Evidence link/path | Expected | Observed | Notes |
|---|---|---|---|---|
| `export_create_requested` |  | present |  |  |
| `export_create_accepted` |  | present if create accepted |  |  |
| `export_create_denied` |  | present for denial case |  |  |
| `export_status_viewed` |  | present |  |  |
| `export_detail_viewed` |  | present |  |  |
| `sync_summary_viewed` |  | present for authorized request |  |  |
| `sync_summary_denied` |  | present for denied profiles |  |  |
| `rate_limited` |  | present if threshold tested |  |  |
| `idempotent_request_reused` |  | present |  |  |

## Redaction Verification

Confirm none appeared in responses, audit details, logs, or report attachments:

```text
artifactBytes=
downloadToken=
publicUrl=
storageLocation_or_storageKey=
raw_provider_payload_or_query=
credentials_or_tokens=
raw_request_body_or_headers=
raw_PII=
action_import=
dry_run_live_execution=
provider_mutation_or_validateOnly=
```

## Incident Summary

| Incident | Severity | Containment | Evidence | Owner | Status |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Open Issues

| Issue | Severity | Owner | Target date | Blocks continued rollout? |
|---|---|---|---|---|
|  |  |  |  |  |

## Final Recommendation

Choose one:

```text
continue_controlled_rollout
continue_with_restrictions
pause_for_fix
rollback
hold_for_platform_gate
```

```text
recommendation=
reason=
decision_owner=
decision_timestamp=
```

Do not recommend high-volume public rollout, download, action/live/provider mutation, OpenAI upload, or Phase 3 from this report.
