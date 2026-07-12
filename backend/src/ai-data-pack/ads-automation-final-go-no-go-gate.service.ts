import { Injectable } from '@nestjs/common';
import { AdsAutomationFoundationAcceptanceMatrixService } from './ads-automation-foundation-acceptance-matrix.service';
import type {
  AdsAutomationFoundationAcceptanceCapabilityKey,
  AdsAutomationFoundationAcceptanceMatrixItem,
  AdsAutomationFoundationAcceptanceMatrixResponse,
} from './contracts/ads-automation-foundation-acceptance-matrix.contract';
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightGateFamilyEvidence,
  AdsAutomationExecutionPreflightGateFamilyKey,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type {
  AdsAutomationFinalGoNoGoBucket,
  AdsAutomationFinalGoNoGoBucketKey,
  AdsAutomationFinalGoNoGoExecutionGateEvidence,
  AdsAutomationFinalGoNoGoGateInput,
  AdsAutomationFinalGoNoGoGateResponse,
} from './contracts/ads-automation-final-go-no-go-gate.contract';

const EXACT_BUCKET_KEYS: AdsAutomationFinalGoNoGoBucketKey[] = [
  'ready_for_demo_use',
  'blocked_until_real_readonly_import_credentials',
  'blocked_until_provider_validateOnly_adapter',
  'blocked_until_human_approval_ui',
  'blocked_until_small_cap_live_test',
  'not_in_mvp',
];

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

const GLOBAL_CLOSED_EXECUTION_BLOCKERS = [
  'GOOGLE_ADS_PRODUCTION_ENABLED',
  'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
  'live_path_not_implemented',
  'execution_allowed_now=false',
  'production_ready=false',
];

const LIVE_GATE_STATUSES: Partial<Record<
  AdsAutomationFoundationAcceptanceCapabilityKey,
  AdsAutomationFoundationAcceptanceMatrixItem['status']
>> = {
  real_credentials_gate: 'blocked_until_real_credentials',
  real_provider_validateOnly_gate: 'blocked_until_real_provider_validateOnly',
  approval_ui_gate: 'blocked_until_approval_ui',
  small_cap_live_test_gate: 'blocked_until_small_cap_live_test',
};

const NOT_IN_MVP_ITEMS = [
  'Performance Max',
  'Shopping',
  'Display',
  'YouTube',
  'delete campaign/ad group/ad',
  'create live campaign',
  'auto-publish',
];

@Injectable()
export class AdsAutomationFinalGoNoGoGateService {
  constructor(
    private readonly acceptanceMatrixService: AdsAutomationFoundationAcceptanceMatrixService,
  ) {}

