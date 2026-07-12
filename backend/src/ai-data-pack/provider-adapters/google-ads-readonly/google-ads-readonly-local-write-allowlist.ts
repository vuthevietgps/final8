export const GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST = Object.freeze([
  "adaccounts.approved_sync_metadata",
  "google_ads_campaigns",
  "google_ads_campaign_budgets",
  "google_ads_ad_groups",
  "google_ads_keywords",
  "google_ads_ads",
  "google_ads_daily_metrics",
  "google_ads_sync_runs",
  "ai_data_pack_source_sync_audits",
] as const);

export const GOOGLE_ADS_READONLY_FORBIDDEN_LOCAL_WRITES = Object.freeze([
  "google_ads_action_plans",
  "google_ads_action_approvals",
  "google_ads_action_execution_logs",
  "google_ads_change_logs",
  "google_ads_action_evaluations",
  "advertisingcosts",
  "advertising_cost_recalculation_queue",
  "google_ads_exports",
  "business_control_state",
  "deletes",
] as const);

export function assertGoogleAdsReadonlyLocalWriteTarget(target: string): void {
  if (
    /\bdelete/i.test(target) ||
    !GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST.includes(
      target as (typeof GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST)[number],
    )
  ) {
    throw new Error("Local write target is not allowed for read-only sync.");
  }
}
