// Read-only diagnostic: real compiled services, in-memory persistence doubles.
// Run npm run build first so dist reflects the current checkout.
// Does not load AppModule, .env, database connections, or provider integrations.
// Exit 1 means business invariants failed; exit 2 means the probe itself failed.
require('./local-ledger-guard.cjs');
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Logger } = require('@nestjs/common');
Logger.overrideLogger(false);
const { Types } = require('mongoose');
const { buildLedgerReport } = require('../dist/business-ledger/business-ledger.report');
const { operationalEntries } = require('../dist/business-ledger/operational-projection');
const { BusinessLedgerService } = require('../dist/business-ledger/business-ledger.service');
const { AdGroupManagementService } = require('../dist/business-ledger/ad-group-management.service');
const { AdGroupProfitReportService } = require('../dist/ad-group-profit-report/ad-group-profit-report.service');
const { OrderReportService } = require('../dist/test-order2/services/order-report.service');
const { OrderCalculationService } = require('../dist/test-order2/services/order-calculation.service');
const { TestOrder2Service } = require('../dist/test-order2/test-order2.service');
const { FinanceService } = require('../dist/finance/finance.service');
const { ProductService } = require('../dist/product/product.service');
const { allocateVnd } = require('../dist/common/allocate-vnd');
const { calculateEffects, reverseEffects } = require('../dist/business-ledger/business-ledger.rules');

const findings = [];
function check(id, description, expected, actual, evidence = {}) {
  const passed = JSON.stringify(expected) === JSON.stringify(actual);
  findings.push({ id, description, expected, actual, passed, evidence });
}
const date = day => new Date(`${day}T05:00:00Z`);
const pid = new Types.ObjectId('111111111111111111111111');
function order(id = 'order-1', extra = {}) {
  return { _id: id, financialModelVersion: 2, isActive: true, saleMode: 'retail',
    productId: { _id: pid, name: 'Synthetic product', categoryId: { _id: 'category-A', name: 'Category A' } },
    productSource: 'supplier', quantity: 1, adGroupId: 'group-1', orderDate: date('2026-08-03'),
    orderStatus: 'Giao thành công', productionStatus: 'Đã trả kết quả',
    retailProfitState: 'recognized', recognizedRevenue: 300000, recognizedGoodsCost: 100000,
    grossProfit: 200000, netProfit: 150000, advertisingCost: 50000,
    laborCostAllocation: 0, otherCostAllocation: 0, costAllocatedAt: date('2026-08-03'),
    shipments: [{ status: 'delivered', quantity: 1, deliveredQuantity: 1, feesConfirmed: true }],
    ...extra };
}
function report(orders, entries = [], ads = [], extra = {}) {
  return buildLedgerReport({ orders, entries, ads, profiles: [], accounts: [],
    from: '2026-08-01', to: '2026-08-31', ...extra });
}
function cursor(rows) {
  return { sort() { return this; }, limit() { return this; }, select() { return this; },
    populate() { return this; }, lean: async () => rows, toArray: async () => rows };
}
const metadata = [{ _id: 'meta-1', adGroupId: 'group-1', name: 'Synthetic group', platform: 'google',
  selectedProducts: [pid], productCategoryId: 'category-A', isActive: true }];
function database(tables, calls = []) {
  return { collection(name) { calls.push(name); return {
    find: () => cursor(tables[name] || []),
    aggregate: () => cursor(tables[name] || []),
    countDocuments: async () => (tables[name] || []).length,
  }; } };
}
async function management(financial) {
  const db = database({ adgroups: metadata });
  const service = new AdGroupManagementService({ report: async () => financial }, { db }, { find: () => cursor([]) });
  return (await service.summary({ from: '2026-08-01', to: '2026-08-31', maturityDays: 7 })).rows[0];
}
function calculation() {
  return new OrderCalculationService({}, {}, {}, {}, {
    getReturnStatusNames: async () => ['Hàng hoàn'],
    getPaymentTriggerStatusNames: async () => ['Giao thành công', 'Hàng hoàn'],
  }, { get: async () => undefined });
}

