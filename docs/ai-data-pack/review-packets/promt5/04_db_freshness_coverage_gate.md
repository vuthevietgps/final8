# DB-only Freshness and Coverage Gate

## Freshness

Freshness reads confirmed local collections through direct Mongoose `Connection.collection` reads only.

Evidence methods:

- Successful Google Ads sync run plus local daily metrics.
- Local `max(updatedAt)`/`lastSyncAt`.
- Latest local record date.
- Static configuration timestamps.

No provider/sync/mutation-capable service is injected.

## Coverage

Coverage is separate from freshness:

- `report_date_count` for daily/event sources.
- `date_range_count` for loan/supplier statement ranges.
- `not_applicable` for mapping/static sources.
- `unsupported` for unsupported sources.

A fresh latest row with zero report-date rows returns:

```text
freshnessStatus=fresh
coverageStatus=no_records_for_report_date
canUseForDecision=cautious
```

DB read failures return generic warnings and `unknown`; raw errors are not exposed.
