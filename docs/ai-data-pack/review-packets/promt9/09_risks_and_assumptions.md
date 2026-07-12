# Risks and Assumptions

## Risks

- Write interception is complete for the current `GoogleAdsReadonlySyncService` path, but not a global write firewall for unrelated services.
- The existing public `POST /google-ads/sync/readonly` route remains present and now also uses the wrapper through the same service path.
- The adapter is not integrated into ExportJob, so integration risks around job lifecycle, policy selection, and operator UX remain untested.
- Narrow permissions remain proposed and unbound to broad roles.
- Runtime provider behavior still depends on valid OAuth configuration, Google Ads permissions, quota, and API version.

## Assumptions

- ERP remains the only component allowed to call Google Ads.
- ChatGPT Web creates only `ads_execution_plan.zip` and cannot call providers.
- Final freshness and coverage decisions remain DB-only after any sync.
- ExportJob integration requires a separate prompt and review.
