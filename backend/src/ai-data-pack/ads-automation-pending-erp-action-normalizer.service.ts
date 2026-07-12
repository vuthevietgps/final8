import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './contracts/ads-automation-decision-draft-preview.contract';
import {
  ADS_AUTOMATION_PENDING_ERP_ACTION_ALLOWLIST,
  AdsAutomationPendingErpActionDecisionAnswer,
  AdsAutomationPendingErpActionSourceGate,
  AdsAutomationPendingErpActionSourceReadiness,
  AdsAutomationPendingErpDecisionAnswers,
  AdsAutomationPendingErpActionIdentifiers,
  AdsAutomationPendingErpActionNormalizationOptions,
  AdsAutomationPendingErpActionNormalizationResponse,
  AdsAutomationPendingErpActionRecord,
  AdsAutomationPendingErpActionType,
  AdsAutomationPlatformEntityCoverageActionBlocker,
} from './contracts/ads-automation-pending-erp-action.contract';

const PROVIDER_ACTION_TYPES: AdsAutomationPendingErpActionType[] = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
];

const ADS_AUTOMATION_REQUIRED_SOURCE_KEYS = [
  'google_ads',
  'advertising_costs',
  'product_mapping',
  'inventory_profit',
  'supplier_safety',
] as const;

@Injectable()
export class AdsAutomationPendingErpActionNormalizerService {
  normalizePreview(
    preview: AdsAutomationDecisionDraftPreviewResponse,
    options: AdsAutomationPendingErpActionNormalizationOptions = {},
  ): AdsAutomationPendingErpActionNormalizationResponse {
    this.assertPreviewEnvelope(preview);
    this.assertSourceReadiness(preview);

    const seenKeys = new Set<string>();
    const generatedAt = new Date().toISOString();
    const sourceReadiness = this.sourceReadiness(preview);
    const sourceGate = this.sourceGate(preview);
    const platformEntityCoverageBlockers = this.unique(
      this.arrayText(options.platformEntityCoverageBlockers),
    );
    const platformEntityCoverageActionBlockers =
      this.platformEntityCoverageActionBlockers(options.platformEntityCoverageActionBlockers);
    const pendingActions = preview.drafts.map((draft) => {
      this.assertDraftCandidate(draft, seenKeys);
      return this.toPendingAction(
        preview,
        draft,
        generatedAt,
        sourceReadiness,
        sourceGate,
        platformEntityCoverageBlockers,
        platformEntityCoverageActionBlockers,
      );
    });
    const appliedPlatformEntityCoverageBlockers = this.unique(
      pendingActions.flatMap((record) => record.platform_entity_coverage_blockers),
    );

    return {
      schemaVersion: 'ads_automation_pending_erp_action_normalization.v1',
      generatedAt,
      sourcePreviewSchemaVersion: preview.schemaVersion,
      sourceSyncDecisionEvidence: this.cloneJson(preview.sourceSyncDecisionEvidence || []),
      sourceSyncDecisionGates: preview.sourceSyncDecisionGates
        ? this.cloneJson(preview.sourceSyncDecisionGates)
        : null,
      safety: {
        read_only: true,
        dry_run: true,
        in_memory_only: true,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_actions: true,
        execution_allowed_now: false,
      },
      summary: {
        drafts_received: preview.drafts.length,
        pending_actions_created: pendingActions.length,
        provider_action_records: pendingActions.filter((record) => record.action_family === 'provider_google_ads').length,
        internal_task_records: pendingActions.filter((record) => record.action_family === 'internal_task').length,
        monitoring_records: pendingActions.filter((record) => record.action_family === 'monitoring').length,
        platform_entity_blocker_count: appliedPlatformEntityCoverageBlockers.length,
        scale_candidates_blocked_by_platform_entity_coverage: pendingActions.filter((record) =>
          record.review_disposition === 'blocked_by_platform_entity_coverage',
        ).length,
      },
      decisionAnswers: this.decisionAnswers(pendingActions),
      pendingActions,
    };
  }

