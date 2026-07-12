# Tests And Static Checks

Targeted Jest test:

Command:

`cd backend; npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`

Result:

- Passed.
- Test suites: 1 passed, 1 total.
- Tests: 38 passed, 38 total.
- Focused guard name in output: `keeps hardened operational risk findings read-only on the evidence schema contract`.

Backend build:

Command:

`cd backend; npm run build`

Result:

- Passed.

Required static scans:

1. `rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing ads/operator/provider/upload references outside the Prompt46 test change, plus existing Google Ads contract tests.
- No Prompt46 code added provider execution, validateOnly, OpenAI call, ChatGPT Web call, dry-run/live execution, or ads execution plan path.

2. `rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|purchase order mutation|supplier order mutation|inventory mutation|stock mutation|cost mutation|price mutation|COGS mutation|cashflow mutation|payroll mutation|timesheet mutation|mutate|create_purchase|change_supplier|change_staff|create_schedule" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing application writes in unrelated modules and existing Google Ads execution/validation code.
- No Prompt46 code added DB writes, business mutations, provider mutations, or delete/drop operations.

3. `rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing token/redaction/security code and redaction tests.
- Prompt46 added no plaintext secret, credential, token, authorization value, API key, or client secret.

Note:

- The static scans intentionally cap output with `Select-Object -First 200`; PowerShell reported non-zero exit for the truncated pipelines while still returning matches. The matches were manually classified.
