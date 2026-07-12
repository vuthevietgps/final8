# Risks and Assumptions

## Risks and Limitations

- Legacy Google Ads read-only sync still owns its Axios and persistence operations outside the Prompt 8 boundary.
- The adapter's real sync port is intentionally fail-closed until transport integration is approved.
- Declared write-target instrumentation is not actual persistence interception.
- A separate socket-connect timeout is not claimed; request timeout and absolute deadline are enforced.
- Mongo unique/TTL indexes must be created and monitored in each deployed environment.
- The audit is internal and has no public read endpoint or bound detail-read permission.

## Assumptions

- ERP remains the only system allowed to call Google Ads.
- A future transport refactor will preserve static adapter-owned queries and exact searchStream allowlisting.
- Source Registry/Freshness/Coverage remain DB-only.
- No broad role receives the new permissions without separate policy approval.

