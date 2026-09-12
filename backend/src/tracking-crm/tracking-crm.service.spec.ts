import { TrackingCrmService } from './tracking-crm.service';
import { ConflictException } from '@nestjs/common';
import { TestOrder2Service } from '../test-order2/test-order2.service';

describe('Tracking CRM order boundaries', () => {
  it('rejects a conversion from another visit before writing customer data', async () => {
    const draft = { __v: 0, visitId: 'visit', save: jest.fn() };
    const visit = { sourceId: 'source', externalVisitId: 'external' };
    const events: any = { exists: jest.fn().mockResolvedValue(null) };
    const visits: any = { findById: () => ({ lean: async () => visit }) };
    const links: any = { exists: async () => false };
    const service = new TrackingCrmService(null, visits, events, links, null, null, null, null, null, null);
    await expect(service.save('lead', { version: 0, status: 'noted', matchedEventId: 'wrong-event' }, 'actor', draft)).rejects.toThrow('Chuyển đổi không thuộc');
    expect(events.exists).toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'source', externalVisitId: 'external', _id: 'wrong-event' }));
    expect(draft.save).not.toHaveBeenCalled();
  });
  it('rejects an order edited after CRM checked its attribution', async () => {
    const service = Object.create(TestOrder2Service.prototype);
    service.model = { findById: jest.fn().mockResolvedValue({ __v: 8 }) };
    await expect(service.update('order', { customerName: 'Demo' }, undefined, 7)).rejects.toBeInstanceOf(ConflictException);
  });
  function setup() {
    const leads: any = { findOneAndUpdate: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
    const links: any = { findOne: jest.fn() };
    const orders: any = { findById: jest.fn(), update: jest.fn().mockResolvedValue({}) };
    const service = new TrackingCrmService(leads, null, null, links, null, null, null, orders, null, null);
    return { service, leads, links, orders };
  }
  const identity = { agentId: 'agent-a', productId: 'product-a', supplierId: 'supplier-a',
    adGroupId: '123', adsProvider: 'google', adAccountProviderId: '456', adCampaignId: '789' };

  it.each(['agentId', 'productId', 'supplierId', 'adGroupId', 'adsProvider', 'adAccountProviderId', 'adCampaignId'])
  ('blocks cross-identity updates for %s', key => {
    const { service } = setup();
    expect(() => (service as any).assertOrderIdentity(identity, { ...identity, [key]: 'different' })).toThrow();
  });
  it('rejects stale versions without touching any order', async () => {
    const { service, leads, orders } = setup(); leads.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.sync('lead', 1, 'actor', {})).rejects.toBeInstanceOf(ConflictException);
    expect(orders.update).not.toHaveBeenCalled();
  });
  it('does not promote a customer still being advised', async () => {
    const { service, leads, orders } = setup();
    leads.findOneAndUpdate.mockResolvedValue({ _id: 'lead', status: 'noted' });
    orders.create = jest.fn();
    await expect(service.promote('lead', 0, 'actor', {})).rejects.toThrow('Chỉ chuyển');
    expect(orders.create).not.toHaveBeenCalled();
    expect(leads.updateOne).toHaveBeenCalled();
  });
  it('reuses the existing linked order on repeated promotion', async () => {
    const { service, leads, links, orders } = setup();
    leads.findOneAndUpdate.mockResolvedValue({ _id: 'lead', status: 'confirmed' });
    links.findOne.mockResolvedValue({ orderId: 'existing-order' });
    orders.create = jest.fn();
    await expect(service.promote('lead', 0, 'actor', {})).resolves.toEqual({ orderId: 'existing-order', created: false });
    expect(orders.create).not.toHaveBeenCalled();
  });
  it('updates contact only; never copies CRM money or quote estimates', async () => {
    const { service, leads, links, orders } = setup();
    leads.findOneAndUpdate.mockResolvedValue({ _id: 'lead', __v: 2, status: 'confirmed', ...identity,
      customerName: 'Demo', notes: 'Note', saleTotal: 900000, deposit: 100000, codAmount: 800000 });
    const link = { orderId: 'order', save: jest.fn().mockResolvedValue({}) };
    links.findOne.mockResolvedValue(link); orders.findById.mockResolvedValue({ ...identity, __v: 7 });
    await service.sync('lead', 1, '660000000000000000000001', {});
    const payload = orders.update.mock.calls[0][1];
    expect(payload.customerName).toBe('Demo');
    expect(payload.serviceDetails).toBe('Note');
    expect(orders.update.mock.calls[0][3]).toBe(7);
    for (const key of ['agentId', 'productId', 'retailSaleAmount', 'depositAmount', 'codAmount', 'supplierQuote', 'agentQuote']) expect(payload).not.toHaveProperty(key);
    expect(link.save).toHaveBeenCalled();
    expect(leads.updateOne).toHaveBeenCalled();
  });
  it('releases the operation lock on failure and does not mark success', async () => {
    const { service, leads, links, orders } = setup();
    leads.findOneAndUpdate.mockResolvedValue({ _id: 'lead', __v: 2, status: 'confirmed', ...identity });
    const link = { orderId: 'order', save: jest.fn() };
    links.findOne.mockResolvedValue(link); orders.findById.mockResolvedValue({ ...identity, agentId: 'other' });
    await expect(service.sync('lead', 1, '660000000000000000000001', {})).rejects.toThrow();
    expect(orders.update).not.toHaveBeenCalled(); expect(link.save).not.toHaveBeenCalled();
    expect(leads.updateOne).toHaveBeenCalled();
  });
});