  async build(
    input: AdsAutomationFinalGoNoGoGateInput = {},
  ): Promise<AdsAutomationFinalGoNoGoGateResponse> {
    const matrix = input.acceptanceMatrixResponse
      ? this.cloneJson(input.acceptanceMatrixResponse)
      : await this.acceptanceMatrixService.build();
    const executionGateEvidence = this.executionGateEvidence(
      matrix,
      input.executionPreflightResponse,
    );
    const localDefects = this.localDefects(
      matrix,
      executionGateEvidence,
      Boolean(input.executionPreflightResponse),
    );
    const localGatePassed = localDefects.length === 0;
    const buckets = this.buckets(matrix, localGatePassed, localDefects);

    return {
      schemaVersion: 'ads_automation_final_go_no_go_gate.v1',
      generatedAt: new Date().toISOString(),
      reportDate: matrix.reportDate,
      sourceAcceptanceMatrixSchemaVersion: matrix.schemaVersion,
      safety: this.safety(),
      summary: {
        decision: localGatePassed
          ? 'GO_LOCAL_DEMO_USE_STOP_CODEX_FOUNDATION_LOOP'
          : 'NO_GO_FIX_LOCAL_FOUNDATION_GAPS',
        bucket_count: EXACT_BUCKET_KEYS.length as 6,
        local_gate_passed: localGatePassed,
        ready_for_demo_use: localGatePassed,
        blocked_until_real_readonly_import_credentials: true,
        blocked_until_provider_validateOnly_adapter: true,
        blocked_until_human_approval_ui: true,
        blocked_until_small_cap_live_test: true,
        not_in_mvp_count: NOT_IN_MVP_ITEMS.length,
        foundation_closeout_status: matrix.summary.foundation_closeout_status,
        ba_control_questions: matrix.summary.ba_control_questions,
        ba_control_questions_complete_demo:
          matrix.summary.ba_control_questions_complete_demo,
        live_readiness_blockers: matrix.summary.live_readiness_blockers,
        final_live_execution_status:
          executionGateEvidence.final_live_execution_status,
        execution_blocker_families_blocked:
          executionGateEvidence.blocked_gate_families.length,
        final_live_blockers: executionGateEvidence.final_live_blockers,
        safety_action_records_visible:
          executionGateEvidence.safety_action_records_visible,
        execution_ready_now_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        stop_codex_foundation_loop: localGatePassed,
        next_codex_prompt: localGatePassed ? null : 'FIX_LOCAL_FOUNDATION_GAPS',
      },
      buckets,
      localDefects,
      executionGateEvidence,
      foundationEvidence: {
        safeImportRunId: matrix.safeImportRunId,
        unsafeImportRunId: matrix.unsafeImportRunId,
        matrix_items: matrix.summary.matrix_items,
        safe_pending_actions: matrix.summary.safe_pending_actions,
        unsafe_pending_actions: matrix.summary.unsafe_pending_actions,
        safe_provider_actions: matrix.summary.safe_provider_actions,
        unsafe_provider_actions: matrix.summary.unsafe_provider_actions,
        safe_alert_rollback_records:
          matrix.summary.safe_alert_rollback_records,
        unsafe_alert_rollback_records:
          matrix.summary.unsafe_alert_rollback_records,
      },
      nextRecommendation: localGatePassed
        ? 'STOP_CODEX_FOUNDATION_LOOP'
        : 'FIX_LOCAL_BLOCKING_DEFECTS',
    };
  }

