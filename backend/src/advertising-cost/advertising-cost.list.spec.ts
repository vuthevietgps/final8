import { AdvertisingCostService } from './advertising-cost.service';
import { Types } from 'mongoose';

describe('Advertising cost list with incomplete ERP mappings', () => {
  const query = (value: any): any => ({ sort: () => query(value), select: () => query(value), lean: async () => value });

  it('keeps all spend visible when groups have missing or malformed account references', async () => {
    const costs = [
      { adGroupId: 'missing', spentAmount: 100, channel: 'google' },
      { adGroupId: 'invalid', spentAmount: 200, channel: 'google' },
      { adGroupId: 'unknown', spentAmount: 300, channel: 'google' },
    ];
    const accounts = { find: jest.fn() };
    const service = new AdvertisingCostService({ find: () => query(costs) } as any,
      { find: () => query([{ adGroupId: 'missing' }, { adGroupId: 'invalid', adAccountId: 'not-an-id' }]) } as any,
      accounts as any, {} as any, {} as any);
    const result = await service.findAll();
    expect(result).toHaveLength(3);
    expect(result.reduce((sum, row) => sum + row.spentAmount, 0)).toBe(600);
    expect(result.every(row => row.adAccountName === undefined)).toBe(true);
    expect(accounts.find).not.toHaveBeenCalled();
  });

  it('enriches valid accounts while retaining unmapped group costs in the same response', async () => {
    const accountId = new Types.ObjectId();
    const accounts = { find: jest.fn(() => query([{ _id: accountId, name: 'Fixture Google account', accountId: '123' }])) };
    const service = new AdvertisingCostService({ find: () => query([
      { adGroupId: 'linked', spentAmount: 400 }, { adGroupId: 'unlinked', spentAmount: 500 },
    ]) } as any, { find: () => query([
      { adGroupId: 'linked', adAccountId: accountId, platform: 'google' }, { adGroupId: 'unlinked', adAccountId: null },
    ]) } as any, accounts as any, {} as any, {} as any);
    const result = await service.findAll();
    expect(result[0]).toMatchObject({ spentAmount: 400, adAccountName: 'Fixture Google account', adAccountAccountId: '123' });
    expect(result[1]).toMatchObject({ spentAmount: 500, adAccountName: undefined });
    expect(accounts.find).toHaveBeenCalledWith({ _id: { $in: [String(accountId)] } });
  });
});
