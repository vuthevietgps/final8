# Tests Run

Passed:

```powershell
npm test -- --runTestsByPath src/ai-data-pack/export-jobs/export-job.service.spec.ts --runInBand
```

Result:

```text
20 passed
```

Passed:

```powershell
npm test -- --runTestsByPath src/ai-data-pack/export-jobs/export-job-endpoint.controller.spec.ts --runInBand
```

Result:

```text
41 passed
```

Passed:

```powershell
npm run build
```

Local E2E note:

```text
npm run test:e2e
```

was not run because `backend/package.json` points to `./test/jest-e2e.json`, but `backend/test/jest-e2e.json` is absent. The repo does not currently expose a configured AI Data Pack E2E harness.

