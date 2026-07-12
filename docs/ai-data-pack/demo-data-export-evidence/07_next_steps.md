# Next Steps

Current result:

```text
blocked_missing_safe_throwaway_mongodb_uri
```

To continue Prompt 30 safely, provide a MongoDB URI that is explicitly disposable/dev/test.

Required properties:

- Not production.
- Not live/main database.
- Database name clearly indicates demo/dev/test/throwaway.
- No real credentials printed in logs or docs.
- Safe to create/delete deterministic demo `_id` records.

Recommended next action:

```text
Provide safe throwaway MONGODB_URI and rerun PR-DEMO-1B.
```

After safe DB is available:

1. Run medium apply.
2. Run medium apply again to verify idempotency.
3. Generate Director AI Data Pack JSON export for `2026-06-14`.
4. Download rendered redacted JSON artifact.
5. Parse and validate JSON.
6. Compare expected AI findings.

Do not open action import, dry-run/live execution, provider mutation, OpenAI upload, or Phase 3.
