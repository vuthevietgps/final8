# Partial Export Policy

Purpose:

- Allow ChatGPT Web to critique the business with incomplete data while preventing false confidence.

Required behavior:

1. Create export job with `exportMode=partial_export`.
2. Use `syncPolicy=sync_if_stale`.
3. Run DB-only pre-assessment.
4. Call approved adapters only when policy and scope allow.
5. Run DB-only post-assessment after any adapter invocation.
6. Export with warnings, source impacts, and locked decision gates.
7. Complete as `completed_with_warnings` unless a security/RBAC/artifact safety issue blocks export.

Partial export must not:

- Claim data is complete when it is stale/missing/unsupported.
- Treat `no_records_for_report_date` as verified zero.
- Produce strong ads, profit, sales, cash, supplier, LTV, or employee conclusions when the corresponding gate is locked.
- Open action import, dry-run, or live execution.

Allowed ChatGPT output:

- `action_draft`
- `recommendation`
- `investigation_request`
- `monitoring_task`
- `needs_director_approval`
