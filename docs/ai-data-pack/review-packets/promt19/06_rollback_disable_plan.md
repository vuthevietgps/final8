# Rollback And Disable Plan

Main document:

- `docs/ai-data-pack/rollout/public-create-status-rollback-disable-plan.md`

Rollback controls:

- Remove AI Data Pack export permissions from affected users.
- Remove or reduce rollout cohort role-permission binding.
- Restrict endpoint access at gateway/reverse proxy if available.
- Restrict access to admin IP/VPN if available.
- Disable external access while preserving safe internal admin access if possible.
- Tighten rate-limit config.
- Increase logging/audit review.

Non-negotiable rules:

- Rollback must not delete audit records.
- Rollback must not enable download/action/live/provider mutation.
- Rollback must preserve evidence for incident review.
