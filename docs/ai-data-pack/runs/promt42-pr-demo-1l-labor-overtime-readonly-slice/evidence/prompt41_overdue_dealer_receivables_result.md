# ketquapromt41

Status:

```text
implemented_read_only_slice
```

Target finding:

```text
overdue_dealer_receivables
```

Implementation summary:

- Added read-only overdue dealer/agent settlement evidence in `OperationsCapacityQuery`.
- Director evidence appears in `16_operation_capacity`.
- Evidence reads `ordertest2`, `agentstatements`, and `users`.
- Days overdue and aging bucket are included.
- Missing due date or missing outstanding balance blocks row emission.
- Missing last payment, collection owner, or statement linkage downgrades confidence.

Verification:

- `npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`: passed, 29 tests.
- `npm run build`: passed.
- Static scans: no new OpenAI/API upload/action import/provider execution/provider mutation/destructive DB/secret path found; only safety strings and existing test assertions matched.

Safety:

- No production DB used.
- No DB migration.
- No collection action.
- No agent/dealer blocking action.
- No payment mutation.
- No cashflow mutation.
- No customer or invoice/order mutation.
- No ads/provider mutation.

