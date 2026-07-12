import type {
  AdsAutomationApprovalEvidenceReviewExportFixtureMetadata,
  AdsAutomationApprovalEvidenceReviewFixtureScenario,
} from './contracts/ads-automation-approval-evidence-index.contract';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './contracts/ads-automation-decision-draft-approval.contract';
import type { AdsAutomationExecutionPreflightDryRunRecord } from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationGoogleAdsMockImportValidateOnlyPreflight } from './contracts/ads-automation-google-ads-mock-import-demo.contract';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './contracts/ads-automation-policy-decision-evidence.contract';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './contracts/ads-automation-validate-only-evidence.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from './source-sync/source-sync-result.types';

const FIXTURE_GENERATED_AT = '2026-07-04T06:20:00.000Z';

export interface AdsAutomationApprovalEvidenceReviewFixtureRecords {
  fixture: AdsAutomationApprovalEvidenceReviewExportFixtureMetadata;
  generatedAt: string;
  validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[];
  policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[];
  executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[];
  pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null;
  validateOnlyPreflight: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight | null;
}

export function buildAdsAutomationApprovalEvidenceReviewFixtureRecords(
  approvalId: string,
  scenario: AdsAutomationApprovalEvidenceReviewFixtureScenario,
): AdsAutomationApprovalEvidenceReviewFixtureRecords {
  const normalizedApprovalId = requiredText(approvalId, 'approvalId');
  const fixture = fixtureMetadata(normalizedApprovalId, scenario);

  if (scenario === 'empty_approval_evidence') {
    return {
      fixture,
      generatedAt: FIXTURE_GENERATED_AT,
      validateOnlyEvidenceRecords: [],
      policyDecisionEvidenceRecords: [],
      executionPreflightDryRunRecords: [],
      pendingApproval: null,
      validateOnlyPreflight: null,
    };
  }

  if (scenario === 'google_ads_mock_validate_only_preflight_blockers') {
    return {
      fixture,
      generatedAt: FIXTURE_GENERATED_AT,
      validateOnlyEvidenceRecords: [],
      policyDecisionEvidenceRecords: [],
      executionPreflightDryRunRecords: [],
      pendingApproval: null,
      validateOnlyPreflight: googleAdsMockValidateOnlyPreflightBlockerFixture(),
    };
  }

  if (scenario === 'pause_ad_group_blocker_evidence') {
    return {
      fixture,
      generatedAt: FIXTURE_GENERATED_AT,
      validateOnlyEvidenceRecords: [],
      policyDecisionEvidenceRecords: [],
      executionPreflightDryRunRecords: [],
      pendingApproval: pauseAdGroupPendingApprovalRecord(normalizedApprovalId),
      validateOnlyPreflight: null,
    };
  }

  if (scenario === 'scale_recommendation_gate_blocker_evidence') {
    return {
      fixture,
      generatedAt: FIXTURE_GENERATED_AT,
      validateOnlyEvidenceRecords: [],
      policyDecisionEvidenceRecords: [],
      executionPreflightDryRunRecords: [],
      pendingApproval: scaleRecommendationGateBlockedPendingApprovalRecord(normalizedApprovalId),
      validateOnlyPreflight: null,
    };
  }

  if (scenario === 'supplier_product_stop_import_review_blocker_evidence') {
    return {
      fixture,
      generatedAt: FIXTURE_GENERATED_AT,
      validateOnlyEvidenceRecords: [],
      policyDecisionEvidenceRecords: [],
      executionPreflightDryRunRecords: [],
      pendingApproval: stopImportReviewPendingApprovalRecord(normalizedApprovalId),
      validateOnlyPreflight: null,
    };
  }

  const suffix = idSuffix(normalizedApprovalId);
  const validationId = `ADSPROVIDERVALIDATE-${suffix}`;
  const policyDecisionId = `ADSPOLICY-${suffix}-REQ-POLICY`;
  const executionRecordId = `ADSEXEC-DRYRUN-${suffix}-REQ-PREFLIGHT`;

  return {
    fixture,
    generatedAt: FIXTURE_GENERATED_AT,
    validateOnlyEvidenceRecords: [
      validateOnlyEvidenceRecord(normalizedApprovalId, validationId),
    ],
    policyDecisionEvidenceRecords: [
      policyDecisionEvidenceRecord(normalizedApprovalId, policyDecisionId),
    ],
    executionPreflightDryRunRecords: [
      executionPreflightDryRunRecord(
        normalizedApprovalId,
        validationId,
        policyDecisionId,
        executionRecordId,
      ),
    ],
    pendingApproval: pendingApprovalRecord(normalizedApprovalId),
    validateOnlyPreflight: null,
  };
}

