# Transport Enforcement

`transport_allowlist_enforcement=runtime_wrapper`

`GoogleAdsReadonlyTransportService` constructs the request internally and enforces:

```text
https://googleads.googleapis.com
POST
/v*/customers/{allowlistedCustomerId}/googleAds:searchStream
adapter-owned static GAQL templates
request timeout and absolute deadline
```

It rejects caller URL/path/method/headers/credentials/query/GAQL/mutation/operations/validateOnly fields before HTTP or credential loading.

The legacy `GoogleAdsReadonlySyncService` owns a separate Axios path outside Prompt 8's authorized source scope. It was not modified. The isolated module therefore binds `GoogleAdsReadonlyBlockedSyncPortService`, not the legacy service.

```text
blocked_by_transport_integration=true
actual_adapter_provider_sync=fail_closed
```

Separate socket-connect timeout is not claimed; request timeout and absolute deadline are enforced.

