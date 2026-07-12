# Risks and Assumptions

- Artifact retention and cleanup are not finalized.
- A process crash during `pending`/`exporting` leaves the active idempotency reservation. Expiry/recovery is deferred and requires manual investigation.
- The unique active-job index must be applied/enabled in the deployment.
- Local artifact storage is not shared multi-pod/cloud storage.
- No public endpoint, status polling, download or RBAC path exists yet.
- Cached export proves neither freshness nor report-date coverage.
- Artifact checksum and data-content checksum intentionally measure different things.
- A failed multi-artifact job may retain already-written immutable artifacts and audit entries.
- Full repository tests were not run.
- Mongoose collection/index creation occurs only when the future service is used in an environment with a database; Prompt 4 did not run it against a DB.