function fixtureMetadata(
  approvalId: string,
  scenario: AdsAutomationApprovalEvidenceReviewFixtureScenario,
): AdsAutomationApprovalEvidenceReviewExportFixtureMetadata {
  const description = {
    empty_approval_evidence: 'Local reviewer fixture for an approval id with no persisted evidence records.',
    linked_budget_update_evidence: 'Local reviewer fixture for one Google campaign budget update candidate with linked validate-only, policy, preflight, source-sync, and provider readiness evidence.',
    scale_recommendation_gate_blocker_evidence: 'Local reviewer fixture for one Google budget update candidate whose source rows are complete but canRecommendAdsScale=false blocks scale recommendation readiness.',
    pause_ad_group_blocker_evidence: 'Local reviewer fixture for one Google pause ad group candidate blocked by provider permission readiness.',
    supplier_product_stop_import_review_blocker_evidence: 'Local reviewer fixture for one internal supplier/product stop-import review blocker with source-sync evidence.',
    google_ads_mock_validate_only_preflight_blockers: 'Local reviewer fixture for Google Ads mock import validateOnlyPreflight blockers before provider validate-only or pending action creation.',
  }[scenario];

  return {
    fixture_id: `ADS_APPROVAL_EVIDENCE_REVIEW_FIXTURE:${approvalId}:${scenario}`,
    scenario,
    source: 'erp_local_demo_fixture',
    description,
    persisted_to_db: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
  };
}

