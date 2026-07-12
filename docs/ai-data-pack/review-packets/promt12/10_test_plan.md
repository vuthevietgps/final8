# Test Plan

Future implementation tests:

1. Unauthorized user cannot create official export.
2. Manager cannot download full Director artifact.
3. Investor gets redacted artifact only.
4. Finance section hidden without permission.
5. Employee/payroll hidden without permission.
6. Supplier commission hidden without permission.
7. Customer PII masked without permission.
8. Download token expires.
9. One-time token cannot be reused.
10. Download event audited.
11. Download denial audited.
12. Sync detail sanitized.
13. Artifact manifest contains checksums.
14. Artifact manifest contains sensitivity flags.
15. Cached export still no sync.
16. Official/partial export respects section-level RBAC.
17. No action/import/dry-run/live gate opened.
