import { Injectable } from '@nestjs/common';
import type {
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from './contracts/ads-automation-decision.contract';
import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './contracts/ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryEvidence,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceEvidence,
} from './contracts/ads-automation-decision-source-adapter.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from './source-sync/source-sync-result.types';

interface DraftPreviewOptions {
  source?: 'decision_snapshot' | 'mongo_read_model';
  query?: AdsAutomationDecisionReadModelQuery;
  sourceEvidence?: AdsAutomationDecisionSourceEvidence[];
  sourceSyncDecisionEvidence?: SourceSyncDecisionEvidence[];
  sourceSyncDecisionGates?: Partial<SourceSyncDecisionGates>;
  missingFieldEvidence?: AdsAutomationDecisionMissingFieldEvidence[];
  queryEvidence?: AdsAutomationDecisionReadModelQueryEvidence[];
}

interface DraftMapping {
  actionType: AdsAutomationDecisionDraftActionType;
  family: AdsAutomationDecisionDraftFamily;
  resourceType: AdsAutomationDecisionDraftPreview['resource_type'];
  provider: AdsAutomationDecisionDraftPreview['provider'];
}

const DISALLOWED_DRAFT_ACTIONS = [
  'delete_product',
  'provider_delete',
  'delete_campaign',
  'delete_ad_group',
  'auto_hide_product_globally',
  'auto_publish',
  'performance_max',
  'shopping',
  'display',
  'youtube',
];

const ADS_AUTOMATION_REQUIRED_SOURCE_KEYS = [
  'google_ads',
  'advertising_costs',
  'product_mapping',
  'inventory_profit',
  'supplier_safety',
] as const;

@Injectable()
export class AdsAutomationDecisionDraftPreviewService {
  build(
    snapshot: AdsAutomationDecisionSnapshot,
    options: DraftPreviewOptions = {},
  ): AdsAutomationDecisionDraftPreviewResponse {
    const sourceGateBlockers = this.sourceGateBlockers(options);
    const drafts = (snapshot.decisions || [])
      .map((decision) => this.toDraft(snapshot.snapshotDate, decision, sourceGateBlockers))
      .filter((draft): draft is AdsAutomationDecisionDraftPreview => Boolean(draft));

    return {
      schemaVersion: 'ads_automation_decision_draft_preview.v1',
      generatedAt: new Date().toISOString(),
      source: options.source || 'decision_snapshot',
      ...(options.query ? { query: options.query } : {}),
      safety: {
        read_only: true,
        dry_run: true,
        persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_drafts: true,
        execution_allowed_now: false,
        future_provider_validateOnly_required: true,
      },
      sourceEvidence: options.sourceEvidence || [],
      sourceSyncDecisionEvidence: options.sourceSyncDecisionEvidence || [],
      sourceSyncDecisionGates: options.sourceSyncDecisionGates || undefined,
      missingFieldEvidence: options.missingFieldEvidence || [],
      queryEvidence: options.queryEvidence || [],
      snapshot: {
        schemaVersion: snapshot.schemaVersion,
        generatedAt: snapshot.generatedAt,
        snapshotDate: snapshot.snapshotDate,
        summary: snapshot.summary,
      },
      summary: {
        decisions_scanned: snapshot.decisions?.length || 0,
        drafts_created: drafts.length,
        blocked_drafts: drafts.filter((draft) => draft.status === 'blocked_missing_data').length,
        provider_action_drafts: drafts.filter((draft) => draft.action_family === 'provider_google_ads').length,
        internal_task_drafts: drafts.filter((draft) => draft.action_family === 'internal_task').length,
        monitoring_drafts: drafts.filter((draft) => draft.action_family === 'monitoring').length,
      },
      drafts,
    };
  }