function googleAdsMockValidateOnlyPreflightBlockerFixture():
  AdsAutomationGoogleAdsMockImportValidateOnlyPreflight {
  const sourceFreshness = [
    {
      sourceKey: 'google_ads',
      freshnessStatus: 'stale',
      coverageStatus: 'covered',
      canUseForAdsAutomationDecision: false,
      blockingReasons: [
        'freshness_stale',
        'google_ads_not_ready_for_ads_automation_decision',
      ],
    },
    {
      sourceKey: 'advertising_costs',
      freshnessStatus: 'fresh',
      coverageStatus: 'covered',
      canUseForAdsAutomationDecision: true,
      blockingReasons: [],
    },
    {
      sourceKey: 'product_mapping',
      freshnessStatus: 'fresh',
      coverageStatus: 'missing',
      canUseForAdsAutomationDecision: false,
      blockingReasons: [
        'coverage_missing',
        'product_mapping_missing',
        'product_mapping_not_ready_for_ads_automation_decision',
      ],
    },
    {
      sourceKey: 'inventory_profit',
      freshnessStatus: 'fresh',
      coverageStatus: 'missing',
      canUseForAdsAutomationDecision: false,
      blockingReasons: [
        'coverage_missing',
        'inventory_profit_not_ready_for_ads_automation_decision',
      ],
    },
    {
      sourceKey: 'supplier_safety',
      freshnessStatus: 'fresh',
      coverageStatus: 'missing',
      canUseForAdsAutomationDecision: false,
      blockingReasons: [
        'coverage_missing',
        'supplier_safety_not_ready_for_ads_automation_decision',
      ],
    },
  ];

  return {
    status: 'blocked_before_validateOnly',
    pending_action_candidate_status: 'blocked_before_pending_action',
    source: 'erp_mock_import_read_model',
    candidate_count: 2,
    pending_action_count: 0,
    blocked_candidate_count: 2,
    blocked_source_keys: [
      'google_ads',
      'product_mapping',
      'inventory_profit',
      'supplier_safety',
    ],
    blockers: [
      'campaignBudgetId_missing_no_fallback',
      'campaignBudgetId',
      'freshness_stale',
      'google_ads_not_ready_for_ads_automation_decision',
      'product_mapping_missing',
      'product_mapping_not_ready_for_ads_automation_decision',
      'inventory_profit_not_ready_for_ads_automation_decision',
      'supplier_safety_not_ready_for_ads_automation_decision',
      'read_model.campaignBudgetId_or_campaignBudgetResourceName_missing',
      'read_model.inventory_profit_missing_or_unsafe',
      'read_model.supplier_safety_missing_or_unsafe',
    ],
    candidates: [
      {
        candidate_id: 'ADSPREFLIGHT-ADSDRAFT-20260704-update_campaign_budget-2001',
        draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
        pending_action_id: null,
        approval_id: null,
        action_type: 'update_campaign_budget',
        candidate_status: 'blocked_before_pending_action',
        provider_validateOnly_readiness: 'blocked_before_validateOnly',
        validateOnly_plan_status: null,
        validateOnly_request_status: null,
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        blockers: [
          'campaignBudgetId_missing_no_fallback',
          'campaignBudgetId',
          'freshness_stale',
          'google_ads_not_ready_for_ads_automation_decision',
          'product_mapping_missing',
          'product_mapping_not_ready_for_ads_automation_decision',
          'read_model.campaignBudgetId_or_campaignBudgetResourceName_missing',
        ],
        blocked_source_keys: [
          'google_ads',
          'product_mapping',
        ],
        read_model_blockers: [
          'read_model.campaignBudgetId_or_campaignBudgetResourceName_missing',
        ],
        source_freshness: sourceFreshness.map((source) => ({
          ...source,
          freshnessStatus: source.sourceKey === 'inventory_profit'
            || source.sourceKey === 'supplier_safety'
            ? 'fresh'
            : source.freshnessStatus,
          coverageStatus: source.sourceKey === 'inventory_profit'
            || source.sourceKey === 'supplier_safety'
            ? 'covered'
            : source.coverageStatus,
          canUseForAdsAutomationDecision: source.sourceKey === 'inventory_profit'
            || source.sourceKey === 'supplier_safety'
            ? true
            : source.canUseForAdsAutomationDecision,
          blockingReasons: source.sourceKey === 'inventory_profit'
            || source.sourceKey === 'supplier_safety'
            ? []
            : [...source.blockingReasons],
        })),
        campaignBudgetId_fallback_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      },
      {
        candidate_id: 'ADSPREFLIGHT-ADSDRAFT-20260704-update_campaign_budget-P_BAD',
        draft_id: 'ADSDRAFT-20260704-update_campaign_budget-P_BAD',
        pending_action_id: null,
        approval_id: null,
        action_type: 'update_campaign_budget',
        candidate_status: 'blocked_before_pending_action',
        provider_validateOnly_readiness: 'blocked_before_validateOnly',
        validateOnly_plan_status: null,
        validateOnly_request_status: null,
        customerId: '1234567890',
        campaignId: '1002',
        adGroupId: '2002',
        campaignBudgetId: '3002',
        campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3002',
        productId: 'P_BAD',
        supplierId: 'SUP_WEAK_1',
        blockers: [
          'inventory_profit_not_ready_for_ads_automation_decision',
          'supplier_safety_not_ready_for_ads_automation_decision',
          'read_model.inventory_profit_missing_or_unsafe',
          'read_model.supplier_safety_missing_or_unsafe',
        ],
        blocked_source_keys: [
          'inventory_profit',
          'supplier_safety',
        ],
        read_model_blockers: [
          'read_model.inventory_profit_missing_or_unsafe',
          'read_model.supplier_safety_missing_or_unsafe',
        ],
        source_freshness: sourceFreshness.map((source) => ({
          ...source,
          freshnessStatus: source.sourceKey === 'google_ads'
            ? 'fresh'
            : source.freshnessStatus,
          coverageStatus: source.sourceKey === 'google_ads'
            ? 'covered'
            : source.sourceKey === 'product_mapping'
              ? 'not_applicable'
              : source.coverageStatus,
          canUseForAdsAutomationDecision: source.sourceKey === 'google_ads'
            || source.sourceKey === 'product_mapping'
            || source.sourceKey === 'advertising_costs'
            ? true
            : source.canUseForAdsAutomationDecision,
          blockingReasons: source.sourceKey === 'google_ads'
            || source.sourceKey === 'product_mapping'
            || source.sourceKey === 'advertising_costs'
            ? []
            : [...source.blockingReasons],
        })),
        campaignBudgetId_fallback_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      },
    ],
    campaignBudgetId_fallback_used: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    execution_allowed_now: false,
  };
}

