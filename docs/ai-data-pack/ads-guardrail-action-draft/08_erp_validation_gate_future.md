# Future ERP Validation Gate

This file specifies a future validation gate only. It is not implemented in Prompt 29.

## Future Validation Goals

If a future phase ever allows ERP to receive a ChatGPT Web recommendation draft, ERP must validate the draft before storing, showing for approval, dry-running, or executing anything.

Prompt 29 does not add that import path.

## Required Future Checks

| Check | Requirement |
| --- | --- |
| Validate schema | Output must match the advisory recommendation schema. |
| Validate guardrail snapshot exists | `guardrail_snapshot_id` must exist and match an exported Director snapshot. |
| Validate guardrail snapshot freshness | Snapshot must be within `valid_from`/`valid_to`. |
| Validate budget cap | Recommended daily/weekly/monthly totals must be cap-checked. |
| Validate approval_required flag | ERP must recompute approval rules and reject inconsistent `approval_required=false`. |
| Validate no execution fields | Reject `execute`, `dryRun`, `liveExecution`, `validateOnly`, `providerMutation`, provider mutate payloads. |
| Validate no provider credentials/tokens | Reject credentials, access tokens, refresh tokens, client secrets, API keys. |
| Validate no live/dry-run/provider mutation | Future import must not trigger provider calls by default. |
| Validate no delete actions | Reject delete campaign/ad group/ad actions. |
| Validate platform support | Accept schema values only: google, facebook/meta, tiktok, other. |

## Future Gate Output

```json
{
  "schema_valid": true,
  "guardrail_snapshot_valid": true,
  "budget_cap_valid": true,
  "approval_required_flag_valid": true,
  "no_execution_fields": true,
  "no_credentials_or_tokens": true,
  "no_provider_mutation": true,
  "validation_status": "accepted_for_human_review_only",
  "blocking_errors": [],
  "warnings": []
}
```

## Future Flow If Approved Later

```text
Human downloads ERP JSON
-> Human uploads to ChatGPT Web
-> ChatGPT Web creates advisory draft
-> Future ERP import endpoint validates draft
-> Human reviews validation result
-> Separate future approval workflow may approve
-> Separate future dry-run/provider validateOnly spec may run
-> Separate much later live execution branch may execute
```

Each arrow after advisory draft requires a separate approved phase.
