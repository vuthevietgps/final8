import { Injectable } from '@nestjs/common';
import { AdsAutomationApprovalEvidenceReviewExportService } from './ads-automation-approval-evidence-review-export.service';
import type {
  AdsAutomationApprovalEvidenceReviewExportResponse,
  AdsAutomationApprovalEvidenceReviewerDocsMode,
  AdsAutomationApprovalEvidenceReviewerDocsResponse,
  AdsAutomationApprovalEvidenceReviewerDocsRouteExample,
  AdsAutomationApprovalEvidenceReviewerDocsSection,
} from './contracts/ads-automation-approval-evidence-index.contract';

interface AdsAutomationApprovalEvidenceReviewerDocsOptions {
  fixture?: string | null;
}

@Injectable()
export class AdsAutomationApprovalEvidenceReviewerDocsService {
  constructor(
    private readonly reviewExport: AdsAutomationApprovalEvidenceReviewExportService,
  ) {}

  async buildByApprovalId(
    approvalId: string,
    options: AdsAutomationApprovalEvidenceReviewerDocsOptions = {},
  ): Promise<AdsAutomationApprovalEvidenceReviewerDocsResponse> {
    const reviewerExport = await this.reviewExport.buildByApprovalId(
      approvalId,
      options,
    );
    return this.wrap(reviewerExport);
  }

