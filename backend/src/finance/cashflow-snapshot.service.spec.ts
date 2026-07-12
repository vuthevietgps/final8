import { CashflowSnapshotService } from './cashflow-snapshot.service';

describe('CashflowSnapshotService cache and persistence safety', () => {
  const createService = (overrides: {
    model?: Record<string, jest.Mock>;
    cache?: Record<string, jest.Mock>;
    auditModel?: Record<string, jest.Mock>;
    connection?: Record<string, jest.Mock>;
  } = {}) => {
    const model = {
      findOneAndUpdate: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      ...overrides.model,
    };
    const cache = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      ...overrides.cache,
    };
    const auditModel = {
      create: jest.fn().mockResolvedValue([{}]),
      ...overrides.auditModel,
    };
    const session = {
      withTransaction: jest.fn().mockImplementation(async (work) => work()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      startSession: jest.fn().mockResolvedValue(session),
      ...overrides.connection,
    };
    return {
      service: new CashflowSnapshotService(
        model as any,
        cache as any,
        auditModel as any,
        connection as any,
      ),
      model,
      cache,
      auditModel,
      connection,
      session,
    };
  };

  it('propagates a canonical Mongo write failure', async () => {
    const writeError = new Error('mongo unavailable');
    const { service, cache } = createService({
      model: { findOneAndUpdate: jest.fn().mockRejectedValue(writeError) },
    });

    await expect(service.store('labor', 14, { total: 1 })).rejects.toBe(writeError);
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('keeps a durable snapshot write successful when cache invalidation fails', async () => {
    const { service, cache } = createService({
      cache: { del: jest.fn().mockRejectedValue(new Error('redis unavailable')) },
    });

    await expect(service.store('ops', 14, { total: 1 })).resolves.toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith('fc:snap:ops:14', { total: 1 }, 5 * 60 * 1000);
  });

  it('falls back to Mongo when cache read and cache warm both fail', async () => {
    const data = { totalPayrollDue14d: 100 };
    const findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ data }),
    });
    const { service, model } = createService({
      model: { findOne },
      cache: {
        get: jest.fn().mockRejectedValue(new Error('redis unavailable')),
        set: jest.fn().mockRejectedValue(new Error('redis unavailable')),
      },
    });

    await expect(service.read('labor', 14)).resolves.toEqual(data);
    expect(model.findOne).toHaveBeenCalledWith({ domain: 'labor', windowDays: 14 });
  });

  it('writes the tax snapshot and immutable audit in the same Mongo transaction', async () => {
    const lean = jest.fn().mockResolvedValue({ data: { totalTaxDue: 50 } });
    const sessionQuery = jest.fn().mockReturnValue({ lean });
    const { service, model, auditModel, session, cache } = createService({
      model: { findOne: jest.fn().mockReturnValue({ session: sessionQuery }) },
    });
    const next = { totalTaxDue: 100, updatedBy: 'director-1' };

    await expect(service.storeTaxWithAudit(next, 'director-1')).resolves.toBeUndefined();

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { domain: 'tax', windowDays: -1 },
      expect.objectContaining({ $set: expect.objectContaining({ data: next }) }),
      expect.objectContaining({ session, upsert: true }),
    );
    expect(auditModel.create).toHaveBeenCalledWith([
      expect.objectContaining({
        previousSnapshot: { totalTaxDue: 50 },
        snapshot: next,
        actor: 'director-1',
      }),
    ], { session });
    expect(cache.del).toHaveBeenCalledWith('fc:snap:tax:-1');
  });

  it('fails closed and does not invalidate cache when tax audit persistence fails', async () => {
    const auditError = new Error('audit unavailable');
    const sessionQuery = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    const { service, cache, session } = createService({
      model: { findOne: jest.fn().mockReturnValue({ session: sessionQuery }) },
      auditModel: { create: jest.fn().mockRejectedValue(auditError) },
    });

    await expect(service.storeTaxWithAudit({ totalTaxDue: 100 }, 'director-1'))
      .rejects.toBe(auditError);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(cache.del).not.toHaveBeenCalled();
  });
});
