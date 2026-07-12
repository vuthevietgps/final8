import { GoogleAdsEvaluationService } from './google-ads-evaluation.service';

describe('GoogleAdsEvaluationService', () => {
  it('compares all required metrics and marks a profitable improvement as success', async () => {
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const enrichedAt = new Date();
    const beforeRows = [{
      costVnd: 100,
      revenue: 200,
      grossProfit: 150,
      netProfit: 100,
      conversions: 10,
      erpEnrichedAt: enrichedAt,
      profitUpdatedAt: enrichedAt,
    }];
    const afterRows = [{
      costVnd: 100,
      revenue: 230,
      grossProfit: 180,
      netProfit: 130,
      conversions: 12,
      erpEnrichedAt: enrichedAt,
      profitUpdatedAt: enrichedAt,
    }];
    const dailyMetricModel = {
      find: jest.fn((filter) => ({
        lean: jest.fn().mockResolvedValue(filter.date.$gte === '2026-06-09' ? beforeRows : afterRows),
      })),
    };
    const readonlySyncService = { sync: jest.fn().mockResolvedValue({ status: 'success' }) };
    const service = new GoogleAdsEvaluationService(
      evaluationModel as any,
      dailyMetricModel as any,
      readonlySyncService as any,
    );
    const job = {
      _id: 'evaluation-1',
      customerId: '1234567890',
      scopeLevel: 'campaign',
      campaignId: '101',
      baselineWindow: { from: '2026-06-09', to: '2026-06-11' },
      evaluationWindow: { from: '2026-06-13', to: '2026-06-15' },
    };

    await (service as any).evaluateJob(job);

    expect(readonlySyncService.sync).toHaveBeenCalledWith({
      customerIds: ['1234567890'],
      dateFrom: '2026-06-09',
      dateTo: '2026-06-15',
    });
    expect(evaluationModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evaluation-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'completed',
          result: 'success',
          beforeMetrics: expect.objectContaining({
            spend: 100,
            revenue: 200,
            grossProfit: 150,
            netProfit: 100,
            conversions: 10,
            CPA: 10,
            ROAS: 2,
            profitPerSpend: 1,
          }),
          afterMetrics: expect.objectContaining({
            netProfit: 130,
            CPA: 100 / 12,
            ROAS: 2.3,
            profitPerSpend: 1.3,
          }),
          delta: expect.objectContaining({
            spend: { absolute: 0, percent: 0 },
            netProfit: { absolute: 30, percent: 30 },
          }),
        }),
      }),
    );
  });

  it('returns insufficient_data when the evaluation resource cannot be resolved', async () => {
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const dailyMetricModel = { find: jest.fn() };
    const service = new GoogleAdsEvaluationService(
      evaluationModel as any,
      dailyMetricModel as any,
      { sync: jest.fn().mockResolvedValue({ status: 'success' }) } as any,
    );

    await (service as any).evaluateJob({
      _id: 'evaluation-2',
      customerId: '1234567890',
      scopeLevel: 'keyword',
      baselineWindow: { from: '2026-06-09', to: '2026-06-11' },
      evaluationWindow: { from: '2026-06-13', to: '2026-06-15' },
    });

    expect(dailyMetricModel.find).not.toHaveBeenCalled();
    expect(evaluationModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evaluation-2' },
      expect.objectContaining({
        $set: expect.objectContaining({ result: 'insufficient_data' }),
      }),
    );
  });

  it('holds evaluation when ERP profit provenance is missing', async () => {
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const rows = [{
      costVnd: 100,
      revenue: 200,
      grossProfit: 150,
      netProfit: 100,
      conversions: 10,
    }];
    const dailyMetricModel = {
      find: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) })),
    };
    const service = new GoogleAdsEvaluationService(
      evaluationModel as any,
      dailyMetricModel as any,
      { sync: jest.fn().mockResolvedValue({ status: 'success', errors: [] }) } as any,
    );

    await (service as any).evaluateJob({
      _id: 'evaluation-profit-missing',
      customerId: '1234567890',
      scopeLevel: 'campaign',
      campaignId: '101',
      baselineWindow: { from: '2026-06-09', to: '2026-06-11' },
      evaluationWindow: { from: '2026-06-13', to: '2026-06-15' },
    });

    expect(evaluationModel.updateOne).toHaveBeenCalledWith(
      { _id: 'evaluation-profit-missing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'completed',
          result: 'insufficient_data',
          insight: expect.stringContaining('profit enrichment is missing or stale'),
          beforeMetrics: expect.objectContaining({ profitDataStatus: 'missing' }),
          afterMetrics: expect.objectContaining({ profitDataStatus: 'missing' }),
        }),
      }),
    );
  });

  it('classifies stale ERP profit enrichment as insufficient data', () => {
    const service = new GoogleAdsEvaluationService({} as any, {} as any, {} as any);
    const staleAt = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const metrics = (service as any).aggregate([{
      costVnd: 100,
      revenue: 200,
      grossProfit: 150,
      netProfit: 100,
      conversions: 10,
      erpEnrichedAt: staleAt,
      profitUpdatedAt: staleAt,
    }]);

    expect(metrics.profitDataStatus).toBe('stale');
    expect((service as any).classify(metrics, metrics)).toEqual({
      result: 'insufficient_data',
      insight: 'ERP profit enrichment is missing or stale; evaluation is on hold.',
    });
  });
});
