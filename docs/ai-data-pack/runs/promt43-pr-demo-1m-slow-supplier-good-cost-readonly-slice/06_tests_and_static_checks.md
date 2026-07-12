# Tests And Static Checks

Tests run:

```text
cd backend
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
```

Result:

```text
PASS src/ai-data-pack/ai-data-pack.service.spec.ts
Test Suites: 1 passed, 1 total
Tests: 37 passed, 37 total
```

Build run:

```text
cd backend
npm run build
```

Result:

```text
PASS: nest build
```

Prompt43 focused tests added:

- `surfaces slow supplier good cost rows as read-only Director evidence`
- `does not create slow supplier good cost evidence when product mapping is missing`
- `does not create slow supplier good cost evidence when peer supplier cost source is missing`
- `does not create slow supplier good cost evidence when slow delivery signal is missing`
- `downgrades slow supplier good cost evidence when thresholds and acceptance status are incomplete`

Static checks run on changed code/test files:

```text
rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

- Matches are existing ChatGPT Web reading rules / dry-run-live safety assertions, plus a Prompt43 assertion that evidence rows do not contain action/provider/live fields.
- No callable OpenAI, action import, provider, validateOnly, dry-run, live, or upload path was added.

```text
rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|purchase order mutation|supplier order mutation|inventory mutation|stock mutation|cost mutation|price mutation|COGS mutation|cashflow mutation|mutate|create_purchase|change_supplier|do_not_create_purchase_order|do_not_change_supplier_order|do_not_mutate_inventory|do_not_mutate_stock|do_not_mutate_supplier_cost|do_not_mutate_price|do_not_mutate_cogs|do_not_mutate_cashflow" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

- Matches are `not_allowed_actions` safety text and tests asserting those safety strings.
- No supplier/order/inventory/stock/cost/price/COGS/cashflow mutation path was added.

```text
rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Result:

- Matches are pre-existing redaction tests only.
- No secret was added or printed by Prompt43.

