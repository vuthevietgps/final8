# Adapter Contract

The adapter implements:

```ts
sourceKey = "google_ads"
mode = "read_only"
supportsSourceRegistry = true

assessLocalFreshness(input)
syncReadOnly(input)
assessCoverage(input)
```

Required sync input includes export job and correlation identifiers, `sourceKey=google_ads`, report/range dates, approved customer IDs, sync policy, policy version, internal requester, and absolute deadline.

Forbidden caller input includes credentials, tokens, generic URL/path/method, caller-supplied query or GAQL, action plans, and mutation operations.

Every result fixes:

```text
mutationAttempted=false
canImportActionFile=false
canDryRun=false
canExecuteLive=false
```

`providerSyncAttempted=true` is possible only after validation and lock acquisition and only when the narrow mocked/internal sync port is invoked.

