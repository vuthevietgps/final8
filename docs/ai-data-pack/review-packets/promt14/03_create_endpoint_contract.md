# 03 Create Endpoint Contract

Future endpoint:

```text
POST /ai-data-pack/exports
```

Allowed modes:

- `cached_export`
- `official_export`
- `partial_export`

Permission by mode:

| Mode | Permission |
|---|---|
| `cached_export` | `ai-data-pack.export.cached.create` |
| `official_export` | `ai-data-pack.export.official.create` |
| `partial_export` | `ai-data-pack.export.partial.create` |

Input fields:

- `exportMode`
- `reportDate`
- `dateFrom` / `dateTo`
- `packTypes`
- `formats`
- `redactionProfile`
- `sectionAccessProfile`
- `sourceScope`
- `googleAdsCustomerIds`
- `allowDowngradeToPartial`
- `idempotencyKey`
- `policyVersion`

Forbidden input:

- provider credentials
- raw provider query / GAQL
- action plan
- approval payload
- `dryRun`
- `liveExecution`
- OpenAI upload payload
- `downloadNow`
- `publicUrl`
- `artifactStoragePath`
- `roleOverride`
- `redactionOverride`

Response:

- job summary only
- no artifact bytes
- no download token
- no public URL
- no full storage path

Lifecycle routing:

- `official_export` and `partial_export` call internal lifecycle only.
- `cached_export` keeps cached behavior and never triggers source sync.
