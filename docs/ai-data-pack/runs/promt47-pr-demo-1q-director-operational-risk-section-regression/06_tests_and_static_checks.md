# Tests And Static Checks

Targeted Jest test:

Command:

`cd backend; npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`

Result:

- Passed.
- Test suites: 1 passed, 1 total.
- Tests: 38 passed, 38 total.
- Focused guard in output: `keeps hardened operational risk findings read-only on the evidence schema contract`.

Backend build:

Command:

`cd backend; npm run build`

Result:

- Passed.

Static scan 1:

`rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing OpenAI/config/provider/upload/Google Ads code outside Prompt47 scope.
- No Prompt47 code added provider execution, validateOnly, OpenAI/ChatGPT call, dry-run/live execution, upload, or ads execution plan behavior.

Static scan 2:

`rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|purchase order mutation|supplier order mutation|inventory mutation|stock mutation|cost mutation|price mutation|COGS mutation|cashflow mutation|payroll mutation|timesheet mutation|mutate|create_purchase|change_supplier|change_staff|create_schedule" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Prompt47-related matches in `ai-data-pack.service.spec.ts` are banned-key/advisory text assertions such as `mutate` and `do_not_*`, not executable mutation paths.
- Other matches are pre-existing application writes or provider code outside Prompt47 scope.
- No Prompt47 code added DB writes, destructive operations, business mutations, or provider mutations.

Static scan 3:

`rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing token/security/redaction code and redaction tests.
- Prompt47 added no plaintext secret, credential, API key, token, authorization header, or client secret.

PowerShell note:

- The `Select-Object -First 200` scans returned non-zero after truncation while still producing output. Matches were classified from the returned output.
