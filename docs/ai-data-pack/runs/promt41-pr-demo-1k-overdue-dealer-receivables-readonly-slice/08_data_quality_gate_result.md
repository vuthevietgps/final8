# Data Quality Gate Result

Implemented gate behavior:

- Receivable/payable row must map to dealer/agent via `ordertest2.agentId`. Missing agent id emits no row.
- Invoice/order linkage exists through `ordertest2._id`; no separate invoice entity is claimed.
- Due date must exist through `ordertest2.agentPaymentDueDate`; missing due date emits no row.
- Outstanding balance must be positive and calculable; missing/non-positive amount emits no row.
- Aging bucket is derived from due date and report/as-of date.
- Last payment date missing downgrades confidence.
- Collection owner missing downgrades confidence.
- Statement linkage missing downgrades confidence.
- No collection action or agent blocking action is allowed.

Data quality result:

```text
data_quality_status: partial
confidence: medium when due date, balance, last payment, owner, and statement linkage are present
confidence: low when last payment, owner, or statement linkage is missing
```

Blocked strong conclusion cases:

```text
missing due date -> no row emitted
missing outstanding balance -> no row emitted
missing dealer/agent mapping -> no row emitted
```

Semantic downgrade:

```text
AgentStatement is named receivable in existing routes, but schema comments describe company payable to agent. Prompt41 evidence is therefore settlement-pressure evidence only and must not support collection or blocking decisions.
```

