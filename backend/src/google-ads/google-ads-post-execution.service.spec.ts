import { GoogleAdsPostExecutionService } from './google-ads-post-execution.service';

describe('GoogleAdsPostExecutionService', () => {
  it('syncs remote state, writes change log, and schedules 3/7 day evaluations', async () => {
    const readonlySyncService = {
      sync: jest.fn().mockResolvedValue({ runId: 'SYNC-1', status: 'success', counts: { campaigns: 1 } }),
    };
    const changeLogModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const neverFind = { findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })) };
    const service = new GoogleAdsPostExecutionService(
      readonlySyncService as any,
      changeLogModel as any,
      evaluationModel as any,
      neverFind as any,
      neverFind as any,
    );
    const executedAt = new Date('2026-06-12T08:00:00.000Z');
    const action: any = {
      actionId: 'ACT-001',
      idempotencyKey: 'PLAN-001:ACT-001',
      actionType: 'create_search_campaign',
      customerId: '1234567890',
      resourceType: 'campaign',
      reason: 'Create controlled test campaign',
      typedPayload: { status: 'PAUSED' },
      approvedBy: 'director',
    };
    const executionLog: any = {
      _id: 'execution-1',
      executedAt,
      executedBy: 'operator',
      providerRequestId: 'request-1',
      beforeState: undefined,
      afterState: {
        mutateOperationResponses: [{
          campaignResult: { resourceName: 'customers/1234567890/campaigns/101' },
          campaignBudgetResult: { resourceName: 'customers/1234567890/campaignBudgets/202' },
        }],
      },
    };

    const result = await service.handleSuccessfulExecution({
      planId: 'PLAN-001',
      action,
      executionLog,
    });

    expect(readonlySyncService.sync).toHaveBeenCalledWith({ customerIds: ['1234567890'] });
    expect(changeLogModel.updateOne).toHaveBeenCalledWith(
      { idempotencyKey: 'PLAN-001:ACT-001' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          campaignId: '101',
          campaignBudgetId: '202',
          evaluationDueAt: [
            new Date('2026-06-15T08:00:00.000Z'),
            new Date('2026-06-19T08:00:00.000Z'),
          ],
        }),
      }),
      { upsert: true },
    );
    expect(evaluationModel.updateOne).toHaveBeenCalledTimes(2);
    expect(evaluationModel.updateOne).toHaveBeenNthCalledWith(
      1,
      { idempotencyKey: 'PLAN-001:ACT-001', evaluationDays: 3 },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          scopeLevel: 'campaign',
          campaignId: '101',
          baselineWindow: { from: '2026-06-09', to: '2026-06-11' },
          evaluationWindow: { from: '2026-06-13', to: '2026-06-15' },
        }),
      }),
      { upsert: true },
    );
    expect(result).toEqual(expect.objectContaining({
      resourceRefs: { campaignId: '101', campaignBudgetId: '202' },
      evaluationJobs: expect.arrayContaining([
        expect.objectContaining({ evaluationDays: 3 }),
        expect.objectContaining({ evaluationDays: 7 }),
      ]),
    }));
  });
});

