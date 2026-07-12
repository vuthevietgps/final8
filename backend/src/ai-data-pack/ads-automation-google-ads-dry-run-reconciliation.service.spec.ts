import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationDecisionReadModelQueryService } from "./ads-automation-decision-read-model-query.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationGoogleAdsDryRunReconciliationService } from "./ads-automation-google-ads-dry-run-reconciliation.service";
import { ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE } from "./ads-automation-google-ads-mock-import-demo.fixture";
import { AdsAutomationGoogleAdsMockImportDemoService } from "./ads-automation-google-ads-mock-import-demo.service";
import { AdsAutomationPendingErpActionNormalizerService } from "./ads-automation-pending-erp-action-normalizer.service";
import { AdsAutomationProviderValidateOnlyPlannerService } from "./ads-automation-provider-validate-only-planner.service";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import type {
  AdsAutomationGoogleAdsMockImportDemoInput,
  AdsAutomationGoogleAdsMockImportDemoResponse,
} from "./contracts/ads-automation-google-ads-mock-import-demo.contract";

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

function buildService(): AdsAutomationGoogleAdsDryRunReconciliationService {
  return new AdsAutomationGoogleAdsDryRunReconciliationService(
    buildMockImportService(),
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

describe("AdsAutomationGoogleAdsDryRunReconciliationService", () => {
  it("links each local Google Ads mock action to approval, validate-only, dry-run, rollback, and closed execution gates", async () => {
    const response = await buildService().build();

    expect(response.schemaVersion).toBe(
      "ads_automation_google_ads_dry_run_reconciliation.v1",
    );
    expect(response.sourceSchemaVersion).toBe(
      "ads_automation_google_ads_mock_import_demo.v1",
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
        erp_only_future_validator_approver_executor: true,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "complete_local_evidence_blocked_before_live",
        actions_reconciled: 7,
        provider_actions_reconciled: 2,
        non_provider_actions_reconciled: 5,
        complete_local_evidence_actions: 7,
        gapped_actions: 0,
        approval_evidence_linked: 7,
        mocked_validate_only_passed_provider_actions: 2,
        dry_run_audit_records_linked: 7,
        rollback_evidence_linked: 5,
        duplicate_idempotency_keys: 0,
        blocked_future_live_actions: 7,
        execution_ready_now_actions: 0,
        campaignBudgetId_no_fallback: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );

    const updateBudget = response.actionReconciliation.find(
      (record) => record.action_type === "update_campaign_budget",
    );
    expect(updateBudget).toEqual(
      expect.objectContaining({
        action_family: "provider_google_ads",
        provider: "google",
        customerId: "1234567890",
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: "3001",
        productId: "P_SCALE",
        validation_status: "validate_only_passed",
        approval_status: "approved_demo_local_only",
        dry_run_record_status: "recorded_local_only",
        rollback_status: "present",
        identifier_match_status: "matched",
        evidence_status: "complete_local_evidence_blocked_before_live",
        campaignBudgetId_source: "campaign_budget_field",
        duplicate_idempotency_key: false,
        next_required_action: "keep_local_only_review_packet",
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        production_ready: false,
      }),
    );
    expect(updateBudget?.gates).toEqual(
      expect.objectContaining({
        approval_evidence_linked: true,
        validate_only_plan_linked: true,
        validate_only_passed_or_not_applicable: true,
        dry_run_audit_linked: true,
        rollback_evidence_required: true,
        rollback_evidence_linked: true,
        rollback_evidence_requirement_satisfied: true,
        identifiers_match: true,
        idempotency_key_unique: true,
        campaignBudgetId_no_fallback: true,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(updateBudget?.blockers).toEqual(
      expect.arrayContaining([
        "GOOGLE_ADS_PRODUCTION_ENABLED=false",
        "execution_allowed_now=false",
        "future_live_execution_not_allowed_local_only",
      ]),
    );

    expect(response.actionReconciliation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "pause_ad_group",
          action_family: "provider_google_ads",
          validation_status: "validate_only_passed",
          dry_run_record_status: "recorded_local_only",
          rollback_status: "present",
          evidence_status: "complete_local_evidence_blocked_before_live",
        }),
        expect.objectContaining({
          action_type: "stop_import_review",
          action_family: "internal_task",
          validation_status: "not_applicable_non_provider_action",
          dry_run_record_status: "recorded_local_only",
          rollback_status: "present",
        }),
        expect.objectContaining({
          action_type: "supplier_sourcing",
          action_family: "internal_task",
          validation_status: "not_applicable_non_provider_action",
          dry_run_record_status: "recorded_local_only",
          rollback_status: "not_required_internal_task",
        }),
      ]),
    );
  });

  it("keeps unsafe cashflow scale candidates in monitor-only reconciliation with no executable actions", async () => {
    const response = await buildService().build({
      demoInput: fixture({ cashflowMode: "unsafe" }),
    });

    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "complete_local_evidence_blocked_before_live",
        actions_reconciled: 6,
        provider_actions_reconciled: 1,
        mocked_validate_only_passed_provider_actions: 1,
        execution_ready_now_actions: 0,
        blocked_future_live_actions: 6,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(
      response.actionReconciliation.map((record) => record.action_type),
    ).not.toContain("update_campaign_budget");

    const monitorOnly = response.actionReconciliation.find(
      (record) =>
        record.action_type === "monitor_only" && record.productId === "P_SCALE",
    );
    expect(monitorOnly).toEqual(
      expect.objectContaining({
        validation_status: "not_applicable_non_provider_action",
        dry_run_record_status: "recorded_local_only",
        rollback_status: "present",
        evidence_status: "complete_local_evidence_blocked_before_live",
        campaignBudgetId_source: "not_applicable_non_budget_action",
        next_required_action: "keep_local_only_review_packet",
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(monitorOnly?.blockers).toEqual(
      expect.arrayContaining([
        "cashflow_gate_blocked",
        "GOOGLE_ADS_PRODUCTION_ENABLED=false",
        "execution_allowed_now=false",
      ]),
    );
  });

  it("flags local evidence gaps before any future executor can be considered", async () => {
    const demoResponse = await buildMockImportService().build();
    const tampered = cloneResponse(demoResponse);
    const updateBudget =
      tampered.pendingActionNormalization.pendingActions.find(
        (action) => action.action_type === "update_campaign_budget",
      )!;
    tampered.dryRunExecutionAuditRecords =
      tampered.dryRunExecutionAuditRecords.filter(
        (record) => record.pending_action_id !== updateBudget.pending_action_id,
      );

    const response = buildService().reconcileDemoResponse(tampered);
    const updateBudgetReconciliation = response.actionReconciliation.find(
      (record) => record.pending_action_id === updateBudget.pending_action_id,
    );

    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "gaps_found",
        gapped_actions: 1,
        dry_run_audit_records_linked: 6,
        execution_ready_now_actions: 0,
        production_ready: false,
      }),
    );
    expect(updateBudgetReconciliation).toEqual(
      expect.objectContaining({
        evidence_status: "gaps_found",
        dry_run_record_status: "missing",
        next_required_action:
          "fix_reconciliation_gaps_before_any_future_executor",
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(updateBudgetReconciliation?.gates).toEqual(
      expect.objectContaining({
        dry_run_audit_linked: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
      }),
    );
    expect(updateBudgetReconciliation?.blockers).toEqual(
      expect.arrayContaining([
        "dry_run_audit_record_missing",
        "future_live_execution_not_allowed_local_only",
      ]),
    );
  });

  it("blocks budget updates when campaignBudgetId is missing instead of falling back to campaign or ad group identifiers", async () => {
    const demoResponse = await buildMockImportService().build();
    const tampered = cloneResponse(demoResponse);
    const updateBudget =
      tampered.pendingActionNormalization.pendingActions.find(
        (action) => action.action_type === "update_campaign_budget",
      )!;
    updateBudget.campaignBudgetId = null;

    const response = buildService().reconcileDemoResponse(tampered);
    const updateBudgetReconciliation = response.actionReconciliation.find(
      (record) => record.pending_action_id === updateBudget.pending_action_id,
    );

    expect(response.summary).toEqual(
      expect.objectContaining({
        status: "gaps_found",
        gapped_actions: 1,
        execution_ready_now_actions: 0,
        campaignBudgetId_no_fallback: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(updateBudgetReconciliation).toEqual(
      expect.objectContaining({
        action_type: "update_campaign_budget",
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        campaignBudgetId_source: "missing_no_fallback",
        evidence_status: "gaps_found",
        identifier_match_status: "mismatch",
        next_required_action:
          "fix_reconciliation_gaps_before_any_future_executor",
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        production_ready: false,
      }),
    );
    expect(updateBudgetReconciliation?.gates).toEqual(
      expect.objectContaining({
        campaignBudgetId_no_fallback: true,
        identifiers_match: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
      }),
    );
    expect(updateBudgetReconciliation?.blockers).toEqual(
      expect.arrayContaining([
        "campaignBudgetId_missing_no_fallback",
        "identifier_mismatch",
        "future_live_execution_not_allowed_local_only",
      ]),
    );
  });
});
