import type {
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightActionType,
  AdsAutomationExecutionPreflightActionTypeCoverage,
  AdsAutomationExecutionPreflightBlockerCoverage,
  AdsAutomationExecutionPreflightGateFamilyKey,
  AdsAutomationExecutionPreflightGateStatus,
  AdsAutomationExecutionPreflightReadinessContract,
} from "./ads-automation-execution-preflight-dry-run.contract";
import type { AdsAutomationFinalGoNoGoGateResponse } from "./ads-automation-final-go-no-go-gate.contract";
import type {
  AdsAutomationProductionReadinessBridgeInput,
  AdsAutomationProductionReadinessBridgeResponse,
} from "./ads-automation-production-readiness-bridge.contract";
import type {
  AdsAutomationApiReadinessGapReportResponse,
  AdsAutomationApiReadinessGapReportStageStatus,
} from "./ads-automation-api-readiness-gap-report.contract";

export type AdsAutomationFinalGateReviewExportFixtureMode =
  | "htx_ads_final_gate_review_demo"
  | "custom_local_payload";

export type AdsAutomationFinalGateReviewExportStatus =
  | "ready_for_manager_review_blocked_before_live"
  | "blocked_local_gate_defect";

export interface AdsAutomationFinalGateReviewExportInput {
  reportDate?: string;
  now?: string | Date;
  fixtureMode?: AdsAutomationFinalGateReviewExportFixtureMode;
  executionPreflightResponse?: AdsAutomationExecutionPreflightDryRunResponse;
  finalGoNoGoGateResponse?: AdsAutomationFinalGoNoGoGateResponse;
  productionReadinessBridgeInput?: AdsAutomationProductionReadinessBridgeInput;
  productionReadinessBridgeResponse?: AdsAutomationProductionReadinessBridgeResponse;
  apiReadinessGapReport?: AdsAutomationApiReadinessGapReportResponse | null;
}

export interface AdsAutomationFinalGateReviewExportSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  final_go_no_go_gate_reused: true;
  execution_preflight_evidence_reused: boolean;
  production_readiness_bridge_reused: true;
  api_readiness_gap_report_reused: boolean;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  validate_only_provider_call_used: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  direct_google_ads_api_call: false;
  provider_mutation_used: false;
  campaignBudgetId_no_fallback: true;
  approval_required_for_all_actions: true;
  future_live_execution_allowed: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_only_future_validator_approver_executor: true;
}

export interface AdsAutomationFinalGateReviewGateFamilyReview {
  key: AdsAutomationExecutionPreflightGateFamilyKey;
  status: AdsAutomationExecutionPreflightGateStatus;
  records_checked: number;
  records_blocked: number;
  blocked_approval_ids: string[];
  blocker_keys: string[];
  scale_candidate_blocker_family: boolean;
  review_status:
    | "blocked_before_live"
    | "missing_required_evidence"
    | "passed_local_only_needs_blocker";
}

export interface AdsAutomationFinalGateReviewExecutionEvidence {
  evidence_source: AdsAutomationFinalGoNoGoGateResponse["executionGateEvidence"]["evidence_source"];
  final_live_execution_status: AdsAutomationFinalGoNoGoGateResponse["executionGateEvidence"]["final_live_execution_status"];
  required_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  blocked_gate_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  missing_required_gate_family_evidence: AdsAutomationExecutionPreflightGateFamilyKey[];
  execution_records_checked: number;
  blocked_execution_records: number;
  executable_now_actions: 0;
  validateOnly_missing_or_blocked_records: number;
  validateOnly_passed_records: number;
  approval_missing_or_blocked_records: number;
  approval_audit_missing_or_blocked_records: number;
  source_readiness_blocked_records: number;
  finance_policy_blocked_records: number;
  kill_switch_blocked_records: number;
  idempotency_blocked_records: number;
  campaignBudgetId_blocked_records: number;
  production_flag_blocked_records: number;
  live_path_blocked_records: number;
  scale_candidate_blocker_families: AdsAutomationExecutionPreflightGateFamilyKey[];
  pause_safety_records_visible: number;
  monitor_only_safety_records_visible: number;
  safety_action_records_visible: number;
  final_live_blockers: string[];
  blockerCoverage: AdsAutomationExecutionPreflightBlockerCoverage;
}

export interface AdsAutomationFinalGateReviewProductionBridgeReview {
  schemaVersion: AdsAutomationProductionReadinessBridgeResponse["schemaVersion"];
  status: AdsAutomationProductionReadinessBridgeResponse["status"];
  providerOrderValid: boolean;
  bridgeBlockers: string[];
  blockersForRealProduction: string[];
  provider_gate_blockers: string[];
  business_safety_gates_uncertain: number;
  scale_action_mode: AdsAutomationProductionReadinessBridgeResponse["scale_action_mode"];
  demoReadiness: AdsAutomationProductionReadinessBridgeResponse["demoReadiness"];
}

