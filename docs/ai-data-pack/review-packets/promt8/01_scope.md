# Scope

## Implemented

- Mongo distributed lock schema/service and tests.
- Immutable source-sync audit schema/service and tests.
- Runtime Google Ads searchStream transport wrapper and static query templates.
- Fail-closed raw sync port while legacy transport integration remains blocked.
- DB-only assessment port binding.
- Declared write-target instrumentation and adapter validation.
- Prompt 8 evidence and review packet.

## Not Implemented

- Legacy sync-service transport refactor.
- Complete actual-write interception.
- Official/partial export or ExportJob source-sync integration.
- Public endpoint, polling, or download.
- Real provider sync or provider calls in tests.
- Mutation, validateOnly, action import, approval, dry-run, live execution, OpenAI, or Phase 3.

`blocked_by_scope=false`; `blocked_by_transport_integration=true`.