  private localDefects(
    matrix: AdsAutomationFoundationAcceptanceMatrixResponse,
    executionGateEvidence: AdsAutomationFinalGoNoGoExecutionGateEvidence,
    requireExecutionPreflightEvidence: boolean,
  ): string[] {
    const defects: string[] = [];
    const matrixByKey = new Map(matrix.matrix.map((item) => [item.key, item]));

    this.expect(
      defects,
      matrix.schemaVersion === 'ads_automation_foundation_acceptance_matrix.v1',
      'acceptance_matrix_schema_version',
    );
    this.expect(
      defects,
      matrix.summary.foundation_closeout_status ===
        'complete_demo_ready_for_final_go_no_go',
      'foundation_closeout_status_not_complete',
    );
    this.expect(
      defects,
      matrix.summary.ba_control_questions === BA_KEYS.length,
      'ba_control_question_count',
    );
    this.expect(
      defects,
      matrix.summary.ba_control_questions_complete_demo === BA_KEYS.length,
      'ba_control_questions_not_complete_demo',
    );
    this.expect(
      defects,
      matrix.summary.live_readiness_blockers ===
        Object.keys(LIVE_GATE_STATUSES).length,
      'live_readiness_blocker_count',
    );
    this.expect(
      defects,
      matrix.summary.execution_ready_now_actions === 0,
      'execution_ready_now_actions_not_zero',
    );
    this.expectFalse(defects, matrix.summary.provider_api_called, 'summary.provider_api_called');
    this.expectFalse(defects, matrix.summary.google_ads_api_called, 'summary.google_ads_api_called');
    this.expectFalse(defects, matrix.summary.validateOnly_called, 'summary.validateOnly_called');
    this.expectFalse(defects, matrix.summary.live_ads_execution_used, 'summary.live_ads_execution_used');
    this.expectFalse(defects, matrix.summary.execution_allowed_now, 'summary.execution_allowed_now');
    this.expectFalse(defects, matrix.summary.production_ready, 'summary.production_ready');

    this.expect(
      defects,
      matrix.safety.read_only === true,
      'safety.read_only_not_true',
    );
    this.expect(
      defects,
      matrix.safety.dry_run === true,
      'safety.dry_run_not_true',
    );
    this.expect(
      defects,
      matrix.safety.local_fixture_only === true,
      'safety.local_fixture_only_not_true',
    );
    this.expect(
      defects,
      matrix.safety.campaignBudgetId_no_fallback === true,
      'safety.campaignBudgetId_no_fallback_not_true',
    );
    this.expect(
      defects,
      matrix.safety.approval_required_for_all_actions === true,
      'safety.approval_required_for_all_actions_not_true',
    );
    this.expectFalse(defects, matrix.safety.provider_api_called, 'safety.provider_api_called');
    this.expectFalse(defects, matrix.safety.provider_api_used, 'safety.provider_api_used');
    this.expectFalse(defects, matrix.safety.google_ads_api_called, 'safety.google_ads_api_called');
    this.expectFalse(defects, matrix.safety.google_ads_api_used, 'safety.google_ads_api_used');
    this.expectFalse(defects, matrix.safety.validateOnly_called, 'safety.validateOnly_called');
    this.expectFalse(defects, matrix.safety.validate_only_provider_call_used, 'safety.validate_only_provider_call_used');
    this.expectFalse(defects, matrix.safety.live_ads_execution_used, 'safety.live_ads_execution_used');
    this.expectFalse(defects, matrix.safety.erp_mutation_used, 'safety.erp_mutation_used');
    this.expectFalse(defects, matrix.safety.payment_mutation_used, 'safety.payment_mutation_used');
    this.expectFalse(defects, matrix.safety.order_mutation_used, 'safety.order_mutation_used');
    this.expectFalse(defects, matrix.safety.inventory_mutation_used, 'safety.inventory_mutation_used');
    this.expectFalse(defects, matrix.safety.execution_allowed_now, 'safety.execution_allowed_now');
    this.expectFalse(defects, matrix.safety.GOOGLE_ADS_PRODUCTION_ENABLED, 'safety.GOOGLE_ADS_PRODUCTION_ENABLED');
    this.expectFalse(defects, matrix.safety.production_ready, 'safety.production_ready');
    this.expectFalse(defects, matrix.safety.future_live_execution_allowed, 'safety.future_live_execution_allowed');

    for (const key of BA_KEYS) {
      const item = matrixByKey.get(key);
      this.expect(defects, Boolean(item), `missing_ba_item.${key}`);
      if (!item) continue;
      this.expect(
        defects,
        item.ba_control_question === true,
        `ba_item_not_marked_control_question.${key}`,
      );
      this.expect(
        defects,
        item.status === 'complete_demo',
        `ba_item_not_complete_demo.${key}`,
      );
      this.expect(
        defects,
        item.blockers.length === 0,
        `ba_item_has_blockers.${key}`,
      );
      this.expectItemSafe(defects, key, item);
    }

    for (const [key, expectedStatus] of Object.entries(LIVE_GATE_STATUSES)) {
      const item = matrixByKey.get(
        key as AdsAutomationFoundationAcceptanceCapabilityKey,
      );
      this.expect(defects, Boolean(item), `missing_live_gate.${key}`);
      if (!item) continue;
      this.expect(
        defects,
        item.ba_control_question === false,
        `live_gate_marked_ba_question.${key}`,
      );
      this.expect(
        defects,
        item.status === expectedStatus,
        `live_gate_wrong_status.${key}`,
      );
      this.expectItemSafe(defects, key, item);
    }

    if (requireExecutionPreflightEvidence) {
      defects.push(...this.executionGateDefects(executionGateEvidence));
    }

    return this.unique(defects);
  }

