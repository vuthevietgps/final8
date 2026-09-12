# AI Operator boundaries

`AiOperatorService` owns request orchestration, source authorization, source-error
handling, and response selection. Controllers continue to use
this service; they must not call snapshot readers directly.

Snapshot providers use the existing ERP services and Mongoose models:

| Provider | Responsibility |
| --- | --- |
| `AiOperatorOperationsReader` | Orders, returns, receivables, product catalog, customers, conversations, and operational entities |
| `AiOperatorBusinessReader` | Time-window business facts, product profit, agent performance, and ads attribution |
| `AiOperatorAdsReader` | Ads diagnostics, sync health, costs, employee KPI, and marketing snapshots |
| `AiOperatorFinanceReader` | Funds, budget preview, loans, cashflow, quote readiness, and access audit snapshots |

The readers are internal providers, not module exports or new HTTP endpoints.
Keep calls inside the existing `safeSourceForAuth` / scenario source-loading
boundaries so unauthorized sources never invoke a reader and a failed source
remains an explicit data gap. Budget allocation previews retain `dryRun: true`.

Shared snapshot date and display helpers live in `ai-operator.snapshot-utils.ts`.
Query builders internal to the business reader remain private. Pure intent,
answer, recommendation, and model-input functions stay outside Nest DI.

When adding a source, put its query in the relevant reader and register its
permission and context mapping in the orchestrator. Do not introduce reader-to-
orchestrator callbacks or duplicate provider execution paths.

## Verification

Run from `backend`:

```sh
npm run build
node --max-old-space-size=8192 node_modules/jest/bin/jest.js --runInBand ai-operator
```

The integration suite uses real Nest provider wiring with mocked downstream
dependencies. It does not require MongoDB, credentials, or live provider calls.
It covers query result projection, permission gating, source failure isolation,
phone masking, date fallback, and budget preview dry-run mode.

## Conversations

`AiOperatorSessionService` owns session/message persistence, feedback, review,
and conversation analytics. It injects only the existing session/message models
and stays internal to the module. The orchestrator delegates its existing session
API methods and calls `persistChatTurn` after composing a response.

`buildAuthContext` is shared by both services and uses the existing role permission
table. A requested presentation role does not grant permissions.

Preserved rules:

- Owners may read their sessions; users with `users` permission may also read and
  review other users' sessions.
- Only owners may write or continue a session, including when the caller has
  management permission. Archived sessions reject writes.
- Listing/analytics across owners requires both explicit `all` and `users` permission.
- Feedback targets assistant messages only. Anonymous turns are not persisted.
- Turn persistence retains the existing message-pair insert and subsequent session
  update; this extraction does not introduce transactions or retry semantics.

`ai-operator.sessions.spec.ts` covers these rules, projections, flags, and analytics
scoping. Scenario routing remains in the orchestrator for a separate refactor.
