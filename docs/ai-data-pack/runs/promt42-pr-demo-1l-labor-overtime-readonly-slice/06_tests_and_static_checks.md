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
Tests: 32 passed, 32 total
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

- Unit/service test for `labor_overtime_high` evidence row.
- Overtime growth calculation test.
- Revenue growth comparison test.
- Negative test when revenue comparison period is missing.
- Negative test when overtime hours are missing.
- Confidence downgrade assertion for missing SLA/staff capacity/canonical threshold.

Static checks run:

```text
rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|staffing action|schedule action|payroll|timesheet|order/revenue mutation|cashflow mutation|mutate|create_schedule|change_staff" backend/src/ai-data-pack/queries/operations-capacity.query.ts backend/src/ai-data-pack/ai-data-pack.service.spec.ts
rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack/queries/operations-capacity.query.ts
```

Static check result:

- Provider/action/OpenAI/live scan only matched existing test assertions for ChatGPT reading rules and dry-run/live gates.
- Mutation/action scan only matched `not_allowed_actions` and advisory safety text.
- Secret scan on changed query returned `NO_MATCH`.

