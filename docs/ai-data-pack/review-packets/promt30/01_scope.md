# Scope

## In Scope

- Verify demo seed dry-run still works.
- Apply medium profile only if a safe throwaway MongoDB URI exists.
- Check idempotency only if apply can run safely.
- Generate Director export only after demo records are applied.
- Download/parse JSON only after export exists.
- Record expected AI findings only from actual export evidence.

## Out Of Scope

- Production DB usage.
- Broad delete/drop.
- External API calls.
- OpenAI/ChatGPT API calls.
- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run/live ads execution.
- Provider mutation or provider `validateOnly`.
- New provider adapter.
- Phase 3.

## Missing Inputs

| Input | Impact | Can continue |
| --- | --- | --- |
| `MONGODB_URI` safe throwaway/dev/test target | Blocks apply, reset, export, download, and expected finding verification. | false for DB/export steps; true for dry-run/test/build/static/docs |
| `docs/ai-data-pack/chuoi-promt-codex-chatgptweb-ledger-v29.md` | Optional guard file missing; Prompt 28/30 source docs define scope. | true |
| `docs/ai-data-pack/lo-trinh-ai-data-pack-roadmap-v29.md` | Optional roadmap missing; no scope expansion performed. | true |
| `docs/ai-data-pack/truc-giu-ba-ai-data-pack-v26.md` | Optional guard file missing; Prompt 23-29 constraints preserved. | true |
| `docs/ai-data-pack/ba-master-addendum-prompt28-review-prompt30-demo-apply-export-20260614.md` | Optional addendum missing; Prompt 30 and Prompt 28 result docs are sufficient. | true |
