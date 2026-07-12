import { Injectable } from '@nestjs/common';
import { ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE } from './ads-automation-google-ads-mock-import-demo.fixture';
import { AdsAutomationGoogleAdsDryRunReconciliationService } from './ads-automation-google-ads-dry-run-reconciliation.service';
import { AdsAutomationGoogleAdsMockImportDemoService } from './ads-automation-google-ads-mock-import-demo.service';
import type {
  AdsAutomationFoundationAcceptanceCapabilityKey,
  AdsAutomationFoundationAcceptanceCapabilityStatus,
  AdsAutomationFoundationAcceptanceEvidenceRef,
  AdsAutomationFoundationAcceptanceMatrixInput,
  AdsAutomationFoundationAcceptanceMatrixItem,
  AdsAutomationFoundationAcceptanceMatrixResponse,
} from './contracts/ads-automation-foundation-acceptance-matrix.contract';
import type {
  AdsAutomationGoogleAdsMockImportDemoInput,
  AdsAutomationGoogleAdsMockImportDemoResponse,
} from './contracts/ads-automation-google-ads-mock-import-demo.contract';
import type {
  AdsAutomationGoogleAdsDryRunActionReconciliation,
  AdsAutomationGoogleAdsDryRunReconciliationResponse,
} from './contracts/ads-automation-google-ads-dry-run-reconciliation.contract';
import type {
  AdsAutomationPendingErpActionRecord,
  AdsAutomationPendingErpActionType,
} from './contracts/ads-automation-pending-erp-action.contract';

interface AcceptanceContext {
  safeDemo: AdsAutomationGoogleAdsMockImportDemoResponse;
  unsafeDemo: AdsAutomationGoogleAdsMockImportDemoResponse;
  safeReconciliation: AdsAutomationGoogleAdsDryRunReconciliationResponse;
  unsafeReconciliation: AdsAutomationGoogleAdsDryRunReconciliationResponse;
}

const LIVE_BLOCKERS: AdsAutomationFoundationAcceptanceCapabilityStatus[] = [
  'blocked_until_approval_ui',
  'blocked_until_real_credentials',
  'blocked_until_real_provider_validateOnly',
  'blocked_until_small_cap_live_test',
];

@Injectable()
export class AdsAutomationFoundationAcceptanceMatrixService {
  constructor(
    private readonly mockImportDemoService: AdsAutomationGoogleAdsMockImportDemoService,
    private readonly dryRunReconciliationService: AdsAutomationGoogleAdsDryRunReconciliationService,
  ) {}

