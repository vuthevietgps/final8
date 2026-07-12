import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import { AdsAutomationFoundationAcceptanceMatrixService } from './ads-automation-foundation-acceptance-matrix.service';
import { AdsAutomationGoogleAdsDryRunReconciliationService } from './ads-automation-google-ads-dry-run-reconciliation.service';
import { ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE } from './ads-automation-google-ads-mock-import-demo.fixture';
import { AdsAutomationGoogleAdsMockImportDemoService } from './ads-automation-google-ads-mock-import-demo.service';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
import { AdsAutomationProviderValidateOnlyPlannerService } from './ads-automation-provider-validate-only-planner.service';
import { AdsAutomationReadonlyPlatformImportReadinessService } from './ads-automation-readonly-platform-import-readiness.service';
import type {
  AdsAutomationFoundationAcceptanceCapabilityKey,
  AdsAutomationFoundationAcceptanceMatrixResponse,
} from './contracts/ads-automation-foundation-acceptance-matrix.contract';
import type {
  AdsAutomationGoogleAdsMockImportDemoInput,
  AdsAutomationGoogleAdsMockImportDemoResponse,
} from './contracts/ads-automation-google-ads-mock-import-demo.contract';

const BA_KEYS: AdsAutomationFoundationAcceptanceCapabilityKey[] = [
  'may_ads_increase',
  'increase_amount',
  'target_campaigns_ad_groups',
  'product_budget_allocation',
  'supplier_safety',
  'kill_stop_import_review',
  'pause_reduce_candidates',
  'monitor_only_downgrade',
  'rollback_alert_evidence',
];