  private assertPreviewEnvelope(preview: AdsAutomationDecisionDraftPreviewResponse): void {
    if (!preview || typeof preview !== 'object') {
      throw new BadRequestException('draft preview payload is required');
    }
    if (preview.schemaVersion !== 'ads_automation_decision_draft_preview.v1') {
      throw new BadRequestException('payload must use ads_automation_decision_draft_preview.v1');
    }
    if (!Array.isArray(preview.drafts)) {
      throw new BadRequestException('drafts must be an array');
    }
    if (!preview.safety || typeof preview.safety !== 'object') {
      throw new BadRequestException('draft preview safety flags are required');
    }
    if (preview.safety.approval_required_for_all_drafts !== true) {
      throw new BadRequestException('approval_required_for_all_drafts must be true');
    }
    if (preview.safety.execution_allowed_now !== false) {
      throw new BadRequestException('execution_allowed_now must be false');
    }
    if (preview.safety.provider_api_called !== false || preview.safety.google_ads_api_called !== false) {
      throw new BadRequestException('draft preview must not report provider API calls');
    }
    if (preview.safety.live_ads_execution_used !== false) {
      throw new BadRequestException('draft preview must not report live ads execution');
    }
    if (preview.safety.persistence_used !== false) {
      throw new BadRequestException('pending action normalization is in-memory only');
    }
  }

  private assertSourceReadiness(preview: AdsAutomationDecisionDraftPreviewResponse): void {
    if (preview.sourceSyncDecisionGates?.canGenerateActionDraft === false) {
      throw new BadRequestException('source-sync gate does not allow pending action generation');
    }
    if (preview.sourceSyncDecisionGates?.canImportActionFile !== undefined && preview.sourceSyncDecisionGates.canImportActionFile !== false) {
      throw new BadRequestException('source-sync canImportActionFile must be false for pending action normalization');
    }
    if (preview.sourceSyncDecisionGates?.canDryRun !== undefined && preview.sourceSyncDecisionGates.canDryRun !== false) {
      throw new BadRequestException('source-sync canDryRun must be false for pending action normalization');
    }
    if (preview.sourceSyncDecisionGates?.canExecuteLive !== undefined && preview.sourceSyncDecisionGates.canExecuteLive !== false) {
      throw new BadRequestException('source-sync canExecuteLive must be false for pending action normalization');
    }

    for (const evidence of preview.sourceSyncDecisionEvidence || []) {
      if (!ADS_AUTOMATION_REQUIRED_SOURCE_KEYS.includes(evidence.sourceKey as any)) {
        continue;
      }
      if (evidence.canUseForAdsAutomationDecision === true) continue;
      throw new BadRequestException(`source ${evidence.sourceKey} is not ready for pending action generation`);
    }
  }

