# 04 Idempotency Result

The same medium apply command was executed twice.

Result:

- The second run deleted deterministic demo allowlist records.
- The second run inserted the same medium profile counts again.
- Counts did not double.

Post-second-apply sample counts:

- `users`: 154.
- `products`: 180.
- `ordertest2`: 1800.
- `customers`: 1400.
- `marketing_leads`: 2400.
- `google_ads_daily_metrics`: 3600.
- `system_settings`: 9.

Conclusion: idempotency check passed.

