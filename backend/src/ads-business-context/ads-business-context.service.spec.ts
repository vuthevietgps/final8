import { AdsBusinessContextService } from './ads-business-context.service';

describe('AdsBusinessContextService', () => {
  const id = '64b64b64b64b64b64b64b64b';
  const productId = '64b64b64b64b64b64b64b64c';

  it('creates a pending landing page with a server-derived safe domain and actor audit', async () => {
    const landingModel = { create: jest.fn(async (payload) => payload) };
    const service = new AdsBusinessContextService(landingModel as any, {} as any);

    const result: any = await service.createLandingPage({
      url: 'https://Shop.Example.com/offer?token=secret#section',
      productId,
      title: 'Offer',
    }, { id: 'director-1', fullName: 'Director' });

    expect(landingModel.create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example.com/offer',
      domain: 'shop.example.com',
      approvalStatus: 'pending',
      status: 'pending',
      approvedForAds: false,
      createdByUserId: 'director-1',
      createdBy: 'Director',
    }));
    expect(result).not.toHaveProperty('token');
  });

  it('resets approval when commercial landing fields change', async () => {
    const page: any = {
      _id: id,
      url: 'https://example.com/old',
      domain: 'example.com',
      productId,
      title: 'Old offer',
      approvalStatus: 'approved',
      status: 'approved',
      approvedForAds: true,
      approvedBy: 'Director',
      approvedAt: new Date(),
      approvalHistory: [],
      save: jest.fn(async function (this: any) { return this; }),
    };
    const service = new AdsBusinessContextService(
      { findById: jest.fn().mockResolvedValue(page) } as any,
      {} as any,
    );

    await service.updateLandingPage(id, { title: 'New offer' }, { id: 'manager-1', fullName: 'Manager' });

    expect(page).toEqual(expect.objectContaining({
      title: 'New offer',
      approvalStatus: 'pending',
      status: 'pending',
      approvedForAds: false,
      approvedBy: undefined,
      approvedAt: undefined,
      approvalResetAt: expect.any(Date),
    }));
    expect(page.approvalHistory).toEqual([
      expect.objectContaining({ decision: 'reset_to_pending', actorId: 'manager-1' }),
    ]);
  });

  it('requires allowlisted domains and records approval audit', async () => {
    const previous = process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST;
    process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = 'example.com';
    const page: any = {
      _id: id,
      domain: 'shop.example.com',
      approvalStatus: 'pending',
      status: 'pending',
      approvedForAds: false,
      approvalHistory: [],
      save: jest.fn(async function (this: any) { return this; }),
    };
    const service = new AdsBusinessContextService(
      { findById: jest.fn().mockResolvedValue(page) } as any,
      {} as any,
    );

    try {
      await service.approveLandingPage(id, { id: 'director-1', fullName: 'Director' });
      expect(page).toEqual(expect.objectContaining({
        approvalStatus: 'approved',
        status: 'approved',
        approvedForAds: true,
        approvedByUserId: 'director-1',
        approvedBy: 'Director',
        approvedAt: expect.any(Date),
      }));
      expect(page.approvalHistory).toEqual([
        expect.objectContaining({ decision: 'approved', actorId: 'director-1' }),
      ]);
    } finally {
      if (previous === undefined) delete process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST;
      else process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = previous;
    }
  });

  it('stores daily note business context and actor audit in the exporter collection shape', async () => {
    const dailyModel = { create: jest.fn(async (payload) => payload) };
    const service = new AdsBusinessContextService({} as any, dailyModel as any);

    await service.createDailyNote({
      date: '2026-07-10',
      summary: 'Demand increased',
      notes: 'Monitor fulfillment',
      anomalies: ['COD delayed', 'COD delayed', 'Inventory count changed'],
      source: 'operations',
      affectedAdGroupId: '30',
      severity: 'warning',
    }, { id: 'manager-1', fullName: 'Manager' });

    expect(dailyModel.create).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-07-10',
      summary: 'Demand increased',
      notes: 'Monitor fulfillment',
      anomalies: ['COD delayed', 'Inventory count changed'],
      source: 'operations',
      affectedAdGroupId: '30',
      severity: 'warning',
      createdByUserId: 'manager-1',
      updatedByUserId: 'manager-1',
    }));
  });
});
