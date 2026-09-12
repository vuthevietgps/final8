// Real MongoDB transaction verification. No configured URI, credentials or provider calls are accepted.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { EventEmitter2 } = require('@nestjs/event-emitter');
const { SchemaFactory } = require('@nestjs/mongoose');
const { Logger } = require('@nestjs/common');
const { AdvertisingCostSchema } = require('../dist/advertising-cost/schemas/advertising-cost.schema');
const { TestOrder2Schema } = require('../dist/test-order2/schemas/test-order2.schema');
const { AdGroupDailyReportSchema } = require('../dist/finance/schemas/ad-group-daily-report.schema');
const { CapitalAllocationSnapshotSchema } = require('../dist/finance/schemas/capital-allocation-snapshot.schema');
const { AdsDailySpendingSchema } = require('../dist/finance/schemas/ads-daily-spending.schema');
const { WindsorAdsDailyMetricSchema } = require('../dist/provider-connections/schemas/windsor-ads-daily-metric.schema');
const { AdsCostRefreshJob, AdvertisingCostRefreshService, ADS_COST_REFRESH, ORDER_COST_ALLOCATED } = require('../dist/advertising-cost/advertising-cost-refresh.module');
const { OrderCalculationService } = require('../dist/test-order2/services/order-calculation.service');
const { AdGroupDailyReportService } = require('../dist/finance/ad-group-daily-report.service');
const { AdsCostProjectionService } = require('../dist/finance/ads-cost-projection.service');
const { WindsorAdsCostSyncService } = require('../dist/provider-connections/windsor-ads-cost-sync.service');
const { buildLedgerReport } = require('../dist/business-ledger/business-ledger.report');
const { AuthService } = require('../dist/auth/auth.service');
const { LaborCost1Schema } = require('../dist/labor-cost1/schemas/labor-cost1.schema');