  private assertDraftCandidate(draft: AdsAutomationDecisionDraftPreview, seenKeys: Set<string>): void {
    if (!draft || typeof draft !== 'object') {
      throw new BadRequestException('draft entries must be objects');
    }

    const actionType = this.text(draft.action_type);
    if (!ADS_AUTOMATION_PENDING_ERP_ACTION_ALLOWLIST.includes(actionType as AdsAutomationPendingErpActionType)) {
      throw new BadRequestException(`unsupported pending action_type: ${String((draft as any).action_type || '')}`);
    }
    if (draft.status !== 'pending_approval_preview') {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} is not pending approval preview`);
    }
    if (draft.approval_required !== true) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must require approval`);
    }
    if (draft.execution_allowed_now !== false) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must have execution_allowed_now=false`);
    }
    if (draft.provider_api_called !== false || draft.google_ads_api_called !== false) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must not call provider APIs`);
    }
    if (draft.live_ads_execution_used !== false || draft.persistence_used !== false) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must not execute live ads or persist`);
    }
    if (
      PROVIDER_ACTION_TYPES.includes(actionType as AdsAutomationPendingErpActionType)
      && (draft.validate_only_required !== true || draft.future_provider_validateOnly_required !== true)
    ) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must require future provider validateOnly`);
    }

    const idempotencyKey = this.text(draft.idempotency_key);
    if (!idempotencyKey) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must include idempotency_key`);
    }
    if (seenKeys.has(idempotencyKey)) {
      throw new BadRequestException(`duplicate idempotency_key rejected: ${idempotencyKey}`);
    }
    seenKeys.add(idempotencyKey);

    if (actionType === 'update_campaign_budget') {
      const campaignBudgetId = this.text(draft.typedPayload?.campaignBudgetId);
      if (!campaignBudgetId) {
        throw new BadRequestException('update_campaign_budget requires typedPayload.campaignBudgetId');
      }
    }
    if (
      actionType === 'stop_import_review'
      && (draft.typedPayload?.deleteProduct === true || draft.typedPayload?.providerDelete === true)
    ) {
      throw new BadRequestException('stop_import_review must not delete products or provider resources');
    }
  }

  private toPendingAction(
    preview: AdsAutomationDecisionDraftPreviewResponse,
    draft: AdsAutomationDecisionDraftPreview,
    generatedAt: string,
    sourceReadiness: AdsAutomationPendingErpActionSourceReadiness[],
    sourceGate: AdsAutomationPendingErpActionSourceGate,
    platformEntityCoverageBlockers: string[],
    platformEntityCoverageActionBlockers: AdsAutomationPlatformEntityCoverageActionBlocker[],
  ): AdsAutomationPendingErpActionRecord {
    const actionType = draft.action_type as AdsAutomationPendingErpActionType;
    const identifiers = this.identifiers(draft);
    const matchedActionPlatformEntityBlockers =
      this.matchingPlatformEntityCoverageActionBlockers(
        identifiers,
        platformEntityCoverageActionBlockers,
      );
    const actionPlatformEntityBlockers = actionType === 'update_campaign_budget'
      ? matchedActionPlatformEntityBlockers.length || platformEntityCoverageActionBlockers.length
        ? this.unique(matchedActionPlatformEntityBlockers.map((blocker) => blocker.blocker))
        : platformEntityCoverageBlockers
      : [];
    const riskBlockers = this.unique([
      ...(draft.blockers || []),
      ...(draft.missing_data_blockers || []),
      ...sourceReadiness.flatMap((record) => record.blockingReasons),
      ...actionPlatformEntityBlockers,
    ]);
    const evidenceBlockers = this.unique([
      ...(draft.blockers || []),
      ...actionPlatformEntityBlockers,
    ]);

    return {
      pending_action_id: `ADSPENDINGACTION-${this.safeKey(draft.idempotency_key)}`,
      status: 'pending_validation',
      action_type: actionType,
      approval_id: `ADSAPPROVAL-${this.safeKey(draft.idempotency_key)}`,
      source_schema_version: preview.schemaVersion,
      source_preview_generatedAt: preview.generatedAt,
      source_draft_id: draft.draft_id,
      source_decision_id: draft.source_decision_id,
      source_decision_type: draft.source_decision_type,
      action_family: draft.action_family,
      provider: draft.provider,
      resource_type: draft.resource_type,
      entity_type: draft.entity_type,
      entity_id: draft.entity_id,
      accountId: draft.accountId,
      platform: draft.platform,
      productId: identifiers.productId,
      supplierId: identifiers.supplierId,
      customerId: identifiers.customerId,
      campaignId: identifiers.campaignId,
      adGroupId: identifiers.adGroupId,
      campaignBudgetId: identifiers.campaignBudgetId,
      campaignBudgetResourceName: identifiers.campaignBudgetResourceName,
      identifiers,
      requested_change: {
        action_type: actionType,
        ...this.cloneJson(draft.typedPayload || {}),
      },
      reason: draft.rationale,
      evidence: {
        rationale: draft.rationale,
        source_evidence_references: this.cloneJson(draft.source_evidence_references || []),
        blockers: evidenceBlockers,
        missing_data_blockers: [...(draft.missing_data_blockers || [])],
      },
      source_readiness: this.cloneJson(sourceReadiness),
      source_gate: this.cloneJson(sourceGate),
      platform_entity_coverage_blockers: [...actionPlatformEntityBlockers],
      platform_entity_coverage_action_blockers: this.cloneJson(matchedActionPlatformEntityBlockers),
      risk_blockers: riskBlockers,
      decision_answer: this.decisionAnswer(actionType, identifiers, draft, actionPlatformEntityBlockers),
      review_disposition: this.reviewDisposition(actionType, draft, actionPlatformEntityBlockers),
      safety_flags: {
        approval_required: true,
        execution_allowed_now: false,
        validate_only_required: draft.validate_only_required,
        future_provider_validateOnly_required: draft.future_provider_validateOnly_required,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
        production_ready: false,
      },
      idempotency_key: draft.idempotency_key,
      createdAt: generatedAt,
    };
  }

  private sourceReadiness(
    preview: AdsAutomationDecisionDraftPreviewResponse,
  ): AdsAutomationPendingErpActionSourceReadiness[] {
    return (preview.sourceSyncDecisionEvidence || [])
      .filter((evidence) => ADS_AUTOMATION_REQUIRED_SOURCE_KEYS.includes(evidence.sourceKey as any))
      .map((evidence) => ({
        sourceKey: evidence.sourceKey,
        reportDate: this.text(evidence.reportDate),
        freshnessStatus: this.text(evidence.freshnessStatus),
        coverageStatus: this.text(evidence.coverageStatus),
        lastSuccessfulSyncAt: this.text(evidence.lastSuccessfulSyncAt),
        latestRecordDate: this.text(evidence.latestRecordDate),
        canUseForAdsAutomationDecision: evidence.canUseForAdsAutomationDecision === true,
        blockingReason: this.text(evidence.blockingReason),
        blockingReasons: this.arrayText(evidence.blockingReasons),
      }));
  }

  private sourceGate(preview: AdsAutomationDecisionDraftPreviewResponse): AdsAutomationPendingErpActionSourceGate {
    return {
      canRecommendAdsScale: this.booleanOrNull(preview.sourceSyncDecisionGates?.canRecommendAdsScale),
      canGenerateActionDraft: this.booleanOrNull(preview.sourceSyncDecisionGates?.canGenerateActionDraft),
      canUseGoogleAdsDataClaim: this.booleanOrNull(preview.sourceSyncDecisionGates?.canUseGoogleAdsDataClaim),
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private decisionAnswer(
    actionType: AdsAutomationPendingErpActionType,
    identifiers: AdsAutomationPendingErpActionIdentifiers,
    draft: AdsAutomationDecisionDraftPreview,
    platformEntityCoverageBlockers: string[] = [],
  ): AdsAutomationPendingErpActionDecisionAnswer {
    const increaseAmount = this.numberOrNull(draft.typedPayload?.increaseVnd)
      ?? this.budgetDelta(draft.typedPayload);
    const productIds = identifiers.productId ? [identifiers.productId] : [];
    const adGroupIds = identifiers.adGroupId ? [identifiers.adGroupId] : [];

    if (actionType === 'update_campaign_budget') {
      if (platformEntityCoverageBlockers.length) {
        return {
          decision_type: draft.source_decision_type,
          increase_ads: 'no',
          increase_amount_vnd: null,
          target_ad_group_ids: adGroupIds,
          products_to_receive_budget: [],
          supplier_choice_safety: 'not_applicable',
          product_kill_or_stop_import_review: 'not_applicable',
          campaign_or_ad_group_pause: 'monitor_only',
          summary: 'Scale-up is downgraded to monitor-only until platform entity coverage blockers are resolved.',
        };
      }

      return {
        decision_type: draft.source_decision_type,
        increase_ads: 'yes',
        increase_amount_vnd: increaseAmount,
        target_ad_group_ids: adGroupIds,
        products_to_receive_budget: productIds,
        supplier_choice_safety: 'not_applicable',
        product_kill_or_stop_import_review: 'not_applicable',
        campaign_or_ad_group_pause: 'not_applicable',
        summary: 'Increase ads budget for the listed ad group/product after ERP validation and approval.',
      };
    }

    if (actionType === 'pause_campaign' || actionType === 'pause_ad_group') {
      return {
        decision_type: draft.source_decision_type,
        increase_ads: 'no',
        increase_amount_vnd: null,
        target_ad_group_ids: adGroupIds,
        products_to_receive_budget: [],
        supplier_choice_safety: 'not_applicable',
        product_kill_or_stop_import_review: 'not_applicable',
        campaign_or_ad_group_pause: actionType,
        summary: 'Do not increase budget; pause is pending validation, approval, and future validateOnly.',
      };
    }

    if (actionType === 'supplier_sourcing') {
      return {
        decision_type: draft.source_decision_type,
        increase_ads: 'no',
        increase_amount_vnd: null,
        target_ad_group_ids: [],
        products_to_receive_budget: [],
        supplier_choice_safety: 'needs_sourcing',
        product_kill_or_stop_import_review: 'not_applicable',
        campaign_or_ad_group_pause: 'not_applicable',
        summary: 'Supplier choice is not safe enough for added ads budget; source or review suppliers first.',
      };
    }

    if (actionType === 'product_offer_fix') {
      return {
        decision_type: draft.source_decision_type,
        increase_ads: 'no',
        increase_amount_vnd: null,
        target_ad_group_ids: [],
        products_to_receive_budget: [],
        supplier_choice_safety: 'not_applicable',
        product_kill_or_stop_import_review: 'offer_fix_required',
        campaign_or_ad_group_pause: 'not_applicable',
        summary: 'Product should not receive budget until the offer, landing, or media blocker is fixed.',
      };
    }

    if (actionType === 'stop_import_review') {
      return {
        decision_type: draft.source_decision_type,
        increase_ads: 'no',
        increase_amount_vnd: null,
        target_ad_group_ids: [],
        products_to_receive_budget: [],
        supplier_choice_safety: 'not_applicable',
        product_kill_or_stop_import_review: 'stop_import_review_required',
        campaign_or_ad_group_pause: 'not_applicable',
        summary: 'Product needs internal stop-import or stop-ads review; product/provider removal remains disallowed.',
      };
    }

    return {
      decision_type: draft.source_decision_type,
      increase_ads: 'no',
      increase_amount_vnd: null,
      target_ad_group_ids: adGroupIds,
      products_to_receive_budget: [],
      supplier_choice_safety: 'not_applicable',
      product_kill_or_stop_import_review: 'not_applicable',
      campaign_or_ad_group_pause: 'monitor_only',
      summary: 'Monitor only; no budget increase, pause, product kill, supplier choice, or provider action is pending.',
    };
  }

  private decisionAnswers(
    pendingActions: AdsAutomationPendingErpActionRecord[],
  ): AdsAutomationPendingErpDecisionAnswers {
    const budgetActions = pendingActions.filter((action) =>
      action.action_type === 'update_campaign_budget'
      && action.decision_answer.increase_ads === 'yes',
    );
    const supplierActions = pendingActions.filter((action) => action.action_type === 'supplier_sourcing');
    const productReviewActions = pendingActions.filter((action) => (
      action.action_type === 'product_offer_fix' || action.action_type === 'stop_import_review'
    ));
    const pauseActions = pendingActions.filter((action) => (
      action.action_type === 'pause_campaign' || action.action_type === 'pause_ad_group'
    ));

    return {
      increase_ads: budgetActions.length ? 'yes_pending_validation' : 'no_budget_increase_pending',
      increase_amount_vnd: budgetActions.reduce(
        (sum, action) => sum + Number(action.decision_answer.increase_amount_vnd || 0),
        0,
      ),
      target_ad_group_ids: this.unique(pendingActions.flatMap((action) => action.decision_answer.target_ad_group_ids)),
      products_to_receive_budget: this.unique(pendingActions.flatMap((action) => action.decision_answer.products_to_receive_budget)),
      supplier_choice_safety: supplierActions.map((action) => ({
        productId: action.productId,
        supplierId: action.supplierId,
        status: action.decision_answer.supplier_choice_safety,
        pending_action_id: action.pending_action_id,
        blockers: [...action.risk_blockers],
      })),
      product_kill_or_stop_import_review: productReviewActions.map((action) => ({
        productId: action.productId,
        status: action.decision_answer.product_kill_or_stop_import_review,
        pending_action_id: action.pending_action_id,
        blockers: [...action.risk_blockers],
      })),
      campaign_or_ad_group_pause: pauseActions.map((action) => ({
        campaignId: action.campaignId,
        adGroupId: action.adGroupId,
        status: action.decision_answer.campaign_or_ad_group_pause,
        pending_action_id: action.pending_action_id,
        blockers: [...action.risk_blockers],
      })),
    };
  }

  private reviewDisposition(
    actionType: AdsAutomationPendingErpActionType,
    draft: AdsAutomationDecisionDraftPreview,
    platformEntityCoverageBlockers: string[],
  ): AdsAutomationPendingErpActionRecord['review_disposition'] {
    if (actionType === 'monitor_only') return 'monitor_only_visible';
    if (actionType === 'update_campaign_budget' && platformEntityCoverageBlockers.length) {
      return 'blocked_by_platform_entity_coverage';
    }
    return draft.action_family === 'provider_google_ads'
      ? 'pending_provider_validation'
      : 'pending_internal_review';
  }

  private identifiers(draft: AdsAutomationDecisionDraftPreview): AdsAutomationPendingErpActionIdentifiers {
    const payload = draft.typedPayload || {};
    return {
      customerId: this.text(payload.customerId) || this.text(draft.accountId),
      campaignId: this.text(payload.campaignId)
        || (draft.entity_type === 'campaign' ? this.text(draft.entity_id) : null),
      adGroupId: this.text(payload.adGroupId)
        || (draft.entity_type === 'ad_group' ? this.text(draft.entity_id) : null),
      campaignBudgetId: this.text(payload.campaignBudgetId),
      campaignBudgetResourceName: this.text(payload.campaignBudgetResourceName),
      productId: this.text(draft.productId) || this.text(payload.productId),
      supplierId: this.text(draft.supplierId) || this.text(payload.supplierId),
    };
  }

  private platformEntityCoverageActionBlockers(
    values: unknown,
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.platformEntityCoverageActionBlocker(value))
      .filter((value): value is AdsAutomationPlatformEntityCoverageActionBlocker =>
        Boolean(value));
  }

  private platformEntityCoverageActionBlocker(
    value: unknown,
  ): AdsAutomationPlatformEntityCoverageActionBlocker | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Partial<AdsAutomationPlatformEntityCoverageActionBlocker>;
    const blocker = this.text(record.blocker);
    const family = this.text(record.family);
    const scope = this.text(record.scope);
    if (!blocker || !family || !scope) return null;
    return {
      blocker,
      family: family as AdsAutomationPlatformEntityCoverageActionBlocker['family'],
      scope: scope as AdsAutomationPlatformEntityCoverageActionBlocker['scope'],
      campaignId: this.text(record.campaignId),
      adGroupId: this.text(record.adGroupId),
      campaignBudgetId: this.text(record.campaignBudgetId),
      productId: this.text(record.productId),
      supplierId: this.text(record.supplierId),
    };
  }

  private matchingPlatformEntityCoverageActionBlockers(
    identifiers: AdsAutomationPendingErpActionIdentifiers,
    blockers: AdsAutomationPlatformEntityCoverageActionBlocker[],
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    return blockers.filter((blocker) =>
      this.platformEntityCoverageActionBlockerMatches(identifiers, blocker));
  }

  private platformEntityCoverageActionBlockerMatches(
    identifiers: AdsAutomationPendingErpActionIdentifiers,
    blocker: AdsAutomationPlatformEntityCoverageActionBlocker,
  ): boolean {
    const keys: Array<
      'campaignId' | 'adGroupId' | 'campaignBudgetId' | 'productId' | 'supplierId'
    > = [
      'campaignId',
      'adGroupId',
      'campaignBudgetId',
      'productId',
      'supplierId',
    ];
    const scopedKeys = keys.filter((key) => blocker[key]);
    if (!scopedKeys.length) return blocker.scope === 'freshness';
    return scopedKeys.every((key) => blocker[key] === identifiers[key]);
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private booleanOrNull(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private numberOrNull(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private budgetDelta(payload: Record<string, unknown> | undefined): number | null {
    const dailyBudget = this.numberOrNull(payload?.dailyBudget);
    const currentBudget = this.numberOrNull(payload?.currentBudgetVnd);
    if (dailyBudget === null || currentBudget === null) return null;
    return dailyBudget - currentBudget;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private safeKey(value: string): string {
    return String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 96);
  }
}
