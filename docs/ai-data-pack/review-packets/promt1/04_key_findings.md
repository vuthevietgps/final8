# Key Findings

1. The baseline export layer is structurally successful, but the sample DB cannot prove business-analysis value.
2. Expanded BA requirements are mostly partial because reusable source data exists, but end-to-end semantics, mapping, freshness and permissions do not.
3. Dropship settlement has stronger reusable evidence than the existing Director Pack exposes:
   - supplier receivable/settlement records,
   - agent payable records,
   - order-level supplier/agent payment,
   - estimated and realized profit,
   - aging summaries.
4. Product market, customer referral, operations capacity, sales scripts and employee integrity lack durable models.
5. Current pack-level RBAC is insufficient for adding sensitive employee/payroll/supplier/referral sections because investors can read the Director Pack.
6. Current source has candidate Phase 2.2 fixes, but sample artifacts remain stale evidence.
7. `npm test -- --runInBand ai-data-pack` and `npm run build` currently fail TypeScript compilation, so PR-2.2 must restore build/test health before verification.
