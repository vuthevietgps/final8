# Scenario Library Review

Spec file: `docs/ai-data-pack/ads-guardrail-action-draft/06_scenario_library.md`.

Scenario count: 48.

Groups:

- Budget cap scenarios.
- Finance mode scenarios.
- Risk threshold scenarios.
- Data maturity scenarios.
- Campaign performance scenarios.
- Product and variant scenarios.
- Supplier and cost scenarios.
- Dealer order profit scenarios.
- Return cancel cash lag scenarios.
- Lead handling scenarios.
- Approval required scenarios.
- Safety no-execution scenarios.

Required product variant case is included:

```text
The dich vu 1 nam / 2 nam / 3 nam share creative group but have separate cost and profit.
```

Each scenario includes:

- `scenario_id`
- input facts
- expected ChatGPT Web reasoning
- expected recommendation
- approval_required expected true/false
- guardrail flags
- confidence

Decision: complete for PR-2.4A.
