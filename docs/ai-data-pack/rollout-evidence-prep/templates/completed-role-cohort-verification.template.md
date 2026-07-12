STATUS: TEMPLATE_ONLY_NOT_EXECUTED
This file is not rollout evidence until completed by a human/operator and copied to docs/ai-data-pack/rollout-evidence/.

# Completed Role/Cohort Verification Template

Destination filename:

```text
docs/ai-data-pack/rollout-evidence/completed-role-cohort-verification.md
```

## Metadata

| Field | Value |
|---|---|
| Environment |  |
| Release/build identifier |  |
| Verifier |  |
| Verification window |  |
| Evidence folder |  |

## Role/Cohort Results

| Cohort | Actor placeholder | Allowed endpoint evidence | Forbidden endpoint evidence | Expected denial cases verified? | Actual result | Pass/fail | Evidence link/path | Verified by | Verified at | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Director/admin | `USER_DIRECTOR_ADMIN_001` |  |  |  |  |  |  |  |  |  |
| Manager | `USER_MANAGER_001` |  |  |  |  |  |  |  |  |  |
| Investor status-only | `USER_INVESTOR_001` |  |  |  |  |  |  |  |  |  |
| Explicit permission user | `USER_EXPLICIT_001` |  |  |  |  |  |  |  |  |  |
| Unbound role | `USER_UNBOUND_001` |  |  |  |  |  |  |  |  |  |
| `system_internal_worker` | `USER_SYSTEM_WORKER_001` |  |  |  |  |  |  |  |  |  |
| Unassigned reviewer | `USER_REVIEWER_UNASSIGNED_001` |  |  |  |  |  |  |  |  |  |

## Required Negative Assertions

```text
anonymous_users_denied=
high_volume_public_cohort_absent=
unbound_external_cohort_absent=
download_action_live_provider_surfaces_absent=
```

## Final Role/Cohort Decision

```text
role_cohort_verification_passed=
blocking_failures=
decision_owner=
decision_timestamp=
```
