import { ConflictException } from '@nestjs/common';
import { GoogleAdsFinancialExecutionLeaseService } from './google-ads-financial-execution-lease.service';

const leanResult = (value: any) => ({ lean: jest.fn().mockResolvedValue(value) });

describe('GoogleAdsFinancialExecutionLeaseService', () => {
  const leaseModel = {
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    collection: {
      indexes: jest.fn().mockResolvedValue([{ key: { scope: 1 }, unique: true }]),
      createIndex: jest.fn(),
    },
  };
  let service: GoogleAdsFinancialExecutionLeaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    leaseModel.collection.indexes.mockResolvedValue([{ key: { scope: 1 }, unique: true }]);
    service = new GoogleAdsFinancialExecutionLeaseService(leaseModel as any);
    delete process.env.GOOGLE_ADS_FINANCIAL_LEASE_MS;
  });

  it('atomically acquires, renews, and releases the global spend lease', async () => {
    leaseModel.findOneAndUpdate
      .mockImplementationOnce((_filter: any, update: any) => leanResult({
        scope: 'google-ads:vnd:spend-increase',
        status: 'held',
        ownerToken: update.$set.ownerToken,
      }))
      .mockImplementationOnce((_filter: any, update: any) => leanResult({
        scope: 'google-ads:vnd:spend-increase',
        status: 'held',
        ownerToken: _filter.ownerToken,
        leaseExpiresAt: update.$set.leaseExpiresAt,
      }));

    const token = await service.acquire();
    await service.renew(token);
    await service.release(token);

    expect(token).toEqual(expect.any(String));
    expect(leaseModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(leaseModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ ownerToken: token, status: 'held' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'released' }) }),
    );
  });

  it('fails closed when another execution owns the lease', async () => {
    leaseModel.findOneAndUpdate.mockImplementationOnce(() => {
      const error: any = new Error('duplicate scope');
      error.code = 11000;
      throw error;
    });

    await expect(service.acquire()).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks further mutations if the lease can no longer be renewed', async () => {
    leaseModel.findOneAndUpdate.mockReturnValueOnce(leanResult(null));

    await expect(service.renew('lost-token')).rejects.toThrow(
      'no further provider mutation was attempted',
    );
  });
});
