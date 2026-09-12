// Isolated MongoDB verification. Uses only the local replica set and synthetic source rows.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { WindsorAdsCatalogService } = require('../dist/provider-connections/windsor-ads-catalog.service');
const { AdGroupService } = require('../dist/ad-group/ad-group.service');
const { AdAccountService } = require('../dist/ad-account/ad-account.service');
const { UpdateAdGroupDto } = require('../dist/ad-group/dto/update-ad-group.dto');
const { CreateAdGroupDto } = require('../dist/ad-group/dto/create-ad-group.dto');
const schemas = {
  AdAccount: require('../dist/ad-account/schemas/ad-account.schema').AdAccountSchema,
  AdGroup: require('../dist/ad-group/schemas/ad-group.schema').AdGroupSchema,
  ProviderConnection: require('../dist/provider-connections/provider-connection.schema').ProviderConnectionSchema,
  WindsorAdsResource: require('../dist/provider-connections/schemas/windsor-ads-resource.schema').WindsorAdsResourceSchema,
  WindsorAdsSyncRun: require('../dist/provider-connections/schemas/windsor-ads-sync-run.schema').WindsorAdsSyncRunSchema,
};

async function main() {
  const dbName = `erp_windsor_catalog_verify_${Date.now()}`;
  const db = await mongoose.createConnection(`mongodb://127.0.0.1:27027/${dbName}?replicaSet=erp-local-ledger`,
    { serverSelectionTimeoutMS: 2000 }).asPromise();
  let verified = false;
  try {
    assert.equal((await db.db.admin().command({ hello: 1 })).setName, 'erp-local-ledger');
    assert.equal(db.host, '127.0.0.1'); assert.equal(db.name, dbName); verified = true;
    const models = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, db.model(name, schema)]));
    const { AdAccount: accounts, AdGroup: groups, ProviderConnection: connections,
      WindsorAdsResource: resources, WindsorAdsSyncRun: runs } = models;
    const products = db.model('Product', new mongoose.Schema({ name: String, categoryId: mongoose.Schema.Types.ObjectId }));
    const users = db.model('User', new mongoose.Schema({ fullName: String, role: String }));
    const categories = db.model('ProductCategory', new mongoose.Schema({ name: String }));
    db.model('Fanpage', new mongoose.Schema({ name: String }));
    await Promise.all(Object.values(models).map(model => model.init()));
    const connectionId = new mongoose.Types.ObjectId();
    const ids = ['1234567890', '2345678901', '3456789012'];
    await connections.collection.insertOne({ _id: connectionId, kind: 'windsor-google', scope: 'google_ads',
      name: 'LOCAL SYNTHETIC FIXTURE', state: 'configured', revision: 1, checkedRevision: 1, accountIds: ids,
      check: { readAccessConfirmed: true, accounts: ids.map(id => ({ id, name: `Fixture ${id}` })) } });
    const catalog = new WindsorAdsCatalogService(connections, resources, runs, accounts, groups);
    const id = String(connectionId);
    let sequence = 0;
    async function source(status = 'success', syncErrors = [], accountId = ids[0], groupId = '2001') {
      const runId = `fixture-${++sequence}`;
      const at = new Date(Date.UTC(2026, 8, 1, sequence));
      await runs.create({ runId, connectionId, connector: 'google_ads', status, startedAt: at,
        dateFrom: '2026-09-01', dateTo: '2026-09-01', accountIds: [accountId], syncErrors });
      for (const [resourceType, providerId, extra] of [
        ['account', accountId, { name: `Account ${sequence}`, currency: 'VND', timezone: 'Asia/Ho_Chi_Minh' }],
        ['campaign', '1001', { name: 'Search fixture', campaignBudgetId: '9001' }],
        ['ad_group', groupId, { campaignId: '1001', name: `Group ${sequence}`, status: sequence === 1 ? 'ENABLED' : 'PAUSED' }],
      ]) await resources.updateOne({ connectionId, accountId, resourceType, providerId }, {
        $set: { ...extra, provider: 'google', connector: 'google_ads', lastSyncRunId: runId, lastSeenAt: at },
      }, { upsert: true, runValidators: true });
    }
    await source();
    let result = await catalog.reconcile(id);
    assert.equal(result.status, 'success', JSON.stringify(result));
    assert.equal(result.accounts, 3); assert.equal(result.groups, 1);
    const account = await accounts.findOne({ accountId: ids[0] });
    const group = await groups.findOne({ adGroupId: '2001' });
    assert.equal(String(group.adAccountId), String(account._id));
    assert.equal(group.sourceSystem, 'windsor');
    assert.equal(group.campaignBudgetId, '9001');
    assert.equal(group.fanpageId, undefined); assert.equal(group.agentId, undefined);
    assert.equal(group.autoControlEnabled, false); assert.equal(group.enableWebhook, false);
    assert.equal(account.lastSyncStatus, undefined); // Windsor read does not validate direct provider credentials.
    await group.validate();
    assert.ok(new groups({ name: 'Manual', adGroupId: 'manual', platform: 'facebook', adAccountId: account._id })
      .validateSync().errors.fanpageId);
    console.log('PASS: source rows create linked account/group; zero-spend checked accounts included; manual validation and live defaults preserved.');

    const category = await categories.create({ name: 'Fixture category' });
    const product = await products.create({ name: 'Fixture product', categoryId: category._id });
    const operator = await users.create({ fullName: 'Fixture operator', role: 'manager' });
    const service = new AdGroupService(groups, { deleteMany: () => { throw new Error('Costs must remain'); } }, products);
    const accountService = new AdAccountService(accounts, { validateTimezone: () => { throw new Error('No provider calls for assignment'); } });
    const mapping = { selectedProducts: [String(product._id)], assignedEmployeeId: String(operator._id) };
    assert.equal((await validate(plainToInstance(UpdateAdGroupDto, mapping), { whitelist: true, forbidNonWhitelisted: true })).length, 0);
    assert.ok((await validate(plainToInstance(CreateAdGroupDto, { name: 'Manual', adGroupId: '88', platform: 'google', adAccountId: String(account._id) })))
      .some(error => error.property === 'fanpageId'));
    await service.update(String(group._id), mapping);
    await accountService.update(String(account._id), { adsManagerUserId: String(operator._id) });
    await groups.updateOne({ _id: group._id }, { $set: { notes: 'Keep notes', dailyBudget: 700, isActive: false } });
    await source(); await catalog.reconcile(id); await catalog.reconcile(id);
    let refreshed = await groups.findById(group._id).lean();
    assert.equal(await groups.countDocuments(), 1); assert.equal(await accounts.countDocuments(), 3);
    assert.equal(refreshed.name, 'Group 2'); assert.equal(refreshed.remoteStatus, 'PAUSED');
    assert.equal(refreshed.notes, 'Keep notes'); assert.equal(refreshed.dailyBudget, 700); assert.equal(refreshed.isActive, false);
    assert.equal(String(refreshed.selectedProducts[0]), String(product._id));
    assert.equal(String(refreshed.assignedEmployeeId), String(operator._id));
    assert.equal(String((await accounts.findById(account._id)).adsManagerUserId), String(operator._id));
    console.log('PASS: assign through real ERP services, resync changed name/status twice, preserve product/operator/budget/notes and IDs.');

    await service.update(String(group._id), { selectedProducts: [], assignedEmployeeId: null });
    await accountService.update(String(account._id), { adsManagerUserId: null });
    await catalog.reconcile(id);
    refreshed = await groups.findById(group._id).lean();
    assert.deepEqual(refreshed.selectedProducts, []); assert.equal(refreshed.productCategoryId, null);
    assert.equal(refreshed.assignedEmployeeId, null); assert.equal((await accounts.findById(account._id)).adsManagerUserId, null);
    await assert.rejects(service.update(String(group._id), { adGroupId: 'changed' }));
    await assert.rejects(accountService.update(String(account._id), { accountId: '9999999999' }));
    await assert.rejects(service.remove(String(group._id)));
    await assert.rejects(accountService.remove(String(account._id)));
    console.log('PASS: clear assignments including derived category; protect source identities and financial history from deletion.');

    await source('partial', [{ accountId: ids[0], date: '2026-09-01', code: 'STORAGE_FAILED' }]);
    result = await catalog.reconcile(id);
    assert.equal(result.status, 'partial'); assert.equal((await groups.findById(group._id)).name, 'Group 2');
    await source('failed', [{ code: 'PROVIDER_TIMEOUT' }]);
    await catalog.reconcile(id); assert.equal((await groups.findById(group._id)).name, 'Group 2');
    await source(); await catalog.reconcile(id); assert.equal((await groups.findById(group._id)).name, 'Group 5');
    console.log('PASS: failed/partial writes cannot overwrite good catalog metadata; later successful reads repair it.');

    await source('success', [], ids[1], '2001');
    result = await catalog.reconcile(id);
    assert.ok(result.conflicts.some(item => item.code === 'AD_GROUP_ID_CONFLICT'));
    assert.equal(String((await groups.findById(group._id)).adAccountId), String(account._id));
    await accounts.updateOne({ accountId: ids[2] }, { $set: { accountType: 'facebook' } });
    result = await catalog.reconcile(id);
    assert.ok(result.conflicts.some(item => item.code === 'ACCOUNT_ID_CONFLICT'));
    console.log('PASS: same group ID in another account and cross-platform account IDs produce conflicts, never relink existing records.');

    await resources.deleteMany({ accountId: ids[1] });
    await source('success', [], '9999999999', '9999');
    await catalog.reconcile(id); assert.equal(await groups.countDocuments({ adGroupId: '9999' }), 0);
    await resources.deleteMany({ accountId: ids[0] });
    await catalog.reconcile(id); assert.equal(await groups.countDocuments({ _id: group._id }), 1);
    await accounts.updateOne({ _id: account._id }, { $set: { accountId: '123-456-7890' } });
    await catalog.reconcile(id); assert.equal(await accounts.countDocuments(), 3);
    assert.equal((await accounts.findById(account._id)).accountId, '123-456-7890');
    await connections.updateOne({ _id: connectionId }, { $set: { state: 'disabled' } });
    await assert.rejects(catalog.reconcile(id));
    await connections.updateOne({ _id: connectionId }, { $set: { state: 'configured', revision: 2 } });
    await assert.rejects(catalog.reconcile(id));
    console.log('PASS: selected-account boundary, missing rows retained, legacy dashed IDs reused, disabled/unverified configuration rejected.');
  } finally {
    if (verified) await db.dropDatabase();
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
