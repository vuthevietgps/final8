# 07 RBAC And Denial Policy

Denial cases:

- missing permission
- profile mismatch
- artifact profile mismatch
- job owner mismatch
- unassigned reviewer
- investor trying full pack
- manager trying finance/employee/supplier detail
- system worker trying human read/download
- sync detail requested by default-denied profile

Denial behavior:

- Fail closed.
- Return a generic denial.
- Audit the exact internal reason.
- Do not leak job existence where 404-style denial is required.
- Do not run source sync on denied create.
- Do not generate artifact or token on denied create.

Permission notes:

- Do not infer authorization from broad roles.
- Check explicit permission, redaction profile, section access profile, job ownership/assignment, and endpoint purpose.
- `google-ads.read` is not sufficient for sync-summary or export creation.