  private executionGateEvidence(
    matrix: AdsAutomationFoundationAcceptanceMatrixResponse,
    executionPreflightResponse?: AdsAutomationExecutionPreflightDryRunResponse,
  ): AdsAutomationFinalGoNoGoExecutionGateEvidence {
    if (!executionPreflightResponse) {
      const gateStatuses = this.defaultExecutionGateStatuses();
      return {
        schemaVersion: 'ads_automation_final_go_no_go_execution_gate_evidence.v1',
        evidence_source: 'foundation_acceptance_matrix',
        final_live_execution_status: 'blocked_before_future_live_execution',
        required_gate_families: [...REQUIRED_EXECUTION_GATE_FAMILIES],
        blocked_gate_families: gateStatuses
          .filter((family) => family.status === 'blocked')
          .map((family) => family.key),
        missing_required_gate_family_evidence: REQUIRED_EXECUTION_GATE_FAMILIES
          .filter((key) => !gateStatuses.some((family) => family.key === key)),
        gate_family_statuses: gateStatuses,
        execution_records_checked: 0,
        blocked_execution_records: 0,
        execution_ready_now_actions: 0,
        executable_now_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        final_live_blockers: this.unique([
          'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
          'live_path_not_implemented',
          ...matrix.matrix.flatMap((item) => item.blockers),
        ]),
        validateOnly_missing_or_blocked_records: 0,
        validateOnly_passed_records: 0,
        approval_missing_or_blocked_records: 0,
        approval_audit_missing_or_blocked_records: 0,
        source_readiness_blocked_records: 0,
        finance_policy_blocked_records: 0,
        kill_switch_blocked_records: 0,
        idempotency_blocked_records: 0,
        campaignBudgetId_blocked_records: 0,
        production_flag_blocked_records: 0,
        live_path_blocked_records: 0,
        scale_candidate_blocker_families: [],
        pause_safety_records_visible:
          matrix.sourceEvidence.safe.pause_actions
          + matrix.sourceEvidence.unsafe.pause_actions,
        monitor_only_safety_records_visible:
          matrix.sourceEvidence.safe.monitor_only_actions
          + matrix.sourceEvidence.unsafe.monitor_only_actions,
        safety_action_records_visible:
          matrix.sourceEvidence.safe.pause_actions
          + matrix.sourceEvidence.unsafe.pause_actions
          + matrix.sourceEvidence.safe.monitor_only_actions
          + matrix.sourceEvidence.unsafe.monitor_only_actions,
      };
    }

    const preflight = this.cloneJson(executionPreflightResponse);
    const records = Array.isArray(preflight.executionRecords)
      ? preflight.executionRecords
      : [];
    const rawGateFamilyKeys = new Set(
      (preflight.gateFamilyEvidence || []).map((family) => family.key),
    );
    const gateStatuses = this.completeGateFamilyStatuses(
      preflight.gateFamilyEvidence || [],
      records.length,
    );
    const blockedGateFamilies = gateStatuses
      .filter((family) => family.status === 'blocked')
      .map((family) => family.key);
    const missingGateEvidence = REQUIRED_EXECUTION_GATE_FAMILIES.filter(
      (key) => !rawGateFamilyKeys.has(key),
    );
    const scaleApprovalIds = new Set(records
      .filter((record) => record.action_type === 'update_campaign_budget')
      .map((record) => record.approval_id));

    return {
      schemaVersion: 'ads_automation_final_go_no_go_execution_gate_evidence.v1',
      evidence_source: 'execution_preflight_response',
      final_live_execution_status: 'blocked_before_future_live_execution',
      required_gate_families: [...REQUIRED_EXECUTION_GATE_FAMILIES],
      blocked_gate_families: blockedGateFamilies,
      missing_required_gate_family_evidence: missingGateEvidence,
      gate_family_statuses: gateStatuses,
      execution_records_checked: records.length,
      blocked_execution_records: records.filter((record) =>
        record.preflight_status === 'blocked_before_future_live_execution',
      ).length,
      execution_ready_now_actions: 0,
      executable_now_actions: 0,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      final_live_blockers: this.unique([
        ...gateStatuses.flatMap((family) => family.blocker_keys),
        ...records.flatMap((record) => record.blockers || []),
      ]),
      validateOnly_missing_or_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'validateOnly'),
      validateOnly_passed_records: records.filter((record) =>
        record.validateOnly_status === 'validate_only_passed',
      ).length,
      approval_missing_or_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'approval_status'),
      approval_audit_missing_or_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'approval_decision_audit'),
      source_readiness_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'source_readiness'),
      finance_policy_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'finance_policy'),
      kill_switch_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'kill_switch'),
      idempotency_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'idempotency'),
      campaignBudgetId_blocked_records:
        this.recordsBlockedByGate(records, 'campaignBudgetId'),
      production_flag_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'production_flag'),
      live_path_blocked_records:
        this.recordsBlockedByFamily(gateStatuses, 'live_path'),
      scale_candidate_blocker_families: gateStatuses
        .filter((family) =>
          family.status === 'blocked'
          && family.blocked_approval_ids.some((approvalId) =>
            scaleApprovalIds.has(approvalId)),
        )
        .map((family) => family.key),
      pause_safety_records_visible: records.filter((record) =>
        record.action_type === 'pause_campaign'
        || record.action_type === 'pause_ad_group',
      ).length,
      monitor_only_safety_records_visible: records.filter((record) =>
        record.action_type === 'monitor_only',
      ).length,
      safety_action_records_visible: records.filter((record) =>
        record.action_type === 'pause_campaign'
        || record.action_type === 'pause_ad_group'
        || record.action_type === 'monitor_only',
      ).length,
    };
  }

  private defaultExecutionGateStatuses():
    AdsAutomationExecutionPreflightGateFamilyEvidence[] {
    return [
      {
        key: 'production_flag',
        status: 'blocked',
        records_checked: 0,
        records_blocked: 0,
        blocked_approval_ids: [],
        blocker_keys: ['GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent'],
      },
      {
        key: 'live_path',
        status: 'blocked',
        records_checked: 0,
        records_blocked: 0,
        blocked_approval_ids: [],
        blocker_keys: ['live_path_not_implemented'],
      },
    ];
  }

  private completeGateFamilyStatuses(
    families: AdsAutomationExecutionPreflightGateFamilyEvidence[],
    recordsChecked: number,
  ): AdsAutomationExecutionPreflightGateFamilyEvidence[] {
    const byKey = new Map(families.map((family) => [family.key, family]));
    return REQUIRED_EXECUTION_GATE_FAMILIES.map((key) => {
      const family = byKey.get(key);
      if (family) {
        return {
          ...family,
          blocker_keys: this.unique(family.blocker_keys || []),
          blocked_approval_ids: this.unique(family.blocked_approval_ids || []),
        };
      }
      return {
        key,
        status: 'passed',
        records_checked: recordsChecked,
        records_blocked: 0,
        blocked_approval_ids: [],
        blocker_keys: [],
      };
    });
  }

  private executionGateDefects(
    evidence: AdsAutomationFinalGoNoGoExecutionGateEvidence,
  ): string[] {
    const defects: string[] = [];
    this.expect(
      defects,
      evidence.evidence_source === 'execution_preflight_response',
      'execution_preflight_response_missing',
    );
    this.expect(
      defects,
      evidence.execution_records_checked > 0,
      'execution_preflight_records_missing',
    );
    this.expect(
      defects,
      evidence.blocked_execution_records === evidence.execution_records_checked,
      'execution_preflight_records_not_all_blocked',
    );
    this.expect(
      defects,
      evidence.missing_required_gate_family_evidence.length === 0,
      'execution_preflight_required_gate_family_evidence_missing',
    );
    this.expect(
      defects,
      evidence.blocked_gate_families.length === REQUIRED_EXECUTION_GATE_FAMILIES.length,
      'execution_preflight_required_gate_family_not_blocked',
    );
    this.expect(
      defects,
      evidence.safety_action_records_visible > 0,
      'execution_preflight_safety_actions_not_visible',
    );
    this.expect(
      defects,
      evidence.scale_candidate_blocker_families.length === REQUIRED_EXECUTION_GATE_FAMILIES.length,
      'execution_preflight_scale_candidate_blocker_family_missing',
    );
    this.expect(
      defects,
      evidence.final_live_blockers.includes('live_path_not_implemented'),
      'execution_preflight_live_path_blocker_missing',
    );
    this.expect(
      defects,
      evidence.final_live_blockers.some((blocker) =>
        blocker === 'GOOGLE_ADS_PRODUCTION_ENABLED'
        || blocker === 'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent'),
      'execution_preflight_production_flag_blocker_missing',
    );
    this.expectFalse(defects, evidence.provider_api_called, 'execution_preflight.provider_api_called');
    this.expectFalse(defects, evidence.google_ads_api_called, 'execution_preflight.google_ads_api_called');
    this.expectFalse(defects, evidence.validateOnly_called, 'execution_preflight.validateOnly_called');
    this.expectFalse(defects, evidence.live_ads_execution_used, 'execution_preflight.live_ads_execution_used');
    this.expectFalse(defects, evidence.execution_allowed_now, 'execution_preflight.execution_allowed_now');
    this.expectFalse(defects, evidence.production_ready, 'execution_preflight.production_ready');

    return defects;
  }

  private recordsBlockedByFamily(
    families: AdsAutomationExecutionPreflightGateFamilyEvidence[],
    key: AdsAutomationExecutionPreflightGateFamilyKey,
  ): number {
    return families.find((family) => family.key === key)?.records_blocked || 0;
  }

  private recordsBlockedByGate(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
    key: string,
  ): number {
    return records.filter((record) =>
      (record.blockers || []).includes(key)
      || (record.gates || []).some((gate) =>
        gate.key === key && gate.status === 'blocked'),
    ).length;
  }

  private buckets(
    matrix: AdsAutomationFoundationAcceptanceMatrixResponse,
    localGatePassed: boolean,
    localDefects: string[],
  ): AdsAutomationFinalGoNoGoGateResponse['buckets'] {
    return {
      ready_for_demo_use: this.bucket({
        key: 'ready_for_demo_use',
        status: localGatePassed ? 'ready_for_demo_use' : 'no_go_local_defect',
        goNoGo: localGatePassed ? 'GO' : 'NO_GO',
        summary: localGatePassed
          ? 'Local mock-import, dry-run reconciliation, BA matrix, rollback evidence, and no-fallback campaignBudgetId checks are ready for demo use.'
          : 'Local demo use is blocked until acceptance matrix defects are fixed.',
        evidence: [
          `foundation_closeout_status=${matrix.summary.foundation_closeout_status}`,
          `ba_complete=${matrix.summary.ba_control_questions_complete_demo}/${matrix.summary.ba_control_questions}`,
          `safe_pending_actions=${matrix.summary.safe_pending_actions}`,
          `unsafe_pending_actions=${matrix.summary.unsafe_pending_actions}`,
          `provider_actions_reconciled=${matrix.summary.safe_provider_actions + matrix.summary.unsafe_provider_actions}`,
        ],
        blockers: localDefects,
        nextRequiredAction: localGatePassed
          ? 'use_local_demo_for_human_review_and_stop_codex_foundation_loop'
          : 'fix_local_acceptance_matrix_defects',
      }),
      blocked_until_real_readonly_import_credentials: this.bucket({
        key: 'blocked_until_real_readonly_import_credentials',
        status: 'blocked_before_live',
        goNoGo: 'NO_GO_LIVE',
        summary:
          'Real read-only platform import credentials are intentionally outside this repo-local gate.',
        evidence: [
          'local_fixture_only=true',
          'provider_api_called=false',
          'google_ads_api_called=false',
        ],
        blockers: [
          'real_mcc_bm_bc_credentials_not_configured',
          'future_readonly_import_credentials_require_human_approval',
        ],
        nextRequiredAction:
          'plan_later_human_approved_real_readonly_import_credentials_phase',
      }),
      blocked_until_provider_validateOnly_adapter: this.bucket({
        key: 'blocked_until_provider_validateOnly_adapter',
        status: 'blocked_before_live',
        goNoGo: 'NO_GO_LIVE',
        summary:
          'Provider validateOnly remains mocked at the ERP boundary; no provider adapter call is allowed in this gate.',
        evidence: [
          'validateOnly_called=false',
          'validate_only_provider_call_used=false',
          'provider_api_used=false',
        ],
        blockers: [
          'real_provider_validateOnly_adapter_missing',
          'future_erp_owned_adapter_boundary_required',
        ],
        nextRequiredAction:
          'plan_later_human_approved_provider_validateOnly_adapter_phase',
      }),
      blocked_until_human_approval_ui: this.bucket({
        key: 'blocked_until_human_approval_ui',
        status: 'blocked_before_live',
        goNoGo: 'NO_GO_LIVE',
        summary:
          'Approval evidence is local fixture/read-model proof only; an operator approval UI is still required before execution.',
        evidence: [
          'approval_required_for_all_actions=true',
          'execution_allowed_now=false',
        ],
        blockers: [
          'human_approval_ui_not_completed',
          'policy_allowed_evidence_not_durable_for_live',
        ],
        nextRequiredAction:
          'plan_later_human_approval_ui_and_policy_evidence_phase',
      }),
      blocked_until_small_cap_live_test: this.bucket({
        key: 'blocked_until_small_cap_live_test',
        status: 'blocked_before_live',
        goNoGo: 'NO_GO_LIVE',
        summary:
          'Live execution remains blocked until a separately approved small-cap test after credentials, validateOnly, and approval UI exist.',
        evidence: [
          'live_ads_execution_used=false',
          'future_live_execution_allowed=false',
          'production_ready=false',
        ],
        blockers: [
          'small_cap_live_test_not_approved',
          'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
        ],
        nextRequiredAction:
          'plan_later_human_approved_small_cap_live_test_after_all_prior_gates',
      }),
      not_in_mvp: this.bucket({
        key: 'not_in_mvp',
        status: 'not_in_mvp',
        goNoGo: 'NO_GO_SCOPE',
        summary:
          'Broad channel expansion and destructive or live-publish actions are outside the MVP scope.',
        evidence: NOT_IN_MVP_ITEMS.map((item) => `excluded=${item}`),
        blockers: [
          'not_required_for_local_demo',
          'not_allowed_in_codex_foundation_loop',
        ],
        nextRequiredAction:
          'keep_out_of_mvp_unless_a_future_human_plan_explicitly_reopens_scope',
      }),
    };
  }

  private bucket(params: {
    key: AdsAutomationFinalGoNoGoBucketKey;
    status: AdsAutomationFinalGoNoGoBucket['status'];
    goNoGo: AdsAutomationFinalGoNoGoBucket['go_no_go'];
    summary: string;
    evidence: string[];
    blockers: string[];
    nextRequiredAction: string;
  }): AdsAutomationFinalGoNoGoBucket {
    return {
      key: params.key,
      status: params.status,
      go_no_go: params.goNoGo,
      summary: params.summary,
      evidence: this.unique(params.evidence),
      blockers: this.unique(params.blockers),
      next_required_action: params.nextRequiredAction,
      production_ready: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private expectItemSafe(
    defects: string[],
    key: string,
    item: AdsAutomationFoundationAcceptanceMatrixItem,
  ): void {
    this.expectFalse(defects, item.execution_allowed_now, `item.${key}.execution_allowed_now`);
    this.expectFalse(defects, item.provider_api_called, `item.${key}.provider_api_called`);
    this.expectFalse(defects, item.google_ads_api_called, `item.${key}.google_ads_api_called`);
    this.expectFalse(defects, item.validateOnly_called, `item.${key}.validateOnly_called`);
    this.expectFalse(defects, item.live_ads_execution_used, `item.${key}.live_ads_execution_used`);
    this.expectFalse(defects, item.production_ready, `item.${key}.production_ready`);
  }

  private safety(): AdsAutomationFinalGoNoGoGateResponse['safety'] {
    return {
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
    };
  }

  private expect(defects: string[], passed: boolean, defect: string): void {
    if (!passed) defects.push(defect);
  }

  private expectFalse(
    defects: string[],
    value: unknown,
    defect: string,
  ): void {
    if (value !== false) defects.push(defect);
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
