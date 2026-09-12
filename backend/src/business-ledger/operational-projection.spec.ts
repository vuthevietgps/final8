import { buildLedgerReport } from './business-ledger.report';
import { operationalEntries } from './operational-projection';
import { calculateEffects, reverseEffects, OrderContext } from './business-ledger.rules';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';
import { purchaseUnitCosts, receivedPurchaseValue } from '../purchase/purchase-costs';

const calc = () => new OrderCalculationService({} as any, {} as any, {} as any, {} as any,
  { getReturnStatusNames: async()=>['Hàng hoàn'] } as any, {} as any);
const order = (extra={}) => ({_id:'order',financialModelVersion:2,productId:'product',supplierId:'supplier',agentId:'agent',
  orderDate:'2026-09-01T03:00:00Z',adGroupId:'ad',quantity:1,productionStatus:'Đã trả kết quả',trackingNumber:'VN',
  orderStatus:'Hàng hoàn',productSource:'supplier',supplierQuoteId:'sq',supplierAppliedPrice:120000,agentQuoteId:'aq',
  agentAppliedPrice:250000,shippingFee:20000,returnFee:30000,laborCostAllocation:10000,otherCostAllocation:5000,
  advertisingCost:40000,...extra} as any);
const context: OrderContext = {orderId:'order',productId:'product',supplierId:'supplier',agentId:'agent',quantity:1,
  orderDate:'2026-09-01T03:00:00Z',adGroupId:'ad',saleMode:'dealer',fulfillment:'supplier_direct'};
const report = (orders:any[],entries:any[]=[],ads:any[]=[{date:context.orderDate,adGroupId:'ad',spentAmount:40000}]) =>
  buildLedgerReport({orders,entries,ads,profiles:[],accounts:[{_id:'bank',openingAt:'2026-08-01',openingBalance:0}],from:'2026-09-01',to:'2026-09-02'});

describe('Operational facts, debts, cash and grouped profit reconcile',()=>{
  it('a returned dealer sale keeps goods debt; partial supplier collection is not company cash',async()=>{
    const o=order(); await calc().applyCompletedStatusFinancials(o);
    const payment={_id:'payment',orderId:'order',context,kind:'payment',status:'confirmed',occurredAt:context.orderDate,
      effects:calculateEffects({kind:'payment',amount:100000,fromParty:'customer',toParty:'supplier'},context)};
    const r=report([o],[payment]);
    expect(r.orders[0].recordedNetProfit).toBe(o.netProfit);
    expect(o.netProfit).toBe(75000);
    expect(r.debts.find(d=>d.partyKey==='agent:agent')?.net).toBe(200000);
    expect(r.debts.find(d=>d.partyKey==='supplier:supplier')?.net).toBe(-70000);
    expect(r.cash.registeredAccountsBalance).toBe(0);
    for(const group of [r.products,r.agents,r.adGroups]) expect(group.reduce((n,g)=>n+g.recordedNetProfit,0)).toBe(o.netProfit);
    const reversal={...payment,_id:'reversal',kind:'reversal',reversalOf:'payment',effects:reverseEffects(payment.effects)};
    expect(report([o],[payment,reversal]).debts.find(d=>d.partyKey==='agent:agent')?.net).toBe(300000);
  });
  it('retail partial delivery and accepted recovery retain the original supplier obligation',async()=>{
    const o=order({agentId:undefined,quantity:2,orderStatus:'Giao một phần',deliveredQuantity:1,
      retailSaleAmount:600000,recoveredInventoryValue:120000,shipments:[{}]});
    await calc().applyCompletedStatusFinancials(o);
    expect(o.recognizedRevenue).toBe(300000);
    expect(o.recognizedGoodsCost).toBe(120000);
    expect(o.supplierContractAmount).toBe(290000);
    expect(report([o]).orders[0].recordedNetProfit).toBe(o.netProfit);
  });
  it('production can create supplier debt before retail revenue; pending allocations remain expenses',async()=>{
    const o=order({agentId:undefined,trackingNumber:undefined,orderStatus:'Chưa có mã vận đơn'});
    await calc().applyCompletedStatusFinancials(o);
    expect(o.supplierContractAmount).toBe(120000);
    expect(o.recognizedRevenue).toBe(0);
    const r=report([o]);
    expect(r.totalPayable).toBe(120000);
    expect(r.orders[0].recordedNetProfit).toBe(o.netProfit);
    expect(r.orders[0].needsReview).toBe(true);
  });
  it('treats an internal agent as company retail and never opens an agent receivable',()=>{
    const o=order({saleMode:'retail',agentRoleSnapshot:'internal_agent',retailProfitState:'recognized',
      dealerProfitState:undefined,recognizedRevenue:300000,dealerContractAmount:900000});
    const sale=operationalEntries([o]).find(e=>e.kind==='sale');
    expect(sale.effects.debts).toEqual([{partyKey:'customer:order',amount:300000}]);
    expect(sale.context.agentId).toBeUndefined();
  });
  it('ads stay on their own day and group, including a day without an order',async()=>{
    const o=order();await calc().applyCompletedStatusFinancials(o);
    const r=report([o],[],[{date:'2026-09-01',adGroupId:'ad',spentAmount:40000},{date:'2026-09-02',adGroupId:'ad',spentAmount:20000}]);
    expect(r.orders.find(x=>x.orderId==='order')?.advertisingCost).toBe(40000);
    expect(r.orders.filter(x=>x.adsOnly).reduce((n,x)=>n+x.advertisingCost,0)).toBe(20000);
    expect(r.orders.find(x=>x.adsOnly)?.orderDay).toBe('2026-09-02');
    expect(r.adGroups[0].advertisingCost).toBe(60000);
  });
  it('retail dispatch incurs fees before revenue and they are not counted twice on delivery',async()=>{
    const o=order({agentId:undefined,orderStatus:'Đang giao',returnFee:0,retailSaleAmount:300000,
      packagingCostSnapshot:5000,shipments:[{status:'shipped',shippingCost:20000,returnCost:0}]});
    await calc().applyCompletedStatusFinancials(o);
    expect(o.recognizedRevenue).toBe(0);
    expect(o.recognizedGoodsCost).toBe(0);
    expect(o.grossProfit).toBe(-25000);
    expect(report([o]).orders[0].recordedNetProfit).toBe(-80000);
    o.orderStatus='Giao thành công';o.deliveredQuantity=1;
    await calc().applyCompletedStatusFinancials(o);
    expect(report([o]).orders[0].recordedNetProfit).toBe(100000);
  });
  it('purchase acquisition value includes document costs and is recognized only once on receipt',()=>{
    const po={grandTotal:300000,items:[{quantity:2,unitPrice:100000,quantityReceived:1}]};
    expect(purchaseUnitCosts(po)).toEqual([150000]);
    expect(receivedPurchaseValue(po)).toBe(150000);
    po.items[0].quantityReceived=2;
    expect(receivedPurchaseValue(po)).toBe(300000);
  });
});
