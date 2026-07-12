# Tests Run

Passed:

```powershell
npm test -- --runTestsByPath src/ai-data-pack/export-jobs/export-job-endpoint.controller.spec.ts --runInBand
```

Result:

```text
40 passed
```

Passed:

```powershell
npm test -- --runTestsByPath src/ai-data-pack/export-jobs/export-job.service.spec.ts --runInBand
```

Result:

```text
18 passed
```

Passed:

```powershell
npm run build
```

Coverage focus:

- Authorized rendered artifact download.
- Official/partial deferred returns `409`.
- Manager official download denied.
- System worker denied.
- Unassigned reviewer denied/no leak.
- Forbidden query fields rejected before job lookup.
- Checksum mismatch returns `409`.
- No storage path/public URL in response.
- Safe filename pattern.
- Audit events emitted.
- Download rate limits enforced.
- No download-token route.
- No OpenAI/action/live/provider mutation/validateOnly integration.
