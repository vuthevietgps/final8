import { buildLedgerReport } from './business-ledger.report';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';
import { calculateEffects } from './business-ledger.rules';

// Real financial calculators, in-memory inputs; this does not exercise HTTP or provider access.
const calculation = () => new OrderCalculationService({} as any, {} as any, {} as any, {} as any,
  { getReturnStatusNames: async () => ['Hàng hoàn'] } as any, {} as any);
const makeOrder = (extra = {}): any => ({
  _id: 'o1', financialModelVersion: 2, productId: 'product', supplierId: 'supplier',
  orderDate: '2026-09-05T03:00:00Z', adGroupId: 'g1', quantity: 1,
  productionStatus: 'Đã trả kết quả', trackingNumber: 'VN-1', orderStatus: 'Giao thành công',
  productSource: 'supplier', supplierQuoteId: 'sq', supplierAppliedPrice: 120000,
  retailSaleAmount: 300000, shippingFee: 20000, returnFee: 30000,
  packagingCostSnapshot: 0, advertisingCost: 40000, laborCostAllocation: 10000,
  otherCostAllocation: 5000, ...extra,
});
const ad = (spentAmount: number, extra = {}) => ({ date: '2026-09-05', adGroupId: 'g1', spentAmount, ...extra });
const report = (orders: any[], ads = [ad(40000)]) => buildLedgerReport({
  orders, ads, entries: [], accounts: [], profiles: [], from: '2026-09-05', to: '2026-09-06',
});
function expectReconciled(result: ReturnType<typeof report>) {
  for (const [field, groups] of [['adGroupId', result.adGroups], ['productId', result.products]] as const) {
   for (const group of groups) {
    const rows = result.orders.filter(row => row[field] === group.key);
    for (const field of ['revenue', 'cogs', 'expense', 'advertisingCost', 'recordedNetProfit']) {
      expect(group[field]).toBe(rows.reduce((sum, row) => sum + row[field], 0));
    }
    expect(group.recordedNetProfit).toBe(group.revenue - group.cogs - group.expense - group.advertisingCost);
   }
  }
}

