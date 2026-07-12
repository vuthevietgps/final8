# Remaining Gaps And Backlog

| Gap | Classification | Notes |
|---|---|---|
| XLSX official/partial rendering unsupported | future_phase | Not required for JSON BA closeout. Candidate: `PR-2.3B-5F`. |
| Human ChatGPT Web transcript not attached | acceptable_for_current_ba | Manual workflow is accepted; transcript can be attached later. |
| No configured `backend/test/jest-e2e.json` harness | future_phase | Focused Jest/build/static checks exist; dedicated E2E harness can be added later. |
| Partial JSON HTTP download has no separate named smoke command | acceptable_for_current_ba | Partial render readiness plus shared endpoint gates accepted in Prompt 26. |
| Artifact expiration/revocation/quarantine not modeled | future_phase | Needed before broader artifact lifecycle governance. |
| Rate-limit/audit not high-volume multi-pod public ready | future_phase | Current posture is controlled/internal acceptance grade. |
| No OpenAI upload | not_in_scope | Intentional design boundary for this branch. |
| No action import | not_in_scope | Intentional design boundary for this branch. |
| No dry-run/live execution | not_in_scope | Intentional design boundary for this branch. |
| No provider mutation/validateOnly | not_in_scope | Intentional design boundary for this branch. |

Must fix now:

```text
none
```

Current closeout is not blocked by these gaps because the accepted business loop is JSON export/download plus manual ChatGPT Web analysis only.

