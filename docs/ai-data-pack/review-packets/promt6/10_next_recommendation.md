# Next Recommendation

Stop after `PR-2.3B-3A`.

The repository is suitable for a separately reviewed future adapter code PR only
after the following design decisions are approved:

1. Create a narrow internal Google Ads read-only adapter/module around
   `GoogleAdsReadonlySyncService.sync()` only.
2. Approve exact provider endpoint and local-write allowlists.
3. Approve dedicated sync-execution and sync-detail permissions.
4. Approve fail-closed customer/login-customer scope policy.
5. Approve lock, idempotency, timeout, retry, rate-limit, and partial-failure
   policies.
6. Approve sync-run audit/schema changes and export-job linkage.
7. Approve tests that prove the adapter dependency graph cannot reach mutation
   or execution paths.

Recommended next phase, only after separate authorization:

```text
PR-2.3B-3B - Google Ads Read-only Adapter isolation and guards
```

That future PR must still exclude official/partial export orchestration, public
endpoints, action import, provider validate-only, approval, dry-run, live
execution, OpenAI/upload work, and Phase 3 unless each is separately approved.

Do not create Prompt 7 automatically.

