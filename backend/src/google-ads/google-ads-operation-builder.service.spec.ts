import { BadRequestException } from '@nestjs/common';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';

describe('GoogleAdsOperationBuilderService', () => {
  const builder = new GoogleAdsOperationBuilderService();

  it('builds a paused Search campaign server-side and ignores raw provider payload fields', () => {
    const operations = builder.build({
      actionType: 'create_search_campaign',
      customerId: '1234567890',
      typedPayload: {
        campaignName: 'Search - Safe Draft',
        budgetName: 'Budget - Safe Draft',
        dailyBudget: 500000,
        advertisingChannelType: 'SEARCH',
        status: 'PAUSED',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        startDate: '2026-06-13',
        finalUrl: 'https://htxbachgia.shop/',
        rawApiRequest: { mutateOperations: [{ campaignOperation: { create: { status: 'ENABLED' } } }] },
      },
    } as any);

    expect(operations).toHaveLength(2);
    expect(operations[1].campaignOperation.create.status).toBe('PAUSED');
    expect(operations[1].campaignOperation.create.advertisingChannelType).toBe('SEARCH');
    expect(JSON.stringify(operations)).not.toContain('rawApiRequest');
    expect(JSON.stringify(operations)).not.toContain('"ENABLED"');
  });

  it('requires a real campaign budget identifier and never falls back to campaignId or adGroupId', () => {
    expect(() => builder.build({
      actionType: 'update_campaign_budget',
      customerId: '1234567890',
      typedPayload: {
        campaignId: '1111111111',
        adGroupId: '2222222222',
        dailyBudget: 600000,
      },
    } as any)).toThrow(BadRequestException);

    const operations = builder.build({
      actionType: 'update_campaign_budget',
      customerId: '1234567890',
      typedPayload: {
        campaignBudgetId: '3333333333',
        campaignId: '1111111111',
        dailyBudget: 600000,
      },
    } as any);
    expect(operations[0].campaignBudgetOperation.update.resourceName)
      .toBe('customers/1234567890/campaignBudgets/3333333333');
  });

  it('rejects an enabled create campaign before any provider call', () => {
    expect(() => builder.build({
      actionType: 'create_search_campaign',
      customerId: '1234567890',
      typedPayload: {
        status: 'ENABLED',
        advertisingChannelType: 'SEARCH',
      },
    } as any)).toThrow('must use status PAUSED');
  });
});
