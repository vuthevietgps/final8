import {AgentReceivableService} from '../agent-receivable/agent-receivable.service';
import {SupplierPayableService} from '../supplier-payable/supplier-payable.service';
import {StatementManagementService} from '../supplier-payable/services/statement-management.service';

describe('Quote/debt migration boundaries',()=>{
  const canonical=()=>({summary:jest.fn(async()=>({basis:'current_obligations_and_confirmed_journal',data:[{
    partyId:'counterparty',name:'Fixture',receivable:180000,payable:0,net:180000,reviewCount:0,
    orders:[{orderId:'o',obligation:300000,adjustments:-20000,paymentMovement:-100000,balance:180000,paymentState:'partial',reviewReasons:[]}],
  }]}))});
  it('dealer API counts adjustments but does not call them collected cash',async()=>{
    const ledger=canonical();const service=new AgentReceivableService({} as any,{} as any,{} as any,ledger as any);
    const result=await service.getAgentReceivableSummary({});
    expect(result.totals).toMatchObject({contractualAmount:300000,adjustmentAmount:-20000,collectedAmount:100000,receivableAmount:180000});
    expect(ledger.summary).toHaveBeenCalledWith('agent',{partyId:undefined,from:undefined,to:undefined});
  });
  it('supplier list and CSV use the same shared balance instead of old COD calculations',async()=>{
    const ledger=canonical();const service=new SupplierPayableService({} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,ledger as any);
    expect((await service.findAll({status:'partial'})).data[0].balance).toBe(180000);
    expect((await service.findAll({status:'paid'})).pagination.total).toBe(0);
    expect(await service.exportCsv({})).toContain('180000');
  });
  it('a partial payment through the old supplier statement cannot mark any order paid',async()=>{
    const orders={updateMany:jest.fn()},statements={findById:jest.fn()};
    const service=new StatementManagementService({} as any,statements as any,orders as any);
    await expect(service.addPaymentToStatement('old',{amount:10000})).rejects.toThrow('phân bổ');
    expect(orders.updateMany).not.toHaveBeenCalled();expect(statements.findById).not.toHaveBeenCalled();
  });
  it('old dealer commission statements cannot settle or reopen goods debt',async()=>{
    const model={findById:jest.fn()},service=new AgentReceivableService(model as any,{} as any,{} as any);
    await expect(service.closeStatement('old')).rejects.toThrow('cũ');
    await expect(service.reopenStatement('old')).rejects.toThrow('cũ');
    expect(model.findById).not.toHaveBeenCalled();
  });
  it('cashflow adapters expose correct debt direction and mark unknown schedules/old earnings unavailable',async()=>{
    const ledger=canonical();
    const supplier=new SupplierPayableService({} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,{} as any,ledger as any);
    const agent=new AgentReceivableService({} as any,{} as any,{} as any,ledger as any);
    expect(await supplier.getCashflowSummary()).toMatchObject({companyReceivable:180000,companyPayable:0,scheduleConfigured:false,totalCommissionReceived:null});
    expect(await agent.getCashflowSummary()).toMatchObject({companyReceivable:180000,companyPayable:0,totalAgentUnpaid:0,totalAgentDue14d:null});
    expect(await supplier.getSupplierAgingSummary()).toMatchObject({unscheduledAmount:180000,scheduleConfigured:false,aging15plus:{amount:null,orderCount:null}});
  });
});
