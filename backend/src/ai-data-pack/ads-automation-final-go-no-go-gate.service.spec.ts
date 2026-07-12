import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import { AdsAutomationFinalGoNoGoGateService } from './ads-automation-final-go-no-go-gate.service';
import { AdsAutomationFoundationAcceptanceMatrixService } from './ads-automation-foundation-acceptance-matrix.service';
import { AdsAutomationGoogleAdsDryRunReconciliationService } from './ads-automation-google-ads-dry-run-reconciliation.service';
import { AdsAutomationGoogleAdsMockImportDemoService } from './ads-automation-google-ads-mock-import-demo.service';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
import { AdsAutomationProviderValidateOnlyPlannerService } from './ads-automation-provider-validate-only-planner.service';
import { AdsAutomationReadonlyPlatformImportReadinessService } from './ads-automation-readonly-platform-import-readiness.service';
import type {
  AdsAutomationFoundationAcceptanceMatrixResponse,
} from './contracts/ads-automation-foundation-acceptance-matrix.contract';
import type {
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightGateFamilyKey,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';

const EXACT_BUCKET_KEYS = [
  'ready_for_demo_use',
  'blocked_until_real_readonly_import_credentials',
  'blocked_until_provider_validateOnly_adapter',
  'blocked_until_human_approval_ui',
  'blocked_until_small_cap_live_test',
  'not_in_mvp',
];

const REQUIRED_EXECUTION_GATE_FAMILIES: AdsAutomationExecutionPreflightGateFamilyKey[] = [
  'future_execution_action_scope',
  'approval_status',
  'approval_decision_audit',
  'source_readiness',
  'validateOnly',
  'finance_policy',
  'kill_switch',
  'idempotency',
  'production_flag',
  'provider_identifiers',
  'live_path',
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

function buildAcceptanceService(): AdsAutomationFoundationAcceptanceMatrixService {
  const mockImportService = buildMockImportService();
  return new AdsAutomationFoundationAcceptanceMatrixService(
    mockImportService,
    new AdsAutomationGoogleAdsDryRunReconciliationService(mockImportService),
  );
}

function buildService(): AdsAutomationFinalGoNoGoGateService {
  return new AdsAutomationFinalGoNoGoGateService(buildAcceptanceService());
}

function cloneResponse(
  value: AdsAutomationFoundationAcceptanceMatrixResponse,
): AdsAutomationFoundationAcceptanceMatrixResponse {
  return JSON.parse(
    JSON.stringify(value),
  ) as AdsAutomationFoundationAcceptanceMatrixResponse;
}

function bundledPreflightResponse(
  overrides: Partial<AdsAutomationExecutionPreflightDryRunResponse> = {},
): AdsAutomationExecutionPreflightDryRunResponse {
  const scaleApprovalId = 'ADSAPPROVAL-final-gate-scale-blocked';
  const pauseApprovalId = 'ADSAPPROVAL-final-gate-pause-safety';
  const monitorApprovalId = 'ADSAPPROVAL-final-gate-monitor-only';
  const blockerByFamily: Record<AdsAutomationExecutionPreflightGateFamilyKey, string[]> = {
    future_execution_action_scope: ['provider_google_ads_action'],
    approval_status: ['approved_action'],
    approval_decision_audit: ['approval_decision_audit_missing'],
    source_readiness: ['source_readiness.freshness_stale'],
    validateOnly: ['validateOnly_plan_found', 'validateOnly_passed'],
    finance_policy: ['policy_decision_missing'],
    kill_switch: ['kill_switch_active'],
    idempotency: ['idempotency_duplicate_record'],
    production_flag: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
    provider_identifiers: ['campaignBudgetId'],
    live_path: ['live_path_not_implemented'],
  };
  const scaleBlockers = Object.values(blockerByFamily).flat();
  const records = [
    {
      approval_id: scaleApprovalId,
      action_type: 'update_campaign_budget',
      validateOnly_status: 'missing',
      preflight_status: 'blocked_before_future_live_execution',
      blockers: scaleBlockers,
      gates: [
        { key: 'campaignBudgetId', status: 'blocked', detail: 'missing' },
      ],
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      production_ready: false,
      identifiers: {
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      },
      campaignBudgetId_fallback_used: false,
    },
    {
      approval_id: pauseApprovalId,
      action_type: 'pause_campaign',
      validateOnly_status: 'validate_only_passed',
      preflight_status: 'blocked_before_future_live_execution',
      blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED', 'live_path_not_implemented'],
      gates: [],
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      production_ready: false,
      identifiers: {
        campaignId: '1001',
        adGroupId: null,
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      },
      campaignBudgetId_fallback_used: false,
    },
    {
      approval_id: monitorApprovalId,
      action_type: 'monitor_only',
      validateOnly_status: 'missing',
      preflight_status: 'blocked_before_future_live_execution',
      blockers: ['provider_google_ads_action', 'GOOGLE_ADS_PRODUCTION_ENABLED', 'live_path_not_implemented'],
      gates: [],
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      production_ready: false,
      identifiers: {
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      },
      campaignBudgetId_fallback_used: false,
    },
  ] as any[];

  return {
    schemaVersion: 'ads_automation_execution_preflight_dry_run.v1',
    generatedAt: '2026-07-04T07:00:00.000Z',
    safety: {
      read_only: false,
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
      dry_run_execution_records_created: true,
      dry_run_execution_records_persisted: true,
      idempotency_enforced: true,
      live_path_implemented: false,
      provider_mutation_used: false,
      direct_google_ads_api_call: false,
      future_live_execution_requires_validateOnly_passed: true,
      future_live_execution_requires_approved_action: true,
      future_live_execution_requires_approval_decision_audit: true,
      future_live_execution_requires_source_readiness_safe: true,
      future_live_execution_requires_policy_allowed: true,
      future_live_execution_requires_kill_switch_off: true,
      future_live_execution_requires_safe_idempotency_key: true,
      future_live_execution_requires_GOOGLE_ADS_PRODUCTION_ENABLED_true: true,
      supported_mvp_actions_limited_to_update_budget_pause_campaign_pause_ad_group_monitor_only: true,
      monitor_only_visible_as_non_executable_safety_action: true,
      campaignBudgetId_no_fallback: true,
      validateOnly_id_linkage_supported: true,
      validateOnly_evidence_persistence_used: true,
      policy_decision_id_linkage_supported: true,
      policy_decision_evidence_persistence_used: true,
    },
    summary: {
      approvals_requested: 3,
      approvals_loaded: 3,
      records_created: 3,
      supported_action_records: 3,
      unsupported_action_records: 0,
      future_live_gates_passed_local_only: 0,
      blocked_before_future_live_execution: 3,
      dry_run_records_created: 3,
      dry_run_records_persisted: 3,
      idempotent_records_reused: 1,
      idempotent_duplicate_records_blocked: 1,
      approval_decision_audit_records_received: 2,
      source_readiness_blocked_records: 1,
      kill_switch_blocked_records: 1,
      safety_action_records_visible: 2,
      pause_safety_records_visible: 1,
      monitor_only_safety_records_visible: 1,
      gate_families_checked: REQUIRED_EXECUTION_GATE_FAMILIES.length,
      gate_families_blocked: REQUIRED_EXECUTION_GATE_FAMILIES.length,
      validateOnly_validation_id_references_requested: 0,
      validateOnly_evidence_records_loaded: 0,
      validateOnly_evidence_records_persisted: 1,
      validateOnly_evidence_records_reused: 0,
      policy_decision_id_references_requested: 0,
      policy_decision_records_loaded: 0,
      policy_decision_records_persisted: 1,
      policy_decision_records_reused: 0,
      executable_now: 0,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'fix_preflight_blockers_before_future_execution',
    },
    gateFamilyEvidence: REQUIRED_EXECUTION_GATE_FAMILIES.map((key) => ({
      key,
      status: 'blocked',
      records_checked: records.length,
      records_blocked: key === 'production_flag' || key === 'live_path' ? records.length : 1,
      blocked_approval_ids: key === 'production_flag' || key === 'live_path'
        ? [monitorApprovalId, pauseApprovalId, scaleApprovalId].sort()
        : [scaleApprovalId],
      blocker_keys: blockerByFamily[key],
    })),
    executionRecords: records,
    ...overrides,
  } as AdsAutomationExecutionPreflightDryRunResponse;
}

describe('AdsAutomationFinalGoNoGoGateService', () => {
  it('emits the exact final go/no-go buckets and stops the Codex foundation loop for the local demo', async () => {
    const response = await buildService().build();

    expect(response.schemaVersion).toBe(
      'ads_automation_final_go_no_go_gate.v1',
    );
    expect(Object.keys(response.buckets)).toEqual(EXACT_BUCKET_KEYS);
    expect(response.summary).toEqual(
      expect.objectContaining({
        decision: 'GO_LOCAL_DEMO_USE_STOP_CODEX_FOUNDATION_LOOP',
        bucket_count: 6,
        local_gate_passed: true,
        ready_for_demo_use: true,
        blocked_until_real_readonly_import_credentials: true,
        blocked_until_provider_validateOnly_adapter: true,
        blocked_until_human_approval_ui: true,
        blocked_until_small_cap_live_test: true,
        foundation_closeout_status:
          'complete_demo_ready_for_final_go_no_go',
        ba_control_questions: 9,
        ba_control_questions_complete_demo: 9,
        live_readiness_blockers: 4,
        final_live_execution_status: 'blocked_before_future_live_execution',
        execution_blocker_families_blocked: 2,
        final_live_blockers: expect.arrayContaining([
          'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
          'live_path_not_implemented',
        ]),
        safety_action_records_visible: expect.any(Number),
        execution_ready_now_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        stop_codex_foundation_loop: true,
        next_codex_prompt: null,
      }),
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
    expect(response.localDefects).toEqual([]);
    expect(response.executionGateEvidence).toEqual(expect.objectContaining({
      evidence_source: 'foundation_acceptance_matrix',
      final_live_execution_status: 'blocked_before_future_live_execution',
      blocked_gate_families: ['production_flag', 'live_path'],
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.nextRecommendation).toBe('STOP_CODEX_FOUNDATION_LOOP');
    expect(response.buckets.ready_for_demo_use).toEqual(
      expect.objectContaining({
        status: 'ready_for_demo_use',
        go_no_go: 'GO',
        production_ready: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.buckets.blocked_until_real_readonly_import_credentials.status).toBe(
      'blocked_before_live',
    );
    expect(response.buckets.blocked_until_provider_validateOnly_adapter.status).toBe(
      'blocked_before_live',
    );
    expect(response.buckets.blocked_until_human_approval_ui.status).toBe(
      'blocked_before_live',
    );
    expect(response.buckets.blocked_until_small_cap_live_test.status).toBe(
      'blocked_before_live',
    );
    expect(response.buckets.not_in_mvp).toEqual(
      expect.objectContaining({
        status: 'not_in_mvp',
        go_no_go: 'NO_GO_SCOPE',
        evidence: expect.arrayContaining([
          'excluded=Performance Max',
          'excluded=Shopping',
          'excluded=Display',
          'excluded=YouTube',
          'excluded=auto-publish',
          'excluded=create live campaign',
          'excluded=delete campaign/ad group/ad',
        ]),
      }),
    );
    expect(response.foundationEvidence).toEqual(
      expect.objectContaining({
        matrix_items: 13,
        safe_pending_actions: 7,
        unsafe_pending_actions: 6,
        safe_provider_actions: 2,
        unsafe_provider_actions: 1,
        safe_alert_rollback_records: 5,
        unsafe_alert_rollback_records: 4,
      }),
    );
  });

  it('accepts a bundled execution preflight response with every gate family blocked and safety actions visible', async () => {
    const response = await buildService().build({
      executionPreflightResponse: bundledPreflightResponse(),
    });

    expect(response.summary).toEqual(expect.objectContaining({
      decision: 'GO_LOCAL_DEMO_USE_STOP_CODEX_FOUNDATION_LOOP',
      local_gate_passed: true,
      final_live_execution_status: 'blocked_before_future_live_execution',
      execution_blocker_families_blocked: REQUIRED_EXECUTION_GATE_FAMILIES.length,
      final_live_blockers: expect.arrayContaining([
        'approved_action',
        'approval_decision_audit_missing',
        'source_readiness.freshness_stale',
        'validateOnly_plan_found',
        'validateOnly_passed',
        'policy_decision_missing',
        'kill_switch_active',
        'idempotency_duplicate_record',
        'GOOGLE_ADS_PRODUCTION_ENABLED',
        'campaignBudgetId',
        'live_path_not_implemented',
      ]),
      safety_action_records_visible: 2,
      execution_ready_now_actions: 0,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.localDefects).toEqual([]);
    expect(response.executionGateEvidence).toEqual(expect.objectContaining({
      evidence_source: 'execution_preflight_response',
      required_gate_families: REQUIRED_EXECUTION_GATE_FAMILIES,
      blocked_gate_families: REQUIRED_EXECUTION_GATE_FAMILIES,
      missing_required_gate_family_evidence: [],
      execution_records_checked: 3,
      blocked_execution_records: 3,
      executable_now_actions: 0,
      validateOnly_missing_or_blocked_records: 1,
      validateOnly_passed_records: 1,
      approval_missing_or_blocked_records: 1,
      approval_audit_missing_or_blocked_records: 1,
      source_readiness_blocked_records: 1,
      finance_policy_blocked_records: 1,
      kill_switch_blocked_records: 1,
      idempotency_blocked_records: 1,
      campaignBudgetId_blocked_records: 1,
      production_flag_blocked_records: 3,
      live_path_blocked_records: 3,
      scale_candidate_blocker_families: REQUIRED_EXECUTION_GATE_FAMILIES,
      pause_safety_records_visible: 1,
      monitor_only_safety_records_visible: 1,
      safety_action_records_visible: 2,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(response.buckets.ready_for_demo_use).toEqual(expect.objectContaining({
      status: 'ready_for_demo_use',
      go_no_go: 'GO',
      execution_allowed_now: false,
      production_ready: false,
    }));
  });

  it('turns the ready bucket to no-go when required preflight gate evidence is missing', async () => {
    const preflight = bundledPreflightResponse();
    preflight.gateFamilyEvidence = preflight.gateFamilyEvidence.filter(
      (family) => family.key !== 'live_path',
    );
    preflight.executionRecords = preflight.executionRecords.filter(
      (record) => record.action_type !== 'pause_campaign'
        && record.action_type !== 'monitor_only',
    ).map((record) => ({
      ...record,
      blockers: record.blockers.filter((blocker) =>
        blocker !== 'live_path_not_implemented'),
    }));

    const response = await buildService().build({
      executionPreflightResponse: preflight,
    });

    expect(response.summary).toEqual(expect.objectContaining({
      decision: 'NO_GO_FIX_LOCAL_FOUNDATION_GAPS',
      local_gate_passed: false,
      ready_for_demo_use: false,
      stop_codex_foundation_loop: false,
      next_codex_prompt: 'FIX_LOCAL_FOUNDATION_GAPS',
    }));
    expect(response.localDefects).toEqual(expect.arrayContaining([
      'execution_preflight_required_gate_family_evidence_missing',
      'execution_preflight_safety_actions_not_visible',
      'execution_preflight_live_path_blocker_missing',
    ]));
    expect(response.executionGateEvidence.missing_required_gate_family_evidence)
      .toEqual(['live_path']);
    expect(response.buckets.ready_for_demo_use).toEqual(expect.objectContaining({
      status: 'no_go_local_defect',
      go_no_go: 'NO_GO',
      blockers: expect.arrayContaining([
        'execution_preflight_required_gate_family_evidence_missing',
        'execution_preflight_safety_actions_not_visible',
        'execution_preflight_live_path_blocker_missing',
      ]),
      execution_allowed_now: false,
      production_ready: false,
    }));
  });

  it('turns the ready bucket to no-go when a local safety gate opens', async () => {
    const acceptance = await buildAcceptanceService().build();
    const tampered = cloneResponse(acceptance) as any;
    tampered.summary.production_ready = true;
    tampered.matrix[0].provider_api_called = true;

    const response = await buildService().build({
      acceptanceMatrixResponse: tampered,
    });

    expect(Object.keys(response.buckets)).toEqual(EXACT_BUCKET_KEYS);
    expect(response.summary).toEqual(
      expect.objectContaining({
        decision: 'NO_GO_FIX_LOCAL_FOUNDATION_GAPS',
        local_gate_passed: false,
        ready_for_demo_use: false,
        production_ready: false,
        stop_codex_foundation_loop: false,
        next_codex_prompt: 'FIX_LOCAL_FOUNDATION_GAPS',
      }),
    );
    expect(response.nextRecommendation).toBe('FIX_LOCAL_BLOCKING_DEFECTS');
    expect(response.localDefects).toEqual(
      expect.arrayContaining([
        'item.may_ads_increase.provider_api_called',
        'summary.production_ready',
      ]),
    );
    expect(response.buckets.ready_for_demo_use).toEqual(
      expect.objectContaining({
        status: 'no_go_local_defect',
        go_no_go: 'NO_GO',
        blockers: expect.arrayContaining([
          'item.may_ads_increase.provider_api_called',
          'summary.production_ready',
        ]),
        production_ready: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
  });
});