  private toDraft(
    snapshotDate: string,
    decision: AdsAutomationDecisionItem,
    sourceGateBlockers: string[],
  ): AdsAutomationDecisionDraftPreview | null {
    const mapping = this.mappingFor(decision);
    if (!mapping) return null;

    const requiredMissing = this.requiredMissing(mapping.actionType, decision);
    const missing = this.unique([
      ...decision.missing_fields,
      ...requiredMissing,
      ...sourceGateBlockers,
    ]);
    const blockers = this.unique(decision.blockers);
    const actionType = mapping.actionType;
    const providerAction = mapping.family === 'provider_google_ads';

    return {
      draft_id: this.draftId(snapshotDate, actionType, decision.entity_id),
      source_decision_id: decision.decision_id,
      source_decision_type: decision.decision_type,
      action_type: actionType,
      action_family: mapping.family,
      provider: mapping.provider,
      resource_type: mapping.resourceType,
      entity_type: decision.entity_type,
      entity_id: decision.entity_id,
      platform: decision.platform,
      accountId: decision.accountId,
      productId: decision.productId,
      supplierId: decision.supplierId,
      status: missing.length ? 'blocked_missing_data' : 'pending_approval_preview',
      approval_required: true,
      execution_allowed_now: false,
      validate_only_required: providerAction,
      future_provider_validateOnly_required: providerAction,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      persistence_used: false,
      typedPayload: this.typedPayload(actionType, decision),
      source_evidence_references: [{
        decision_id: decision.decision_id,
        decision_type: decision.decision_type,
        evidence_window: decision.evidence_window,
        evidence_metrics: decision.evidence_metrics || {},
        rationale: decision.rationale,
        idempotency_key: decision.idempotency_key,
        rollback_plan: decision.rollback_plan,
      }],
      blockers,
      missing_data_blockers: missing,
      disallowed_actions: DISALLOWED_DRAFT_ACTIONS,
      idempotency_key: decision.idempotency_key || `ads-draft:${snapshotDate}:${actionType}:${this.safeKey(decision.entity_id)}`,
      rationale: this.rationale(actionType, decision),
    };
  }

  private sourceGateBlockers(options: DraftPreviewOptions): string[] {
    const blockers = new Set<string>();
    if (options.sourceSyncDecisionGates?.canGenerateActionDraft === false) {
      blockers.add('source_sync_gate_blocked_action_draft');
    }
    for (const evidence of options.sourceSyncDecisionEvidence || []) {
      if (!ADS_AUTOMATION_REQUIRED_SOURCE_KEYS.includes(evidence.sourceKey as any)) {
        continue;
      }
      if (evidence.canUseForAdsAutomationDecision === true) continue;
      blockers.add(`${evidence.sourceKey}_not_ready_for_ads_automation_decision`);
      for (const reason of evidence.blockingReasons || []) {
        blockers.add(reason);
      }
    }
    return [...blockers].sort();
  }

  private mappingFor(decision: AdsAutomationDecisionItem): DraftMapping | null {
    const proposedAction = this.text(decision.proposedValue?.action);
    if (decision.decision_type === 'scale_amount' && proposedAction === 'update_campaign_budget_draft') {
      return {
        actionType: 'update_campaign_budget',
        family: 'provider_google_ads',
        resourceType: 'campaign_budget',
        provider: 'google',
      };
    }
    if (decision.decision_type === 'campaign_or_ad_group_pause' && proposedAction === 'pause_ad_group_draft') {
      return {
        actionType: 'pause_ad_group',
        family: 'provider_google_ads',
        resourceType: 'ad_group',
        provider: 'google',
      };
    }
    if (decision.decision_type === 'campaign_or_ad_group_pause' && proposedAction === 'pause_campaign_draft') {
      return {
        actionType: 'pause_campaign',
        family: 'provider_google_ads',
        resourceType: 'campaign',
        provider: 'google',
      };
    }
    if (proposedAction === 'monitor_only') {
      return {
        actionType: 'monitor_only',
        family: 'monitoring',
        resourceType: 'monitoring',
        provider: 'none',
      };
    }
    if (proposedAction === 'supplier_sourcing') {
      return {
        actionType: 'supplier_sourcing',
        family: 'internal_task',
        resourceType: decision.entity_type === 'supplier' ? 'supplier' : 'product',
        provider: 'erp_internal',
      };
    }
    if (proposedAction === 'product_offer_fix' || proposedAction === 'offer_fix') {
      return {
        actionType: 'product_offer_fix',
        family: 'internal_task',
        resourceType: 'product',
        provider: 'erp_internal',
      };
    }
    if (
      decision.decision_type === 'product_budget_allocation'
      && decision.blockers.some((blocker) => ['offer_not_ready', 'landing_not_ready', 'media_not_ready'].includes(blocker))
    ) {
      return {
        actionType: 'product_offer_fix',
        family: 'internal_task',
        resourceType: 'product',
        provider: 'erp_internal',
      };
    }
    if (
      decision.decision_type === 'product_kill_or_stop_review'
      && ['stop_import_review', 'stop_ads_review'].includes(proposedAction)
    ) {
      return {
        actionType: 'stop_import_review',
        family: 'internal_task',
        resourceType: 'product',
        provider: 'erp_internal',
      };
    }
    return null;
  }

