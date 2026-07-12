# Tests And Static Checks

## Focused Jest

Command:

```text
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
```

Working directory:

```text
C:\Users\PC\Documents\code\htxbachgia.shop\final8-version16\backend
```

Result:

```text
PASS src/ai-data-pack/ai-data-pack.service.spec.ts
Test Suites: 1 passed, 1 total
Tests: 22 passed, 22 total
```

Coverage added/verified:

- reserved quantity from active non-final orders
- reserved exclusion for final/payment-trigger/return statuses
- inactive order exclusion
- ambiguous status exclusion
- incoming quantity from `ordered` and `partially_received` POs
- incoming exclusion for `draft`, `cancelled`, and `received` POs
- incoming exclusion for non-positive remaining quantity
- available quantity recalculation with reserved
- projected available quantity with incoming
- projected days of cover
- missing sales velocity still blocks row
- `not_allowed_actions` remains present

## Build

Command:

```text
npm run build
```

Result:

```text
PASS - nest build completed
```

## Static Safety Checks

Command:

```text
rg -n "fetch\(|axios|node-fetch|OpenAI|ActionImport|ExecutionService|ProviderValidationService|GoogleAds.*Mutat|upload_to_openai|import_action|execute_live|validateOnly" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

```text
Only existing safety test assertions matched:
can_import_action_file false
can_execute_live false
```

Command:

```text
rg -n "mutate" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

```text
Only safety strings matched:
do_not_mutate_inventory
```

Command:

```text
rg -n "deleteMany\(\{\}\)|dropDatabase|\.drop\(" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

```text
No matches.
```

No MongoDB instance was contacted by Prompt 39 tests; they use fake in-memory collection maps.

