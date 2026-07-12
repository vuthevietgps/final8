import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from './contracts/ads-automation-decision.contract';

const evidenceWindow = { from: '2026-06-21', to: '2026-07-04', days: 14 };

function decision(overrides: Partial<AdsAutomationDecisionItem>): AdsAutomationDecisionItem {
  const decisionType = overrides.decision_type || 'scale_ads';
  const entityId = overrides.entity_id || 'ENTITY_1';
  return {
    decision_id: `DEC-${decisionType}-${entityId}`,
    decision_type: decisionType,
    entity_type: overrides.entity_type || 'ad_group',
    entity_id: entityId,
    platform: overrides.platform ?? 'google',
    accountId: overrides.accountId ?? '1234567890',
    productId: overrides.productId ?? null,
    supplierId: overrides.supplierId ?? null,
    currentValue: overrides.currentValue ?? {},
    proposedValue: overrides.proposedValue ?? {},
    evidence_window: overrides.evidence_window || evidenceWindow,
    evidence_metrics: overrides.evidence_metrics || {},
    data_quality_score: overrides.data_quality_score ?? 0.9,
    confidence: overrides.confidence || 'high',
    risk_level: overrides.risk_level || 'medium',
    status: overrides.status || 'needs_review',
    blockers: overrides.blockers || [],
    missing_fields: overrides.missing_fields || [],
    next_required_data: overrides.next_required_data || [],
    approval_required: true,
    execution_allowed_now: false,
    idempotency_key: overrides.idempotency_key ?? null,
    rollback_plan: overrides.rollback_plan ?? null,
    rationale: overrides.rationale || 'Fixture decision rationale.',
  };
}

function snapshot(decisions: AdsAutomationDecisionItem[]): AdsAutomationDecisionSnapshot {
  return {
    schemaVersion: 'ads_automation_decision_snapshot.v1',
    generatedAt: '2026-07-04T05:00:00.000Z',
    snapshotDate: '2026-07-04',
    safety: {
      read_only: true,
      provider_api_used: false,
      google_ads_api_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_future_actions: true,
    },
    summary: {
      categories: 7,
      decisions: decisions.length,
      scale_candidates: 1,
      pause_candidates: 2,
      product_scale_candidates: 0,
      supplier_safe_candidates: 0,
      insufficient_data_decisions: 0,
    },
    categories: {} as Record<AdsAutomationCategoryKey, any>,
    decisions,
  };
}

