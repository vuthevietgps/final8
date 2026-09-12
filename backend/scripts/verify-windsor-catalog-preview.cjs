// Reuses only the explicitly named synthetic CRM fixture in the existing loopback demo.
// Leaves its imported catalog visible for UI testing; restores product/operator assignments after checks.
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const fs = require('node:fs');
const path = require('node:path');
const ORIGIN = 'http://127.0.0.1:4301';
const CONNECTION = '670000000000000000000020';
async function main() {
  const client = new MongoClient('mongodb://127.0.0.1:27027/erp_ledger_local_20260904');
  await client.connect();
  const checks = [];
  try {
    const db = client.db();
    assert.equal(db.databaseName, 'erp_ledger_local_20260904');
    assert.equal((await db.admin().command({ hello: 1 })).setName, 'erp-local-ledger');
    const fixture = await db.collection('provider_connections').findOne({ _id: new ObjectId(CONNECTION) });
    assert.equal(fixture?.name, 'Nguồn ads giả lập CRM');
    assert.equal(fixture?.kind, 'windsor-google');
    const resources = await db.collection('windsor_ads_resources').find({ connectionId: fixture._id }).toArray();
    assert.equal(resources.length, 4);
    assert.ok(resources.every(row => row.lastSyncRunId === 'crm-local-fixture' && row.accountId === '990001'));
    // Complete the synthetic fixture metadata, never fabricate a real provider check or an API key.
    await db.collection('provider_connections').updateOne({ _id: fixture._id, name: fixture.name }, { $set: {
      revision: 1, checkedRevision: 1, accountIds: ['990001'],
      check: { status: 'success', code: 'LOCAL_FIXTURE_ONLY', readAccessConfirmed: true,
        accounts: [{ id: '990001', name: 'Tài khoản Ads mẫu' }] },
    } });
    await db.collection('windsor_ads_sync_runs').updateOne({ runId: 'crm-local-fixture', connectionId: fixture._id }, {
      $setOnInsert: { connector: 'google_ads', status: 'success', startedAt: new Date(), completedAt: new Date(),
        dateFrom: '2026-09-08', dateTo: '2026-09-08', accountIds: ['990001'], syncErrors: [], counts: {}, includeInactive: true },
    }, { upsert: true });
    const login = await fetch(`${ORIGIN}/__local/login`, { method: 'POST', headers: { Origin: ORIGIN }, signal: AbortSignal.timeout(10000) });
    assert.equal(login.status, 200);
    const auth = await login.json();
    async function request(route, method = 'GET', body, expected = 200, authenticated = true) {
      const response = await fetch(`${ORIGIN}/api${route}`, { method,
        headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${auth.access_token}` } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, expected, `${method} ${route}`);
      return response.json();
    }
    const syncRoute = `/provider-connections/${CONNECTION}/ads-catalog-sync`;
    await request(syncRoute, 'POST', {}, 401, false);
    const imported = await request(syncRoute, 'POST', {}, 201);
    assert.deepEqual({ status: imported.status, accounts: imported.accounts, groups: imported.groups },
      { status: 'success', accounts: 1, groups: 2 });
    checks.push('Authenticated cached-catalog endpoint imports 1 fixture account and 2 groups; anonymous access rejected.');
    const accounts = await request('/ad-accounts');
    const groups = await request('/ad-groups');
    const account = accounts.find(row => row.accountId === '990001');
    const group = groups.find(row => row.adGroupId === '990004');
    assert.equal(group.adAccountId._id, account._id);
    const products = (await request('/ad-groups/products')).data;
    const operators = await request('/users/ads-operators');
    assert.ok(products.length && operators.length);
    const oldProducts = (group.selectedProducts || []).map(row => typeof row === 'string' ? row : row._id);
    const oldOperator = typeof group.assignedEmployeeId === 'string' ? group.assignedEmployeeId : group.assignedEmployeeId?._id || null;
    const oldManager = typeof account.adsManagerUserId === 'string' ? account.adsManagerUserId : account.adsManagerUserId?._id || null;
    try {
      await request(`/ad-groups/${group._id}`, 'PATCH', { selectedProducts: [products[0]._id], assignedEmployeeId: operators[0]._id });
      await request(`/ad-accounts/${account._id}`, 'PATCH', { adsManagerUserId: operators[0]._id });
      await request(syncRoute, 'POST', {}, 201);
      const updated = await request(`/ad-groups/${group._id}`);
      assert.equal(updated.selectedProducts[0]._id, products[0]._id);
      assert.equal(updated.assignedEmployeeId._id, operators[0]._id);
      assert.equal((await request(`/ad-accounts/${account._id}`)).adsManagerUserId._id, operators[0]._id);
      assert.equal((await request('/ad-groups')).filter(row => row.adGroupId === '990004').length, 1);
      checks.push('Actual HTTP PATCH accepts only product/operator without Fanpage/dealer; resync preserves both assignments.');
      await request(`/ad-groups/${group._id}`, 'PATCH', { selectedProducts: [], assignedEmployeeId: null });
      const cleared = await request(`/ad-groups/${group._id}`);
      assert.equal(cleared.selectedProducts.length, 0); assert.equal(cleared.assignedEmployeeId, null);
      await request(`/ad-groups/${group._id}`, 'DELETE', undefined, 400);
      await request(`/ad-accounts/${account._id}`, 'DELETE', undefined, 400);
      checks.push('Actual HTTP clears assignments and rejects deletion of Windsor catalog entries.');
    } finally {
      await request(`/ad-groups/${group._id}`, 'PATCH', { selectedProducts: oldProducts, assignedEmployeeId: oldOperator });
      await request(`/ad-accounts/${account._id}`, 'PATCH', { adsManagerUserId: oldManager });
    }
    for (const route of ['/ad-accounts', '/ad-groups', '/provider-connections']) {
      assert.equal((await fetch(ORIGIN + route)).status, 200);
    }
    checks.push('Three frontend routes serve successfully from the rebuilt preview. Visual automation is not covered.');
    const report = { testedAt: new Date().toISOString(), passed: checks.length, checks, fixtureOnly: true };
    fs.writeFileSync(path.resolve(__dirname, '../../.codex-logs/windsor-catalog-preview.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await client.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
