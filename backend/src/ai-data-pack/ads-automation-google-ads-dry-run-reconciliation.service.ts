import { BadRequestException, Injectable } from "@nestjs/common";
import { ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE } from "./ads-automation-google-ads-mock-import-demo.fixture";
import { AdsAutomationGoogleAdsMockImportDemoService } from "./ads-automation-google-ads-mock-import-demo.service";
import type {
  AdsAutomationGoogleAdsDryRunActionReconciliation,
  AdsAutomationGoogleAdsDryRunReconciliationInput,
  AdsAutomationGoogleAdsDryRunReconciliationResponse,
  AdsAutomationGoogleAdsDryRunReconciliationStatus,
} from "./contracts/ads-automation-google-ads-dry-run-reconciliation.contract";
import type {
  AdsAutomationGoogleAdsMockImportApprovalEvidence,
  AdsAutomationGoogleAdsMockImportDemoResponse,
  AdsAutomationGoogleAdsMockImportDryRunAuditRecord,
} from "./contracts/ads-automation-google-ads-mock-import-demo.contract";
import type { AdsAutomationPendingErpActionRecord } from "./contracts/ads-automation-pending-erp-action.contract";
import type { AdsAutomationProviderValidateOnlyActionPlan } from "./contracts/ads-automation-provider-validate-only.contract";

@Injectable()
export class AdsAutomationGoogleAdsDryRunReconciliationService {
  constructor(
    private readonly mockImportDemoService: AdsAutomationGoogleAdsMockImportDemoService,
  ) {}

  async build(
    input: AdsAutomationGoogleAdsDryRunReconciliationInput = {},
  ): Promise<AdsAutomationGoogleAdsDryRunReconciliationResponse> {
    if (input.demoInput && input.demoResponse) {
      throw new BadRequestException(
        "provide either demoInput or demoResponse, not both",
      );
    }

    const demoResponse = input.demoResponse
      ? this.cloneJson(input.demoResponse)
      : await this.mockImportDemoService.build(
          input.demoInput || ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE,
        );

    return this.reconcileDemoResponse(demoResponse);
  }

  reconcileDemoResponse(
    demoResponse: AdsAutomationGoogleAdsMockImportDemoResponse,
  ): AdsAutomationGoogleAdsDryRunReconciliationResponse {
    this.assertDemoResponse(demoResponse);
    const actions = demoResponse.pendingActionNormalization.pendingActions;
    const approvalsByPendingActionId = new Map(
      demoResponse.approvalEvidence.map((record) => [
        record.pending_action_id,
        record,
      ]),
    );
    const dryRunsByPendingActionId = new Map(
      demoResponse.dryRunExecutionAuditRecords.map((record) => [
        record.pending_action_id,
        record,
      ]),
    );
    const plansByPendingActionId = new Map(
      demoResponse.validateOnlyLane.validationPlans.map((plan) => [
        plan.pending_action_id,
        plan,
      ]),
    );
    const idempotencyCounts = this.countBy(
      actions.map((action) => action.idempotency_key),
    );
    const actionReconciliation = actions.map((action) =>
      this.reconcileAction(
        action,
        approvalsByPendingActionId.get(action.pending_action_id) || null,
        dryRunsByPendingActionId.get(action.pending_action_id) || null,
        plansByPendingActionId.get(action.pending_action_id) || null,
        idempotencyCounts.get(action.idempotency_key) || 0,
      ),
    );
    const gappedActions = actionReconciliation.filter(
      (record) => record.evidence_status === "gaps_found",
    ).length;

    return {
      schemaVersion: "ads_automation_google_ads_dry_run_reconciliation.v1",
      generatedAt: new Date().toISOString(),
      sourceSchemaVersion: demoResponse.schemaVersion,
      reportDate: demoResponse.reportDate,
      importRunId: demoResponse.importRunId,
      cashflowMode: demoResponse.cashflowMode,
      safety: this.safety(),
      summary: {
        status: gappedActions
          ? "gaps_found"
          : "complete_local_evidence_blocked_before_live",
        actions_reconciled: actionReconciliation.length,
        provider_actions_reconciled: actionReconciliation.filter(
          (record) => record.action_family === "provider_google_ads",
        ).length,
        non_provider_actions_reconciled: actionReconciliation.filter(
          (record) => record.action_family !== "provider_google_ads",
        ).length,
        complete_local_evidence_actions: actionReconciliation.filter(
          (record) =>
            record.evidence_status ===
            "complete_local_evidence_blocked_before_live",
        ).length,
        gapped_actions: gappedActions,
        approval_evidence_linked: actionReconciliation.filter(
          (record) => record.gates.approval_evidence_linked,
        ).length,
        mocked_validate_only_passed_provider_actions:
          actionReconciliation.filter(
            (record) =>
              record.action_family === "provider_google_ads" &&
              record.validation_status === "validate_only_passed",
          ).length,
        dry_run_audit_records_linked: actionReconciliation.filter(
          (record) => record.gates.dry_run_audit_linked,
        ).length,
        rollback_evidence_linked: actionReconciliation.filter(
          (record) => record.gates.rollback_evidence_linked,
        ).length,
        duplicate_idempotency_keys: actionReconciliation.filter(
          (record) => record.duplicate_idempotency_key,
        ).length,
        blocked_future_live_actions: actionReconciliation.length,
        execution_ready_now_actions: 0,
        campaignBudgetId_no_fallback: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      },
      actionReconciliation,
    };
  }

