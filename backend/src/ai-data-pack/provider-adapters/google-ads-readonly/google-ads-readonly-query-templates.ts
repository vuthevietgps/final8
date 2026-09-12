export type GoogleAdsReadonlyQueryTemplateId =
  | "account"
  | "manager_children"
  | "campaigns"
  | "campaign_budgets"
  | "campaign_criteria"
  | "conversion_actions"
  | "campaign_conversion_goals"
  | "conversion_goal_campaign_configs"
  | "ad_groups"
  | "keywords"
  | "responsive_search_ads"
  | "metrics_campaign"
  | "metrics_ad_group"
  | "metrics_keyword"
  | "metrics_ad";

const METRIC_FIELDS = [
  "metrics.cost_micros",
  "metrics.impressions",
  "metrics.clicks",
  "metrics.ctr",
  "metrics.average_cpc",
  "metrics.conversions",
  "metrics.all_conversions",
  "metrics.conversions_value",
  "metrics.cost_per_conversion",
].join(", ");

const STATIC_TEMPLATES: Record<
  Exclude<GoogleAdsReadonlyQueryTemplateId, `metrics_${string}`>,
  string
> = {
  account:
    "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account, customer.conversion_tracking_setting.google_ads_conversion_customer, customer.conversion_tracking_setting.conversion_tracking_status, customer.conversion_tracking_setting.conversion_tracking_id, customer.conversion_tracking_setting.cross_account_conversion_tracking_id, customer.conversion_tracking_setting.accepted_customer_data_terms, customer.conversion_tracking_setting.enhanced_conversions_for_leads_enabled FROM customer",
  manager_children:
    "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.status, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level <= 1",
  campaigns:
    "SELECT campaign.id, campaign.resource_name, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign.bidding_strategy_system_status, campaign.bidding_strategy, campaign.target_spend.cpc_bid_ceiling_micros, campaign.maximize_conversions.target_cpa_micros, campaign.campaign_budget, campaign.start_date, campaign.end_date, campaign.network_settings.target_google_search, campaign.network_settings.target_search_network, campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network, campaign.geo_target_type_setting.positive_geo_target_type, campaign.geo_target_type_setting.negative_geo_target_type, campaign.contains_eu_political_advertising FROM campaign",
  campaign_budgets:
    "SELECT campaign_budget.id, campaign_budget.resource_name, campaign_budget.name, campaign_budget.amount_micros, campaign_budget.delivery_method, campaign_budget.explicitly_shared, campaign_budget.status FROM campaign_budget",
  campaign_criteria:
    "SELECT campaign.id, campaign_criterion.resource_name, campaign_criterion.type, campaign_criterion.negative, campaign_criterion.status, campaign_criterion.location.geo_target_constant, campaign_criterion.language.language_constant FROM campaign_criterion WHERE campaign_criterion.type IN (LOCATION, LANGUAGE)",
  conversion_actions:
    "SELECT conversion_action.id, conversion_action.resource_name, conversion_action.name, conversion_action.status, conversion_action.type, conversion_action.category, conversion_action.origin, conversion_action.primary_for_goal, conversion_action.owner_customer FROM conversion_action",
  campaign_conversion_goals:
    "SELECT campaign.id, campaign_conversion_goal.resource_name, campaign_conversion_goal.campaign, campaign_conversion_goal.category, campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal WHERE campaign.advertising_channel_type = SEARCH",
  conversion_goal_campaign_configs:
    "SELECT campaign.id, conversion_goal_campaign_config.resource_name, conversion_goal_campaign_config.campaign, conversion_goal_campaign_config.goal_config_level, conversion_goal_campaign_config.custom_conversion_goal FROM conversion_goal_campaign_config WHERE campaign.advertising_channel_type = SEARCH",
  ad_groups:
    "SELECT campaign.id, ad_group.id, ad_group.resource_name, ad_group.name, ad_group.status, ad_group.type, ad_group.cpc_bid_micros FROM ad_group",
  keywords:
    "SELECT campaign.id, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.negative, ad_group_criterion.status, ad_group_criterion.cpc_bid_micros, ad_group_criterion.final_urls, ad_group_criterion.quality_info.quality_score FROM keyword_view",
  responsive_search_ads:
    "SELECT campaign.id, ad_group.id, ad_group_ad.resource_name, ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.final_urls, ad_group_ad.ad.tracking_url_template, ad_group_ad.ad.final_url_suffix, ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2, ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status FROM ad_group_ad WHERE ad_group_ad.ad.type = RESPONSIVE_SEARCH_AD",
};

const METRIC_TEMPLATES: Record<
  Extract<GoogleAdsReadonlyQueryTemplateId, `metrics_${string}`>,
  string
> = {
  metrics_campaign: `SELECT segments.date, campaign.id, campaign.resource_name, ${METRIC_FIELDS} FROM campaign`,
  metrics_ad_group: `SELECT segments.date, campaign.id, ad_group.id, ad_group.resource_name, ${METRIC_FIELDS} FROM ad_group`,
  metrics_keyword: `SELECT segments.date, campaign.id, ad_group.id, ad_group_criterion.criterion_id, ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ${METRIC_FIELDS} FROM keyword_view`,
  metrics_ad: `SELECT segments.date, campaign.id, ad_group.id, ad_group_ad.ad.id, ad_group_ad.resource_name, ${METRIC_FIELDS} FROM ad_group_ad`,
};

export function buildGoogleAdsReadonlyQuery(input: {
  templateId: GoogleAdsReadonlyQueryTemplateId;
  dateFrom?: string;
  dateTo?: string;
}): string {
  const staticTemplate =
    STATIC_TEMPLATES[input.templateId as keyof typeof STATIC_TEMPLATES];
  if (staticTemplate) return staticTemplate;

  const dateFrom = isoDate(input.dateFrom);
  const dateTo = isoDate(input.dateTo);
  if (dateFrom > dateTo)
    throw new Error("Read-only query date range is invalid.");
  const metricTemplate =
    METRIC_TEMPLATES[input.templateId as keyof typeof METRIC_TEMPLATES];
  if (!metricTemplate)
    throw new Error("Read-only query template is not allowed.");
  return `${metricTemplate} WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`;
}

function isoDate(value: unknown): string {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("Read-only query date is invalid.");
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new Error("Read-only query date is invalid.");
  }
  return text;
}
