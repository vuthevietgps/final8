# Return Report APIs

Endpoints to analyze returned/failed orders by ad group or product (from `summary4`).

## Endpoints
- `GET /return-report/ad-group` – query: `fromDate`, `toDate`, `adGroupId?`
- `GET /return-report/product` – query: `fromDate`, `toDate`, `productId?`

## Detection logic
- Return/failed orders are matched by `orderStatus` regex: `/hoàn|hoan|hủy|huy|không thành|fail|return/i`.
- Aggregates over `summary4`:
  - `totalOrders`, `returnOrders`, `returnRate`
  - `totalQty`, `returnQty`
  - `revenue` (paidToCompanyAmount), `returnRevenue`
  - `cost` (productCostTotal), `returnCost`
  - `cod` (codAmount), `returnCod`

## Example response item
```json
{
  "key": "adGroup123",
  "totalOrders": 120,
  "returnOrders": 18,
  "returnRate": 0.15,
  "totalQty": 150,
  "returnQty": 22,
  "revenue": 5000000,
  "returnRevenue": 700000,
  "cost": 3200000,
  "returnCost": 450000,
  "cod": 4800000,
  "returnCod": 650000
}
```

## Notes
- Date filters use `orderDate` with start/end-of-day bounds.
- Add UI later under Reports → Lợi Nhuận or Advertising as needed.
