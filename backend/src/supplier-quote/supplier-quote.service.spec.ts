import { Types } from 'mongoose';
import { SupplierQuoteService } from './supplier-quote.service';
import { SupplierQuoteSchema } from './schemas/supplier-quote.schema';

describe('SupplierQuoteService approval workflow', () => {
  const quoteId = new Types.ObjectId().toHexString();
  const productId = new Types.ObjectId().toHexString();
  const supplierId = new Types.ObjectId().toHexString();
  const makerId = new Types.ObjectId().toHexString();
  const directorId = new Types.ObjectId().toHexString();
  const director = {
    id: directorId,
    email: 'director@example.com',
    fullName: 'Director',
  };

  const quoteDocument = (overrides: Record<string, any> = {}) => {
    const doc: any = {
      _id: new Types.ObjectId(quoteId),
      productId: new Types.ObjectId(productId),
      supplierId: new Types.ObjectId(supplierId),
      price: 180_000,
      currency: 'VND',
      shippingFee: 0,
      returnFee: 0,
      approvalStatus: 'pending',
      createdBy: new Types.ObjectId(makerId),
      lastCommercialEditedBy: new Types.ObjectId(makerId),
      approvalHistory: [],
      markModified: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    doc.toObject = jest.fn(() => ({ ...doc }));
    return doc;
  };

  const createService = () => {
    const model = {
      create: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
    };
    return { service: new SupplierQuoteService(model as any), model };
  };

  it('always creates a pending quote even if untrusted approval fields are supplied', async () => {
    const { service, model } = createService();
    const created = quoteDocument();
    model.create.mockResolvedValue(created);

    await service.create({
      productId,
      supplierId,
      price: 180_000,
      approvalStatus: 'approved',
      approvedBy: directorId,
      createdBy: directorId,
      lastCommercialEditedBy: directorId,
    } as any, director);

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      approvalStatus: 'pending',
      createdBy: new Types.ObjectId(directorId),
      lastCommercialEditedBy: new Types.ObjectId(directorId),
      approvalHistory: [expect.objectContaining({
        decision: 'created',
        actorId: new Types.ObjectId(directorId),
      })],
    }));
    expect(model.create.mock.calls[0][0]).not.toHaveProperty('approvedBy');
  });

  it('approves with the server-authenticated actor and appends audit history', async () => {
    const { service, model } = createService();
    const doc = quoteDocument({
      approvalStatus: 'rejected',
      rejectedBy: new Types.ObjectId(),
      rejectedAt: new Date(),
      rejectionReason: 'old reason',
    });
    model.findById.mockResolvedValue(doc);

    const result = await service.approve(quoteId, director);

    expect(result).toEqual(expect.objectContaining({ approvalStatus: 'approved' }));
    expect(String(doc.approvedBy)).toBe(directorId);
    expect(doc.approvedAt).toBeInstanceOf(Date);
    expect(doc.rejectedBy).toBeUndefined();
    expect(doc.rejectionReason).toBeUndefined();
    expect(doc.approvalHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        decision: 'approved',
        actorLabel: 'Director',
        priceSnapshot: 180_000,
      }),
    ]));
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  it('rejects with a required reason and clears prior approval fields', async () => {
    const { service, model } = createService();
    const doc = quoteDocument({
      approvalStatus: 'approved',
      approvedBy: new Types.ObjectId(),
      approvedAt: new Date(),
    });
    model.findById.mockResolvedValue(doc);

    await service.reject(quoteId, director, '  Giá cao hơn thỏa thuận.  ');

    expect(doc.approvalStatus).toBe('rejected');
    expect(String(doc.rejectedBy)).toBe(directorId);
    expect(doc.rejectionReason).toBe('Giá cao hơn thỏa thuận.');
    expect(doc.approvedBy).toBeUndefined();
    expect(doc.approvedAt).toBeUndefined();
    expect(doc.approvalHistory[doc.approvalHistory.length - 1]).toEqual(expect.objectContaining({
      decision: 'rejected',
      reason: 'Giá cao hơn thỏa thuận.',
    }));
  });

  it('resets an approved quote to pending when commercial terms change', async () => {
    const { service, model } = createService();
    const doc = quoteDocument({
      approvalStatus: 'approved',
      approvedBy: new Types.ObjectId(),
      approvedAt: new Date(),
    });
    model.findById.mockResolvedValue(doc);

    await service.update(quoteId, { price: 190_000 }, director);

    expect(doc.price).toBe(190_000);
    expect(doc.approvalStatus).toBe('pending');
    expect(doc.approvedBy).toBeUndefined();
    expect(String(doc.lastCommercialEditedBy)).toBe(directorId);
    expect(doc.approvalHistory[doc.approvalHistory.length - 1]).toEqual(expect.objectContaining({
      decision: 'reset_to_pending',
      priceSnapshot: 190_000,
    }));
  });

  it('preserves approval when only a non-commercial note changes', async () => {
    const { service, model } = createService();
    const approvedBy = new Types.ObjectId();
    const doc = quoteDocument({
      approvalStatus: 'approved',
      approvedBy,
      approvedAt: new Date(),
    });
    model.findById.mockResolvedValue(doc);

    await service.update(quoteId, { note: 'ghi chú nội bộ' }, director);

    expect(doc.approvalStatus).toBe('approved');
    expect(doc.approvedBy).toBe(approvedBy);
    expect(doc.approvalHistory).toHaveLength(0);
  });

  it('blocks the creator or latest commercial editor from approving or rejecting', async () => {
    const { service, model } = createService();
    const selfOwned = quoteDocument({
      createdBy: new Types.ObjectId(directorId),
      lastCommercialEditedBy: new Types.ObjectId(makerId),
    });
    model.findById.mockResolvedValue(selfOwned);

    await expect(service.approve(quoteId, director)).rejects.toMatchObject({ status: 403 });

    const selfEdited = quoteDocument({
      createdBy: new Types.ObjectId(makerId),
      lastCommercialEditedBy: new Types.ObjectId(directorId),
    });
    model.findById.mockResolvedValue(selfEdited);
    await expect(service.reject(quoteId, director, 'Independent review')).rejects.toMatchObject({ status: 403 });
    expect(selfOwned.save).not.toHaveBeenCalled();
    expect(selfEdited.save).not.toHaveBeenCalled();
  });

  it('fails closed for legacy provenance, then allows claim plus independent approval', async () => {
    const { service, model } = createService();
    const legacy = quoteDocument({ createdBy: undefined, lastCommercialEditedBy: undefined });
    model.findById.mockResolvedValue(legacy);

    await expect(service.approve(quoteId, director)).rejects.toMatchObject({ status: 409 });

    await service.claimProvenance(quoteId, director);
    expect(String(legacy.createdBy)).toBe(directorId);
    expect(String(legacy.lastCommercialEditedBy)).toBe(directorId);
    expect(legacy.approvalHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ decision: 'provenance_claimed', actorLabel: 'Director' }),
    ]));

    const independentId = new Types.ObjectId().toHexString();
    await service.approve(quoteId, {
      id: independentId,
      email: 'independent-director@example.com',
      fullName: 'Independent Director',
    });
    expect(legacy.approvalStatus).toBe('approved');
    expect(String(legacy.approvedBy)).toBe(independentId);
  });

  it('repairs legacy provenance through a commercial update and still requires another actor', async () => {
    const { service, model } = createService();
    const legacy = quoteDocument({ createdBy: undefined, lastCommercialEditedBy: undefined });
    model.findById.mockResolvedValue(legacy);

    await service.update(quoteId, { price: 190_000 }, director);

    expect(String(legacy.createdBy)).toBe(directorId);
    expect(String(legacy.lastCommercialEditedBy)).toBe(directorId);
    await expect(service.approve(quoteId, director)).rejects.toMatchObject({ status: 403 });
  });

  it('uses optimistic concurrency so a simultaneous commercial edit and approval cannot both commit', async () => {
    expect(SupplierQuoteSchema.get('optimisticConcurrency')).toBe(true);
    const shared: any = {
      __v: 0,
      _id: new Types.ObjectId(quoteId),
      productId: new Types.ObjectId(productId),
      supplierId: new Types.ObjectId(supplierId),
      price: 180_000,
      currency: 'VND',
      shippingFee: 0,
      returnFee: 0,
      approvalStatus: 'pending',
      createdBy: new Types.ObjectId(makerId),
      lastCommercialEditedBy: new Types.ObjectId(makerId),
      approvalHistory: [],
    };
    let savesReached = 0;
    let releaseSaves!: () => void;
    const bothSaving = new Promise<void>((resolve) => { releaseSaves = resolve; });
    const concurrentDocument = () => {
      const local: any = {
        ...shared,
        approvalHistory: [...shared.approvalHistory],
        markModified: jest.fn(),
      };
      local.toObject = jest.fn(() => ({ ...local, approvalHistory: [...local.approvalHistory] }));
      local.save = jest.fn(async () => {
        savesReached += 1;
        if (savesReached === 2) releaseSaves();
        await bothSaving;
        if (local.__v !== shared.__v) {
          const error: any = new Error('No matching document version');
          error.name = 'VersionError';
          throw error;
        }
        for (const key of [
          'price', 'approvalStatus', 'createdBy', 'lastCommercialEditedBy',
          'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt',
          'rejectionReason', 'approvalHistory',
        ]) {
          shared[key] = Array.isArray(local[key]) ? [...local[key]] : local[key];
        }
        shared.__v += 1;
        local.__v = shared.__v;
      });
      return local;
    };
    const model = { findById: jest.fn(async () => concurrentDocument()) };
    const service = new SupplierQuoteService(model as any);

    const outcomes = await Promise.allSettled([
      service.update(quoteId, { price: 190_000 }, director),
      service.approve(quoteId, director),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
    expect(shared.__v).toBe(1);
    expect(shared.approvalHistory).toHaveLength(1);
    expect(['reset_to_pending', 'approved']).toContain(shared.approvalHistory[0].decision);
    if (shared.approvalHistory[0].decision === 'reset_to_pending') {
      expect(shared).toEqual(expect.objectContaining({ price: 190_000, approvalStatus: 'pending' }));
    } else {
      expect(shared).toEqual(expect.objectContaining({ price: 180_000, approvalStatus: 'approved' }));
    }
  });

  it('only returns explicitly approved quotes from the effective-price API', async () => {
    const { service, model } = createService();
    const lean = jest.fn().mockResolvedValue(null);
    const sort = jest.fn(() => ({ lean }));
    model.findOne.mockReturnValue({ sort });

    await service.getEffectiveAt(productId, supplierId, new Date('2026-07-10T00:00:00.000Z'));

    expect(model.findOne).toHaveBeenCalledWith(expect.objectContaining({
      approvalStatus: 'approved',
    }));
  });
});
