# Cached Export Metadata Decision

Prompt 31 found that `cached_export` could complete, but direct download was denied because cached jobs do not currently persist the `redactionProfile` metadata required by download policy.

Prompt 32 records this as a current demo harness limitation rather than changing cached export behavior.

## Decision

Decision: `document_current_limitation`

Status: `cached_export_not_primary_for_prompt32_download_evidence`

Primary acceptance path: Director `partial_export` JSON artifact download.

## Reason

The Prompt 32 objective was to surface the three missing demo findings and prove the Director JSON download path. A focused `partial_export` rerun was sufficient and avoided expanding scope into cached job metadata migration.

## Deferred Follow-Up

A future small task can persist or derive the needed `redactionProfile` metadata for cached jobs if cached downloads become part of the acceptance path.

