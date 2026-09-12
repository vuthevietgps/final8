# Meta Ads campaign execution through ERP

## Delivered scope

The canonical Meta lane supports these campaign-level actions:

- `create_campaign`: six ODAX objectives; server forces `AUCTION` and `PAUSED`.
  ERP configures ABO/CBO, daily/lifetime budget, bid strategy, spend cap, schedule,
  official special-ad categories/countries, and the app ID dependency for App Promotion.
- `update_campaign`: name, a non-increasing daily/lifetime campaign budget, a non-increasing
  spend cap, and/or a non-extending stop time.
- `pause_campaign`: server sends only `status=PAUSED`.

Campaign input never accepts a raw Graph URL, raw provider body, status override, access token, or
buying-type override. `GET /api/meta-ads/capabilities` publishes the versioned ERP form contract and
`GET /api/meta-ads/lookups/ad-accounts` returns only sanitized canonical account choices/readiness;
`GET /api/meta-ads/lookups/campaigns/:adAccountId` returns local canonical campaign choices for
update/pause without exposing credentials or calling Meta from the browser.

It intentionally does not support resume, budget/spend-cap increases, schedule extensions,
delete/archive, or Advantage+ specializations. Regulated special-ad categories are visible in the ERP
contract but live execution remains blocked unless each category is explicitly enabled in
`META_ADS_SPECIAL_CATEGORY_ALLOWLIST` (default: `NONE`).

## Resource boundary

A Campaign is a container, not a delivery-ready advertisement. Meta delivery still requires:

```text
Campaign -> Ad Set -> Creative -> Ad
```

Ad Set, Creative, and Ad are not silently created by this phase. They must be added as separate staged
ERP resources because each downstream validate-only call needs an existing provider ID from the
previous PAUSED create/readback. This preserves the rule that the exact resource mutation is provider-
validated before approval and live execution.

## Mandatory flow

```text
ERP draft
  -> Meta execution_options=[validate_only]
  -> different user approves
  -> different user from approver executes
  -> ERP performs one POST (never automatically retries)
  -> exact-ID GET readback
  -> canonical campaign snapshot + execution log
```

Codex and the browser call only ERP endpoints. Only `MetaAdsProviderClientService` can call Graph API.

## Production activation checklist

Keep every live flag false until all items below pass in a staging environment:

1. Store a Facebook credential through ERP encrypted token storage. It must be bound to the exact ad
   account, recently checked, unexpired, non-degraded, and include `ads_management`.
2. Sync the Facebook ad account into the canonical `AdAccount` registry. The account must be active,
   use `VND`, use the provider-reported IANA timezone `Asia/Ho_Chi_Minh`, and have a fresh successful
   sync. Configure the numeric `FB_BUSINESS_ID`; scheduled ad-account sync fails closed when it is
   missing. The provider timezone is preserved as reported and same-offset aliases are not rewritten.
3. Set `META_ADS_ACCOUNT_ID_ALLOWLIST` to explicit numeric account IDs.
4. Apply and verify production indexes:

   ```powershell
   cd backend
   npm run db:indexes:apply
   npm run db:indexes:check
   ```

5. Confirm `/health/ready` passes. Readiness fails closed when Meta plan, idempotency-reservation, or
   canonical-campaign indexes are missing.
6. Run provider validation from ERP and inspect the stored v25 payload hash, credential reference,
   before-state hash, request trace, and validation expiry.
7. Use separate authenticated users for maker, approver, and executor duties.
8. Enable flags only for the required action type and only during a controlled rollout:

   ```text
   AI_MARKETING_REQUIRE_APPROVAL=true
   AI_MARKETING_DRY_RUN=false
   AI_MARKETING_PROVIDER_EXECUTION_ENABLED=true
   META_ADS_PRODUCTION_ENABLED=true
   META_ADS_PROVIDER_EXECUTION_ENABLED=true
   META_ADS_CAMPAIGN_CREATE_ENABLED=true|false
   META_ADS_CAMPAIGN_UPDATE_ENABLED=true|false
   META_ADS_CAMPAIGN_PAUSE_ENABLED=true|false
   META_ADS_MAX_DAILY_BUDGET_VND=5000000
   META_ADS_MAX_LIFETIME_BUDGET_VND=150000000
   META_ADS_MAX_SPEND_CAP_VND=150000000
   META_ADS_SPECIAL_CATEGORY_ALLOWLIST=NONE
   META_ADS_CAMPAIGN_SCHEDULE_MAX_DAYS=365
   META_GRAPH_API_VERSION=v25.0
   ```

## Unknown provider outcomes

The mutation POST is never automatically retried. If the provider outcome is unknown, the immutable
idempotency reservation remains. When a campaign ID is known, ERP may reconcile using GET-only
readback. If a create timed out without a campaign ID, an operator must inspect Meta and reconcile
manually before authorizing any new action.
