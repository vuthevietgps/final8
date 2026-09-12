import 'reflect-metadata';
import { Connection, createConnection, Types } from 'mongoose';
import { conversionTypesFromEvidence } from './tracking-conversion';
import { trackingListQuery } from './tracking-list.query';
import { TrackingCrmService } from './tracking-crm.service';

describe('Tracking conversion evidence', () => {
  it('counts only contact/form evidence and deduplicates matching event types', () => {
    expect(conversionTypesFromEvidence([], undefined)).toEqual([]);
    expect(conversionTypesFromEvidence([], { contactActions: 0, formSubmits: 0 })).toEqual([]);
    expect(conversionTypesFromEvidence(['contact', 'phone'], { contactActions: 3, formSubmits: 1 }))
      .toEqual(['contact', 'phone', 'form_submit']);
  });
  it('preserves conversion classification when opening an existing CRM profile', async () => {
    const lead = { visitId: 'v', _id: 'l', toObject: () => ({ _id: 'l' }) };
    const leads: any = { findById: () => ({ select: async () => lead }) };
    const visits: any = { findById: () => ({ select: () => ({ lean: async () => ({ engagement: { contactActions: 2 } }) }) }) };
    const events: any = { distinct: async () => [] };
    const links: any = { findOne: () => ({ lean: async () => null }) };
    const service = new TrackingCrmService(leads, visits, events, links, null, null, null, null, null, null);
    expect(await service.detail('l')).toMatchObject({ interactionKind: 'conversion', conversionTypes: ['contact'] });
  });
});

const integration = process.env.TRACKING_TEST_MONGO === 'true' ? describe : describe.skip;
integration('Conversion classification on isolated MongoDB', () => {
  let connection: Connection;
  const database = `erp_tracking_test_conversion_${Date.now()}`;
  const source = new Types.ObjectId();
  const read = async (query: Record<string, string> = {}) => {
    const [result] = await connection.db.collection('tracking_crm_visits').aggregate(trackingListQuery(query).pipeline).toArray();
    return { total: result.total[0]?.value || 0, items: result.items };
  };
  beforeAll(async () => {
    connection = await createConnection(`mongodb://127.0.0.1:27019/${database}?directConnection=true`, { serverSelectionTimeoutMS: 5000 }).asPromise();
    await connection.db.collection('tracking_crm_visits').insertMany([
      { externalVisitId: 'missing' },
      { externalVisitId: 'browsing', engagement: { pageViews: 10, engagedSeconds: 600, maxScroll: 100, contactActions: 0, formSubmits: 0 } },
      { externalVisitId: 'contact', engagement: { contactActions: 3 } },
      { externalVisitId: 'form', engagement: { formSubmits: 1 } },
      { externalVisitId: 'mixed', engagement: { contactActions: 1, formSubmits: 2 } },
      { externalVisitId: 'phone' },
    ].map(row => ({ ...row, sourceId: source, occurredAt: new Date('2026-09-01T00:00:00Z') })));
    await connection.db.collection('tracking_crm_events').insertMany([
      { sourceId: source, externalVisitId: 'mixed', eventType: 'contact', occurredAt: new Date('2026-09-09T00:00:00Z') },
      { sourceId: source, externalVisitId: 'phone', eventType: 'phone', occurredAt: new Date('2026-09-09T00:00:00Z') },
      // Another source's event must not convert the visit with the same external ID.
      { sourceId: new Types.ObjectId(), externalVisitId: 'missing', eventType: 'zalo', occurredAt: new Date() },
      { sourceId: source, externalVisitId: 'browsing', eventType: 'scroll', occurredAt: new Date() },
    ]);
  });
  afterAll(async () => {
    if (connection) {
      if (connection.name !== database || !database.startsWith('erp_tracking_test_conversion_')) throw Error('Unsafe cleanup');
      await connection.dropDatabase(); await connection.close();
    }
  });
  it('separates clicks and conversions before counting and pagination', async () => {
    const clicks = await read({ type: 'click' });
    const converted = await read({ type: 'conversion' });
    expect(clicks.total).toBe(2);
    expect(converted.total).toBe(4);
    expect(clicks.items.map(r => r.externalVisitId).sort()).toEqual(['browsing', 'missing']);
    expect(converted.items.find(r => r.externalVisitId === 'mixed').conversionTypes.sort()).toEqual(['contact', 'form_submit']);
    expect((await read({ type: 'conversion', page: '2' })).total).toBe(4);
    expect((await read({ type: 'conversion', page: '2' })).items).toEqual([]);
  });
  it('filters each channel without guessing phone or Zalo from contact totals', async () => {
    expect((await read({ conversion: 'contact' })).total).toBe(2);
    expect((await read({ conversion: 'form_submit' })).total).toBe(2);
    expect((await read({ conversion: 'phone' })).total).toBe(1);
    expect((await read({ conversion: 'zalo' })).total).toBe(0);
    expect((await read({ type: 'click', conversion: 'contact' })).total).toBe(0);
  });
  it('returns snapshot evidence but never invents event timestamps for date filters', async () => {
    const row = (await read()).items.find(r => r.externalVisitId === 'contact');
    expect(row.conversionTypes).toEqual(['contact']);
    expect(row.engagement.contactActions).toBe(3);
    expect(row.lastConversionAt).toBeNull();
    const dated = await read({ type: 'conversion', timeField: 'conversion', from: '2026-09-09', to: '2026-09-09' });
    expect(dated.items.map(r => r.externalVisitId).sort()).toEqual(['mixed', 'phone']);
  });
  it('moves a click to conversion after a late snapshot update without duplicate rows', async () => {
    await connection.db.collection('tracking_crm_visits').updateOne({ sourceId: source, externalVisitId: 'browsing' }, { $set: { 'engagement.contactActions': 1 } });
    expect((await read({ type: 'click' })).total).toBe(1);
    expect((await read({ type: 'conversion' })).total).toBe(5);
    expect((await read()).total).toBe(6);
  });
});
