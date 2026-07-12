import { Injectable } from '@nestjs/common';
import { AdsAutomationDecisionFoundationSnapshotService } from './ads-automation-decision-foundation-snapshot.service';
import type {
  AdsAutomationDecisionFoundationReadModelReviewExportResponse,
  AdsAutomationDecisionFoundationReadModelReviewExportStatus,
  AdsAutomationDecisionFoundationReadModelReviewRouteExample,
  AdsAutomationDecisionFoundationReadModelReviewSection,
  AdsAutomationDecisionFoundationReadModelSnapshotResponse,
} from './contracts/ads-automation-decision-foundation-snapshot.contract';
import type {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryEvidence,
  AdsAutomationDecisionReadModelQueryResult,
} from './contracts/ads-automation-decision-read-model-query.contract';
import type {
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceEvidence,
} from './contracts/ads-automation-decision-source-adapter.contract';

@Injectable()
export class AdsAutomationDecisionFoundationReviewExportService {
  constructor(
    private readonly foundationSnapshot: AdsAutomationDecisionFoundationSnapshotService,
  ) {}

  fromReadModelQueryResult(
    readModel: AdsAutomationDecisionReadModelQueryResult,
    query: AdsAutomationDecisionReadModelQuery = {},
  ): AdsAutomationDecisionFoundationReadModelReviewExportResponse {
    return this.wrap(
      this.foundationSnapshot.fromReadModelQueryResult(readModel, query),
    );
  }

  fromReadModelFoundationSnapshot(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  ): AdsAutomationDecisionFoundationReadModelReviewExportResponse {
    return this.wrap(foundationSnapshot);
  }

  private wrap(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  ): AdsAutomationDecisionFoundationReadModelReviewExportResponse {
    const sourceAttention = foundationSnapshot.sourceEvidence.filter((item) => (
      item.status !== 'fresh' || item.canUseForDecision !== 'yes'
    ));
    const missingQueryEvidence = foundationSnapshot.queryEvidence.filter((item) => (
      item.status !== 'loaded' || item.missingFields.length > 0
    ));
    const missingBudgetEvidence = this.missingCampaignBudgetEvidence(foundationSnapshot.queryEvidence);
    const exportStatus = this.exportStatus(
      foundationSnapshot,
      sourceAttention,
      missingQueryEvidence,
    );
    const routeExamples = this.routeExamples();
    const renderedSections = this.renderedSections(
      foundationSnapshot,
      sourceAttention,
      missingQueryEvidence,
      missingBudgetEvidence,
    );

    return {
      schemaVersion: 'ads_automation_decision_foundation_read_model_review_export.v1',
      generatedAt: new Date().toISOString(),
      exportMode: 'local_readback',
      query: foundationSnapshot.query,
      safety: {
        ...foundationSnapshot.safety,
        repository_read_only: true,
        read_model_query_used: true,
        foundation_snapshot_reused: true,
        provider_mutation_used: false,
        direct_google_ads_api_call: false,
        future_live_execution_allowed: false,
        live_path_implemented: false,
        reviewer_export_readback: true,
        reviewer_export_persistence_performed: false,
        campaignBudgetId_fallback_used: false,
      },
      summary: {
        export_status: exportStatus,
        export_mode: 'local_readback',
        foundation_snapshot_schema_version: foundationSnapshot.schemaVersion,
        source_snapshot_schema_version: foundationSnapshot.source_snapshot_schema_version,
        read_model_source: foundationSnapshot.source,
        source_evidence_records: foundationSnapshot.sourceEvidence.length,
        stale_source_evidence_records: foundationSnapshot.sourceEvidence.filter((item) => item.status === 'stale').length,
        missing_source_evidence_records: foundationSnapshot.sourceEvidence.filter((item) => item.status === 'missing').length,
        missing_field_evidence_records: foundationSnapshot.missingFieldEvidence.length,
        query_evidence_records: foundationSnapshot.queryEvidence.length,
        loaded_query_evidence_records: foundationSnapshot.queryEvidence.filter((item) => item.status === 'loaded').length,
        missing_query_evidence_records: missingQueryEvidence.length,
        ba_field_sections_rendered: renderedSections.length,
        scale_ads_decision: foundationSnapshot.scale_ads_decision.decision,
        scale_candidates: foundationSnapshot.scale_ads_decision.candidates.length,
        total_increase_vnd: foundationSnapshot.scale_amount.total_increase_vnd,
        target_ad_group_candidates: foundationSnapshot.target_ad_groups.items.length,
        product_budget_allocation_candidates: foundationSnapshot.product_budget_allocation.items.length,
        safe_supplier_candidates: foundationSnapshot.supplier_gate.safe_suppliers.length,
        review_supplier_candidates: foundationSnapshot.supplier_gate.review_suppliers.length,
        product_kill_review_candidates: foundationSnapshot.product_kill_review.candidates.length,
        pause_candidates: foundationSnapshot.campaign_or_ad_group_pause_candidates.candidates.length,
        blocker_count: foundationSnapshot.blockers.global.length,
        missing_blocker_fields: foundationSnapshot.blockers.missing_fields.length,
        campaignBudgetId_required: true,
        campaignBudgetId_fallback_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: exportStatus === 'ready_for_review'
          ? 'inspect_foundation_review_export'
          : 'resolve_missing_read_model_evidence',
      },
      routeExamples,
      renderedSections,
      markdownPreview: this.markdownPreview(
        foundationSnapshot,
        exportStatus,
        sourceAttention,
        missingQueryEvidence,
        missingBudgetEvidence,
      ),
      foundationSnapshot,
    };
  }