function validateOnlyEvidenceRecord(
  approvalId: string,
  validationId: string,
): AdsAutomationValidateOnlyEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_validate_only_evidence.v1',
    validation_id: validationId,
    idempotency_key: `ads-validate-only-evidence:${approvalId}:REQ-REVIEW-FIXTURE`,
    pending_action_id: `ADSPENDINGACTION-${idSuffix(approvalId)}`,
    approval_id: approvalId,
    source_pending_action_status: 'pending_validation',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    customerId: '1234567890',
    campaignId: '1001',
    adGroupId: '2001',
    campaignBudgetId: '3001',
    campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    requested_change: { campaignBudgetId: '3001', dailyBudget: 1200000 },
    status: 'validate_only_passed',
    providerValidationStatus: 'provider_validate_passed',
    providerRequestId: 'REQ-REVIEW-FIXTURE-MOCK',
    providerValidatedAt: FIXTURE_GENERATED_AT,
    providerValidationErrors: [],
    before_state_snapshot: {
      snapshot_status: 'mocked_boundary_snapshot',
      required_before_future_execution: true,
      source: 'erp_synced_google_ads_read_model',
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      snapshot: { syncedAt: '2026-07-04T05:55:00.000Z' },
    },
    provider_boundary_evidence: {
      boundary_mode: 'erp_local_mock_only',
      status_source: 'mock_provider_result',
      mocked_provider_result_used: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      direct_google_ads_api_call: false,
      operation_builder_called: false,
      raw_provider_request_included: false,
      evidence: ['Reviewer fixture uses mocked validate-only evidence only.'],
    },
    blockers: [],
    approval_can_be_considered_executable: true,
    executable_now: false,
    execution_allowed_now: false,
    validate_only_required_before_execution: true,
    next_required_action: 'continue_human_approval_flow',
    source_pending_action: {
      fixture_source: 'ads_automation_approval_evidence_review_export',
      approval_id: approvalId,
    } as any,
    validateOnly_evidence_persisted: true,
    future_live_execution_allowed: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-REVIEW-FIXTURE',
    createdAt: FIXTURE_GENERATED_AT,
    persistedAt: '2026-07-04T06:20:01.000Z',
  };
}

function policyDecisionEvidenceRecord(
  approvalId: string,
  policyDecisionId: string,
): AdsAutomationPolicyDecisionEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
    policy_decision_id: policyDecisionId,
    idempotency_key: `ads-policy-decision:${approvalId}:REQ-REVIEW-FIXTURE`,
    approval_id: approvalId,
    policy_allowed: true,
    policy_source: 'erp_cashflow_ads_policy',
    blockers: [],
    evaluatedAt: FIXTURE_GENERATED_AT,
    policy_decision_record_persisted: true,
    future_live_execution_allowed: false,
    execution_allowed_now: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-REVIEW-FIXTURE',
    createdAt: FIXTURE_GENERATED_AT,
    persistedAt: '2026-07-04T06:20:02.000Z',
  };
}

