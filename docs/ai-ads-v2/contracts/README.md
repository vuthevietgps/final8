# AI Ads V2 Action Plan Contract

Artifacts:

- `action-plan.schema.json`: Draft 2020-12 schema for `action_plan.json`.
- `manifest.schema.json`: Draft 2020-12 schema for execution-plan ZIP manifest.
- `../validation-fixtures/`: valid and invalid action-plan fixtures.
- `../samples/ads_execution_plan_PLAN-20260612-001.zip`: complete valid sample package.

JSON Schema validates structural and action-specific payload requirements. Cross-action uniqueness is a semantic rule:

- `actionId` must be unique inside a plan.
- `idempotencyKey` must be unique inside a plan.

The validation fixtures define expected schema and semantic outcomes. These artifacts do not import plans, call Google Ads, or execute actions.
