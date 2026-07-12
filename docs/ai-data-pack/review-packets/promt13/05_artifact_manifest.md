# 05 Artifact Manifest

Official/partial exports generate manifest-only metadata. Full artifact rendering is deferred.

Manifest fields:

```text
artifactId
exportJobId
exportMode
syncPolicy
policyVersion
redactionProfile
sectionAccessProfile
packTypes
formats
rowCounts
sourceFreshnessMetadata
sourceCoverageMetadata
decisionGates
warnings
blockingReasons
containsPii
containsFinancialSensitive
containsEmployeeSensitive
containsSupplierSensitive
dataContentChecksum
runtimeExportChecksum
artifactChecksum
createdAt
expiresAt
retentionUntil
storageLocation
downloadPolicy
```

Rules:

- `storageLocation` is an internal key only.
- No public URL is generated.
- No raw provider payload, token, stack trace, or unscoped PII is stored.
- Checksums are distinct for stable data, runtime export metadata, and artifact placeholder.
