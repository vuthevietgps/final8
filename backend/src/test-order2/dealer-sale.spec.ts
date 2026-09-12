import { dealerSaleAmounts } from './dealer-sale';
import { assertOperationalPosting, calculateEffects, OrderContext } from '../business-ledger/business-ledger.rules';

const order = {
  agentId: 'dealer', quantity: 1, productionStatus: 'Đã trả kết quả', trackingNumber: 'VN-1',
  agentQuoteId: 'aq', supplierQuoteId: 'sq', agentAppliedPrice: 250000, supplierAppliedPrice: 120000,
  shippingFee: 20000, returnFee: 30000, packagingCostSnapshot: 5000,
};
describe('Dealer is the company end customer', () => {
  it('recognizes the sale on dispatch without using COD or collection', () => {
    expect(dealerSaleAmounts(order, false)).toMatchObject({ state: 'recognized', revenue: 250000,
      goodsCost: 120000, recoverableFees: 20000, contractAmount: 270000, grossProfit: 125000 });
  });
  it('return retains revenue and cost, and adds the return fee to the dealer obligation', () => {
    expect(dealerSaleAmounts(order, true)).toMatchObject({ revenue: 250000, goodsCost: 120000,
      returnFeeReceivable: 30000, recoverableFees: 50000, contractAmount: 300000, grossProfit: 125000 });
  });
  it('always charges outbound shipping on a successful dealer sale despite legacy flags', () => {
    expect(dealerSaleAmounts({ ...order, dealerShippingIncludedInPrice: true }, false))
      .toMatchObject({ recoverableFees: 20000, contractAmount: 270000, grossProfit: 125000 });
  });
  it('a returned dealer order owes all three amounts despite a prior included-shipping flag', () => {
    expect(dealerSaleAmounts({ ...order, dealerShippingIncludedInPrice: true }, true))
      .toMatchObject({ revenue: 250000, recoverableFees: 50000, contractAmount: 300000, grossProfit: 125000 });
  });
  it('a later reship status does not erase an already incurred return fee', () => {
    expect(dealerSaleAmounts({ ...order, dealerReturnedAt: new Date(), dealerShippingIncludedInPrice: true }, false))
      .toMatchObject({ returnFeeReceivable: 30000, contractAmount: 300000 });
  });
  it.each([
    { productionStatus: 'Đang làm' }, { trackingNumber: '' }, { trackingNumber: '   ' },
  ])('does not recognize before dispatch: %j', partial => {
    expect(dealerSaleAmounts({ ...order, ...partial }, false))
      .toMatchObject({ state: 'awaiting_dispatch', revenue: 0, contractAmount: 0 });
  });
  it('retains ownership and sale after tracking/status edits once dispatch was recorded', () => {
    expect(dealerSaleAmounts({ ...order, dealerSaleRecognizedAt: new Date(), trackingNumber: '', productionStatus: 'Đang làm' }, true))
      .toMatchObject({ state: 'recognized', revenue: 250000, goodsCost: 120000 });
  });
  it.each([{ agentQuoteId: undefined }, { supplierQuoteId: undefined }, { agentAppliedPrice: NaN }])
  ('reports missing prices, not a zero-cost profit: %j', partial => {
    expect(dealerSaleAmounts({ ...order, ...partial }, true)).toMatchObject({ state: 'missing_quotes', grossProfit: 0 });
  });
  it('allows legitimate zero quote prices', () => {
    expect(dealerSaleAmounts({ ...order, agentAppliedPrice: 0, supplierAppliedPrice: 0 }, true).state).toBe('recognized');
  });
  const context: OrderContext = { orderId: 'o', productId: 'p', agentId: 'a', supplierId: 's', quantity: 1,
    orderDate: '2026-09-01', saleMode: 'dealer', fulfillment: 'supplier_direct', returnPolicy: 'recoverable' };
  it.each(['sale_credit', 'supplier_credit', 'inventory_recovery', 'returned_stock'] as const)
  ('blocks treating dealer custody as company return: %s', kind => {
    expect(() => assertOperationalPosting(kind, { ...order, orderStatus: 'Hàng hoàn' }, context)).toThrow('giữ hộ');
  });
  it('retail recovery restores stock without a supplier credit', () => {
    expect(() => assertOperationalPosting('returned_stock', { orderStatus: 'Hàng hoàn' }, { ...context, saleMode: 'retail' })).not.toThrow();
    expect(calculateEffects({kind:'returned_stock',amount:100000},{...context,saleMode:'retail'}).debts).toEqual([]);
  });
  it('recovering a return fee creates dealer receivable, cancels cost and does not create cash or goods revenue', () => {
    const expense = calculateEffects({ kind: 'expense', amount: 30000, expenseParty: 'supplier' }, context);
    const recovery = calculateEffects({ kind: 'dealer_cost_recovery', amount: 30000 }, context);
    expect(expense.expense + recovery.expense).toBe(0);
    expect(recovery.debts).toEqual([{ partyKey: 'agent:a', amount: 30000 }]);
    expect(recovery.revenue).toBe(0);
    expect(recovery.cash).toEqual([]);
  });
});
