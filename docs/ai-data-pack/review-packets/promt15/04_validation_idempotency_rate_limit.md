# Validation, Idempotency, And Rate Limits

Create input allowlist:

- `exportMode`
- `reportDate`
- `dateFrom`
- `dateTo`
- `packTypes`
- `formats`
- `redactionProfile`
- `sectionAccessProfile`
- `sourceScope`
- `googleAdsCustomerIds`
- `allowDowngradeToPartial`
- `idempotencyKey`
- `policyVersion`

Forbidden input is rejected before lifecycle delegation, including provider credentials, GAQL, raw provider query, action/approval/OpenAI payloads, dry-run/live flags, download fields, storage fields, role/redaction override, tokens, and artifact bytes.

Public idempotency scope:

- requester
- mode
- dates
- packs/formats
- redaction profile
- section access profile
- source scope
- policy version
- caller idempotency key

Duplicate idempotency behavior:

- same public request returns the same redacted job summary
- `idempotent_request_reused` is audited
- lifecycle service is not called a second time

Rate controls are defined in:

```text
AI_DATA_PACK_EXPORT_ENDPOINT_RATE_LIMITS
```

Current defaults:

```text
windowMs=60000
createPerActor=10
createPerMode=6
officialCreatePerActor=2
statusPollPerActorJob=60
syncSummaryPerActorJob=12
idempotencyReplayPerActorKey=20
denialPerActor=30
maxDateRangeDays=31
maxPackTypes=4
maxFormats=2
maxConcurrentOfficialPerActor=1
```