  private reconcileAction(
    action: AdsAutomationPendingErpActionRecord,
    approval: AdsAutomationGoogleAdsMockImportApprovalEvidence | null,
    dryRun: AdsAutomationGoogleAdsMockImportDryRunAuditRecord | null,
    plan: AdsAutomationProviderValidateOnlyActionPlan | null,
    idempotencyCount: number,
  ): AdsAutomationGoogleAdsDryRunActionReconciliation {
    const providerAction = action.action_family === "provider_google_ads";
    const identifiersMatch = this.identifiersMatch(
      action,
      approval,
      dryRun,
      plan,
    );
    const rollbackRequired = this.rollbackRequired(action);
    const rollbackPlan =
      this.text(approval?.rollback_plan) || this.referenceRollbackPlan(action);
    const validationStatus = providerAction
      ? plan?.status || "missing"
      : "not_applicable_non_provider_action";
    const customerId = this.effectiveIdentifier(
      action.customerId,
      approval?.customerId,
      dryRun?.identifiers.customerId,
      plan?.customerId,
    );
    const campaignId = this.effectiveIdentifier(
      action.campaignId,
      approval?.campaignId,
      dryRun?.identifiers.campaignId,
      plan?.campaignId,
    );
    const adGroupId = this.effectiveIdentifier(
      action.adGroupId,
      approval?.adGroupId,
      dryRun?.identifiers.adGroupId,
      plan?.adGroupId,
    );
    const gaps = this.gaps(action, {
      approval,
      dryRun,
      plan,
      providerAction,
      identifiersMatch,
      rollbackPlan,
      rollbackRequired,
      duplicateIdempotencyKey: idempotencyCount > 1,
    });
    const status: AdsAutomationGoogleAdsDryRunReconciliationStatus = gaps.length
      ? "gaps_found"
      : "complete_local_evidence_blocked_before_live";

    return {
      pending_action_id: action.pending_action_id,
      approval_id: action.approval_id,
      action_type: action.action_type,
      action_family: action.action_family,
      provider: action.provider,
      customerId,
      campaignId,
      adGroupId,
      campaignBudgetId: action.campaignBudgetId,
      productId: action.productId,
      supplierId: action.supplierId,
      validation_status: validationStatus,
      approval_status: approval?.approval_status || "missing",
      dry_run_record_status: dryRun?.dry_run_record_status || "missing",
      rollback_status: rollbackPlan
        ? "present"
        : rollbackRequired
          ? "missing"
          : "not_required_internal_task",
      identifier_match_status: identifiersMatch ? "matched" : "mismatch",
      evidence_status: status,
      campaignBudgetId_source: this.campaignBudgetIdSource(action),
      idempotency_key: action.idempotency_key,
      duplicate_idempotency_key: idempotencyCount > 1,
      gates: {
        approval_evidence_linked: Boolean(approval),
        validate_only_plan_linked: providerAction ? Boolean(plan) : true,
        validate_only_passed_or_not_applicable: providerAction
          ? plan?.status === "validate_only_passed"
          : true,
        dry_run_audit_linked: Boolean(dryRun),
        rollback_evidence_required: rollbackRequired,
        rollback_evidence_linked: Boolean(rollbackPlan),
        rollback_evidence_requirement_satisfied:
          !rollbackRequired || Boolean(rollbackPlan),
        identifiers_match: identifiersMatch,
        idempotency_key_unique: idempotencyCount <= 1,
        campaignBudgetId_no_fallback: true,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      },
      blockers: this.unique([
        ...gaps,
        ...action.risk_blockers,
        "GOOGLE_ADS_PRODUCTION_ENABLED=false",
        "execution_allowed_now=false",
        "future_live_execution_not_allowed_local_only",
      ]),
      next_required_action: gaps.length
        ? "fix_reconciliation_gaps_before_any_future_executor"
        : "keep_local_only_review_packet",
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      production_ready: false,
    };
  }

