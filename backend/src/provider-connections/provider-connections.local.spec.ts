import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken, MongooseModule } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import * as request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { ProviderConnectionsModule } from './provider-connections.module';
import { ProviderConnection } from './provider-connection.schema';
import { ProviderReadHttpService } from './provider-read-http.service';
import { WindsorAdsDailyMetric } from './schemas/windsor-ads-daily-metric.schema';
import { WindsorAdsResource } from './schemas/windsor-ads-resource.schema';
import { AdvertisingCost } from '../advertising-cost/schemas/advertising-cost.schema';

// Explicit opt-in. Never loads AppModule/.env or connects to an external database.
const localDescribe = process.env.RUN_PROVIDER_CONNECTIONS_LOCAL_TEST === '1' ? describe : describe.skip;
localDescribe('Provider connections HTTP + local MongoDB', () => {
  const databaseName = `erp_provider_connection_test_${randomBytes(8).toString('hex')}`;
  const key = 'fixture-provider-key-not-real';
  const previousKey = process.env.API_TOKEN_SECRET;
  const previousSandbox = process.env.ERP_LOCAL_SANDBOX;
  let app: any;
  let connection: any;
  let model: any;
  let http: any;
  let id: string;
  const input = { kind: 'windsor-facebook', name: 'Integration fixture', revision: 0, state: 'configured', accountIds: ['123'], apiKey: key };
  beforeAll(async () => {
    process.env.API_TOKEN_SECRET = randomBytes(32).toString('hex');
    delete process.env.ERP_LOCAL_SANDBOX;
    http = { get: jest.fn(async (_host, path, _key, query) => {
      if (path.includes('ds-accounts')) {
        const datasource = query?.datasource || 'facebook';
        return [{ datasource, account_id: datasource === 'google_ads' ? '139-673-0688' : '123', account_name: 'Fixture', status: 'active' }];
      }
      if (path === '/google_ads/fields') return [
        'account_id', 'account_name', 'account_time_zone', 'date', 'campaign_id', 'campaign',
        'campaign_status', 'campaign_type', 'campaign_budget_id', 'ad_group_id', 'ad_group_name',
        'ad_group_status', 'spend', 'impressions', 'clicks', 'conversions', 'all_conversions',
        'conversion_value', 'cost_per_conversion', 'currency', 'ctr', 'cpc', 'average_cpm',
      ].map(id => ({ id }));
      if (path === '/google_ads/options') return [{ id: 'include_inactive' }];
      if (path === '/google_ads') return { data: [{
        account_id: '139-673-0688', account_name: 'Phù hiệu xe nhanh', account_time_zone: 'Asia/Bangkok',
        date: query.date_from, campaign_id: '1001', campaign: 'vui trần 1', campaign_status: 'ENABLED',
        campaign_type: 'SEARCH', campaign_budget_id: '3001', ad_group_id: '2001',
        ad_group_name: 'Nhóm tìm kiếm', ad_group_status: 'ENABLED', spend: 408312,
        impressions: 268, clicks: 41, conversions: 4, all_conversions: 4,
        conversion_value: 4, cost_per_conversion: 102078, currency: 'VND',
      }] };
      return [];
    }) };
    const module = await Test.createTestingModule({ imports: [
      MongooseModule.forRoot(`mongodb://127.0.0.1:27027/${databaseName}`, { serverSelectionTimeoutMS: 3000 }),
      ProviderConnectionsModule,
    ] }).overrideProvider(ProviderReadHttpService).useValue(http)
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: any) {
        const req = context.switchToHttp().getRequest();
        req.user = { id: '64b000000000000000000001', role: req.headers['x-test-role'] || 'director' }; return true;
      } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    connection = module.get(getConnectionToken());
    model = module.get(getModelToken(ProviderConnection.name));
    await Promise.all([
      model.init(),
      module.get(getModelToken(WindsorAdsDailyMetric.name)).init(),
      module.get(getModelToken(WindsorAdsResource.name)).init(),
      module.get(getModelToken(AdvertisingCost.name)).init(),
    ]);
  }, 30_000);
  afterAll(async () => {
    // Only the randomly named test database created above is eligible for cleanup.
    if (connection?.name === databaseName && /^erp_provider_connection_test_[a-f0-9]{16}$/.test(databaseName)) await connection.dropDatabase();
    await app?.close();
    if (previousKey === undefined) delete process.env.API_TOKEN_SECRET; else process.env.API_TOKEN_SECRET = previousKey;
    if (previousSandbox === undefined) delete process.env.ERP_LOCAL_SANDBOX; else process.env.ERP_LOCAL_SANDBOX = previousSandbox;
  });

  it('persists encrypted credentials and verifies the saved account without enabling live operations', async () => {
    const saved = await request(app.getHttpServer()).post('/provider-connections').send(input).expect(201);
    id = saved.body.id;
    expect(saved.body).toMatchObject({ revision: 1, liveWriteEnabled: false, messagingEnabled: false });
    expect(JSON.stringify(saved.body)).not.toContain(key);
    const record = await model.findById(id).select('+secretsEnc').lean();
    expect(record.secretsEnc).not.toContain(key);
    expect(record.apiKey).toBeUndefined();
    const checked = await request(app.getHttpServer()).post(`/provider-connections/${id}/check`).send({}).expect(201);
    expect(checked.body.check).toMatchObject({ status: 'accessible', providerValidation: 'unverified', liveWriteEnabled: false });
    const list = await request(app.getHttpServer()).get('/provider-connections').expect(200);
    expect(JSON.stringify(list.body)).not.toContain('secretsEnc');
    expect(JSON.stringify(list.body)).not.toContain(key);
  });

  it('enforces real unique indexes and optimistic locking with simultaneous updates', async () => {
    await request(app.getHttpServer()).post('/provider-connections').send(input).expect(409);
    const update = { ...input, revision: 1 }; delete (update as any).apiKey;
    const results = await Promise.all([
      request(app.getHttpServer()).patch(`/provider-connections/${id}`).send({ ...update, name: 'Edit A' }),
      request(app.getHttpServer()).patch(`/provider-connections/${id}`).send({ ...update, name: 'Edit B' }),
    ]);
    expect(results.map(response => response.status).sort()).toEqual([200, 409]);
    const row = await model.findById(id).lean();
    expect(row.revision).toBe(2); expect(row.check).toBeUndefined();
  });

  it('rejects non-admin access, unknown fields and arbitrary mutation routes', async () => {
    await request(app.getHttpServer()).get('/provider-connections').set('x-test-role', 'manager').expect(403);
    await request(app.getHttpServer()).post('/provider-connections').send({ ...input, liveWriteEnabled: true }).expect(400);
    await request(app.getHttpServer()).post(`/provider-connections/${id}/execute`).send({ action: 'pause_campaign' }).expect(404);
  });

  it('stages and idempotently materializes a Windsor Google snapshot into AdvertisingCost', async () => {
    const google = await request(app.getHttpServer()).post('/provider-connections').send({
      kind: 'windsor-google', name: 'Google fixture', revision: 0, state: 'configured',
      accountIds: ['1396730688'], apiKey: key,
    }).expect(201);
    await request(app.getHttpServer()).post(`/provider-connections/${google.body.id}/check`).send({}).expect(201);
    const first = await request(app.getHttpServer()).post(`/provider-connections/${google.body.id}/ads-read-sync`)
      .send({ dateFrom: '2026-09-05', dateTo: '2026-09-05' }).expect(201);
    const second = await request(app.getHttpServer()).post(`/provider-connections/${google.body.id}/ads-read-sync`)
      .send({ dateFrom: '2026-09-05', dateTo: '2026-09-05' }).expect(201);
    expect(first.body.status).toBe('success'); expect(second.body.status).toBe('success');
    expect(await connection.db.collection('windsor_ads_daily_metrics').countDocuments()).toBe(1);
    expect(await connection.db.collection('windsor_ads_resources').countDocuments()).toBe(3);
    expect(await connection.db.collection('advertisingcosts').countDocuments()).toBe(1);
    const cost = await connection.db.collection('advertisingcosts').findOne();
    expect(cost).toMatchObject({
      channel: 'google', customerId: '1396730688', adGroupId: '2001', spentAmount: 408312,
      sourceSystem: 'windsor', sourceConnectionId: google.body.id,
    });
    const staged = await connection.db.collection('windsor_ads_daily_metrics').findOne();
    expect({ connectionId: String(staged.connectionId), date: staged.date, spend: staged.spend })
      .toEqual({ connectionId: google.body.id, date: '2026-09-05', spend: 408312 });
    const snapshot = await request(app.getHttpServer())
      .get(`/provider-connections/${google.body.id}/ads-snapshot?dateFrom=2026-09-05&dateTo=2026-09-05`)
      .expect(200);
    expect(snapshot.body).toMatchObject({
      materializedToAdvertisingCost: true, materializedRows: 1, primaryCostSource: 'windsor',
      summary: { spend: 408312, rows: 1 },
    });
  });
});
