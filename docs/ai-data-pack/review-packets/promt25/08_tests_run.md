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

Coverage focus:

- Official export creates rendered redacted JSON artifact.
- Partial export creates rendered redacted JSON artifact.
- XLSX official/partial is not faked.
- Failed render leaves `downloadReady=false`.
- Download endpoint streams rendered official artifact.
- Manifest-only artifact remains not downloadable.
- Checksum mismatch blocks download.
- Manager/system/unassigned reviewer boundaries remain.
- No storage path/public URL in response.
- No tokenized download.
- No OpenAI/action/live/provider mutation/validateOnly integration.