function executionPreflightDryRunRecord(
  approvalId: string,
  validationId: string,
  policyDecisionId: string,
  executionRecordId: string,
): AdsAutomationExecutionPreflightDryRunRecord {
  return {
    execution_record_id: executionRecordId,
    idempotency_key: `ads-execution-preflight:${approvalId}:REQ-REVIEW-FIXTURE`,
    approval_id: approvalId,
    source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    accountId: 'HTX-GADS-PRIMARY',
    platform: 'google',
    approval_status: 'approved',
    approval_decision_audit_id: 'ADSAUDIT-REVIEW-FIXTURE-approve',
    approval_decision_audit_persisted: true,
    source_readiness_safe: true,
    kill_switch_active: false,
    kill_switch_reason: null,
    validateOnly_validation_id: validationId,
    validateOnly_evidence_persisted: true,
    validateOnly_status: 'validate_only_passed',
    policy_decision_id: policyDecisionId,
    policy_decision_evidence_persisted: true,
    policy_allowed: true,
    google_ads_production_enabled: false,
    preflight_status: 'blocked_before_future_live_execution',
    dry_run_record_status: 'recorded_local_only',
    future_live_execution_allowed: false,
    execution_allowed_now: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    campaignBudgetId_fallback_used: false,
    preflight_record_persisted: true,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requested_change: {
      action_type: 'update_campaign_budget',
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
    },
    identifiers: {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    },
    gates: [],
    blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
    next_required_action: 'fix_preflight_blockers_before_future_execution',
    source_pending_approval: {
      fixture_source: 'ads_automation_approval_evidence_review_export',
      approval_id: approvalId,
    } as any,
    source_validateOnly_plan: null,
    policy_decision: {
      approval_id: approvalId,
      policy_allowed: true,
      policy_source: 'erp_cashflow_ads_policy',
      blockers: [],
      policy_decision_id: policyDecisionId,
      policy_decision_record_persisted: true,
      storage: 'erp_local_mongo',
      persistedAt: '2026-07-04T06:20:02.000Z',
    },
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-REVIEW-FIXTURE',
    createdAt: FIXTURE_GENERATED_AT,
    persistedAt: '2026-07-04T06:20:03.000Z',
  };
}

function pendingApprovalRecord(
  approvalId: string,
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    approval_id: approvalId,
    source_schema_version: 'ads_automation_decision_draft_preview.v1',
    source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    accountId: '1234567890',
    productId: 'P_SCALE',
    supplierId: null,
    platform: 'google',
    status: 'pending_approval',
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: true,
    future_provider_validateOnly_required: true,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    typedPayload: {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      dailyBudget: 1200000,
      currentBudgetVnd: 1000000,
      increasePercent: 20,
      reportDate: '2026-07-04',
      providerAccountReadinessAccount: readyGoogleAdsAccountMetadata(),
    },
    source_evidence_references: [{
      decision_id: 'DEC-scale_amount-2001',
      decision_type: 'scale_amount',
      evidence_window: { from: '2026-06-21', to: '2026-07-04', days: 14 },
      evidence_metrics: { orders: 12, netProfitAfterAdsVnd: 700000 },
      rationale: 'Profitable Google ad group can scale within ERP cash policy.',
      idempotency_key: 'ads-decision:2026-07-04:scale_amount:2001',
      rollback_plan: 'Restore previous campaign budget.',
    }],
    sourceSyncDecisionEvidence: sourceSyncDecisionEvidence('budget_update'),
    sourceSyncDecisionGates: sourceSyncDecisionGates('ready'),
    blockers: [],
    missing_data_blockers: [],
    idempotency_key: `ads-draft:${approvalId}:update_campaign_budget:2001`,
    rationale: 'Budget increase is capped by ERP policy and still requires approval.',
    createdAt: FIXTURE_GENERATED_AT,
    persistedAt: '2026-07-04T06:20:00.500Z',
  };
}

