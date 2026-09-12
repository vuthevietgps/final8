import { model, Types } from 'mongoose';
import {
  TrackingSourceSchema, TrackingVisitSchema, TrackingEventSchema,
  TrackingLeadSchema, TrackingOrderLinkSchema,
} from './schemas/tracking-crm.schema';

const Source = model('TrackingCrmSourceTest', TrackingSourceSchema);
const Visit = model('TrackingCrmVisitTest', TrackingVisitSchema);
const Event = model('TrackingCrmEventTest', TrackingEventSchema);
const Lead = model('TrackingCrmLeadTest', TrackingLeadSchema);
const Link = model('TrackingCrmLinkTest', TrackingOrderLinkSchema);
const actor = new Types.ObjectId();
const lead = () => new Lead({ visitId: new Types.ObjectId(), createdBy: actor, updatedBy: actor });

describe('Tracking CRM model contract (offline)', () => {
  it('casts visit and actor IDs to BSON ObjectIds so list joins find saved leads', () => {
    const value = new Lead({ visitId: String(actor), createdBy: String(actor), updatedBy: String(actor) });
    expect(TrackingLeadSchema.path('visitId').instance).toBe('ObjectId');
    expect(value.visitId).toBeInstanceOf(Types.ObjectId);
    expect(value.createdBy).toBeInstanceOf(Types.ObjectId);
    expect(TrackingOrderLinkSchema.path('leadId').instance).toBe('ObjectId');
  });
  it('starts sources disabled and rejects credentials in model payloads', async () => {
    const source = new Source({ sourceKey: 'ladifinal-main', name: 'Main', createdBy: actor });
    await source.validate();
    expect(source.enabled).toBe(false);
    expect(() => new Source({ sourceKey: 'x', name: 'x', createdBy: actor, apiKey: 'test-only' })).toThrow();
  });

  it.each(['http://landing.example', 'https://landing.example/path', 'https://user:pass@landing.example', '*'])
  ('rejects non-origin allowlist entry %s', async origin => {
    await expect(new Source({ sourceKey: 'x', name: 'x', createdBy: actor, allowedOrigins: [origin] }).validate()).rejects.toThrow();
  });

  it('accepts exact HTTPS origins and source-scoped visit identity', async () => {
    await new Source({ sourceKey: 'x', name: 'x', createdBy: actor, allowedOrigins: ['https://landing.example'] }).validate();
    const visit = new Visit({ sourceId: actor, externalVisitId: 'legacy-visit-token', occurredAt: new Date(),
      landingHost: 'landing.example', landingPath: '/', ads: { provider: 'google', campaignId: 'a-utm-name' } });
    await visit.validate();
    expect(visit.ads.campaignId).toBe('a-utm-name');
    expect(TrackingVisitSchema.path('ipAddress').options.select).toBe(false);
    expect(TrackingVisitSchema.path('ads').options.immutable).toBe(true);
  });

  it('declares database uniqueness for retries and primary order attribution', () => {
    for (const [schema, name, keys] of [
      [TrackingVisitSchema, 'tracking_visit_source_unique', { sourceId: 1, externalVisitId: 1 }],
      [TrackingEventSchema, 'tracking_event_source_unique', { sourceId: 1, externalEventId: 1 }],
      [TrackingLeadSchema, 'tracking_lead_visit_unique', { visitId: 1 }],
      [TrackingOrderLinkSchema, 'tracking_order_link_lead_unique', { leadId: 1 }],
      [TrackingOrderLinkSchema, 'tracking_order_link_order_unique', { orderId: 1 }],
    ] as const) {
      expect(schema.indexes().find(([, options]) => options.name === name))
        .toEqual([keys, expect.objectContaining({ unique: true })]);
    }
  });

  it('keeps zero different from unknown and preserves manually entered COD', async () => {
    const doc = lead();
    expect(doc.saleTotal).toBeUndefined();
    doc.saleTotal = 1000000; doc.deposit = 0; doc.codAmount = 750000;
    await doc.validate();
    expect(doc.deposit).toBe(0);
    expect(doc.codAmount).toBe(750000);
    expect(doc.supplierCostNote).toBeUndefined();
  });

  it.each([-1, 1.5, Infinity, 10000000000000])('rejects invalid VND %s', async amount => {
    const doc = lead(); doc.saleTotal = amount;
    await expect(doc.validate()).rejects.toThrow();
  });

  it('requires matching evidence before confirmation', async () => {
    const doc = lead(); doc.status = 'confirmed';
    await expect(doc.validate()).rejects.toThrow();
    doc.matchMethod = 'manual';
    await expect(doc.validate()).rejects.toThrow();
    doc.matchedBy = actor; doc.matchedAt = new Date(); doc.matchEvidence = 'Staff matched contact with visit';
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(TrackingLeadSchema.options.optimisticConcurrency).toBe(true);
  });

  it('requires a stable event ID for deduplication, with no financial event type', async () => {
    const data = { sourceId: actor, externalVisitId: 'visit-1', occurredAt: new Date(), eventType: 'phone' };
    await expect(new Event(data).validate()).rejects.toThrow();
    await expect(new Event({ ...data, externalEventId: 'event-1' }).validate()).resolves.toBeUndefined();
    await expect(new Event({ ...data, externalEventId: 'event-1', eventType: 'order_confirmed' }).validate()).rejects.toThrow();
  });

  it('requires an ERP order and actor for the link', async () => {
    await expect(new Link({ leadId: actor }).validate()).rejects.toThrow();
    await expect(new Link({ leadId: actor, orderId: new Types.ObjectId(), linkedBy: actor, lastSyncedLeadVersion: 0 }).validate()).resolves.toBeUndefined();
    expect(TrackingOrderLinkSchema.path('orderId').options.ref).toBe('TestOrder2');
  });

  it('does not expire business evidence with a TTL index', () => {
    for (const schema of [TrackingVisitSchema, TrackingEventSchema, TrackingLeadSchema, TrackingOrderLinkSchema]) {
      expect(schema.indexes().some(([, options]) => options.expireAfterSeconds !== undefined)).toBe(false);
    }
  });
});
