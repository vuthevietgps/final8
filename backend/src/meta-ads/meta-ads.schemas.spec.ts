import {
  MetaAdsActionPlanSchema,
  MetaAdsCanonicalActionSchema,
} from './schemas/meta-ads-action-plan.schema';
import { MetaAdsAdSetSchema } from './schemas/meta-ads-ad-set.schema';
import { MetaAdsAdCreativeSchema } from './schemas/meta-ads-ad-creative.schema';
import { MetaAdsAdSchema } from './schemas/meta-ads-ad.schema';

describe('Meta Ads action plan schemas', () => {
  it('has unique indexes for plan, action and idempotency identities', () => {
    const indexes = MetaAdsActionPlanSchema.indexes();
    expect(indexes).toEqual(expect.arrayContaining([
      [{ planId: 1 }, expect.objectContaining({ unique: true })],
      [{ 'actions.actionId': 1 }, expect.objectContaining({ unique: true })],
      [{ 'actions.idempotencyKey': 1 }, expect.objectContaining({ unique: true })],
    ]));
  });

  it('marks canonical provider inputs and payload hash immutable', () => {
    for (const path of [
      'actionId',
      'idempotencyKey',
      'actionType',
      'adAccountId',
      'campaignId',
      'adSetId',
      'creativeId',
      'adId',
      'internalAdGroupId',
      'internalProductIds',
      'name',
      'objective',
      'status',
      'buyingType',
      'specialAdCategories',
      'specialAdCategoryCountries',
      'budgetMode',
      'budgetType',
      'dailyBudgetVnd',
      'lifetimeBudgetVnd',
      'bidStrategy',
      'bidAmountVnd',
      'spendCapVnd',
      'startTime',
      'stopTime',
      'appId',
      'payloadHash',
    ]) {
      expect((MetaAdsCanonicalActionSchema.path(path) as any).options.immutable)
        .toBe(true);
    }
  });

  it('has exact-account unique indexes for each canonical delivery resource', () => {
    expect(MetaAdsAdSetSchema.indexes()).toContainEqual([
      { adAccountId: 1, adSetId: 1 },
      expect.objectContaining({
        unique: true,
        name: 'uniq_meta_ads_ad_set_account_ad_set',
      }),
    ]);
    expect(MetaAdsAdCreativeSchema.indexes()).toContainEqual([
      { adAccountId: 1, creativeId: 1 },
      expect.objectContaining({
        unique: true,
        name: 'uniq_meta_ads_ad_creative_account_creative',
      }),
    ]);
    expect(MetaAdsAdSchema.indexes()).toContainEqual([
      { adAccountId: 1, adId: 1 },
      expect.objectContaining({
        unique: true,
        name: 'uniq_meta_ads_ad_account_ad',
      }),
    ]);
  });
});
