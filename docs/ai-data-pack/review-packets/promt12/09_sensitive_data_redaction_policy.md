# Sensitive Data Redaction Policy

| Data | Default rule | Allowed transforms |
|---|---|---|
| finance balances | director/finance only | `show_full`, `aggregate`, `bucket`, `hide` |
| loan/debt detail | director/finance only | `show_full`, `aggregate`, `bucket`, `hide` |
| supplier commission | director/finance only | `show_full`, `aggregate`, `mask`, `hide` |
| tier2 agent commission | director/finance only | `show_full`, `aggregate`, `hash`, `hide` |
| customer phone/email/address | director/support only | `mask`, `hash`, `hide` |
| employee attendance/activity/payroll | director/HR/finance only | `aggregate`, `bucket`, `hide` |
| raw sync errors | never raw | `sanitized_category`, `hide` |
| provider account IDs | director/operator only | `mask`, `hash`, `hide` |
| campaign/ad IDs | marketing if needed | `show_full`, `mask`, `hash` |
| personal names | purpose-bound | `show_full`, `mask`, `hash`, `hide` |

Redacted artifacts must explicitly state the redaction profile and missing sections.
