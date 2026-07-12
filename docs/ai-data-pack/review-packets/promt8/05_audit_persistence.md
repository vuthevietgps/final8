# Audit Persistence

`adapter_audit_persistence=implemented`

Collection: `ai_data_pack_source_sync_audits`

The audit service performs immutable creates with export-job/correlation/source/policy/scope fields, sanitized customer IDs, date range, lock outcome, attempts, retry classifications, provider/mutation flags, status, per-account status, assessment references, bounded errors, timestamps, and fixed false action/live invariants.

Audit errors are limited to 100 entries, messages are bounded/redacted, customer IDs are normalized and limited, and raw headers/bodies/provider responses/stacks/tokens/credentials are not persisted.

Tests prove required fields, sanitization, lock/attempt/policy evidence, and fixed false safety invariants.