function pauseAdGroupPendingApprovalRecord(
  approvalId: string,
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    approval_id: approvalId,
    source_schema_version: 'ads_automation_decision_draft_preview.v1',
    source_draft_id: 'ADSDRAFT-20260704-pause_ad_group-2002',
    source_decision_id: 'DEC-pause-2002',
    action_type: 'pause_ad_group',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'ad_group',
    entity_type: 'ad_group',
    entity_id: '2002',
    accountId: 'HTX-GADS-PRIMARY',
    productId: 'P_PAUSE',
    supplierId: null,
    platform: 'google',
    status: 'pending_approval',
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: true,
    future_provider_validateOnly_required: true,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    typedPayload: {
      customerId: '1234567890',
      campaignId: '1002',
      adGroupId: '2002',
      targetStatus: 'PAUSED',
      reportDate: '2026-07-04',
      providerAccountReadinessAccount: googleAdsAccountMetadataMissingPauseScope(),
    },
    source_evidence_references: [{
      decision_id: 'DEC-pause-2002',
      decision_type: 'campaign_or_ad_group_pause',
      evidence_window: { from: '2026-06-21', to: '2026-07-04', days: 14 },
      evidence_metrics: { lossAfterAdsVnd: -450000, refundRate: 0.18 },
      rationale: 'Loss and refund risk require pause review for ad group 2002.',
      idempotency_key: 'ads-decision:2026-07-04:pause_ad_group:2002',
      rollback_plan: 'Restore previous ad group status after human approval.',
    }],
    sourceSyncDecisionEvidence: sourceSyncDecisionEvidence('pause_blocker'),
    sourceSyncDecisionGates: sourceSyncDecisionGates('blocked'),
    blockers: ['loss_limit_breached', 'refund_risk_high'],
    missing_data_blockers: [],
    idempotency_key: `ads-draft:${approvalId}:pause_ad_group:2002`,
    rationale: 'Pause is approval-required and blocked before provider boundary until pause scope readiness is fixed.',
    createdAt: FIXTURE_GENERATED_AT,
    persistedAt: '2026-07-04T06:21:00.500Z',
  };
}

function scaleRecommendationGateBlockedPendingApprovalRecord(
  approvalId: string,
): AdsAutomationDecisionDraftPendingApprovalRecord {
  const record = pendingApprovalRecord(approvalId);

  return {
    ...record,
    source_draft_id: 'ADSDRAFT-20260704-scale_recommendation_gate_blocked-2001',
    source_decision_id: 'DEC-scale-gate-blocked-2001',
    source_evidence_references: [{
      decision_id: 'DEC-scale-gate-blocked-2001',
      decision_type: 'scale_amount',
      evidence_window: { from: '2026-06-21', to: '2026-07-04', days: 14 },
      evidence_metrics: {
        orders: 12,
        netProfitAfterAdsVnd: 700000,
        sourceRowsUsable: 5,
      },
      rationale: 'All source rows are present and usable, but ERP source-sync gates do not allow a scale recommendation yet.',
      idempotency_key: 'ads-decision:2026-07-04:scale_gate_blocked:2001',
      rollback_plan: 'Keep current campaign budget until a human verifies source-sync gate readiness.',
    }],
    sourceSyncDecisionEvidence: sourceSyncDecisionEvidence('budget_update'),
    sourceSyncDecisionGates: {
      ...sourceSyncDecisionGates('ready'),
      canRecommendAdsScale: false,
    },
    blockers: ['source_sync_gate_blocked_ads_scale_recommendation'],
    missing_data_blockers: [],
    idempotency_key: `ads-draft:${approvalId}:scale_gate_blocked:update_campaign_budget:2001`,
    rationale: 'Complete source evidence exists, but canRecommendAdsScale=false keeps this scale-up draft review-only.',
  };
}

