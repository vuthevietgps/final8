import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import { ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE } from './ads-automation-google-ads-mock-import-demo.fixture';
import { AdsAutomationGoogleAdsMockImportDemoService } from './ads-automation-google-ads-mock-import-demo.service';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
import { AdsAutomationProviderValidateOnlyPlannerService } from './ads-automation-provider-validate-only-planner.service';
import { AdsAutomationReadonlyPlatformImportReadinessService } from './ads-automation-readonly-platform-import-readiness.service';
import type {
  AdsAutomationGoogleAdsMockImportDemoInput,
} from './contracts/ads-automation-google-ads-mock-import-demo.contract';

function buildService(): AdsAutomationGoogleAdsMockImportDemoService {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  return new AdsAutomationGoogleAdsMockImportDemoService(
    new AdsAutomationReadonlyPlatformImportReadinessService(),
    new AdsAutomationDecisionReadModelQueryService(adapter),
    new AdsAutomationDecisionService(),
    new AdsAutomationDecisionDraftPreviewService(),
    new AdsAutomationPendingErpActionNormalizerService(),
    new AdsAutomationProviderValidateOnlyPlannerService(),
  );
}

function fixture(
  overrides: Partial<AdsAutomationGoogleAdsMockImportDemoInput> = {},
): AdsAutomationGoogleAdsMockImportDemoInput {
  return {
    ...JSON.parse(JSON.stringify(ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE)),
    ...overrides,
  };
}

