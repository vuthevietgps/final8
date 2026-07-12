# Future Test Plan

Implementation phase tests should include:

1. Official export blocks when a critical source is stale and sync fails.
2. Official export completes only when post-sync DB assessment passes.
3. Official export downgrade to partial requires explicit policy.
4. Partial export completes with warnings.
5. Partial export locks affected decision gates.
6. Cached export never syncs.
7. Google Ads sync policy uses adapter only under policy.
8. Post-sync DB-only assessment controls gates.
9. Public endpoint RBAC denies unauthorized users.
10. Artifact download requires permission.
11. Section-level redaction works.
12. Investor profile cannot access full Director Pack.
13. No action/import/dry-run/live gate opens.
14. No provider mutation or validateOnly is reachable.
15. No false zero: `no_records_for_report_date` is distinct from verified zero.
