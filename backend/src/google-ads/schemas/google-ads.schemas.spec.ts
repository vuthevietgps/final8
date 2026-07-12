import { Schema as MongooseSchema } from 'mongoose';
import { GoogleAdsAdSchema } from './google-ads-ad.schema';
import { GoogleAdsAdGroupSchema } from './google-ads-ad-group.schema';
import { GoogleAdsCampaignSchema } from './google-ads-campaign.schema';
import { GoogleAdsCampaignBudgetSchema } from './google-ads-campaign-budget.schema';
import { GoogleAdsDailyMetricSchema } from './google-ads-daily-metric.schema';
import { GoogleAdsKeywordSchema } from './google-ads-keyword.schema';
import { GoogleAdsSyncRunSchema } from './google-ads-sync-run.schema';
import { GoogleAdsExportSchema } from './google-ads-export.schema';
import { GoogleAdsActionPlanSchema } from './google-ads-action-plan.schema';
import { GoogleAdsActionExecutionLogSchema } from './google-ads-action-execution-log.schema';
import { GoogleAdsActionEvaluationSchema } from './google-ads-action-evaluation.schema';
import { GoogleAdsChangeLogSchema } from './google-ads-change-log.schema';

const indexByName = (schema: MongooseSchema, name: string) =>
  schema.indexes().find(([, options]) => options?.name === name);

describe('Google Ads V2 schemas', () => {
  it.each([
    ['google_ads_campaigns', GoogleAdsCampaignSchema],
    ['google_ads_campaign_budgets', GoogleAdsCampaignBudgetSchema],
    ['google_ads_ad_groups', GoogleAdsAdGroupSchema],
    ['google_ads_keywords', GoogleAdsKeywordSchema],
    ['google_ads_ads', GoogleAdsAdSchema],
    ['google_ads_daily_metrics', GoogleAdsDailyMetricSchema],
    ['google_ads_sync_runs', GoogleAdsSyncRunSchema],
    ['google_ads_exports', GoogleAdsExportSchema],
    ['google_ads_action_plans', GoogleAdsActionPlanSchema],
    ['google_ads_action_execution_logs', GoogleAdsActionExecutionLogSchema],
    ['google_ads_change_logs', GoogleAdsChangeLogSchema],
    ['google_ads_action_evaluations', GoogleAdsActionEvaluationSchema],
  ])('uses the explicit collection name %s', (collection, schema) => {
    expect(schema.get('collection')).toBe(collection);
  });

  it('scopes campaign, budget, and ad group IDs by customerId', () => {
    expect(indexByName(GoogleAdsCampaignSchema, 'uniq_google_ads_campaign_customer_campaign')).toEqual([
      { customerId: 1, campaignId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexByName(GoogleAdsCampaignBudgetSchema, 'uniq_google_ads_budget_customer_budget')).toEqual([
      { customerId: 1, campaignBudgetId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexByName(GoogleAdsAdGroupSchema, 'uniq_google_ads_ad_group_customer_ad_group')).toEqual([
      { customerId: 1, adGroupId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('scopes criterion and ad IDs by their customer and ad group', () => {
    expect(indexByName(GoogleAdsKeywordSchema, 'uniq_google_ads_keyword_customer_ad_group_criterion')).toEqual([
      { customerId: 1, adGroupId: 1, criterionId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexByName(GoogleAdsAdSchema, 'uniq_google_ads_ad_customer_ad_group_ad')).toEqual([
      { customerId: 1, adGroupId: 1, adId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('uses one provider-scoped unique key for each metric level and date', () => {
    expect(indexByName(GoogleAdsDailyMetricSchema, 'uniq_google_ads_daily_metric_scope')).toEqual([
      {
        level: 1,
        date: 1,
        customerId: 1,
        campaignId: 1,
        adGroupId: 1,
        criterionId: 1,
        adId: 1,
      },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('uses a global unique index for imported action idempotency keys', () => {
    expect(indexByName(GoogleAdsActionPlanSchema, 'uniq_google_ads_action_plan_idempotency_key')).toEqual([
      { idempotencyKeys: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it('reserves execution idempotency only for live execution records', () => {
    expect(indexByName(GoogleAdsActionExecutionLogSchema, 'uniq_google_ads_reserved_idempotency_key')).toEqual([
      { idempotencyKey: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { idempotencyReserved: true },
      }),
    ]);
  });

  it('creates unique post-execution audit and evaluation windows', () => {
    expect(indexByName(GoogleAdsChangeLogSchema, 'uniq_google_ads_change_log_plan_action')).toEqual([
      { planId: 1, actionId: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(indexByName(GoogleAdsActionEvaluationSchema, 'uniq_google_ads_action_evaluation_window')).toEqual([
      { idempotencyKey: 1, evaluationDays: 1 },
      expect.objectContaining({ unique: true }),
    ]);
  });

  it.each([
    ['campaignId', GoogleAdsCampaignSchema],
    ['campaignBudgetId', GoogleAdsCampaignBudgetSchema],
    ['adGroupId', GoogleAdsAdGroupSchema],
    ['criterionId', GoogleAdsKeywordSchema],
    ['adId', GoogleAdsAdSchema],
  ])('does not mark provider ID %s as globally unique', (path, schema) => {
    expect((schema as MongooseSchema).path(path).options?.unique).not.toBe(true);
  });
});
