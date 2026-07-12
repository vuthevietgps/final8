# No Action Payload Guard Design

Guard method:

- Focused Jest test in `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`.

New test:

- `keeps hardened operational risk findings read-only without action payload fields`

Helper added:

- `hardenedOperationalRiskFindings`
- `bannedOperationalRiskEvidenceKeys`
- `collectBannedOperationalRiskEvidenceKeys(value, path)`

Design details:

- The test builds fake in-memory collection data that emits all five targeted `operational_risk_findings` rows.
- It filters rows by the five hardened `finding_key` values.
- It asserts all five findings are present.
- It recursively scans every targeted row for exact banned nested keys.
- It asserts every targeted row keeps `not_allowed_actions` advisory safety text.

Why exact-key matching:

- Existing legitimate evidence fields include domain-specific data quality fields such as `supplier_quote_approval_status`.
- The guard bans action/import/provider/live/mutation payload keys such as `approval_status`, `provider_operation`, `execute_live`, and `action_payload` without blocking legitimate evidence metadata.

Banned key classes:

- action payload keys
- action draft/import keys
- approval/import action keys
- provider execution/payload keys
- validateOnly/dry-run/live keys
- mutation/mutate keys
- ads execution plan keys
- business action keys
- OpenAI upload/call keys

