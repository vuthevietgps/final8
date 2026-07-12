# Rerun Apply Export Download Evidence

All reruns used the local Docker demo MongoDB database:

`mongodb://127.0.0.1:27018/aidp_demo_20260614`

## Seed Dry-Run Small

Status: `passed`

Key evidence:

- `inventorytransactions_docs=180`
- `returnrequests_docs=17`
- `anomalies_created=12`

## Seed Apply Medium

Status: `passed`

Key evidence:

- `inventorytransactions_docs=2200`
- `returnrequests_docs=100`
- `agentstatements_docs=800`
- `anomalies_created=12`

## Idempotency

Status: `passed`

The medium apply command was run a second time. The reset/delete counts matched the inserted counts and collection counts did not double.

## Root Signal Counts After Apply

| Signal | Count |
|---|---:|
| `agent_late_payment` | `62` |
| `high_return_product` | `17` |
| `inventory_movement_without_matching_purchase_order` | `54` |
| `inventory_movement_dangling_purchase_order` | `54` |

## Director Export

| Field | Value |
|---|---|
| job_id | `AIDP-20260614045658-a295d333` |
| status | `completed` |
| export_mode | `partial_export` |
| sync_policy | `sync_if_stale` |
| redaction_profile | `director_redacted` |
| provider_sync_attempted | `false` |
| live_execution | `false` |
| artifact_id | `6d031b1144ed79478d451ae63a339351` |
| artifact_class | `downloadable_redacted_artifact` |
| artifact_rendering | `rendered` |
| redaction_runtime | `pre_rendered` |
| download_ready | `true` |
| file_size_bytes | `98124` |
| checksum_algorithm | `sha256` |

## Download Validation

| Check | Result |
|---|---|
| Director JSON downloaded | `true` |
| Downloaded JSON parseable | `true` |
| Section count | `25` |
| Operational risk finding count | `3` |
| Storage path exposed | `false` |
| Public URL exposed | `false` |
| Download token exposed | `false` |
| Raw provider payload absent | `true` |
| Credentials/tokens absent | `true` |

