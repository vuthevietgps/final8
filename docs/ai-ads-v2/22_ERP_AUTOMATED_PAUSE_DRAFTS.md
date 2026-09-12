# ERP automated pause drafts from business evidence

## Delivered scope

ERP can now compile an immutable daily evidence snapshot into canonical,
draft-only pause action plans for:

- Google Search: `pause_ad_group`
- Meta Ads: `pause_ad_set`

This compiler does not call either provider. It does not validate, approve, or
execute a plan. Existing platform control planes remain the only path for:

```text
provider validate-only
  -> independent approval
  -> explicit dry-run
  -> production and per-action flags
  -> one live provider mutation
  -> exact-ID readback
```

## ERP data used

The decision reads the existing evidence join:

```text
canonical provider account/campaign/ad-group-or-ad-set
  -> exact ERP product mapping
  -> orders and revenue
  -> gross/net profit after ads
  -> inventory and supplier evidence
  -> Financial Control/Budget Bucket evidence
  -> Ads safety gates
```

A pause draft is eligible only when all of these are true:

- recommendation is `pause_review`;
- `COMMERCE_NET_PROFIT_AFTER_ADS_NEGATIVE` is present;
- ERP product mapping is `mapped` with `high` confidence;
- commerce evidence is `fresh`;
- provider resource is `ACTIVE` or `ENABLED`;
- account, campaign, and Ad Group/Ad Set IDs are exact numeric provider IDs.

Scale, reduce-budget, campaign creation, targeting, creative, and activation are
not inferred by this phase. Those decisions need canonical current budget,
template/creative inputs, and exposure semantics that are not present in the
evidence snapshot.

## Immutable provenance and idempotency

Only a current-business-date snapshot from
`ads_automation_evidence_snapshots` is accepted. ERP recomputes the snapshot
SHA-256 before compiling and rejects stale, tampered, provider-derived, or
kill-switch-active snapshots.

Every generated plan records:

- evidence snapshot ID;
- evidence snapshot hash;
- evidence capture time;
- source `erp_automation`;
- stable resource/intent idempotency key.

The stable key means repeated runs deduplicate the same pause intent instead of
creating multiple plans.

## ERP endpoints

Read-only preview:

```text
GET /ads-automation/drafts/google/pause-review/preview
GET /ads-automation/drafts/meta/pause-review/preview
```

Explicit draft materialization:

```text
POST /ads-automation/drafts/google/pause-review
POST /ads-automation/drafts/meta/pause-review
```

Google and Meta use separate read/plan permissions. Both ERP campaign-control
screens expose a button for the materialization endpoint and never call a
provider from the browser.

## Schedule and safe defaults

The evidence snapshot runs at 08:05 Asia/Bangkok, after the existing 06:00 cost
and 07:30 metrics collection windows. Automated materialization runs at 08:20
only when explicitly enabled:

```text
ADS_AUTOMATION_DRAFTS_ENABLED=false
ADS_AUTOMATION_ACTOR_USER_ID=
ADS_AUTOMATION_DRAFT_MAX_SNAPSHOT_AGE_MINUTES=1440
```

The actor must be a dedicated ERP service user and must not be the approver or
executor. Enabling the compiler creates database drafts only; it does not enable
Google or Meta production execution.

## Remaining boundary

The next safe expansion requires:

- bounded paged Meta canonical account import, not only exact-ID readback;
- canonical budget ownership/current amount in automation evidence;
- Financial Control lease wiring for every exposure-increasing Meta action;
- templates for keywords, RSA, Meta targeting, and creative inputs;
- controlled resume/activation order and monitoring.

Until those are delivered together, automated live activation and automated
budget increases remain blocked.
