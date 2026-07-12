# Tests And Static Checks

Focused test command:

```text
cd backend
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
```

Result:

```text
PASS src/ai-data-pack/ai-data-pack.service.spec.ts
Test Suites: 1 passed, 1 total
Tests: 38 passed, 38 total
```

Build command:

```text
cd backend
npm run build
```

Result:

```text
PASS: nest build
```

Static scan 1:

```text
rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack backend/src | Select-Object -First 200
```

Classification:

- Existing app Google Ads/OpenAI/upload/provider modules outside Prompt45 scope.
- Existing ai-data-pack reading-rule and data-quality dry-run/live gate assertions.
- New Prompt45 banned-key constants and guard assertion text only.
- New unsafe callable path: none.

Static scan 2:

```text
rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|purchase order mutation|supplier order mutation|inventory mutation|stock mutation|cost mutation|price mutation|COGS mutation|cashflow mutation|payroll mutation|timesheet mutation|mutate|create_purchase|change_supplier|change_staff|create_schedule" backend/src/ai-data-pack backend/src | Select-Object -First 200
```

Classification:

- Existing application writes/mutations outside Prompt45.
- Existing ai-data-pack export/source-sync plumbing.
- Existing `not_allowed_actions` assertions and advisory safety text.
- New unsafe callable path: none.

Static scan 3:

```text
rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack backend/src | Select-Object -First 200
```

Classification:

- Existing auth/token/OpenAI/ad modules outside Prompt45.
- Existing redaction utilities/tests.
- New plaintext secret or secret logging: none.

