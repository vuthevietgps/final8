# Meta Ads delivery stack control through ERP

## Delivered scope

The canonical Meta lane now supports staged creation of the four resources
required for a basic delivery stack:

```text
Campaign -> Ad Set -> Ad Creative -> Ad
```

Supported delivery actions:

- `create_ad_set`
- `pause_ad_set`
- `create_ad_creative`
- `create_ad`

Campaign actions remain:

- `create_campaign`
- `update_campaign`
- `pause_campaign`

All new Campaigns, Ad Sets, and Ads are server-forced to `PAUSED`.
Ad Creative is a non-delivering resource and therefore has no PAUSED/ACTIVE
override in the ERP contract.

This phase does not implement Ad Set update/resume, Creative or Ad
update/resume, automatic
activation, delete/archive, asset upload, or Advantage+ specializations.

`pause_ad_set` requires the exact Campaign and Ad Set IDs, accepts an empty
payload only, forces `status=PAUSED`, performs exact-ID readback, and preserves
the existing ERP product/ad-group mapping.

## Staged provider dependency

The resources cannot be safely created in one unchecked provider request.
Each stage requires the exact provider ID and readback from the previous stage:

```text
1. Create Campaign PAUSED
   -> validate_only
   -> approve
   -> execute once
   -> exact Campaign GET/readback

2. Create Ad Set PAUSED using the exact Campaign ID
   -> exact PAUSED Campaign dependency readback
   -> validate_only
   -> approve
   -> execute once
   -> exact Ad Set GET/readback

3. Create Ad Creative
   -> validate_only
   -> approve
   -> execute once
   -> exact Creative GET/readback

4. Create Ad PAUSED using exact Ad Set and Creative IDs
   -> exact same-account PAUSED Ad Set and Creative dependency readback
   -> validate_only
   -> approve
   -> execute once
   -> exact Ad GET/readback
```

No mutation is automatically retried. Unknown outcomes retain the immutable
idempotency reservation and require GET-only reconciliation when a provider ID
is known.

## Ad Set contract

ERP configures:

- Campaign ID and ERP product/ad-group mapping.
- ABO or CBO budget ownership.
- Daily/lifetime Ad Set budget for ABO.
- Ad Set bid strategy and bid amount where required.
- Optimization goal, billing event, and destination type.
- Countries, age range, gender, publisher platforms, and placements.
- Pixel/custom event, Page, or App promoted-object dependencies.
- Start/stop schedule.

ABO bidding belongs to the Ad Set. An ABO Campaign must not send a
campaign-level bid strategy.

Live create additionally requires verified ERP mapping and the fail-closed
`META_ADS_INTERNAL_MAPPING_VERIFIED_ENABLED=true` flag.

## Creative contract

ERP configures:

- Facebook Page and optional Instagram actor.
- Primary text, headline, and description.
- Call to action.
- Credential-free HTTPS destination URL.
- Exactly one image hash or video ID.
- Optional non-secret URL tags.

The website destination host must be allowlisted by
`META_ADS_LANDING_PAGE_ALLOWLIST`; app-store destinations use
`META_ADS_APP_STORE_HOST_ALLOWLIST`. URL tags containing credential-like material
are rejected. Page, Instagram, Pixel, and media identifiers are entered in ERP
in this phase and are provider `validate_only` checked; provider asset discovery
is not yet exposed.

## Ad contract

ERP configures:

- Ad name.
- Exact Ad Set ID.
- Exact Creative ID.

The provider request is forced to `status=PAUSED`. The Ad Set and Creative must
belong to the same exact ad account, and the Ad Set must still be PAUSED at
validation and live preflight.

## Mandatory controls

Every action uses the same canonical control plane:

```text
typed ERP draft
  -> exact-account provider validate_only
  -> maker/approver/executor separation
  -> explicit dry-run and live confirmation
  -> production/provider/per-action flags
  -> immutable idempotency reservation
  -> one provider POST
  -> exact-ID GET readback
  -> canonical snapshot and execution log
```

The browser never receives an access token, Graph URL, or raw provider body.
Facebook credentials use Bearer headers. Canonical live credentials must be
encrypted, fresh, include `ads_management`, and be bound to the exact ad account.

## Activation boundary

The repository includes an atomic Financial Control lease foundation for a
future delivery-activation phase, scoped to:

```text
meta-ads:vnd:delivery-activation
```

It is not a permission to activate delivery. Resume/activation remains blocked
until all of the following are implemented and tested together:

- canonical resume actions in child-first order;
- Financial Control and Budget Bucket exposure checks;
- product/supplier/stock/loss-limit evidence;
- kill switch and small-cap approval;
- provider validate-only and exact before-state evidence;
- post-activation sync and monitoring.

No automatic publish or automatic enable is introduced by this phase.

## Production flags

All flags default to false:

```text
META_ADS_AD_SET_CREATE_ENABLED=false
META_ADS_AD_SET_PAUSE_ENABLED=false
META_ADS_AD_CREATIVE_CREATE_ENABLED=false
META_ADS_AD_CREATE_ENABLED=false
META_ADS_INTERNAL_MAPPING_VERIFIED_ENABLED=false
```

The shared Meta production/provider flags, exact account allowlist, landing-page
allowlist, budget caps, validation TTL, and credential/account freshness gates
remain mandatory.