  private typedPayload(actionType: AdsAutomationDecisionDraftActionType, decision: AdsAutomationDecisionItem): Record<string, unknown> {
    const proposed = decision.proposedValue || {};
    const current = decision.currentValue || {};
    switch (actionType) {
      case 'update_campaign_budget':
        return {
          customerId: decision.accountId,
          campaignBudgetId: this.text(proposed.campaignBudgetId) || this.text(current.campaignBudgetId) || null,
          campaignBudgetResourceName: this.text(proposed.campaignBudgetResourceName) || this.text(current.campaignBudgetResourceName) || null,
          dailyBudget: this.numberOrNull(proposed.proposedBudgetVnd),
          currentBudgetVnd: this.numberOrNull(proposed.currentBudgetVnd) ?? this.numberOrNull(current.currentBudgetVnd),
          increaseVnd: this.numberOrNull(proposed.increaseVnd),
          increasePercent: this.numberOrNull(proposed.increasePercent),
          maxIncreasePercent: this.numberOrNull(proposed.maxIncreasePercent),
        };
      case 'pause_ad_group':
        return {
          customerId: decision.accountId,
          campaignId: this.text(proposed.campaignId) || this.text(current.campaignId) || null,
          adGroupId: this.text(proposed.adGroupId) || this.text(current.adGroupId) || this.entityIdFor(decision, 'ad_group'),
          targetStatus: 'PAUSED',
        };
      case 'pause_campaign':
        return {
          customerId: decision.accountId,
          campaignId: this.text(proposed.campaignId) || this.text(current.campaignId) || this.entityIdFor(decision, 'campaign'),
          targetStatus: 'PAUSED',
        };
      case 'monitor_only':
        return {
          decisionType: decision.decision_type,
          entityType: decision.entity_type,
          entityId: decision.entity_id,
          reviewAfterDays: 3,
        };
      case 'supplier_sourcing':
        return {
          productId: decision.productId || this.text(proposed.productId) || null,
          supplierId: decision.supplierId || this.text(proposed.supplierId) || this.entityIdFor(decision, 'supplier'),
          supplierFitScore: this.numberOrNull(proposed.supplierFitScore),
        };
      case 'product_offer_fix':
        return {
          productId: decision.productId || this.entityIdFor(decision, 'product'),
          fixAreas: this.offerFixAreas(decision),
        };
      case 'stop_import_review':
        return {
          productId: decision.productId || this.entityIdFor(decision, 'product'),
          reviewScope: this.text(proposed.action) === 'stop_ads_review' ? 'ads_or_import_stop_review' : 'import_stop_review',
          deleteProduct: false,
          providerDelete: false,
        };
      default:
        return {};
    }
  }

  private requiredMissing(actionType: AdsAutomationDecisionDraftActionType, decision: AdsAutomationDecisionItem): string[] {
    const proposed = decision.proposedValue || {};
    const current = decision.currentValue || {};
    switch (actionType) {
      case 'update_campaign_budget':
        return this.text(proposed.campaignBudgetId) || this.text(current.campaignBudgetId)
          ? []
          : ['campaignBudgetId'];
      case 'pause_ad_group':
        return this.text(proposed.adGroupId) || this.text(current.adGroupId) || this.entityIdFor(decision, 'ad_group')
          ? []
          : ['adGroupId'];
      case 'pause_campaign':
        return this.text(proposed.campaignId) || this.text(current.campaignId) || this.entityIdFor(decision, 'campaign')
          ? []
          : ['campaignId'];
      default:
        return [];
    }
  }

  private rationale(actionType: AdsAutomationDecisionDraftActionType, decision: AdsAutomationDecisionItem): string {
    if (actionType === 'stop_import_review') {
      return `${decision.rationale} Product stop remains an internal review/import-stop candidate only; product delete is disallowed.`;
    }
    if (actionType === 'update_campaign_budget') {
      return `${decision.rationale} This preview does not call Google Ads and requires explicit ERP approval plus future provider validateOnly.`;
    }
    if (actionType === 'pause_ad_group' || actionType === 'pause_campaign') {
      return `${decision.rationale} Pause remains approval-required, execution-disabled, and validate-only-gated.`;
    }
    return decision.rationale;
  }

  private offerFixAreas(decision: AdsAutomationDecisionItem): string[] {
    const areas: string[] = [];
    if (decision.blockers.includes('offer_not_ready')) areas.push('offer');
    if (decision.blockers.includes('landing_not_ready')) areas.push('landing');
    if (decision.blockers.includes('media_not_ready')) areas.push('media');
    return areas.length ? areas : ['offer'];
  }

  private entityIdFor(decision: AdsAutomationDecisionItem, entityType: AdsAutomationDecisionItem['entity_type']): string | null {
    return decision.entity_type === entityType && decision.entity_id !== 'unknown' ? decision.entity_id : null;
  }

  private draftId(snapshotDate: string, actionType: AdsAutomationDecisionDraftActionType, entityId: string): string {
    return `ADSDRAFT-${snapshotDate.replace(/-/g, '')}-${actionType}-${this.safeKey(entityId)}`;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private numberOrNull(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private safeKey(value: string): string {
    return String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
  }
}
