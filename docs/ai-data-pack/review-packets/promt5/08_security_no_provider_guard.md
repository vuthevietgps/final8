# Security and No-provider Guard

Production dependencies are limited to:

- Source registry.
- Direct Mongoose connection reads.
- Internal watermark, coverage and decision-gate services.

Production source does not inject/call provider API/sync, action, sheet, payment, settlement, recalculation, auto-control, OpenAI or live-execution services.

Controls:

```text
readOnlyDbOnly=true
providerSyncAllowedInThisPr=false
mutationAllowed=false
providerSyncAttempted=false
mutationAttempted=false
```

DB read failures produce generic warnings only. Raw error messages, tokens, secrets, stack traces and PII are not returned. Tests include a provider-like secret/error string and prove it is absent from output.

Cached ExportJob and existing GET controller remain independent from the new gate.
