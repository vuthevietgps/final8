import { BadRequestException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationDecisionDraftApprovalQueueService } from './ads-automation-decision-draft-approval-queue.service';
import type {
  AdsAutomationDecisionDraftApprovalReadModelQuery,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './contracts/ads-automation-decision-draft-preview.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from './source-sync/source-sync-result.types';

const evidenceWindow = { from: '2026-06-21', to: '2026-07-04', days: 14 };

function budgetDraft(overrides: Partial<AdsAutomationDecisionDraftPreview> = {}): AdsAutomationDecisionDraftPreview {
  return {
    draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    source_decision_type: 'scale_amount',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    platform: 'google',
    accountId: '1234567890',
    productId: 'P_SCALE',
    supplierId: null,
    status: 'pending_approval_preview',
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: true,
    future_provider_validateOnly_required: true,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    persistence_used: false,
    typedPayload: {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
      currentBudgetVnd: 1000000,
      increasePercent: 20,
    },
    source_evidence_references: [{
      decision_id: 'DEC-scale_amount-2001',
      decision_type: 'scale_amount',
      evidence_window: evidenceWindow,
      evidence_metrics: { orders: 12, netProfitAfterAdsVnd: 700000 },
      rationale: 'Profitable Google ad group can scale within ERP cash policy.',
      idempotency_key: 'ads-decision:2026-07-04:scale_amount:2001',
      rollback_plan: 'Restore previous campaign budget.',
    }],
    blockers: [],
    missing_data_blockers: [],
    disallowed_actions: ['delete_product', 'provider_delete', 'auto_publish'],
    idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001',
    rationale: 'Budget increase is capped by ERP policy and still requires approval.',
    ...overrides,
  };
}

function supplierDraft(overrides: Partial<AdsAutomationDecisionDraftPreview> = {}): AdsAutomationDecisionDraftPreview {
  return {
    ...budgetDraft({
      draft_id: 'ADSDRAFT-20260704-supplier_sourcing-SUP_SAFE',
      source_decision_id: 'DEC-supplier_gate-SUP_SAFE',
      source_decision_type: 'supplier_gate',
      action_type: 'supplier_sourcing',
      action_family: 'internal_task',
      provider: 'erp_internal',
      resource_type: 'supplier',
      entity_type: 'supplier',
      entity_id: 'SUP_SAFE',
      platform: null,
      accountId: null,
      productId: 'P_SCALE',
      supplierId: 'SUP_SAFE',
      validate_only_required: false,
      future_provider_validateOnly_required: false,
      typedPayload: {
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        supplierFitScore: 42,
      },
      source_evidence_references: [{
        decision_id: 'DEC-supplier_gate-SUP_SAFE',
        decision_type: 'supplier_gate',
        evidence_window: evidenceWindow,
        evidence_metrics: { leadTimeDays: 8, lateDeliveryRatePercent: 14 },
        rationale: 'Supplier needs sourcing review before more ad scale.',
        idempotency_key: 'ads-decision:2026-07-04:supplier_gate:SUP_SAFE',
        rollback_plan: null,
      }],
      idempotency_key: 'ads-draft:2026-07-04:supplier_sourcing:SUP_SAFE',
      rationale: 'ERP internal supplier sourcing task only.',
    }),
    ...overrides,
  };
}

function sourceSyncDecisionEvidence(canUseGoogleAds = true): SourceSyncDecisionEvidence[] {
  return [
    {
      sourceKey: 'google_ads',
      reportDate: '2026-07-04',
      freshnessStatus: canUseGoogleAds ? 'fresh' : 'stale',
      coverageStatus: 'covered',
      lastSuccessfulSyncAt: canUseGoogleAds ? '2026-07-04T04:00:00.000Z' : '2026-07-03T20:00:00.000Z',
      latestRecordDate: '2026-07-04',
      blockingReason: canUseGoogleAds ? null : 'google_ads_not_ready_for_ads_automation_decision',
      blockingReasons: canUseGoogleAds
        ? []
        : ['freshness_stale', 'google_ads_not_ready_for_ads_automation_decision'],
      canUseForAdsAutomationDecision: canUseGoogleAds,
    },
    {
      sourceKey: 'advertising_costs',
      reportDate: '2026-07-04',
      freshnessStatus: 'fresh',
      coverageStatus: 'covered',
      lastSuccessfulSyncAt: null,
      latestRecordDate: '2026-07-04',
      blockingReason: null,
      blockingReasons: [],
      canUseForAdsAutomationDecision: true,
    },
    {
      sourceKey: 'product_mapping',
      reportDate: '2026-07-04',
      freshnessStatus: 'fresh',
      coverageStatus: 'not_applicable',
      lastSuccessfulSyncAt: null,
      latestRecordDate: null,
      blockingReason: null,
      blockingReasons: [],
      canUseForAdsAutomationDecision: true,
    },
    {
      sourceKey: 'inventory_profit',
      reportDate: '2026-07-04',
      freshnessStatus: 'fresh',
      coverageStatus: 'covered',
      lastSuccessfulSyncAt: '2026-07-04T04:00:00.000Z',
      latestRecordDate: '2026-07-04',
      blockingReason: null,
      blockingReasons: [],
      canUseForAdsAutomationDecision: true,
    },
    {
      sourceKey: 'supplier_safety',
      reportDate: '2026-07-04',
      freshnessStatus: 'fresh',
      coverageStatus: 'covered',
      lastSuccessfulSyncAt: '2026-07-04T04:00:00.000Z',
      latestRecordDate: '2026-07-04',
      blockingReason: null,
      blockingReasons: [],
      canUseForAdsAutomationDecision: true,
    },
  ];
}

function sourceSyncDecisionGates(canGenerateActionDraft = true): Partial<SourceSyncDecisionGates> {
  return {
    canRecommendAdsScale: canGenerateActionDraft,
    canConcludeProfitStrongly: false,
    canEvaluateSalesToday: false,
    canEvaluateFinanceStrongly: false,
    canUseLtvStrongly: false,
    canGenerateActionDraft,
    canUseGoogleAdsDataClaim: canGenerateActionDraft,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
  };
}

function preview(
  drafts: AdsAutomationDecisionDraftPreview[],
  overrides: Partial<AdsAutomationDecisionDraftPreviewResponse> = {},
): AdsAutomationDecisionDraftPreviewResponse {
  return {
    schemaVersion: 'ads_automation_decision_draft_preview.v1',
    generatedAt: '2026-07-04T05:00:00.000Z',
    source: 'decision_snapshot',
    safety: {
      read_only: true,
      dry_run: true,
      persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_drafts: true,
      execution_allowed_now: false,
      future_provider_validateOnly_required: true,
    },
    sourceEvidence: [],
    sourceSyncDecisionEvidence: sourceSyncDecisionEvidence(),
    sourceSyncDecisionGates: sourceSyncDecisionGates(),
    missingFieldEvidence: [],
    queryEvidence: [],
    snapshot: {
      schemaVersion: 'ads_automation_decision_snapshot.v1',
      generatedAt: '2026-07-04T05:00:00.000Z',
      snapshotDate: '2026-07-04',
      summary: {
        categories: 7,
        decisions: drafts.length,
        scale_candidates: 1,
        pause_candidates: 0,
        product_scale_candidates: 0,
        supplier_safe_candidates: 1,
        insufficient_data_decisions: 0,
      },
    },
    summary: {
      decisions_scanned: drafts.length,
      drafts_created: drafts.length,
      blocked_drafts: 0,
      provider_action_drafts: drafts.filter((draft) => draft.action_family === 'provider_google_ads').length,
      internal_task_drafts: drafts.filter((draft) => draft.action_family === 'internal_task').length,
      monitoring_drafts: drafts.filter((draft) => draft.action_family === 'monitoring').length,
    },
    drafts,
    ...overrides,
  };
}

function createRepositoryMock() {
  const recordsByApprovalId = new Map<string, AdsAutomationDecisionDraftPendingApprovalRecord>();
  const repository = {
    findExistingIdempotencyKeys: jest.fn(async (idempotencyKeys: string[]) => {
      const existing = new Set<string>();
      for (const key of idempotencyKeys) {
        if (Array.from(recordsByApprovalId.values()).some((record) => record.idempotency_key === key)) {
          existing.add(key);
        }
      }
      return existing;
    }),
    createMany: jest.fn(async (records: AdsAutomationDecisionDraftPendingApprovalRecord[]) => {
      for (const record of records) {
        recordsByApprovalId.set(record.approval_id, record);
      }
      return records;
    }),
    listPendingApprovals: jest.fn(async (query: AdsAutomationDecisionDraftApprovalReadModelQuery) => (
      Array.from(recordsByApprovalId.values()).filter((record) => matchesQuery(record, query))
    )),
    countPendingApprovals: jest.fn(async () => (
      Array.from(recordsByApprovalId.values()).filter((record) => record.status === 'pending_approval').length
    )),
    findByApprovalId: jest.fn(async (approvalId: string) => recordsByApprovalId.get(approvalId) || null),
  };

  return repository as unknown as jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
}

function matchesQuery(
  record: AdsAutomationDecisionDraftPendingApprovalRecord,
  query: AdsAutomationDecisionDraftApprovalReadModelQuery,
): boolean {
  return (
    (!query.status || record.status === query.status)
    && (!query.action_type || record.action_type === query.action_type)
    && (!query.action_family || record.action_family === query.action_family)
    && (!query.provider || record.provider === query.provider)
    && (!query.accountId || record.accountId === query.accountId)
    && (!query.productId || record.productId === query.productId)
    && (!query.supplierId || record.supplierId === query.supplierId)
  );
}

describe('AdsAutomationDecisionDraftApprovalQueueService', () => {
  let repository: jest.Mocked<AdsAutomationDecisionDraftApprovalRepository>;
  let service: AdsAutomationDecisionDraftApprovalQueueService;

  beforeEach(() => {
    repository = createRepositoryMock();
    service = new AdsAutomationDecisionDraftApprovalQueueService(repository);
  });

  it('imports valid draft previews into durable pending approval records without provider calls', async () => {
    const response = await service.importPreview(preview([
      budgetDraft(),
      supplierDraft(),
    ]));

    expect(repository.findExistingIdempotencyKeys).toHaveBeenCalledWith([
      'ads-draft:2026-07-04:update_campaign_budget:2001',
      'ads-draft:2026-07-04:supplier_sourcing:SUP_SAFE',
    ]);
    expect(repository.createMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001',
        storage: 'erp_local_mongo',
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
      }),
    ]));
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_import.v1');
    expect(response.summary).toEqual(expect.objectContaining({
      previews_received: 2,
      pending_approvals_created: 2,
      provider_action_approvals: 1,
      internal_task_approvals: 1,
      monitoring_approvals: 0,
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      dry_run: true,
      in_memory_only: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_records: true,
      execution_allowed_now: false,
    }));
    expect(response.pendingApprovals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        status: 'pending_approval',
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: true,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        persistence_used: true,
        durable_storage_used: true,
        typedPayload: expect.objectContaining({
          campaignBudgetId: '3001',
          dailyBudget: 1200000,
        }),
      }),
      expect.objectContaining({
        action_type: 'supplier_sourcing',
        provider: 'erp_internal',
        status: 'pending_approval',
        validate_only_required: false,
        typedPayload: expect.objectContaining({
          productId: 'P_SCALE',
          supplierId: 'SUP_SAFE',
        }),
      }),
    ]));
  });

  it('rejects stale read-only import-derived draft previews before creating pending approval records', async () => {
    const blockedPreview = preview([budgetDraft({
      blockers: [
        'source_sync_gate_blocked_action_draft',
        'freshness_stale',
        'google_ads_not_ready_for_ads_automation_decision',
      ],
      missing_data_blockers: [
        'source_sync_gate_blocked_action_draft',
      ],
    })], {
      source: 'mongo_read_model',
      sourceSyncDecisionEvidence: sourceSyncDecisionEvidence(false),
      sourceSyncDecisionGates: sourceSyncDecisionGates(false),
    });

    await expect(service.importPreview(blockedPreview)).rejects.toThrow(
      /source-sync gate does not allow pending approval import: .*freshness_stale/,
    );
    await expect(service.importPreview(blockedPreview)).rejects.toThrow(
      /google_ads_not_ready_for_ads_automation_decision/,
    );
    expect(repository.findExistingIdempotencyKeys).not.toHaveBeenCalled();
    expect(repository.createMany).not.toHaveBeenCalled();

    const list = await service.listPendingApprovals();
    expect(list.summary).toEqual(expect.objectContaining({
      total_pending_approvals: 0,
      pending_approvals_listed: 0,
      provider_action_approvals: 0,
    }));
    expect(list.pendingApprovals).toEqual([]);
    expect(list.safety).toEqual(expect.objectContaining({
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(blockedPreview.safety).toEqual(expect.objectContaining({
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(blockedPreview.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        freshnessStatus: 'stale',
        blockingReasons: expect.arrayContaining([
          'freshness_stale',
          'google_ads_not_ready_for_ads_automation_decision',
        ]),
        canUseForAdsAutomationDecision: false,
      }),
    ]));
    expect(blockedPreview.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: false,
      canUseGoogleAdsDataClaim: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    }));
    expect(blockedPreview.drafts[0]).toEqual(expect.objectContaining({
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      blockers: expect.arrayContaining([
        'source_sync_gate_blocked_action_draft',
        'freshness_stale',
        'google_ads_not_ready_for_ads_automation_decision',
      ]),
    }));
  });

  it('preserves imported source-sync evidence and gates through pending approval readback and readiness blockers', async () => {
    const imported = await service.importPreview(preview([budgetDraft()], {
      source: 'mongo_read_model',
      sourceSyncDecisionEvidence: sourceSyncDecisionEvidence(false),
      sourceSyncDecisionGates: {
        ...sourceSyncDecisionGates(true),
        canRecommendAdsScale: false,
        canUseGoogleAdsDataClaim: false,
      },
    }));
    const approvalId = imported.pendingApprovals[0].approval_id;

    expect(repository.createMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        sourceSyncDecisionEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: 'google_ads',
            freshnessStatus: 'stale',
            blockingReasons: expect.arrayContaining([
              'freshness_stale',
              'google_ads_not_ready_for_ads_automation_decision',
            ]),
            canUseForAdsAutomationDecision: false,
          }),
        ]),
        sourceSyncDecisionGates: expect.objectContaining({
          canGenerateActionDraft: true,
          canRecommendAdsScale: false,
          canUseGoogleAdsDataClaim: false,
          canImportActionFile: false,
          canDryRun: false,
          canExecuteLive: false,
        }),
      }),
    ]));

    const list = await service.listPendingApprovals({ provider: 'google' });
    expect(list.pendingApprovals).toEqual([
      expect.objectContaining({
        approval_id: approvalId,
        sourceSyncDecisionEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: 'google_ads',
            blockingReason: 'google_ads_not_ready_for_ads_automation_decision',
          }),
        ]),
        sourceSyncDecisionGates: expect.objectContaining({
          canGenerateActionDraft: true,
          canRecommendAdsScale: false,
          canUseGoogleAdsDataClaim: false,
        }),
      }),
    ]);

    const single = await service.readPendingApproval(approvalId);
    expect(single.pendingApproval.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        reportDate: '2026-07-04',
        freshnessStatus: 'stale',
        canUseForAdsAutomationDecision: false,
      }),
    ]));
    expect(single.pendingApproval.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: true,
      canRecommendAdsScale: false,
      canUseGoogleAdsDataClaim: false,
    }));

    const readiness = await service.reviewPendingApprovalReadiness(approvalId);
    expect(readiness.summary).toEqual(expect.objectContaining({
      readiness_status: 'blocked',
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_review',
    }));
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'source_sync_gate_blocked_ads_scale_recommendation',
      'source_sync_gate_blocked_google_ads_data_claim',
      'freshness_stale',
      'google_ads_not_ready_for_ads_automation_decision',
      'source_sync_decision_evidence',
    ]));
    expect(readiness.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'source_sync_decision_evidence',
        status: 'blocked',
      }),
    ]));
    expect(readiness.pendingApproval).toEqual(expect.objectContaining({
      approval_id: approvalId,
      sourceSyncDecisionEvidence: expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'google_ads',
          blockingReason: 'google_ads_not_ready_for_ads_automation_decision',
        }),
      ]),
      sourceSyncDecisionGates: expect.objectContaining({
        canGenerateActionDraft: true,
        canRecommendAdsScale: false,
      }),
    }));
  });

  for (const scenario of [
    {
      gateName: 'canRecommendAdsScale',
      gates: {
        ...sourceSyncDecisionGates(true),
        canGenerateActionDraft: true,
        canRecommendAdsScale: false,
        canUseGoogleAdsDataClaim: true,
      },
      blocker: 'source_sync_gate_blocked_ads_scale_recommendation',
      otherGateBlockers: [
        'source_sync_gate_blocked_action_draft',
        'source_sync_gate_blocked_google_ads_data_claim',
      ],
      requestId: 'REQ-SOURCE-SYNC-ADS-SCALE-RECOMMENDATION-GATE-BLOCKED',
    },
    {
      gateName: 'canUseGoogleAdsDataClaim',
      gates: {
        ...sourceSyncDecisionGates(true),
        canGenerateActionDraft: true,
        canRecommendAdsScale: true,
        canUseGoogleAdsDataClaim: false,
      },
      blocker: 'source_sync_gate_blocked_google_ads_data_claim',
      otherGateBlockers: [
        'source_sync_gate_blocked_action_draft',
        'source_sync_gate_blocked_ads_scale_recommendation',
      ],
      requestId: 'REQ-SOURCE-SYNC-GOOGLE-ADS-CLAIM-GATE-BLOCKED',
    },
  ] as const) {
    it(`blocks budget approval readiness and approve validation when ${scenario.gateName} gate blocks despite complete source evidence`, async () => {
      const imported = await service.importPreview(preview([budgetDraft()], {
        source: 'mongo_read_model',
        sourceSyncDecisionEvidence: sourceSyncDecisionEvidence(),
        sourceSyncDecisionGates: scenario.gates,
      }));
      const approvalId = imported.pendingApprovals[0].approval_id;

      const readiness = await service.reviewPendingApprovalReadiness(approvalId);

      expect(readiness.summary).toEqual(expect.objectContaining({
        readiness_status: 'blocked',
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: 'fix_blockers_before_review',
      }));
      expect(readiness.blockers).toEqual(expect.arrayContaining([
        scenario.blocker,
        'source_sync_decision_evidence',
      ]));
      for (const otherGateBlocker of scenario.otherGateBlockers) {
        expect(readiness.blockers).not.toContain(otherGateBlocker);
      }
      expect(readiness.blockers).not.toContain('inventory_profit_source_coverage_missing');
      expect(readiness.blockers).not.toContain('supplier_safety_source_coverage_missing');
      expect(readiness.blockers).not.toContain('inventory_profit_not_ready_for_ads_automation_decision');
      expect(readiness.blockers).not.toContain('supplier_safety_not_ready_for_ads_automation_decision');
      expect(readiness.prerequisites).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'source_sync_decision_evidence',
          status: 'blocked',
        }),
      ]));
      expect(readiness.pendingApproval.sourceSyncDecisionEvidence.map((item) => item.sourceKey)).toEqual([
        'google_ads',
        'advertising_costs',
        'product_mapping',
        'inventory_profit',
        'supplier_safety',
      ]);
      expect(readiness.pendingApproval.sourceSyncDecisionGates).toEqual(expect.objectContaining(scenario.gates));

      const decisionValidation = await service.validatePendingApprovalDecision(approvalId, {
        decision: 'approve',
        reviewerUserId: 'director-1',
        reviewerRole: 'director',
        reason: 'Human reviewed the ERP evidence and source-sync gate status.',
        requestId: scenario.requestId,
      });

      expect(decisionValidation.summary).toEqual(expect.objectContaining({
        validation_status: 'blocked',
        proposed_decision: 'approve',
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: 'fix_blockers_before_decision',
      }));
      expect(decisionValidation.blockers).toEqual(expect.arrayContaining([
        scenario.blocker,
        'source_sync_decision_evidence',
      ]));
      for (const otherGateBlocker of scenario.otherGateBlockers) {
        expect(decisionValidation.blockers).not.toContain(otherGateBlocker);
      }
      expect(decisionValidation.blockers).not.toContain('inventory_profit_source_coverage_missing');
      expect(decisionValidation.blockers).not.toContain('supplier_safety_source_coverage_missing');
      expect(decisionValidation.pendingApproval.status).toBe('pending_approval');
    });
  }

  it('blocks budget approval readiness and approve validation when product and supplier source coverage is missing', async () => {
    const incompleteProductSupplierCoverage = sourceSyncDecisionEvidence()
      .filter((evidence) => !['inventory_profit', 'supplier_safety'].includes(evidence.sourceKey));
    const imported = await service.importPreview(preview([budgetDraft()], {
      source: 'mongo_read_model',
      sourceSyncDecisionEvidence: incompleteProductSupplierCoverage,
      sourceSyncDecisionGates: sourceSyncDecisionGates(true),
    }));
    const approvalId = imported.pendingApprovals[0].approval_id;

    const readiness = await service.reviewPendingApprovalReadiness(approvalId);

    expect(readiness.summary).toEqual(expect.objectContaining({
      readiness_status: 'blocked',
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_review',
    }));
    expect(readiness.blockers).toEqual(expect.arrayContaining([
      'inventory_profit_source_coverage_missing',
      'supplier_safety_source_coverage_missing',
      'source_sync_decision_evidence',
    ]));
    expect(readiness.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'source_sync_decision_evidence',
        status: 'blocked',
      }),
    ]));
    expect(readiness.pendingApproval.sourceSyncDecisionEvidence.map((item) => item.sourceKey)).toEqual([
      'google_ads',
      'advertising_costs',
      'product_mapping',
    ]);

    const decisionValidation = await service.validatePendingApprovalDecision(approvalId, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Human reviewed the ERP evidence and budget cap.',
      requestId: 'REQ-MISSING-PRODUCT-SUPPLIER-COVERAGE',
    });

    expect(decisionValidation.summary).toEqual(expect.objectContaining({
      validation_status: 'blocked',
      proposed_decision: 'approve',
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_decision',
    }));
    expect(decisionValidation.blockers).toEqual(expect.arrayContaining([
      'inventory_profit_source_coverage_missing',
      'supplier_safety_source_coverage_missing',
      'source_sync_decision_evidence',
    ]));
    expect(decisionValidation.pendingApproval.status).toBe('pending_approval');
  });

  for (const scenario of [
    {
      sourceKey: 'inventory_profit',
      blocker: 'inventory_profit_source_coverage_missing',
      otherBlocker: 'supplier_safety_source_coverage_missing',
      requestId: 'REQ-MISSING-INVENTORY-PROFIT-COVERAGE',
    },
    {
      sourceKey: 'supplier_safety',
      blocker: 'supplier_safety_source_coverage_missing',
      otherBlocker: 'inventory_profit_source_coverage_missing',
      requestId: 'REQ-MISSING-SUPPLIER-SAFETY-COVERAGE',
    },
  ] as const) {
    it(`blocks budget approval readiness and approve validation when ${scenario.sourceKey} source coverage is missing`, async () => {
      const incompleteCoverage = sourceSyncDecisionEvidence()
        .filter((evidence) => evidence.sourceKey !== scenario.sourceKey);
      const imported = await service.importPreview(preview([budgetDraft()], {
        source: 'mongo_read_model',
        sourceSyncDecisionEvidence: incompleteCoverage,
        sourceSyncDecisionGates: sourceSyncDecisionGates(true),
      }));
      const approvalId = imported.pendingApprovals[0].approval_id;

      const readiness = await service.reviewPendingApprovalReadiness(approvalId);

      expect(readiness.summary).toEqual(expect.objectContaining({
        readiness_status: 'blocked',
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: 'fix_blockers_before_review',
      }));
      expect(readiness.blockers).toEqual(expect.arrayContaining([
        scenario.blocker,
        'source_sync_decision_evidence',
      ]));
      expect(readiness.blockers).not.toContain(scenario.otherBlocker);
      expect(readiness.prerequisites).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: 'source_sync_decision_evidence',
          status: 'blocked',
        }),
      ]));

      const decisionValidation = await service.validatePendingApprovalDecision(approvalId, {
        decision: 'approve',
        reviewerUserId: 'director-1',
        reviewerRole: 'director',
        reason: 'Human reviewed the ERP evidence and budget cap.',
        requestId: scenario.requestId,
      });

      expect(decisionValidation.summary).toEqual(expect.objectContaining({
        validation_status: 'blocked',
        proposed_decision: 'approve',
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: 'fix_blockers_before_decision',
      }));
      expect(decisionValidation.blockers).toEqual(expect.arrayContaining([
        scenario.blocker,
        'source_sync_decision_evidence',
      ]));
      expect(decisionValidation.blockers).not.toContain(scenario.otherBlocker);
      expect(decisionValidation.pendingApproval.status).toBe('pending_approval');
    });
  }

  for (const scenario of [
    {
      sourceKey: 'inventory_profit',
      blocker: 'inventory_profit_not_ready_for_ads_automation_decision',
      coverageBlocker: 'inventory_profit_source_coverage_missing',
      otherReadyBlocker: 'supplier_safety_not_ready_for_ads_automation_decision',
      blockingReason: 'inventory_profit_below_cashflow_safety_floor',
      requestId: 'REQ-INVENTORY-PROFIT-NOT-READY',
    },
    {
      sourceKey: 'supplier_safety',
      blocker: 'supplier_safety_not_ready_for_ads_automation_decision',
      coverageBlocker: 'supplier_safety_source_coverage_missing',
      otherReadyBlocker: 'inventory_profit_not_ready_for_ads_automation_decision',
      blockingReason: 'supplier_reliability_below_scale_threshold',
      requestId: 'REQ-SUPPLIER-SAFETY-NOT-READY',
    },
  ] as const) {
    it(`blocks budget approval readiness and approve validation when ${scenario.sourceKey} source evidence is not ready`, async () => {
      const notReadyCoverage = sourceSyncDecisionEvidence().map((evidence) => {
        if (evidence.sourceKey !== scenario.sourceKey) return evidence;

        return {
          ...evidence,
          freshnessStatus: 'stale' as const,
          coverageStatus: 'covered' as const,
          lastSuccessfulSyncAt: '2026-07-03T04:00:00.000Z',
          blockingReason: scenario.blockingReason,
          blockingReasons: ['freshness_stale', scenario.blockingReason],
          canUseForAdsAutomationDecision: false,
        };
      });
      const imported = await service.importPreview(preview([budgetDraft()], {
        source: 'mongo_read_model',
        sourceSyncDecisionEvidence: notReadyCoverage,
        sourceSyncDecisionGates: sourceSyncDecisionGates(true),
      }));
      const approvalId = imported.pendingApprovals[0].approval_id;

      const readiness = await service.reviewPendingApprovalReadiness(approvalId);

      expect(readiness.summary).toEqual(expect.objectContaining({
        readiness_status: 'blocked',
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: 'fix_blockers_before_review',
      }));
      expect(readiness.blockers).toEqual(expect.arrayContaining([
        scenario.blocker,
        scenario.blockingReason,
        'source_sync_decision_evidence',
      ]));
      expect(readiness.blockers).not.toContain(scenario.coverageBlocker);
      expect(readiness.blockers).not.toContain(scenario.otherReadyBlocker);
      expect(readiness.pendingApproval.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceKey: scenario.sourceKey,
          freshnessStatus: 'stale',
          coverageStatus: 'covered',
          blockingReason: scenario.blockingReason,
          blockingReasons: ['freshness_stale', scenario.blockingReason],
          canUseForAdsAutomationDecision: false,
        }),
      ]));

      const decisionValidation = await service.validatePendingApprovalDecision(approvalId, {
        decision: 'approve',
        reviewerUserId: 'director-1',
        reviewerRole: 'director',
        reason: 'Human reviewed the ERP evidence and cashflow safety gate.',
        requestId: scenario.requestId,
      });

      expect(decisionValidation.summary).toEqual(expect.objectContaining({
        validation_status: 'blocked',
        proposed_decision: 'approve',
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        next_required_action: 'fix_blockers_before_decision',
      }));
      expect(decisionValidation.blockers).toEqual(expect.arrayContaining([
        scenario.blocker,
        scenario.blockingReason,
        'source_sync_decision_evidence',
      ]));
      expect(decisionValidation.blockers).not.toContain(scenario.coverageBlocker);
      expect(decisionValidation.blockers).not.toContain(scenario.otherReadyBlocker);
      expect(decisionValidation.pendingApproval.status).toBe('pending_approval');
    });
  }

  it('lists and reads pending approval records from the repository with read-only safety flags and ERP-local filters', async () => {
    const imported = await service.importPreview(preview([
      budgetDraft(),
      supplierDraft(),
    ]));

    const list = await service.listPendingApprovals();
    expect(repository.countPendingApprovals).toHaveBeenCalled();
    expect(repository.listPendingApprovals).toHaveBeenCalledWith({});
    expect(list.schemaVersion).toBe('ads_automation_decision_draft_approval_queue.v1');
    expect(list.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      in_memory_only: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_records: true,
      execution_allowed_now: false,
    }));
    expect(list.summary).toEqual(expect.objectContaining({
      total_pending_approvals: 2,
      pending_approvals_listed: 2,
      provider_action_approvals: 1,
      internal_task_approvals: 1,
      monitoring_approvals: 0,
    }));
    expect(list.pendingApprovals).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        typedPayload: expect.objectContaining({ campaignBudgetId: '3001' }),
      }),
      expect.objectContaining({
        action_type: 'supplier_sourcing',
        provider: 'erp_internal',
        approval_required: true,
        execution_allowed_now: false,
      }),
    ]));

    const providerOnly = await service.listPendingApprovals({ action_family: 'provider_google_ads' });
    expect(repository.listPendingApprovals).toHaveBeenLastCalledWith({ action_family: 'provider_google_ads' });
    expect(providerOnly.summary.pending_approvals_listed).toBe(1);
    expect(providerOnly.pendingApprovals).toEqual([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        action_family: 'provider_google_ads',
      }),
    ]);

    const single = await service.readPendingApproval(imported.pendingApprovals[0].approval_id);
    expect(repository.findByApprovalId).toHaveBeenCalledWith(imported.pendingApprovals[0].approval_id);
    expect(single.schemaVersion).toBe('ads_automation_decision_draft_approval_record.v1');
    expect(single.safety).toEqual(expect.objectContaining({
      read_only: true,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(single.pendingApproval).toEqual(expect.objectContaining({
      approval_id: imported.pendingApprovals[0].approval_id,
      status: 'pending_approval',
      approval_required: true,
      execution_allowed_now: false,
      storage: 'erp_local_mongo',
      durable_storage_used: true,
    }));
  });

  it('returns readiness prerequisites for a durable budget update pending approval without provider calls', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));

    const response = await service.reviewPendingApprovalReadiness(imported.pendingApprovals[0].approval_id);

    expect(repository.findByApprovalId).toHaveBeenCalledWith(imported.pendingApprovals[0].approval_id);
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_readiness.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_records: true,
      execution_allowed_now: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      readiness_status: 'ready_for_human_review',
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      blockers_count: 0,
      next_required_action: 'human_review',
    }));
    expect(response.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'typedPayload.campaignBudgetId', status: 'valid' }),
      expect.objectContaining({ key: 'future_provider_validateOnly_required', status: 'valid' }),
      expect.objectContaining({ key: 'validateOnly_called', status: 'valid' }),
    ]));
    expect(response.blockers).toEqual([]);
    expect(response.pendingApproval).toEqual(expect.objectContaining({
      approval_id: imported.pendingApprovals[0].approval_id,
      status: 'pending_approval',
      approval_required: true,
      execution_allowed_now: false,
      typedPayload: expect.objectContaining({
        campaignBudgetId: '3001',
        dailyBudget: 1200000,
      }),
    }));
  });

  it('returns blockers for a durable budget update missing typedPayload.campaignBudgetId', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    repository.findByApprovalId.mockResolvedValueOnce({
      ...imported.pendingApprovals[0],
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '',
        dailyBudget: 1200000,
      },
    });

    const response = await service.reviewPendingApprovalReadiness(imported.pendingApprovals[0].approval_id);

    expect(response.summary).toEqual(expect.objectContaining({
      readiness_status: 'blocked',
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_review',
    }));
    expect(response.blockers).toEqual(expect.arrayContaining(['typedPayload.campaignBudgetId']));
    expect(response.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'typedPayload.campaignBudgetId', status: 'blocked' }),
    ]));
    expect(response.pendingApproval.typedPayload).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      dailyBudget: 1200000,
    }));
  });

  it('validates an approve decision as a dry run without mutating approval status or calling providers', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    jest.clearAllMocks();

    const response = await service.validatePendingApprovalDecision(imported.pendingApprovals[0].approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Human reviewed the ERP evidence and budget cap.',
      requestId: 'REQ-APPROVE-DRY-RUN',
    });

    expect(repository.findByApprovalId).toHaveBeenCalledWith(imported.pendingApprovals[0].approval_id);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_decision_validation.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      execution_allowed_now: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      validation_status: 'eligible_for_human_decision',
      proposed_decision: 'approve',
      approval_required: true,
      execution_allowed_now: false,
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'future_approve_endpoint',
    }));
    expect(response.proposedDecision).toEqual(expect.objectContaining({
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      requestId: 'REQ-APPROVE-DRY-RUN',
      would_update_status_to: 'approved',
      status_change_performed: false,
    }));
    expect(response.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'proposed_decision', status: 'valid' }),
      expect.objectContaining({ key: 'reviewerUserId', status: 'valid' }),
      expect.objectContaining({ key: 'decision.reason', status: 'valid' }),
      expect.objectContaining({ key: 'typedPayload.campaignBudgetId', status: 'valid' }),
    ]));
    expect(response.blockers).toEqual([]);
    expect(response.pendingApproval).toEqual(expect.objectContaining({
      status: 'pending_approval',
      approval_required: true,
      execution_allowed_now: false,
      typedPayload: expect.objectContaining({ campaignBudgetId: '3001' }),
    }));
  });

  it('previews an approve decision audit record without persisting it or mutating approval status', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    jest.clearAllMocks();

    const response = await service.previewPendingApprovalDecisionAuditRecord(imported.pendingApprovals[0].approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Human reviewed ERP evidence and approves the capped budget change.',
      requestId: 'REQ-AUDIT-APPROVE-DRY-RUN',
    });

    expect(repository.findByApprovalId).toHaveBeenCalledWith(imported.pendingApprovals[0].approval_id);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_decision_draft_approval_decision_audit_record_preview.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      execution_allowed_now: false,
      audit_record_persisted: false,
      status_change_performed: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      audit_preview_status: 'ready_for_future_audit_persist',
      proposed_decision: 'approve',
      approval_required: true,
      execution_allowed_now: false,
      audit_record_persisted: false,
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      blockers_count: 0,
      next_required_action: 'future_approve_endpoint',
    }));
    expect(response.decisionValidation.summary).toEqual(expect.objectContaining({
      validation_status: 'eligible_for_human_decision',
      proposed_decision: 'approve',
      status_change_performed: false,
    }));
    expect(response.auditRecordPreview).toEqual(expect.objectContaining({
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
      approval_id: imported.pendingApprovals[0].approval_id,
      source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
      source_decision_id: 'DEC-scale_amount-2001',
      action_type: 'update_campaign_budget',
      action_family: 'provider_google_ads',
      provider: 'google',
      previous_status: 'pending_approval',
      proposed_status: 'approved',
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      requestId: 'REQ-AUDIT-APPROVE-DRY-RUN',
      validation_status: 'eligible_for_human_decision',
      audit_record_persisted: false,
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
    }));
    expect(response.auditRecordPreview.audit_id).toContain('REQ-AUDIT-APPROVE-DRY-RUN');
    expect(response.auditRecordPreview.blockers).toEqual([]);
    expect(response.auditRecordPreview.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'typedPayload.campaignBudgetId', status: 'valid' }),
    ]));
    expect(response.auditRecordPreview.pending_approval_snapshot).toEqual(expect.objectContaining({
      status: 'pending_approval',
      approval_required: true,
      execution_allowed_now: false,
      typedPayload: expect.objectContaining({ campaignBudgetId: '3001' }),
    }));
    expect(response.pendingApproval.status).toBe('pending_approval');
  });

  it('blocks approve decision validation when durable budget payload is missing campaignBudgetId', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    repository.findByApprovalId.mockResolvedValueOnce({
      ...imported.pendingApprovals[0],
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
    });

    const response = await service.validatePendingApprovalDecision(imported.pendingApprovals[0].approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Human reviewed the ERP evidence and budget cap.',
    });

    expect(response.summary).toEqual(expect.objectContaining({
      validation_status: 'blocked',
      proposed_decision: 'approve',
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_decision',
    }));
    expect(response.blockers).toEqual(expect.arrayContaining(['typedPayload.campaignBudgetId']));
    expect(response.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'typedPayload.campaignBudgetId', status: 'blocked' }),
    ]));
    expect(response.pendingApproval.status).toBe('pending_approval');
  });

  it('previews a blocked approve audit record when campaignBudgetId is missing without falling back to campaign or ad group IDs', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    jest.clearAllMocks();
    repository.findByApprovalId.mockResolvedValueOnce({
      ...imported.pendingApprovals[0],
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
    });

    const response = await service.previewPendingApprovalDecisionAuditRecord(imported.pendingApprovals[0].approval_id, {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Human reviewed the ERP evidence and budget cap.',
      requestId: 'REQ-AUDIT-MISSING-CAMPAIGN-BUDGET',
    });

    expect(repository.findByApprovalId).toHaveBeenCalledWith(imported.pendingApprovals[0].approval_id);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(response.summary).toEqual(expect.objectContaining({
      audit_preview_status: 'blocked',
      proposed_decision: 'approve',
      audit_record_persisted: false,
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_decision',
    }));
    expect(response.decisionValidation.summary).toEqual(expect.objectContaining({
      validation_status: 'blocked',
      proposed_decision: 'approve',
    }));
    expect(response.auditRecordPreview).toEqual(expect.objectContaining({
      decision: 'approve',
      proposed_status: 'approved',
      validation_status: 'blocked',
      audit_record_persisted: false,
      status_change_performed: false,
      execution_allowed_now: false,
    }));
    expect(response.auditRecordPreview.blockers).toEqual(expect.arrayContaining(['typedPayload.campaignBudgetId']));
    expect(response.auditRecordPreview.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'typedPayload.campaignBudgetId', status: 'blocked' }),
    ]));
    expect(response.auditRecordPreview.pending_approval_snapshot.typedPayload).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      dailyBudget: 1200000,
    }));
    expect(response.pendingApproval.status).toBe('pending_approval');
  });

  it('returns blockers for unsupported proposed decision values without mutating status', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));

    const response = await service.validatePendingApprovalDecision(imported.pendingApprovals[0].approval_id, {
      decision: 'publish_now' as any,
      reviewerUserId: 'director-1',
      reviewerRole: 'director',
      reason: 'Human reviewer supplied an unsupported decision value.',
    });

    expect(response.summary).toEqual(expect.objectContaining({
      validation_status: 'blocked',
      proposed_decision: 'invalid',
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_blockers_before_decision',
    }));
    expect(response.proposedDecision).toEqual(expect.objectContaining({
      decision: 'invalid',
      would_update_status_to: null,
      status_change_performed: false,
    }));
    expect(response.blockers).toEqual(expect.arrayContaining(['proposed_decision']));
    expect(response.prerequisites).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'proposed_decision', status: 'blocked' }),
    ]));
    expect(response.pendingApproval.status).toBe('pending_approval');
  });

  it('validates a reject decision as a dry run even when the pending record has payload blockers', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    repository.findByApprovalId.mockResolvedValueOnce({
      ...imported.pendingApprovals[0],
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
      blockers: ['typedPayload.campaignBudgetId'],
      missing_data_blockers: ['campaign_budget_source_missing'],
    });

    const response = await service.validatePendingApprovalDecision(imported.pendingApprovals[0].approval_id, {
      decision: 'reject',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      reason: 'Reject malformed draft until ERP evidence is corrected.',
      requestId: 'REQ-REJECT-DRY-RUN',
    });

    expect(response.summary).toEqual(expect.objectContaining({
      validation_status: 'eligible_for_human_decision',
      proposed_decision: 'reject',
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'future_reject_endpoint',
    }));
    expect(response.proposedDecision).toEqual(expect.objectContaining({
      decision: 'reject',
      would_update_status_to: 'rejected',
      status_change_performed: false,
    }));
    expect(response.blockers).toEqual([]);
    expect(response.prerequisites.some((item) => item.key === 'typedPayload.campaignBudgetId')).toBe(false);
    expect(response.pendingApproval.status).toBe('pending_approval');
  });

  it('previews a reject decision audit record for a malformed pending approval without payload readiness blockers', async () => {
    const imported = await service.importPreview(preview([budgetDraft()]));
    jest.clearAllMocks();
    repository.findByApprovalId.mockResolvedValueOnce({
      ...imported.pendingApprovals[0],
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        dailyBudget: 1200000,
      },
      blockers: ['typedPayload.campaignBudgetId'],
      missing_data_blockers: ['campaign_budget_source_missing'],
    });

    const response = await service.previewPendingApprovalDecisionAuditRecord(imported.pendingApprovals[0].approval_id, {
      decision: 'reject',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      reason: 'Reject malformed draft until ERP evidence is corrected.',
      requestId: 'REQ-AUDIT-REJECT-DRY-RUN',
    });

    expect(repository.findByApprovalId).toHaveBeenCalledWith(imported.pendingApprovals[0].approval_id);
    expect(repository.createMany).not.toHaveBeenCalled();
    expect(response.summary).toEqual(expect.objectContaining({
      audit_preview_status: 'ready_for_future_audit_persist',
      proposed_decision: 'reject',
      audit_record_persisted: false,
      status_change_performed: false,
      next_required_action: 'future_reject_endpoint',
    }));
    expect(response.decisionValidation.summary).toEqual(expect.objectContaining({
      validation_status: 'eligible_for_human_decision',
      proposed_decision: 'reject',
    }));
    expect(response.auditRecordPreview).toEqual(expect.objectContaining({
      decision: 'reject',
      previous_status: 'pending_approval',
      proposed_status: 'rejected',
      reviewerUserId: 'manager-1',
      reviewerRole: 'manager',
      requestId: 'REQ-AUDIT-REJECT-DRY-RUN',
      validation_status: 'eligible_for_human_decision',
      audit_record_persisted: false,
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
    expect(response.auditRecordPreview.blockers).toEqual([]);
    expect(response.auditRecordPreview.prerequisites.some((item) => item.key === 'typedPayload.campaignBudgetId')).toBe(false);
    expect(response.auditRecordPreview.pending_approval_snapshot.status).toBe('pending_approval');
  });

  it('rejects unsupported approval queue read filters and missing approval records', async () => {
    await service.importPreview(preview([budgetDraft()]));

    await expect(service.listPendingApprovals({ action_type: 'delete_product' as any }))
      .rejects.toThrow('unsupported action_type filter');
    await expect(service.listPendingApprovals({ status: 'approved' as any }))
      .rejects.toThrow('status must be pending_approval');
    await expect(service.readPendingApproval('ADSAPPROVAL-missing'))
      .rejects.toThrow('pending approval not found');
    await expect(service.reviewPendingApprovalReadiness('ADSAPPROVAL-missing'))
      .rejects.toThrow('pending approval not found');
    await expect(service.validatePendingApprovalDecision('ADSAPPROVAL-missing', {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reason: 'Human reviewed the ERP evidence.',
    }))
      .rejects.toThrow('pending approval not found');
    await expect(service.previewPendingApprovalDecisionAuditRecord('ADSAPPROVAL-missing', {
      decision: 'approve',
      reviewerUserId: 'director-1',
      reason: 'Human reviewed the ERP evidence.',
    }))
      .rejects.toThrow('pending approval not found');
  });

  it('rejects payloads that are not ads_automation_decision_draft_preview.v1', async () => {
    await expect(service.importPreview({
      ...preview([budgetDraft()]),
      schemaVersion: 'ads_automation_decision_snapshot.v1',
    } as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid draft action types', async () => {
    await expect(service.importPreview(preview([
      budgetDraft({
        action_type: 'delete_product' as any,
        typedPayload: { productId: 'P_DELETE' },
      }),
    ]))).rejects.toThrow(BadRequestException);
  });

  it('rejects budget updates without campaignBudgetId and does not fall back to campaignId or adGroupId', async () => {
    const blockedPreview = preview([
      budgetDraft({
        typedPayload: {
          customerId: '1234567890',
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetId: null,
          dailyBudget: 1200000,
        },
      }),
    ]);

    await expect(service.importPreview(blockedPreview))
      .rejects.toThrow('update_campaign_budget requires typedPayload.campaignBudgetId');
    expect(repository.findExistingIdempotencyKeys).not.toHaveBeenCalled();
    expect(repository.createMany).not.toHaveBeenCalled();

    const list = await service.listPendingApprovals();
    expect(list.summary).toEqual(expect.objectContaining({
      total_pending_approvals: 0,
      pending_approvals_listed: 0,
      provider_action_approvals: 0,
    }));
    expect(list.pendingApprovals).toEqual([]);
    expect(list.safety).toEqual(expect.objectContaining({
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(blockedPreview.drafts[0]).toEqual(expect.objectContaining({
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      typedPayload: expect.objectContaining({
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
      }),
    }));
  });

  it('rejects duplicate idempotency keys within a payload and across durable imports', async () => {
    await expect(service.importPreview(preview([
      budgetDraft(),
      supplierDraft({ idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001' }),
    ]))).rejects.toThrow('duplicate idempotency_key rejected');

    await service.importPreview(preview([budgetDraft()]));
    await expect(service.importPreview(preview([budgetDraft()])))
      .rejects.toThrow('duplicate idempotency_key rejected');
  });

  it('rejects previews that report execution or provider API activity', async () => {
    await expect(service.importPreview(preview([budgetDraft()], {
      safety: {
        ...preview([budgetDraft()]).safety,
        execution_allowed_now: true as any,
      },
    }))).rejects.toThrow('execution_allowed_now must be false');

    await expect(service.importPreview(preview([
      budgetDraft({ provider_api_called: true as any }),
    ]))).rejects.toThrow('must not call provider APIs');
  });
});
