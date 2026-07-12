# Tests

Commands run:

```text
npm test -- --runInBand export-job-endpoint.controller.spec.ts
npm test -- --runInBand ai-data-pack
npm run build
```

Results:

```text
export-job-endpoint.controller.spec.ts: 18 passed
ai-data-pack suite: 15 suites passed, 122 tests passed
backend build: passed
```

Coverage highlights:

- unauthorized official create denied
- manager official create denied
- partial create permission enforced
- idempotency returns same job
- duplicate idempotency does not call lifecycle twice
- cached create never calls official/partial lifecycle
- official/partial delegates to internal lifecycle
- controller does not call provider directly
- unrelated status read returns generic 404
- status response is redacted and manifest-only
- sync summary default-denied profiles are denied
- sync summary output is sanitized
- forbidden create fields are rejected
- no token, bytes, public URL, or storage path in responses
- no download/download-token route
- legacy GET controller unchanged
