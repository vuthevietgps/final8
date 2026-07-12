# Next Recommendation

Stop after Prompt 8. Do not create Prompt 9 and do not start ExportJob integration.

Because actual legacy transport integration and complete write interception remain blocked, the next separately approved phase must be hardening:

```text
PR-2.3B-3B-H2 - Legacy Google Ads read-only sync transport refactor and actual-write interception
```

Required outcomes:

- Route every legacy read-only searchStream call through `GoogleAdsReadonlyTransportService`.
- Preserve exact origin/method/path/static-template enforcement.
- Expose enforceable actual-write telemetry or a narrow persistence port.
- Keep provider mutations, validateOnly, action/execution services, public endpoints, and ExportJob integration absent.
- Remove the fail-closed sync blocker only after focused tests prove no bypass.

`PR-2.3B-3C` is not allowed yet.

