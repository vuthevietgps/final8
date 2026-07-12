# Risks And Next

Residual risks:

- Apply/reset was not exercised against a real disposable MongoDB database in this run.
- Director Data Pack export was not regenerated from the demo dataset in this run.
- Raw collection inserts intentionally bypass Mongoose validation to keep the seed isolated from services. This is acceptable for dev/test fixtures but should be verified through an export smoke test after DB apply.
- Some existing schemas use localized enum strings. The seed avoids relying on app services, but UI display should be checked after apply.

Recommended next step:

1. Run `--apply --profile medium` against a throwaway dev database.
2. Generate the Director Data Pack export for report date `2026-06-14`.
3. Confirm mapping/data-quality reports show the expected synthetic signals and no live integration activity.
