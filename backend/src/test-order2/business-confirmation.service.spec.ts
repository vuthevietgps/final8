import { Types } from 'mongoose';
import { TestOrder2Service } from './test-order2.service';

describe('TestOrder2Service business confirmation transition', () => {
  const orderId = new Types.ObjectId().toHexString();
  const actorId = new Types.ObjectId().toHexString();

  const createService = (model: Record<string, jest.Mock>) => new TestOrder2Service(
    model as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
  );

  it('atomically sets a server timestamp and canonical JWT actor only while absent', async () => {
    const confirmed = { _id: new Types.ObjectId(orderId), businessConfirmedAt: new Date() };
    const model = {
      findOneAndUpdate: jest.fn().mockResolvedValue(confirmed),
      findById: jest.fn(),
    };
    const service = createService(model);

    await expect(service.confirmBusiness(orderId, { id: actorId })).resolves.toBe(confirmed);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(orderId),
        $or: [
          { businessConfirmedAt: { $exists: false } },
          { businessConfirmedAt: null },
        ],
      },
      {
        $set: expect.objectContaining({
          businessConfirmedAt: expect.any(Date),
          businessConfirmedBy: new Types.ObjectId(actorId),
          businessConfirmationSource: 'erp_manual_confirmation',
        }),
      },
      { new: true },
    );
    expect(model.findById).not.toHaveBeenCalled();
  });

  it('returns the original confirmation on retry without rewriting it', async () => {
    const original = {
      _id: new Types.ObjectId(orderId),
      businessConfirmedAt: new Date('2026-07-10T10:00:00.000Z'),
      businessConfirmedBy: new Types.ObjectId(actorId),
      businessConfirmationSource: 'pending_order_approval',
    };
    const model = {
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(original),
    };
    const service = createService(model);

    const differentActorId = new Types.ObjectId().toHexString();
    await expect(service.confirmBusiness(orderId, { id: differentActorId }))
      .resolves.toBe(original);

    expect(original.businessConfirmedAt.toISOString()).toBe('2026-07-10T10:00:00.000Z');
    expect(String(original.businessConfirmedBy)).toBe(actorId);
    expect(original.businessConfirmationSource).toBe('pending_order_approval');
  });

  it('fails closed before touching the order for a non-canonical actor', async () => {
    const model = {
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
    };
    const service = createService(model);

    await expect(service.confirmBusiness(orderId, { id: 'spoofed' }))
      .rejects.toMatchObject({ status: 403 });
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
