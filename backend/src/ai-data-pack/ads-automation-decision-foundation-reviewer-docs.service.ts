import { Injectable } from '@nestjs/common';
import { AdsAutomationDecisionFoundationReviewExportService } from './ads-automation-decision-foundation-review-export.service';
import type {
  AdsAutomationDecisionFoundationReadModelReviewExportResponse,
  AdsAutomationDecisionFoundationReadModelReviewSection,
  AdsAutomationDecisionFoundationReadModelReviewerDocsResponse,
  AdsAutomationDecisionFoundationReadModelReviewerDocsRouteExample,
} from './contracts/ads-automation-decision-foundation-snapshot.contract';
import type {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelQueryResult,
} from './contracts/ads-automation-decision-read-model-query.contract';

const REVIEW_EXPORT_ROUTE = '/ai/ads-automation/decision-foundation-read-model-review-export';
const REVIEWER_DOCS_ROUTE = '/ai/ads-automation/decision-foundation-read-model-reviewer-docs';

@Injectable()
export class AdsAutomationDecisionFoundationReviewerDocsService {
  constructor(
    private readonly reviewExport: AdsAutomationDecisionFoundationReviewExportService,
  ) {}

  fromReadModelQueryResult(
    readModel: AdsAutomationDecisionReadModelQueryResult,
    query: AdsAutomationDecisionReadModelQuery = {},
  ): AdsAutomationDecisionFoundationReadModelReviewerDocsResponse {
    return this.fromReviewExport(
      this.reviewExport.fromReadModelQueryResult(readModel, query),
    );
  }

  fromReviewExport(
    reviewExport: AdsAutomationDecisionFoundationReadModelReviewExportResponse,
  ): AdsAutomationDecisionFoundationReadModelReviewerDocsResponse {
    const attentionSections = reviewExport.renderedSections.filter((section) => section.status === 'attention');
    const renderedSectionIds = reviewExport.renderedSections.map((section) => section.section_id);
    const evidenceRecordIds = this.unique(
      reviewExport.renderedSections.flatMap((section) => section.evidence_record_ids),
    );
    const routeExamples = this.routeExamples();

    return {
      schemaVersion: 'ads_automation_decision_foundation_read_model_reviewer_docs.v1',
      generatedAt: new Date().toISOString(),
      docsMode: 'local_readback_docs',
      query: reviewExport.query,
      safety: {
        ...reviewExport.safety,
        source_review_export_reused: true,
        reviewer_docs_readback: true,
        reviewer_docs_persistence_performed: false,
        full_foundation_snapshot_payload_included: false,
      },
      summary: {
        docs_status: reviewExport.summary.export_status,
        docs_mode: 'local_readback_docs',
        source_export_mode: reviewExport.exportMode,
        source_export_schema_version: reviewExport.schemaVersion,
        source_foundation_snapshot_schema_version: reviewExport.summary.foundation_snapshot_schema_version,
        read_model_source: reviewExport.summary.read_model_source,
        rendered_sections: reviewExport.renderedSections.length,
        attention_sections: attentionSections.length,
        attention_section_ids: attentionSections.map((section) => section.section_id),
        source_evidence_records_rendered: reviewExport.summary.source_evidence_records,
        stale_source_evidence_records: reviewExport.summary.stale_source_evidence_records,
        missing_source_evidence_records: reviewExport.summary.missing_source_evidence_records,
        missing_field_evidence_records: reviewExport.summary.missing_field_evidence_records,
        query_evidence_records_rendered: reviewExport.summary.query_evidence_records,
        missing_query_evidence_records: reviewExport.summary.missing_query_evidence_records,
        campaignBudgetId_required: true,
        campaignBudgetId_fallback_used: false,
        full_foundation_snapshot_payload_included: false,
        source_review_export_reused: true,
        reviewer_docs_persistence_performed: false,
        reviewer_export_persistence_performed: false,
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
        next_required_action: reviewExport.summary.export_status === 'ready_for_review'
          ? 'inspect_foundation_reviewer_docs'
          : 'resolve_missing_read_model_evidence',
      },
      routeExamples,
      renderedSections: reviewExport.renderedSections,
      markdownPreview: this.markdownPreview(reviewExport, attentionSections),
      sourceExportDigest: {
        schemaVersion: reviewExport.schemaVersion,
        generatedAt: reviewExport.generatedAt,
        exportMode: reviewExport.exportMode,
        review_export_route: REVIEW_EXPORT_ROUTE,
        foundation_snapshot_schema_version: reviewExport.summary.foundation_snapshot_schema_version,
        read_model_source: reviewExport.summary.read_model_source,
        summary: reviewExport.summary,
        rendered_section_ids: renderedSectionIds,
        evidence_record_ids: evidenceRecordIds,
        omitted_payloads: ['foundationSnapshot'],
        full_foundation_snapshot_payload_included: false,
      },
    };
  }

  private routeExamples(): AdsAutomationDecisionFoundationReadModelReviewerDocsRouteExample[] {
    return [
      {
        label: 'Foundation reviewer docs',
        method: 'POST',
        path: REVIEWER_DOCS_ROUTE,
        purpose: 'Render BA-facing foundation review sections without returning the full foundationSnapshot payload.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: 'Foundation review export JSON',
        method: 'POST',
        path: REVIEW_EXPORT_ROUTE,
        purpose: 'Inspect the complete machine-readable foundation review export behind the docs view.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
    ];
  }

  private markdownPreview(
    reviewExport: AdsAutomationDecisionFoundationReadModelReviewExportResponse,
    attentionSections: AdsAutomationDecisionFoundationReadModelReviewSection[],
  ): string {
    return [
      '# Ads Automation Foundation Reviewer Docs',
      `Docs status: ${reviewExport.summary.export_status}`,
      `Source export route: ${REVIEW_EXPORT_ROUTE}`,
      `Rendered sections: ${reviewExport.renderedSections.length}`,
      `Attention sections: ${this.joinOrNone(attentionSections.map((section) => section.section_id))}`,
      `Source evidence records: ${reviewExport.summary.source_evidence_records}`,
      `Stale source evidence records: ${reviewExport.summary.stale_source_evidence_records}`,
      `Missing field evidence records: ${reviewExport.summary.missing_field_evidence_records}`,
      `Missing query evidence records: ${reviewExport.summary.missing_query_evidence_records}`,
      `Campaign budget fallback used: ${reviewExport.summary.campaignBudgetId_fallback_used}`,
      'Campaign budget rule: campaignBudgetId is required; campaignId/adGroupId are not fallback budget IDs.',
      'Full foundationSnapshot payload included: false',
      'Safety gates: execution_allowed_now=false, provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
    ].join('\n');
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((item) => String(item || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}
