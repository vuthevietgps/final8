import { ConflictException } from '@nestjs/common';
import { META_ADS_FINANCIAL_CONTROL } from './meta-ads-financial-control.port';
import { MetaAdsFinancialExecutionLeaseService } from './meta-ads-financial-execution-lease.service';

const leanResult = (value: any) => ({
  lean: jest.fn().mockResolvedValue(value),
});

describe('MetaAdsFinancialExecutionLeaseService', () => {
  const leaseModel = {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    collection: {
      indexes: jest.fn().mockResolvedValue([
        { key: { scope: 1 }, unique: true },
      ]),
      createIndex: jest.fn(),
    },
  };
  let service: MetaAdsFinancialExecutionLeaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.META_ADS_FINANCIAL_LEASE_MS;
    leaseModel.updateOne.mockResolvedValue({ modifiedCount: 1 });
    leaseModel.collection.indexes.mockResolvedValue([
      { key: { scope: 1 }, unique: true },
    ]);
    leaseModel.collection.createIndex.mockResolvedValue('scope_1');
    service = new MetaAdsFinancialExecutionLeaseService(leaseModel as any);
  });

  it('exposes an isolated read-only Financial Control injection token', () => {
    expect(typeof META_ADS_FINANCIAL_CONTROL).toBe('symbol');
  });

  it('atomically acquires, renews, and releases the delivery-activation lease', async () => {
    leaseModel.findOneAndUpdate
      .mockImplementationOnce((filter: any, update: any) => leanResult({
        scope: filter.scope,
        status: 'held',
        ownerToken: update.$set.ownerToken,
      }))
      .mockImplementationOnce((filter: any, update: any) => leanResult({
        scope: filter.scope,
        status: 'held',
        ownerToken: filter.ownerToken,
        leaseExpiresAt: update.$set.leaseExpiresAt,
      }));

    const token = await service.acquire();
    await service.renew(token);
    await service.release(token);

    expect(token).toEqual(expect.any(String));
    expect(leaseModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(leaseModel.findOneAndUpdate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        scope: 'meta-ads:vnd:delivery-activation',
      }),
    );
    expect(leaseModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'meta-ads:vnd:delivery-activation',
        ownerToken: token,
        status: 'held',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'released' }),
      }),
    );
  });

  it('fails closed when another execution owns the unique scope', async () => {
    leaseModel.findOneAndUpdate.mockImplementation(() => {
      const error: any = new Error('duplicate scope');
      error.code = 11000;
      throw error;
    });

    await expect(service.acquire()).rejects.toThrow(
      'Another Meta Ads delivery-activation execution is in progress',
    );
    await expect(service.acquire()).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks further mutations if the lease can no longer be renewed', async () => {
    leaseModel.findOneAndUpdate.mockReturnValueOnce(leanResult(null));

    await expect(service.renew('lost-token')).rejects.toThrow(
      'no further provider mutation was attempted',
    );
  });

  it('fails closed when the unique scope index cannot be verified', async () => {
    leaseModel.collection.indexes.mockRejectedValueOnce(
      new Error('index metadata unavailable'),
    );

    await expect(service.acquire()).rejects.toThrow(
      'delivery activation is blocked',
    );
    expect(leaseModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('keeps release cleanup fail-closed when persistence fails', async () => {
    leaseModel.updateOne.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.release('owner-token')).resolves.toBeUndefined();
    expect(leaseModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'meta-ads:vnd:delivery-activation',
        ownerToken: 'owner-token',
      }),
      expect.any(Object),
    );
  });

  it('creates the atomic unique scope index when it is missing', async () => {
    leaseModel.collection.indexes.mockResolvedValueOnce([]);
    leaseModel.findOneAndUpdate.mockImplementationOnce(
      (filter: any, update: any) => leanResult({
        scope: filter.scope,
        ownerToken: update.$set.ownerToken,
      }),
    );

    await service.acquire();

    expect(leaseModel.collection.createIndex).toHaveBeenCalledWith(
      { scope: 1 },
      {
        unique: true,
        name: 'scope_1',
      },
    );
  });
});