function stopImportReviewPendingApprovalRecord(
  approvalId: string,
): AdsAutomationDecisionDraftPendingApprovalRecord {
  return {
    approval_id: approvalId,
    source_schema_version: 'ads_automation_decision_draft_preview.v1',
    source_draft_id: 'ADSDRAFT-20260704-stop_import_review-P_BAD',
    source_decision_id: 'DEC-stop-import-P_BAD',
    action_type: 'stop_import_review',
    action_family: 'internal_task',
    provider: 'erp_internal',
    resource_type: 'product',
    entity_type: 'product',
    entity_id: 'P_BAD',
    accountId: null,
    productId: 'P_BAD',
    supplierId: 'SUP_WEAK',
    platform: null,
    status: 'pending_approval',
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: false,
    future_provider_validateOnly_required: false,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    typedPayload: {
      productId: 'P_BAD',
      supplierId: 'SUP_WEAK',
      reviewScope: 'import_stop_review',
      deleteProduct: false,
      providerDelete: false,
      reportDate: '2026-07-04',
    },
    source_evidence_references: [{
      decision_id: 'DEC-stop-import-P_BAD',
      decision_type: 'product_kill_or_stop_review',
      evidence_window: { from: '2026-06-21', to: '2026-07-04', days: 14 },
      evidence_metrics: {
        netProfitAfterAdsVnd: -900000,
        stockCoverageDays: 5,
        supplierLateRate: 0.42,
      },
      rationale: 'Product P_BAD has poor profit, low stock coverage, and weak supplier safety.',
      idempotency_key: 'ads-decision:2026-07-04:stop_import_review:P_BAD',
      rollback_plan: 'Keep product active until human import-stop review is complete.',
    }],
    sourceSyncDecisionEvidence: sourceSyncDecisionEvidence('stop_import_blocker'),
    sourceSyncDecisionGates: sourceSyncDecisionGates('blocked'),
    blockers: ['supplier_safety_blocked', 'inventory_profit_negative', 'product_stop_import_review_required'],
    missing_data_blockers: ['supplier_safety_not_ready_for_ads_automation_decision'],
    idempotency_key: `ads-draft:${approvalId}:stop_import_review:P_BAD`,
    rationale: 'Stop-import remains an internal review task only; no product delete or provider delete is allowed.',
    createdAt: FIXTURE_GENERATED_AT,
    persistedAt: '2026-07-04T06:22:00.500Z',
  };
}

