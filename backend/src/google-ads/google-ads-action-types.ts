export const GOOGLE_ADS_ERP_ACTION_TYPES = [
  'create_search_campaign',
  'update_search_campaign',
  'update_campaign_bidding_strategy',
  'update_campaign_budget',
  'pause_campaign',
  'create_ad_group',
  'update_ad_group',
  'pause_ad_group',
  'create_keyword',
  'update_keyword',
  'pause_keyword',
  'create_responsive_search_ad',
  'update_responsive_search_ad',
  'pause_responsive_search_ad',
  'resume_responsive_search_ad',
  'resume_keyword',
  'resume_ad_group',
  'resume_campaign',
] as const;

export type GoogleAdsErpActionType = (typeof GOOGLE_ADS_ERP_ACTION_TYPES)[number];