  private gaps(
    action: AdsAutomationPendingErpActionRecord,
    context: {
      approval: AdsAutomationGoogleAdsMockImportApprovalEvidence | null;
      dryRun: AdsAutomationGoogleAdsMockImportDryRunAuditRecord | null;
      plan: AdsAutomationProviderValidateOnlyActionPlan | null;
      providerAction: boolean;
      identifiersMatch: boolean;
      rollbackPlan: string | null;
      rollbackRequired: boolean;
      duplicateIdempotencyKey: boolean;
    },
  ): string[] {
    const gaps: string[] = [];
    if (!context.approval) gaps.push("approval_evidence_missing");
    if (context.providerAction && !context.plan)
      gaps.push("validate_only_plan_missing");
    if (
      context.providerAction &&
      context.plan &&
      context.plan.status !== "validate_only_passed"
    ) {
      gaps.push(`validate_only_not_passed:${context.plan.status}`);
    }
    if (!context.dryRun) gaps.push("dry_run_audit_record_missing");
    if (context.rollbackRequired && !context.rollbackPlan)
      gaps.push("rollback_plan_missing");
    if (!context.identifiersMatch) gaps.push("identifier_mismatch");
    if (context.duplicateIdempotencyKey) gaps.push("duplicate_idempotency_key");
    if (
      action.action_type === "update_campaign_budget" &&
      !this.text(action.campaignBudgetId)
    ) {
      gaps.push("campaignBudgetId_missing_no_fallback");
    }
    return gaps;
  }

  private identifiersMatch(
    action: AdsAutomationPendingErpActionRecord,
    approval: AdsAutomationGoogleAdsMockImportApprovalEvidence | null,
    dryRun: AdsAutomationGoogleAdsMockImportDryRunAuditRecord | null,
    plan: AdsAutomationProviderValidateOnlyActionPlan | null,
  ): boolean {
    if (
      action.action_type === "update_campaign_budget" &&
      !this.text(action.campaignBudgetId)
    ) {
      return false;
    }

    const checks: Array<[unknown, unknown]> = [
      [action.customerId, approval?.customerId],
      [action.campaignId, approval?.campaignId],
      [action.adGroupId, approval?.adGroupId],
      [action.campaignBudgetId, approval?.campaignBudgetId],
      [action.customerId, dryRun?.identifiers.customerId],
      [action.campaignId, dryRun?.identifiers.campaignId],
      [action.adGroupId, dryRun?.identifiers.adGroupId],
      [action.campaignBudgetId, dryRun?.identifiers.campaignBudgetId],
      [action.customerId, plan?.customerId],
      [action.campaignId, plan?.campaignId],
      [action.adGroupId, plan?.adGroupId],
      [action.campaignBudgetId, plan?.campaignBudgetId],
    ];

    return checks.every(([left, right]) => {
      const leftText = this.text(left);
      const rightText = this.text(right);
      return !leftText || !rightText || leftText === rightText;
    });
  }

