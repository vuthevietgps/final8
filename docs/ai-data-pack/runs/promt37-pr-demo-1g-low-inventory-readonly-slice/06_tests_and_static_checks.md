# Tests And Static Checks

## Tests

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
Tests: 21 passed, 21 total
```

Added coverage:

- positive test: surfaces `low_inventory_best_seller` read-only evidence row
- negative test: does not create the row when sales velocity is missing

## Build

Command:

```text
npm run build
```

Working directory:

```text
C:\Users\PC\Documents\code\htxbachgia.shop\final8-version16\backend
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
Only existing test assertions for blocked data-quality gates were matched:
backend/src/ai-data-pack/ai-data-pack.service.spec.ts:432 can_import_action_file false
backend/src/ai-data-pack/ai-data-pack.service.spec.ts:434 can_execute_live false
```

Command:

```text
rg -n "mutate" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

```text
Only safety strings were matched:
backend/src/ai-data-pack/queries/operations-capacity.query.ts:245 do_not_mutate_inventory
backend/src/ai-data-pack/ai-data-pack.service.spec.ts:382 do_not_mutate_inventory
```

Command:

```text
rg -n "deleteMany\(\{\}\)|dropDatabase|\.drop\(" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

```text
No matches.
```

No MongoDB instance was contacted by these tests; the focused tests use an in-memory fake connection.