export interface AdsAutomationFinalGateReviewApiReadinessGapReview {
  schemaVersion: "ads_automation_final_gate_api_readiness_gap_review.v1";
  gap_report_present: boolean;
  source_schema_version:
    | AdsAutomationApiReadinessGapReportResponse["schemaVersion"]
    | null;
  api_gap_status:
    | AdsAutomationApiReadinessGapReportResponse["summary"]["status"]
    | "missing";
  source_readiness_review_export_consumed: boolean;
  source_readiness_review_export_status:
    | AdsAutomationApiReadinessGapReportResponse["summary"]["source_readiness_review_export_status"]
    | null;
  source_readiness_review_export_mode:
    | AdsAutomationApiReadinessGapReportResponse["summary"]["source_readiness_review_export_mode"]
    | null;
  required_source_count: number;
  required_source_ready_count: number;
  required_source_blocked_count: number;
  required_source_report_date_covered_count: number;
  required_source_report_date_blocked_count: number;
  missing_required_source_evidence: string[];
  source_coverage_blocking_reasons: string[];
  source_blockers: string[];
  source_readiness_review_blockers: string[];
  platform_entity_coverage_blockers: string[];
  platform_entity_coverage_action_blockers: string[];
  campaignBudgetId_blockers: string[];
  product_inventory_profit_blockers: string[];
  supplier_safety_blockers: string[];
  platform_campaignBudgetId_missing_rows: number;
  platform_blocked_product_count: number;
  platform_blocked_supplier_count: number;
  platform_supplier_choice_safe: boolean | null;
  validateOnly_lane_created: boolean;
  provider_validateOnly_plans: number;
  provider_validateOnly_passed: number;
  final_go_no_go_stage_status:
    | AdsAutomationApiReadinessGapReportStageStatus
    | "missing";
  final_go_no_go_stage_blockers: string[];
  final_go_no_go_stage_evidence: string[];
  final_go_no_go_stage_next_required_action: string | null;
  local_review_defect: boolean;
  local_review_defect_keys: string[];
  review_status:
    | "api_gap_blocked_before_final_go_no_go"
    | "api_gap_visible_no_source_blockers"
    | "api_gap_missing";
}

export interface AdsAutomationFinalGateReviewExecutionReadinessContractReview {
  schemaVersion: "ads_automation_execution_readiness_contract_review.v1";
  contract_present: boolean;
  action_type_coverage_present: boolean;
  source_schema_version:
    | AdsAutomationExecutionPreflightReadinessContract["schemaVersion"]
    | null;
  supported_mvp_actions: AdsAutomationExecutionPreflightReadinessContract["supported_mvp_actions"];
  expected_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  supported_mvp_actions_present: boolean;
  supported_mvp_actions_exact_match: boolean;
  missing_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  unsupported_supported_mvp_actions: string[];
  supported_mvp_actions_order_matches_expected: boolean;
  required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  expected_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  required_gate_families_present: boolean;
  required_gate_families_exact_match: boolean;
  missing_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  unsupported_required_gate_families: string[];
  required_gate_families_order_matches_expected: boolean;
  must_have_before_future_live_execution: string[];
  expected_must_have_before_future_live_execution: string[];
  must_have_before_future_live_execution_present: boolean;
  must_have_before_future_live_execution_exact_match: boolean;
  missing_must_have_before_future_live_execution: string[];
  unsupported_must_have_before_future_live_execution: string[];
  must_have_before_future_live_execution_order_matches_expected: boolean;
  non_execution_guarantee_present: boolean;
  non_execution_guarantee_exact_match: boolean;
  non_execution_guarantee_defects: string[];
  coverage_integrity_exact_match: boolean;
  coverage_integrity_defects: string[];
  missing_must_have_items: string[];
  action_type_coverage: AdsAutomationExecutionPreflightActionTypeCoverage[];
  missing_mvp_action_coverage: AdsAutomationExecutionPreflightActionType[];
  records_checked: number;
  blocked_gate_families: number;
  required_pre_live_gates_passed_records: number;
  required_pre_live_gates_blocked_records: number;
  scale_candidate_blocked_by_all_gate_families: boolean;
  pause_safety_records_visible: number;
  monitor_only_safety_records_visible: number;
  safety_action_records_visible: number;
  executable_now_actions: 0;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  local_review_defect: boolean;
  local_review_defect_keys: string[];
  review_status:
    | "contract_visible_blocked_before_live"
    | "contract_incomplete_local_review_defect"
    | "contract_missing";
}