function buildMockImportService(): AdsAutomationGoogleAdsMockImportDemoService {
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

function buildService(): AdsAutomationFoundationAcceptanceMatrixService {
  const mockImportService = buildMockImportService();
  return new AdsAutomationFoundationAcceptanceMatrixService(
    mockImportService,
    new AdsAutomationGoogleAdsDryRunReconciliationService(mockImportService),
  );
}

function fixture(
  overrides: Partial<AdsAutomationGoogleAdsMockImportDemoInput> = {},
): AdsAutomationGoogleAdsMockImportDemoInput {
  return {
    ...JSON.parse(
      JSON.stringify(ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE),
    ),
    ...overrides,
  };
}

function cloneResponse(
  value: AdsAutomationGoogleAdsMockImportDemoResponse,
): AdsAutomationGoogleAdsMockImportDemoResponse {
  return JSON.parse(
    JSON.stringify(value),
  ) as AdsAutomationGoogleAdsMockImportDemoResponse;
}

function byKey(response: AdsAutomationFoundationAcceptanceMatrixResponse) {
  return new Map(response.matrix.map((item) => [item.key, item]));
}

describe('AdsAutomationFoundationAcceptanceMatrixService', () => {
  it('proves the local ads automation foundation BA matrix is complete while live gates stay blocked', async () => {
    const response = await buildService().build();
    const matrix = byKey(response);

    expect(response.schemaVersion).toBe(
      'ads_automation_foundation_acceptance_matrix.v1',
    );
    expect(response.safety).toEqual(
      expect.objectContaining({
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
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        campaignBudgetId_no_fallback: true,
        approval_required_for_all_actions: true,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
        future_live_execution_allowed: false,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        foundation_closeout_status:
          'complete_demo_ready_for_final_go_no_go',
        matrix_items: 13,
        ba_control_questions: 9,
        ba_control_questions_complete_demo: 9,
        live_readiness_blockers: 4,
        safe_pending_actions: 7,
        unsafe_pending_actions: 6,
        safe_provider_actions: 2,
        unsafe_provider_actions: 1,
        safe_alert_rollback_records: 5,
        unsafe_alert_rollback_records: 4,
        execution_ready_now_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_prompt: 'ADS_AUTOMATION_FINAL_GO_NO_GO_GATE_LOCAL_ONLY',
      }),
    );
    expect(response.sourceEvidence.safe).toEqual(
      expect.objectContaining({
        cashflowMode: 'safe',
        scale_up_execution_mode: 'pending_validation',
        update_budget_actions: 1,
        pause_actions: 1,
      }),
    );
    expect(response.sourceEvidence.unsafe).toEqual(
      expect.objectContaining({
        cashflowMode: 'unsafe',
        scale_up_execution_mode: 'monitor_only',
        update_budget_actions: 0,
        monitor_only_actions: 2,
      }),
    );

    for (const key of BA_KEYS) {
      expect(matrix.get(key)).toEqual(
        expect.objectContaining({
          status: 'complete_demo',
          ba_control_question: true,
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          production_ready: false,
        }),
      );
    }

    expect(matrix.get('target_campaigns_ad_groups')?.evidence).toEqual(
      expect.objectContaining({
        campaignIds: ['1001'],
        adGroupIds: ['2001'],
        campaignBudgetIds: ['3001'],
      }),
    );
    expect(matrix.get('product_budget_allocation')?.evidence.productIds).toEqual(
      expect.arrayContaining(['P_SCALE', 'P_BAD']),
    );
    expect(matrix.get('supplier_safety')?.evidence.supplierIds).toEqual(
      expect.arrayContaining(['SUP_WEAK_1']),
    );
    expect(matrix.get('monitor_only_downgrade')?.evidence.notes).toEqual(
      expect.arrayContaining([
        'risk_blockers=cashflow_gate_blocked',
        'unsafe_update_budget_present=false',
      ]),
    );
    expect(matrix.get('real_credentials_gate')?.status).toBe(
      'blocked_until_real_credentials',
    );
    expect(matrix.get('real_provider_validateOnly_gate')?.status).toBe(
      'blocked_until_real_provider_validateOnly',
    );
    expect(matrix.get('approval_ui_gate')?.status).toBe(
      'blocked_until_approval_ui',
    );
    expect(matrix.get('small_cap_live_test_gate')?.status).toBe(
      'blocked_until_small_cap_live_test',
    );
  });

  it('keeps the foundation open when rollback alert evidence is missing', async () => {
    const mockImportService = buildMockImportService();
    const safeDemo = await mockImportService.build();
    const tamperedSafeDemo = cloneResponse(safeDemo);
    const updateBudget =
      tamperedSafeDemo.pendingActionNormalization.pendingActions.find(
        (action) => action.action_type === 'update_campaign_budget',
      )!;
    tamperedSafeDemo.alertRollbackEvidence =
      tamperedSafeDemo.alertRollbackEvidence.filter(
        (record) => record.pending_action_id !== updateBudget.pending_action_id,
      );

    const response = await buildService().build({
      safeDemoResponse: tamperedSafeDemo,
    });
    const rollbackRow = byKey(response).get('rollback_alert_evidence');

    expect(response.summary).toEqual(
      expect.objectContaining({
        foundation_closeout_status: 'gaps_found_keep_foundation_open',
        ba_control_questions_complete_demo: 8,
        next_prompt: 'FIX_LOCAL_FOUNDATION_GAPS',
        execution_ready_now_actions: 0,
        production_ready: false,
      }),
    );
    expect(rollbackRow).toEqual(
      expect.objectContaining({
        status: 'blocked_until_approval_ui',
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        production_ready: false,
      }),
    );
    expect(rollbackRow?.blockers).toEqual(
      expect.arrayContaining([
        `alert_rollback_evidence_missing:${updateBudget.pending_action_id}`,
      ]),
    );
  });

  it('keeps campaignBudgetId no-fallback as a closeout blocker', async () => {
    const mockImportService = buildMockImportService();
    const safeDemo = await mockImportService.build();
    const tamperedSafeDemo = cloneResponse(safeDemo);
    const updateBudget =
      tamperedSafeDemo.pendingActionNormalization.pendingActions.find(
        (action) => action.action_type === 'update_campaign_budget',
      )!;
    updateBudget.campaignBudgetId = null;

    const response = await buildService().build({
      safeDemoResponse: tamperedSafeDemo,
      unsafeDemoInput: fixture({ cashflowMode: 'unsafe' }),
    });
    const targetRow = byKey(response).get('target_campaigns_ad_groups');

    expect(response.summary).toEqual(
      expect.objectContaining({
        foundation_closeout_status: 'gaps_found_keep_foundation_open',
        execution_ready_now_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(targetRow).toEqual(
      expect.objectContaining({
        status: 'blocked_until_approval_ui',
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        production_ready: false,
      }),
    );
    expect(targetRow?.blockers).toEqual(
      expect.arrayContaining([
        'campaignBudgetId_missing_no_fallback',
        'identifier_mismatch',
        'target_campaign_ad_group_or_campaignBudgetId_missing',
      ]),
    );
    expect(targetRow?.evidence.notes).toEqual(
      expect.arrayContaining(['campaignBudgetId=missing']),
    );
  });
});
