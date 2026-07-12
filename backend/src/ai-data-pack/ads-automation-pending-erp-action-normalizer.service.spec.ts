import { BadRequestException } from '@nestjs/common';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
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
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      dailyBudget: 1200000,
      currentBudgetVnd: 1000000,
      increaseVnd: 200000,
      increasePercent: 20,
      maxIncreasePercent: 20,
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

function draftFor(
  actionType: AdsAutomationDecisionDraftPreview['action_type'],
  overrides: Partial<AdsAutomationDecisionDraftPreview> = {},
): AdsAutomationDecisionDraftPreview {
  const base = budgetDraft({
    draft_id: `ADSDRAFT-20260704-${actionType}-entity`,
    source_decision_id: `DEC-${actionType}-entity`,
    action_type: actionType,
    action_family: 'internal_task',
    provider: 'erp_internal',
    resource_type: 'product',
    entity_type: 'product',
    entity_id: 'P_SCALE',
    platform: null,
    accountId: null,
    productId: 'P_SCALE',
    supplierId: null,
    validate_only_required: false,
    future_provider_validateOnly_required: false,
    typedPayload: { productId: 'P_SCALE' },
    idempotency_key: `ads-draft:2026-07-04:${actionType}:entity`,
    rationale: `${actionType} remains an ERP-local pending validation action.`,
  });

  if (actionType === 'pause_campaign') {
    return {
      ...base,
      action_family: 'provider_google_ads',
      provider: 'google',
      resource_type: 'campaign',
      entity_type: 'campaign',
      entity_id: '1001',
      platform: 'google',
      accountId: '1234567890',
      productId: 'P_SCALE',
      validate_only_required: true,
      future_provider_validateOnly_required: true,
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        targetStatus: 'PAUSED',
      },
      ...overrides,
    };
  }

  if (actionType === 'pause_ad_group') {
    return {
      ...base,
      action_family: 'provider_google_ads',
      provider: 'google',
      resource_type: 'ad_group',
      entity_type: 'ad_group',
      entity_id: '2001',
      platform: 'google',
      accountId: '1234567890',
      productId: 'P_SCALE',
      validate_only_required: true,
      future_provider_validateOnly_required: true,
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        targetStatus: 'PAUSED',
      },
      ...overrides,
    };
  }

  if (actionType === 'monitor_only') {
    return {
      ...base,
      action_family: 'monitoring',
      provider: 'none',
      resource_type: 'monitoring',
      typedPayload: {
        decisionType: 'product_budget_allocation',
        entityType: 'product',
        entityId: 'P_SCALE',
        reviewAfterDays: 3,
      },
      ...overrides,
    };
  }

  if (actionType === 'supplier_sourcing') {
    return {
      ...base,
      resource_type: 'supplier',
      entity_type: 'supplier',
      entity_id: 'SUP_REVIEW',
      supplierId: 'SUP_REVIEW',
      typedPayload: {
        productId: 'P_SCALE',
        supplierId: 'SUP_REVIEW',
        supplierFitScore: 42,
      },
      ...overrides,
    };
  }

  if (actionType === 'product_offer_fix') {
    return {
      ...base,
      typedPayload: {
        productId: 'P_SCALE',
        fixAreas: ['offer', 'landing'],
      },
      ...overrides,
    };
  }

  if (actionType === 'stop_import_review') {
    return {
      ...base,
      typedPayload: {
        productId: 'P_SCALE',
        reviewScope: 'import_stop_review',
        deleteProduct: false,
        providerDelete: false,
      },
      ...overrides,
    };
  }

  return { ...base, ...overrides };
}

