# 04 Director Export Result

Director export was executed after seed apply and idempotency passed.

The first full source-module attempt was blocked by source `ts-node` runtime schema metadata for union fields. The final successful harness used compiled `backend/dist` in a minimal Nest application context with existing export endpoint/job services, source sync services, Director Data Pack service, and read-only demo MongoDB access.

Additional finding: `cached_export` completed, but direct download was denied because cached export jobs do not currently persist `redactionProfile`, which the download policy requires.

Successful export:

| Field | Value |
|---|---|
| export_mode | `partial_export` |
| sync_policy | `sync_if_stale` |
| report_date | `2026-06-14` |
| pack_type | `director_data_pack` |
| format | `json` |
| source | local demo seed DB |
| job_id | `AIDP-20260614042421-7ac17e6d` |
| status | `completed` |
| redaction_profile | `director_redacted` |
| section_access_profile | `director-demo` |
| artifact_id | `e01a501d836577c026075f9937ef81ff` |
| artifact_class | `downloadable_redacted_artifact` |
| redaction_runtime | `pre_rendered` |
| artifact_rendering | `rendered` |
| download_ready | `true` |
| file_size_bytes | 95800 |
| checksum_algorithm | `sha256` |
| provider_sync_attempted | `false` |
| live_execution | `false` |
| warnings | 0 |
| blocking_reasons | 0 |

