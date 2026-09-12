/* Diagnostic audit, not a production migration. Reads current TypeScript services.
 * Only writes synthetic fixtures to a new database on the isolated local MongoDB.
 * Exit 2 means business-rule gaps reproduced; exit 1 means the probe itself failed.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
if (process.env.ERP_LOCAL_SANDBOX !== 'true'
    || !process.execArgv.some(arg => arg.includes('local-ledger-guard.cjs'))) {
  throw new Error('Run with --require ./scripts/local-ledger-guard.cjs');
}
// Full type checking preserves Nest/Mongoose decorator metadata for union aliases.
require('ts-node').register({ transpileOnly: false, project: path.resolve(__dirname, '../tsconfig.json') });
const mongoose = require('mongoose');
const { Logger } = require('@nestjs/common');
Logger.overrideLogger(false);
const { OrderCalculationService } = require('../src/test-order2/services/order-calculation.service');
const { TestOrder2Service } = require('../src/test-order2/test-order2.service');
const { TestOrder2Schema } = require('../src/test-order2/schemas/test-order2.schema');
const { AgentReceivableService } = require('../src/agent-receivable/agent-receivable.service');
const { CounterpartyLedgerService } = require('../src/business-ledger/counterparty-ledger.service');
const { LedgerEntrySchema } = require('../src/business-ledger/business-ledger.schema');
const { ReturnRequestService } = require('../src/return-request/return-request.service');
const { InventoryService } = require('../src/inventory/inventory.service');
const { InventorySummarySchema } = require('../src/inventory/schemas/inventory-summary.schema');
const { InventoryBatchSchema } = require('../src/inventory/schemas/inventory-batch.schema');
const { InventoryTransactionSchema } = require('../src/inventory/schemas/inventory-transaction.schema');
const { OrderShipmentService } = require('../src/test-order2/services/order-shipment.service');

const database = `erp_business_model_audit_${Date.now()}_${randomBytes(3).toString('hex')}`;
const results = [];
const check = (id, expected, actual, scope) => results.push({ id, expected, actual,
  passed: JSON.stringify(expected) === JSON.stringify(actual), scope });
const oid = () => new mongoose.Types.ObjectId();
const calc = new OrderCalculationService({}, {}, {}, {}, {
  getReturnStatusNames: async () => ['Hàng hoàn'],
  getPaymentTriggerStatusNames: async () => ['Giao thành công', 'Hàng hoàn'],
}, { get: async () => undefined });
const order = (extra = {}) => ({ _id: oid(), productId: oid(), supplierId: oid(),
  quantity: 1, productionStatus: 'Đã trả kết quả', trackingNumber: 'AUDIT-ONLY',
  supplierQuoteId: oid(), supplierAppliedPrice: 120000, supplierQuote: 120000,
  agentQuoteId: String(oid()), agentAppliedPrice: 250000, agentQuote: 250000,
  shippingFee: 20000, returnFee: 30000, packagingCostSnapshot: 0,
  retailSaleAmount: 300000, codAmount: 300000, depositAmount: 0, codCollectedBySupplier: 0,
  advertisingCost: 0, laborCostAllocation: 0, otherCostAllocation: 0,
  orderDate: new Date('2026-09-04T03:00:00Z'), isActive: true, ...extra });

async function main() {
  const conn = await mongoose.createConnection(`mongodb://127.0.0.1:27027/${database}`,
    { serverSelectionTimeoutMS: 4000 }).asPromise();
  try {
    const summary = conn.model('InventorySummary', InventorySummarySchema);
    const batch = conn.model('InventoryBatch', InventoryBatchSchema);
    const tx = conn.model('InventoryTransaction', InventoryTransactionSchema);
    const orderModel = conn.model('TestOrder2', TestOrder2Schema);
    await Promise.all([batch.init(), tx.init(), orderModel.init()]);
    const inventory = new InventoryService(summary, tx, batch);
    const ledgerEntries=conn.model('LedgerEntry',LedgerEntrySchema);
    const receivable = new AgentReceivableService({}, orderModel, { emit() {} },new CounterpartyLedgerService(orderModel,ledgerEntries));

    for (const fixture of [
      { id: 'dealer_delivered_unpaid', status: 'Giao thành công', returnable: true, price: 250000, expected: 270000 },
      { id: 'dealer_returned_still_owes_goods', status: 'Hàng hoàn', returnable: true, price: 250000, expected: 300000 },
      { id: 'zero_dealer_quote_must_not_fallback_to_cod', status: 'Hàng hoàn', returnable: false, price: 0, expected: 50000 },
    ]) {
      const doc = order({ financialModelVersion:2,productSource:'supplier',agentId: oid(), orderStatus: fixture.status,
        agentQuote: fixture.price, agentAppliedPrice: fixture.price });
      doc.grossProfit=await calc.calculateGrossProfit(doc);
      await conn.db.collection('products').insertOne({ _id: doc.productId,
        name: 'Synthetic audit product', isReturnable: fixture.returnable });
      await conn.db.collection('ordertest2').insertOne(doc);
      const result = await receivable.getAgentReceivableSummary({ agentId: String(doc.agentId) });
      check(fixture.id, fixture.expected, result.totals.receivableAmount,
        'Canonical counterparty ledger via AgentReceivableService on isolated MongoDB; no payments recorded.');
    }

    const dealer = order({ agentId: oid(), orderStatus: 'Giao thành công' });
    check('control_dealer_goods_margin', 130000, await calc.calculateGrossProfit(dealer), 'Current source service.');
    const bespoke = order({ orderStatus: 'Hàng hoàn' });
    check('control_retail_unrecoverable_return', -170000, await calc.calculateGrossProfit(bespoke), 'Current source service; no recovery value.');

    const prepaid = order({ orderStatus: 'Giao thành công', depositAmount: 100000, codAmount: 200000 });
    await calc.calculateGrossProfit(prepaid);
    check('retail_price_300k_deposit_100k_cod_200k', 300000, prepaid.recognizedRevenue,
      'Agreed total price is 300000; deposit is part-payment, not a discount.');
    const companyCollected = order({ orderStatus: 'Giao thành công', codCollectedBySupplier: 0 });
    await calc.applyCompletedStatusFinancials(companyCollected);
    check('delivery_must_not_fabricate_supplier_collection', 0, companyCollected.codCollectedBySupplier,
      'Company collected; explicit supplier collection was zero before status calculation.');

    for (const saleMode of ['retail', 'dealer']) {
      const doc = order({ orderStatus: 'Đang giao', ...(saleMode === 'dealer' ? { agentId: oid() } : {}) });
      doc.save = async () => doc;
      const returnDoc = { _id: oid(), orderId: doc._id, status: 'pending',
        items: [{ _id: oid(), productId: doc.productId, quantityReturned: 1 }],
        save: async () => {}, toObject() { return { orderId: this.orderId, items: this.items }; } };
      // Transaction orchestration is mocked. InventoryService and MongoDB writes are real;
      // this does not test transaction rollback/concurrency or HTTP authorization.
      const session = { withTransaction: async work => work(), endSession: async () => {} };
      const returnService = new ReturnRequestService({
        db: { startSession: async () => session },
        findOneAndUpdate: async () => returnDoc,
      }, { findById: () => ({ session: async () => doc }) }, {
        recordReturnFromRMA: (items, notes, _session, context) => inventory.recordReturnFromRMA(items, notes, undefined, context),
      }, calc, { emit() {} });
      await returnService.resolve(String(returnDoc._id), { items: [{
        itemId: String(returnDoc.items[0]._id), decision: 'restock', quantity: 1, recoveryUnitCost: 120000,
      }] });
      const stock = await summary.findOne({ productId: doc.productId }).lean();
      if (saleMode === 'retail') {
        check('retail_recovery_updates_inventory_and_order_profit',
          { stockValue: 120000, grossProfit: -50000 },
          { stockValue: stock.onHand * stock.avgCost, grossProfit: doc.grossProfit },
          'Actual return resolve/calculation/inventory services; transaction and order persistence mocked.');
      } else {
        check('dealer_custody_must_not_enter_shared_company_stock', 0, stock?.onHand || 0,
          'Dealer-owned return enters the same unpartitioned inventory used for all product sales.');
      }
    }

    let supplierPayload;
    const lifecycle = new TestOrder2Service({}, {}, calc, {}, {}, {
      upsertForOrder: async payload => { supplierPayload = payload; },
    }, {}, { emit() {} });
    await lifecycle.createSupplierPayableIfEligible(order({ codAmount: 0, depositAmount: 300000 }), 'Chưa làm');
    check('company_prepaid_sale_still_owes_supplier', 140000, supplierPayload.totalAmount,
      'Actual production-complete hook; supplier write captured. Goods 120000 + supplier freight 20000.');
    const inventoryOrder = new orderModel({ ...order(), productSource: 'inventory' });
    check('order_inventory_source_is_persistable', 'inventory', inventoryOrder.toObject().productSource ?? null,
      'Actual Mongoose order schema serialization; no order write.');

    const reusable = await batch.findOne({ ownerKind: 'company', source: 'return' }).lean();
    const contenders = [0, 1].map(() => order({ productId: reusable.productId,
      productSource: 'inventory', inventoryBatchId: reusable._id }));
    const claims = await Promise.allSettled(contenders.map(doc => inventory.prepareOrderSource(doc)));
    check('one_returned_item_cannot_be_reserved_by_two_orders', 1,
      claims.filter(result => result.status === 'fulfilled').length, 'Concurrent atomic reservations on MongoDB.');
    const winner = contenders[claims.findIndex(result => result.status === 'fulfilled')];
    await inventory.commitOrderStock(winner);
    await inventory.commitOrderStock(winner);
    const afterIssue = await batch.findById(reusable._id).lean();
    check('retry_stock_dispatch_does_not_double_issue', { remaining: 0, transactions: 1 },
      { remaining: afterIssue.quantityRemaining, transactions: await tx.countDocuments({ orderId: String(winner._id) }) },
      'Two dispatch calls, one physical issue and one transaction.');
    const held = await batch.findOne({ ownerKind: 'dealer', source: 'return' }).lean();
    let ownershipBlocked = false;
    try { await inventory.prepareOrderSource(order({ productId: held.productId,
      inventoryBatchId: held._id, productSource: 'inventory' })); } catch { ownershipBlocked = true; }
    check('company_cannot_sell_dealer_custody_as_own_stock', true, ownershipBlocked, 'Actual inventory ownership validation.');

    const shipped = await orderModel.create(order({ financialModelVersion: 2, agentId: oid(),
      trackingNumber: undefined, orderStatus: 'Chưa có mã vận đơn', productSource: 'supplier' }));
    const shipments = new OrderShipmentService(orderModel, inventory, calc, { upsertForOrder: async()=>{} }, { emit(){} });
    const request = { requestKey:'audit-dispatch-01', trackingNumber:'LOCAL-ONLY-01', senderKind:'supplier',
      senderId:String(shipped.supplierId), shippingCost:20000, returnCostQuote:30000,
      dealerShippingCharge:20000, dealerReturnChargeQuote:30000, feePayeeKind:'supplier' };
    let shippedResult = await shipments.create(String(shipped._id),request,String(oid()));
    check('shipment_defaults_return_destination_to_sender',String(shipped.supplierId),shippedResult.shipments[0].returnHolderId,'Real shipment service and Mongoose save.');
    shippedResult = await shipments.create(String(shipped._id),request,String(oid()));
    check('shipment_request_retry_does_not_duplicate_fees', {attempts:1,dealerDebt:270000},
      {attempts:shippedResult.shipments.length,dealerDebt:shippedResult.dealerContractAmount},'Real persisted idempotency key.');
    shippedResult = await shipments.complete(String(shipped._id),String(shippedResult.shipments[0]._id),
      {status:'returned',returnCost:30000,dealerReturnCharge:30000,feesConfirmed:true});
    check('dealer_return_preserves_goods_margin_and_all_fees',{revenue:250000,cogs:120000,debt:300000,profit:130000},
      {revenue:shippedResult.recognizedRevenue,cogs:shippedResult.recognizedGoodsCost,debt:shippedResult.dealerContractAmount,profit:shippedResult.grossProfit},'Real shipment completion projection.');
    let premature=false;
    try { await shipments.create(String(shipped._id),{...request,requestKey:'audit-reship-premature',inventoryBatchId:String(held._id)},String(oid())); } catch {premature=true;}
    check('return_status_alone_does_not_allow_reship_before_receipt',true,premature,'A returned carrier status is not an inventory receipt.');
    // This fixture explicitly supplies the receipt boundary; RMA transaction coverage is stated above.
    await inventory.recordReturnFromRMA([{productId:String(shipped.productId),quantity:1,recoveryUnitCost:120000}],
      'Synthetic custody receipt',undefined,{orderId:String(shipped._id),receiptId:String(oid()),ownerKind:'dealer',
        ownerId:String(shipped.agentId),holderKind:'supplier',holderId:String(shipped.supplierId)});
    const ownReturn = await batch.findOne({originalOrderId:String(shipped._id)}).lean();
    await orderModel.updateOne({_id:shipped._id},{$set:{receivedReturnQuantity:1}});
    const retry={...request,requestKey:'audit-reship-02',trackingNumber:'LOCAL-ONLY-02',inventoryBatchId:String(ownReturn._id)};
    shippedResult=await shipments.create(String(shipped._id),retry,String(oid()));
    check('dealer_reship_uses_custody_without_new_goods_sale',{revenue:250000,cogs:120000,debt:320000,shipping:40000,returns:30000,stock:0},
      {revenue:shippedResult.recognizedRevenue,cogs:shippedResult.recognizedGoodsCost,debt:shippedResult.dealerContractAmount,
        shipping:shippedResult.shippingFee,returns:shippedResult.returnFee,stock:(await batch.findById(ownReturn._id)).quantityRemaining},
      'Real stock commit and shipment history; original goods are charged once.');

    const feeRequest={requestKey:'audit-fee-confirm-01',shippingCost:25000,returnCost:30000,
      dealerShippingCharge:25000,dealerReturnCharge:30000,evidence:'Synthetic carrier invoice'};
    const firstShipmentId=String(shippedResult.shipments[0]._id);
    shippedResult=await shipments.amendFees(String(shipped._id),firstShipmentId,feeRequest,String(oid()));
    shippedResult=await shipments.amendFees(String(shipped._id),firstShipmentId,feeRequest,String(oid()));
    check('fee_reconciliation_keeps_history_and_does_not_duplicate',{debt:325000,supplierDebt:195000,grossProfit:130000,revisions:1,priorCost:20000},
      {debt:shippedResult.dealerContractAmount,supplierDebt:shippedResult.supplierContractAmount,grossProfit:shippedResult.grossProfit,
        revisions:shippedResult.shipments[0].feeRevisions.length,priorCost:shippedResult.shipments[0].feeRevisions[0].before.shippingCost},
      'Actual persisted amendment of the first shipment after a second shipment; retry is idempotent.');

    const report = { database, generatedAt: new Date().toISOString(),
      scope: 'Synthetic local audit. No existing database, production API, application startup or deployment.',
      transactionTesting: 'Return-request transaction boundary is mocked; not a transaction/HTTP test.',
      total: results.length, passed: results.filter(r => r.passed).length,
      gaps: results.filter(r => !r.passed).length, results };
    const outDir = path.resolve(__dirname, '../../.local-ledger');
    fs.mkdirSync(outDir, { recursive: true });
    const output = path.join(outDir, `business-model-audit-${database}.json`);
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ ...report, output }, null, 2));
    process.exitCode = report.gaps ? 2 : 0;
  } finally { await conn.close(); }
}
main().catch(error => { console.error(`Audit probe failed: ${error.name}`); process.exitCode = 1; });