function sourceSyncDecisionEvidence(
  scenario: 'budget_update' | 'pause_blocker' | 'stop_import_blocker',
): SourceSyncDecisionEvidence[] {
  const sourceBlockers = scenario === 'stop_import_blocker'
    ? {
        inventory_profit: {
          blockingReason: 'inventory_profit_not_ready_for_ads_automation_decision',
          blockingReasons: [
            'coverage_missing',
            'inventory_profit_not_ready_for_ads_automation_decision',
          ],
          canUseForAdsAutomationDecision: false,
        },
        supplier_safety: {
          blockingReason: 'supplier_safety_not_ready_for_ads_automation_decision',
          blockingReasons: [
            'coverage_missing',
            'supplier_safety_not_ready_for_ads_automation_decision',
          ],
          canUseForAdsAutomationDecision: false,
        },
      }
    : {};

  return [
    {
      sourceKey: 'google_ads',
      reportDate: '2026-07-04',
      freshnessStatus: scenario === 'pause_blocker' ? 'stale' : 'fresh',
      coverageStatus: 'covered',
      lastSuccessfulSyncAt: scenario === 'pause_blocker'
        ? '2026-07-03T20:00:00.000Z'
        : '2026-07-04T05:50:00.000Z',
      latestRecordDate: '2026-07-04',
      blockingReason: scenario === 'pause_blocker'
        ? 'google_ads_not_ready_for_ads_automation_decision'
        : null,
      blockingReasons: scenario === 'pause_blocker'
        ? [
            'freshness_stale',
            'google_ads_not_ready_for_ads_automation_decision',
          ]
        : [],
      canUseForAdsAutomationDecision: scenario !== 'pause_blocker',
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
      coverageStatus: sourceBlockers.inventory_profit ? 'missing' : 'covered',
      lastSuccessfulSyncAt: sourceBlockers.inventory_profit ? null : '2026-07-04T05:30:00.000Z',
      latestRecordDate: sourceBlockers.inventory_profit ? null : '2026-07-04',
      blockingReason: sourceBlockers.inventory_profit?.blockingReason || null,
      blockingReasons: sourceBlockers.inventory_profit?.blockingReasons || [],
      canUseForAdsAutomationDecision: sourceBlockers.inventory_profit?.canUseForAdsAutomationDecision ?? true,
    },
    {
      sourceKey: 'supplier_safety',
      reportDate: '2026-07-04',
      freshnessStatus: 'fresh',
      coverageStatus: sourceBlockers.supplier_safety ? 'missing' : 'covered',
      lastSuccessfulSyncAt: sourceBlockers.supplier_safety ? null : '2026-07-04T05:35:00.000Z',
      latestRecordDate: sourceBlockers.supplier_safety ? null : '2026-07-04',
      blockingReason: sourceBlockers.supplier_safety?.blockingReason || null,
      blockingReasons: sourceBlockers.supplier_safety?.blockingReasons || [],
      canUseForAdsAutomationDecision: sourceBlockers.supplier_safety?.canUseForAdsAutomationDecision ?? true,
    },
  ];
}

function sourceSyncDecisionGates(
  status: 'ready' | 'blocked' = 'blocked',
): Partial<SourceSyncDecisionGates> {
  const ready = status === 'ready';
  return {
    canRecommendAdsScale: ready,
    canConcludeProfitStrongly: ready,
    canEvaluateSalesToday: ready,
    canEvaluateFinanceStrongly: ready,
    canUseLtvStrongly: ready,
    canGenerateActionDraft: ready,
    canUseGoogleAdsDataClaim: ready,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
  };
}

function readyGoogleAdsAccountMetadata(): Record<string, unknown> {
  return {
    platform: 'google_ads',
    accountId: 'HTX-GADS-PRIMARY',
    customerId: '1234567890',
    loginCustomerId: '5555555555',
    managerCustomerId: '5555555555',
    erpAccountMappingId: 'ERP-GADS-MAP-PRIMARY',
    accountName: 'HTX Bach Gia - Primary',
    adapterRegistered: true,
    adapterMode: 'contract_only',
    isActive: true,
    approvedForProviderActions: true,
    approvedForReadOnlyImport: true,
    googleAdsProductionEnabled: false,
    credentialMetadata: {
      credentialReferenceId: 'credref-google-ads-primary',
      redactedCredentialReference: 'google_ads_oauth_ref:***primary',
      oauthConnectionStatus: 'ready',
      grantedScopes: [
        'ads.readonly',
        'ads.validate_only',
        'ads.manage_budgets',
        'ads.pause',
      ],
      plaintextCredentialFieldNames: [],
    },
  };
}

function googleAdsAccountMetadataMissingPauseScope(): Record<string, unknown> {
  const account = readyGoogleAdsAccountMetadata();
  account.credentialMetadata = {
    ...(account.credentialMetadata as Record<string, unknown>),
    grantedScopes: [
      'ads.readonly',
      'ads.validate_only',
      'ads.manage_budgets',
    ],
  };
  return account;
}

function requiredText(value: unknown, field: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function idSuffix(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}
