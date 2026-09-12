// Run only against the isolated loopback rehearsal; never loads a project .env.
require('./local-ledger-guard.cjs');
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { randomUUID } = require('node:crypto');
const client = new MongoClient('mongodb://127.0.0.1:27027/erp_ledger_local_20260904');
const base = 'http://127.0.0.1:4300';
const sourceId = new ObjectId();
const tag = `tracking-check-${randomUUID()}`;
let db, token;
const times = [];
async function api(path, method = 'GET', payload, status = 200) {
  const start = performance.now();
  const response = await fetch(base + '/api/tracking-crm' + path, { method,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}) });
  const body = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${body.message || response.status}`);
  if (method === 'GET' && path.startsWith('?')) times.push(Math.round(performance.now() - start));
  return body;
}
async function main() {
  await client.connect(); db = client.db();
  const auth = await fetch(base + '/__local/login', { method: 'POST', headers: { Origin: base } });
  assert.equal(auth.status, 200); token = (await auth.json()).access_token;
  assert.ok(token, 'local login token missing');
  const now = new Date('2026-09-08T08:00:00Z');
  const visits = Array.from({ length: 260 }, (_, i) => ({ _id: new ObjectId(), sourceId,
    externalVisitId: `${tag}-${i}`, occurredAt: new Date(now.getTime() + i * 1000),
    landingHost: 'tracking-verification.example', landingPath: '/test', landingName: tag,
    ipAddress: i % 2 ? '203.0.113.11' : '203.0.113.12',
    ads: { provider: 'google', accountId: '990001', campaignId: '990002', adGroupId: '990003', clickId: `fake-${i}` },
  }));
  await db.collection('tracking_crm_visits').insertMany(visits);
  await db.collection('tracking_crm_events').insertMany(visits.flatMap((v, i) => Array.from({ length: 20 }, (_, j) => ({
    sourceId, externalVisitId: v.externalVisitId, externalEventId: `${tag}-${i}-${j}`,
    eventType: i === 0 && j === 1 ? 'phone' : j === 0 && i % 2 === 0 ? 'zalo' : 'page_view', occurredAt: i === 0 && j === 1 ? new Date('2026-09-09T08:00:00Z') : now,
  }))));
  const q = `?sourceId=${sourceId}`;
  const all = await api(q);
  assert.equal(all.total, 260); assert.equal(all.items.length, 25);
  assert.ok(all.items.every(v => !v.leadId && v.status === 'new' && !v.events));
  const page11 = await api(q + '&page=11'); assert.equal(page11.items.length, 10);
  assert.ok(!all.items.some(v => page11.items.some(w => w.visitId === v.visitId)));
  assert.equal((await api(q + '&ip=203.0.113.12')).total, 130);
  assert.equal((await api(q + '&conversion=zalo')).total, 130);
  assert.equal((await api(q + '&type=click')).total, 130);
  assert.equal((await api(q + '&from=2026-09-08&to=2026-09-08')).total, 260);
  assert.equal((await api(q + '&from=2026-09-09')).total, 0);
  assert.equal((await api(q + '&adGroup=wrong')).total, 0);
  assert.equal((await api(q + '&landing=tracking-verification.example')).total, 260);
  assert.equal((await api(q + '&landing=tracking-verification.*')).total, 0);
  await api(q + '&pageSize=10000', 'GET', undefined, 400);
  assert.equal((await api(q + '&timeField=conversion&from=2026-09-09&to=2026-09-09&conversion=phone')).total, 1);
  assert.equal((await api(q + '&timeField=conversion&from=2026-09-09&to=2026-09-09&conversion=zalo')).total, 0);
  const v = visits[0];
  const event = await db.collection('tracking_crm_events').findOne({ sourceId, externalVisitId: v.externalVisitId, eventType: 'zalo' });
  let lead = await api(`/visits/${v._id}/lead`, 'POST', { version: 0, status: 'noted', customerName: tag, phone: '0900000999', notes: 'Local verification', contactedAt: now.toISOString(), contactChannel: 'zalo', nextFollowUpAt: new Date(Date.now() - 60000).toISOString(), matchedEventId: String(event._id), matchConfidence: 'approximate', matchEvidence: 'Local matching by time' }, 201);
  assert.equal(lead.matchedEventId, String(event._id));
  assert.equal((await api(q + '&confidence=approximate&followUp=due&contactChannel=zalo')).total, 1);
  assert.equal((await api(q + '&timeField=contact&from=2026-09-08&to=2026-09-08')).total, 1);
  assert.ok(lead.leadId); assert.equal(lead.visit.ipAddress, '203.0.113.12');
  await api(`/visits/${v._id}/lead`, 'POST', { version: 0, status: 'noted' }, 409);
  await api(`/${lead._id}/promote`, 'POST', { version: lead.__v }, 400);
  lead = await api(`/${lead._id}`);
  const opts = await api('/options');
  const ad = opts.ads.find(a => a.accountId === '990001' && a.adGroupId === '990003');
  assert.ok(ad, 'Run tracking-crm-local-demo.cjs first');
  lead = await api(`/${lead._id}`, 'PATCH', { version: lead.__v, status: 'confirmed', customerName: tag, phone: '0900000999',
    agentId: '660000000000000000000003', supplierId: '660000000000000000000002', productId: '660000000000000000000005',
    adSelectionKey: ad.selectionKey, orderDate: new Date().toISOString(), quantity: 1, matchEvidence: 'Local fixture verified manually' });
  assert.equal(lead.status, 'confirmed'); assert.equal(lead.agentId, '660000000000000000000003');
  assert.equal((await api(q + '&status=confirmed')).total, 1, 'confirmed filter');
  assert.equal((await api(q + '&agentId=660000000000000000000003')).total, 1, 'agent filter');
  assert.equal((await api(q + '&status=new')).total, 259);
  const first = await api(`/${lead._id}/promote`, 'POST', { version: lead.__v }, 201);
  lead = await api(`/${lead._id}`);
  const repeat = await api(`/${lead._id}/promote`, 'POST', { version: lead.__v }, 201);
  assert.equal(first.orderId, repeat.orderId);
  // Simulate an order saved successfully while its CRM link write was interrupted.
  await db.collection('tracking_crm_order_links').deleteOne({ leadId: new ObjectId(lead._id) });
  lead = await api(`/${lead._id}`);
  const recovered = await api(`/${lead._id}/promote`, 'POST', { version: lead.__v }, 201);
  assert.equal(recovered.orderId, first.orderId, 'recover persisted order without duplication');
  const product = opts.products.find(p => p._id === '660000000000000000000005');
  assert.equal((await api(q + '&productId=' + product._id + '&categoryId=' + product.categoryId._id)).total, 1);

  assert.equal(await db.collection('ordertest2').countDocuments({ trackingLeadId: new ObjectId(lead._id) }), 1);
  const order = await db.collection('ordertest2').findOne({ _id: new ObjectId(first.orderId) });
  assert.equal(String(order.agentId), '660000000000000000000003');
  assert.equal(order.adGroupId, '990003'); assert.equal(order.agentAppliedPrice, 250000);
  assert.equal((await api(q + '&order=created')).total, 1);
  assert.equal((await api(q + '&order=pending')).total, 259);
  console.log(JSON.stringify({ verified: true, visits: 260, events: 5200, pagination: 'beyond 200 records',
    filters: 'IP, date VN, landing, group, conversion, CRM, dealer, order',
    promotion: 'only closed leads; correct quote; repeated request returns same order',
    listMs: { min: Math.min(...times), max: Math.max(...times) } }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  if (db) {
    const owned = await db.collection('tracking_crm_leads').find({ visitId: { $in: (await db.collection('tracking_crm_visits').find({ sourceId }).project({ _id: 1 }).toArray()).flatMap(v => [v._id, String(v._id)]) } }).project({ _id: 1 }).toArray();
    const ids = owned.map(l => l._id);
    await db.collection('tracking_crm_order_links').deleteMany({ leadId: { $in: ids } });
    await db.collection('ordertest2').deleteMany({ trackingLeadId: { $in: ids } });
    await db.collection('tracking_crm_leads').deleteMany({ _id: { $in: ids } });
    await db.collection('tracking_crm_events').deleteMany({ sourceId });
    await db.collection('tracking_crm_visits').deleteMany({ sourceId });
  }
  await client.close();
});

