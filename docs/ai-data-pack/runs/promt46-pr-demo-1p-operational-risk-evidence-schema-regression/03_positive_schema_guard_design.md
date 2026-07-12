# Positive Schema Guard Design

Guard location:

`backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Focused test:

`keeps hardened operational risk findings read-only on the evidence schema contract`

Design:

- Build the five targeted rows from deterministic fake in-memory `collections`.
- Filter rows by the five hardened `finding_key` values.
- Assert all five target keys are emitted.
- Assert each canonical field exists and is not null, undefined, an empty string, or an empty array.
- Assert `data_quality_status` is one of the current repo enum values.
- Assert `confidence` is one of the current repo enum values.
- Assert partial/weak rows include downgrade/advisory context.
- Assert each finding has its required minimum field groups.
- Preserve Prompt45 recursive banned-key scan against action, provider, import, live, dry-run, mutation, and ads execution payload keys.
- Assert `not_allowed_actions` exists and contains advisory `do_not_` text.

Code references:

- Canonical field list starts at `ai-data-pack.service.spec.ts:45`.
- Finding-specific field groups start at `ai-data-pack.service.spec.ts:88`.
- Evidence value helper starts at `ai-data-pack.service.spec.ts:184`.
- Focused test starts at `ai-data-pack.service.spec.ts:499`.

No production data path is involved.