  private wrap(
    reviewerExport: AdsAutomationApprovalEvidenceReviewExportResponse,
  ): AdsAutomationApprovalEvidenceReviewerDocsResponse {
    const docsMode: AdsAutomationApprovalEvidenceReviewerDocsMode =
      reviewerExport.exportMode === 'local_demo_fixture'
        ? 'local_demo_fixture_docs'
        : 'local_readback_docs';
    const approvalId = reviewerExport.query.approval_id;
    const docsRoute = `/ai/ads-automation/decision-draft-approvals/${encodeURIComponent(approvalId)}/evidence-index/reviewer-docs`;
    const fixtureQuery = reviewerExport.query.fixture
      ? `fixture=${encodeURIComponent(reviewerExport.query.fixture)}`
      : null;
    const routeExamples = this.routeExamples(
      docsRoute,
      reviewerExport.reviewerGuide.review_route,
      fixtureQuery,
    );
    const renderedSections = this.renderedSections(reviewerExport);
    const docsStatus = reviewerExport.summary.export_status;

    return {
      schemaVersion: 'ads_automation_approval_evidence_reviewer_docs.v1',
      generatedAt: new Date().toISOString(),
      docsMode,
      query: reviewerExport.query,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        in_memory_only: reviewerExport.safety.in_memory_only,
        persistence_used: reviewerExport.safety.persistence_used,
        durable_storage_used: reviewerExport.safety.durable_storage_used,
        erp_local_persistence_used: reviewerExport.safety.erp_local_persistence_used,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        provider_mutation_used: false,
        direct_google_ads_api_call: false,
        reviewer_export_readback: true,
        reviewer_export_persistence_performed: false,
        reviewer_docs_readback: true,
        reviewer_docs_persistence_performed: false,
        demo_fixture_used: reviewerExport.safety.demo_fixture_used,
        demo_fixture_persistence_performed: false,
      },
      summary: {
        docs_status: docsStatus,
        docs_mode: docsMode,
        source_export_mode: reviewerExport.exportMode,
        export_status: reviewerExport.summary.export_status,
        total_evidence_records_rendered: reviewerExport.summary.total_evidence_records_included,
        validateOnly_evidence_records_rendered: reviewerExport.summary.validateOnly_evidence_records_included,
        policy_decision_records_rendered: reviewerExport.summary.policy_decision_records_included,
        execution_preflight_records_rendered: reviewerExport.summary.execution_preflight_records_included,
        pending_approval_record_rendered: reviewerExport.summary.pending_approval_record_included,
        pending_action_review_evidence_records_rendered: reviewerExport.summary.pending_action_review_evidence_records_included,
        source_sync_decision_evidence_records_rendered: reviewerExport.summary.source_sync_decision_evidence_records_included,
        source_sync_decision_blocked_sources_rendered: reviewerExport.summary.source_sync_decision_blocked_sources,
        source_sync_gate_status: reviewerExport.summary.source_sync_gate_status,
        source_sync_can_generate_action_draft: reviewerExport.summary.source_sync_can_generate_action_draft,
        source_sync_can_recommend_ads_scale: reviewerExport.summary.source_sync_can_recommend_ads_scale,
        source_sync_can_use_google_ads_data_claim: reviewerExport.summary.source_sync_can_use_google_ads_data_claim,
        source_sync_blocking_reasons_rendered: reviewerExport.summary.source_sync_blocking_reasons,
        provider_account_readiness_status: reviewerExport.summary.provider_account_readiness_status,
        provider_account_readiness_blocked_actions_rendered: reviewerExport.summary.provider_account_readiness_blocked_actions,
        provider_account_readiness_blocking_reasons_rendered: reviewerExport.summary.provider_account_readiness_blocking_reasons,
        provider_account_readiness_campaignBudgetId_no_fallback: reviewerExport.summary.provider_account_readiness_campaignBudgetId_no_fallback,
        provider_account_readiness_scale_up_execution_mode: reviewerExport.summary.provider_account_readiness_scale_up_execution_mode,
        linked_validateOnly_evidence_records: reviewerExport.summary.linked_validateOnly_evidence_records,
        linked_policy_decision_records: reviewerExport.summary.linked_policy_decision_records,
        route_examples_rendered: routeExamples.length,
        sections_rendered: renderedSections.length,
        approval_required: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        reviewer_docs_persistence_performed: false,
        reviewer_export_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        next_required_action: docsStatus === 'ready_for_review'
          ? 'inspect_reviewer_docs'
          : 'verify_approval_id_or_generate_preflight_evidence',
      },
      routeExamples,
      renderedSections,
      markdownPreview: this.markdownPreview(reviewerExport, docsRoute, fixtureQuery),
      reviewerExport,
    };
  }

  private routeExamples(
    docsRoute: string,
    exportRoute: string,
    fixtureQuery: string | null,
  ): AdsAutomationApprovalEvidenceReviewerDocsRouteExample[] {
    return [
      {
        label: 'Reviewer docs',
        method: 'GET',
        path: docsRoute,
        query: fixtureQuery,
        purpose: 'Render operator-facing approval evidence sections for one approval id.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
      {
        label: 'Reviewer export JSON',
        method: 'GET',
        path: exportRoute,
        query: fixtureQuery,
        purpose: 'Inspect the complete machine-readable evidence export behind the docs view.',
        provider_api_called: false,
        erp_mutation_used: false,
      },
    ];
  }

  private renderedSections(
    reviewerExport: AdsAutomationApprovalEvidenceReviewExportResponse,
  ): AdsAutomationApprovalEvidenceReviewerDocsSection[] {
    const evidenceIndex = reviewerExport.evidenceIndex;
    const validationIds = evidenceIndex.links.validateOnly_validation_ids_with_evidence;
    const missingValidationIds = evidenceIndex.links.validateOnly_validation_ids_missing_evidence;
    const policyDecisionIds = evidenceIndex.links.policy_decision_ids_with_evidence;
    const missingPolicyDecisionIds = evidenceIndex.links.policy_decision_ids_missing_evidence;
    const executionRecordIds = evidenceIndex.links.execution_record_ids;
    const hasEvidence = reviewerExport.summary.total_evidence_records_included > 0;
    const sourceSyncEvidenceIds = evidenceIndex.sourceSyncDecisionEvidence
      .map((record) => `source-sync:${record.sourceKey}`);
    const pendingActionEvidence = evidenceIndex.pendingActionReviewEvidence;
    const pendingActionEvidenceIds = pendingActionEvidence
      .map((record) => `pending-action:${record.approval_id}`);
    const sourceSyncStatus = reviewerExport.summary.source_sync_gate_status;
    const hasSourceSyncEvidence = reviewerExport.summary.source_sync_decision_evidence_records_included > 0
      || reviewerExport.summary.pending_approval_record_included;

    return [
      {
        section_id: 'operator_summary',
        title: 'Operator Summary',
        status: hasEvidence ? 'ready_for_review' : 'empty',
        lines: [
          `Approval ID: ${reviewerExport.query.approval_id}`,
          `Export mode: ${reviewerExport.exportMode}`,
          `Evidence records: ${reviewerExport.summary.total_evidence_records_included}`,
          `Source-sync gate status: ${sourceSyncStatus}`,
          `Next action: ${reviewerExport.summary.next_required_action}`,
        ],
        evidence_record_ids: [],
      },
      {
        section_id: 'safety_gates',
        title: 'Safety Gates',
        status: 'passed',
        lines: [
          'future_live_execution_allowed=false',
          'execution_allowed_now=false',
          'live_path_implemented=false',
          'provider_api_called=false',
          'google_ads_api_called=false',
          'validateOnly_called=false',
          'live_ads_execution_used=false',
          'erp_mutation_used=false',
        ],
        evidence_record_ids: [],
      },
      {
        section_id: 'linked_evidence',
        title: 'Linked Evidence',
        status: hasEvidence ? 'ready_for_review' : 'empty',
        lines: [
          `Execution records: ${this.joinOrNone(executionRecordIds)}`,
          `Linked validate-only evidence: ${this.joinOrNone(validationIds)}`,
          `Missing validate-only evidence: ${this.joinOrNone(missingValidationIds)}`,
          `Linked policy decisions: ${this.joinOrNone(policyDecisionIds)}`,
          `Missing policy decisions: ${this.joinOrNone(missingPolicyDecisionIds)}`,
        ],
        evidence_record_ids: [
          ...executionRecordIds,
          ...validationIds,
          ...policyDecisionIds,
        ],
      },
      {
        section_id: 'source_sync_evidence',
        title: 'Source Sync Evidence',
        status: sourceSyncStatus === 'blocked'
          ? 'attention'
          : hasSourceSyncEvidence
            ? 'ready_for_review'
            : 'empty',
        lines: [
          `Pending approval source-sync record: ${reviewerExport.summary.pending_approval_record_included ? 'found' : 'missing'}`,
          `Source-sync evidence records: ${reviewerExport.summary.source_sync_decision_evidence_records_included}`,
          `Blocked source-sync sources: ${reviewerExport.summary.source_sync_decision_blocked_sources}`,
          `Gate canGenerateActionDraft: ${this.booleanOrUnknown(reviewerExport.summary.source_sync_can_generate_action_draft)}`,
          `Gate canRecommendAdsScale: ${this.booleanOrUnknown(reviewerExport.summary.source_sync_can_recommend_ads_scale)}`,
          `Gate canUseGoogleAdsDataClaim: ${this.booleanOrUnknown(reviewerExport.summary.source_sync_can_use_google_ads_data_claim)}`,
          `Source-sync blocking reasons: ${this.joinOrNone(reviewerExport.summary.source_sync_blocking_reasons)}`,
          `Source-sync source keys: ${this.joinOrNone(evidenceIndex.sourceSyncDecisionEvidence.map((record) => record.sourceKey))}`,
        ],
        evidence_record_ids: sourceSyncEvidenceIds,
      },
      {
        section_id: 'pending_action_readiness_evidence',
        title: 'Pending Action Readiness',
        status: reviewerExport.summary.provider_account_readiness_status === 'blocked'
          || reviewerExport.summary.provider_account_readiness_blocked_actions > 0
          ? 'attention'
          : pendingActionEvidence.length
            ? 'ready_for_review'
            : 'empty',
        lines: [
          `Pending action review evidence records: ${reviewerExport.summary.pending_action_review_evidence_records_included}`,
          `Provider account readiness status: ${reviewerExport.summary.provider_account_readiness_status}`,
          `Provider readiness blocked actions: ${reviewerExport.summary.provider_account_readiness_blocked_actions}`,
          `Provider readiness blockers: ${this.joinOrNone(reviewerExport.summary.provider_account_readiness_blocking_reasons)}`,
          `Provider campaignBudgetId no fallback: ${this.booleanOrUnknown(reviewerExport.summary.provider_account_readiness_campaignBudgetId_no_fallback)}`,
          `Provider scale-up execution mode: ${reviewerExport.summary.provider_account_readiness_scale_up_execution_mode || 'not_applicable'}`,
          ...pendingActionEvidence.map((record) => [
            record.action_type,
            record.entity_id,
            `source_blockers=${this.joinOrNone(record.source_sync_blocking_reasons)}`,
            `provider_status=${record.providerAccountReadiness.status}`,
            `provider_blockers=${this.joinOrNone(record.providerAccountReadiness.blockers)}`,
          ].join(' | ')),
        ],
        evidence_record_ids: pendingActionEvidenceIds,
      },
      {
        section_id: 'review_checklist',
        title: 'Review Checklist',
        status: hasEvidence ? 'attention' : 'empty',
        lines: reviewerExport.reviewerGuide.checklist,
        evidence_record_ids: [],
      },
    ];
  }

  private markdownPreview(
    reviewerExport: AdsAutomationApprovalEvidenceReviewExportResponse,
    docsRoute: string,
    fixtureQuery: string | null,
  ): string {
    const evidenceIndex = reviewerExport.evidenceIndex;
    const docsPath = fixtureQuery ? `${docsRoute}?${fixtureQuery}` : docsRoute;

    return [
      '# Ads Approval Evidence Review',
      `Approval ID: ${reviewerExport.query.approval_id}`,
      `Docs route: ${docsPath}`,
      `Export status: ${reviewerExport.summary.export_status}`,
      `Evidence records: ${reviewerExport.summary.total_evidence_records_included}`,
      `Source-sync gate status: ${reviewerExport.summary.source_sync_gate_status}`,
      `Source-sync evidence records: ${reviewerExport.summary.source_sync_decision_evidence_records_included}`,
      `Gate canRecommendAdsScale: ${this.booleanOrUnknown(reviewerExport.summary.source_sync_can_recommend_ads_scale)}`,
      `Source-sync blockers: ${this.joinOrNone(reviewerExport.summary.source_sync_blocking_reasons)}`,
      `Pending action review evidence records: ${reviewerExport.summary.pending_action_review_evidence_records_included}`,
      `Provider readiness status: ${reviewerExport.summary.provider_account_readiness_status}`,
      `Provider readiness blockers: ${this.joinOrNone(reviewerExport.summary.provider_account_readiness_blocking_reasons)}`,
      `Execution records: ${this.joinOrNone(evidenceIndex.links.execution_record_ids)}`,
      `Linked validate-only evidence: ${this.joinOrNone(evidenceIndex.links.validateOnly_validation_ids_with_evidence)}`,
      `Linked policy decisions: ${this.joinOrNone(evidenceIndex.links.policy_decision_ids_with_evidence)}`,
      'Safety gates: execution_allowed_now=false, provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
    ].join('\n');
  }

  private joinOrNone(values: string[]): string {
    return values.length ? values.join(', ') : 'none';
  }

  private booleanOrUnknown(value: boolean | null): string {
    return typeof value === 'boolean' ? String(value) : 'unknown';
  }
}