  async build(
    input: AdsAutomationFoundationAcceptanceMatrixInput = {},
  ): Promise<AdsAutomationFoundationAcceptanceMatrixResponse> {
    const safeDemo = input.safeDemoResponse
      ? this.cloneJson(input.safeDemoResponse)
      : await this.mockImportDemoService.build(
          input.safeDemoInput || ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE,
        );
    const unsafeDemo = input.unsafeDemoResponse
      ? this.cloneJson(input.unsafeDemoResponse)
      : await this.mockImportDemoService.build(
          input.unsafeDemoInput || this.unsafeFixture(),
        );
    const context: AcceptanceContext = {
      safeDemo,
      unsafeDemo,
      safeReconciliation:
        this.dryRunReconciliationService.reconcileDemoResponse(safeDemo),
      unsafeReconciliation:
        this.dryRunReconciliationService.reconcileDemoResponse(unsafeDemo),
    };
    const matrix = [
      this.mayAdsIncrease(context),
      this.increaseAmount(context),
      this.targetCampaignsAdGroups(context),
      this.productBudgetAllocation(context),
      this.supplierSafety(context),
      this.killStopImportReview(context),
      this.pauseReduceCandidates(context),
      this.monitorOnlyDowngrade(context),
      this.rollbackAlertEvidence(context),
      ...this.liveGateItems(context),
    ];
    const baItems = matrix.filter((item) => item.ba_control_question);
    const completeBaItems = baItems.filter((item) => item.status === 'complete_demo');
    const localFoundationComplete = completeBaItems.length === baItems.length;

    return {
      schemaVersion: 'ads_automation_foundation_acceptance_matrix.v1',
      generatedAt: new Date().toISOString(),
      reportDate: safeDemo.reportDate,
      safeImportRunId: safeDemo.importRunId,
      unsafeImportRunId: unsafeDemo.importRunId,
      safety: this.safety(),
      summary: {
        foundation_closeout_status: localFoundationComplete
          ? 'complete_demo_ready_for_final_go_no_go'
          : 'gaps_found_keep_foundation_open',
        matrix_items: matrix.length,
        ba_control_questions: baItems.length,
        ba_control_questions_complete_demo: completeBaItems.length,
        live_readiness_blockers: matrix.filter(
          (item) =>
            !item.ba_control_question && item.status !== 'complete_demo',
        ).length,
        safe_pending_actions: safeDemo.summary.pending_actions_created,
        unsafe_pending_actions: unsafeDemo.summary.pending_actions_created,
        safe_provider_actions:
          context.safeReconciliation.summary.provider_actions_reconciled,
        unsafe_provider_actions:
          context.unsafeReconciliation.summary.provider_actions_reconciled,
        safe_alert_rollback_records: safeDemo.summary.alert_rollback_records,
        unsafe_alert_rollback_records: unsafeDemo.summary.alert_rollback_records,
        execution_ready_now_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_prompt: localFoundationComplete
          ? 'ADS_AUTOMATION_FINAL_GO_NO_GO_GATE_LOCAL_ONLY'
          : 'FIX_LOCAL_FOUNDATION_GAPS',
      },
      matrix,
      sourceEvidence: {
        safe: {
          demoSchemaVersion: safeDemo.schemaVersion,
          reconciliationSchemaVersion:
            context.safeReconciliation.schemaVersion,
          cashflowMode: safeDemo.cashflowMode as 'safe',
          scale_up_execution_mode: safeDemo.summary.scale_up_execution_mode,
          pending_actions_created: safeDemo.summary.pending_actions_created,
          update_budget_actions: safeDemo.summary.update_budget_actions,
          monitor_only_actions: safeDemo.summary.monitor_only_actions,
          pause_actions: safeDemo.summary.pause_actions,
          stop_import_review_actions:
            safeDemo.summary.stop_import_review_actions,
          alert_rollback_records: safeDemo.summary.alert_rollback_records,
        },
        unsafe: {
          demoSchemaVersion: unsafeDemo.schemaVersion,
          reconciliationSchemaVersion:
            context.unsafeReconciliation.schemaVersion,
          cashflowMode: unsafeDemo.cashflowMode as 'unsafe',
          scale_up_execution_mode: unsafeDemo.summary.scale_up_execution_mode,
          pending_actions_created: unsafeDemo.summary.pending_actions_created,
          update_budget_actions: unsafeDemo.summary.update_budget_actions,
          monitor_only_actions: unsafeDemo.summary.monitor_only_actions,
          pause_actions: unsafeDemo.summary.pause_actions,
          stop_import_review_actions:
            unsafeDemo.summary.stop_import_review_actions,
          alert_rollback_records: unsafeDemo.summary.alert_rollback_records,
        },
      },
    };
  }

