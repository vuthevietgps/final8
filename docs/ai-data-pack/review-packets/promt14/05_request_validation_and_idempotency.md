# 05 Request Validation And Idempotency

Create validation:

- `idempotencyKey` is required.
- Dates must use `YYYY-MM-DD`.
- `dateFrom` must not be after `dateTo`.
- Large date ranges must be rejected unless policy-approved.
- `packTypes` must be supported and bounded.
- `formats` must be `json` and/or `xlsx`.
- `redactionProfile` must be supported and actor-compatible.
- `sectionAccessProfile` must be supported and actor-compatible.
- `sourceScope` must be authorized and bounded.
- `policyVersion` must be recognized.
- Forbidden fields must be rejected before lifecycle call.

Idempotency scope:

```text
requester
exportMode
reportDate
dateFrom/dateTo
packTypes
formats
redactionProfile
sectionAccessProfile
sourceScope
policyVersion
idempotencyKey
```

Duplicate behavior:

- Return the same redacted active job summary.
- Audit `idempotent_request_reused`.
- Do not start a second lifecycle.

Downgrade behavior:

- No silent downgrade.
- Downgrade only when `allowDowngradeToPartial=true`.
- Audit the reason.
