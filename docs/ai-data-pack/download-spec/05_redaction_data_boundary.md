# Redaction And Data Boundary

Download must serve only pre-rendered, pre-redacted artifacts.

## Required Boundary

- Artifact generation/redaction happens before download.
- Download never performs ad-hoc redaction by trusting client parameters.
- Artifact redaction profile is bound to job, artifact, actor, and policy version.
- Artifact section access profile is bound to job, artifact, actor, and policy version.
- Artifact checksum is for the downloadable redacted artifact, not the raw/internal artifact.
- Manifest must distinguish raw/internal artifacts from downloadable redacted artifacts.
- Download must never expose the raw/internal manifest placeholder as a data pack file.

## Forbidden Request Parameters

Reject any request containing these names in query, body, or accepted headers:

```text
redactionOverride
roleOverride
sectionOverride
includeRaw
includePII
includeSecrets
includeStoragePath
downloadRaw
formatOverride
downloadNow
downloadToken
artifactBytes
publicUrl
storageKey
storageLocation
providerQuery
gaql
credentials
openaiUpload
actionImport
dryRun
liveExecution
validateOnly
providerMutation
```

`formatOverride` is forbidden beyond selecting an artifact already present in the manifest. The artifact ID decides the format.

## Manifest Requirements

Future manifest/download metadata must identify:

- `downloadable=true|false`.
- `manifestOnly=false` for actual downloadable files.
- `redactionRuntime=implemented`.
- `artifactRendering=rendered`.
- `artifactClass=downloadable_redacted` or equivalent.
- `checksumAlgorithm=sha256`.
- `artifactChecksum` for the redacted file.
- `fileSizeBytes`.
- `contentType`.
- `safeFileName`.
- `expiresAt`, `retentionUntil`, `revokedAt`, or equivalent lifecycle fields.

Raw/internal artifacts, storage placeholders, and provider payload snapshots must remain non-downloadable through human endpoints unless a separate future raw-evidence policy explicitly approves them.