  private mayAdsIncrease(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const safeBudget = this.findAction(
      context.safeDemo,
      'update_campaign_budget',
    );
    const safeBudgetReconciliation = this.findReconciliation(
      context.safeReconciliation,
      safeBudget,
    );
    const unsafeBudget = this.findAction(
      context.unsafeDemo,
      'update_campaign_budget',
    );
    const unsafeMonitor = this.findScaleMonitorOnly(context.unsafeDemo);
    const complete =
      context.safeDemo.pendingActionNormalization.decisionAnswers
        .increase_ads === 'yes_pending_validation' &&
      Boolean(safeBudget) &&
      this.reconciled(safeBudgetReconciliation) &&
      !unsafeBudget &&
      Boolean(unsafeMonitor);

    return this.item({
      key: 'may_ads_increase',
      label: 'May Ads Increase',
      complete,
      answer:
        'Safe cashflow demo answers yes_pending_validation for the profitable Google Ads ad group; unsafe cashflow removes the budget update and downgrades scale to monitor_only.',
      evidence: this.evidence(
        'combined_safe_unsafe_demo',
        context,
        [safeBudget],
        [unsafeMonitor],
        [
          `safe_increase_ads=${context.safeDemo.pendingActionNormalization.decisionAnswers.increase_ads}`,
          `unsafe_increase_ads=${context.unsafeDemo.pendingActionNormalization.decisionAnswers.increase_ads}`,
        ],
      ),
      blockers: this.gapBlockers(
        complete,
        'safe_or_unsafe_cashflow_scale_answer_missing',
        safeBudgetReconciliation,
      ),
    });
  }

  private increaseAmount(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const action = this.findAction(context.safeDemo, 'update_campaign_budget');
    const reconciliation = this.findReconciliation(
      context.safeReconciliation,
      action,
    );
    const increaseVnd = Number(action?.requested_change.increaseVnd || 0);
    const currentBudgetVnd = Number(
      action?.requested_change.currentBudgetVnd || 0,
    );
    const maxIncreasePercent = Number(
      action?.requested_change.maxIncreasePercent || 0,
    );
    const expectedCap = Math.round(currentBudgetVnd * (maxIncreasePercent / 100));
    const complete =
      this.reconciled(reconciliation) &&
      increaseVnd > 0 &&
      expectedCap > 0 &&
      increaseVnd <= expectedCap &&
      context.safeDemo.pendingActionNormalization.decisionAnswers
        .increase_amount_vnd === increaseVnd;

    return this.item({
      key: 'increase_amount',
      label: 'Increase Amount',
      complete,
      answer: `Local demo proposes ${increaseVnd} VND, capped at ${maxIncreasePercent}% of the current ${currentBudgetVnd} VND campaign budget and still blocked before live execution.`,
      evidence: this.evidence(
        'safe_cashflow_demo',
        context,
        [action],
        [],
        [
          `currentBudgetVnd=${currentBudgetVnd}`,
          `increaseVnd=${increaseVnd}`,
          `maxIncreasePercent=${maxIncreasePercent}`,
          `expectedCapVnd=${expectedCap}`,
        ],
      ),
      blockers: this.gapBlockers(
        complete,
        'budget_increase_amount_or_policy_cap_missing',
        reconciliation,
      ),
    });
  }

  private targetCampaignsAdGroups(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const action = this.findAction(context.safeDemo, 'update_campaign_budget');
    const reconciliation = this.findReconciliation(
      context.safeReconciliation,
      action,
    );
    const complete =
      this.reconciled(reconciliation) &&
      Boolean(reconciliation?.campaignId) &&
      Boolean(reconciliation?.adGroupId) &&
      Boolean(reconciliation?.campaignBudgetId) &&
      reconciliation?.campaignBudgetId_source === 'campaign_budget_field';

    return this.item({
      key: 'target_campaigns_ad_groups',
      label: 'Target Campaigns And Ad Groups',
      complete,
      answer:
        'Local demo identifies the exact Google Ads campaign, ad group, and campaignBudgetId for the scale candidate without falling back to campaignId or adGroupId.',
      evidence: this.evidence(
        'safe_cashflow_demo',
        context,
        [action],
        [],
        [
          `campaignId=${reconciliation?.campaignId || 'missing'}`,
          `adGroupId=${reconciliation?.adGroupId || 'missing'}`,
          `campaignBudgetId=${reconciliation?.campaignBudgetId || 'missing'}`,
          `campaignBudgetId_source=${reconciliation?.campaignBudgetId_source || 'missing'}`,
        ],
      ),
      blockers: this.gapBlockers(
        complete,
        'target_campaign_ad_group_or_campaignBudgetId_missing',
        reconciliation,
      ),
    });
  }

