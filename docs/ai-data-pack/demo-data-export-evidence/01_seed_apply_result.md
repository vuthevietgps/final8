# Seed Apply Result

Status: `not_executed_blocked_missing_safe_throwaway_mongodb_uri`.

## Dry Run Result

Command:

```powershell
$env:NODE_ENV='test'
$env:ALLOW_DEMO_SEED='1'
npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
```

Result: passed.

Dry-run did not require a database and did not write to MongoDB.

Important counts:

| Metric | Count |
| --- | ---: |
| suppliers_created | 6 |
| dealers_created | 14 |
| products_created | 30 |
| quotes_created | 180 |
| orders_created | 180 |
| customers_docs | 160 |
| loans_created | 3 |
| labor_entries_created | 160 |
| ad_rows_created | 440 |
| google_ads_daily_metrics_docs | 220 |
| marketing_leads_docs | 220 |
| inventorytransactions_docs | 180 |
| anomalies_created | 12 |

## Apply Result

Apply command was not run:

```powershell
npm run seed:ai-data-pack:director:demo -- --apply --profile medium
```

Reason:

```text
MONGODB_URI is missing. Prompt 30 requires a safe throwaway/dev/test MongoDB target before apply.
```

No reset, insert, or delete operation was executed.
