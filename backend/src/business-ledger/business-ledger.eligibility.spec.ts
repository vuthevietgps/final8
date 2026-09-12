import { assertOperationalPosting, calculateEffects, OrderContext, revenueEligibility } from './business-ledger.rules';

const context: OrderContext = {
  orderId: 'o', productId: 'p', supplierId: 's', agentId: 'a',
  quantity: 1, orderDate: '2026-09-01', saleMode: 'retail',
  fulfillment: 'supplier_direct', returnPolicy: 'recoverable',
};
describe('Commercial recognition and return policy', () => {
  it.each(['Đang giao', 'Hàng hoàn', 'Chưa có mã vận đơn', 'Hoàn thành'])('retail does not recognize revenue at %s', orderStatus => {
    expect(revenueEligibility({ orderStatus, trackingNumber: 'TEST', productionStatus: 'Đã trả kết quả' }, 'retail').eligible).toBe(false);
  });
  it('retail recognizes only delivered goods, independently of money collected', () => {
    expect(revenueEligibility({ orderStatus: 'Giao thành công' }, 'retail').eligible).toBe(true);
  });
  it.each([
    { productionStatus: 'Đang làm', trackingNumber: 'TEST' },
    { productionStatus: 'Đã trả kết quả', trackingNumber: '  ' },
    { productionStatus: 'Đã trả kết quả' },
  ])('dealer needs BOTH completed production and tracking: %j', order => {
    expect(revenueEligibility(order, 'dealer').eligible).toBe(false);
  });
  it('dealer can recognize while shipping, without cash collection', () => {
    expect(revenueEligibility({ productionStatus: 'Đã trả kết quả', trackingNumber: 'TEST', orderStatus: 'Đang giao' }, 'dealer').eligible).toBe(true);
  });
  it('retains the meaning of historical stock-recovery entries without rewriting old ledgers', () => {
    const cost = calculateEffects({ kind: 'direct_cost', amount: 200000 }, context);
    const recovery = calculateEffects({ kind: 'returned_stock', amount: 200000 }, context);
    expect(cost.cogs + recovery.cogs).toBe(0);
    expect(cost.debts).toEqual([{ partyKey: 'supplier:s', amount: -200000 }]);
    expect(recovery.debts).toEqual([]);
    expect(recovery.cash).toEqual([]);
  });
  it('supplier commitment does not prevent recovering a physical asset', () => {
    for (const kind of ['inventory_recovery','returned_stock'] as const) {
      expect(() => assertOperationalPosting(kind,{orderStatus:'Hàng hoàn'},{...context,returnPolicy:'production_committed'})).not.toThrow();
      const recovery=calculateEffects({kind,amount:120000},{...context,returnPolicy:'production_committed',fulfillment:'inventory'});
      expect(recovery.debts).toEqual([]);
      expect(recovery.cogs).toBe(-120000);
    }
    expect(()=>assertOperationalPosting('supplier_credit',{orderStatus:'Hàng hoàn'},context)).toThrow('vẫn chịu giá vốn');
  });
  it('committed cost can be recorded before delivery, once production is complete', () => {
    const committed = { ...context, returnPolicy: 'production_committed' as const };
    expect(() => assertOperationalPosting('direct_cost', { productionStatus: 'Đang làm' }, committed)).toThrow('Đã trả kết quả');
    expect(() => assertOperationalPosting('direct_cost', { productionStatus: 'Đã trả kết quả' }, committed)).not.toThrow();
  });
  it('receiving cash before delivery creates an advance, not revenue', () => {
    const result = calculateEffects({ kind: 'payment', amount: 100000, fromParty: 'customer', toParty: 'company', toAccountId: 'bank' }, context);
    expect(result.revenue).toBe(0);
    expect(result.debts).toEqual([{ partyKey: 'customer:o', amount: -100000 }]);
  });
  it('return fees remain expenses even when original goods cost is recovered', () => {
    const effects = calculateEffects({ kind: 'expense', amount: 30000, expenseParty: 'supplier' }, context);
    expect(effects.expense).toBe(30000);
    expect(effects.cogs).toBe(0);
  });
});
