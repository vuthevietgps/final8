# Demo Seed Schema Mapping

The seed uses raw MongoDB collection writes through Mongoose connection collections. This keeps the seed isolated from application services and avoids triggering external integrations or provider mutation paths.

| Demo collection | Existing schema/source | Demo coverage | Marker strategy |
| --- | --- | --- | --- |
| `users` | `users/schemas/user.schema.ts` | Suppliers, agents/dealers, workers, lenders, director demo user | Deterministic `_id`, `DEMO_AIDP28` names/emails |
| `productcategories` | `products/schemas/product-category.schema.ts` | Product groups and margin scenarios | Deterministic `_id`, prefixed `code`/`name` |
| `products` | `products/schemas/product.schema.ts` | Product variants, import cost, shipping, packaging, stock, supplier links | Deterministic `_id`, prefixed `sku`/`name` |
| `supplierquotes` | `suppliers/schemas/supplier-quote.schema.ts` | Supplier price levels, returnability, shipping/return fees | Deterministic `_id`, product/supplier refs |
| `quotes` | `quotes/schemas/quote.schema.ts` | Dealer/agent price quotes and validity windows | Deterministic `_id`, product/agent refs |
| `purchaseorders` | `purchase-orders/schemas/purchase-order.schema.ts` | Supplier replenishment, slow-delivery scenarios | Deterministic `_id`, prefixed `poCode` |
| `inventorybatches` | `inventory/schemas/inventory-batch.schema.ts` | Purchase inbound lots | Deterministic `_id`, product/supplier refs |
| `inventorytransactions` | `inventory/schemas/inventory-transaction.schema.ts` | Inbound/outbound/adjustment/return movements | Deterministic `_id`, product refs |
| `inventorysummaries` | `inventory/schemas/inventory-summary.schema.ts` | Low inventory and reorder signals | Deterministic `_id`, product refs |
| `fanpages` | `fanpages/schemas/fanpage.schema.ts` | Demo fanpage ownership for ad accounts | Deterministic `_id`, redacted access token placeholder |
| `adaccounts` | `ads/schemas/ad-account.schema.ts` | Ad account inventory | Deterministic `_id`, prefixed external ids |
| `adgroups` | `ads/schemas/ad-group.schema.ts` | Legacy/internal ad group mapping | Deterministic `_id`, prefixed names |
| `advertisingcosts` | `ads/schemas/advertising-cost.schema.ts` | Legacy daily ad cost rows | Deterministic `_id`, internal ad group refs |
| `ad_group_daily_reports` | `finance/schemas/ad-group-daily-report.schema.ts` | Daily cost/revenue/profit rows | Deterministic `_id`, internal ad group refs |
| `google_ads_campaigns` | `google-ads/schemas/google-ads-campaign.schema.ts` | Read-only campaign metadata, status, budget ids | Deterministic `_id`, synthetic Google ids |
| `google_ads_ad_groups` | `google-ads/schemas/google-ads-ad-group.schema.ts` | Read-only ad group metadata and mapping | Deterministic `_id`, synthetic Google ids |
| `google_ads_keywords` | `google-ads/schemas/google-ads-keyword.schema.ts` | Keyword status and match-type data | Deterministic `_id`, synthetic resource names |
| `google_ads_ads` | `google-ads/schemas/google-ads-ad.schema.ts` | Ad status, URLs, final URLs | Deterministic `_id`, synthetic resource names |
| `google_ads_daily_metrics` | `google-ads/schemas/google-ads-daily-metric.schema.ts` | Daily impressions, clicks, cost micros, conversions | Deterministic `_id`, synthetic resource names |
| `google_ads_sync_runs` | `google-ads/schemas/google-ads-sync-run.schema.ts` | Freshness/mapping report signal | Deterministic `_id`, no provider call |
| `ordertest2` | `test-order2/schemas/test-order2.schema.ts` | Sales, COD/deposit, supplier/agent payment status, profit, returns | Deterministic `_id`, prefixed order ids |
| `customers` | `customers/schemas/customer.schema.ts` | Repurchase/LTV timing and customer cohorts | Deterministic `_id`, example.test/non-real PII |
| `marketing_leads` | `ai-marketing/schemas/marketing-lead.schema.ts` | Lead funnel and conversion lag | Deterministic `_id`, example.test/non-real PII |
| `supplierpayables` | `suppliers/schemas/supplier-payable.schema.ts` | Supplier payables and overdue items | Deterministic `_id`, supplier/order refs |
| `supplierstatements` | `suppliers/schemas/supplier-statement.schema.ts` | Supplier statement aging | Deterministic `_id`, supplier refs |
| `agentstatements` | `agents/schemas/agent-statement.schema.ts` | Dealer receivables and late payments | Deterministic `_id`, agent refs |
| `fundingsources` | `finance/schemas/funding-source.schema.ts` | Bank/cash/wallet funding sources | Deterministic `_id`, prefixed names |
| `budgetbuckets` | `finance/schemas/budget-bucket.schema.ts` | Capital allocation buckets | Deterministic `_id`, prefixed names |
| `loancontracts` | `finance/schemas/loan-contract.schema.ts` | Loans, interest, due dates | Deterministic `_id`, lender refs |
| `loanrepayments` | `finance/schemas/loan-repayment.schema.ts` | Loan repayment history | Deterministic `_id`, loan refs |
| `cashflowentries` | `finance/schemas/cashflow-entry.schema.ts` | Revenue, expenses, loan movements, cash gap | Deterministic `_id`, prefixed references |
| `available_fund_snapshots` | `finance/schemas/available-fund-snapshot.schema.ts` | Daily available cash snapshots | Deterministic `_id`, dated rows |
| `cashflow_summary_snapshots` | `finance/schemas/cashflow-summary-snapshot.schema.ts` | Short-window cashflow summaries | Deterministic `_id`, dated rows |
| `finance_alert_events` | `finance/schemas/finance-alert-event.schema.ts` | Expected alert/finding signals | Deterministic `_id`, prefixed messages |
| `laborcost1` | `labor/schemas/labor-cost1.schema.ts` | Worker payroll, overtime, production labor | Deterministic `_id`, employee refs |
| `laborstatements` | `labor/schemas/labor-statement.schema.ts` | Worker statement summaries | Deterministic `_id`, employee refs |
| `returnrequests` | `returns/schemas/return-request.schema.ts` | Return rate and refund/replacement scenarios | Deterministic `_id`, order refs |
| `othercosts` | `other-costs/schemas/other-cost.schema.ts` | Rent, warehouse, tools, fee overhead | Deterministic `_id`, prefixed notes |
| `system_settings` | `finance/schemas/system-settings.schema.ts` | Finance thresholds and demo metadata | Deterministic `_id`, prefixed setting keys |

## Notes

- Tenant-specific fields were not found as a consistent cross-schema concept, so the seed uses deterministic ids plus `DEMO_AIDP28` prefixes and source/notes markers where fields exist.
- The reset path does not search by free-form prefix. It deletes exact deterministic `_id` allowlists.
- Google Ads collections are read-only fixture rows only. No Google Ads client, mutate service, provider validation, or action execution code is referenced.