describe('Order and ad-group revenue, costs and profit after financial changes', () => {
  it.each([
    ['retail', {}], ['dealer', { agentId: 'dealer', agentQuoteId: 'aq', agentAppliedPrice: 250000 }],
  ])('%s COD and deposit edits do not reprice the sale or create receipts', async (_name, extra) => {
    const order = makeOrder(extra);
    const calc = calculation();
    await calc.applyCompletedStatusFinancials(order);
    const original = report([order]);
    for (const [codAmount, depositAmount, manualPayment] of [[200000, 100000, 0], [150000, 150000, 0], [0, 300000, 300000], [0, 0, 0]]) {
      Object.assign(order, { codAmount, depositAmount, manualPayment });
      await calc.applyCompletedStatusFinancials(order);
      const result = report([order]);
      for (const field of ['revenue', 'cogs', 'expense', 'advertisingCost', 'recordedNetProfit', 'cashIn', 'cashOut', 'receivable', 'payable']) {
        expect(result.orders[0][field]).toBe(original.orders[0][field]);
      }
      expectReconciled(result);
    }
  });

  it('a confirmed deposit receipt changes cash and debt, while profit remains unchanged', async () => {
    const order = makeOrder({ depositAmount: 100000, codAmount: 200000 });
    await calculation().applyCompletedStatusFinancials(order);
    const context: any = { orderId: 'o1', productId: 'product', supplierId: 'supplier', adGroupId: 'g1',
      orderDate: order.orderDate, quantity: 1, saleMode: 'retail', fulfillment: 'supplier_direct' };
    const posting: any = { kind: 'payment', amount: 100000, fromParty: 'customer', toParty: 'company', toAccountId: 'bank' };
    const result = buildLedgerReport({ orders: [order], ads: [ad(40000)], profiles: [],
      accounts: [{ _id: 'bank', openingAt: '2026-09-01', openingBalance: 0 }],
      entries: [{ _id: 'receipt', orderId: 'o1', context, posting, kind: 'payment', status: 'confirmed',
        occurredAt: order.orderDate, effects: calculateEffects(posting, context) }], from: '2026-09-05', to: '2026-09-06' });
    expect(result.cash.registeredAccountsBalance).toBe(100000);
    expect(result.orders[0]).toMatchObject({ revenue: 300000, receivable: 200000, recordedNetProfit: 105000 });
    expectReconciled(result);
  });

  it('allocates overhead by quantity across products, ad groups and non-ads orders without counting cached costs twice', async () => {
    const orders = [makeOrder({ productId: 'p1' }),
      makeOrder({ _id: 'o2', productId: 'p2', adGroupId: 'g2', quantity: 2, retailSaleAmount: 600000 }),
      makeOrder({ _id: 'o3', productId: 'p1', adGroupId: undefined })];
    for (const row of orders) await calculation().applyCompletedStatusFinancials(row);
    for (const [laborCost, otherCost] of [[40000, 20000], [80000, 40000], [0, 0], [0, 0]]) {
      const result = buildLedgerReport({ orders, ads: [], entries: [], accounts: [], profiles: [],
        overhead: { labor: [{ date: '2026-09-05', cost: laborCost }], other: [{ date: '2026-09-05', amount: otherCost }] },
        from: '2026-09-05', to: '2026-09-06' });
      for (const row of result.orders) {
        expect(row.laborCostAllocation).toBe(laborCost * row.quantity / 4);
        expect(row.otherCostAllocation).toBe(otherCost * row.quantity / 4);
      }
      expect(result.products.reduce((sum, row) => sum + row.revenue, 0)).toBe(1200000);
      expect(result.products.reduce((sum, row) => sum + row.recordedNetProfit, 0)).toBe(660000 - laborCost - otherCost);
      expectReconciled(result);
    }
  });

  it('moving overhead to a day without orders preserves a separate unallocated loss', async () => {
    const order = makeOrder(); await calculation().applyCompletedStatusFinancials(order);
    const result = buildLedgerReport({ orders: [order], ads: [], entries: [], accounts: [], profiles: [],
      overhead: { labor: [{ date: '2026-09-06', cost: 40000 }], other: [{ date: '2026-09-06', amount: 20000 }] },
      from: '2026-09-05', to: '2026-09-06' });
    expect(result.orders.find(row => row.orderId === 'o1')).toMatchObject({ laborCostAllocation: 0, otherCostAllocation: 0, recordedNetProfit: 160000 });
    expect(result.products.find(row => row.key === 'unallocated')?.recordedNetProfit).toBe(-60000);
    expect(result.quality.unallocatedOverhead).toBe(60000);
    expectReconciled(result);
  });

  it.each([
    ['retail delivered', {}, 300000, 120000, 35000, 105000],
    ['retail returned before stock recovery', { orderStatus: 'Hàng hoàn' }, 0, 120000, 65000, -225000],
    ['dealer delivered', { agentId: 'dealer', agentQuoteId: 'aq', agentAppliedPrice: 250000 }, 250000, 120000, 15000, 75000],
    ['dealer returned', { agentId: 'dealer', agentQuoteId: 'aq', agentAppliedPrice: 250000, orderStatus: 'Hàng hoàn' }, 250000, 120000, 15000, 75000],
  ])('%s reconciles every financial component to its group', async (_name, extra, revenue, cogs, expense, profit) => {
    const order = makeOrder(extra);
    await calculation().applyCompletedStatusFinancials(order);
    const result = report([order]);
    expect(order.netProfit).toBe(profit);
    expect(result.orders[0]).toMatchObject({ revenue, cogs, expense, advertisingCost: 40000, recordedNetProfit: profit });
    expectReconciled(result);
  });

  it('a shipping fee correction changes order and group profit without changing revenue or inventing cash', async () => {
    const order = makeOrder();
    const calc = calculation();
    for (const [shippingFee, profit] of [[20000, 105000], [35000, 90000], [35000, 90000]]) {
      order.shippingFee = shippingFee;
      await calc.applyCompletedStatusFinancials(order);
      const result = report([order]);
      expect(order.netProfit).toBe(profit);
      expect(result.adGroups[0]).toMatchObject({ revenue: 300000, cogs: 120000, recordedNetProfit: profit, cashIn: 0, cashOut: 0 });
      expectReconciled(result);
    }
  });

  it('daily ads corrections preserve revenue and goods cost and conserve every VND across quantities', async () => {
    const orders = [makeOrder(), makeOrder({ _id: 'o2', quantity: 3, retailSaleAmount: 900000 })];
    for (const order of orders) await calculation().applyCompletedStatusFinancials(order);
    for (const spend of [40000, 80001, 20000, 0, 0]) {
      const result = report(orders, [ad(spend)]);
      expect(result.adGroups[0]).toMatchObject({ revenue: 1200000, cogs: 480000, expense: 70000,
        advertisingCost: spend, recordedNetProfit: 650000 - spend });
      expect(result.orders[0].advertisingCost).toBe(Math.round(spend / 4));
      expectReconciled(result);
    }
  });

  it('moving the only order to another group keeps old-group spend as a loss', async () => {
    const order = makeOrder();
    await calculation().applyCompletedStatusFinancials(order);
    order.adGroupId = 'g2';
    const result = report([order], [ad(40000), ad(20000, { adGroupId: 'g2' })]);
    expect(result.adGroups.find(row => row.key === 'g1')).toMatchObject({ revenue: 0, advertisingCost: 40000, recordedNetProfit: -40000 });
    expect(result.adGroups.find(row => row.key === 'g2')).toMatchObject({ revenue: 300000, advertisingCost: 20000, recordedNetProfit: 125000 });
    expectReconciled(result);
  });

  it('moving the only order to another day leaves the old-day ads visible and charges only new-day ads to the order', async () => {
    const order = makeOrder();
    await calculation().applyCompletedStatusFinancials(order);
    order.orderDate = '2026-09-06T03:00:00Z';
    const result = report([order], [ad(40000), ad(20000, { date: '2026-09-06' })]);
    expect(result.orders.find(row => row.orderId === 'o1')).toMatchObject({ revenue: 300000, advertisingCost: 20000, recordedNetProfit: 125000 });
    expect(result.orders.find(row => row.adsOnly)).toMatchObject({ orderDay: '2026-09-05', recordedNetProfit: -40000 });
    expect(result.adGroups[0].recordedNetProfit).toBe(85000);
    expectReconciled(result);
  });
});
