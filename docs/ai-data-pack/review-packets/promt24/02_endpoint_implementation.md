# Endpoint Implementation

Route:

```text
GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download
```

Implemented in:

- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-artifact.service.ts`

Controller behavior:

- Uses the existing JWT guard.
- Builds sanitized request context.
- Uses raw response streaming so the JSON redaction interceptor does not inspect the stream.
- Sets only safe download headers.
- Calls service completion/failure audit callbacks after stream result.

Service behavior:

- Rejects forbidden query inputs.
- Audits every request attempt.
- Applies download rate limits before loading/streaming.
- Loads the job through the existing endpoint job lookup.
- Checks artifact eligibility before opening storage.
- Verifies file size and checksum before returning a stream.

No tokenized download route was added.
