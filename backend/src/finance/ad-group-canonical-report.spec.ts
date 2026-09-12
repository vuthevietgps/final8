import { AdGroupDailyReportService } from './ad-group-daily-report.service';

describe('daily finance report canonical source', () => {
  function fixture() {
    let spend = 100;
    const ledger: any = { report: jest.fn(async () => ({
      quality: { estimatedAdsRows: 0 }, adGroups: [{ key: 'g', name: 'g',
        advertisingCost: spend, recordedNetProfit: -spend, revenue: 0, cogs: 0, expense: 0, profitNeedsReview: 0 }],
    })) };
    const groups: any = { find: () => ({ lean: () => ({ exec: async () => [{adGroupId:'g',name:'Group',platform:'google'}] }) }) };
    const projection: any = { find: jest.fn(() => {throw new Error('Do not trust stale materialization');}) };
    const service = new AdGroupDailyReportService({} as any,groups,{} as any,projection,{} as any,{} as any,ledger);
    return { service, ledger, setSpend: (value:number) => spend=value };
  }
  it('returns advertising loss even with an empty projection and follows every overwrite', async () => {
    const {service, setSpend} = fixture();
    for (const spend of [100, 200, 0, 50, 50]) {
      setSpend(spend);
      const result = await service.getAdGroupDailyReport({fromDate:'2026-09-01',toDate:'2026-09-01'});
      expect(result.summary).toEqual({totalAdsCost:spend,totalNetProfit:0-spend});
      expect(result.details[0].adGroupName).toBe('Group');
    }
  });
  it('keeps top groups consistent and bounds expensive date ranges', async () => {
    const {service} = fixture();
    const top = await service.getTopAdGroups({fromDate:'2026-09-01',toDate:'2026-09-02'});
    expect(top.topAdGroups[0].netProfit).toBe(-200);
    await expect(service.getAdGroupDailyReport({fromDate:'2020-01-01',toDate:'2026-09-01'})).rejects.toThrow('93');
  });
  it('propagates canonical read errors instead of reporting zero', async () => {
    const {service,ledger} = fixture();
    ledger.report.mockRejectedValue(new Error('unavailable'));
    await expect(service.getAdGroupDailyReport({fromDate:'2026-09-01',toDate:'2026-09-01'})).rejects.toThrow('unavailable');
  });
});
