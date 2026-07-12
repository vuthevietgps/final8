# Source Registry Contract

The internal registry contains 19 required sources and records:

```text
sourceKey
domain
businessImportance
packRelevance
defaultMaxStalenessMinutes
freshnessMethod
coverageMethod
readOnlyDbOnly=true
providerSyncAllowedInThisPr=false
mutationAllowed=false
availability
notes/evidence definitions
```

Unsupported sources:

```text
zalo_ads
external_market
customer_referral
employee_activity_payroll
```

They are never classified as fresh. `system_settings` is dynamically classified `not_configured` when no local configuration row exists.

Thresholds are the proposed Prompt 3 defaults and still require final Director/BA approval.
