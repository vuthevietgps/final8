const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Logger } = require('@nestjs/common');
const { postTreasuryJournal } = require('../dist/business-ledger/treasury-journal');
const { readRegisteredCashBalance } = require('../dist/business-ledger/ledger-cash');
const { buildLedgerReport } = require('../dist/business-ledger/business-ledger.report');
const { FinanceService } = require('../dist/finance/finance.service');
const { CashflowSnapshotService } = require('../dist/finance/cashflow-snapshot.service');
const { CashflowSummarySnapshotSchema } = require('../dist/finance/schemas/cashflow-summary-snapshot.schema');
const { CashflowEntrySchema } = require('../dist/finance/schemas/cashflow-entry.schema');
const { LoanContractSchema } = require('../dist/finance/schemas/loan-contract.schema');
const { SystemSettingsSchema } = require('../dist/finance/schemas/system-settings.schema');
const { LedgerEntrySchema } = require('../dist/business-ledger/business-ledger.schema');
async function main() {
  Logger.overrideLogger(false);
  const name = `erp_treasury_verify_${Date.now()}`;
  const connection = await mongoose.createConnection(`mongodb://127.0.0.1:27027/${name}?replicaSet=erp-local-ledger`, {serverSelectionTimeoutMS:3000}).asPromise();
  let verified = false;
  try {
    assert.equal(connection.host, '127.0.0.1'); assert.equal(connection.name, name);
    assert.equal((await connection.db.admin().command({hello:1})).setName, 'erp-local-ledger'); verified = true;
    const cashflows = connection.model('CashflowEntry', CashflowEntrySchema);
    const loans = connection.model('LoanContract', LoanContractSchema);
    const settings = connection.model('SystemSettings', SystemSettingsSchema);
    const entries = connection.model('LedgerEntry', LedgerEntrySchema);
    const snapshots = connection.model('CashflowSummarySnapshot', CashflowSummarySnapshotSchema);
    await Promise.all([cashflows, loans, settings, entries, snapshots].map(m => m.init()));
    const db = connection.db;
    const accountId = new mongoose.Types.ObjectId();
    const occurredAt = new Date('2026-09-01T01:00:00Z');
    await db.collection('businessledgeraccounts').insertOne({_id:accountId,code:'TEST',name:'Test',openingAt:new Date('2026-01-01'),openingBalance:1000000});
    const loanId = new mongoose.Types.ObjectId();
    await loans.collection.insertOne({_id:loanId,name:'Test',principal:100000,principalRemaining:0,disbursedAmount:0});
    const finance = Object.create(FinanceService.prototype);
    Object.assign(finance,{loanModel:loans,cashflowModel:cashflows,systemSettingsModel:settings,eventEmitter:{emit(){}},cacheManager:{del:async()=>{}}});
    await finance.recordDisbursement(String(loanId), {amount:100000,date:occurredAt.toISOString(),idempotencyKey:'test'});
    assert.equal(await readRegisteredCashBalance(db),1100000);
    assert.equal((await loans.findById(loanId).lean()).principalRemaining,100000);
    await assert.rejects(() => finance.recordDisbursement(String(loanId), {amount:100000,idempotencyKey:'test'}));
    assert.equal(await entries.countDocuments(),1);
    console.log('PASS actual FinanceService disbursement -> canonical cash + principal; replay rejected.');
    let seq = 0;
    async function post(options, fail=false) {
      const session = await connection.startSession();
      try { await session.withTransaction(async () => {
        await postTreasuryJournal(db,session,{referenceId:String(++seq),category:'loan_payment',amount:10000,direction:'out',occurredAt,...options});
        if (fail) throw new Error('simulated source write failure');
      }); } finally {await session.endSession();}
    }
    await post({amount:30000,interest:5000});
    assert.equal(await readRegisteredCashBalance(db),1070000);
    await post({category:'owner_fund_transfer',amount:20000});
    await post({category:'owner_fund_return',direction:'in',amount:10000});
    assert.equal(await readRegisteredCashBalance(db),1060000);
    await post({ownerFund:true,amount:10000,interest:2000});
    assert.equal(await readRegisteredCashBalance(db),1060000);
    const report = buildLedgerReport({orders:[],profiles:[],ads:[],accounts:await db.collection('businessledgeraccounts').find().toArray(),entries:await entries.find().lean(),from:'2026-09-01',to:'2026-09-01'});
    assert.equal(report.adGroups.reduce((s,r)=>s+r.revenue,0),0);
    assert.equal(report.adGroups.reduce((s,r)=>s+r.recordedNetProfit,0),-7000);
    await assert.rejects(()=>post({},true));
    assert.equal(await readRegisteredCashBalance(db),1060000);
    await assert.rejects(()=>post({amount:2000000}));
    await assert.rejects(()=>post({amount:1.5}));
    await db.collection('businessledgeraccounts').insertOne({code:'SECOND',openingAt:new Date('2026-01-01'),openingBalance:0});
    await assert.rejects(()=>post({direction:'in'}));
    await post({direction:'in',accountId:String(accountId)});
    console.log('PASS repayment/interest/Owner cash separation, rollback, insufficient funds, integer VND, explicit multi-account selection.');
    const cache = {get:async()=>({stale:true}),del:async()=>{},set:async()=>{}};
    const service = new CashflowSnapshotService(snapshots,cache);
    await service.refresh('ops',7,async()=>({amount:10}));
    await assert.rejects(()=>service.refresh('ops',7,async()=>{throw new Error('source unavailable');}));
    assert.equal(await service.read('ops',7),null); assert.equal(await service.getStaleness('ops',7),Infinity);
    const restarted = new CashflowSnapshotService(snapshots,cache);
    assert.equal(await restarted.read('ops',7),null);
    await restarted.refresh('ops',7,async()=>({amount:20}));
    assert.deepEqual(await restarted.read('ops',7),{amount:20});
    let release;
    const old = service.refresh('ops',7,()=>new Promise(resolve=>{release=resolve;}));
    while (!release) await new Promise(resolve=>setTimeout(resolve,5));
    await restarted.refresh('ops',7,async()=>({amount:30}));
    release({amount:5}); await old;
    assert.deepEqual(await restarted.read('ops',7),{amount:30});
    console.log('PASS failed snapshot stays blocked through restart; retry restores; older worker cannot overwrite newer data.');
  } finally { if(verified) await connection.dropDatabase(); await connection.close(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
