/* Diagnostic audit, not an acceptance suite. Reports actual behavior against the
 * owner's rules; mismatches are findings, never evidence the implementation passes.
 * Uses only a NEW database on the already isolated local mongod, never .env.
 */
require('reflect-metadata');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { Logger } = require('@nestjs/common');
Logger.overrideLogger(['error']);
const { OrderCalculationService } = require('../dist/test-order2/services/order-calculation.service');
const { TestOrder2Service } = require('../dist/test-order2/test-order2.service');
const { OrderReportService } = require('../dist/test-order2/services/order-report.service');
const { BusinessLedgerService } = require('../dist/business-ledger/business-ledger.service');
const { LedgerAccountSchema, LedgerEntrySchema, LedgerOrderProfileSchema } = require('../dist/business-ledger/business-ledger.schema');
const { SupplierQuoteService } = require('../dist/supplier-quote/supplier-quote.service');
const { QuoteService } = require('../dist/quote/quote.service');
const { DeliveryStatusService } = require('../dist/delivery-status/delivery-status.service');
const { TestOrder2Schema } = require('../dist/test-order2/schemas/test-order2.schema');
const { ProductSchema } = require('../dist/product/schemas/product.schema');
const { QuoteSchema } = require('../dist/quote/schemas/quote.schema');
const { SupplierQuoteSchema } = require('../dist/supplier-quote/schemas/supplier-quote.schema');
const { ProductCategorySchema } = require('../dist/product-category/schemas/product-category.schema');
const { DeliveryStatusSchema } = require('../dist/delivery-status/schemas/delivery-status.schema');
const findings = [];
const record = (id, title, expected, actual, scope = 'real service + MongoDB') => {
  actual = actual ?? null;
  findings.push({ id, title, expected, actual, matches: JSON.stringify(actual) === JSON.stringify(expected), scope });
  console.log(`${id}: ${findings.at(-1).matches ? 'MATCH' : 'MISMATCH'}`);
};
let connection;
async function main() {
  console.log('Starting isolated local profit-chain audit');
  const dbName = `erp_profit_audit_${Date.now()}`;
  connection = await mongoose.createConnection(`mongodb://127.0.0.1:27027/${dbName}`, { serverSelectionTimeoutMS: 5000 }).asPromise();
  const Product = connection.model('Product', ProductSchema);
  const Order = connection.model('TestOrder2', TestOrder2Schema);
  const Quote = connection.model('Quote', QuoteSchema);
  const SupplierQuote = connection.model('SupplierQuote', SupplierQuoteSchema);
  connection.model('ProductCategory', ProductCategorySchema);
  connection.model('User', new mongoose.Schema({ fullName: String, role: String }, { collection: 'users' }));
  const Delivery = connection.model('DeliveryStatus', DeliveryStatusSchema);
  const LedgerEntry = connection.model('LedgerEntry', LedgerEntrySchema);
  const LedgerAccount = connection.model('LedgerAccount', LedgerAccountSchema);
  const LedgerOrderProfile = connection.model('LedgerOrderProfile', LedgerOrderProfileSchema);
  const delivery = new DeliveryStatusService(Delivery, Order);
  const cache = { get: async () => undefined, set: async () => undefined };
  const calc = new OrderCalculationService(Order, Product, Quote, SupplierQuote, delivery, cache);
  const ledger = new BusinessLedgerService(LedgerEntry, LedgerAccount, LedgerOrderProfile, Order);
  const report = new OrderReportService(Order, ledger);
  // External sync, unrelated payable creation and event dispatch are stubs. All
  // product/quote/order/profit persistence, lookups and recalculation are actual code.
  const orders = new TestOrder2Service(Order, Product, calc, {}, report,
    { upsertForOrder: async () => undefined }, { triggerSyncOnOrderChange: async () => undefined }, { emit: () => undefined });
  const supplierApi = new SupplierQuoteService(SupplierQuote);
  const dealerApi = new QuoteService(Quote, Product, {});
  const supplier = new mongoose.Types.ObjectId();
  const dealer = new mongoose.Types.ObjectId();
  const category = new mongoose.Types.ObjectId();
  await connection.collection('users').insertMany([{ _id: supplier, fullName: 'Audit supplier', role: 'external_supplier' }, { _id: dealer, fullName: 'Audit dealer', role: 'external_agent' }]);
  await connection.collection('productcategories').insertOne({ _id: category, name: 'Audit category' });
  const makeProduct = async (extra = {}) => {
    const id = new mongoose.Types.ObjectId();
    await Product.collection.insertOne({ _id: id, name: `Audit product ${id}`, categoryId: category, importPrice: 100000, shippingCost: 0, packagingCost: 0, isReturnable: true, ledgerReturnPolicy: 'recoverable', dealerReturnPolicy: 'no_goods_charge', ...extra });
    return id;
  };
  const makeSQ = (productId, extra = {}) => SupplierQuote.create({ productId, supplierId: supplier, price: 100000, currency: 'VND', approvalStatus: 'approved', effectiveAt: new Date('2026-01-01'), shippingFee: 0, returnFee: 0, ...extra });
  const input = (productId, extra = {}) => ({ productId, supplierId: supplier, orderDate: new Date('2026-08-01'), quantity: 1, orderStatus: 'Giao thành công', productionStatus: 'Đã trả kết quả', trackingNumber: 'AUDIT', codAmount: 300000, shippingFee: 0, returnFee: 0, ...extra });
  const quoteInput = (productId, extra = {}) => ({ productId: String(productId), agentId: String(dealer), product: 'Audit product', agentName: 'Audit dealer', unitPrice: 250000, status: 'Đã duyệt', isActive: true, validFrom: '2026-01-01', validUntil: '2026-12-31', ...extra });

  const p = await makeProduct();
  const approved = await makeSQ(p);
  const pending = await makeSQ(p, { price: 160000, approvalStatus: 'pending', effectiveAt: new Date('2027-01-01') });
  const snap = input(p);
  await calc.calculateSupplierQuote(snap);
  record('CONTROL-1', 'Backend picks approved supplier quote effective on order date', String(approved._id), String(snap.supplierQuoteId));
  await SupplierQuote.updateOne({ _id: approved._id }, { $set: { price: 120000 } });
  await calc.calculateSupplierQuote(snap);
  record('CONTROL-2', 'Existing applied supplier snapshot survives editing its source quote', 100000, snap.supplierQuote);
  const latest = await supplierApi.getLatest(String(p), String(supplier));
  record('F01a', 'UI latest endpoint selects future pending quote', 'approved effective quote', `${latest.approvalStatus}; ${new Date(latest.effectiveAt).toISOString().slice(0, 10)}; ${latest.price}`);
  const persisted = await Order.create(snap);
  const updated = await orders.update(String(persisted._id), { supplierAppliedPrice: latest.price });
  record('F01b', 'UI follow-up update overwrites applied price while keeping original quote ID', { price: 100000, quoteId: String(approved._id) }, { price: updated.supplierAppliedPrice, quoteId: String(updated.supplierQuoteId) }, 'actual TestOrder2Service.update + MongoDB; UI call sequence reproduced');

  const agentProduct = await makeProduct();
  await makeSQ(agentProduct);
  const aq = await dealerApi.create(quoteInput(agentProduct));
  const dealerOrder = input(agentProduct, { agentId: dealer, orderStatus: 'Đang giao' });
  await calc.calculateSupplierQuote(dealerOrder);
  await calc.calculateAgentQuote(dealerOrder);
  record('CONTROL-3', 'Approved dealer quote applies to matching product and dealer', 250000, dealerOrder.agentQuote);
  await Quote.updateOne({ _id: aq._id }, { $set: { unitPrice: 270000 } });
  await calc.calculateAgentQuote(dealerOrder);
  record('CONTROL-4', 'Existing dealer price snapshot survives editing source quote', 250000, dealerOrder.agentQuote);
  record('F02', 'Dealer production complete + tracking, still shipping: gross profit recognized', 150000, await calc.calculateGrossProfit(dealerOrder));

  const futureProduct = await makeProduct();
  const futureQuote = await dealerApi.create(quoteInput(futureProduct, { unitPrice: 999000, validFrom: '2027-01-01', validUntil: '2027-12-31' }));
  const futureOrder = input(futureProduct, { agentId: dealer });
  await calc.calculateAgentQuote(futureOrder);
  record('F03', 'No in-period dealer quote: future quote must not apply silently', null, futureOrder.agentQuoteId === String(futureQuote._id) ? futureOrder.agentQuote : null);

  const bulkProduct = await makeProduct();
  await dealerApi.create(quoteInput(bulkProduct, { applyToAllAgents: true }));
  const bulkOrder = input(bulkProduct, { agentId: dealer });
  await calc.calculateAgentQuote(bulkOrder);
  record('F14', 'Dealer quote created with apply-to-all must apply like an individually created quote', 250000, bulkOrder.agentQuote,
    'actual QuoteService.create applyToAllAgents + actual lookup; runtime reference schemas are Mixed and bulk agentId is ObjectId while lookup uses string');

  const returnOrder = { ...dealerOrder, orderStatus: 'Hàng hoàn', supplierIsReturnableSnapshot: true, shippingFee: 0, returnFee: 30000, dealerReturnPolicy: 'no_goods_charge' };
  returnOrder.agentCommissionAmount = await calc.calculateAgentCommission(returnOrder);
  record('F04', 'Recoverable return; dealer owes no goods price; company bears 30k return fee', -30000, await calc.calculateGrossProfit(returnOrder));
  const internal = new mongoose.Types.ObjectId();
  await connection.collection('users').insertOne({ _id: internal, fullName: 'Internal audit dealer', role: 'internal_agent' });
  record('F05', 'Explicit dealer sale price must not depend on internal/external login role', 150000, await calc.calculateGrossProfit({ ...dealerOrder, orderStatus: 'Giao thành công', agentId: internal, supplierQuote: 100000 }));

  const nonreturnable = await makeProduct({ isReturnable: false, ledgerReturnPolicy: 'production_committed' });
  await makeSQ(nonreturnable); // No supplier override: should inherit product policy.
  const policyOrder = input(nonreturnable);
  await calc.calculateSupplierQuote(policyOrder);
  record('F06', 'No supplier override: product nonreturnable policy is inherited', false, policyOrder.supplierIsReturnableSnapshot);

  const withFees = await makeProduct({ shippingCost: 20000, packagingCost: 10000 });
  const zeroQuote = await makeSQ(withFees, { shippingFee: 0, returnFee: 0 });
  const zeroFee = input(withFees);
  await calc.calculateSupplierQuote(zeroFee);
  await calc.calculateShippingAndReturnFees(zeroFee);
  record('F07', 'Explicit zero quote fees stay zero rather than being replaced by product fees', { shipping: 0, return: 0 }, { shipping: zeroFee.shippingFee, return: zeroFee.returnFee });

  const fallbackProduct = await makeProduct({ shippingCost: 20000, packagingCost: 0 });
  const fallback = input(fallbackProduct);
  await calc.calculateSupplierQuote(fallback);
  await calc.calculateShippingAndReturnFees(fallback);
  record('F08', 'Product fallback: 300k sale - 100k goods - 20k shipping', 180000, await calc.calculateGrossProfit(fallback));
  record('F09', 'Delivered order must not pay a quoted return fee', 180000, await calc.calculateGrossProfit({ ...input(p), supplierQuote: 100000, shippingFee: 20000, returnFee: 30000 }));

  const noQuoteBefore = fallback.supplierQuote;
  await Product.updateOne({ _id: fallbackProduct }, { $set: { importPrice: 150000 } });
  await calc.calculateSupplierQuote(fallback);
  record('F10', 'Fallback cost should not silently change on an existing order when product price changes', noQuoteBefore, fallback.supplierQuote);
  const usdProduct = await makeProduct();
  await makeSQ(usdProduct, { currency: 'USD', price: 10 });
  const usdOrder = input(usdProduct);
  await calc.calculateSupplierQuote(usdOrder);
  record('F11', 'Non-VND supplier quote requires explicit currency handling, not a VND cost of 10', null, usdOrder.supplierQuote ?? null);

  const costs = await Order.create({ ...input(p), supplierQuoteId: approved._id, supplierAppliedPrice: 100000, supplierQuote: 100000, grossProfit: 200000, advertisingCost: 10000, laborCostAllocation: 10000, otherCostAllocation: 5000, netProfit: 175000 });
  const editedCosts = await orders.update(String(costs._id), { customerName: 'Harmless name correction' });
  record('F12', 'Editing only customer name overwrites already allocated costs with estimates', { ads: 10000, labor: 10000, other: 5000, net: 175000 }, { ads: editedCosts.advertisingCost, labor: editedCosts.laborCostAllocation, other: editedCosts.otherCostAllocation, net: editedCosts.netProfit }, 'actual TestOrder2Service.update + MongoDB; existing allocations seeded explicitly');

  const rp = await makeProduct();
  const retail = input(rp, { orderDate: new Date('2026-07-15T05:00:00Z'), supplierQuote: 100000, supplierAppliedPrice: 100000, codAmount: 200000, depositAmount: 100000 });
  retail.grossProfit = await calc.calculateGrossProfit(retail);
  retail.netProfit = retail.grossProfit;
  await Order.create(retail);
  const productReport = await report.getProductProfitReport({ date: '2026-07-15' });
  const row = productReport.products.find(r => r.productId === String(rp));
  record('F13', 'Report revenue and order profit must use the same revenue basis (not assuming deposits are sales)', row.totalRevenue - row.totalProductCost, retail.grossProfit, 'reconciliation inconsistency: report adds deposit, order calculation uses COD only');
  record('CONTROL-5', 'Non-delivered retail order does not recognize gross profit', 0, await calc.calculateGrossProfit({ ...input(p), orderStatus: 'Đang giao', supplierQuote: 100000 }));

  const result = {
    auditedAt: new Date().toISOString(), database: dbName,
    scope: 'Actual compiled ERP services and Mongoose schemas; fresh loopback-only MongoDB. External integrations/event subscribers stubbed. No existing demo or production data changed. Diagnostic expectations, not a passing acceptance test.',
    matchingCases: findings.filter(f => f.matches).length,
    mismatches: findings.filter(f => !f.matches).length, findings,
  };
  const file = path.resolve(__dirname, '../../docs/finance/order-profit-chain-audit-results.json');
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => { if (connection) await connection.close(); });
