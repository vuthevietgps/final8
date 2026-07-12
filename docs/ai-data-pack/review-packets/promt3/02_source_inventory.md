# Source Inventory

| source | support | safe sync now | V1 freshness evidence | V1 behavior | priority |
|---|---|---|---|---|---|
| Google Ads | found | yes, after adapter lock/timeout | sync run + `lastSyncAt` + coverage | allowlisted direct adapter only | P0 |
| Meta Ads | partial | no | latest cost/ad metadata timestamps | local watermark only | P0 |
| TikTok Ads | partial | no | latest cost timestamp | local watermark only | P0 |
| Zalo Ads | missing | no | none | unsupported/not configured | P2 |
| Advertising costs | partial | no | `max(updatedAt)` + latest record date | watermark/coverage | P0 |
| CRM leads | partial/inferred | no external sync | `max(updatedAt, leadCreatedAt)` | watermark + inference warning | P0 |
| Lead/sale activity | partial | no | local activity timestamps | partial/weak | P1 |
| Orders | found local | no external sync | `max(updatedAt)` + report-date coverage | DB-only; exclude sheet sync | P0 |
| Payments | partial local | no | payment/order/statement timestamps | DB-only; exclude payment sync | P0 |
| Accounting | missing/unclear | no | none | missing/unsupported | P1 |
| Finance/cashflow | partial local | no | per-collection timestamps + calculation time | DB-only | P0 |
| Loans/debt schedule | found local | no | contract/repayment timestamps + schedule coverage | DB-only + completeness gate | P0 |
| Supplier settlement | partial local | no | statement/payable/payment timestamps | DB-only; criticality needs approval | P0 |
| Tier-2 agent commission | partial local | no | statement/payment timestamps | DB-only; policy needs approval | P0 |
| Product/service mapping | partial local | no | model timestamps + mapping completion | DB-only + mapping gate | P0 |
| Operations status | partial current counts | no | order timestamps | cautious only | P1 |
| Return/refund | partial local | no | return `updatedAt/resolvedAt` | DB-only | P1 |
| Customer referral | missing | no | none | unsupported/schema-only | P2 |
| Decision history | partial local | no | execution/evaluation timestamps | read-only watermark | P1 |
| Director settings | partial/not configured | no | settings `updatedAt` | absence=`not_configured` | P1 |

Important classification rules:

- Google Ads read-only sync is safe only through the narrow read-only service, never a broad controller/module.
- Advertising-cost provider services need durable-run and isolation work before pre-export use.
- `max(updatedAt)` proves local activity only; it does not prove external provider synchronization.
- Freshness and report-date coverage must be evaluated separately.