export interface AdsAutomationFinalGateReviewExportSummary {
  status: AdsAutomationFinalGateReviewExportStatus;
  fixture_mode: AdsAutomationFinalGateReviewExportFixtureMode;
  reportDate: string;
  final_go_no_go_decision: AdsAutomationFinalGoNoGoGateResponse["summary"]["decision"];
  final_go_no_go_local_gate_passed: boolean;
  production_bridge_status: AdsAutomationProductionReadinessBridgeResponse["status"];
  production_bridge_blockers: number;
  required_gate_families: number;
  blocked_gate_families: number;
  missing_required_gate_families: number;
  final_live_blockers: number;
  api_readiness_gap_report_present: boolean;
  api_readiness_gap_status: AdsAutomationFinalGateReviewApiReadinessGapReview["api_gap_status"];
  api_readiness_source_blocker_count: number;
  api_readiness_required_source_blocked_count: number;
  api_readiness_required_source_report_date_blocked_count: number;
  api_readiness_campaignBudgetId_missing_rows: number;
  api_readiness_product_inventory_profit_blocker_count: number;
  api_readiness_supplier_safety_blocker_count: number;
  api_readiness_final_go_no_go_stage_status: AdsAutomationFinalGateReviewApiReadinessGapReview["final_go_no_go_stage_status"];
  api_readiness_final_go_no_go_stage_blocker_count: number;
  execution_records_checked: number;
  blocked_execution_records: number;
  scale_candidate_blocker_families: number;
  pause_safety_records_visible: number;
  monitor_only_safety_records_visible: number;
  safety_action_records_visible: number;
  execution_readiness_contract_present: boolean;
  execution_readiness_action_type_coverage_present: boolean;
  execution_readiness_required_gate_families: number;
  execution_readiness_blocked_gate_families: number;
  execution_readiness_scale_candidate_blocked_by_all_gate_families: boolean;
  execution_readiness_supported_mvp_actions_present: boolean;
  execution_readiness_supported_mvp_actions_exact_match: boolean;
  execution_readiness_missing_supported_mvp_actions: AdsAutomationExecutionPreflightActionType[];
  execution_readiness_unsupported_supported_mvp_actions: string[];
  execution_readiness_supported_mvp_actions_order_matches_expected: boolean;
  execution_readiness_required_gate_families_present: boolean;
  execution_readiness_required_gate_families_exact_match: boolean;
  execution_readiness_missing_required_gate_families: AdsAutomationExecutionPreflightReadinessContract["required_gate_families"];
  execution_readiness_unsupported_required_gate_families: string[];
  execution_readiness_required_gate_families_order_matches_expected: boolean;
  execution_readiness_must_have_before_future_live_execution_present: boolean;
  execution_readiness_must_have_before_future_live_execution_exact_match: boolean;
  execution_readiness_missing_must_have_before_future_live_execution: string[];
  execution_readiness_unsupported_must_have_before_future_live_execution: string[];
  execution_readiness_must_have_before_future_live_execution_order_matches_expected: boolean;
  execution_readiness_non_execution_guarantee_present: boolean;
  execution_readiness_non_execution_guarantee_exact_match: boolean;
  execution_readiness_non_execution_guarantee_defects: string[];
  execution_readiness_coverage_integrity_exact_match: boolean;
  execution_readiness_coverage_integrity_defects: string[];
  execution_readiness_missing_mvp_action_coverage: number;
  missing_mvp_action_coverage: AdsAutomationExecutionPreflightActionType[];
  execution_readiness_local_review_defect: boolean;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  validate_only_provider_call_used: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  live_execution_blocked: true;
  next_required_action:
    | "inspect_final_gate_review_export"
    | "fix_local_final_gate_review_defects";
}

export interface AdsAutomationFinalGateReviewExportResponse {
  schemaVersion: "ads_automation_final_gate_review_export.v1";
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationFinalGateReviewExportSafety;
  summary: AdsAutomationFinalGateReviewExportSummary;
  gateFamilyReview: AdsAutomationFinalGateReviewGateFamilyReview[];
  executionEvidenceReview: AdsAutomationFinalGateReviewExecutionEvidence;
  productionBridgeReview: AdsAutomationFinalGateReviewProductionBridgeReview;
  apiReadinessGapReview: AdsAutomationFinalGateReviewApiReadinessGapReview;
  executionReadinessContractReview: AdsAutomationFinalGateReviewExecutionReadinessContractReview;
  localReviewBlockers: string[];
  liveReadinessBlockers: string[];
  markdownPreview: string;
  finalGoNoGoGate: AdsAutomationFinalGoNoGoGateResponse;
  productionReadinessBridge: AdsAutomationProductionReadinessBridgeResponse;
}
