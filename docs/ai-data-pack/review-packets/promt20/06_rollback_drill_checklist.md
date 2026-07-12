# Rollback Drill Checklist

Main document:

- `docs/ai-data-pack/rollout-execution/public-create-status-rollback-drill-checklist.md`

Drill steps include:

- Remove/restrict permissions.
- Confirm affected users are blocked or reduced to intended access.
- Gateway/reverse proxy restriction if available.
- VPN/IP restriction if available.
- Tighten rate limits.
- Confirm endpoint audit still persists.
- Confirm no audit deletion occurred.
- Confirm forbidden surfaces remain disabled.
- Preserve incident/drill evidence.
- Document re-enable steps.

Rollback success criteria:

- Affected users blocked or reduced to intended access.
- Audit/log still active.
- No download/action/live/provider mutation appears.
- Operators know how to re-enable controlled access.
- Evidence is preserved.
