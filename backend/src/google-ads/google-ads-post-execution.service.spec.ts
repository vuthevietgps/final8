import { GoogleAdsPostExecutionService } from './google-ads-post-execution.service';

describe('GoogleAdsPostExecutionService', () => {
  it('syncs remote state, writes change log, and schedules 3/7 day evaluations', async () => {
    const readonlySyncService = {
      sync: jest.fn().mockResolvedValue({ runId: 'SYNC-1', status: 'success', counts: { campaigns: 1 } }),
    };
    const changeLogModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const campaignModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({
          customerId: '1234567890',
          campaignId: '101',
          campaignBudgetId: '202',
          status: 'PAUSED',
          advertisingChannelType: 'SEARCH',
          biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
          maximizeConversionsTargetCpaMicros: 0,
          targetGoogleSearch: true,
          targetSearchNetwork: false,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
          positiveGeoTargetType: 'PRESENCE',
          containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
          lastSyncAt: new Date('2026-06-12T08:00:01.000Z'),
        }),
      })),
    };
    const neverFind = { findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })) };
    const campaignBudgetModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({
          customerId: '1234567890',
          campaignBudgetId: '202',
          amountVnd: 100000,
          deliveryMethod: 'STANDARD',
          explicitlyShared: false,
          lastSyncAt: new Date('2026-06-12T08:00:01.000Z'),
        }),
      })),
    };
    const service = new GoogleAdsPostExecutionService(
      readonlySyncService as any,
      changeLogModel as any,
      evaluationModel as any,
      campaignModel as any,
      neverFind as any,
      campaignBudgetModel as any,
    );
    const executedAt = new Date('2026-06-12T08:00:00.000Z');
    const action: any = {
      actionId: 'ACT-001',
      idempotencyKey: 'PLAN-001:ACT-001',
      actionType: 'create_search_campaign',
      customerId: '1234567890',
      resourceType: 'campaign',
      reason: 'Create controlled test campaign',
      typedPayload: {
        status: 'PAUSED',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        searchPartnersEnabled: false,
        positiveGeoTargetType: 'PRESENCE',
        dailyBudget: 100000,
      },
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
      readbackVerification: { verified: true, blockers: [] },
      evaluationJobs: expect.arrayContaining([
        expect.objectContaining({ evaluationDays: 3 }),
        expect.objectContaining({ evaluationDays: 7 }),
      ]),
    }));

    const staleResult = await service.handleSuccessfulExecution({
      planId: 'PLAN-002',
      action: {
        ...action,
        actionId: 'ACT-002',
        idempotencyKey: 'PLAN-002:ACT-002',
      },
      executionLog: {
        ...executionLog,
        _id: 'execution-2',
        executedAt: new Date('2026-06-12T08:01:00.000Z'),
      },
    });
    expect(staleResult.readbackVerification).toEqual({
      verified: false,
      blockers: expect.arrayContaining([
        'Campaign canonical readback is older than the live execution.',
        'Campaign budget canonical readback is older than the live execution.',
      ]),
    });
  });

  it('requires exact bidding strategy and target CPA canonical readback', async () => {
    const executedAt = new Date('2026-06-12T08:00:00.000Z');
    const readonlySyncService = {
      sync: jest.fn().mockResolvedValue({ status: 'success', counts: { campaigns: 1 } }),
    };
    const changeLogModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const campaignModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({
          customerId: '1234567890',
          campaignId: '101',
          biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
          maximizeConversionsTargetCpaMicros: 250_000_000_000,
          biddingStrategyResourceName: null,
          lastSyncAt: new Date('2026-06-12T08:00:01.000Z'),
        }),
      })),
    };
    const neverFind = {
      findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
    };
    const service = new GoogleAdsPostExecutionService(
      readonlySyncService as any,
      changeLogModel as any,
      evaluationModel as any,
      campaignModel as any,
      neverFind as any,
    );
    const action: any = {
      actionId: 'ACT-BID-001',
      idempotencyKey: 'PLAN-BID-001:ACT-BID-001',
      actionType: 'update_campaign_bidding_strategy',
      customerId: '1234567890',
      resourceType: 'campaign',
      reason: 'Apply approved target CPA',
      typedPayload: {
        campaignId: '101',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        targetCpaMicros: 250_000_000_000,
      },
    };
    const result = await service.handleSuccessfulExecution({
      planId: 'PLAN-BID-001',
      action,
      executionLog: {
        _id: 'execution-bid-1',
        executedAt,
        afterState: {},
      } as any,
    });
    expect(result.readbackVerification).toEqual({
      verified: true,
      blockers: [],
    });

    campaignModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        customerId: '1234567890',
        campaignId: '101',
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        maximizeConversionsTargetCpaMicros: 200_000_000_000,
        lastSyncAt: new Date('2026-06-12T08:00:01.000Z'),
      }),
    });
    const mismatch = await service.handleSuccessfulExecution({
      planId: 'PLAN-BID-002',
      action: {
        ...action,
        actionId: 'ACT-BID-002',
        idempotencyKey: 'PLAN-BID-002:ACT-BID-002',
      },
      executionLog: {
        _id: 'execution-bid-2',
        executedAt,
        afterState: {},
      } as any,
    });
    expect(mismatch.readbackVerification.blockers).toContain(
      'Campaign bidding target was not confirmed by canonical readback.',
    );
  });

  it('normalizes RSA pin order and confirms resume status through canonical readback', async () => {
    const executedAt = new Date('2026-06-12T08:00:00.000Z');
    const readonlySyncService = {
      sync: jest.fn().mockResolvedValue({ status: 'success', counts: { ads: 1 } }),
    };
    const changeLogModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const evaluationModel = { updateOne: jest.fn().mockResolvedValue({ acknowledged: true }) };
    const neverFind = { findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })) };
    const adModel = {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue({
          customerId: '1234567890',
          campaignId: '101',
          adGroupId: '303',
          adId: '404',
          adType: 'RESPONSIVE_SEARCH_AD',
          status: 'ENABLED',
          headlines: [
            { text: 'Một', pinnedField: 'HEADLINE_1' },
            { text: 'Hai' },
            { text: 'Ba', pinnedField: 'HEADLINE_3' },
          ],
          descriptions: [
            { text: 'Mô tả một' },
            { text: 'Mô tả hai', pinnedField: 'DESCRIPTION_2' },
          ],
          lastSyncAt: new Date('2026-06-12T08:00:01.000Z'),
        }),
      })),
    };
    const service = new GoogleAdsPostExecutionService(
      readonlySyncService as any,
      changeLogModel as any,
      evaluationModel as any,
      neverFind as any,
      neverFind as any,
      undefined,
      undefined,
      adModel as any,
    );
    const baseLog: any = {
      _id: 'execution-rsa',
      executedAt,
      executedBy: 'operator',
      afterState: {},
    };

    const pinReadback = await service.handleSuccessfulExecution({
      planId: 'PLAN-RSA-PINS',
      action: {
        actionId: 'ACT-RSA-PINS',
        idempotencyKey: 'PLAN-RSA-PINS:ACT-RSA-PINS',
        actionType: 'update_responsive_search_ad',
        customerId: '1234567890',
        resourceType: 'ad',
        reason: 'Update approved RSA pins',
        typedPayload: {
          campaignId: '101',
          adGroupId: '303',
          adId: '404',
          headlines: ['Một', 'Hai', 'Ba'],
          headlinePins: [
            { index: 2, pinnedField: 'HEADLINE_3' },
            { index: 0, pinnedField: 'HEADLINE_1' },
          ],
          descriptions: ['Mô tả một', 'Mô tả hai'],
          descriptionPins: [{ index: 1, pinnedField: 'DESCRIPTION_2' }],
        },
      } as any,
      executionLog: baseLog,
    });
    expect(pinReadback.readbackVerification).toEqual({ verified: true, blockers: [] });

    const resumeReadback = await service.handleSuccessfulExecution({
      planId: 'PLAN-RSA-RESUME',
      action: {
        actionId: 'ACT-RSA-RESUME',
        idempotencyKey: 'PLAN-RSA-RESUME:ACT-RSA-RESUME',
        actionType: 'resume_responsive_search_ad',
        customerId: '1234567890',
        resourceType: 'ad',
        reason: 'Resume policy-approved RSA',
        typedPayload: {
          campaignId: '101',
          adGroupId: '303',
          adId: '404',
          adGroupAdResourceName: 'customers/1234567890/adGroupAds/303~404',
        },
      } as any,
      executionLog: { ...baseLog, _id: 'execution-rsa-resume' },
    });
    expect(resumeReadback.readbackVerification).toEqual({ verified: true, blockers: [] });
  });
});
