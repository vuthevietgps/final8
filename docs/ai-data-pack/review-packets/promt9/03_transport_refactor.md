# Transport Refactor

`legacy_searchStream_uses_enforced_wrapper=true`

The legacy sync service no longer owns a raw Axios/searchStream path. It now calls:

```text
GoogleAdsReadonlyTransportService.searchStream()
```

The sync service passes only:

- normalized customer ID;
- normalized login-customer ID;
- allowlisted customer IDs;
- adapter-owned template ID;
- validated date range for metric templates;
- absolute deadline.

The transport wrapper remains responsible for:

- Google Ads origin;
- POST method;
- `/v*/customers/{allowlistedCustomerId}/googleAds:searchStream` path;
- credential loading;
- request timeout;
- absolute deadline abort;
- static-template query construction;
- rejection of caller-supplied URL/path/method/headers/query/GAQL/mutation/operations/validateOnly.

Focused tests prove the legacy service source contains no raw `axios`, Google Ads URL, `googleAds:searchStream`, or GAQL query text.
