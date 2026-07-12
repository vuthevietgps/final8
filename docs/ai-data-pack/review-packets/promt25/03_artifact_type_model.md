# Artifact Type Model

Explicit artifact classes:

- `raw_internal_artifact`
- `manifest_only_artifact`
- `downloadable_redacted_artifact`

Only this class may be downloaded:

```text
downloadable_redacted_artifact
```

Downloadable artifact metadata:

- `artifactId`
- `packType`
- `exportMode`
- `format`
- `redactionProfile`
- `sectionAccessProfile`
- `artifactClass=downloadable_redacted_artifact`
- `artifactRendering=rendered`
- `redactionRuntime=pre_rendered`
- `downloadReady=true`
- `checksumAlgorithm=sha256`
- `artifactChecksum`
- `fileSizeBytes`
- `createdAt`
- internal `storageKey`

The storage key remains internal and is stripped from public responses.

Schema impact:

- Optional fields were added to the artifact subdocument.
- No migration was added.
