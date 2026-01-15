# Finance Insights APIs

New backend endpoints for ad ROI and weekly cashflow using Summary5 data.

## Endpoints

- `GET /ad-group-profit-report/roi-insights`
  - Query: `period` (week|10days|30days|lastMonth|thisMonth|custom), `fromDate`, `toDate`, `year`, `adGroupId`, `targetRoi` (default 1.5), `minOrders` (default 5), `minAdCost` (default 50000 VND).
  - Returns per-ad-group metrics: revenue, adCost, profit, orders, roi, margin, and a budget suggestion (`scale|cut|hold|learn` + `budgetChangePct`).

- `GET /ad-group-profit-report/cashflow-weekly`
  - Query: same date filters as above.
  - Returns weekly aggregates (revenue, adCost, profit, netCash, orders) and top 5 ad groups by profit with ROI.

## Notes

- Data source: `summary5` (includes revenue, adCost, profit). Cashflow is approximated from revenue/adCost; add payment ledger when available.
- Budget suggestion rules: require minimum samples; scale when ROI >= target and profit > 0; cut when ROI below target or profit <= 0; learn when data is thin.
