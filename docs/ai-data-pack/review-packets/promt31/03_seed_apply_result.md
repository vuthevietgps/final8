# 03 Seed Apply Result

Dry-run baseline passed:

- Profile: `small`.
- DB write: no.
- Anomalies expected: 12.

Medium apply passed against local Docker demo DB:

- Suppliers: 24.
- Dealers: 80.
- Products: 180.
- Orders: 1800.
- Labor entries: 1800.
- Ad rows: 7200.
- Anomalies: 12.

Selected collection inserts:

- `users`: 154.
- `products`: 180.
- `inventorytransactions`: 2200.
- `google_ads_daily_metrics`: 3600.
- `ordertest2`: 1800.
- `customers`: 1400.
- `marketing_leads`: 2400.
- `returnrequests`: 100.