async function main() {
  Logger.overrideLogger(false);
  process.env.ADS_BASE_CURRENCY = 'VND';
  const dbName = `erp_financial_propagation_verify_${Date.now()}`;
  const connection = await mongoose.createConnection(`mongodb://127.0.0.1:27027/${dbName}?replicaSet=erp-local-ledger`,
    { serverSelectionTimeoutMS: 2000 }).asPromise();
  let verified = false;
  try {
    const hello = await connection.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'erp-local-ledger');
    assert.equal(connection.host, '127.0.0.1');
    assert.equal(connection.name, dbName);
    verified = true;
    const costs = connection.model('AdvertisingCost', AdvertisingCostSchema);
    const orders = connection.model('TestOrder2', TestOrder2Schema);
    const reports = connection.model('AdGroupDailyReport', AdGroupDailyReportSchema);
    const snapshots = connection.model('CapitalAllocationSnapshot', CapitalAllocationSnapshotSchema);
    const spendings = connection.model('AdsDailySpending', AdsDailySpendingSchema);
    const metrics = connection.model('WindsorAdsDailyMetric', WindsorAdsDailyMetricSchema);
    const jobs = connection.model('AdsCostRefreshJob', SchemaFactory.createForClass(AdsCostRefreshJob));
    await Promise.all([costs, orders, reports, snapshots, spendings, metrics, jobs].map(model => model.init()));
    await jobs.collection.createIndex({ day: 1 }, { unique: true });
    const connectionId = new mongoose.Types.ObjectId();
    const snapshotId = new mongoose.Types.ObjectId();
    await snapshots.collection.insertOne({ _id: snapshotId, date: new Date('2026-09-01'), reinvestmentUsed: 500 });
    const orderId = new mongoose.Types.ObjectId();
    await orders.collection.insertMany([
      { _id: orderId, quantity: 1, adGroupId: '456', orderDate: new Date('2026-09-05'), grossProfit: 1000, realizedGrossProfit: 900, isActive: true },
      { quantity: 3, adGroupId: '456', orderDate: new Date('2026-09-05'), grossProfit: 3000, isActive: true },
    ]);
    const events = new EventEmitter2();
    const queue = new AdvertisingCostRefreshService(jobs, events);
    const calculation = new OrderCalculationService(orders, {}, {}, {}, {}, { set: async () => {} }, events);
    const reportService = new AdGroupDailyReportService(orders, { find: () => ({ exec: async () => [] }) }, {}, reports, snapshots, spendings);
    const cache = { invalidateCache() {}, invalidateMasterBankBalanceCache() {} };
    const projection = new AdsCostProjectionService(calculation, reportService, cache, cache, cache, orders, queue,
      { refreshOrderFinancialSnapshots: async () => {} });
    events.on(ADS_COST_REFRESH, event => projection.refresh(event));
    events.on(ORDER_COST_ALLOCATED, event => projection.afterAllocation(event));
    let read;
    const windsor = new WindsorAdsCostSyncService({}, metrics, costs, { sync: async () => read }, queue);
    let sequence = 0;
    async function actual(day, spend) {
      const runId = `local-fixture-${++sequence}`;
      if (spend !== null) await metrics.collection.updateOne({ connectionId, date: day, accountId: '123', campaignId: '789', adGroupId: '456' }, {
        $set: { lastSyncRunId: runId, currency: 'VND', spend, fetchedAt: new Date() },
      }, { upsert: true });
      read = { runId, status: 'success', accountIds: ['123'], dateFrom: day, dateTo: day,
        errors: [], completedSlices: [{ accountId: '123', date: day }] };
      return windsor.syncConnection(String(connectionId), {}, 'local-test');
    }
    for (const spend of [400, 800, 200, 0, 400, 400]) {
      await actual('2026-09-05', spend);
      const order = await orders.findById(orderId).lean();
      assert.equal(order.advertisingCost, spend / 4);
      assert.equal(order.netProfit, 1000 - spend / 4);
      assert.equal(order.realizedNetProfit, 900 - spend / 4);
      const groupReport = await reports.findOne({ date: '2026-09-05' }).lean();
      const groupOrders = await orders.find({ adGroupId: '456' }).lean();
      assert.equal(groupReport.adsCost, spend);
      assert.equal(groupReport.netProfit, 4000 - spend);
      assert.equal(groupOrders.reduce((sum, row) => sum + row.netProfit, 0), groupReport.netProfit);
      assert.equal((await snapshots.findById(snapshotId).lean()).reinvestmentUsed, 500 + spend);
      assert.equal(await costs.countDocuments({ date: new Date('2026-09-05') }), 1);
      assert.equal((await jobs.findOne({ day: '2026-09-05' }).lean()).pending, false);
    }
    console.log('PASS: actual cost increases/decreases/zero/replay -> orders, realized profit, report, capital snapshot.');

    for (let day = 1; day <= 3; day++) await costs.create({ channel: 'google', customerId: '123', adGroupId: '456',
      date: new Date(`2026-09-0${day}`), currency: 'VND', sourceSystem: 'windsor', sourceConnectionId: String(connectionId), spentAmount: day * 100 });
    read = { runId: 'outage', status: 'failed', accountIds: ['123'], dateFrom: '2026-09-06', dateTo: '2026-09-06',
      errors: [{ accountId: '123', date: '2026-09-06', code: 'PROVIDER_TIMEOUT' }], completedSlices: [] };
    await windsor.syncConnection(String(connectionId), {}, 'local-test');
    const estimate = await costs.findOne({ date: new Date('2026-09-06') }).lean();
    assert.equal(estimate.spentAmount, 250);
    assert.equal(estimate.isEstimated, true);
    assert.equal((await reports.findOne({ date: '2026-09-06' }).lean()).netProfit, -250);
    assert.equal((await snapshots.findById(snapshotId).lean()).reinvestmentUsed, 1150);
    await actual('2026-09-06', null); // Successful empty provider slice clears the placeholder.
    assert.equal((await costs.findOne({ date: new Date('2026-09-06') }).lean()).isEstimated, false);
    assert.equal((await snapshots.findById(snapshotId).lean()).reinvestmentUsed, 900);
    console.log('PASS: temporary historical estimate, zero-order loss, then authoritative zero replaces estimate.');

    const updateSnapshot = snapshots.updateOne.bind(snapshots);
    snapshots.updateOne = () => { throw new Error('injected capital write failure'); };
    await assert.rejects(actual('2026-09-05', 800), /injected capital/);
    assert.equal((await jobs.findOne({ day: '2026-09-05' }).lean()).pending, true);
    assert.equal((await spendings.findOne({ date: '2026-09-05' }).lean()).totalAdsCost, 400);
    assert.equal((await snapshots.findById(snapshotId).lean()).reinvestmentUsed, 900);
    snapshots.updateOne = updateSnapshot;
    await new AdvertisingCostRefreshService(jobs, events).retryPending();
    assert.equal((await jobs.findOne({ day: '2026-09-05' }).lean()).pending, false);
    assert.equal((await spendings.findOne({ date: '2026-09-05' }).lean()).totalAdsCost, 800);
    assert.equal((await snapshots.findById(snapshotId).lean()).reinvestmentUsed, 1300);
    console.log('PASS: transaction rollback leaves durable work; retry repairs financial totals without double counting.');

    const productIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const fixtureOrders = await orders.find({ adGroupId: '456' }).sort({ _id: 1 }).lean();
    for (let i = 0; i < fixtureOrders.length; i++) {
      const row = fixtureOrders[i];
      await orders.collection.updateOne({ _id: row._id }, { $set: {
        productId: productIds[i], financialModelVersion: 2, saleMode: 'retail', retailProfitState: 'recognized',
        recognizedRevenue: row.grossProfit * 2, recognizedGoodsCost: row.grossProfit,
      } });
    }
    const labor = connection.db.collection('laborcost1');
    const other = connection.db.collection('othercosts');
    // Separate source rows verify that both reports round the same way before allocation.
    for (const [laborValues, otherValues] of [
      [[400], [200]], [[800], [200]], [[800], [600]], [[100.4, 100.4], [50.5, 50.5]], [[], []], [[], []],
    ]) {
      await labor.deleteMany({}); await other.deleteMany({});
      if (laborValues.length) await labor.insertMany(laborValues.map(cost => ({ date: new Date('2026-09-05'), cost })));
      if (otherValues.length) await other.insertMany(otherValues.map(amount => ({ date: new Date('2026-09-05'), amount })));
      await queue.mark(['2026-09-05']); await queue.flush('2026-09-05');
      const refreshed = await orders.find({ adGroupId: '456' }).lean();
      const expectedLabor = laborValues.reduce((sum, value) => sum + Math.round(value), 0);
      const expectedOther = otherValues.reduce((sum, value) => sum + Math.round(value), 0);
      assert.equal(refreshed.reduce((sum, row) => sum + row.laborCostAllocation, 0), expectedLabor);
      assert.equal(refreshed.reduce((sum, row) => sum + row.otherCostAllocation, 0), expectedOther);
      const ledger = buildLedgerReport({ orders: refreshed, ads: await costs.find({ date: new Date('2026-09-05') }).lean(),
        overhead: { labor: await labor.find().toArray(), other: await other.find().toArray() },
        entries: [], profiles: [], accounts: [], from: '2026-09-05', to: '2026-09-05' });
      const group = await reports.findOne({ date: '2026-09-05' }).lean();
      assert.equal(group.netProfit, 3200 - expectedLabor - expectedOther);
      assert.equal(ledger.adGroups[0].recordedNetProfit, group.netProfit);
      assert.equal(ledger.adGroups[0].revenue, 8000);
      for (const row of refreshed) {
        const product = ledger.products.find(item => item.key === String(row.productId));
        assert.equal(product.recordedNetProfit, row.netProfit);
        assert.equal(product.revenue, row.recognizedRevenue);
        assert.equal(product.cogs, row.recognizedGoodsCost);
        if (row.realizedGrossProfit != null) assert.equal(row.realizedNetProfit,
          row.realizedGrossProfit - row.advertisingCost - row.laborCostAllocation - row.otherCostAllocation);
      }
      assert.equal((await snapshots.findById(snapshotId).lean()).reinvestmentUsed, 1300);
    }
    console.log('PASS: labor/operating cost changes and removal reconcile orders, ad groups and products, including fractional source amounts.');
    // Exercise the actual logout writer with the real transaction/queue/allocation chain.
    const laborModel = connection.model('LaborCost1', LaborCost1Schema);
    await laborModel.init();
    let openSession;
    const auth = new AuthService(
      { findByIdAndUpdate: () => ({ exec: async () => {} }) },
      { findOne: () => ({ exec: async () => ({ hourlyRate: 400 }) }) },
      laborModel, {}, { logLogout: async () => { const result = openSession; openSession = null; return result; } }, queue,
    );
    const employee = String(new mongoose.Types.ObjectId());
    function loginFixture() {
      openSession = { _id: new mongoose.Types.ObjectId(),
        loginAt: new Date('2026-09-04T18:00:00Z'), logoutAt: new Date('2026-09-04T19:00:00Z') };
    }
    loginFixture();
    const logout = await auth.logout(employee);
    assert.equal(logout.laborCostCreated, true);
    assert.equal(logout.financialRefreshPending, false);
    assert.equal(logout.laborCost.startTime, '01:00');
    assert.equal(+logout.laborCost.date, +new Date('2026-09-05T00:00:00+07:00'));
    assert.equal(await laborModel.countDocuments(), 1);
    assert.equal((await orders.findById(orderId).lean()).laborCostAllocation, 100);
    assert.equal((await reports.findOne({date:'2026-09-05'}).lean()).netProfit, 2800);
    assert.equal((await auth.logout(employee)).laborCostCreated, false);
    assert.equal(await laborModel.countDocuments(), 1);

    const originalCalculate = calculation.recalculateOrdersForDate.bind(calculation);
    calculation.recalculateOrdersForDate = async () => { throw new Error('test projection outage'); };
    loginFixture();
    const pendingLogout = await auth.logout(employee);
    assert.equal(pendingLogout.laborCostCreated, true);
    assert.equal(pendingLogout.financialRefreshPending, true);
    assert.equal(await laborModel.countDocuments(), 2);
    assert.equal((await jobs.findOne({day:'2026-09-05'}).lean()).pending, true);
    calculation.recalculateOrdersForDate = originalCalculate;
    await new AdvertisingCostRefreshService(jobs, events).retryPending();
    assert.equal((await reports.findOne({date:'2026-09-05'}).lean()).netProfit, 2400);
    assert.equal((await orders.findById(orderId).lean()).laborCostAllocation, 200);
    assert.equal(await laborModel.countDocuments(), 2);
    assert.equal((await jobs.findOne({day:'2026-09-05'}).lean()).pending, false);
    const version = (await jobs.findOne({day:'2026-09-05'}).lean()).version;
    const createLabor = laborModel.create.bind(laborModel);
    laborModel.create = async () => { throw new Error('test source write outage'); };
    loginFixture();
    assert.equal((await auth.logout(employee)).laborCostCreated, false);
    laborModel.create = createLabor;
    assert.equal(await laborModel.countDocuments(), 2);
    assert.equal((await jobs.findOne({day:'2026-09-05'}).lean()).version, version);
    console.log('PASS: logout commits labor + refresh job atomically, updates order/group profit on Vietnam day; failed projection retries without duplicate labor; failed source write rolls back job.');
  } finally {
    // Delete only the unique fixture database created by this invocation on the verified local replica.
    if (verified && connection.name === dbName && /^erp_financial_propagation_verify_\d+$/.test(dbName)) await connection.dropDatabase();
    await connection.close();
  }
}
main().catch(error => { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; });
