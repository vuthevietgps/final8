# Query Templates

Query ownership remains in:

```text
backend/src/ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-query-templates.ts
```

The legacy service selects template IDs only:

- `account`
- `campaigns`
- `campaign_budgets`
- `ad_groups`
- `keywords`
- `responsive_search_ads`
- `metrics_campaign`
- `metrics_ad_group`
- `metrics_keyword`
- `metrics_ad`

Metric templates validate `dateFrom` and `dateTo`, require ISO dates, and reject inverted ranges.

Tests cover:

- every legacy sync step uses a template ID;
- no raw query/GAQL is passed from the sync service;
- query templates do not contain mutate or validateOnly;
- invalid dates and inverted ranges are rejected.