  private productBudgetAllocation(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const action = this.findAction(context.safeDemo, 'update_campaign_budget');
    const reconciliation = this.findReconciliation(
      context.safeReconciliation,
      action,
    );
    const products =
      context.safeDemo.pendingActionNormalization.decisionAnswers
        .products_to_receive_budget;
    const blockedProductHasStopReview = Boolean(
      this.findAction(context.safeDemo, 'stop_import_review'),
    );
    const complete =
      this.reconciled(reconciliation) &&
      products.includes('P_SCALE') &&
      !products.includes('P_BAD') &&
      blockedProductHasStopReview;

    return this.item({
      key: 'product_budget_allocation',
      label: 'Product Budget Allocation',
      complete,
      answer:
        'Product P_SCALE receives the demo budget allocation; P_BAD is excluded and routed to stop-import review because product economics and supplier gates are unsafe.',
      evidence: this.evidence(
        'safe_cashflow_demo',
        context,
        [action, this.findAction(context.safeDemo, 'stop_import_review')],
        [],
        [`products_to_receive_budget=${products.join(',') || 'none'}`],
      ),
      blockers: this.gapBlockers(
        complete,
        'product_budget_allocation_or_blocked_product_review_missing',
        reconciliation,
      ),
    });
  }

  private supplierSafety(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const sourcingActions = this.actions(context.safeDemo, 'supplier_sourcing');
    const safeSupplierDecisions = context.safeDemo.decisionSnapshot.decisions
      .filter(
        (decision) =>
          decision.decision_type === 'supplier_gate' &&
          decision.status === 'safe',
      );
    const unsafeSupplierDecisions = context.safeDemo.decisionSnapshot.decisions
      .filter(
        (decision) =>
          decision.decision_type === 'supplier_gate' &&
          decision.status !== 'safe',
      );
    const complete =
      safeSupplierDecisions.some((decision) => decision.supplierId === 'SUP_SAFE') &&
      unsafeSupplierDecisions.length > 0 &&
      sourcingActions.length > 0 &&
      sourcingActions.every((action) =>
        this.reconciled(
          this.findReconciliation(context.safeReconciliation, action),
        ),
      );

    return this.item({
      key: 'supplier_safety',
      label: 'Supplier Safety',
      complete,
      answer:
        'SUP_SAFE passes supplier safety for P_SCALE, while weak P_BAD suppliers are converted into internal supplier_sourcing review instead of budget growth.',
      evidence: this.evidence(
        'safe_cashflow_demo',
        context,
        sourcingActions,
        [],
        [
          `safe_supplier_decisions=${safeSupplierDecisions.length}`,
          `unsafe_supplier_decisions=${unsafeSupplierDecisions.length}`,
        ],
      ),
      blockers: complete
        ? []
        : this.unique([
            'supplier_safety_gate_or_sourcing_action_missing',
            ...sourcingActions.flatMap((action) =>
              this.findReconciliation(context.safeReconciliation, action)
                ?.blockers || [],
            ),
          ]),
    });
  }

  private killStopImportReview(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const action = this.findAction(context.safeDemo, 'stop_import_review');
    const reconciliation = this.findReconciliation(
      context.safeReconciliation,
      action,
    );
    const requestedChange = action?.requested_change || {};
    const complete =
      this.reconciled(reconciliation) &&
      requestedChange.deleteProduct !== true &&
      requestedChange.providerDelete !== true;

    return this.item({
      key: 'kill_stop_import_review',
      label: 'Kill Or Stop-Import Review',
      complete,
      answer:
        'The demo creates an internal stop_import_review action for the blocked product and explicitly preserves no product delete or provider delete behavior.',
      evidence: this.evidence(
        'safe_cashflow_demo',
        context,
        [action],
        [],
        [
          `deleteProduct=${String(requestedChange.deleteProduct ?? false)}`,
          `providerDelete=${String(requestedChange.providerDelete ?? false)}`,
        ],
      ),
      blockers: this.gapBlockers(
        complete,
        'stop_import_review_safe_internal_action_missing',
        reconciliation,
      ),
    });
  }

