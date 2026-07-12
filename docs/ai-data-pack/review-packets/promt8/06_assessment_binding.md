# Assessment Binding

`assessment_port_binding=bound`

The isolated adapter module binds:

```text
GOOGLE_ADS_READONLY_ASSESSMENT_PORT -> FreshnessGateService
```

It directly provides the existing DB-only:

- `SourceRegistryService`
- `DbWatermarkService`
- `CoverageGateService`
- `FreshnessGateService`

`assessLocalFreshness` and `assessCoverage` delegate through this port. Tests prove delegation and preserve `dbOnly=true`, `providerSyncAttempted=false`, and `mutationAttempted=false` behavior in the source-registry gate.