async function main() {
  // A01: spend on a day without orders is included in spend but omitted from profit.
  const sourceAds = [
    { adGroupId: 'group-1', date: date('2026-08-03'), spentAmount: 100000, currency: 'VND' },
    { adGroupId: 'group-1', date: date('2026-08-04'), spentAmount: 500000, currency: 'VND' },
  ];
  const completed = order('a01', { advertisingCost: 100000, netProfit: 100000 });
  const classification = new AdGroupProfitReportService({ db: database({ advertisingcosts: [
    { _id: 'group-1', spend: 600000 },
  ] }) }, { find: () => cursor(metadata) }, {});
  // Mock only the upstream aggregate result; exercise the actual classification function.
  classification.getAdGroupPerformanceReport = async () => [{ adGroupId: 'group-1', totalOrders: 1,
    totalRevenue: 300000, totalNetProfit: 100000, totalAdsSpent: 100000 }];
  const classified = await classification.getAdGroupProfitClassification({
    startDate: date('2026-08-01'), endDate: date('2026-08-31'),
  });
  const legacyGroup = classified.groups.find(g => g.adGroupId === 'group-1');
  const unified = report([completed], [], sourceAds);
  check('A01', 'Group profit must deduct all source spend, including days with no orders',
    unified.adGroups[0].recordedNetProfit, legacyGroup.netProfitAfterAds,
    { spend: legacyGroup.spend, classification: legacyGroup.status });

  // A02: same product/day includes a pending order with incurred costs.
  const pending = order('pending', { orderStatus: 'Đang giao', retailProfitState: 'awaiting_delivery',
    recognizedRevenue: 0, recognizedGoodsCost: 0, grossProfit: -20000, netProfit: -70000,
    shipments: [{ status: 'dispatched', quantity: 1, feesConfirmed: true }] });
  const rows = [order(), pending];
  const cohort = report(rows, [], [{ adGroupId: 'group-1', date: date('2026-08-03'), spentAmount: 100000 }]);
  const productService = new OrderReportService({ find(filter) {
    const selected = rows.filter(row => filter.$or.some(condition =>
      Object.entries(condition).every(([key, value]) => row[key] === value)));
    return cursor(selected);
  } }, { report: async () => cohort });
  const productReport = await productService.getProductProfitReport({ date: '2026-08-03' });
  check('A02', 'Product profit must retain incurred costs on pending orders in the same cohort',
    cohort.products[0].recordedNetProfit, productReport.totals.netProfit);
  check('A03', 'The returned business date must match the requested date',
    { from: '2026-08-03', to: '2026-08-03' }, productReport.dateRange);

  // A04: the same account has 1m opening capital and a confirmed 200k ledger payment.
  const account = { _id: 'bank', code: 'BANK', name: 'Synthetic bank', openingBalance: 1000000,
    openingAt: date('2026-08-01') };
  const cash = report([], [{ _id: 'payment', kind: 'payment', status: 'confirmed',
    occurredAt: date('2026-08-03'), effects: { revenue: 0, cogs: 0, expense: 0, debts: [],
      cash: [{ accountId: 'bank', amount: -200000 }] } }], [], { accounts: [account] });
  const finance = Object.create(FinanceService.prototype);
  for (const key of ['loanModel', 'loanPaymentModel', 'orderModel', 'adsCostModel',
    'laborStatementModel', 'otherCostModel', 'cashflowModel']) finance[key] = { aggregate: async () => [] };
  finance.orderModel.db = database({
    businessledgeraccounts: [account],
    businessledgerentries: [{ _id: 'payment', kind: 'payment', status: 'confirmed',
      occurredAt: date('2026-08-03'), effects: { cash: [{ accountId: 'bank', amount: -200000 }] } }],
  });
  finance.fundingSourceModel = { aggregate: async () => [{ total: 1000000 }] };
  finance.cacheManager = { get: async () => undefined, set: async () => undefined };
  finance.logger = { debug() {} };
  check('A04', 'CFO bank balance must include confirmed payments from the new ledger',
    cash.cash.registeredAccountsBalance, await finance.calculateMasterBankBalance());

  // A05: all three receipts were reversed; cash is zero, receivables are fully restored.
  const mature = [order('mature-1'), order('mature-2'), order('mature-3')];
  const entries = mature.flatMap(row => {
    const context = { ...operationalEntries([row])[0].context, saleMode: 'retail', fulfillment: 'supplier_direct' };
    const posting = { kind: 'payment', amount: 300000, fromParty: 'customer', toParty: 'company', toAccountId: 'bank' };
    const receipt = { _id: `receipt:${row._id}`, kind: 'payment', status: 'confirmed', posting,
      orderId: row._id, context, occurredAt: date('2026-08-04'), effects: calculateEffects(posting, context) };
    return [receipt, { ...receipt, _id: `reverse:${row._id}`, kind: 'reversal', reversalOf: receipt._id,
      effects: reverseEffects(receipt.effects) }];
  });
  const reversedReport = report(mature, entries, [], { accounts: [{ ...account, openingBalance: 0 }] });
  const reversedManagement = await management(reversedReport);
  check('A05', 'Reversed receipts restore collection exposure without changing ad profit assessment',
    { balance: 0, receivable: 900000, cashConversion: 0, status: 'profitable', canProposeScale: true },
    { balance: reversedReport.cash.registeredAccountsBalance,
      receivable: reversedManagement.financial.receivable, cashConversion: reversedManagement.financial.cashConversion,
      status: reversedManagement.quality.status, canProposeScale: reversedManagement.canProposeScale });

  // A06: a negative amount (accepted by the current DTO) must block conclusions.
  const invalidReport = report(mature, entries.filter(e => e.kind !== 'reversal'), [{ adGroupId: 'group-1', spentAmount: -100000,
    currency: 'VND', date: date('2026-08-03') }]);
  const invalidManagement = await management(invalidReport);
  check('A06', 'Invalid advertising cost must be surfaced as a group data issue',
    'data_issue', invalidManagement.quality.status,
    { invalidAds: invalidReport.quality.invalidAds, spendUsed: invalidManagement.financial.advertisingCost,
      canProposeScale: invalidManagement.canProposeScale });

  // A07: actual report query has access to source overhead, but does not read it.
  const calls = [];
  const tables = { othercosts: [{ date: date('2026-08-03'), amount: 100000, isConfirmed: true }] };
  const ledger = Object.create(BusinessLedgerService.prototype);
  ledger.entries = { find: () => cursor([]) };
  ledger.accounts = { find: () => cursor([]) };
  ledger.profiles = { find: () => cursor([]) };
  ledger.orders = { find: () => cursor([]), db: database(tables, calls) };
  const noOrders = await ledger.report('2026-08-01', '2026-08-31');
  check('A07', 'Operating costs on a day without orders must remain as unallocated expenses',
    -100000, noOrders.orders.reduce((sum, row) => sum + row.recordedNetProfit, 0),
    { collectionsRead: [...new Set(calls)] });

  // A08: service deletes a product even though the synthetic DB has a referencing order.
  let deleted = false;
  const usedProduct = new ProductService({
    db: database({ ordertest2: [{ productId: pid }] }),
    findByIdAndDelete: () => ({ exec: async () => { deleted = true; return { _id: pid }; } }),
  }, {});
  let rejected = false;
  try { await usedProduct.remove(String(pid)); } catch { rejected = true; }
  check('A08', 'A product referenced by orders must not be hard-deleted', true, rejected,
    { hardDeleteCalled: deleted });

  // A09: partial delivery has already recognized part of the sale price.
  const partial = order('111111111111111111111112', { quantity: 2, deliveredQuantity: 1,
    orderStatus: 'Giao một phần', supplierQuoteId: 'quote', supplierAppliedPrice: 100000,
    retailSaleAmount: 600000, shippingFee: 0, returnFee: 0,
    shipments: [{ status: 'partial', quantity: 2, deliveredQuantity: 1, feesConfirmed: true }] });
  partial.toObject = () => ({ ...partial });
  partial.save = async () => partial;
  const calc = calculation();
  await calc.applyCompletedStatusFinancials(partial);
  const revenueBefore = partial.recognizedRevenue;
  calc.autoCalculateQuoteFields = row => calc.applyCompletedStatusFinancials(row);
  const updates = new TestOrder2Service({ findById: async () => partial }, {}, calc, {}, {}, {},
    { triggerSyncOnOrderChange: async () => undefined }, { emit() {} }, {});
  // Stub only unrelated side effects; run the actual update immutability guards and calculations.
  updates.createSupplierPayableIfEligible = async () => undefined;
  updates.refreshOrderAllocationsForDates = async () => undefined;
  updates.reloadOrderById = async () => partial;
  let partialRejected = false;
  let partialError;
  try { await updates.update(String(partial._id), { retailSaleAmount: 1000000 }); }
  catch (error) {
    if (typeof error.getStatus !== 'function' || error.getStatus() !== 400) throw error;
    partialRejected = true; partialError = error.message;
  }
  check('A09', 'The original price of a partially recognized retail sale must be immutable',
    true, partialRejected && partial.recognizedRevenue === revenueBefore,
    { rejected: partialRejected, error: partialError, revenueBefore, revenueAfter: partial.recognizedRevenue });

  // Positive controls: distinguish currently working invariants from the defects above.
  check('C01', 'Ledger retains all advertising source spend', 600000,
    unified.adGroups.reduce((sum, row) => sum + row.advertisingCost, 0));
  check('C02', 'Order, product, category and ad group totals reconcile within one ledger report',
    [80000, 80000, 80000, 80000], ['orders', 'products', 'productCategories', 'adGroups']
      .map(key => cohort[key].reduce((sum, row) => sum + row.recordedNetProfit, 0)));
  check('C03', 'A receipt and its reversal restore bank balance and debt correctly',
    { balance: 0, receivable: 900000 }, { balance: reversedReport.cash.registeredAccountsBalance,
      receivable: reversedReport.totalReceivable });
  check('C04', 'Integer VND allocations conserve the source amount', 7,
    allocateVnd(7, [1, 1, 1]).reduce((sum, value) => sum + value, 0));
  const retail = { quantity: 1, saleMode: 'retail', supplierQuoteId: 'quote', supplierAppliedPrice: 100000,
    retailSaleAmount: 300000, codAmount: 200000, depositAmount: 100000,
    shippingFee: 20000, returnFee: 30000, orderStatus: 'Giao thành công' };
  check('C05', 'Retail profit uses the agreed full sale price and excludes an unincurred return fee',
    180000, await calculation().calculateGrossProfit(retail));

  const result = { checkedAt: new Date().toISOString(), scope: 'real_services_with_in_memory_persistence',
    databaseConnections: 0, providerCalls: 0, checks: findings.length,
    passed: findings.filter(x => x.passed).length, mismatches: findings.filter(x => !x.passed).length, findings };
  writeFileSync(resolve(__dirname, '../../docs/finance/profit-finance-logic-audit-2026-09-05-results.json'),
    JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.mismatches ? 1 : 0;
}
main().catch(error => { console.error(`Probe failed: ${error.message}`); process.exitCode = 2; });
