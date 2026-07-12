# Tests And Static Checks

Focused test command:

`cd backend; npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`

Initial result:

- Failed before exporter fix.
- Error: `Text length must not exceed 32767 characters`.
- This confirmed the nested XLSX compatibility issue.

Final result:

- Passed.
- Test suites: 1 passed, 1 total.
- Tests: 38 passed, 38 total.

Build command:

`cd backend; npm run build`

Build result:

- Passed.

Static scan 1:

`rg -n "OpenAI|chatgpt|Action Draft|ActionImport|action import|validateOnly|Provider|GoogleAds|Mutate|execute_live|dry_run|upload|ads_execution_plan" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing provider/OpenAI/upload/read-only adapter references outside Prompt49.
- Prompt49 added no OpenAI/ChatGPT Web call, provider execution, validateOnly, dry-run/live path, upload path, or ads execution plan path.

Static scan 2:

`rg -n "deleteMany|dropDatabase|\\.drop\\(|insertOne|insertMany|updateOne|updateMany|findOneAndUpdate|save\\(|purchase order mutation|supplier order mutation|inventory mutation|stock mutation|cost mutation|price mutation|COGS mutation|cashflow mutation|payroll mutation|timesheet mutation|mutate|create_purchase|change_supplier|change_staff|create_schedule" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Prompt49-related ai-data-pack matches are test banned-key text, `not_allowed_actions`, or existing read-only/source-sync test code.
- Other matches are pre-existing application/provider modules outside Prompt49.
- Prompt49 added no DB writes, destructive operations, provider mutations, or business mutations.

Static scan 3:

`rg -n "password|secret|token|authorization|api[_-]?key|client_secret" backend/src/ai-data-pack backend/src | Select-Object -First 200`

Classification:

- Matches are existing token/security/redaction code and tests.
- Prompt49 added no plaintext secret, credential, token, authorization header, API key, or client secret.

PowerShell note:

- `Select-Object -First 200` may close the pipeline early and return non-zero while still producing match output. Returned matches were classified.
