# Redaction Boundary

Rendering uses policy-bound job metadata:

- `redactionProfile`
- `sectionAccessProfile`
- `exportMode`
- `syncPolicy`
- `policyVersion`
- source preparation summary

Client override is not accepted.

The renderer rejects forbidden input fields through existing lifecycle validation:

- `providerMutation`
- `validateOnly`
- `openaiUpload`
- `dryRun`
- `liveExecution`
- provider credentials/tokens
- action/import payloads

The JSON exporter redacts known PII and secret keys before serialization.

The artifact is marked:

```text
redactionRuntime=pre_rendered
artifactRendering=rendered
downloadReady=true
```

Failed, raw/internal, and manifest-only artifacts remain non-downloadable.
