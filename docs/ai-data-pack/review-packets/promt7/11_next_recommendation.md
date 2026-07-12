# Next Recommendation

Stop after Prompt 7. Do not create Prompt 8 and do not integrate the adapter into ExportJob yet.

Because lock, transport enforcement, audit persistence, and assessment binding remain incomplete, the next separately reviewed phase should be:

```text
PR-2.3B-3B-H1 - Google Ads read-only transport, lock, and audit hardening
```

Required hardening:

- Bind and test a real distributed lock with owner-only release.
- Enforce origin/path/method and connection/request timeouts at the actual provider transport.
- Make retry behavior enforceable for provider-level failures.
- Enforce or instrument local-write targets.
- Bind DB-only source assessment.
- Persist export-job, scope-hash, lock, attempt, and post-assessment audit fields through separately approved schema work.
- Review and bind narrow permissions through an approved RBAC policy.

Only after that review should `PR-2.3B-3C` ExportJob source-sync integration be considered.

