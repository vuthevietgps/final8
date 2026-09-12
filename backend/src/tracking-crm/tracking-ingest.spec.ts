import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Connection, createConnection, Types } from 'mongoose';
import { TrackingIngestBatchDto } from './tracking-ingest.dto';
import { TrackingIngestService } from './tracking-ingest.service';
import { TrackingSourceSchema, TrackingVisitSchema } from './schemas/tracking-crm.schema';

const makeVisit = () => ({ externalVisitId: 'test-visit', occurredAt: '2026-09-01T00:00:00Z', observedAt: '2026-09-09T00:00:00Z',
  landingHost: 'nghiepvuvantai.com', landingPath: '/', ipAddress: '192.0.2.1', ads: { provider: 'google', campaignId: 'raw-name' },
  engagement: { pageViews: 1, engagedSeconds: 10, maxScroll: 20, contactActions: 0, formSubmits: 0 } });

describe('Tracking ingest validation', () => {
  it('requires nested evidence and rejects bad IP / forged business fields', async () => {
    for (const patch of [{ ads: undefined }, { engagement: undefined }, { ipAddress: 'invalid' }, { agentId: 'forged' }]) {
      const dto = plainToInstance(TrackingIngestBatchDto, { visits: [{ ...makeVisit(), ...patch }] });
      expect((await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
    }
  });
  it('rejects unbounded batches and invalid counters', async () => {
    for (const visits of [[], Array.from({ length: 51 }, makeVisit), [{ ...makeVisit(), engagement: { ...makeVisit().engagement, maxScroll: 101 } }]]) {
      expect((await validate(plainToInstance(TrackingIngestBatchDto, { visits }))).length).toBeGreaterThan(0);
    }
  });
});

const integration = process.env.TRACKING_TEST_MONGO === 'true' ? describe : describe.skip;
integration('Tracking ingest isolated MongoDB integration', () => {
  let connection: Connection, sources: any, visits: any, service: TrackingIngestService;
  const database = `erp_tracking_test_${Date.now()}`;
  const previous = process.env.TRACKING_INGEST_SOURCE_KEY;
  beforeAll(async () => {
    connection = await createConnection(`mongodb://127.0.0.1:27019/${database}?directConnection=true`, { serverSelectionTimeoutMS: 5000 }).asPromise();
    sources = connection.model('TrackingSource', TrackingSourceSchema);
    visits = connection.model('TrackingVisit', TrackingVisitSchema);
    await Promise.all([sources.init(), visits.init()]);
    process.env.TRACKING_INGEST_SOURCE_KEY = 'integration-only';
    await sources.create({ sourceKey: 'integration-only', name: 'Test', enabled: true,
      allowedOrigins: ['https://nghiepvuvantai.com'], createdBy: new Types.ObjectId() });
    service = new TrackingIngestService(sources, visits, connection);
  });
  afterAll(async () => {
    if (previous === undefined) delete process.env.TRACKING_INGEST_SOURCE_KEY; else process.env.TRACKING_INGEST_SOURCE_KEY = previous;
    if (connection) {
      if (connection.name !== database || !database.startsWith('erp_tracking_test_')) throw new Error('Unsafe cleanup target');
      await connection.dropDatabase(); await connection.close();
    }
  });
  it('upserts once, updates late counters, ignores stale snapshots and preserves original evidence', async () => {
    const row = makeVisit();
    await service.ingest({ visits: [row] });
    await service.ingest({ visits: [row] });
    expect(await visits.countDocuments()).toBe(1);
    const newer = { ...row, ipAddress: '192.0.2.2', observedAt: '2026-09-09T01:00:00Z', engagement: { ...row.engagement, engagedSeconds: 100 } };
    await service.ingest({ visits: [newer] });
    await service.ingest({ visits: [row] });
    const saved = await visits.findOne().select('+ipAddress').lean();
    expect(saved.ipAddress).toBe('192.0.2.1');
    expect(saved.engagement.engagedSeconds).toBe(100);
    expect(saved.ads.campaignId).toBe('raw-name');
    expect(await connection.db.collection('tracking_crm_leads').countDocuments()).toBe(0);
  });
  it('rejects a wrong origin, duplicate IDs, future dates and disabled sources before writes', async () => {
    for (const batch of [
      [{ ...makeVisit(), landingHost: 'other.example' }], [makeVisit(), makeVisit()],
      [{ ...makeVisit(), observedAt: '2099-01-01T00:00:00Z' }],
    ]) await expect(service.ingest({ visits: batch })).rejects.toThrow();
    await sources.updateOne({}, { $set: { enabled: false } });
    await expect(service.ingest({ visits: [makeVisit()] })).rejects.toThrow();
    expect(await visits.countDocuments()).toBe(1);
  });
});