  private routeExamples(): AdsAutomationDecisionFoundationReadModelReviewRouteExample[] {
    return [
      {
        label: 'Foundation review export',
        method: 'POST',
        path: '/ai/ads-automation/decision-foundation-read-model-review-export',
        purpose: 'Render one BA-reviewable foundation decision artifact from the read-model snapshot contract.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: 'Foundation read-model snapshot',
        method: 'POST',
        path: '/ai/ads-automation/decision-foundation-read-model-snapshot',
        purpose: 'Inspect the raw foundation snapshot and read-model evidence behind this export.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
    ];
  }

  private renderedSections(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
    sourceAttention: AdsAutomationDecisionSourceEvidence[],
    missingQueryEvidence: AdsAutomationDecisionReadModelQueryEvidence[],
    missingBudgetEvidence: AdsAutomationDecisionReadModelQueryEvidence[],
  ): AdsAutomationDecisionFoundationReadModelReviewSection[] {
    const hasDecisions = foundationSnapshot.summary.decisions > 0;
    const hasMissingFields = foundationSnapshot.missingFieldEvidence.length > 0;

    return [
      {
        section_id: 'operator_summary',
        title: 'Operator Summary',
        status: hasDecisions ? 'ready_for_review' : 'empty',
        lines: [
          `Snapshot date: ${foundationSnapshot.snapshotDate}`,
          `Scale ads decision: ${foundationSnapshot.scale_ads_decision.decision}`,
          `Scale candidates: ${foundationSnapshot.scale_ads_decision.candidates.length}`,
          `Scale amount increase VND: ${foundationSnapshot.scale_amount.total_increase_vnd}`,
          `Evidence links: ${foundationSnapshot.evidence_links.length}`,
        ],
        evidence_record_ids: foundationSnapshot.evidence_links.map((item) => item.evidence_link_id),
      },
      {
        section_id: 'ba_foundation_fields',
        title: 'BA Foundation Fields',
        status: hasDecisions ? 'ready_for_review' : 'empty',
        lines: [
          `Target ad groups: ${foundationSnapshot.target_ad_groups.items.length}`,
          `Product budget allocation items: ${foundationSnapshot.product_budget_allocation.items.length}`,
          `Safe suppliers: ${foundationSnapshot.supplier_gate.safe_suppliers.length}`,
          `Supplier review items: ${foundationSnapshot.supplier_gate.review_suppliers.length}`,
          `Product kill review candidates: ${foundationSnapshot.product_kill_review.candidates.length}`,
          `Pause candidates: ${foundationSnapshot.campaign_or_ad_group_pause_candidates.candidates.length}`,
        ],
        evidence_record_ids: foundationSnapshot.evidence_links.map((item) => item.evidence_link_id),
      },
      {
        section_id: 'safety_gates',
        title: 'Safety Gates',
        status: 'passed',
        lines: [
          'execution_allowed_now=false',
          'provider_api_called=false',
          'google_ads_api_called=false',
          'validateOnly_called=false',
          'live_ads_execution_used=false',
          'erp_mutation_used=false',
          'payment_mutation_used=false',
          'order_mutation_used=false',
          'inventory_mutation_used=false',
          'production_ready=false',
        ],
        evidence_record_ids: [],
      },
      {
        section_id: 'source_evidence',
        title: 'Source Evidence',
        status: sourceAttention.length ? 'attention' : 'ready_for_review',
        lines: foundationSnapshot.sourceEvidence.length
          ? foundationSnapshot.sourceEvidence.map((item) => [
              `${item.sourceKey}: ${item.status}`,
              `canUseForDecision=${item.canUseForDecision}`,
              `rows=${item.rowCount}`,
              `latestObservedAt=${item.latestObservedAt || 'none'}`,
              `missingFields=${this.joinOrNone(item.missingFields)}`,
            ].join(', '))
          : ['No source evidence records were returned.'],
        evidence_record_ids: foundationSnapshot.sourceEvidence.map((item) => item.sourceKey),
      },
      {
        section_id: 'missing_field_evidence',
        title: 'Missing Field Evidence',
        status: hasMissingFields ? 'attention' : 'passed',
        lines: hasMissingFields
          ? foundationSnapshot.missingFieldEvidence.map((item) => (
              `${item.sourceKey}/${item.entityType}/${item.entityId}: ${item.missingFields.join(', ')}`
            ))
          : ['No missing field evidence records.'],
        evidence_record_ids: foundationSnapshot.missingFieldEvidence.map((item) => (
          `${item.sourceKey}:${item.entityType}:${item.entityId}`
        )),
      },
      {
        section_id: 'query_evidence',
        title: 'Query Evidence',
        status: missingQueryEvidence.length ? 'attention' : 'ready_for_review',
        lines: foundationSnapshot.queryEvidence.length
          ? foundationSnapshot.queryEvidence.map((item) => [
              `${item.sourceKey}/${item.entityType}/${item.entityId}: ${item.status}`,
              `rows=${item.rowCount}`,
              `missingFields=${this.joinOrNone(item.missingFields)}`,
              item.rationale,
            ].join(', '))
          : ['No query evidence records were returned.'],
        evidence_record_ids: foundationSnapshot.queryEvidence.map((item) => (
          `${item.sourceKey}:${item.entityType}:${item.entityId}`
        )),
      },
      {
        section_id: 'campaign_budget_join',
        title: 'Campaign Budget Join',
        status: missingBudgetEvidence.length ? 'attention' : 'passed',
        lines: [
          missingBudgetEvidence.length
            ? `Missing campaignBudgetId_or_campaignBudgetResourceName for ad groups: ${this.joinOrNone(missingBudgetEvidence.map((item) => item.entityId))}`
            : 'Campaign budget query evidence is loaded for budget-capable ad groups.',
          'campaignBudgetId is required for budget drafts; campaignId/adGroupId are not fallback budget IDs.',
          'campaignBudgetId_fallback_used=false',
        ],
        evidence_record_ids: missingBudgetEvidence.map((item) => (
          `${item.sourceKey}:${item.entityType}:${item.entityId}`
        )),
      },
      {
        section_id: 'review_checklist',
        title: 'Review Checklist',
        status: missingQueryEvidence.length || sourceAttention.length || hasMissingFields
          ? 'attention'
          : 'ready_for_review',
        lines: [
          'Inspect scale_ads_decision, scale_amount, target_ad_groups, product_budget_allocation, supplier_gate, product_kill_review, and pause candidates together.',
          'Resolve stale or missing source/query evidence before using this artifact for future approval review.',
          'Confirm execution_allowed_now, provider_api_called, google_ads_api_called, validateOnly_called, and live_ads_execution_used remain false.',
          'Confirm campaignBudgetId is present for any future campaign budget draft; do not use campaignId or adGroupId as a fallback budget identifier.',
        ],
        evidence_record_ids: [],
      },
    ];
  }

  private markdownPreview(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
    exportStatus: AdsAutomationDecisionFoundationReadModelReviewExportStatus,
    sourceAttention: AdsAutomationDecisionSourceEvidence[],
    missingQueryEvidence: AdsAutomationDecisionReadModelQueryEvidence[],
    missingBudgetEvidence: AdsAutomationDecisionReadModelQueryEvidence[],
  ): string {
    return [
      '# Ads Automation Foundation Review Export',
      `Snapshot date: ${foundationSnapshot.snapshotDate}`,
      `Export status: ${exportStatus}`,
      `Scale ads decision: ${foundationSnapshot.scale_ads_decision.decision}`,
      `Scale amount increase VND: ${foundationSnapshot.scale_amount.total_increase_vnd}`,
      `Source evidence records: ${foundationSnapshot.sourceEvidence.length}`,
      `Source evidence needing attention: ${this.joinOrNone(sourceAttention.map((item) => `${item.sourceKey}:${item.status}`))}`,
      `Missing field evidence: ${this.joinOrNone(foundationSnapshot.missingFieldEvidence.map((item) => `${item.sourceKey}/${item.entityId}:${item.missingFields.join('+')}`))}`,
      `Query evidence needing attention: ${this.joinOrNone(missingQueryEvidence.map((item) => `${item.sourceKey}/${item.entityId}:${item.status}`))}`,
      missingBudgetEvidence.length
        ? `Campaign budget issue: missing campaignBudgetId_or_campaignBudgetResourceName for ${this.joinOrNone(missingBudgetEvidence.map((item) => item.entityId))}`
        : 'Campaign budget issue: none',
      'Campaign budget rule: campaignBudgetId is required; campaignId/adGroupId are not fallback budget IDs; campaignBudgetId_fallback_used=false',
      'Safety gates: execution_allowed_now=false, provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
    ].join('\n');
  }

  private exportStatus(
    foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse,
    sourceAttention: AdsAutomationDecisionSourceEvidence[],
    missingQueryEvidence: AdsAutomationDecisionReadModelQueryEvidence[],
  ): AdsAutomationDecisionFoundationReadModelReviewExportStatus {
    if (!foundationSnapshot.sourceEvidence.length && !foundationSnapshot.queryEvidence.length) {
      return 'empty';
    }
    if (
      sourceAttention.length
      || missingQueryEvidence.length
      || foundationSnapshot.missingFieldEvidence.length
      || foundationSnapshot.blockers.missing_fields.length
    ) {
      return 'needs_attention';
    }
    return 'ready_for_review';
  }

  private missingCampaignBudgetEvidence(
    queryEvidence: AdsAutomationDecisionReadModelQueryEvidence[],
  ): AdsAutomationDecisionReadModelQueryEvidence[] {
    return queryEvidence.filter((item) => (
      item.sourceKey === 'campaign_budgets'
      && item.missingFields.includes('campaignBudgetId_or_campaignBudgetResourceName')
    ));
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((item) => String(item || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}
