import {CashflowSafetyService} from './cashflow-safety.service';
import {FinancialControlService} from './financial-control.service';
describe('Counterparty cashflow direction and unavailable schedules',()=>{
  function setup(){
    const funding={find:jest.fn()},legacy={find:jest.fn()},agents={getCashflowSummary:jest.fn(async()=>({companyReceivable:20000,companyPayable:3000,needsReviewCount:0,totalAgentUnpaid:999999}))};
    const suppliers={getCashflowSummary:jest.fn(async()=>({companyReceivable:50000,companyPayable:30000,needsReviewCount:0,unreceived:999999}))};
    const finance={calculateMasterBankBalance:jest.fn(async()=>500000)};
    const service=new CashflowSafetyService(funding as any,{} as any,{} as any,{} as any,legacy as any,legacy as any,{} as any,{} as any,agents as any,suppliers as any,finance as any);
    (service as any).getAvgDailySales=async()=>1000;(service as any).getAvgDailyCOGS=async()=>1000;
    return{service,agents,suppliers,legacy,funding,finance};
  }
  it('DSO uses dealer money owed to company, DPO uses money company owes suppliers',async()=>{
    const h=setup();expect((await h.service.calculateDSO()).DSO).toBe(20);expect((await h.service.calculateDPO()).DPO).toBe(30);
    expect(h.legacy.find).not.toHaveBeenCalled();
  });
  it('uses reconciled ledger cash for CSI and never editable funding balances',async()=>{
    const h=setup();(h.service as any).getAverageDailyAdsCost=async()=>100000;
    h.service.calculateDSO=jest.fn(async()=>({DSO:5,level:'SAFE'} as any));
    const result=await h.service.calculateCSI();
    expect(result.availableCash).toBe(500000);expect(result.CSI).toBe(5);
    expect(h.finance.calculateMasterBankBalance).toHaveBeenCalled();expect(h.funding.find).not.toHaveBeenCalled();
  });
  it('does not fall back to old commission balances when canonical data is unavailable',async()=>{
    const h=setup();h.agents.getCashflowSummary.mockRejectedValueOnce(new Error('unavailable'));h.suppliers.getCashflowSummary.mockRejectedValueOnce(new Error('unavailable'));
    expect((await h.service.calculateDSO()).level).toBe('CRITICAL');await expect(h.service.calculateDPO()).rejects.toThrow('Không thể');
    expect(h.legacy.find).not.toHaveBeenCalled();
  });
  it.each(['Agent','Supplier'])('a missing %s due schedule cannot authorize a zero committed cash forecast',kind=>{
    const fn=(FinancialControlService.prototype as any)[`validate${kind}Snapshot`];
    expect(()=>fn.call({}, {scheduleConfigured:false,totalAgentDue14d:0,expectedInflowByDay:[]})).toThrow('Chưa xác định');
  });
});
