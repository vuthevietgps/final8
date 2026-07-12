# Ket qua Prompt 28

Status: completed for code, dry-run, tests, build, and documentation. DB apply/export smoke test is intentionally left as a recorded gap because no safe throwaway MongoDB URI was provided in this run.

## Summary

- Created deterministic Director AI Data Pack demo seed under `backend/src/ai-data-pack/demo-seed/`.
- Added npm script `seed:ai-data-pack:director:demo`.
- Added profile support: `small`, `medium`, `large`.
- Added modes: `--dry-run`, `--apply`, `--reset-demo`.
- Added dev/test guard: `NODE_ENV` must not be `production`, and `ALLOW_DEMO_SEED=1` is required.
- Added deterministic reset by `_id` allowlist; no broad delete/drop.
- Added unit tests and docs.

## Verification

Passed:

- `npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand`
- `npm run seed:ai-data-pack:director:demo -- --dry-run --profile small`
- `npm run build`
- Static grep for external API/action execution/OpenAI references: no matches.
- Static grep for broad delete/drop: no matches.

Not run:

- `--apply` or `--reset-demo` against MongoDB.
- Director Data Pack export from applied demo records.

## Files Changed

- `backend/package.json`
- `backend/src/ai-data-pack/demo-seed/director-demo-seed.config.ts`
- `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts`
- `backend/src/ai-data-pack/demo-seed/director-demo-seed.spec.ts`
- `backend/src/ai-data-pack/demo-seed/director-demo-seed.ts`
- `backend/src/ai-data-pack/demo-seed/director-demo-seed.types.ts`
- `docs/ai-data-pack/demo-data/00_director_demo_seed_overview.md`
- `docs/ai-data-pack/demo-data/01_schema_mapping.md`
- `docs/ai-data-pack/demo-data/02_runbook.md`
- `docs/ai-data-pack/demo-data/03_expected_ai_findings.md`
- `docs/ai-data-pack/review-packets/promt28/00_summary.md`
- `docs/ai-data-pack/review-packets/promt28/01_schema_mapping_summary.md`
- `docs/ai-data-pack/review-packets/promt28/02_tests_and_safety.md`
- `docs/ai-data-pack/review-packets/promt28/03_risks_and_next.md`
- `docs/ai-data-pack/ketquapromt28.md`
- `docs/ai-data-pack/ketquapromt28.json`
