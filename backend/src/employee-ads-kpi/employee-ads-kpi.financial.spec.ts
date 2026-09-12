import { EmployeeAdsKpiService } from './employee-ads-kpi.service';

describe('employee KPI financial identity', () => {
  it('does not reconstruct revenue from profit plus ads, or discard non-ad costs', async () => {
    const ledger: any = { report: jest.fn(async () => ({ adGroups: [
      {key:'g',advertisingCost:100,revenue:1000,recordedNetProfit:200,orders:2},
    ] })) };
    const service: any = new EmployeeAdsKpiService({} as any,{} as any,{} as any,{} as any,ledger);
    const reports = await service.canonicalPerformance(['g'],new Date('2026-09-01'),new Date('2026-09-02'));
    const performances = service.calculateAdGroupPerformances([{adGroupId:'g',name:'G',platform:'google'}],reports);
    expect(performances[0]).toMatchObject({revenue:1000,profit:200,spend:100,orders:2});
    expect(service.calculatePlatformBreakdown(performances)[0]).toMatchObject({totalRevenue:1000,totalProfit:200,avgROI:200});
  });
});
