# Director JSON Surface Regression

Verification method:

- Code inspection of `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- Focused Jest run of `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
- Director contract test in the same Jest suite

Confirmed evidence keys in current code/tests:

- `low_inventory_best_seller`
- `supplier_cost_up`
- `overdue_dealer_receivables`
- `labor_overtime_high`
- `slow_supplier_good_cost`

Evidence surface:

- `OperationsCapacityQuery.get()`
- returned `operation_capacity`
- returned `operational_risk_findings`
- Director section: `16_operation_capacity`

Regression result:

- No hardened finding was removed.
- No hardened finding key was renamed.
- Existing tests prove positive row creation and negative blocker behavior for the finding slices.
- Director data-pack contract test still builds the full Director section list.

Action payload audit:

- Evidence rows use `not_allowed_actions` advisory text.
- No row is designed to emit action payloads.
- Prompt43 test explicitly checks `slow_supplier_good_cost` row does not contain `action_id`, `provider_operation`, `execute_live`, or `dry_run`.
- Static scans found no new Prompt44 action/provider/OpenAI upload branch.

Live export note:

- Actual database-backed Director JSON export was not generated to avoid touching production/server DB. Service/unit tests are the safe regression evidence for this closeout.

