import { BadRequestException, Injectable } from '@nestjs/common';
import { AdsAutomationApprovalEvidenceIndexService } from './ads-automation-approval-evidence-index.service';
import { buildAdsAutomationApprovalEvidenceReviewFixtureRecords } from './ads-automation-approval-evidence-review-export.fixture';
import type {
  AdsAutomationApprovalEvidenceIndexResponse,
  AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups,
  AdsAutomationApprovalEvidenceValidateOnlyPreflightClosedSafetyFlags,
  AdsAutomationApprovalEvidenceValidateOnlyPreflightReview,
  AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewCandidate,
  AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness,
  AdsAutomationApprovalEvidenceReviewExportFixtureMetadata,
  AdsAutomationApprovalEvidenceReviewExportMode,
  AdsAutomationApprovalEvidenceReviewExportResponse,
  AdsAutomationApprovalEvidenceReviewFixtureScenario,
} from './contracts/ads-automation-approval-evidence-index.contract';
import type {
  AdsAutomationGoogleAdsMockImportValidateOnlyPreflight,
  AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate,
} from './contracts/ads-automation-google-ads-mock-import-demo.contract';

interface AdsAutomationApprovalEvidenceReviewExportOptions {
  fixture?: string | null;
  validateOnlyPreflight?: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight | null;
}

const FIXTURE_ALIASES: Record<string, AdsAutomationApprovalEvidenceReviewFixtureScenario> = {
  linked: 'linked_budget_update_evidence',
  linked_budget_update_evidence: 'linked_budget_update_evidence',
  scale_gate_blocker: 'scale_recommendation_gate_blocker_evidence',
  scale_recommendation_gate_blocker_evidence: 'scale_recommendation_gate_blocker_evidence',
  pause_blocker: 'pause_ad_group_blocker_evidence',
  pause_ad_group_blocker_evidence: 'pause_ad_group_blocker_evidence',
  stop_import_blocker: 'supplier_product_stop_import_review_blocker_evidence',
  supplier_product_stop_import_review_blocker_evidence: 'supplier_product_stop_import_review_blocker_evidence',
  mock_preflight_blockers: 'google_ads_mock_validate_only_preflight_blockers',
  google_ads_mock_validate_only_preflight_blockers: 'google_ads_mock_validate_only_preflight_blockers',
  empty: 'empty_approval_evidence',
  empty_approval_evidence: 'empty_approval_evidence',
};

@Injectable()
export class AdsAutomationApprovalEvidenceReviewExportService {
  constructor(
    private readonly evidenceIndex: AdsAutomationApprovalEvidenceIndexService,
  ) {}

  async buildByApprovalId(
    approvalId: string,
    options: AdsAutomationApprovalEvidenceReviewExportOptions = {},
  ): Promise<AdsAutomationApprovalEvidenceReviewExportResponse> {
    const fixtureScenario = this.fixtureScenario(options.fixture);
    if (fixtureScenario) {
      return this.buildFixtureExport(approvalId, fixtureScenario);
    }

    return this.wrap(
      await this.evidenceIndex.buildByApprovalId(approvalId),
      'local_readback',
      null,
      options.validateOnlyPreflight || null,
    );
  }

  private buildFixtureExport(
    approvalId: string,
    scenario: AdsAutomationApprovalEvidenceReviewFixtureScenario,
  ): AdsAutomationApprovalEvidenceReviewExportResponse {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const fixtureRecords = buildAdsAutomationApprovalEvidenceReviewFixtureRecords(
      normalizedApprovalId,
      scenario,
    );
    const evidenceIndex = this.evidenceIndex.buildFromRecords(
      normalizedApprovalId,
      fixtureRecords.validateOnlyEvidenceRecords,
      fixtureRecords.policyDecisionEvidenceRecords,
      fixtureRecords.executionPreflightDryRunRecords,
      fixtureRecords.generatedAt,
      fixtureRecords.pendingApproval,
    );

    return this.wrap(
      evidenceIndex,
      'local_demo_fixture',
      fixtureRecords.fixture,
      fixtureRecords.validateOnlyPreflight,
    );
  }