  private pauseReduceCandidates(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const pauseActions = [
      ...this.actions(context.safeDemo, 'pause_ad_group'),
      ...this.actions(context.safeDemo, 'pause_campaign'),
    ];
    const reconciliations = pauseActions.map((action) =>
      this.findReconciliation(context.safeReconciliation, action),
    );
    const complete =
      pauseActions.length > 0 &&
      reconciliations.every((reconciliation) => this.reconciled(reconciliation));

    return this.item({
      key: 'pause_reduce_candidates',
      label: 'Pause Or Reduce Candidates',
      complete,
      answer:
        'Refund-heavy Google Ads traffic is represented as an approval-only pause candidate; no automatic reduce, delete, or live provider mutation is introduced.',
      evidence: this.evidence(
        'safe_cashflow_demo',
        context,
        pauseActions,
        [],
        [`pause_action_count=${pauseActions.length}`],
      ),
      blockers: complete
        ? []
        : this.unique([
            'pause_or_reduce_candidate_evidence_missing',
            ...reconciliations.flatMap(
              (reconciliation) => reconciliation?.blockers || [],
            ),
          ]),
    });
  }

  private monitorOnlyDowngrade(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const action = this.findScaleMonitorOnly(context.unsafeDemo);
    const reconciliation = this.findReconciliation(
      context.unsafeReconciliation,
      action,
    );
    const unsafeBudget = this.findAction(
      context.unsafeDemo,
      'update_campaign_budget',
    );
    const complete =
      !unsafeBudget &&
      Boolean(action) &&
      this.reconciled(reconciliation) &&
      (action?.risk_blockers || []).includes('cashflow_gate_blocked');

    return this.item({
      key: 'monitor_only_downgrade',
      label: 'Monitor-Only Downgrade',
      complete,
      answer:
        'Unsafe cashflow removes the scale budget update and produces a monitor_only action carrying the cashflow gate blocker.',
      evidence: this.evidence(
        'unsafe_cashflow_demo',
        context,
        [],
        [action],
        [
          `unsafe_update_budget_present=${Boolean(unsafeBudget)}`,
          `risk_blockers=${(action?.risk_blockers || []).join(',') || 'none'}`,
        ],
      ),
      blockers: this.gapBlockers(
        complete,
        'unsafe_cashflow_monitor_only_downgrade_missing',
        reconciliation,
      ),
    });
  }

