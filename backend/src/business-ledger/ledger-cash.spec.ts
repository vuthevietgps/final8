import { ledgerCashAccounts, readRegisteredCashBalance } from './ledger-cash';
import { FinanceService } from '../finance/finance.service';
import { buildLedgerReport } from './business-ledger.report';
import { calculateEffects, reverseEffects } from './business-ledger.rules';

const at = new Date('2026-09-05T05:00:00Z');
const bank = { _id: 'bank', code: 'BANK', name: 'Bank', openingAt: '2026-09-01T00:00:00Z', openingBalance: 1000000 };
function movement(amount: number, extra = {}) {
  return { _id: 'payment', kind: 'payment', status: 'confirmed', occurredAt: '2026-09-02T00:00:00Z',
    effects: { revenue: 0, cogs: 0, expense: 0, debts: [], cash: [{ accountId: 'bank', amount }] }, ...extra };
}
function database(accounts: any[], entries: any[]) {
  return { collection: jest.fn((name: string) => ({ find: () => ({ limit: () => ({ toArray: async () =>
    name === 'businessledgeraccounts' ? accounts : entries }) }) })) };
}

describe('Registered cash shared by ledger and CFO', () => {
  it('uses confirmed payments once, without adding legacy capital or subtracting unbilled ads', async () => {
    const service: any = Object.create(FinanceService.prototype);
    service.orderModel = { db: database([bank], [movement(-200000)]) };
    service.cacheManager = { get: async () => undefined, set: async () => undefined };
    service.fundingSourceModel = { aggregate: jest.fn(() => { throw Error('Legacy capital must not be added'); }) };
    expect(await service.calculateMasterBankBalance()).toBe(800000);
    expect(service.fundingSourceModel.aggregate).not.toHaveBeenCalled();
  });
  it('excludes drafts, future payments and movements before the account opening', () => {
    const result = ledgerCashAccounts([bank], [movement(-200000), movement(-900000, { status: 'draft' }),
      movement(-900000, { occurredAt: '2026-09-10' }), movement(-900000, { occurredAt: '2026-08-10' })], at);
    expect(result[0].balance).toBe(800000);
  });
  it('reverses cash and includes transfers between accounts without changing the total', () => {
    const other = { ...bank, _id: 'other', openingBalance: 0 };
    const transfer = movement(0, { effects: { cash: [{ accountId: 'bank', amount: -100000 }, { accountId: 'other', amount: 100000 }] } });
    const rows = ledgerCashAccounts([bank, other], [transfer, movement(-200000), movement(200000, { kind: 'reversal' })], at);
    expect(rows.map(r => r.balance)).toEqual([900000, 100000]);
  });
  it('requires an opening balance instead of estimating cash from profit', async () => {
    await expect(readRegisteredCashBalance(database([], []), at)).rejects.toThrow('đối soát số dư đầu kỳ');
  });
  it('does not turn a database failure into an optimistic fallback', async () => {
    await expect(readRegisteredCashBalance({ collection: () => { throw Error('unavailable'); } }, at)).rejects.toThrow('unavailable');
  });
  it('rejects truncated results and unsafe monetary values', async () => {
    await expect(readRegisteredCashBalance(database(Array(1001).fill(bank), []), at)).rejects.toThrow('giới hạn tài khoản');
    await expect(readRegisteredCashBalance(database([bank], Array(20001).fill(movement(1))), at)).rejects.toThrow('giới hạn chứng từ');
    expect(() => ledgerCashAccounts([bank], [movement(0.5)], at)).toThrow('không hợp lệ');
  });
});

describe('Sales collections used for ad group decisions', () => {
  const order: any = { _id: 'o', productId: { _id: 'p', name: 'Product' }, orderDate: '2026-09-02T00:00:00Z',
    quantity: 1, adGroupId: 'ad', financialModelVersion: 2, saleMode: 'retail', retailProfitState: 'recognized',
    recognizedRevenue: 300000, recognizedGoodsCost: 100000, grossProfit: 200000, costAllocatedAt: at };
  const context: any = { orderId: 'o', productId: 'p', adGroupId: 'ad', quantity: 1, orderDate: order.orderDate, saleMode: 'retail' };
  const posting: any = { kind: 'payment', fromParty: 'customer', toParty: 'company', toAccountId: 'bank', amount: 300000 };
  const receipt = { ...movement(300000), _id: 'receipt', orderId: 'o', context, posting, effects: calculateEffects(posting, context) };
  const report = (entries: any[]) => buildLedgerReport({ entries, orders: [order], profiles: [], accounts: [bank], ads: [], from: '2026-09-01', to: '2026-09-05' });
  it('removes reversed receipts from sales coverage while restoring the actual bank balance', () => {
    const reversal = { ...receipt, _id: 'reverse', kind: 'reversal', reversalOf: receipt._id, effects: reverseEffects(receipt.effects) };
    const result = report([receipt, reversal]);
    expect(result.orders[0].customerCashCollected).toBe(0);
    expect(result.adGroups[0].customerCashCollected).toBe(0);
    expect(result.cash.registeredAccountsBalance).toBe(1000000);
    expect(result.totalReceivable).toBe(300000);
  });
  it('deducts customer refunds but not supplier payments from customer collections', () => {
    const refundPosting: any = { kind: 'payment', fromParty: 'company', fromAccountId: 'bank', toParty: 'customer', amount: 50000 };
    const supplierPosting: any = { kind: 'payment', fromParty: 'company', fromAccountId: 'bank', toParty: 'supplier', amount: 100000 };
    const supplierContext = { ...context, supplierId: 's' };
    const rows = [receipt, { ...receipt, _id: 'refund', posting: refundPosting, effects: calculateEffects(refundPosting, context) },
      { ...receipt, _id: 'supplier', posting: supplierPosting, effects: calculateEffects(supplierPosting, supplierContext) }];
    expect(report(rows).orders[0].customerCashCollected).toBe(250000);
  });
});