describe('AdsAutomationGoogleAdsMockImportDemoService', () => {
  it('runs a local Google Ads mock import through pending actions, approval evidence, and dry-run audit records', async () => {
    const response = await buildService().build();

    expect(response.schemaVersion).toBe('ads_automation_google_ads_mock_import_demo.v1');
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_fixture_only: true,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      validate_only_provider_call_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      campaignBudgetId_no_fallback: true,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
      erp_only_future_validator_approver_executor: true,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      normalized_google_ads_rows: 2,
      rows_ready_for_decision: 2,
      update_budget_actions: 1,
      pause_actions: 1,
      stop_import_review_actions: 1,
      scale_up_execution_mode: 'pending_validation',
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.normalizedImportRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        accountId: 'HTX-GADS-PRIMARY',
        customerId: '1234567890',
        campaignId: '1001',
        campaignName: 'Search - Scale Cooker',
        campaignStatus: 'ENABLED',
        adGroupId: '2001',
        adGroupName: 'Rice cooker winning ad group',
        adGroupStatus: 'ENABLED',
        adId: '5001',
        campaignBudgetId: '3001',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
        spendVnd: 300000,
        clicks: 120,
        impressions: 5000,
        conversions: 12,
        reportDate: '2026-07-04',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        importRunId: 'GADS-MOCK-RUN-20260704-001',
        sourceTrustLevel: 'fixture_verified',
        canUseForAdsAutomationDecision: true,
      }),
    ]));
    expect(response.erpMappingEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        productId: 'P_SCALE',
        supplierIds: ['SUP_SAFE'],
        mappedAdGroupIds: ['2001'],
        orderCount: 1,
        netProfitVnd: 1250000,
        contributionProfitVnd: 950000,
        cashConversionStatus: 'safe',
        stockAvailable: 120,
        fulfillmentCapacityStatus: 'available',
      }),
      expect.objectContaining({
        productId: 'P_BAD',
        supplierIds: ['SUP_WEAK_1', 'SUP_WEAK_2'],
        mappedAdGroupIds: ['2002'],
        netProfitVnd: -450000,
        cashConversionStatus: 'unsafe',
        returnCancelRefundRatePercent: 40,
      }),
    ]));
    expect(response.importReadiness.summary).toEqual(expect.objectContaining({
      status: 'ready_for_local_decision_review',
      source_sync_blocker_count: 0,
      campaignBudgetId_missing_rows: 0,
      scale_up_execution_mode: 'pending_validation',
      execution_allowed_now: false,
    }));
    expect(response.importReadiness.decisionReadiness).toEqual(expect.objectContaining({
      status: 'ready_for_local_decision_review',
      source_gate_status: 'ready',
      readonly_import_status: 'ready',
      read_model_status: 'ready',
      action_generation_allowed_for_review: true,
      can_generate_action_draft: true,
      can_increase_ads: true,
      execution_allowed_now: false,
    }));
    expect(response.importReadiness.sourceImportCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'google_ads',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        canUseForAdsAutomationDecision: true,
      }),
      expect.objectContaining({
        sourceKey: 'product_mapping',
        freshnessStatus: 'fresh',
        coverageStatus: 'covered',
        canUseForAdsAutomationDecision: true,
      }),
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
    ]));
    expect(response.importReadiness.decisionReadiness.readModelEvidence.sourceEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: 'ads_performance', status: 'fresh', rowCount: 2 }),
      expect.objectContaining({ sourceKey: 'campaign_budgets', status: 'fresh', rowCount: 2 }),
      expect.objectContaining({ sourceKey: 'product_performance', status: 'fresh', rowCount: 2 }),
      expect.objectContaining({ sourceKey: 'supplier_safety', status: 'fresh', rowCount: 3 }),
    ]));

    const actions = response.pendingActionNormalization.pendingActions;
    expect(actions.map((action) => action.action_type)).toEqual(expect.arrayContaining([
      'update_campaign_budget',
      'pause_ad_group',
      'stop_import_review',
      'supplier_sourcing',
    ]));
    expect(actions.find((action) => action.action_type === 'update_campaign_budget')).toEqual(expect.objectContaining({
      customerId: '1234567890',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      productId: 'P_SCALE',
      requested_change: expect.objectContaining({
        dailyBudget: 1200000,
        currentBudgetVnd: 1000000,
        increaseVnd: 200000,
      }),
      risk_blockers: [],
    }));

    expect(response.validateOnlyLane.safety).toEqual(expect.objectContaining({
      provider_validateOnly_lane_mocked: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      campaignBudgetId_no_fallback: true,
    }));
    expect(response.validateOnlyLane.summary).toEqual(expect.objectContaining({
      provider_actions_received: 2,
      validate_only_passed: 2,
      executable_now: 0,
    }));
    expect(response.validateOnlyPreflight).toEqual(expect.objectContaining({
      status: 'ready_for_future_validateOnly_planning',
      pending_action_candidate_status: 'pending_actions_created',
      source: 'erp_mock_import_read_model',
      candidate_count: 2,
      pending_action_count: actions.length,
      blocked_candidate_count: 0,
      blocked_source_keys: [],
      blockers: [],
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(response.validateOnlyPreflight.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        candidate_status: 'pending_action_created',
        provider_validateOnly_readiness: 'passed_mock_validateOnly',
        validateOnly_plan_status: 'validate_only_passed',
        validateOnly_request_status: 'ready_for_future_validateOnly',
        campaignBudgetId: '3001',
        blockers: [],
        campaignBudgetId_fallback_used: false,
      }),
    ]));

    expect(response.approvalEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        approval_status: 'approved_demo_local_only',
        validation_status: 'validate_only_passed',
        preflight_status: 'recorded_local_only_blocked_future_live',
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        adId: '5001',
        campaignBudgetId: '3001',
        productId: 'P_SCALE',
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
      expect.objectContaining({
        action_type: 'stop_import_review',
        productId: 'P_BAD',
        blockers: expect.arrayContaining([
          'negative_product_economics',
          'return_cancel_refund_rate_too_high',
        ]),
      }),
    ]));
    expect(response.dryRunExecutionAuditRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        preflight_status: 'recorded_local_only_blocked_future_live',
        approval_status: 'approved_demo_local_only',
        blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
        identifiers: expect.objectContaining({
          customerId: '1234567890',
          campaignId: '1001',
          adGroupId: '2001',
          adId: '5001',
          campaignBudgetId: '3001',
        }),
        campaignBudgetId_fallback_used: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    ]));
    expect(response.alertRollbackEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'pause_ad_group',
        safe_action_preserved: 'pause_ad_group',
        trigger_signals: expect.arrayContaining([
          'net_profit_after_ads_negative',
          'spend_without_orders',
        ]),
        execution_allowed_now: false,
      }),
      expect.objectContaining({
        action_type: 'stop_import_review',
        severity: 'critical',
        safe_action_preserved: 'stop_import_review',
      }),
    ]));
  });

  it('downgrades a safe-looking scale row to monitor_only when cashflow-first guards are unsafe', async () => {
    const response = await buildService().build(fixture({ cashflowMode: 'unsafe' }));

    expect(response.importReadiness.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      cashflow_first_scale_all_safe: false,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      update_budget_actions: 0,
      monitor_only_actions: 2,
      pause_actions: 1,
      stop_import_review_actions: 1,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
    }));
    expect(response.pendingActionNormalization.pendingActions.map((action) => action.action_type))
      .not.toContain('update_campaign_budget');
    const monitorOnly = response.pendingActionNormalization.pendingActions
      .find((action) => action.action_type === 'monitor_only');
    expect(monitorOnly).toEqual(expect.objectContaining({
      action_type: 'monitor_only',
      productId: 'P_SCALE',
      risk_blockers: ['cashflow_gate_blocked'],
      decision_answer: expect.objectContaining({
        increase_ads: 'no',
        campaign_or_ad_group_pause: 'monitor_only',
      }),
      safety_flags: expect.objectContaining({
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
    }));
    expect(response.alertRollbackEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'monitor_only',
        severity: 'critical',
        safe_action_preserved: 'monitor_only',
        trigger_signals: expect.arrayContaining([
          'cashflow_gate_blocked',
          'cashflow_first_scale_guard_unsafe',
        ]),
      }),
    ]));
  });

  it('requires campaignBudgetId from the mock import and never falls back to campaignId or adGroupId', async () => {
    const missingBudget = fixture({
      googleAdsRows: ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE.googleAdsRows.map((row, index) => (
        index === 0
          ? {
              ...row,
              campaignBudgetId: null,
              campaignBudgetResourceName: null,
            }
          : row
      )),
    });

    const response = await buildService().build(missingBudget);

    const row = response.normalizedImportRows.find((item) => item.adGroupId === '2001')!;
    expect(row).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
      campaignBudgetResourceName: null,
      coverageStatus: 'missing',
      blockers: ['campaignBudgetId_missing_no_fallback'],
      canUseForAdsAutomationDecision: false,
    }));
    expect(row.campaignBudgetId).not.toBe(row.campaignId);
    expect(row.campaignBudgetId).not.toBe(row.adGroupId);
    expect(response.importReadiness.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      campaignBudgetId_missing_rows: 1,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.importReadiness.decisionReadiness).toEqual(expect.objectContaining({
      status: 'blocked',
      readonly_import_status: 'blocked',
      read_model_status: 'blocked',
      can_generate_action_draft: false,
      execution_allowed_now: false,
    }));
    expect(response.importReadiness.decisionReadiness.readonly_import_blockers).toEqual(expect.arrayContaining([
      'campaignBudgetId_missing_no_fallback',
    ]));
    expect(response.importReadiness.decisionReadiness.read_model_blockers).toEqual(expect.arrayContaining([
      'read_model.campaign_budgets_missing_campaignBudgetId_or_campaignBudgetResourceName',
      'read_model.campaign_budgets.2001_missing_campaignBudgetId_or_campaignBudgetResourceName',
    ]));
    expect(response.decisionReadModel.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'missing',
        missingFields: ['campaignBudgetId_or_campaignBudgetResourceName'],
      }),
    ]));
    expect(response.pendingActionNormalization.pendingActions.map((action) => action.action_type))
      .not.toContain('update_campaign_budget');
    expect(response.validateOnlyPreflight).toEqual(expect.objectContaining({
      status: 'blocked_before_validateOnly',
      pending_action_candidate_status: 'blocked_before_pending_action',
      source: 'erp_mock_import_read_model',
      blocked_candidate_count: expect.any(Number),
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(response.validateOnlyPreflight.blockers).toEqual(expect.arrayContaining([
      'campaignBudgetId',
      'read_model.campaign_budgets_missing_campaignBudgetId_or_campaignBudgetResourceName',
      'read_model.campaign_budgets.2001_missing_campaignBudgetId_or_campaignBudgetResourceName',
    ]));
    expect(response.validateOnlyPreflight.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: 'update_campaign_budget',
        candidate_status: 'blocked_before_pending_action',
        provider_validateOnly_readiness: 'blocked_before_validateOnly',
        pending_action_id: null,
        campaignId: null,
        adGroupId: null,
        campaignBudgetId: null,
        blockers: expect.arrayContaining([
          'campaignBudgetId',
          'read_model.campaign_budgets_missing_campaignBudgetId_or_campaignBudgetResourceName',
        ]),
        campaignBudgetId_fallback_used: false,
      }),
    ]));
    expect(response.dryRunExecutionAuditRecords.every((record) => (
      record.campaignBudgetId_fallback_used === false
      && record.execution_allowed_now === false
      && record.google_ads_api_called === false
      && record.live_ads_execution_used === false
    ))).toBe(true);
  });

  it.each([
    {
      name: 'product mapping',
      sourceKey: 'product_mapping',
      sourceBlocker: 'product_mapping_not_ready_for_ads_automation_decision',
      readModelBlocker: 'read_model.ads_performance_missing_productIds',
      input: () => fixture({
        googleAdsRows: ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE.googleAdsRows.map((row, index) => (
          index === 0
            ? { ...row, mappedProductIds: [] }
            : row
        )),
      }),
    },
    {
      name: 'inventory/profit',
      sourceKey: 'inventory_profit',
      sourceBlocker: 'inventory_profit_not_ready_for_ads_automation_decision',
      readModelBlocker: 'read_model.product_performance_missing',
      input: () => fixture({ products: [] }),
    },
    {
      name: 'supplier safety',
      sourceKey: 'supplier_safety',
      sourceBlocker: 'supplier_safety_not_ready_for_ads_automation_decision',
      readModelBlocker: 'read_model.supplier_safety_missing',
      input: () => fixture({ suppliers: [] }),
    },
    {
      name: 'fresh Google Ads coverage',
      sourceKey: 'google_ads',
      sourceBlocker: 'google_ads_not_ready_for_ads_automation_decision',
      readModelBlocker: 'read_model.ads_performance_stale',
      input: () => fixture({
        googleAdsRows: ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE.googleAdsRows.map((row) => ({
          ...row,
          lastSuccessfulSyncAt: '2026-07-02T04:00:00.000Z',
        })),
      }),
    },
  ])(
    'blocks the local imported read model when $name evidence is missing',
    async (scenario) => {
      const response = await buildService().build(scenario.input());
      const coverage = response.importReadiness.sourceImportCoverage
        .find((item) => item.sourceKey === scenario.sourceKey);

      expect(response.safety).toEqual(expect.objectContaining({
        local_fixture_only: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      }));
      expect(response.importReadiness.summary).toEqual(expect.objectContaining({
        status: 'blocked',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }));
      expect(coverage).toEqual(expect.objectContaining({
        sourceKey: scenario.sourceKey,
        blockingReason: scenario.sourceBlocker,
        blockingReasons: expect.arrayContaining([scenario.sourceBlocker]),
        canUseForAdsAutomationDecision: false,
      }));
      expect(response.importReadiness.decisionReadiness).toEqual(expect.objectContaining({
        status: 'blocked',
        source_gate_status: 'blocked',
        read_model_status: 'blocked',
        action_generation_allowed_for_review: false,
        can_generate_action_draft: false,
        can_increase_ads: false,
        scale_up_execution_mode: 'monitor_only',
        execution_allowed_now: false,
      }));
      expect(response.importReadiness.decisionReadiness.source_gate_blockers).toEqual(expect.arrayContaining([
        scenario.sourceBlocker,
      ]));
      expect(response.importReadiness.decisionReadiness.read_model_blockers).toEqual(expect.arrayContaining([
        scenario.readModelBlocker,
      ]));
      expect(response.validateOnlyPreflight).toEqual(expect.objectContaining({
        status: 'blocked_before_validateOnly',
        pending_action_candidate_status: 'blocked_before_pending_action',
        source: 'erp_mock_import_read_model',
        pending_action_count: 0,
        blocked_source_keys: expect.arrayContaining([scenario.sourceKey]),
        campaignBudgetId_fallback_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }));
      expect(response.validateOnlyPreflight.blockers).toEqual(expect.arrayContaining([
        scenario.sourceBlocker,
        scenario.readModelBlocker,
      ]));
      expect(response.validateOnlyPreflight.candidates.some((candidate) =>
        candidate.provider_validateOnly_readiness === 'blocked_before_validateOnly'
          && candidate.blocked_source_keys.includes(scenario.sourceKey)
          && candidate.blockers.includes(scenario.sourceBlocker)
          && candidate.read_model_blockers.includes(scenario.readModelBlocker)
          && candidate.campaignBudgetId_fallback_used === false
          && candidate.validateOnly_called === false,
      )).toBe(true);
      expect(response.importReadiness.decisionReadiness.decision_categories.some((category) =>
        category.canGenerateActionDraft === false
          && (
            category.sourceBlockers.includes(scenario.sourceBlocker)
            || category.readModelBlockers.includes(scenario.readModelBlocker)
          ),
      )).toBe(true);
      expect(response.pendingActionNormalization.pendingActions.every((action) => (
        action.safety_flags.execution_allowed_now === false
        && action.safety_flags.google_ads_api_called === false
        && action.safety_flags.live_ads_execution_used === false
      ))).toBe(true);
    },
  );
});
