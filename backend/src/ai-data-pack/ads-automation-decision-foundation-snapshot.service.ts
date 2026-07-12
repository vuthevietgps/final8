import { Injectable } from '@nestjs/common';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import type {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
  AdsAutomationDecisionStatus,
} from './contracts/ads-automation-decision.contract';
import type {
  AdsAutomationDecisionFoundationBlockers,
  AdsAutomationDecisionFoundationCategorySummary,
  AdsAutomationDecisionFoundationEvidenceLink,
  AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  AdsAutomationDecisionFoundationSnapshotInput,
  AdsAutomationDecisionFoundationSnapshotItem,
  AdsAutomationDecisionFoundationSnapshotResponse,
  AdsAutomationScaleAdsDecision,
} from './contracts/ads-automation-decision-foundation-snapshot.contract';
import type {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryResult,
} from './contracts/ads-automation-decision-read-model-query.contract';

const FOUNDATION_CATEGORIES: AdsAutomationCategoryKey[] = [
  'scale_ads',
  'scale_amount',
  'target_ad_groups',
  'product_budget_allocation',
  'supplier_gate',
  'product_kill_or_stop_review',
  'campaign_or_ad_group_pause',
];

@Injectable()
export class AdsAutomationDecisionFoundationSnapshotService {
  constructor(private readonly decisions: AdsAutomationDecisionService) {}

  build(
    input: AdsAutomationDecisionFoundationSnapshotInput = {},
  ): AdsAutomationDecisionFoundationSnapshotResponse {
    return this.fromDecisionSnapshot(this.decisions.build(input || {}));
  }

