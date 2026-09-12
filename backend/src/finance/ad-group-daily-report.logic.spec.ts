import { AdGroupDailyReportService } from './ad-group-daily-report.service';

describe('AdGroupDailyReportService financial logic', () => {
  function createService(reportModel: any, orderModel: any = {}) {
    return new AdGroupDailyReportService(
      orderModel as any, {} as any, {} as any, reportModel as any, {} as any, {} as any,
    );
  }

  it('returns the grouped spend and net-profit fields from top-ad-group reports', async () => {
    const aggregate = jest.fn((_pipeline: any[]) => ({ exec: async () => [] }));
    await createService({ aggregate }).getTopAdGroups({ sortBy: 'profit' });
    const pipeline = aggregate.mock.calls[0][0];
    expect(pipeline[1].$group).toEqual(expect.objectContaining({
      adsCost: { $sum: '$adsCost' },
      netProfit: { $sum: '$netProfit' },
    }));
    expect(pipeline[2].$project).toEqual(expect.objectContaining({ adsCost: 1, netProfit: 1 }));
  });

  it('fails closed when source advertising spend is invalid', async () => {
    const orderModel = {
      aggregate: async () => [],
      db: { collection: () => ({ aggregate: () => ({
        toArray: async () => [{ _id: 'g1', actualSpent: 0, invalidCount: 1 }],
      }) }) },
    };
    await expect(createService({}, orderModel).syncFromOrderTest2('2026-09-01'))
      .rejects.toThrow('không hợp lệ');
  });
});