function sourceSyncEvidence(
  overrides: Partial<SourceSyncDecisionEvidence>[] = [],
): SourceSyncDecisionEvidence[] {
  const sources: SourceSyncDecisionEvidence[] = [
    {
      sourceKey: 'google_ads',
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
      sourceKey: 'advertising_costs',
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
      sourceKey: 'product_mapping',
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

  return sources.map((source, index) => ({
    ...source,
    ...(overrides[index] || {}),
  }));
}

function sourceSyncGates(
  overrides: Partial<SourceSyncDecisionGates> = {},
): Partial<SourceSyncDecisionGates> {
  return {
    canRecommendAdsScale: true,
    canConcludeProfitStrongly: true,
    canEvaluateSalesToday: true,
    canEvaluateFinanceStrongly: true,
    canUseLtvStrongly: true,
    canGenerateActionDraft: true,
    canUseGoogleAdsDataClaim: true,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
    ...overrides,
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
    sourceSyncDecisionEvidence: sourceSyncEvidence(),
    sourceSyncDecisionGates: sourceSyncGates(),
    sourceEvidence: [],
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
        pause_candidates: 2,
        product_scale_candidates: 1,
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

describe('AdsAutomationPendingErpActionNormalizerService', () => {
  let service: AdsAutomationPendingErpActionNormalizerService;

  beforeEach(() => {
    service = new AdsAutomationPendingErpActionNormalizerService();
  });

  it('normalizes the narrow allowlist into ERP-local pending_validation action records', () => {
    const response = service.normalizePreview(preview([
      budgetDraft(),
      draftFor('pause_campaign'),
      draftFor('pause_ad_group'),
      draftFor('monitor_only'),
      draftFor('supplier_sourcing'),
      draftFor('product_offer_fix'),
      draftFor('stop_import_review'),
    ]));

    expect(response.schemaVersion).toBe('ads_automation_pending_erp_action_normalization.v1');
    expect(response.summary).toEqual({
      drafts_received: 7,
      pending_actions_created: 7,
      provider_action_records: 3,
      internal_task_records: 3,
      monitoring_records: 1,
      platform_entity_blocker_count: 0,
      scale_candidates_blocked_by_platform_entity_coverage: 0,
    });
    expect(response.sourceSyncDecisionEvidence.map((item) => item.sourceKey)).toEqual([
      'google_ads',
      'advertising_costs',
      'product_mapping',
      'inventory_profit',
      'supplier_safety',
    ]);
    expect(response.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canRecommendAdsScale: true,
      canGenerateActionDraft: true,
      canUseGoogleAdsDataClaim: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    }));
    expect(response.decisionAnswers).toEqual(expect.objectContaining({
      increase_ads: 'yes_pending_validation',
      increase_amount_vnd: 200000,
      target_ad_group_ids: ['2001'],
      products_to_receive_budget: ['P_SCALE'],
      supplier_choice_safety: [
        expect.objectContaining({
          productId: 'P_SCALE',
          supplierId: 'SUP_REVIEW',
          status: 'needs_sourcing',
        }),
      ],
      product_kill_or_stop_import_review: expect.arrayContaining([
        expect.objectContaining({
          productId: 'P_SCALE',
          status: 'offer_fix_required',
        }),
        expect.objectContaining({
          productId: 'P_SCALE',
          status: 'stop_import_review_required',
        }),
      ]),
      campaign_or_ad_group_pause: expect.arrayContaining([
        expect.objectContaining({ campaignId: '1001', status: 'pause_campaign' }),
        expect.objectContaining({ adGroupId: '2001', status: 'pause_ad_group' }),
      ]),
    }));
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      in_memory_only: true,
      persistence_used: false,
      durable_storage_used: false,
      provider_persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_actions: true,
      execution_allowed_now: false,
    }));
    expect(response.pendingActions.map((action) => action.action_type)).toEqual([
      'update_campaign_budget',
      'pause_campaign',
      'pause_ad_group',
      'monitor_only',
      'supplier_sourcing',
      'product_offer_fix',
      'stop_import_review',
    ]);
    expect(response.pendingActions.every((action) => action.status === 'pending_validation')).toBe(true);
    expect(response.pendingActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
        source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
        source_decision_id: 'DEC-scale_amount-2001',
        campaignBudgetId: '3001',
        requested_change: expect.objectContaining({
          action_type: 'update_campaign_budget',
          dailyBudget: 1200000,
        }),
        source_readiness: expect.arrayContaining([
          expect.objectContaining({
            sourceKey: 'inventory_profit',
            freshnessStatus: 'fresh',
            coverageStatus: 'covered',
            canUseForAdsAutomationDecision: true,
          }),
          expect.objectContaining({
            sourceKey: 'supplier_safety',
            freshnessStatus: 'fresh',
            coverageStatus: 'covered',
            canUseForAdsAutomationDecision: true,
          }),
        ]),
        source_gate: expect.objectContaining({
          canGenerateActionDraft: true,
          canDryRun: false,
          canExecuteLive: false,
        }),
        platform_entity_coverage_blockers: [],
        platform_entity_coverage_action_blockers: [],
        risk_blockers: [],
        review_disposition: 'pending_provider_validation',
        decision_answer: expect.objectContaining({
          increase_ads: 'yes',
          increase_amount_vnd: 200000,
          target_ad_group_ids: ['2001'],
          products_to_receive_budget: ['P_SCALE'],
        }),
      }),
      expect.objectContaining({
        action_type: 'pause_campaign',
        campaignId: '1001',
        campaignBudgetId: null,
        requested_change: expect.objectContaining({ targetStatus: 'PAUSED' }),
        decision_answer: expect.objectContaining({
          increase_ads: 'no',
          campaign_or_ad_group_pause: 'pause_campaign',
        }),
      }),
      expect.objectContaining({
        action_type: 'monitor_only',
        provider: 'none',
        status: 'pending_validation',
        decision_answer: expect.objectContaining({
          increase_ads: 'no',
          campaign_or_ad_group_pause: 'monitor_only',
        }),
        review_disposition: 'monitor_only_visible',
      }),
    ]));
  });

  it('downgrades scale-up pending action evidence when platform entity coverage is unsafe', () => {
    const platformEntityCoverageBlockers = [
      'platform_entity.campaigns.campaignId_missing_rows',
      'platform_entity.adGroups.adGroupId_missing_rows',
      'platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback',
      'platform_entity.productMapping.product_mapping_unmapped_ad_groups',
      'platform_entity.inventoryProfit.not_covered_for_decision',
      'platform_entity.supplierContext.not_covered_for_decision',
      'platform_entity.freshnessCoverage.freshness_stale',
    ];

    const response = service.normalizePreview(preview([budgetDraft()]), {
      platformEntityCoverageBlockers,
    });
    const scale = response.pendingActions[0];

    expect(response.summary).toEqual(expect.objectContaining({
      pending_actions_created: 1,
      platform_entity_blocker_count: platformEntityCoverageBlockers.length,
      scale_candidates_blocked_by_platform_entity_coverage: 1,
    }));
    expect(response.decisionAnswers).toEqual(expect.objectContaining({
      increase_ads: 'no_budget_increase_pending',
      increase_amount_vnd: 0,
      products_to_receive_budget: [],
    }));
    expect(scale).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      review_disposition: 'blocked_by_platform_entity_coverage',
      platform_entity_coverage_blockers: expect.arrayContaining(platformEntityCoverageBlockers),
      platform_entity_coverage_action_blockers: [],
      risk_blockers: expect.arrayContaining(platformEntityCoverageBlockers),
      evidence: expect.objectContaining({
        blockers: expect.arrayContaining(platformEntityCoverageBlockers),
      }),
      decision_answer: expect.objectContaining({
        increase_ads: 'no',
        increase_amount_vnd: null,
        products_to_receive_budget: [],
        campaign_or_ad_group_pause: 'monitor_only',
        summary: 'Scale-up is downgraded to monitor-only until platform entity coverage blockers are resolved.',
      }),
      safety_flags: expect.objectContaining({
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    }));
  });

  it('does not downgrade a safe scale-up when scoped platform blockers belong to another product or supplier', () => {
    const response = service.normalizePreview(preview([budgetDraft()]), {
      platformEntityCoverageBlockers: [
        'platform_entity.inventoryProfit.product_net_profit_not_positive',
        'platform_entity.supplierContext.supplier_safety_not_ready_for_ads_automation_decision',
      ],
      platformEntityCoverageActionBlockers: [
        {
          blocker: 'platform_entity.inventoryProfit.product_net_profit_not_positive',
          family: 'inventoryProfit',
          scope: 'productId',
          campaignId: '1002',
          adGroupId: '2002',
          campaignBudgetId: '3002',
          productId: 'P_BAD',
          supplierId: 'SUP_WEAK',
        },
        {
          blocker: 'platform_entity.supplierContext.supplier_safety_not_ready_for_ads_automation_decision',
          family: 'supplierContext',
          scope: 'supplierId',
          campaignId: '1002',
          adGroupId: '2002',
          campaignBudgetId: '3002',
          productId: 'P_BAD',
          supplierId: 'SUP_WEAK',
        },
      ],
    });
    const scale = response.pendingActions[0];

    expect(response.summary).toEqual(expect.objectContaining({
      platform_entity_blocker_count: 0,
      scale_candidates_blocked_by_platform_entity_coverage: 0,
    }));
    expect(response.decisionAnswers).toEqual(expect.objectContaining({
      increase_ads: 'yes_pending_validation',
      increase_amount_vnd: 200000,
      products_to_receive_budget: ['P_SCALE'],
    }));
    expect(scale).toEqual(expect.objectContaining({
      review_disposition: 'pending_provider_validation',
      platform_entity_coverage_blockers: [],
      platform_entity_coverage_action_blockers: [],
      decision_answer: expect.objectContaining({
        increase_ads: 'yes',
        campaign_or_ad_group_pause: 'not_applicable',
      }),
    }));
  });

  it('downgrades scale-up only when scoped platform blockers match the action identifiers', () => {
    const scopedBlockers = [
      {
        blocker: 'platform_entity.campaigns.campaignId_not_covered_for_action',
        family: 'campaigns',
        scope: 'campaignId',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        supplierId: 'SUP_WEAK',
      },
      {
        blocker: 'platform_entity.adGroups.adGroupId_not_covered_for_action',
        family: 'adGroups',
        scope: 'adGroupId',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        supplierId: 'SUP_WEAK',
      },
      {
        blocker: 'platform_entity.campaignBudgets.campaignBudgetId_not_covered_for_action',
        family: 'campaignBudgets',
        scope: 'campaignBudgetId',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        supplierId: 'SUP_WEAK',
      },
      {
        blocker: 'platform_entity.inventoryProfit.product_blocked_for_action',
        family: 'inventoryProfit',
        scope: 'productId',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        supplierId: 'SUP_WEAK',
      },
      {
        blocker: 'platform_entity.supplierContext.supplier_blocked_for_action',
        family: 'supplierContext',
        scope: 'supplierId',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        supplierId: 'SUP_WEAK',
      },
      {
        blocker: 'platform_entity.freshnessCoverage.freshness_stale',
        family: 'freshnessCoverage',
        scope: 'freshness',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        supplierId: 'SUP_WEAK',
      },
    ] as const;
    const response = service.normalizePreview(preview([
      budgetDraft({
        supplierId: 'SUP_WEAK',
        typedPayload: {
          ...budgetDraft().typedPayload,
          supplierId: 'SUP_WEAK',
        },
      }),
    ]), {
      platformEntityCoverageActionBlockers: [...scopedBlockers],
    });
    const scale = response.pendingActions[0];

    expect(response.summary).toEqual(expect.objectContaining({
      platform_entity_blocker_count: scopedBlockers.length,
      scale_candidates_blocked_by_platform_entity_coverage: 1,
    }));
    expect(scale.platform_entity_coverage_blockers).toEqual(
      scopedBlockers.map((blocker) => blocker.blocker).sort(),
    );
    expect(scale.platform_entity_coverage_action_blockers).toEqual(
      expect.arrayContaining(scopedBlockers.map((blocker) => expect.objectContaining(blocker))),
    );
    expect(scale.review_disposition).toBe('blocked_by_platform_entity_coverage');
    expect(scale.decision_answer).toEqual(expect.objectContaining({
      increase_ads: 'no',
      campaign_or_ad_group_pause: 'monitor_only',
    }));
    expect(scale.safety_flags).toEqual(expect.objectContaining({
      approval_required: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
  });

  it('rejects forbidden action types before producing pending action records', () => {
    expect(() => service.normalizePreview(preview([
      budgetDraft({
        action_type: 'delete_campaign' as any,
        idempotency_key: 'ads-draft:2026-07-04:delete_campaign:1001',
      }),
    ]))).toThrow(BadRequestException);

    expect(() => service.normalizePreview(preview([
      budgetDraft({
        action_type: 'delete_campaign' as any,
        idempotency_key: 'ads-draft:2026-07-04:delete_campaign:1001',
      }),
    ]))).toThrow('unsupported pending action_type: delete_campaign');
  });

  it('requires campaignBudgetId for budget updates and never falls back to campaignId or adGroupId', () => {
    expect(() => service.normalizePreview(preview([
      budgetDraft({
        typedPayload: {
          customerId: '1234567890',
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetId: null,
          dailyBudget: 1200000,
        },
      }),
    ]))).toThrow('update_campaign_budget requires typedPayload.campaignBudgetId');

    const response = service.normalizePreview(preview([
      draftFor('pause_ad_group'),
    ]));

    expect(response.pendingActions[0]).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
    }));
  });

  it('rejects source-gated blocked drafts before creating pending action records', () => {
    expect(() => service.normalizePreview(preview([budgetDraft()], {
      sourceSyncDecisionGates: sourceSyncGates({
        canRecommendAdsScale: false,
        canGenerateActionDraft: false,
        canUseGoogleAdsDataClaim: false,
      }),
    }))).toThrow('source-sync gate does not allow pending action generation');

    expect(() => service.normalizePreview(preview([budgetDraft()], {
      sourceSyncDecisionEvidence: sourceSyncEvidence([
        {},
        {},
        {},
        {
          freshnessStatus: 'stale',
          blockingReason: 'inventory_profit_not_ready_for_ads_automation_decision',
          blockingReasons: [
            'freshness_stale',
            'inventory_profit_not_ready_for_ads_automation_decision',
          ],
          canUseForAdsAutomationDecision: false,
        },
      ]),
      sourceSyncDecisionGates: sourceSyncGates(),
    }))).toThrow('source inventory_profit is not ready for pending action generation');

    expect(() => service.normalizePreview(preview([
      budgetDraft({
        status: 'blocked_missing_data',
        missing_data_blockers: [
          'source_sync_gate_blocked_action_draft',
          'google_ads_not_ready_for_ads_automation_decision',
        ],
      }),
    ]))).toThrow('is not pending approval preview');
  });

  it('preserves product and supplier context for internal ERP pending actions', () => {
    const response = service.normalizePreview(preview([
      draftFor('supplier_sourcing', {
        blockers: ['supplier_margin_below_minimum'],
      }),
      draftFor('product_offer_fix', {
        blockers: ['offer_not_ready'],
      }),
      draftFor('stop_import_review', {
        blockers: ['negative_product_economics'],
      }),
    ]));

    expect(response.pendingActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'supplier_sourcing',
        provider: 'erp_internal',
        resource_type: 'supplier',
        productId: 'P_SCALE',
        supplierId: 'SUP_REVIEW',
        identifiers: expect.objectContaining({
          productId: 'P_SCALE',
          supplierId: 'SUP_REVIEW',
        }),
        requested_change: expect.objectContaining({
          productId: 'P_SCALE',
          supplierId: 'SUP_REVIEW',
          supplierFitScore: 42,
        }),
        risk_blockers: ['supplier_margin_below_minimum'],
        decision_answer: expect.objectContaining({
          increase_ads: 'no',
          supplier_choice_safety: 'needs_sourcing',
        }),
      }),
      expect.objectContaining({
        action_type: 'product_offer_fix',
        productId: 'P_SCALE',
        supplierId: null,
        requested_change: expect.objectContaining({
          fixAreas: ['offer', 'landing'],
        }),
        risk_blockers: ['offer_not_ready'],
        decision_answer: expect.objectContaining({
          increase_ads: 'no',
          product_kill_or_stop_import_review: 'offer_fix_required',
        }),
      }),
      expect.objectContaining({
        action_type: 'stop_import_review',
        productId: 'P_SCALE',
        requested_change: expect.objectContaining({
          deleteProduct: false,
          providerDelete: false,
        }),
        risk_blockers: ['negative_product_economics'],
        decision_answer: expect.objectContaining({
          increase_ads: 'no',
          product_kill_or_stop_import_review: 'stop_import_review_required',
        }),
      }),
    ]));
  });

  it('preserves safety flags and rejects previews reporting execution or provider activity', () => {
    const response = service.normalizePreview(preview([budgetDraft()]));

    expect(response.pendingActions[0].safety_flags).toEqual({
      approval_required: true,
      execution_allowed_now: false,
      validate_only_required: true,
      future_provider_validateOnly_required: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      persistence_used: false,
      durable_storage_used: false,
      erp_local_persistence_used: false,
      provider_persistence_used: false,
      production_ready: false,
    });

    expect(() => service.normalizePreview(preview([budgetDraft()], {
      safety: {
        ...preview([budgetDraft()]).safety,
        execution_allowed_now: true as any,
      },
    }))).toThrow('execution_allowed_now must be false');

    expect(() => service.normalizePreview(preview([
      budgetDraft({ provider_api_called: true as any }),
    ]))).toThrow('must not call provider APIs');
  });
});
