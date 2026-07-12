# Scope

## In scope

- Read existing Prompt 2-5 reports, BA material, AI Data Pack code, Google Ads
  code, account/cost/auth/token/common code, schemas, controllers, jobs, and tests.
- Inventory existing Google Ads provider read and mutation paths.
- Classify safe, guarded, unsafe, and execution-only candidates.
- Review credential storage, secret redaction, OAuth usage, RBAC, account scope,
  rate-limit, timeout, partial failure, and local write behavior.
- Specify a future read-only adapter and its integration prerequisites.
- Produce a future PR test plan.

## Explicitly out of scope

- Source-code or module changes.
- New endpoints, schemas, migrations, permissions, or jobs.
- Any Google Ads or provider API call.
- Real data sync or production-changing command.
- Provider validation, action import, generic dry-run, approval, or execution.
- Official export, partial export, OpenAI/upload work, or Phase 3.

## Inputs

Present:

- `docs/ai-data-pack/ba-master-director-ai-data-pack-dropship-20260612.md`
- `docs/ai-data-pack/ketquapromt2.{md,json}`
- `docs/ai-data-pack/ketquapromt3.{md,json}`
- `docs/ai-data-pack/ketquapromt4.{md,json}`
- `docs/ai-data-pack/ketquapromt5.{md,json}`
- `docs/ai-data-pack/review-packets/promt4/*`
- `docs/ai-data-pack/review-packets/promt5/*`

Missing:

- `missing_input_file: backend/src/config/`

The project index named by `AGENTS.md` as `docs/ai-ads-v2/00-index.md` is not
present. The repository has `docs/ai-ads-v2/00_README_INDEX.md`, which was read
as the available project index.

