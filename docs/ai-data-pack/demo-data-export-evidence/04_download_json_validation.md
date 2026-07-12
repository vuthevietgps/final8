# Download JSON Validation

Status: `not_executed_blocked_missing_safe_throwaway_mongodb_uri`.

JSON artifact download was not executed because Director export was not executed.

Current validation values:

```text
director_json_downloaded=false
downloaded_json_parseable=false
storage_path_exposed=false
public_url_exposed=false
download_token_exposed=false
```

The `false` exposure values mean Prompt 30 did not produce any response exposing storage path, public URL, or token. They are not evidence of a successful download.

## Required Future Checks

When safe DB and export are available:

- Download JSON through `GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download`.
- Parse downloaded body as JSON.
- Confirm no `storageKey`, `storageLocation`, `artifactStoragePath`, `publicUrl`, or `downloadToken`.
- Confirm no provider credentials/tokens.
- Confirm artifact checksum and size gates pass.