describe('AdsAutomationDecisionDraftPreviewService', () => {
  const service = new AdsAutomationDecisionDraftPreviewService();

  it('maps every eligible decision type to approval-required execution-disabled draft previews', () => {
    const response = service.build(snapshot([
      decision({
        decision_type: 'scale_amount',
        entity_id: 'AG_SCALE',
        status: 'scale_ready',
        currentValue: {
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetId: '3001',
          currentBudgetVnd: 1000000,
        },
        proposedValue: {
          action: 'update_campaign_budget_draft',
          campaignBudgetId: '3001',
          proposedBudgetVnd: 1200000,
          currentBudgetVnd: 1000000,
          increaseVnd: 200000,
          increasePercent: 20,
        },
      }),
      decision({
        decision_type: 'campaign_or_ad_group_pause',
        entity_id: '2002',
        currentValue: { campaignId: '1002', adGroupId: '2002' },
        proposedValue: { action: 'pause_ad_group_draft' },
      }),
      decision({
        decision_type: 'campaign_or_ad_group_pause',
        entity_type: 'campaign',
        entity_id: '1003',
        currentValue: { campaignId: '1003' },
        proposedValue: { action: 'pause_campaign_draft' },
      }),
      decision({
        decision_type: 'campaign_or_ad_group_pause',
        entity_id: '2004',
        proposedValue: { action: 'monitor_only' },
      }),
      decision({
        decision_type: 'supplier_gate',
        entity_type: 'supplier',
        entity_id: 'SUP_WEAK',
        supplierId: 'SUP_WEAK',
        productId: 'P_WEAK',
        platform: null,
        accountId: null,
        proposedValue: { action: 'supplier_sourcing', supplierFitScore: 42 },
      }),
      decision({
        decision_type: 'product_budget_allocation',
        entity_type: 'product',
        entity_id: 'P_OFFER',
        productId: 'P_OFFER',
        platform: null,
        accountId: null,
        blockers: ['offer_not_ready'],
        proposedValue: { action: 'hold' },
      }),
      decision({
        decision_type: 'product_kill_or_stop_review',
        entity_type: 'product',
        entity_id: 'P_STOP',
        productId: 'P_STOP',
        platform: null,
        accountId: null,
        blockers: ['negative_product_economics'],
        proposedValue: {
          action: 'stop_ads_review',
          disallowedActions: ['delete_product'],
        },
      }),
    ]));

    expect(response.summary).toEqual(expect.objectContaining({
      decisions_scanned: 7,
      drafts_created: 7,
      provider_action_drafts: 3,
      internal_task_drafts: 3,
      monitoring_drafts: 1,
    }));
    expect(response.safety).toEqual(expect.objectContaining({
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
    }));
    expect(response.drafts.map((draft) => draft.action_type).sort()).toEqual([
      'monitor_only',
      'pause_ad_group',
      'pause_campaign',
      'product_offer_fix',
      'stop_import_review',
      'supplier_sourcing',
      'update_campaign_budget',
    ].sort());
    expect(response.drafts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: true,
        provider_api_called: false,
        google_ads_api_called: false,
        typedPayload: expect.objectContaining({
          campaignBudgetId: '3001',
          dailyBudget: 1200000,
        }),
      }),
      expect.objectContaining({
        action_type: 'pause_ad_group',
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: true,
        typedPayload: expect.objectContaining({
          adGroupId: '2002',
          targetStatus: 'PAUSED',
        }),
      }),
      expect.objectContaining({
        action_type: 'pause_campaign',
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: true,
        typedPayload: expect.objectContaining({
          campaignId: '1003',
          targetStatus: 'PAUSED',
        }),
      }),
      expect.objectContaining({
        action_type: 'supplier_sourcing',
        provider: 'erp_internal',
        validate_only_required: false,
        provider_api_called: false,
        typedPayload: expect.objectContaining({
          productId: 'P_WEAK',
          supplierId: 'SUP_WEAK',
        }),
      }),
      expect.objectContaining({
        action_type: 'product_offer_fix',
        provider: 'erp_internal',
        typedPayload: expect.objectContaining({
          productId: 'P_OFFER',
          fixAreas: ['offer'],
        }),
      }),
      expect.objectContaining({
        action_type: 'stop_import_review',
        provider: 'erp_internal',
        validate_only_required: false,
        typedPayload: expect.objectContaining({
          productId: 'P_STOP',
          deleteProduct: false,
          providerDelete: false,
        }),
        disallowed_actions: expect.arrayContaining(['delete_product', 'delete_campaign', 'delete_ad_group']),
      }),
    ]));
  });

  it('blocks draft previews when source-sync decision evidence is stale or missing', () => {
    const response = service.build(snapshot([
      decision({
        decision_type: 'scale_amount',
        entity_id: 'AG_SCALE',
        status: 'scale_ready',
        currentValue: {
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetId: '3001',
          currentBudgetVnd: 1000000,
        },
        proposedValue: {
          action: 'update_campaign_budget_draft',
          campaignBudgetId: '3001',
          proposedBudgetVnd: 1200000,
        },
      }),
      decision({
        decision_type: 'campaign_or_ad_group_pause',
        entity_id: '2002',
        currentValue: { campaignId: '1002', adGroupId: '2002' },
        proposedValue: { action: 'pause_ad_group_draft' },
      }),
      decision({
        decision_type: 'supplier_gate',
        entity_type: 'supplier',
        entity_id: 'SUP_WEAK',
        supplierId: 'SUP_WEAK',
        productId: 'P_WEAK',
        platform: null,
        accountId: null,
        proposedValue: { action: 'supplier_sourcing', supplierFitScore: 42 },
      }),
    ]), {
      sourceSyncDecisionGates: {
        canGenerateActionDraft: false,
        canUseGoogleAdsDataClaim: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      },
      sourceSyncDecisionEvidence: [
        {
          sourceKey: 'google_ads',
          reportDate: '2026-07-04',
          freshnessStatus: 'stale',
          coverageStatus: 'covered',
          lastSuccessfulSyncAt: '2026-07-03T20:00:00.000Z',
          latestRecordDate: '2026-07-04',
          blockingReason: 'google_ads_not_ready_for_ads_automation_decision',
          blockingReasons: ['google_ads_not_ready_for_ads_automation_decision'],
          canUseForAdsAutomationDecision: false,
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
          freshnessStatus: 'missing',
          coverageStatus: 'missing',
          lastSuccessfulSyncAt: null,
          latestRecordDate: null,
          blockingReason: 'product_mapping_not_ready_for_ads_automation_decision',
          blockingReasons: [
            'freshness_missing',
            'product_mapping_not_ready_for_ads_automation_decision',
          ],
          canUseForAdsAutomationDecision: false,
        },
        {
          sourceKey: 'inventory_profit',
          reportDate: '2026-07-04',
          freshnessStatus: 'stale',
          coverageStatus: 'covered',
          lastSuccessfulSyncAt: '2026-06-30T00:00:00.000Z',
          latestRecordDate: '2026-06-30',
          blockingReason: 'inventory_profit_not_ready_for_ads_automation_decision',
          blockingReasons: [
            'freshness_stale',
            'inventory_profit_not_ready_for_ads_automation_decision',
          ],
          canUseForAdsAutomationDecision: false,
        },
        {
          sourceKey: 'supplier_safety',
          reportDate: '2026-07-04',
          freshnessStatus: 'missing',
          coverageStatus: 'missing',
          lastSuccessfulSyncAt: null,
          latestRecordDate: null,
          blockingReason: 'supplier_safety_not_ready_for_ads_automation_decision',
          blockingReasons: [
            'freshness_missing',
            'supplier_safety_not_ready_for_ads_automation_decision',
          ],
          canUseForAdsAutomationDecision: false,
        },
      ],
    });

    expect(response.sourceSyncDecisionGates).toEqual(expect.objectContaining({
      canGenerateActionDraft: false,
      canUseGoogleAdsDataClaim: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    }));
    expect(response.sourceSyncDecisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        reportDate: '2026-07-04',
        freshnessStatus: 'stale',
        coverageStatus: 'covered',
        blockingReason: 'google_ads_not_ready_for_ads_automation_decision',
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: 'product_mapping',
        reportDate: '2026-07-04',
        freshnessStatus: 'missing',
        coverageStatus: 'missing',
        blockingReasons: expect.arrayContaining([
          'product_mapping_not_ready_for_ads_automation_decision',
        ]),
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: 'inventory_profit',
        freshnessStatus: 'stale',
        coverageStatus: 'covered',
        blockingReasons: expect.arrayContaining([
          'inventory_profit_not_ready_for_ads_automation_decision',
        ]),
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: 'supplier_safety',
        freshnessStatus: 'missing',
        coverageStatus: 'missing',
        blockingReasons: expect.arrayContaining([
          'supplier_safety_not_ready_for_ads_automation_decision',
        ]),
        canUseForAdsAutomationDecision: false,
      }),
    ]));
    expect(response.summary).toEqual(expect.objectContaining({
      decisions_scanned: 3,
      drafts_created: 3,
      blocked_drafts: 3,
    }));
    expect(response.drafts.every((draft) => draft.status === 'blocked_missing_data')).toBe(true);
    expect(response.drafts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        missing_data_blockers: expect.arrayContaining([
          'source_sync_gate_blocked_action_draft',
          'google_ads_not_ready_for_ads_automation_decision',
          'product_mapping_not_ready_for_ads_automation_decision',
          'inventory_profit_not_ready_for_ads_automation_decision',
          'supplier_safety_not_ready_for_ads_automation_decision',
        ]),
      }),
      expect.objectContaining({
        action_type: 'supplier_sourcing',
        provider: 'erp_internal',
        missing_data_blockers: expect.arrayContaining([
          'product_mapping_not_ready_for_ads_automation_decision',
          'inventory_profit_not_ready_for_ads_automation_decision',
          'supplier_safety_not_ready_for_ads_automation_decision',
        ]),
      }),
    ]));
  });

  it('blocks budget update previews without campaignBudgetId and never falls back to campaignId or adGroupId', () => {
    const response = service.build(snapshot([
      decision({
        decision_type: 'scale_amount',
        entity_id: 'AG_NO_BUDGET',
        status: 'scale_ready',
        currentValue: {
          campaignId: '1001',
          adGroupId: '2001',
          campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
          currentBudgetVnd: 1000000,
        },
        proposedValue: {
          action: 'update_campaign_budget_draft',
          campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
          proposedBudgetVnd: 1200000,
        },
      }),
    ]));

    expect(response.summary.blocked_drafts).toBe(1);
    expect(response.drafts[0]).toEqual(expect.objectContaining({
      action_type: 'update_campaign_budget',
      status: 'blocked_missing_data',
      missing_data_blockers: ['campaignBudgetId'],
      typedPayload: expect.objectContaining({
        campaignBudgetId: null,
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      }),
    }));
    expect(response.drafts[0].typedPayload.campaignBudgetId).not.toBe('1001');
    expect(response.drafts[0].typedPayload.campaignBudgetId).not.toBe('2001');
  });

  it('does not convert forbidden provider delete or auto-publish actions into previews', () => {
    const response = service.build(snapshot([
      decision({
        decision_type: 'product_kill_or_stop_review',
        entity_type: 'product',
        entity_id: 'P_DELETE',
        proposedValue: { action: 'delete_product' },
      }),
      decision({
        decision_type: 'campaign_or_ad_group_pause',
        entity_type: 'campaign',
        entity_id: '1001',
        proposedValue: { action: 'auto_publish' },
      }),
    ]));

    expect(response.drafts).toEqual([]);
    expect(response.summary.drafts_created).toBe(0);
  });
});
