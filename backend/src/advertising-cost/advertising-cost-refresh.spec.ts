import { AdvertisingCostRefreshService } from './advertising-cost-refresh.module';

describe('durable financial projection retry', () => {
  it('leaves failed work pending and releases only its own lease', async () => {
    const jobs: any = { findOneAndUpdate: jest.fn(() => ({ lean: async () => ({ version: 2, revalue: true }) })), updateOne: jest.fn() };
    const events: any = { emitAsync: jest.fn().mockRejectedValue(new Error('report offline')) };
    const service = new AdvertisingCostRefreshService(jobs, events);
    await expect(service.flush('2026-09-05')).rejects.toThrow('report offline');
    expect(jobs.updateOne).toHaveBeenCalledTimes(1);
    expect(jobs.updateOne.mock.calls[0][0]).toEqual(expect.objectContaining({ day: '2026-09-05', leaseToken: expect.any(String) }));
    expect(jobs.updateOne.mock.calls[0][1]).not.toHaveProperty('$set.pending', false);
    events.emitAsync.mockResolvedValue([undefined]);
    jobs.updateOne.mockResolvedValue({ modifiedCount: 1 });
    expect(await service.flush('2026-09-05')).toBe(true);
    expect(jobs.updateOne.mock.calls[1][0]).toEqual(expect.objectContaining({ version: 2 }));
  });
  it('does not acknowledge a newer change made while projections were running', async () => {
    const jobs: any = { findOneAndUpdate: () => ({ lean: async () => ({ version: 1 }) }), updateOne: jest.fn().mockResolvedValue({ modifiedCount: 0 }) };
    const service = new AdvertisingCostRefreshService(jobs, { emitAsync: async () => [undefined] } as any);
    expect(await service.flush('2026-09-05')).toBe(false);
    expect(jobs.updateOne.mock.calls[0][0].version).toBe(1);
  });
  it('does not run work that another backend already leased', async () => {
    const events: any = { emitAsync: jest.fn() };
    const service = new AdvertisingCostRefreshService({ findOneAndUpdate: () => ({ lean: async () => null }) } as any, events);
    expect(await service.flush('2026-09-05')).toBe(false);
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});
