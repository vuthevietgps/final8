// Diagnostic reproduction of CURRENT behavior; passing does not mean defects are fixed.
// Run from backend: node ../reports/ads-cost-sync-audit-20260905.cjs
// No application bootstrap, credentials, database connections or network calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../backend');
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const axios = {};
const silent = { log() {}, warn() {}, error() {}, debug() {} };
const noopDecorator = () => () => {};
const fakeDate = { value: Date };
function load(relative) {
  const filename = path.join(root, 'src', relative);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true, emitDecoratorMetadata: false, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const requireMock = name => {
    if (name === 'axios') return axios;
    if (name === '@nestjs/common') return { Injectable: noopDecorator, Logger: class { log() {} warn() {} error() {} } };
    if (name === '@nestjs/mongoose') return { InjectModel: noopDecorator };
    if (name === '@nestjs/schedule') return { Cron: noopDecorator };
    if (name.endsWith('business-day')) return { previousBusinessDay: () => '2026-09-04' };
    if (name.endsWith('ads-api-version')) return { getMetaGraphApiVersion: () => 'v25.0' };
    if (name.includes('/schemas/')) return new Proxy({}, { get: (_, key) => ({ name: String(key) }) });
    throw new Error(`Unexpected dependency (network and application loading blocked): ${name}`);
  };
  const context = { module, exports: module.exports, require: requireMock, process: { env: {} }, Date: fakeDate.value, console };
  vm.runInNewContext(js, context, { filename });
  return module.exports;
}
(async () => {
  const { AdvertisingCostTiktokSyncService: TikTok } = load('advertising-cost/advertising-cost.tiktok-sync.service.ts');
  const { AdvertisingCostGoogleSyncService: Google } = load('advertising-cost/advertising-cost.google-sync.service.ts');
  const { DataCollectionService } = load('finance/data-collection.service.ts');
  let writes = [];
  const cost = { updateOne: async (...args) => writes.push(args) };
  const tk = new TikTok(cost, {}, {}, {}, {}, {});
  tk.logger = silent;
  let request;
  axios.post = async (url, body) => {
    request = { url, body };
    return { data: { code: 0, data: { list: [{ dimensions: { adgroup_id: '123', stat_time_day: '2026-09-04' },
      metrics: { spend: '150000', clicks: '30', impressions: '1000' } }], page_info: { total_number: 1, total_page: 1 } } } };
  };
  const opts = { advertiserId: '456', dayISO: '2026-09-04', accessToken: 'synthetic', adGroupIdsFilter: new Set(['123']) };
  assert.equal(await tk.fetchForAdvertiser(opts), 0);
  assert.equal(writes.length, 0);
  assert.ok(request.body.time_range);
  assert.equal(request.body.start_date, undefined);
  console.log('REPRODUCED: TikTok nested report row is dropped; request uses POST and nested time_range.');
  axios.post = async () => ({ data: { code: 40100, message: 'Synthetic error', data: null } });
  assert.equal(await tk.fetchForAdvertiser(opts), 0);
  console.log('REPRODUCED: TikTok API error code resolves as zero updates.');
  await tk.upsertCost({ advertiserId: '456', adGroupId: '123', day: '2026-09-04', doc: { spentAmount: 150000, clicks: 30 } });
  assert.equal(writes[0][1].$set.clicks, undefined);
  console.log('REPRODUCED: TikTok upsert discards clicks.');
  const ops = [];
  const providers = [{ syncForDate: async () => { throw new Error('Synthetic API failure'); } },
    { syncForDate: async () => ({ updated: 0 }) }, { syncForDate: async () => ({ updated: 0 }) }];
  const pipeline = new DataCollectionService(...providers,
    { recalculateOrdersForDate: async () => { ops.push('recalculate'); return { updated: 1 }; } },
    { syncFromOrderTest2: async () => { ops.push('snapshot'); return { recordsProcessed: 1 }; } });
  Object.assign(pipeline, { logger: silent, syncReceivables: async () => {}, syncPayables: async () => {}, updateDailyReports: async () => {} });
  await pipeline.runDataCollection();
  assert.deepEqual(ops, ['recalculate', 'snapshot']);
  assert.equal((await pipeline.getPipelineStatus()).dataCollection.status, 'SUCCESS');
  console.log('REPRODUCED: failed platform still allows recalculation/snapshot; pipeline status is SUCCESS.');
  writes = [];
  const gg = new Google(cost, {}, {}, {
    getGoogleAdsRuntimeConfig: async () => ({ developerToken: 'synthetic', refreshToken: 'synthetic', apiVersion: 'v24' }),
    getGoogleAdsAccessToken: async () => 'synthetic',
  }, {});
  gg.logger = silent;
  axios.post = async () => ({ data: [{ results: [{ adGroup: { id: '123' },
    metrics: { costMicros: '150000000000', averageCpc: '5000000000', clicks: '30', impressions: '1000' } }] }] });
  assert.equal(await gg.fetchCostForAccount({ account: { accountId: '456' }, adGroupIds: ['123'], dayISO: '2026-09-04' }), 1);
  assert.equal(writes[0][1].$set.spentAmount, 150000);
  assert.equal(writes[0][1].$set.cpc, 5000);
  assert.equal(writes[0][0].customerId, '456');
  console.log('VERIFIED: Google stream parsing, micros conversion and account-scoped upsert.');
  fakeDate.value = class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-09-05T06:00:00+07:00'])); } };
  const FrozenGoogle = load('advertising-cost/advertising-cost.google-sync.service.ts').AdvertisingCostGoogleSyncService;
  const range = new FrozenGoogle({}, {}, {}, {}, {});
  let day;
  range.syncForDate = async iso => { day = iso; return { updated: 0 }; };
  await range.syncRange();
  assert.equal(day, '2026-09-03');
  console.log('REPRODUCED: manual default range at 06:00 Vietnam Sep 5 requests Sep 3, expected Sep 4.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