  fromDecisionSnapshot(snapshot: AdsAutomationDecisionSnapshot): AdsAutomationDecisionFoundationSnapshotResponse {
    const scaleCandidates = this.rank(
      this.items(snapshot, 'scale_ads').filter((item) => item.status === 'scale_ready'),
      'netProfitAfterAdsVnd',
    );
    const scaleAmountItems = this.rank(this.items(snapshot, 'scale_amount'), 'increaseVnd');
    const targetAdGroups = this.rank(this.items(snapshot, 'target_ad_groups'), 'netProfitAfterAdsVnd');
    const productBudgetItems = this.rank(this.items(snapshot, 'product_budget_allocation'), 'netProfitVnd');
    const supplierGateItems = this.rank(this.items(snapshot, 'supplier_gate'), 'supplierFitScore');
    const productKillItems = this.rank(this.items(snapshot, 'product_kill_or_stop_review'), 'returnCancelRefundRatePercent');
    const pauseCandidates = this.rank(
      this.items(snapshot, 'campaign_or_ad_group_pause').filter((item) => item.status === 'needs_review'),
      'spendVnd',
    );
    const evidenceLinks = snapshot.decisions.map((item) => this.evidenceLink(item));
    const blockers = this.blockers(snapshot);

    return {
      schemaVersion: 'ads_automation_decision_foundation_snapshot.v1',
      generatedAt: snapshot.generatedAt,
      snapshotDate: snapshot.snapshotDate,
      source_snapshot_schema_version: snapshot.schemaVersion,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        production_ready: false,
        approval_required_for_future_actions: true,
        execution_allowed_now: false,
        future_provider_validateOnly_required_before_execution: true,
      },
      summary: {
        ...snapshot.summary,
        evidence_links: evidenceLinks.length,
        explicit_ba_fields_present: true,
      },
      scale_ads_decision: {
        ...this.category(snapshot, 'scale_ads'),
        decision: this.scaleDecision(snapshot.categories.scale_ads.status, scaleCandidates.length),
        candidates: scaleCandidates,
      },
      scale_amount: {
        ...this.category(snapshot, 'scale_amount'),
        total_increase_vnd: scaleAmountItems
          .filter((item) => item.status === 'scale_ready')
          .reduce((total, item) => total + this.number(item.proposedValue?.increaseVnd), 0),
        items: scaleAmountItems,
      },
      target_ad_groups: {
        ...this.category(snapshot, 'target_ad_groups'),
        items: targetAdGroups,
      },
      product_budget_allocation: {
        ...this.category(snapshot, 'product_budget_allocation'),
        items: productBudgetItems,
      },
      supplier_gate: {
        ...this.category(snapshot, 'supplier_gate'),
        safe_suppliers: supplierGateItems.filter((item) => item.status === 'safe'),
        review_suppliers: supplierGateItems.filter((item) => item.status !== 'safe'),
      },
      product_kill_review: {
        ...this.category(snapshot, 'product_kill_or_stop_review'),
        candidates: productKillItems,
        product_delete_allowed: false,
      },
      campaign_or_ad_group_pause_candidates: {
        ...this.category(snapshot, 'campaign_or_ad_group_pause'),
        candidates: pauseCandidates,
      },
      blockers,
      evidence_links: evidenceLinks,
    };
  }

  fromReadModelQueryResult(
    readModel: AdsAutomationDecisionReadModelQueryResult,
    query: AdsAutomationDecisionReadModelQuery = {},
  ): AdsAutomationDecisionFoundationReadModelSnapshotResponse {
    const snapshot = this.fromDecisionSnapshot(this.decisions.build(readModel.snapshotInput));

    return {
      ...snapshot,
      source: 'mongo_read_model',
      query,
      sourceEvidence: readModel.sourceEvidence,
      missingFieldEvidence: readModel.missingFieldEvidence,
      queryEvidence: readModel.queryEvidence,
    };
  }

  private items(
    snapshot: AdsAutomationDecisionSnapshot,
    decisionType: AdsAutomationCategoryKey,
  ): AdsAutomationDecisionFoundationSnapshotItem[] {
    return snapshot.decisions
      .filter((item) => item.decision_type === decisionType)
      .map((item, index) => this.item(item, index + 1));
  }

  private item(
    decision: AdsAutomationDecisionItem,
    rank: number,
  ): AdsAutomationDecisionFoundationSnapshotItem {
    return {
      rank,
      decision_id: decision.decision_id,
      decision_type: decision.decision_type,
      entity_type: decision.entity_type,
      entity_id: decision.entity_id,
      platform: decision.platform,
      accountId: decision.accountId,
      productId: decision.productId,
      supplierId: decision.supplierId,
      status: decision.status,
      currentValue: decision.currentValue,
      proposedValue: decision.proposedValue,
      evidence_window: decision.evidence_window,
      evidence_metrics: decision.evidence_metrics,
      data_quality_score: decision.data_quality_score,
      confidence: decision.confidence,
      risk_level: decision.risk_level,
      blockers: decision.blockers,
      missing_fields: decision.missing_fields,
      next_required_data: decision.next_required_data,
      approval_required: decision.approval_required,
      execution_allowed_now: decision.execution_allowed_now,
      evidence_link_id: this.evidenceLinkId(decision),
      rationale: decision.rationale,
    };
  }

  private evidenceLink(decision: AdsAutomationDecisionItem): AdsAutomationDecisionFoundationEvidenceLink {
    return {
      evidence_link_id: this.evidenceLinkId(decision),
      decision_id: decision.decision_id,
      decision_type: decision.decision_type,
      entity_type: decision.entity_type,
      entity_id: decision.entity_id,
      productId: decision.productId,
      supplierId: decision.supplierId,
      evidence_window: decision.evidence_window,
      evidence_metrics: decision.evidence_metrics,
      rationale: decision.rationale,
      idempotency_key: decision.idempotency_key,
      rollback_plan: decision.rollback_plan,
    };
  }

  private category(
    snapshot: AdsAutomationDecisionSnapshot,
    decisionType: AdsAutomationCategoryKey,
  ): AdsAutomationDecisionFoundationCategorySummary {
    const category = snapshot.categories[decisionType];
    return {
      status: category?.status || 'no_candidates',
      candidate_count: category?.candidate_count || 0,
      blockers: category?.blockers || [],
      missing_fields: category?.missing_fields || [],
      next_required_data: category?.next_required_data || [],
    };
  }

  private blockers(snapshot: AdsAutomationDecisionSnapshot): AdsAutomationDecisionFoundationBlockers {
    const byCategory = {} as Record<AdsAutomationCategoryKey, string[]>;
    for (const category of FOUNDATION_CATEGORIES) {
      byCategory[category] = this.unique(this.items(snapshot, category).flatMap((item) => item.blockers));
    }
    return {
      global: this.unique(snapshot.decisions.flatMap((item) => item.blockers)),
      by_category: byCategory,
      missing_fields: this.unique(snapshot.decisions.flatMap((item) => item.missing_fields)),
    };
  }

  private scaleDecision(status: AdsAutomationDecisionStatus, scaleCandidateCount: number): AdsAutomationScaleAdsDecision {
    if (scaleCandidateCount > 0) return 'increase';
    if (status === 'insufficient_data') return 'insufficient_data';
    if (status === 'blocked') return 'blocked';
    if (status === 'needs_review') return 'needs_review';
    return 'hold';
  }

  private rank(
    items: AdsAutomationDecisionFoundationSnapshotItem[],
    metricKey: string,
  ): AdsAutomationDecisionFoundationSnapshotItem[] {
    return [...items]
      .sort((left, right) => (
        this.metric(right, metricKey) - this.metric(left, metricKey)
        || right.data_quality_score - left.data_quality_score
        || left.entity_id.localeCompare(right.entity_id)
      ))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  private metric(item: AdsAutomationDecisionFoundationSnapshotItem, key: string): number {
    return this.number(item.proposedValue?.[key]) || this.number(item.currentValue?.[key]) || this.number(item.evidence_metrics[key]);
  }

  private evidenceLinkId(decision: AdsAutomationDecisionItem): string {
    return `evidence:${decision.decision_id}`;
  }

  private number(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort();
  }
}
