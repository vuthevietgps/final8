// Run only with --require ./scripts/local-ledger-guard.cjs. Fixtures never target production.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Types } = mongoose;
const schemas = require('../dist/tracking-crm/schemas/tracking-crm.schema');
const id = number => new Types.ObjectId(`67000000000000000000${String(number).padStart(4, '0')}`);
const director = new Types.ObjectId('660000000000000000000001');
const supplier = new Types.ObjectId('660000000000000000000002');
const agent = new Types.ObjectId('660000000000000000000003');
const product = new Types.ObjectId('660000000000000000000005');
async function main() {
  assert.equal(process.env.ERP_LOCAL_SANDBOX, 'true');
  assert.equal(process.env.MONGODB_URI, 'mongodb://127.0.0.1:27027/erp_ledger_local_20260904');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const now = new Date(), orderDate = new Date(now.toISOString().slice(0, 10));
  const before = new Date(now.getTime() - 86400000 * 30), after = new Date(now.getTime() + 86400000 * 365);
  await db.collection('users').updateOne({ _id: id(2) }, { $setOnInsert: { fullName: 'Đại lý Miền Nam — mẫu CRM', email: 'crm-agent@demo.local', role: 'external_agent', isActive: true } }, { upsert: true });
  await db.collection('productcategories').updateOne({ _id: new Types.ObjectId('660000000000000000000004') }, { $set: { name: 'Phù hiệu xe' } });
  for (const [quoteId, agentId, price] of [[id(10), agent, 250000], [id(11), id(2), 280000]]) {
    await db.collection('quotes').updateOne({ _id: quoteId }, { $setOnInsert: { productId: product, agentId, product: 'Sản phẩm thử nghiệm', agentName: 'Đại lý mẫu', unitPrice: price, status: 'Đã duyệt', isActive: true, validFrom: before, validUntil: after, createdAt: now } }, { upsert: true });
  }
  await db.collection('supplierquotes').updateOne({ _id: id(12) }, { $setOnInsert: { supplierId: supplier, productId: product, price: 180000, currency: 'VND', approvalStatus: 'approved', effectiveAt: before, createdAt: now, shippingFee: 15000, returnFee: 10000 } }, { upsert: true });
  const connectionId = id(20), run = 'crm-local-fixture';
  await db.collection('provider_connections').updateOne({ _id: connectionId }, { $set: { kind: 'windsor-google', state: 'configured', lastReadSyncStatus: 'success', lastReadSyncAt: now, lastReadSyncRunId: run, name: 'Nguồn ads giả lập CRM' } }, { upsert: true });
  for (const [resourceType, providerId, name] of [['account', '990001', 'Tài khoản Ads mẫu'], ['campaign', '990002', 'Search · Phù hiệu xe'], ['ad_group', '990003', 'Phù hiệu xe hợp đồng'], ['ad_group', '990004', 'Phù hiệu xe tải']]) {
    await db.collection('windsor_ads_resources').updateOne({ connectionId, resourceType, providerId }, { $set: { provider: 'google', connector: 'google_ads', accountId: '990001', campaignId: '990002', name, status: 'PAUSED', lastSeenAt: now, lastSyncRunId: run } }, { upsert: true });
  }
  const models = {};
  for (const name of ['TrackingSource', 'TrackingVisit', 'TrackingEvent', 'TrackingLead', 'TrackingOrderLink']) {
    models[name] = mongoose.model(name, schemas[name + 'Schema']); await models[name].init();
  }
  await models.TrackingSource.updateOne({ _id: id(1) }, { $setOnInsert: { sourceKey: 'crm-demo-local', name: 'Dữ liệu mẫu trên máy · Ladifinal', enabled: false, createdBy: director } }, { upsert: true });
  for (let i = 0; i < 3; i++) {
    const visitId = id(30 + i), leadId = id(40 + i), selectedAgent = i === 1 ? id(2) : agent;
    const groupId = i === 2 ? '990004' : '990003';
    const at = new Date(now.getTime() - (i + 1) * 3600000);
    await models.TrackingVisit.updateOne({ _id: visitId }, { $setOnInsert: { sourceId: id(1), externalVisitId: `demo-visit-${i}`, occurredAt: at, landingHost: 'landing-mau.example', landingPath: '/phu-hieu-xe', landingName: 'Landing phù hiệu xe · mẫu', ads: { provider: 'google', clickIdType: 'gclid', clickId: `demo-click-${i}`, accountId: '990001', campaignId: '990002', adGroupId: groupId, keyword: 'làm phù hiệu xe' } } }, { upsert: true });
    const demoEventType = i === 0 ? 'zalo' : i === 1 ? 'phone' : 'page_view';
    await models.TrackingEvent.updateOne({ sourceId: id(1), externalEventId: `demo-event-${i}` }, { $set: { externalVisitId: `demo-visit-${i}`, eventType: demoEventType, occurredAt: new Date(at.getTime() + 45000) } }, { upsert: true });
    await models.TrackingLead.updateOne({ _id: leadId }, { $setOnInsert: {
      visitId, customerName: ['Khách mẫu · Anh Minh', 'Khách mẫu · Chị Lan', 'Khách mới · Chờ đối chiếu'][i], recipientName: 'Người nhận mẫu', phone: '0900000000', shippingAddress: 'Địa chỉ thử nghiệm',
      status: i === 2 ? 'noted' : 'confirmed', agentId: i === 2 ? undefined : selectedAgent,
      agentNameSnapshot: i === 2 ? undefined : i === 1 ? 'Đại lý Miền Nam — mẫu CRM' : 'Đại lý thử nghiệm', agentRoleSnapshot: i === 2 ? undefined : 'external_agent',
      adSelectionKey: `google:990001:990002:${groupId}`, adsProvider: 'google', adAccountProviderId: '990001', adCampaignId: '990002', adGroupId: groupId, adGroupNameSnapshot: i === 2 ? 'Phù hiệu xe tải' : 'Phù hiệu xe hợp đồng',
      productId: product, supplierId: supplier, quantity: 1, orderDate, saleTotal: 350000, deposit: 50000, codAmount: 300000,
      notes: 'Dữ liệu mẫu để kiểm tra nhóm quảng cáo và báo giá theo đại lý.', matchMethod: i === 2 ? 'unverified' : 'manual',
      matchEvidence: i === 2 ? undefined : 'Đối chiếu giả lập theo lượt liên hệ và tài khoản đại lý.', matchedBy: i === 2 ? undefined : director, matchedAt: i === 2 ? undefined : now, createdBy: director, updatedBy: director,
    } }, { upsert: true });
  }
  // Make the third fixture a click-only row so both table states are visible.
  await db.collection('tracking_crm_events').updateOne(
    { sourceId: id(1), externalEventId: 'demo-event-2' },
    { $set: { eventType: 'page_view' } },
  );
  // IP-bearing visits without CRM profiles: opening these must never create orders.
  for (let i = 0; i < 4; i++) {
    const visitId = id(60 + i);
    await models.TrackingVisit.updateOne({ _id: visitId }, { $setOnInsert: {
      sourceId: id(1), externalVisitId: `demo-ip-visit-${i}`, occurredAt: new Date(now.getTime() - i * 60000),
      landingHost: 'landing-mau.example', landingPath: '/phu-hieu-xe', landingName: 'Landing IP mẫu',
      ipAddress: i < 2 ? '203.0.113.10' : '198.51.100.20',
      ads: { provider: 'google', clickIdType: 'gclid', clickId: `demo-ip-click-${i}`, accountId: '990001', campaignId: '990002', adGroupId: '990004' },
    } }, { upsert: true });
    await models.TrackingEvent.updateOne({ sourceId: id(1), externalEventId: `demo-ip-event-${i}` }, { $setOnInsert: {
      externalVisitId: `demo-ip-visit-${i}`, eventType: i === 0 ? 'zalo' : i === 1 ? 'phone' : 'page_view', occurredAt: now,
    } }, { upsert: true });
  }
  // Real local HTTP checks; token stays in memory and is never logged.
  const authResponse = await fetch('http://127.0.0.1:4300/__local/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:4300' } });
  assert.equal(authResponse.status, 200); const auth = await authResponse.json();
  async function api(route, method = 'GET', body, expected = 200) {
    const response = await fetch('http://127.0.0.1:3001/api' + route, { method, headers: { Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); assert.equal(response.status, expected, `${route}: ${response.status} ${result.message || ''}`); return result;
  }
  const anonymous = await fetch('http://127.0.0.1:3001/api/tracking-crm'); assert.equal(anonymous.status, 401);
  const rows = await api('/tracking-crm'); assert.ok(rows.total >= 3);
  const first = await api(`/tracking-crm/${id(40)}/preview`), second = await api(`/tracking-crm/${id(41)}/preview`);
  assert.equal(first.agentUnitPrice, 250000); assert.equal(second.agentUnitPrice, 280000);
  assert.equal(first.supplierUnitPrice, 180000); assert.equal(first.goodsMargin, 70000);
  const pending = await api(`/tracking-crm/${id(42)}/preview`); assert.equal(pending.ready, false);
  let order = await db.collection('ordertest2').findOne({ serviceDetails: 'TRACKING_CRM_LOCAL_ORDER' });
  const existingLink = await models.TrackingOrderLink.findOne({ leadId: id(40) }).lean();
  if (existingLink) order = await db.collection('ordertest2').findOne({ _id: existingLink.orderId });
  if (!order) order = await api('/test-order2', 'POST', { customerName: 'Đơn mẫu · Anh Minh', agentId: String(agent), supplierId: String(supplier), productId: String(product), quantity: 1, customerAcquisitionSource: 'ads', adsProvider: 'google', adAccountProviderId: '990001', adCampaignId: '990002', adGroupId: '990003', orderDate: orderDate.toISOString(), retailSaleAmount: 350000, depositAmount: 50000, codAmount: 300000, serviceDetails: 'TRACKING_CRM_LOCAL_ORDER' }, 201);
  let detail = await api(`/tracking-crm/${id(40)}`);
  await api(`/tracking-crm/${id(40)}/order-link`, 'POST', { orderId: String(order._id), version: detail.__v }, 201);
  detail = await api(`/tracking-crm/${id(40)}`);
  await api(`/tracking-crm/${id(40)}/sync-order`, 'POST', { version: detail.__v }, 201);
  const synced = await db.collection('ordertest2').findOne({ _id: new Types.ObjectId(order._id) });
  assert.equal(synced.agentAppliedPrice, 250000); assert.equal(synced.supplierAppliedPrice, 180000);
  assert.equal(synced.customerName, detail.customerName); assert.equal(synced.retailSaleAmount, 350000);
  const other = await api(`/tracking-crm/${id(41)}`);
  await api(`/tracking-crm/${id(41)}/order-link`, 'POST', { orderId: String(order._id), version: other.__v }, 400);
  console.log('TRACKING_CRM_LOCAL_VERIFIED: 3 sample leads; dealer-specific quotes; anonymous access blocked; order link/sync passed; mismatched dealer blocked.');
  await mongoose.disconnect();
}
main().catch(error => { console.error(error.message); process.exitCode = 1; mongoose.disconnect(); });
