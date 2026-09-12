// Integration verification against an ALREADY RUNNING isolated MongoDB replica set.
// Never starts services, reads .env, or connects to an existing ERP database.
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
if (process.env.ERP_LOCAL_SANDBOX !== 'true' || !process.execArgv.some(a => a.includes('local-ledger-guard.cjs'))) {
  throw new Error('Run with --require ./scripts/local-ledger-guard.cjs');
}
require('ts-node').register({ transpileOnly: false, project: path.resolve(__dirname, '../tsconfig.json') });
const mongoose = require('mongoose');
const { TestOrder2Schema } = require('../src/test-order2/schemas/test-order2.schema');
const { LedgerEntrySchema, LedgerAccountSchema } = require('../src/business-ledger/business-ledger.schema');
const { LedgerSettlementSchema } = require('../src/business-ledger/settlement.schema');
const { CounterpartyLedgerService } = require('../src/business-ledger/counterparty-ledger.service');
const { SettlementService } = require('../src/business-ledger/settlement.service');
const database = `erp_settlement_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
const oid = () => new mongoose.Types.ObjectId();

async function main() {
  const conn = await mongoose.createConnection(`mongodb://127.0.0.1:27027/${database}`, {
    serverSelectionTimeoutMS: 4000,
  }).asPromise();
  try {
    const hello = await conn.db.admin().command({ hello: 1 });
    assert.equal(hello.setName, 'erp-local-ledger', 'Requires the isolated local replica set');
    const Orders = conn.model('TestOrder2', TestOrder2Schema);
    const Entries = conn.model('LedgerEntry', LedgerEntrySchema);
    const Accounts = conn.model('LedgerAccount', LedgerAccountSchema);
    const schema = LedgerSettlementSchema.clone();
    schema.pre('save', function () {
      if (this.operations?.some(o => o.requestKey === 'intentional-save-failure')) throw new Error('INTENTIONAL_TEST_ROLLBACK');
    });
    const Statements = conn.model('LedgerSettlement', schema);
    await Promise.all([Orders.init(), Entries.init(), Accounts.init(), Statements.init()]);
    const ledger = new CounterpartyLedgerService(Orders, Entries);
    const service = new SettlementService(Statements, Entries, Accounts, ledger);
    const actor = String(oid()), agent = String(oid()), partyKey = `agent:${agent}`;
    const occurredAt = new Date(Date.now() - 60000).toISOString();
    const account = await Accounts.create({ code: 'test_bank', name: 'Synthetic test bank', openingBalance: 0,
      openingAt: new Date(Date.now() - 86400000), evidence: 'Synthetic only', createdBy: actor });
    const orders = [oid(), oid()].map(_id => ({ _id, productId: oid(), supplierId: oid(), agentId: new mongoose.Types.ObjectId(agent),
      financialModelVersion: 2, isActive: true, productSource: 'supplier', quantity: 1, orderDate: new Date(occurredAt),
      productionStatus: 'Đã trả kết quả', dealerProfitState: 'recognized', supplierQuoteId: oid(), agentQuoteId: String(oid()),
      dealerContractAmount: 100000, supplierContractAmount: 60000, recognizedRevenue: 100000, recognizedGoodsCost: 60000, grossProfit: 40000, shipments: [],
    }));
    await conn.db.collection('ordertest2').insertMany(orders);
    const [a, b] = orders.map(o => String(o._id));
    // The second order has an actual prior advance, making it a payable credit.
    await Entries.create({ idempotencyKey: 'fixture-advance', requestHash: 'fixture', kind: 'payment', amount: 180000,
      status: 'confirmed', occurredAt, evidence: 'Synthetic advance', description: 'Synthetic advance', posting: { kind: 'payment', amount: 180000 },
      effects: { revenue: 0, cogs: 0, expense: 0, cash: [], debts: [{ partyKey, amount: -180000 }] }, orderId: b, createdBy: actor });
    const makeStatement = async (key, ids) => {
      const snapshot = await ledger.snapshot(partyKey);
      const doc = await service.create({ requestKey: key, partyKey, sourceHash: snapshot.sourceHash, orderIds: ids, evidence: 'Synthetic agreement' }, actor);
      await service.confirm(String(doc._id), 'Synthetic both-party confirmation', actor);
      return String(doc._id);
    };
    const first = await makeStatement('first', [a, b]);
    const operation = async (id, key, amount, reference) => ({ requestKey: key, sourceHash: (await service.detail(id)).currentHash,
      mode: 'payment', accountId: String(account._id), reference, occurredAt, evidence: 'Synthetic receipt', allocations: [{ orderId: a, amount }] });
    const partial = await operation(first, 'partial', 10000, 'RECEIPT-1');
    await service.operate(first, partial, actor);
    await service.operate(first, partial, actor);
    assert.equal(await Entries.countDocuments({ settlementId: first }), 1, 'Idempotent retries do not post twice');
    const balances = async () => (await ledger.snapshot(partyKey)).rows.map(r => [r.orderId, r.balance]);
    assert.equal(new Map(await balances()).get(a), 90000);
    const before = await balances(), count = await Entries.countDocuments();
    await assert.rejects(service.operate(first, await operation(first, 'duplicate-reference', 1000, 'RECEIPT-1'), actor));
    await assert.rejects(service.operate(first, await operation(first, 'intentional-save-failure', 1000, 'ROLLBACK-RECEIPT'), actor), /INTENTIONAL_TEST_ROLLBACK/);
    assert.equal(await Entries.countDocuments(), count, 'Failed save rolls back all allocated journal entries');
    assert.deepEqual(await balances(), before, 'Failed writes do not change balances');
    assert.equal(await conn.db.collection('businessledgerpaymentreceipts').countDocuments({ reference: 'ROLLBACK-RECEIPT' }), 0);
    const second = await makeStatement('second', [a]);
    const candidates = [await operation(first, 'race-one', 90000, 'RACE-ONE'), await operation(second, 'race-two', 90000, 'RACE-TWO')];
    const race = await Promise.allSettled([service.operate(first, candidates[0], actor), service.operate(second, candidates[1], actor)]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1, 'Only one concurrent full payment succeeds');
    assert.equal(new Map(await balances()).get(a), 0, 'Concurrent settlements never overpay the order');
    const winner = race[0].status === 'fulfilled' ? 0 : 1, winnerId = winner ? second : first;
    await service.reverse(winnerId, { requestKey: 'reverse-race', originalKey: candidates[winner].requestKey, evidence: 'Synthetic correction' }, actor);
    assert.equal(new Map(await balances()).get(a), 90000);
    const offset = { requestKey: 'offset', sourceHash: (await service.detail(first)).currentHash, mode: 'offset', occurredAt,
      evidence: 'Synthetic offset agreement', allocations: [{ orderId: a, amount: 80000 }, { orderId: b, amount: -80000 }] };
    await service.operate(first, offset, actor);
    const offsetEntries = await Entries.find({ kind: 'debt_offset' }).lean();
    assert.equal(offsetEntries.length, 2);
    assert.deepEqual(offsetEntries.flatMap(e => e.effects.cash), []);
    assert.equal(new Map(await balances()).get(a), 10000);
    assert.equal(new Map(await balances()).get(b), 0);
    await service.reverse(first, { requestKey: 'reverse-offset', originalKey: 'offset', evidence: 'Synthetic offset correction' }, actor);
    assert.deepEqual(await balances(), before);
    await service.operate(first, await operation(first, 'corrected-receipt', 90000, candidates[winner].reference), actor);
    assert.equal(new Map(await balances()).get(a), 0, 'Reversed receipt can be reposted once with corrected details');
    console.log('PASS: isolated Mongo transactions, rollback, duplicate references, concurrent settlements, offset and reversals.');
  } finally {
    // Delete only this invocation's synthetic database, never an ERP database.
    if (!/^erp_settlement_test_\d+_[a-f0-9]{8}$/.test(database) || conn.name !== database || conn.port !== 27027) throw new Error('Refusing unexpected cleanup target');
    await conn.dropDatabase();
    await conn.close();
  }
}
main().catch(error => { console.error(error.name + ': ' + error.message); process.exitCode = 1; });
