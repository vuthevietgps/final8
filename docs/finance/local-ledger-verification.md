# Local rehearsal — 2026-09-04

Scope clarification: the ledger checks below do not certify the legacy `test-order2` profit fields or their downstream reports. See [the order-profit chain audit](order-profit-chain-audit.md) for reproduced discrepancies that still require correction.

## Isolation

- Full NestJS application at `127.0.0.1:3001`; Angular build at `http://127.0.0.1:4300/__local`.
- Separate mongod process bound to `127.0.0.1:27027`, database `erp_ledger_local_20260904`, data in `.local-ledger/mongo`.
- Existing MongoDB on port 27017 and remote databases are not used.
- The local preloader discards inherited integration settings, generates secrets in memory, skips `.env`, and blocks outbound TCP except the three rehearsal ports on loopback. Scheduled jobs are disabled. The demo web host blocks external browser connections through CSP.
- The demo account uses the ordinary ERP login API. Its generated password is hashed in MongoDB and kept only in process memory. The loopback-only demo login helper exists only in the separate test host; it is not an ERP route. No credentials or production data are imported.
- Nothing deployed or pushed. Do not serve the demo host publicly.

## Business changes checked

| Case | Ledger behavior |
|---|---|
| Retail, not delivered | Sale posting rejected; customer advance is cash plus advance liability, not revenue |
| Retail delivered | Sale posting allowed |
| Dealer | Sale requires both `Đã trả kết quả` and nonblank tracking number; both checked again at confirmation |
| Recoverable returns | Evidence-backed supplier credit reduces supplier debt and cost; company stock receipt reduces cost and preserves supplier debt |
| Production committed | Direct supplier cost requires completed production; ordinary return cannot erase cost or supplier debt |
| Dealer return obligation | Sale credit is explicit under the dealer agreement; the system does not infer the full retail/wholesale price must be retained |
| Payment held by supplier/dealer | Not included in company cash until a confirmed transfer to a registered company account |
| Draft/repeated confirmation | Draft excluded from balances; concurrent confirmation cannot count the same entry twice |

Product `ledgerReturnPolicy` supplies a suggestion. A profile explicitly confirms and snapshots the order policy; changing the product does not rewrite accepted orders. The older `isReturnable` physical-return flag is not treated as a financial contract.

### Dealer responsibility depends on product

The product now separately stores `dealerReturnPolicy` and `dealerReturnTerms`: unconfigured, no goods charge, supplier purchase cost, dealer sale price, or an explicit agreement. Shipping/return fees are separate. A nonrefundable supplier obligation does not imply the dealer owes the same amount.

New dealer order profiles require a configured product policy and snapshot both the policy and its terms server-side. The profile API cannot override those fields. By-agreement policies require nonblank terms. Product changes and profile retries cannot rewrite the accepted snapshot. Retail profiles need no dealer policy. Existing profiles without a snapshot remain unconfigured and display a review notice rather than inheriting current product terms retroactively.

This configuration guides the existing manual return settlement workflow; it does not automatically post a credit or charge when the order is returned. The return amount and its confirmation still require evidence. No automatic financial posting was added in this correction.

Regression command: `npm test -- --runInBand --runTestsByPath src/business-ledger/business-ledger.dealer-policy.spec.ts src/business-ledger/business-ledger.eligibility.spec.ts src/business-ledger/business-ledger.rules.spec.ts src/business-ledger/business-ledger.service.spec.ts`.

Result after this correction: all 62 checks in these four suites passed (including 12 product-policy cases); backend and frontend builds passed. Existing local fixture products/orders are not silently assigned new policies.

Additional startup/UI defects found and fixed: missing director frontend `finance.cashflow.manage` permission; Google/Meta financial lease startup index names racing with Mongoose schema auto-index creation. Index uniqueness and execution gates remain required.

## Verified fixture totals

Five orders, two products, one supplier, one dealer and one ad group; all synthetic.

| Measure | VND |
|---|---:|
| Opening cash | 1,000,000 |
| Confirmed receipts | 220,000 |
| Confirmed payments | 50,000 |
| Closing company cash | 1,170,000 |
| Receivables | 310,000 |
| Payables | 660,000 |
| Company revenue | 710,000 |
| Net COGS after stock recovery | 650,000 |
| Other recorded costs | 60,000 |
| Ads expense | 100,000 |
| Recorded net profit | -100,000 |

An additional receipt of 999,000 VND remains a draft and is excluded. Profit/ads totals reconcile across product, dealer, ad group and order dimensions. These are initial test expectations; user edits after testing may change the displayed balances.

## Repeatable commands (PowerShell, repository root)

Build each app using `npm run build` in `backend` and `frontend`.

```powershell
# Restart an existing demo, preserving its data:
powershell -ExecutionPolicy Bypass -File scripts/stop-local-ledger.ps1
powershell -ExecutionPolicy Bypass -File scripts/start-local-ledger.ps1

# Only for a fresh, empty rehearsal ledger: seed and run real API/Mongo verification.
powershell -ExecutionPolicy Bypass -File scripts/start-local-ledger.ps1 -Verify
```

The `-Verify` mode refuses to overwrite an existing ledger. No reset/delete is performed by these scripts. Open `/__local` and use the demo entry button again after a restart (JWT keys rotate in memory). Logs/PIDs and the machine-readable verification result are in ignored `.local-ledger/`.

Unit/regression suites in `backend`:

```powershell
npm test -- --runInBand --runTestsByPath src/business-ledger/business-ledger.rules.spec.ts src/business-ledger/business-ledger.service.spec.ts src/business-ledger/business-ledger.eligibility.spec.ts src/test-order2/services/order-report.service.spec.ts src/test-order2/services/order-calculation.supplier-approval.spec.ts src/supplier-quote/supplier-quote.service.spec.ts src/google-ads/google-ads-profit-enrichment.service.spec.ts src/google-ads/google-ads-financial-execution-lease.service.spec.ts src/meta-ads/meta-ads-financial-execution-lease.service.spec.ts
```

Results: 75 unit/regression checks passed, plus 9 real HTTP/Mongo scenario groups. Browser verified normal demo login, journal dashboard and ad-group totals. Both builds pass.

## Scope remaining

This is a manual, confirmed journal rehearsal, not a completed ERP accounting cutover. Operational status updates do not auto-post sales/costs/payments. Legacy dashboards and automatic Ads decisions are not switched to this ledger. Stock recovery requires a real receipt/evidence but is not yet linked to the physical warehouse movement engine. Opening balances, historical migration, automated status-event posting with event dates, contractual dealer return settlements, and full bank/warehouse reconciliation must be completed and tested before production use.

Canonical recognition statuses currently reuse the existing ERP names: `Giao thành công`, `Hàng hoàn`, `Đã trả kết quả`. Custom status names require explicit semantic mapping before they can qualify. Recognition dates entered in the journal must be supported by evidence; historical operational event timestamps are not reconstructed in this phase.
