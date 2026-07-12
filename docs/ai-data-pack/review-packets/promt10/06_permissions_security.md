# Permissions And Security

Internal execution permission:

```text
ai-data-pack.source-sync.google-ads.readonly.execute
```

Security behavior:

- Default internal requester uses the narrow source-sync permission.
- `google-ads.read` is not accepted as execution permission.
- Requests containing broad read permission are denied by the orchestrator before adapter invocation.
- Adapter result summaries preserve `mutationAttempted=false`.
- Preparation result gates preserve `canImportActionFile=false`, `canDryRun=false`, and `canExecuteLive=false`.
- No plaintext secret storage, logging, API response, or report output was added.

No broad Director/Manager binding was added.