  private effectiveIdentifier(...values: unknown[]): string | null {
    return (
      values
        .map((value) => this.text(value))
        .find((value): value is string => Boolean(value)) || null
    );
  }

  private campaignBudgetIdSource(
    action: AdsAutomationPendingErpActionRecord,
  ): AdsAutomationGoogleAdsDryRunActionReconciliation["campaignBudgetId_source"] {
    if (action.action_type !== "update_campaign_budget") {
      return "not_applicable_non_budget_action";
    }
    return this.text(action.campaignBudgetId)
      ? "campaign_budget_field"
      : "missing_no_fallback";
  }

  private rollbackRequired(
    action: AdsAutomationPendingErpActionRecord,
  ): boolean {
    return [
      "update_campaign_budget",
      "pause_campaign",
      "pause_ad_group",
      "monitor_only",
      "stop_import_review",
    ].includes(action.action_type);
  }

  private referenceRollbackPlan(
    action: AdsAutomationPendingErpActionRecord,
  ): string | null {
    return (
      action.evidence.source_evidence_references
        .map((reference) => this.text(reference.rollback_plan))
        .find((value): value is string => Boolean(value)) || null
    );
  }

  private assertDemoResponse(
    response: AdsAutomationGoogleAdsMockImportDemoResponse,
  ): void {
    if (!response || typeof response !== "object") {
      throw new BadRequestException(
        "Google Ads mock import demo response is required",
      );
    }
    if (
      response.schemaVersion !== "ads_automation_google_ads_mock_import_demo.v1"
    ) {
      throw new BadRequestException(
        "response must use ads_automation_google_ads_mock_import_demo.v1",
      );
    }
    if (
      response.safety.provider_api_called !== false ||
      response.safety.google_ads_api_called !== false ||
      response.safety.validateOnly_called !== false ||
      response.safety.live_ads_execution_used !== false ||
      response.safety.execution_allowed_now !== false ||
      response.safety.production_ready !== false
    ) {
      throw new BadRequestException(
        "reconciliation requires a local-only mock import response with closed execution gates",
      );
    }
    if (!Array.isArray(response.pendingActionNormalization?.pendingActions)) {
      throw new BadRequestException(
        "pending actions are required for reconciliation",
      );
    }
    if (!Array.isArray(response.approvalEvidence)) {
      throw new BadRequestException(
        "approval evidence is required for reconciliation",
      );
    }
    if (!Array.isArray(response.dryRunExecutionAuditRecords)) {
      throw new BadRequestException(
        "dry-run audit records are required for reconciliation",
      );
    }
    if (!Array.isArray(response.validateOnlyLane?.validationPlans)) {
      throw new BadRequestException(
        "validate-only plans are required for reconciliation",
      );
    }
  }

  private safety(): AdsAutomationGoogleAdsDryRunReconciliationResponse["safety"] {
    return {
      read_only: true,
      dry_run: true,
      local_fixture_only: true,
      persistence_used: false,
      durable_storage_used: false,
      erp_local_persistence_used: false,
      provider_persistence_used: false,
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
      future_live_execution_requires_validateOnly_passed: true,
      future_live_execution_requires_approval_evidence: true,
      future_live_execution_requires_dry_run_audit: true,
      future_live_execution_requires_rollback_plan: true,
      erp_only_future_validator_approver_executor: true,
    };
  }

  private countBy(values: string[]): Map<string, number> {
    return values.reduce((counts, value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
      return counts;
    }, new Map<string, number>());
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
