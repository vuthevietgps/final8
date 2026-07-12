import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationDecisionDraftPreview,
} from './contracts/ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationSmallCapBudgetCandidate,
  AdsAutomationSmallCapReadinessSimulatorInput,
  AdsAutomationSmallCapReadinessSimulatorResponse,
  AdsAutomationSmallCapReadinessStage,
} from './contracts/ads-automation-small-cap-readiness-simulator.contract';

const DEFAULT_MAX_SMALL_CAP_INCREASE_VND = 100000;
const DEFAULT_MAX_SMALL_CAP_INCREASE_PERCENT = 10;

@Injectable()
export class AdsAutomationSmallCapReadinessSimulatorService {
  build(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): AdsAutomationSmallCapReadinessSimulatorResponse {
    this.assertPayload(input);

    const reportDate = this.isoDate(
      input.reportDate || input.foundationSnapshot.snapshotDate,
      'reportDate',
    );
    const generatedAt = (input.now
      ? this.dateTime(input.now, 'now')
      : new Date()).toISOString();
    const maxSmallCapIncreaseVnd = this.nonNegativeNumber(
      input.maxSmallCapIncreaseVnd ?? DEFAULT_MAX_SMALL_CAP_INCREASE_VND,
      'maxSmallCapIncreaseVnd',
    );
    const maxSmallCapIncreasePercent = this.nonNegativeNumber(
      input.maxSmallCapIncreasePercent
        ?? DEFAULT_MAX_SMALL_CAP_INCREASE_PERCENT,
      'maxSmallCapIncreasePercent',
    );
    const updateBudgetDrafts = (input.draftPreview.drafts || [])
      .filter((draft) => draft.action_type === 'update_campaign_budget');
    const budgetCandidates = updateBudgetDrafts.map((draft) =>
      this.budgetCandidate(
        draft,
        maxSmallCapIncreaseVnd,
        maxSmallCapIncreasePercent,
      ));
    const foundationBlockers = this.foundationBlockers(input);
    const draftBlockers = this.draftBlockers(input);
    const budgetBlockers = this.budgetBlockers(budgetCandidates);
    const cashflowAndLossLimitBlockers =
      this.cashflowAndLossLimitBlockers(input);
    const providerReadinessBlockers = this.providerReadinessBlockers(input);
    const hardBlockers = this.unique([
      ...foundationBlockers,
      ...draftBlockers,
      ...budgetBlockers,
      ...cashflowAndLossLimitBlockers,
      ...providerReadinessBlockers,
    ]);
    const noBudgetAction = budgetCandidates.length === 0;
    const status = noBudgetAction
      ? 'blocked_no_budget_action'
      : hardBlockers.length
        ? 'blocked_monitor_only'
        : 'ready_for_human_approval_dry_run';
    const scaleMode = status === 'ready_for_human_approval_dry_run'
      ? 'pending_validation'
      : 'monitor_only';
    const stages = this.stages({
      input,
      foundationBlockers,
      draftBlockers,
      budgetCandidates,
      budgetBlockers,
      cashflowAndLossLimitBlockers,
      providerReadinessBlockers,
    });
    const readinessBlockers = this.unique(stages.flatMap((stage) => stage.blockers));
    const requestedIncreaseVnd = this.sum(
      budgetCandidates.map((candidate) => candidate.requestedIncreaseVnd),
    );
    const simulatedCappedIncreaseVnd = this.sum(
      budgetCandidates.map((candidate) => (
        candidate.status === 'eligible_for_small_cap_simulation'
          ? candidate.simulatedCappedIncreaseVnd
          : 0
      )),
    );

    return {
      schemaVersion: 'ads_automation_small_cap_readiness_simulator.v1',
      generatedAt,
      reportDate,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
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
        direct_google_ads_api_call: false,
        provider_mutation_used: false,
        campaignBudgetId_no_fallback: true,
        approval_required_for_all_drafts: true,
        future_provider_validateOnly_required_before_execution: true,
        future_live_execution_allowed: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
        erp_only_future_validator_approver_executor: true,
      },
      summary: {
        status,
        fixture_mode: input.fixtureMode || 'custom_local_payload',
        reportDate,
        provider_action_drafts: (input.draftPreview.drafts || [])
          .filter((draft) => draft.action_family === 'provider_google_ads').length,
        update_budget_drafts: updateBudgetDrafts.length,
        eligible_small_cap_candidates: budgetCandidates
          .filter((candidate) => candidate.status === 'eligible_for_small_cap_simulation').length,
        blocked_small_cap_candidates: budgetCandidates
          .filter((candidate) => candidate.status !== 'eligible_for_small_cap_simulation').length,
        requested_increase_vnd: requestedIncreaseVnd,
        simulated_capped_increase_vnd: simulatedCappedIncreaseVnd,
        approved_increase_vnd: 0,
        blocked_increase_vnd: requestedIncreaseVnd,
        scale_up_execution_mode: scaleMode,
        local_dry_run_only: true,
        small_cap_live_test_allowed: false,
        provider_validateOnly_required_before_future_execution: true,
        human_approval_required_before_future_execution: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: status === 'ready_for_human_approval_dry_run'
          ? 'review_human_approval_dry_run_packet'
          : 'resolve_small_cap_readiness_blockers',
      },
      sourceDigest: {
        foundation_snapshot_schema_version:
          input.foundationSnapshot.schemaVersion,
        draft_preview_schema_version: input.draftPreview.schemaVersion,
        loss_limit_policy_schema_version:
          input.lossLimitPolicy?.schemaVersion || null,
        provider_account_readiness_schema_version:
          input.providerAccountReadiness?.schemaVersion || null,
        production_readiness_bridge_schema_version:
          input.productionReadinessBridge?.schemaVersion || null,
        source_snapshot_date: input.foundationSnapshot.snapshotDate,
        draft_preview_source: input.draftPreview.source,
        decision_snapshot_reused: true,
        read_model_snapshot_preserved: true,
        draft_preview_reused: true,
      },
      budgetCandidates,
      stages,
      readinessBlockers,
      cashflowAndLossLimitBlockers,
      providerReadinessBlockers,
      allowedSafeActions: this.allowedSafeActions(input),
      reviewedDrafts: (input.draftPreview.drafts || []).map((draft) => ({
        draft_id: draft.draft_id,
        action_type: draft.action_type,
        action_family: draft.action_family,
        provider: draft.provider,
        resource_type: draft.resource_type,
        status: draft.status,
        execution_allowed_now: draft.execution_allowed_now,
        validate_only_required: draft.validate_only_required,
        provider_api_called: draft.provider_api_called,
        google_ads_api_called: draft.google_ads_api_called,
        live_ads_execution_used: draft.live_ads_execution_used,
        missing_data_blockers: [...draft.missing_data_blockers],
        blockers: [...draft.blockers],
      })),
      markdownPreview: this.markdownPreview({
        reportDate,
        status,
        budgetCandidates,
        readinessBlockers,
        scaleMode,
      }),
    };
  }

  private budgetCandidate(
    draft: AdsAutomationDecisionDraftPreview,
    maxSmallCapIncreaseVnd: number,
    maxSmallCapIncreasePercent: number,
  ): AdsAutomationSmallCapBudgetCandidate {
    const payload = draft.typedPayload || {};
    const currentDailyBudgetVnd = this.numberOrNull(
      payload.currentBudgetVnd ?? payload.currentDailyBudgetVnd,
    );
    const requestedDailyBudgetVnd = this.numberOrNull(
      payload.dailyBudget ?? payload.requestedDailyBudgetVnd,
    );
    const campaignBudgetId = this.text(payload.campaignBudgetId);
    const campaignBudgetResourceName = this.text(payload.campaignBudgetResourceName);
    const requestedIncreaseVnd = currentDailyBudgetVnd !== null
      && requestedDailyBudgetVnd !== null
      ? Math.max(0, requestedDailyBudgetVnd - currentDailyBudgetVnd)
      : 0;
    const capByPercentVnd = currentDailyBudgetVnd === null
      ? null
      : Math.floor((currentDailyBudgetVnd * maxSmallCapIncreasePercent) / 100);
    const capCandidates = [
      requestedIncreaseVnd,
      maxSmallCapIncreaseVnd,
      ...(capByPercentVnd === null ? [] : [capByPercentVnd]),
    ];
    const simulatedCappedIncreaseVnd = Math.max(0, Math.min(...capCandidates));
    const simulatedCappedDailyBudgetVnd = currentDailyBudgetVnd === null
      ? null
      : currentDailyBudgetVnd + simulatedCappedIncreaseVnd;
    const blockers = this.unique([
      ...(!campaignBudgetId ? ['campaignBudgetId_missing_no_fallback'] : []),
      ...(currentDailyBudgetVnd === null ? ['currentDailyBudgetVnd_missing'] : []),
      ...(requestedDailyBudgetVnd === null ? ['requestedDailyBudgetVnd_missing'] : []),
      ...draft.missing_data_blockers,
      ...draft.blockers,
    ]);
    const status = !campaignBudgetId
      ? 'blocked_missing_campaignBudgetId'
      : currentDailyBudgetVnd === null || requestedDailyBudgetVnd === null
        ? 'blocked_missing_budget_numbers'
        : 'eligible_for_small_cap_simulation';

    return {
      draft_id: draft.draft_id,
      source_decision_id: draft.source_decision_id,
      accountId: draft.accountId,
      campaignId: this.text(payload.campaignId),
      adGroupId: this.text(payload.adGroupId) || (
        draft.entity_type === 'ad_group' ? draft.entity_id : null
      ),
      campaignBudgetId,
      campaignBudgetResourceName,
      productId: draft.productId,
      currentDailyBudgetVnd,
      requestedDailyBudgetVnd,
      requestedIncreaseVnd,
      maxSmallCapIncreaseVnd,
      maxSmallCapIncreasePercent,
      capByPercentVnd,
      simulatedCappedIncreaseVnd,
      simulatedCappedDailyBudgetVnd,
      approvedIncreaseVnd: 0,
      blockedIncreaseVnd: requestedIncreaseVnd,
      campaignBudgetIdNoFallback: true,
      status,
      blockers,
    };
  }

  private stages(input: {
    input: AdsAutomationSmallCapReadinessSimulatorInput;
    foundationBlockers: string[];
    draftBlockers: string[];
    budgetCandidates: AdsAutomationSmallCapBudgetCandidate[];
    budgetBlockers: string[];
    cashflowAndLossLimitBlockers: string[];
    providerReadinessBlockers: string[];
  }): AdsAutomationSmallCapReadinessStage[] {
    const productionBridge = input.input.productionReadinessBridge || null;
    const productionBridgeBlockers = productionBridge
      ? this.unique([
        ...(productionBridge.status === 'LOCAL_READINESS_BRIDGE_PASS'
          ? []
          : productionBridge.bridgeBlockers),
        ...productionBridge.blockersForRealProduction,
      ])
      : ['production_readiness_bridge_not_supplied_for_live_gate'];

    return [
      {
        stage: 'decision_foundation',
        status: input.foundationBlockers.length ? 'blocked' : 'ready',
        blockers: [...input.foundationBlockers],
        evidence: [
          `foundation_schema=${input.input.foundationSnapshot.schemaVersion}`,
          `scale_candidates=${input.input.foundationSnapshot.scale_ads_decision.candidates.length}`,
          `total_increase_vnd=${input.input.foundationSnapshot.scale_amount.total_increase_vnd}`,
        ],
        next_required_action: input.foundationBlockers.length
          ? 'resolve_foundation_decision_blockers'
          : 'review_draft_preview',
      },
      {
        stage: 'draft_preview',
        status: input.draftBlockers.length ? 'blocked' : 'ready',
        blockers: [...input.draftBlockers],
        evidence: [
          `draft_preview_schema=${input.input.draftPreview.schemaVersion}`,
          `drafts=${input.input.draftPreview.summary.drafts_created}`,
          `provider_action_drafts=${input.input.draftPreview.summary.provider_action_drafts}`,
        ],
        next_required_action: input.draftBlockers.length
          ? 'resolve_draft_preview_blockers'
          : 'simulate_small_cap_budget',
      },
      {
        stage: 'small_cap_budget',
        status: input.budgetCandidates.length === 0
          ? 'blocked'
          : input.budgetBlockers.length
            ? 'blocked'
            : 'ready',
        blockers: input.budgetCandidates.length === 0
          ? ['update_campaign_budget_draft_missing']
          : [...input.budgetBlockers],
        evidence: [
          `candidate_count=${input.budgetCandidates.length}`,
          `simulated_capped_increase_vnd=${this.sum(input.budgetCandidates.map((candidate) => candidate.simulatedCappedIncreaseVnd))}`,
          'campaignBudgetId_no_fallback=true',
        ],
        next_required_action: input.budgetCandidates.length === 0
          ? 'create_budget_update_draft_from_existing_decision_preview'
          : input.budgetBlockers.length
            ? 'resolve_budget_candidate_blockers'
            : 'review_loss_limit_policy',
      },
      {
        stage: 'loss_limit_policy',
        status: input.cashflowAndLossLimitBlockers.length ? 'monitor_only' : 'ready',
        blockers: [...input.cashflowAndLossLimitBlockers],
        evidence: input.input.lossLimitPolicy
          ? [
            `loss_limit_policy_schema=${input.input.lossLimitPolicy.schemaVersion}`,
            `all_safe_for_increase=${input.input.lossLimitPolicy.summary.all_safe_for_increase}`,
            `policy_allowed_for_requested_action=${input.input.lossLimitPolicy.summary.policy_allowed_for_requested_action}`,
          ]
          : ['loss_limit_policy_missing'],
        next_required_action: input.cashflowAndLossLimitBlockers.length
          ? 'preserve_cash_and_resolve_loss_limit_blockers'
          : 'review_provider_account_readiness',
      },
      {
        stage: 'provider_account_readiness',
        status: input.providerReadinessBlockers.length ? 'blocked' : 'ready',
        blockers: [...input.providerReadinessBlockers],
        evidence: input.input.providerAccountReadiness
          ? [
            `provider_account_readiness_schema=${input.input.providerAccountReadiness.schemaVersion}`,
            `provider_actions_ready=${input.input.providerAccountReadiness.summary.provider_actions_ready_for_future_validate_only}`,
            'provider_api_called=false',
          ]
          : ['provider_account_readiness_missing'],
        next_required_action: input.providerReadinessBlockers.length
          ? 'resolve_provider_account_readiness'
          : 'review_human_approval_gate',
      },
      {
        stage: 'approval_gate',
        status: 'pending',
        blockers: ['human_approval_required_before_future_execution'],
        evidence: [
          'approval_required_for_all_drafts=true',
          'simulator_does_not_mutate_approval_status=true',
        ],
        next_required_action: 'complete_human_approval_in_erp_before_future_preflight',
      },
      {
        stage: 'validate_only_gate',
        status: 'pending',
        blockers: ['future_provider_validateOnly_required_before_execution'],
        evidence: [
          'validateOnly_called=false',
          'provider_validateOnly_adapter_boundary_only=true',
        ],
        next_required_action: 'run_future_erp_validateOnly_after_approval_and_credentials',
      },
      {
        stage: 'execution_preflight',
        status: 'blocked',
        blockers: [
          'execution_preflight_not_run_by_simulator',
          'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
        ],
        evidence: [
          'execution_allowed_now=false',
          'production_ready=false',
          'live_ads_execution_used=false',
        ],
        next_required_action: 'run_existing_preflight_dry_run_after_all_prior_gates',
      },
      {
        stage: 'production_bridge',
        status: productionBridge
          ? productionBridge.status === 'LOCAL_READINESS_BRIDGE_PASS'
            ? 'ready'
            : 'blocked'
          : 'pending',
        blockers: productionBridgeBlockers,
        evidence: productionBridge
          ? [
            `production_bridge_schema=${productionBridge.schemaVersion}`,
            `production_bridge_status=${productionBridge.status}`,
            `execution_allowed_now=${productionBridge.execution_allowed_now}`,
          ]
          : ['production_readiness_bridge_not_supplied_for_live_gate'],
        next_required_action: productionBridge
          ? 'resolve_production_readiness_bridge_blockers_before_live_test'
          : 'attach_production_readiness_bridge_when_reviewing_live_gate',
      },
    ];
  }

  private foundationBlockers(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): string[] {
    return this.unique([
      ...input.foundationSnapshot.blockers.global,
      ...input.foundationSnapshot.blockers.missing_fields.map((field) => `missing.${field}`),
      ...Object.entries(input.foundationSnapshot.blockers.by_category)
        .flatMap(([category, blockers]) => blockers.map((blocker) => `${category}.${blocker}`)),
      ...(input.foundationSnapshot.safety.execution_allowed_now === false
        ? []
        : ['foundation.execution_allowed_now_not_false']),
      ...(input.foundationSnapshot.safety.production_ready === false
        ? []
        : ['foundation.production_ready_not_false']),
      ...(input.foundationSnapshot.safety.google_ads_api_called === false
        ? []
        : ['foundation.google_ads_api_called']),
    ]);
  }

  private draftBlockers(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): string[] {
    return this.unique([
      ...input.draftPreview.drafts.flatMap((draft) => draft.missing_data_blockers),
      ...input.draftPreview.drafts.flatMap((draft) => draft.blockers),
      ...(input.draftPreview.safety.execution_allowed_now === false
        ? []
        : ['draft_preview.execution_allowed_now_not_false']),
      ...(input.draftPreview.safety.production_ready === false
        ? []
        : ['draft_preview.production_ready_not_false']),
      ...(input.draftPreview.safety.google_ads_api_called === false
        ? []
        : ['draft_preview.google_ads_api_called']),
    ]);
  }

  private budgetBlockers(
    candidates: AdsAutomationSmallCapBudgetCandidate[],
  ): string[] {
    return this.unique(candidates.flatMap((candidate) => candidate.blockers));
  }

  private cashflowAndLossLimitBlockers(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): string[] {
    const policy = input.lossLimitPolicy;
    if (!policy) return ['loss_limit_policy_missing'];

    return this.unique([
      ...policy.scaleBlockers,
      ...policy.requestedActionBlockers,
      ...(policy.summary.all_safe_for_increase ? [] : ['loss_limit_policy.all_safe_for_increase_false']),
      ...(policy.summary.policy_allowed_for_requested_action ? [] : ['loss_limit_policy.policy_allowed_for_requested_action_false']),
      ...(policy.safety.execution_allowed_now === false ? [] : ['loss_limit_policy.execution_allowed_now_not_false']),
      ...(policy.safety.production_ready === false ? [] : ['loss_limit_policy.production_ready_not_false']),
      ...(policy.safety.google_ads_api_called === false ? [] : ['loss_limit_policy.google_ads_api_called']),
    ]);
  }

  private providerReadinessBlockers(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): string[] {
    const readiness = input.providerAccountReadiness;
    if (!readiness) return ['provider_account_readiness_missing'];

    return this.unique([
      ...readiness.blockers,
      ...readiness.requestedActions.flatMap((action) => action.blockers),
      ...(readiness.summary.status === 'ready_for_local_validate_only'
        ? []
        : [`provider_account_readiness_status.${readiness.summary.status}`]),
      ...(readiness.safety.execution_allowed_now === false
        ? []
        : ['provider_account_readiness.execution_allowed_now_not_false']),
      ...(readiness.safety.production_ready === false
        ? []
        : ['provider_account_readiness.production_ready_not_false']),
      ...(readiness.safety.google_ads_api_called === false
        ? []
        : ['provider_account_readiness.google_ads_api_called']),
    ]);
  }

  private allowedSafeActions(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): Array<'monitor_only' | 'pause_campaign' | 'pause_ad_group' | 'reduce_campaign_budget'> {
    const values = input.lossLimitPolicy?.safeActionsAvailable || ['monitor_only'];
    return this.unique(['monitor_only', ...values]) as
      Array<'monitor_only' | 'pause_campaign' | 'pause_ad_group' | 'reduce_campaign_budget'>;
  }

  private markdownPreview(input: {
    reportDate: string;
    status: AdsAutomationSmallCapReadinessSimulatorResponse['summary']['status'];
    budgetCandidates: AdsAutomationSmallCapBudgetCandidate[];
    readinessBlockers: string[];
    scaleMode: 'monitor_only' | 'pending_validation';
  }): string {
    return [
      '# Ads Automation Small-cap Readiness Simulator',
      `Report date: ${input.reportDate}`,
      `Status: ${input.status}`,
      `Scale-up execution mode: ${input.scaleMode}`,
      `Budget candidates: ${input.budgetCandidates.length}`,
      `Simulated capped increase VND: ${this.sum(input.budgetCandidates.map((candidate) => candidate.simulatedCappedIncreaseVnd))}`,
      `Approved increase VND: 0`,
      `Readiness blockers: ${this.joinOrNone(input.readinessBlockers)}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
      'Cashflow-first rule: unsafe or missing margin, contribution profit, cash conversion, stock, supplier, fulfillment, refund, freshness, or loss-limit evidence downgrades scale-up to monitor_only.',
    ].join('\n');
  }

  private assertPayload(
    input: AdsAutomationSmallCapReadinessSimulatorInput,
  ): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('small-cap readiness payload is required');
    }
    if (
      !input.foundationSnapshot
      || input.foundationSnapshot.schemaVersion
        !== 'ads_automation_decision_foundation_snapshot.v1'
    ) {
      throw new BadRequestException('foundationSnapshot must be ads_automation_decision_foundation_snapshot.v1');
    }
    if (
      !input.draftPreview
      || input.draftPreview.schemaVersion
        !== 'ads_automation_decision_draft_preview.v1'
    ) {
      throw new BadRequestException('draftPreview must be ads_automation_decision_draft_preview.v1');
    }
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }

  private nonNegativeNumber(value: unknown, field: string): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new BadRequestException(`${field} must be a non-negative number`);
    }
    return numberValue;
  }

  private numberOrNull(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private text(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((value) => String(value || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}
