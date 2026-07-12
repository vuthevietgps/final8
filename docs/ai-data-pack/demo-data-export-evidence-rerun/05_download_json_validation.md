# 05 Download JSON Validation

Direct authenticated artifact download was executed through `ExportJobEndpointService.downloadArtifact`.

| Check | Result |
|---|---|
| director_json_downloaded | true |
| downloaded_json_parseable | true |
| storage_path_exposed in public responses | false |
| public_url_exposed in public responses | false |
| download_token_exposed in public responses | false |
| raw_provider_payload_absent in downloaded JSON | true |
| credentials_tokens_absent in downloaded JSON | true |
| metadata.export_job_id | `AIDP-20260614042421-7ac17e6d` |
| metadata.export_mode | `partial_export` |
| metadata.cached_export | false |
| metadata.redaction_profile | `director_redacted` |
| metadata.artifact_class | `downloadable_redacted_artifact` |
| metadata.download_ready | true |
| section_count | 25 |

No public URL or token based download path was introduced.

