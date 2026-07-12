import { AdvertisingCostGoogleSyncService } from './advertising-cost.google-sync.service';

describe('AdvertisingCostGoogleSyncService Google metrics', () => {
  const createService = () => {
    const costModel = { updateOne: jest.fn() };
    const service = new AdvertisingCostGoogleSyncService(
      costModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service: service as any, costModel };
  };

  it('requests dedicated conversion metrics', () => {
    const { service } = createService();

    const query = service.buildGaql(['123'], '2026-06-11');

    expect(query).toContain('metrics.conversions');
    expect(query).toContain('metrics.all_conversions');
    expect(query).toContain('metrics.conversions_value');
    expect(query).toContain('metrics.cost_per_conversion');
  });

  it('does not store conversions as messaging metrics', async () => {
    const { service, costModel } = createService();

    await service.upsertCost('456', '123', new Date('2026-06-11T00:00:00.000Z'), {
      conversions: 2,
      allConversions: 3,
      conversionValue: 400,
      costPerConversion: 5,
    });

    const payload = costModel.updateOne.mock.calls[0][1].$set;
    expect(payload).toEqual(expect.objectContaining({
      conversions: 2,
      allConversions: 3,
      conversionValue: 400,
      costPerConversion: 5,
    }));
    expect(payload).not.toHaveProperty('messagingConversationStarted7d');
    expect(payload).not.toHaveProperty('costPerMessagingConversation');
  });
});
