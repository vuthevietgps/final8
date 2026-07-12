# Artifact Manifest And Storage

Required manifest fields:

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

- `storageLocation` is an internal storage key, not a public URL.
- Manifest must not store raw provider payloads, credentials, tokens, stack traces, or unscoped raw PII.
- `dataContentChecksum`, `runtimeExportChecksum`, and `artifactChecksum` must remain distinct.
- Sensitivity flags must reflect final redacted artifact content.
