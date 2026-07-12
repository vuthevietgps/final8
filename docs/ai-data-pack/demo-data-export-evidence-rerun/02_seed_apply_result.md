# 02 Seed Apply Result

Dry-run baseline:

| Field | Value |
|---|---|
| command | `npm run seed:ai-data-pack:director:demo -- --dry-run --profile small` |
| `NODE_ENV` | `test` |
| `ALLOW_DEMO_SEED` | `1` |
| status | passed |
| DB write | no |

Dry-run key counts:

| Count | Value |
|---|---:|
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

Apply result:

| Field | Value |
|---|---|
| command | `npm run seed:ai-data-pack:director:demo -- --apply --profile medium` |
| target DB | local Docker `aidp_demo_20260614` |
| status | passed |

Medium profile summary counts:

| Count | Value |
|---|---:|
| suppliers_created | 24 |
| dealers_created | 80 |
| products_created | 180 |
| variants_created | 180 |
| quotes_created | 1440 |
| orders_created | 1800 |
| payments_created | 2208 |
| loans_created | 10 |
| workers_created | 45 |
| labor_entries_created | 1800 |
| ad_rows_created | 7200 |
| anomalies_created | 12 |

Selected inserted collection counts:

| Collection | Inserted |
|---|---:|
| users | 154 |
| products | 180 |
| supplierquotes | 720 |
| inventorytransactions | 2200 |
| advertisingcosts | 3600 |
| google_ads_daily_metrics | 3600 |
| ordertest2 | 1800 |
| customers | 1400 |
| marketing_leads | 2400 |
| loancontracts | 10 |
| laborcost1 | 1800 |
| finance_alert_events | 8 |
| returnrequests | 100 |
| system_settings | 9 |