  private rollbackAlertEvidence(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem {
    const safeRequired = this.rollbackRequiredActions(context.safeDemo);
    const unsafeRequired = this.rollbackRequiredActions(context.unsafeDemo);
    const safeAlertIds = new Set(
      context.safeDemo.alertRollbackEvidence.map(
        (record) => record.pending_action_id,
      ),
    );
    const unsafeAlertIds = new Set(
      context.unsafeDemo.alertRollbackEvidence.map(
        (record) => record.pending_action_id,
      ),
    );
    const missingAlerts = [
      ...safeRequired
        .filter((action) => !safeAlertIds.has(action.pending_action_id))
        .map((action) => action.pending_action_id),
      ...unsafeRequired
        .filter((action) => !unsafeAlertIds.has(action.pending_action_id))
        .map((action) => action.pending_action_id),
    ];
    const rollbackGaps = [
      ...safeRequired
        .map((action) =>
          this.findReconciliation(context.safeReconciliation, action),
        )
        .filter((record) => record?.rollback_status !== 'present'),
      ...unsafeRequired
        .map((action) =>
          this.findReconciliation(context.unsafeReconciliation, action),
        )
        .filter((record) => record?.rollback_status !== 'present'),
    ];
    const complete =
      safeRequired.length > 0 &&
      unsafeRequired.length > 0 &&
      missingAlerts.length === 0 &&
      rollbackGaps.length === 0;

    return this.item({
      key: 'rollback_alert_evidence',
      label: 'Rollback And Alert Evidence',
      complete,
      answer:
        'All local provider-risk and safety-preserving actions have dry-run rollback evidence plus alert records, while execution remains disabled.',
      evidence: this.evidence(
        'combined_safe_unsafe_demo',
        context,
        safeRequired,
        unsafeRequired,
        [
          `safe_alert_rollback_records=${context.safeDemo.summary.alert_rollback_records}`,
          `unsafe_alert_rollback_records=${context.unsafeDemo.summary.alert_rollback_records}`,
          `missing_alert_pending_action_ids=${missingAlerts.join(',') || 'none'}`,
        ],
      ),
      blockers: complete
        ? []
        : this.unique([
            ...(missingAlerts.length
              ? [`alert_rollback_evidence_missing:${missingAlerts.join(',')}`]
              : []),
            ...rollbackGaps.flatMap((record) => record?.blockers || []),
          ]),
    });
  }

  private liveGateItems(
    context: AcceptanceContext,
  ): AdsAutomationFoundationAcceptanceMatrixItem[] {
    return [
      this.blockedItem({
        key: 'real_credentials_gate',
        label: 'Real Credentials Gate',
        status: 'blocked_until_real_credentials',
        answer:
          'MCC/BM/BC credentials and tokens are intentionally absent from this repo-local foundation.',
        evidence: this.evidence('combined_safe_unsafe_demo', context, [], [], [
          'no_plaintext_credentials_added',
        ]),
      }),
      this.blockedItem({
        key: 'real_provider_validateOnly_gate',
        label: 'Real Provider ValidateOnly Gate',
        status: 'blocked_until_real_provider_validateOnly',
        answer:
          'Validate-only evidence is mocked at the ERP boundary; no provider validateOnly call is made in this foundation.',
        evidence: this.evidence('combined_safe_unsafe_demo', context, [], [], [
          'provider_validateOnly_lane_mocked=true',
        ]),
      }),
      this.blockedItem({
        key: 'approval_ui_gate',
        label: 'Approval UI Gate',
        status: 'blocked_until_approval_ui',
        answer:
          'Approval evidence exists as local fixture/read-model proof, but final operator approval UI flow remains outside this closeout.',
        evidence: this.evidence('combined_safe_unsafe_demo', context, [], [], [
          'approval_required_for_all_actions=true',
        ]),
      }),
      this.blockedItem({
        key: 'small_cap_live_test_gate',
        label: 'Small-Cap Live Test Gate',
        status: 'blocked_until_small_cap_live_test',
        answer:
          'Even after credentials, approval UI, and real validateOnly, live execution must remain blocked until a separately approved small-cap test.',
        evidence: this.evidence('combined_safe_unsafe_demo', context, [], [], [
          'execution_allowed_now=false',
          'production_ready=false',
        ]),
      }),
    ];
  }

  private item(params: {
    key: AdsAutomationFoundationAcceptanceCapabilityKey;
    label: string;
    complete: boolean;
    answer: string;
    evidence: AdsAutomationFoundationAcceptanceEvidenceRef;
    blockers: string[];
  }): AdsAutomationFoundationAcceptanceMatrixItem {
    return {
      key: params.key,
      label: params.label,
      ba_control_question: true,
      status: params.complete ? 'complete_demo' : 'blocked_until_approval_ui',
      answer: params.answer,
      evidence: params.evidence,
      blockers: params.complete ? [] : this.unique(params.blockers),
      next_required_before_live: LIVE_BLOCKERS,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      production_ready: false,
    };
  }

  private blockedItem(params: {
    key: AdsAutomationFoundationAcceptanceCapabilityKey;
    label: string;
    status: AdsAutomationFoundationAcceptanceCapabilityStatus;
    answer: string;
    evidence: AdsAutomationFoundationAcceptanceEvidenceRef;
  }): AdsAutomationFoundationAcceptanceMatrixItem {
    return {
      key: params.key,
      label: params.label,
      ba_control_question: false,
      status: params.status,
      answer: params.answer,
      evidence: params.evidence,
      blockers: [
        'GOOGLE_ADS_PRODUCTION_ENABLED=false',
        'execution_allowed_now=false',
        'production_ready=false',
      ],
      next_required_before_live: [params.status],
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      production_ready: false,
    };
  }

  private evidence(
    source: AdsAutomationFoundationAcceptanceEvidenceRef['source'],
    context: AcceptanceContext,
    safeActions: Array<AdsAutomationPendingErpActionRecord | null | undefined>,
    unsafeActions: Array<AdsAutomationPendingErpActionRecord | null | undefined>,
    notes: string[],
  ): AdsAutomationFoundationAcceptanceEvidenceRef {
    const actions =
      source === 'unsafe_cashflow_demo'
        ? unsafeActions
        : source === 'safe_cashflow_demo'
          ? safeActions
          : [...safeActions, ...unsafeActions];
    const actionIds = new Set(
      actions
        .filter((action): action is AdsAutomationPendingErpActionRecord =>
          Boolean(action),
        )
        .map((action) => action.pending_action_id),
    );
    const safeDryRuns = context.safeDemo.dryRunExecutionAuditRecords.filter(
      (record) => actionIds.has(record.pending_action_id),
    );
    const unsafeDryRuns = context.unsafeDemo.dryRunExecutionAuditRecords.filter(
      (record) => actionIds.has(record.pending_action_id),
    );
    const safeAlerts = context.safeDemo.alertRollbackEvidence.filter((record) =>
      actionIds.has(record.pending_action_id),
    );
    const unsafeAlerts = context.unsafeDemo.alertRollbackEvidence.filter(
      (record) => actionIds.has(record.pending_action_id),
    );

    return {
      source,
      importRunId:
        source === 'unsafe_cashflow_demo'
          ? context.unsafeDemo.importRunId
          : source === 'safe_cashflow_demo'
            ? context.safeDemo.importRunId
            : `${context.safeDemo.importRunId}+${context.unsafeDemo.importRunId}`,
      pending_action_ids: this.unique([...actionIds]),
      approval_ids: this.unique(
        actions
          .filter((action): action is AdsAutomationPendingErpActionRecord =>
            Boolean(action),
          )
          .map((action) => action.approval_id),
      ),
      dry_run_record_ids: this.unique(
        [...safeDryRuns, ...unsafeDryRuns].map(
          (record) => record.execution_record_id,
        ),
      ),
      alert_ids: this.unique(
        [...safeAlerts, ...unsafeAlerts].map((record) => record.alert_id),
      ),
      campaignIds: this.unique(
        [
          ...actions
            .filter((action): action is AdsAutomationPendingErpActionRecord =>
              Boolean(action),
            )
            .map((action) => action.campaignId),
          ...[...safeDryRuns, ...unsafeDryRuns].map(
            (record) => record.identifiers.campaignId,
          ),
        ].filter((value): value is string => Boolean(value)),
      ),
      adGroupIds: this.unique(
        [
          ...actions
            .filter((action): action is AdsAutomationPendingErpActionRecord =>
              Boolean(action),
            )
            .map((action) => action.adGroupId),
          ...[...safeDryRuns, ...unsafeDryRuns].map(
            (record) => record.identifiers.adGroupId,
          ),
        ].filter((value): value is string => Boolean(value)),
      ),
      campaignBudgetIds: this.unique(
        [
          ...actions
            .filter((action): action is AdsAutomationPendingErpActionRecord =>
              Boolean(action),
            )
            .map((action) => action.campaignBudgetId),
          ...[...safeDryRuns, ...unsafeDryRuns].map(
            (record) => record.identifiers.campaignBudgetId,
          ),
        ].filter((value): value is string => Boolean(value)),
      ),
      productIds: this.unique(
        actions
          .filter((action): action is AdsAutomationPendingErpActionRecord =>
            Boolean(action),
          )
          .map((action) => action.productId)
          .filter((value): value is string => Boolean(value)),
      ),
      supplierIds: this.unique(
        actions
          .filter((action): action is AdsAutomationPendingErpActionRecord =>
            Boolean(action),
          )
          .map((action) => action.supplierId)
          .filter((value): value is string => Boolean(value)),
      ),
      notes: this.unique(notes),
    };
  }

  private rollbackRequiredActions(
    demo: AdsAutomationGoogleAdsMockImportDemoResponse,
  ): AdsAutomationPendingErpActionRecord[] {
    return demo.pendingActionNormalization.pendingActions.filter((action) =>
      [
        'update_campaign_budget',
        'pause_campaign',
        'pause_ad_group',
        'monitor_only',
        'stop_import_review',
      ].includes(action.action_type),
    );
  }

  private findScaleMonitorOnly(
    demo: AdsAutomationGoogleAdsMockImportDemoResponse,
  ): AdsAutomationPendingErpActionRecord | undefined {
    return demo.pendingActionNormalization.pendingActions.find(
      (action) =>
        action.action_type === 'monitor_only' &&
        (action.source_decision_type === 'scale_ads' ||
          action.productId === 'P_SCALE'),
    );
  }

  private findAction(
    demo: AdsAutomationGoogleAdsMockImportDemoResponse,
    actionType: AdsAutomationPendingErpActionType,
  ): AdsAutomationPendingErpActionRecord | undefined {
    return demo.pendingActionNormalization.pendingActions.find(
      (action) => action.action_type === actionType,
    );
  }

  private actions(
    demo: AdsAutomationGoogleAdsMockImportDemoResponse,
    actionType: AdsAutomationPendingErpActionType,
  ): AdsAutomationPendingErpActionRecord[] {
    return demo.pendingActionNormalization.pendingActions.filter(
      (action) => action.action_type === actionType,
    );
  }

  private findReconciliation(
    response: AdsAutomationGoogleAdsDryRunReconciliationResponse,
    action: AdsAutomationPendingErpActionRecord | null | undefined,
  ): AdsAutomationGoogleAdsDryRunActionReconciliation | undefined {
    if (!action) return undefined;
    return response.actionReconciliation.find(
      (record) => record.pending_action_id === action.pending_action_id,
    );
  }

  private reconciled(
    record: AdsAutomationGoogleAdsDryRunActionReconciliation | undefined,
  ): boolean {
    return (
      record?.evidence_status ===
        'complete_local_evidence_blocked_before_live' &&
      record.execution_allowed_now === false &&
      record.provider_api_called === false &&
      record.google_ads_api_called === false &&
      record.validateOnly_called === false &&
      record.live_ads_execution_used === false &&
      record.production_ready === false
    );
  }

  private gapBlockers(
    complete: boolean,
    fallback: string,
    reconciliation:
      | AdsAutomationGoogleAdsDryRunActionReconciliation
      | undefined,
  ): string[] {
    if (complete) return [];
    return this.unique([fallback, ...(reconciliation?.blockers || [])]);
  }

  private safety(): AdsAutomationFoundationAcceptanceMatrixResponse['safety'] {
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
    };
  }

  private unsafeFixture(): AdsAutomationGoogleAdsMockImportDemoInput {
    return {
      ...this.cloneJson(ADS_AUTOMATION_GOOGLE_ADS_MOCK_IMPORT_DEMO_FIXTURE),
      cashflowMode: 'unsafe',
    };
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
