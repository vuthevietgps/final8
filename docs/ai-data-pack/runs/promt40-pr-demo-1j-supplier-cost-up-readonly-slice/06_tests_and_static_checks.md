# Tests And Static Checks

Tests run:

```text
cd backend
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
```

Result:

```text
PASS
Test Suites: 1 passed, 1 total
Tests: 25 passed, 25 total
```

Build run:

```text
cd backend
npm run build
```

Result:

```text
PASS
nest build completed
```

Focused test coverage added:

- Unit/service test for `supplier_cost_up` evidence row.
- Negative test when prior supplier cost is absent.
- Downgrade test when dealer price history is missing.

Static checks run:

```text
rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|mutate|price update|create_purchase_order|create_supplier" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack/queries/operations-capacity.query.ts
```

Static check result:

- Provider/action/OpenAI/live scan only matched existing test assertions for ChatGPT reading rules and dry-run/live gates.
- Mutation scan only matched `not_allowed_actions` and advisory wording.
- Secret scan on changed query returned `NO_MATCH`.

