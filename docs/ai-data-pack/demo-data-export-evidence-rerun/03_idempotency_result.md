# 03 Idempotency Result

The medium apply command was run twice against the same local Docker demo DB.

Expected behavior:

- Delete only deterministic demo allowlist records.
- Reinsert the selected profile.
- Do not double counts.

Result: passed.

The second apply deleted the same collection counts that the first apply inserted, then inserted the same medium counts again.

Post-second-apply sample counts:

| Collection | Count |
|---|---:|
| users | 154 |
| products | 180 |
| supplierquotes | 720 |
| quotes | 720 |
| purchaseorders | 420 |
| inventorytransactions | 2200 |
| advertisingcosts | 3600 |
| google_ads_daily_metrics | 3600 |
| ordertest2 | 1800 |
| customers | 1400 |
| marketing_leads | 2400 |
| loancontracts | 10 |
| laborcost1 | 1800 |
| system_settings | 9 |

Conclusion: counts did not double.