  private wrap(
    evidenceIndex: AdsAutomationApprovalEvidenceIndexResponse,
    exportMode: AdsAutomationApprovalEvidenceReviewExportMode,
    fixture: AdsAutomationApprovalEvidenceReviewExportFixtureMetadata | null,
    validateOnlyPreflight: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight | null,
  ): AdsAutomationApprovalEvidenceReviewExportResponse {
    const demoFixtureUsed = exportMode === 'local_demo_fixture';
    const approvalId = evidenceIndex.query.approval_id;
    const validateOnlyPreflightReview = this.validateOnlyPreflightReview(validateOnlyPreflight);
    const totalEvidenceRecords = evidenceIndex.summary.validateOnly_evidence_records_matched
      + evidenceIndex.summary.policy_decision_records_matched
      + evidenceIndex.summary.execution_preflight_records_matched
      + evidenceIndex.summary.source_sync_decision_evidence_records_matched
      + validateOnlyPreflightReview.candidate_count;
    const hasReviewEvidence = totalEvidenceRecords > 0
      || evidenceIndex.summary.pending_approval_record_matched;
    const reviewRoute = `/ai/ads-automation/decision-draft-approvals/${encodeURIComponent(approvalId)}/evidence-index/reviewer-export`;

    return {
      schemaVersion: 'ads_automation_approval_evidence_review_export.v1',
      generatedAt: new Date().toISOString(),
      exportMode,
      query: {
        approval_id: approvalId,
        ...(fixture ? { fixture: fixture.scenario } : {}),
      },
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        in_memory_only: demoFixtureUsed,
        persistence_used: demoFixtureUsed ? false : evidenceIndex.safety.persistence_used,
        durable_storage_used: demoFixtureUsed ? false : evidenceIndex.safety.durable_storage_used,
        erp_local_persistence_used: demoFixtureUsed ? false : evidenceIndex.safety.erp_local_persistence_used,
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
        demo_fixture_used: demoFixtureUsed,
        demo_fixture_persistence_performed: false,
      },
      summary: {
        export_status: hasReviewEvidence ? 'ready_for_review' : 'empty',
        export_mode: exportMode,
        evidence_index_readback_status: evidenceIndex.summary.readback_status,
        approval_id_filter_applied: true,
        total_evidence_records_included: totalEvidenceRecords,
        validateOnly_evidence_records_included: evidenceIndex.summary.validateOnly_evidence_records_matched,
        policy_decision_records_included: evidenceIndex.summary.policy_decision_records_matched,
        execution_preflight_records_included: evidenceIndex.summary.execution_preflight_records_matched,
        pending_approval_record_included: evidenceIndex.summary.pending_approval_record_matched,
        pending_action_review_evidence_records_included: evidenceIndex.summary.pending_action_review_evidence_records_matched,
        source_sync_decision_evidence_records_included: evidenceIndex.summary.source_sync_decision_evidence_records_matched,
        source_sync_decision_blocked_sources: evidenceIndex.summary.source_sync_decision_blocked_sources,
        source_sync_gate_status: evidenceIndex.summary.source_sync_gate_status,
        source_sync_can_generate_action_draft: evidenceIndex.summary.source_sync_can_generate_action_draft,
        source_sync_can_recommend_ads_scale: evidenceIndex.summary.source_sync_can_recommend_ads_scale,
        source_sync_can_use_google_ads_data_claim: evidenceIndex.summary.source_sync_can_use_google_ads_data_claim,
        source_sync_blocking_reasons: evidenceIndex.summary.source_sync_blocking_reasons,
        provider_account_readiness_status: evidenceIndex.summary.provider_account_readiness_status,
        provider_account_readiness_blocked_actions: evidenceIndex.summary.provider_account_readiness_blocked_actions,
        provider_account_readiness_blocking_reasons: evidenceIndex.summary.provider_account_readiness_blocking_reasons,
        provider_account_readiness_campaignBudgetId_no_fallback: evidenceIndex.summary.provider_account_readiness_campaignBudgetId_no_fallback,
        provider_account_readiness_scale_up_execution_mode: evidenceIndex.summary.provider_account_readiness_scale_up_execution_mode,
        validateOnly_preflight_source_status: validateOnlyPreflightReview.status,
        validateOnly_preflight_candidates_included: validateOnlyPreflightReview.candidate_count,
        validateOnly_preflight_blocked_candidates: validateOnlyPreflightReview.blocked_candidate_count,
        validateOnly_preflight_campaignBudgetId_blockers: this.countPreflightGroupCandidates(
          validateOnlyPreflightReview,
          'campaignBudgetId',
        ),
        validateOnly_preflight_source_freshness_blockers: this.countPreflightGroupCandidates(
          validateOnlyPreflightReview,
          'source_freshness',
        ),
        validateOnly_preflight_product_mapping_blockers: this.countPreflightGroupCandidates(
          validateOnlyPreflightReview,
          'product_mapping',
        ),
        validateOnly_preflight_inventory_profit_blockers: this.countPreflightGroupCandidates(
          validateOnlyPreflightReview,
          'inventory_profit',
        ),
        validateOnly_preflight_supplier_safety_blockers: this.countPreflightGroupCandidates(
          validateOnlyPreflightReview,
          'supplier_safety',
        ),
        validateOnly_preflight_read_model_blockers: this.countPreflightGroupCandidates(
          validateOnlyPreflightReview,
          'read_model',
        ),
        validateOnly_preflight_safety_flags_closed: this.preflightSafetyFlagsClosed(
          validateOnlyPreflightReview,
        ),
        linked_validateOnly_evidence_records: evidenceIndex.summary.linked_validateOnly_evidence_records,
        linked_policy_decision_records: evidenceIndex.summary.linked_policy_decision_records,
        unlinked_validateOnly_validation_ids: evidenceIndex.summary.unlinked_validateOnly_validation_ids,
        unlinked_policy_decision_ids: evidenceIndex.summary.unlinked_policy_decision_ids,
        approval_required: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        live_path_implemented: false,
        reviewer_export_persistence_performed: false,
        demo_fixture_persistence_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        next_required_action: totalEvidenceRecords
          ? 'inspect_reviewer_export'
          : 'verify_approval_id_or_generate_preflight_evidence',
      },
      fixture,
      reviewerGuide: {
        review_route: reviewRoute,
        demo_fixture_route: `${reviewRoute}?fixture=linked_budget_update_evidence`,
        sample_curl: `curl -H "Authorization: Bearer <redacted>" "${reviewRoute}"`,
        checklist: [
          'Confirm query.approval_id matches the approval under review.',
          'Inspect validateOnlyPreflightReview candidates before any future validate-only executor exists.',
          'Inspect pending approval source-sync evidence and gates before any future approval decision.',
          'Inspect summary counts and link arrays before any future approval decision.',
          'Verify execution_allowed_now, provider_api_called, google_ads_api_called, validateOnly_called, and live_ads_execution_used remain false.',
          'Use the fixture query only for local reviewer demos.',
        ],
      },
      validateOnlyPreflightReview,
      evidenceIndex,
    };
  }

  private validateOnlyPreflightReview(
    preflight: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight | null,
  ): AdsAutomationApprovalEvidenceValidateOnlyPreflightReview {
    if (!preflight) {
      return {
        status: 'not_available',
        source: 'not_available',
        pending_action_candidate_status: 'not_available',
        candidate_count: 0,
        pending_action_count: 0,
        blocked_candidate_count: 0,
        blocked_source_keys: [],
        blockers: [],
        blockerGroups: this.emptyBlockerGroups(),
        candidates: [],
        closedSafetyFlags: this.closedSafetyFlags(),
        next_required_action: 'generate_validate_only_preflight_evidence',
      };
    }

    const candidates = preflight.candidates.map((candidate) =>
      this.validateOnlyPreflightReviewCandidate(candidate),
    );

    return {
      status: preflight.status,
      source: preflight.source,
      pending_action_candidate_status: preflight.pending_action_candidate_status,
      candidate_count: preflight.candidate_count,
      pending_action_count: preflight.pending_action_count,
      blocked_candidate_count: preflight.blocked_candidate_count,
      blocked_source_keys: [...preflight.blocked_source_keys],
      blockers: [...preflight.blockers],
      blockerGroups: this.mergeBlockerGroups(candidates.map((candidate) => candidate.blockerGroups)),
      candidates,
      closedSafetyFlags: this.closedSafetyFlags(),
      next_required_action: preflight.blocked_candidate_count > 0
        ? 'inspect_blocked_validate_only_preflight_candidates'
        : 'continue_human_approval_flow',
    };
  }

  private validateOnlyPreflightReviewCandidate(
    candidate: AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate,
  ): AdsAutomationApprovalEvidenceValidateOnlyPreflightReviewCandidate {
    const sourceReadiness = candidate.source_freshness.map((source) => ({
      sourceKey: source.sourceKey,
      freshnessStatus: source.freshnessStatus,
      coverageStatus: source.coverageStatus,
      canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
      blockingReasons: [...source.blockingReasons],
    }));
    const blockerGroups = this.preflightBlockerGroups(
      candidate,
      sourceReadiness,
    );

    return {
      candidate_id: candidate.candidate_id,
      draft_id: candidate.draft_id,
      pending_action_id: candidate.pending_action_id,
      approval_id: candidate.approval_id,
      action_type: candidate.action_type,
      candidate_status: candidate.candidate_status,
      provider_validateOnly_readiness: candidate.provider_validateOnly_readiness,
      validateOnly_plan_status: candidate.validateOnly_plan_status,
      validateOnly_request_status: candidate.validateOnly_request_status,
      customerId: candidate.customerId,
      campaignId: candidate.campaignId,
      adGroupId: candidate.adGroupId,
      campaignBudgetId: candidate.campaignBudgetId,
      campaignBudgetResourceName: candidate.campaignBudgetResourceName,
      productId: candidate.productId,
      supplierId: candidate.supplierId,
      campaignBudgetId_missing_no_fallback: blockerGroups.campaignBudgetId.length > 0,
      blocked_source_keys: [...candidate.blocked_source_keys],
      blockers: [...candidate.blockers],
      read_model_blockers: [...candidate.read_model_blockers],
      blockerGroups,
      sourceReadiness,
      closedSafetyFlags: this.closedSafetyFlags(),
    };
  }

  private preflightBlockerGroups(
    candidate: AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate,
    sourceReadiness: AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness[],
  ): AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups {
    const blockers = candidate.blockers || [];

    return {
      campaignBudgetId: this.uniqueText([
        ...blockers.filter((blocker) => blocker.includes('campaignBudgetId')),
        ...(!candidate.campaignBudgetId ? ['campaignBudgetId_missing_no_fallback'] : []),
      ]),
      source_freshness: this.sourceReadinessBlockers(
        sourceReadiness,
        (source) => source.freshnessStatus !== null && source.freshnessStatus !== 'fresh',
      ),
      product_mapping: this.namedSourceBlockers(
        sourceReadiness,
        blockers,
        'product_mapping',
      ),
      inventory_profit: this.namedSourceBlockers(
        sourceReadiness,
        blockers,
        'inventory_profit',
      ),
      supplier_safety: this.namedSourceBlockers(
        sourceReadiness,
        blockers,
        'supplier_safety',
      ),
      read_model: this.uniqueText(candidate.read_model_blockers || []),
    };
  }

  private sourceReadinessBlockers(
    sourceReadiness: AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness[],
    predicate: (source: AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness) => boolean,
  ): string[] {
    return this.uniqueText(sourceReadiness.flatMap((source) => (
      predicate(source)
        ? [
            `${source.sourceKey}:${source.freshnessStatus || source.coverageStatus || 'blocked'}`,
            ...source.blockingReasons,
          ]
        : []
    )));
  }

  private namedSourceBlockers(
    sourceReadiness: AdsAutomationApprovalEvidenceValidateOnlyPreflightSourceReadiness[],
    blockers: string[],
    sourceKey: 'product_mapping' | 'inventory_profit' | 'supplier_safety',
  ): string[] {
    const source = sourceReadiness.find((item) => item.sourceKey === sourceKey);
    return this.uniqueText([
      ...blockers.filter((blocker) => blocker.includes(sourceKey)),
      ...(source && source.canUseForAdsAutomationDecision !== true
        ? [
            `${sourceKey}:${source.coverageStatus || source.freshnessStatus || 'blocked'}`,
            ...source.blockingReasons,
          ]
        : []),
    ]);
  }

  private mergeBlockerGroups(
    groups: AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups[],
  ): AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups {
    return {
      campaignBudgetId: this.uniqueText(groups.flatMap((group) => group.campaignBudgetId)),
      source_freshness: this.uniqueText(groups.flatMap((group) => group.source_freshness)),
      product_mapping: this.uniqueText(groups.flatMap((group) => group.product_mapping)),
      inventory_profit: this.uniqueText(groups.flatMap((group) => group.inventory_profit)),
      supplier_safety: this.uniqueText(groups.flatMap((group) => group.supplier_safety)),
      read_model: this.uniqueText(groups.flatMap((group) => group.read_model)),
    };
  }

  private emptyBlockerGroups(): AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups {
    return {
      campaignBudgetId: [],
      source_freshness: [],
      product_mapping: [],
      inventory_profit: [],
      supplier_safety: [],
      read_model: [],
    };
  }

  private countPreflightGroupCandidates(
    review: AdsAutomationApprovalEvidenceValidateOnlyPreflightReview,
    group: keyof AdsAutomationApprovalEvidenceValidateOnlyPreflightBlockerGroups,
  ): number {
    return review.candidates.filter((candidate) =>
      candidate.blockerGroups[group].length > 0,
    ).length;
  }

  private preflightSafetyFlagsClosed(
    review: AdsAutomationApprovalEvidenceValidateOnlyPreflightReview,
  ): boolean {
    return review.candidates.every((candidate) => (
      candidate.closedSafetyFlags.campaignBudgetId_fallback_used === false
      && candidate.closedSafetyFlags.provider_api_called === false
      && candidate.closedSafetyFlags.google_ads_api_called === false
      && candidate.closedSafetyFlags.validateOnly_called === false
      && candidate.closedSafetyFlags.live_ads_execution_used === false
      && candidate.closedSafetyFlags.execution_allowed_now === false
    ));
  }

  private closedSafetyFlags(): AdsAutomationApprovalEvidenceValidateOnlyPreflightClosedSafetyFlags {
    return {
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    };
  }

  private fixtureScenario(
    value: string | null | undefined,
  ): AdsAutomationApprovalEvidenceReviewFixtureScenario | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    const scenario = FIXTURE_ALIASES[normalized];
    if (!scenario) {
      throw new BadRequestException('fixture must be linked_budget_update_evidence, scale_recommendation_gate_blocker_evidence, pause_ad_group_blocker_evidence, supplier_product_stop_import_review_blocker_evidence, google_ads_mock_validate_only_preflight_blockers, or empty_approval_evidence');
    }
    return scenario;
  }

  private requiredText(value: unknown, field: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }

  private uniqueText(values: unknown[]): string[] {
    return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
  }
}
