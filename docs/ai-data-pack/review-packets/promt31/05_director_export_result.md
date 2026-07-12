# 05 Director Export Result

Successful export:

- Export mode: `partial_export`.
- Sync policy: `sync_if_stale`.
- Report date: `2026-06-14`.
- Pack type: `director_data_pack`.
- Format: `json`.
- Job ID: `AIDP-20260614042421-7ac17e6d`.
- Status: `completed`.
- Redaction profile: `director_redacted`.
- Artifact ID: `e01a501d836577c026075f9937ef81ff`.
- Artifact class: `downloadable_redacted_artifact`.
- Redaction runtime: `pre_rendered`.
- Artifact rendering: `rendered`.
- Download ready: true.
- Provider sync attempted: false.
- Live execution: false.

Notes:

- Full source-module runtime through `ts-node` was blocked by Mongoose schema metadata for union fields.
- The successful smoke run used compiled `backend/dist` and existing export/job/source-sync services in a minimal Nest context.
- `cached_export` completed but direct download was denied because cached jobs do not currently persist `redactionProfile`.

