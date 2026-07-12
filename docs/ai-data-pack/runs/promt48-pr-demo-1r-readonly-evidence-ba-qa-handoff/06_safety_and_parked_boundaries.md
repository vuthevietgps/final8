# Safety And Parked Boundaries

Still parked:

- Action Draft Schema
- action import
- approval workflow
- OpenAI API calls
- ChatGPT Web API calls
- provider validateOnly
- provider execution
- provider mutation
- dry-run/live execution
- Google Ads/Facebook Ads execution
- Phase 3
- production DB/server MongoDB
- DB migration
- export/download endpoint expansion
- purchase order actions
- supplier order actions
- inventory/stock mutation
- supplier cost/price/COGS mutation
- order/revenue/cashflow mutation
- staffing/schedule/payroll/timesheet mutation

PR-DEMO-1 final safety state:

- Read-only evidence only.
- Advisory language only.
- `not_allowed_actions` explicitly blocks execution classes.
- No provider payloads or action payloads are emitted for the hardened findings.
- ERP remains the only future place allowed to validate, approve, and execute actions, and that future phase is not started here.
