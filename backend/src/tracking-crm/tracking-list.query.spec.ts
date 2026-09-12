import { trackingListQuery } from './tracking-list.query';
import { TrackingCrmService } from './tracking-crm.service';

describe('Tracking visit search', () => {
  it('filters conversion dates and channel on the same event, not on visit time', () => {
    const { pipeline } = trackingListQuery({ timeField: 'conversion', from: '2026-09-08', to: '2026-09-08', conversion: 'phone' });
    expect(pipeline[0].$match).not.toHaveProperty('occurredAt');
    const join = pipeline.find(stage => stage.$lookup?.as === 'matchingConversions').$lookup;
    expect(join.pipeline[0].$match).toMatchObject({ eventType: 'phone', occurredAt: { $gte: new Date('2026-09-07T17:00:00Z'), $lt: new Date('2026-09-08T17:00:00Z') } });
  });
  it('filters follow-up and confidence before pagination', () => {
    const { pipeline } = trackingListQuery({ followUp: 'due', confidence: 'approximate' });
    const match = pipeline.find(stage => stage.$match?.['lead.nextFollowUpAt']).$match;
    expect(match['lead.status']).toBe('noted');
    expect(match['lead.matchConfidence']).toBe('approximate');
    expect(match['lead.nextFollowUpAt'].$lte).toBeInstanceOf(Date);
  });
  it('pages visits before enrichment for the default IP/Google/date query', () => {
    const { pipeline, pageSize } = trackingListQuery({ ip: '203.0.113.7', provider: 'google', from: '2026-09-08', to: '2026-09-08' });
    expect(pageSize).toBe(25);
    expect(pipeline[0].$match).toMatchObject({ ipAddress: '203.0.113.7', 'ads.provider': 'google', occurredAt: {
      $gte: new Date('2026-09-07T17:00:00Z'), $lt: new Date('2026-09-08T17:00:00Z'),
    } });
    expect(pipeline[2].$facet.items.slice(0, 2)).toEqual([{ $skip: 0 }, { $limit: 25 }]);
    expect(pipeline.some(stage => stage.$lookup)).toBe(false);
  });
  it('applies lead, conversion and order filters before pagination and count', () => {
    const { pipeline } = trackingListQuery({ status: 'new', conversion: 'zalo', order: 'pending', page: '2' });
    const before = pipeline.slice(0, -1);
    expect(before).toContainEqual({ $match: { 'lead._id': { $exists: false } } });
    expect(before).toContainEqual({ $match: { conversionTypes: 'zalo' } });
    expect(before).toContainEqual({ $match: { 'linkRows.0': { $exists: false } } });
    expect(pipeline.at(-1).$facet.items[0]).toEqual({ $skip: 25 });
  });
  it.each([{ page: '-1' }, { pageSize: '10000' }, { agentId: 'wrong' }, { from: '2026-02-30' }, { from: '2026-09-09', to: '2026-09-08' }, { type: 'closed' }, { ip: { $ne: null } }])('rejects malformed or unbounded queries: %p', query => {
    expect(() => trackingListQuery(query as any)).toThrow();
  });
  it('escapes regex metacharacters in user searches', () => {
    const { pipeline } = trackingListQuery({ landing: 'a.example+(test)' });
    expect(pipeline[0].$match.$or[0].landingHost.$regex).toBe('a\\.example\\+\\(test\\)');
  });
  it('returns visits without a lead or order, exposes IP only in the guarded CRM view', async () => {
    const visits: any = { aggregate: jest.fn().mockReturnValue({ option: async () => [{ total: [{ value: 1 }], items: [
      { _id: 'visit', ipAddress: '203.0.113.7', conversionTypes: [], categoryRows: [], linkRows: [] },
    ] }] }) };
    const service = new TrackingCrmService(null, visits, null, null, null, null, null, null, null, null);
    const result = await service.list();
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ leadId: null, visitId: 'visit', status: 'new', interactionKind: 'click', link: null, visit: { ipAddress: '203.0.113.7' } });
    expect(result.items[0]).not.toHaveProperty('events');
  });
});
