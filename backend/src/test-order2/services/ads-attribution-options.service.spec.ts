import { BadRequestException } from '@nestjs/common';
import { AdsAttributionOptionsService } from './ads-attribution-options.service';

function queryResult<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('AdsAttributionOptionsService', () => {
  it('builds a Windsor option with account, campaign and ad group context', async () => {
    const connectionQuery = queryResult([{ _id: 'connection-1', lastReadSyncAt: new Date('2026-09-05T00:00:00Z'), lastReadSyncRunId: 'run-1' }]);
    const resourceQuery = queryResult([
      { connectionId: 'connection-1', resourceType: 'account', accountId: '1396730688', providerId: '1396730688', name: 'Phù hiệu xe nhanh' },
      { connectionId: 'connection-1', resourceType: 'campaign', accountId: '1396730688', providerId: '2001', name: 'vui trần 1' },
      { connectionId: 'connection-1', resourceType: 'ad_group', accountId: '1396730688', campaignId: '2001', providerId: '3001', name: 'Nhóm tìm kiếm', status: 'ENABLED', lastSeenAt: new Date('2026-09-05T02:00:00Z') },
    ]);
    const localQuery = queryResult([]);
    const resourceModel = { find: jest.fn().mockReturnValue(resourceQuery) };
    const service = new AdsAttributionOptionsService(
      resourceModel as any,
      { find: jest.fn().mockReturnValue(connectionQuery) } as any,
      { find: jest.fn().mockReturnValue(localQuery) } as any,
    );

    const result = await service.list();

    expect(result.items).toEqual([
      expect.objectContaining({
        selectionKey: 'google:1396730688:2001:3001',
        source: 'windsor',
        accountName: 'Phù hiệu xe nhanh',
        campaignName: 'vui trần 1',
        adGroupName: 'Nhóm tìm kiếm',
      }),
    ]);
    expect(result.items[0].label).toContain('Phù hiệu xe nhanh › vui trần 1 › Nhóm tìm kiếm (3001)');
    expect(resourceModel.find).toHaveBeenCalledWith(expect.objectContaining({
      $or: [{ connectionId: 'connection-1', lastSyncRunId: 'run-1' }],
    }));
  });

  it('stores the synchronized identity snapshot for an exact selection', async () => {
    const service = new AdsAttributionOptionsService({} as any, {} as any, {} as any);
    jest.spyOn(service, 'list').mockResolvedValue({
      items: [{
        selectionKey: 'google:100:200:300', source: 'windsor', provider: 'google',
        accountId: '100', accountName: 'Account', campaignId: '200', campaignName: 'Campaign',
        adGroupId: '300', adGroupName: 'Group', lastSeenAt: '2026-09-05T02:00:00.000Z', label: 'label',
      }],
    });

    await expect(service.resolve({
      adGroupId: '300', adsProvider: 'google', adAccountProviderId: '100', adCampaignId: '200',
    })).resolves.toEqual(expect.objectContaining({
      adGroupId: '300', adsProvider: 'google', adAccountProviderId: '100', adCampaignId: '200',
      adsAttributionSource: 'windsor', adGroupNameSnapshot: 'Group',
    }));
  });

  it('rejects an ad group id that is ambiguous across accounts', async () => {
    const service = new AdsAttributionOptionsService({} as any, {} as any, {} as any);
    jest.spyOn(service, 'list').mockResolvedValue({
      items: [
        { selectionKey: 'google:100:200:300', source: 'windsor', provider: 'google', accountId: '100', campaignId: '200', adGroupId: '300', label: 'one' },
        { selectionKey: 'google:101:201:300', source: 'windsor', provider: 'google', accountId: '101', campaignId: '201', adGroupId: '300', label: 'two' },
      ],
    });

    await expect(service.resolve({ adGroupId: '300' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
