import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationApprovalEvidenceIndexResponse,
} from './contracts/ads-automation-approval-evidence-index.contract';
import type {
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type {
  AdsAutomationPolicyDecisionEvidenceRecord,
} from './contracts/ads-automation-policy-decision-evidence.contract';
import type {
  AdsAutomationSmallCapApprovalPreflightCandidateLink,
  AdsAutomationSmallCapApprovalPreflightCandidateLinkStatus,
  AdsAutomationSmallCapApprovalPreflightLinkageInput,
  AdsAutomationSmallCapApprovalPreflightLinkageResponse,
  AdsAutomationSmallCapApprovalPreflightLinkageStatus,
} from './contracts/ads-automation-small-cap-approval-preflight-linkage.contract';
import type {
  AdsAutomationSmallCapBudgetCandidate,
} from './contracts/ads-automation-small-cap-readiness-simulator.contract';
import type {
  AdsAutomationValidateOnlyEvidenceRecord,
} from './contracts/ads-automation-validate-only-evidence.contract';

@Injectable()
export class AdsAutomationSmallCapApprovalPreflightLinkageService {
  build(
    input: AdsAutomationSmallCapApprovalPreflightLinkageInput,
  ): AdsAutomationSmallCapApprovalPreflightLinkageResponse {
    this.assertPayload(input);

    const simulator = input.simulatorResponse;
    const approvalEvidenceIndexes = input.approvalEvidenceIndexes || [];
    const reportDate = this.isoDate(
      input.reportDate || simulator.reportDate,
      'reportDate',
    );
    const generatedAt = (input.now
      ? this.dateTime(input.now, 'now')
      : new Date()).toISOString();
    const matchedIndexes = new Set<number>();
    const candidateLinks = simulator.budgetCandidates.map((candidate) => {
      const match = this.matchEvidenceIndex(candidate, approvalEvidenceIndexes);
      if (match) matchedIndexes.add(match.index);
      return this.candidateLink(candidate, match?.evidenceIndex || null);
    });
    const unlinkedApprovalEvidenceIndexes = approvalEvidenceIndexes
      .filter((_, index) => !matchedIndexes.has(index));
    const fullyLinkedCandidates = candidateLinks
      .filter((link) => link.status === 'linked_blocked_before_execution').length;
    const mismatchCandidates = candidateLinks
      .filter((link) => link.status === 'linked_campaignBudgetId_mismatch').length;
    const missingEvidenceCandidates = candidateLinks.length - fullyLinkedCandidates - mismatchCandidates;
    const status = this.overallStatus({
      candidateCount: candidateLinks.length,
      fullyLinkedCandidates,
      mismatchCandidates,
      missingEvidenceCandidates,
    });
    const blockers = this.uniqueText(candidateLinks.flatMap((link) => link.blockers));

    return {
      schemaVersion: 'ads_automation_small_cap_approval_preflight_linkage.v1',
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
        approval_evidence_readback_reused: true,
        validateOnly_evidence_readback_reused: true,
        policy_decision_evidence_readback_reused: true,
        execution_preflight_readback_reused: true,
        linkage_persistence_performed: false,
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
        simulator_status: simulator.summary.status,
        small_cap_candidates: candidateLinks.length,
        approval_evidence_indexes_received: approvalEvidenceIndexes.length,
        candidates_with_approval_link: candidateLinks
          .filter((link) => Boolean(link.approval_id)).length,
        candidates_with_validateOnly_evidence: candidateLinks
          .filter((link) => link.evidenceCounts.validateOnly_evidence_records > 0).length,
        candidates_with_policy_evidence: candidateLinks
          .filter((link) => link.evidenceCounts.policy_decision_records > 0).length,
        candidates_with_preflight_evidence: candidateLinks
          .filter((link) => link.evidenceCounts.execution_preflight_records > 0).length,
        fully_linked_candidates: fullyLinkedCandidates,
        missing_evidence_candidates: missingEvidenceCandidates,
        campaignBudgetId_mismatch_candidates: mismatchCandidates,
        requested_increase_vnd: this.sum(candidateLinks.map((link) => link.requestedIncreaseVnd)),
        simulated_capped_increase_vnd: this.sum(candidateLinks.map((link) => link.simulatedCappedIncreaseVnd)),
        approved_increase_vnd: 0,
        blocked_increase_vnd: this.sum(candidateLinks.map((link) => link.blockedIncreaseVnd)),
        executable_now: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: status === 'linked_blocked_before_execution'
          ? 'review_linked_small_cap_dry_run_packet'
          : status === 'blocked_campaignBudgetId_mismatch'
            ? 'resolve_campaignBudgetId_linkage_before_preflight'
            : 'attach_missing_approval_validateOnly_policy_preflight_evidence',
      },
      sourceDigest: {
        simulator_schema_version: simulator.schemaVersion,
        approval_evidence_index_schema_versions: this.uniqueText(
          approvalEvidenceIndexes.map((index) => index.schemaVersion),
        ),
        simulator_generated_at: simulator.generatedAt,
        simulator_report_date: simulator.reportDate,
        approval_ids: this.approvalIds(approvalEvidenceIndexes),
        validateOnly_validation_ids: this.validateOnlyValidationIds(approvalEvidenceIndexes),
        policy_decision_ids: this.policyDecisionIds(approvalEvidenceIndexes),
        execution_record_ids: this.executionRecordIds(approvalEvidenceIndexes),
        decision_snapshot_reused: simulator.sourceDigest.decision_snapshot_reused,
        draft_preview_reused: simulator.sourceDigest.draft_preview_reused,
        approval_evidence_index_reused: true,
        validateOnly_evidence_readback_reused: true,
        policy_decision_evidence_readback_reused: true,
        execution_preflight_readback_reused: true,
      },
      candidateLinks,
      unlinkedApprovalEvidenceIndexes,
      blockers,
      markdownPreview: this.markdownPreview({
        reportDate,
        status,
        candidateLinks,
        blockers,
      }),
    };
  }

  private candidateLink(
    candidate: AdsAutomationSmallCapBudgetCandidate,
    evidenceIndex: AdsAutomationApprovalEvidenceIndexResponse | null,
  ): AdsAutomationSmallCapApprovalPreflightCandidateLink {
    const pendingApproval = evidenceIndex
      ? this.pendingApproval(evidenceIndex)
      : null;
    const validateOnlyEvidenceRecords = evidenceIndex?.validateOnlyEvidenceRecords || [];
    const policyDecisionEvidenceRecords = evidenceIndex?.policyDecisionEvidenceRecords || [];
    const executionPreflightDryRunRecords = evidenceIndex?.executionPreflightDryRunRecords || [];
    const approvalCampaignBudgetId = this.text(pendingApproval?.typedPayload?.campaignBudgetId);
    const campaignBudgetIdMatched = Boolean(
      candidate.campaignBudgetId
      && approvalCampaignBudgetId
      && candidate.campaignBudgetId === approvalCampaignBudgetId,
    );
    const evidenceCounts = {
      validateOnly_evidence_records: validateOnlyEvidenceRecords.length,
      policy_decision_records: policyDecisionEvidenceRecords.length,
      execution_preflight_records: executionPreflightDryRunRecords.length,
      linked_validateOnly_ids: this.uniqueText(
        validateOnlyEvidenceRecords.map((record) => record.validation_id),
      ),
      linked_policy_decision_ids: this.uniqueText(
        policyDecisionEvidenceRecords.map((record) => record.policy_decision_id),
      ),
      linked_execution_record_ids: this.uniqueText(
        executionPreflightDryRunRecords.map((record) => record.execution_record_id),
      ),
    };
    const status = this.candidateLinkStatus({
      pendingApproval,
      campaignBudgetIdMatched,
      validateOnlyEvidenceRecords,
      policyDecisionEvidenceRecords,
      executionPreflightDryRunRecords,
    });
    const blockers = this.candidateBlockers({
      candidate,
      pendingApproval,
      campaignBudgetIdMatched,
      validateOnlyEvidenceRecords,
      policyDecisionEvidenceRecords,
      executionPreflightDryRunRecords,
      status,
    });

    return {
      candidateKey: [
        candidate.draft_id,
        candidate.source_decision_id,
        candidate.campaignBudgetId || 'missing-campaignBudgetId',
      ].join(':'),
      draft_id: candidate.draft_id,
      source_decision_id: candidate.source_decision_id,
      approval_id: pendingApproval?.approval_id || null,
      status,
      approval_status: pendingApproval?.status || null,
      action_type: pendingApproval?.action_type || null,
      action_family: pendingApproval?.action_family || null,
      provider: pendingApproval?.provider || null,
      accountId: candidate.accountId,
      campaignId: candidate.campaignId,
      adGroupId: candidate.adGroupId,
      campaignBudgetId: candidate.campaignBudgetId,
      approvalCampaignBudgetId,
      campaignBudgetIdMatched,
      campaignBudgetIdNoFallback: true,
      requestedIncreaseVnd: candidate.requestedIncreaseVnd,
      simulatedCappedIncreaseVnd: candidate.simulatedCappedIncreaseVnd,
      approvedIncreaseVnd: 0,
      blockedIncreaseVnd: candidate.blockedIncreaseVnd,
      validateOnly_statuses: this.uniqueText(
        validateOnlyEvidenceRecords.map((record) => record.status),
      ),
      policy_allowed: policyDecisionEvidenceRecords.length
        ? policyDecisionEvidenceRecords.some((record) => (
          record.policy_allowed === true && !record.blockers.length
        ))
        : null,
      preflight_statuses: this.uniqueText(
        executionPreflightDryRunRecords.map((record) => record.preflight_status),
      ),
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      evidenceCounts,
      blockers,
      next_required_action: this.candidateNextAction(status),
      simulatorCandidate: this.cloneJson(candidate),
      pendingApproval: pendingApproval ? this.cloneJson(pendingApproval) : null,
      validateOnlyEvidenceRecords: this.cloneJson(validateOnlyEvidenceRecords),
      policyDecisionEvidenceRecords: this.cloneJson(policyDecisionEvidenceRecords),
      executionPreflightDryRunRecords: this.cloneJson(executionPreflightDryRunRecords),
    };
  }

  private candidateLinkStatus(input: {
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null;
    campaignBudgetIdMatched: boolean;
    validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[];
    policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[];
    executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[];
  }): AdsAutomationSmallCapApprovalPreflightCandidateLinkStatus {
    if (!input.pendingApproval) return 'not_linked_to_approval_evidence';
    if (!input.campaignBudgetIdMatched) return 'linked_campaignBudgetId_mismatch';
    if (!input.validateOnlyEvidenceRecords.length) return 'linked_missing_validateOnly_evidence';
    if (!input.policyDecisionEvidenceRecords.length) return 'linked_missing_policy_evidence';
    if (!input.executionPreflightDryRunRecords.length) return 'linked_missing_preflight_evidence';
    return 'linked_blocked_before_execution';
  }

  private candidateBlockers(input: {
    candidate: AdsAutomationSmallCapBudgetCandidate;
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null;
    campaignBudgetIdMatched: boolean;
    validateOnlyEvidenceRecords: AdsAutomationValidateOnlyEvidenceRecord[];
    policyDecisionEvidenceRecords: AdsAutomationPolicyDecisionEvidenceRecord[];
    executionPreflightDryRunRecords: AdsAutomationExecutionPreflightDryRunRecord[];
    status: AdsAutomationSmallCapApprovalPreflightCandidateLinkStatus;
  }): string[] {
    return this.uniqueText([
      ...input.candidate.blockers,
      ...(!input.pendingApproval ? ['pending_approval_evidence_missing'] : []),
      ...(input.pendingApproval && input.pendingApproval.action_type !== 'update_campaign_budget'
        ? ['approval_action_type_not_update_campaign_budget']
        : []),
      ...(input.pendingApproval && input.pendingApproval.execution_allowed_now !== false
        ? ['approval.execution_allowed_now_not_false']
        : []),
      ...(!input.campaignBudgetIdMatched ? ['campaignBudgetId_linkage_missing_or_mismatch'] : []),
      ...(input.validateOnlyEvidenceRecords.length
        ? []
        : ['validateOnly_evidence_missing_for_approval']),
      ...(input.policyDecisionEvidenceRecords.length
        ? []
        : ['policy_decision_evidence_missing_for_approval']),
      ...(input.executionPreflightDryRunRecords.length
        ? []
        : ['execution_preflight_readback_missing_for_approval']),
      ...this.validateOnlySafetyBlockers(input.validateOnlyEvidenceRecords),
      ...this.policySafetyBlockers(input.policyDecisionEvidenceRecords),
      ...this.preflightSafetyBlockers(input.executionPreflightDryRunRecords),
      ...(input.status === 'linked_blocked_before_execution'
        ? ['future_live_execution_allowed_false', 'execution_allowed_now_false']
        : []),
      ...input.executionPreflightDryRunRecords.flatMap((record) =>
        (record.blockers || []).map((blocker) => `preflight.${blocker}`)),
    ]);
  }

  private matchEvidenceIndex(
    candidate: AdsAutomationSmallCapBudgetCandidate,
    evidenceIndexes: AdsAutomationApprovalEvidenceIndexResponse[],
  ): { evidenceIndex: AdsAutomationApprovalEvidenceIndexResponse; index: number } | null {
    for (const [index, evidenceIndex] of evidenceIndexes.entries()) {
      const pendingApproval = this.pendingApproval(evidenceIndex);
      if (this.approvalMatchesCandidate(pendingApproval, candidate)) {
        return { evidenceIndex, index };
      }
    }
    return null;
  }

  private approvalMatchesCandidate(
    pendingApproval: AdsAutomationDecisionDraftPendingApprovalRecord | null,
    candidate: AdsAutomationSmallCapBudgetCandidate,
  ): boolean {
    if (!pendingApproval) return false;
    if (pendingApproval.source_draft_id === candidate.draft_id) return true;
    if (pendingApproval.source_decision_id === candidate.source_decision_id) return true;

    const payload = pendingApproval.typedPayload || {};
    const approvalCampaignBudgetId = this.text(payload.campaignBudgetId);
    return Boolean(
      candidate.campaignBudgetId
      && approvalCampaignBudgetId === candidate.campaignBudgetId
      && (!candidate.adGroupId || this.text(payload.adGroupId) === candidate.adGroupId),
    );
  }

  private pendingApproval(
    evidenceIndex: AdsAutomationApprovalEvidenceIndexResponse,
  ): AdsAutomationDecisionDraftPendingApprovalRecord | null {
    if (evidenceIndex.pendingApproval) return evidenceIndex.pendingApproval;

    return evidenceIndex.executionPreflightDryRunRecords
      .map((record) => record.source_pending_approval)
      .find((record): record is AdsAutomationDecisionDraftPendingApprovalRecord => Boolean(record))
      || null;
  }

  private overallStatus(input: {
    candidateCount: number;
    fullyLinkedCandidates: number;
    mismatchCandidates: number;
    missingEvidenceCandidates: number;
  }): AdsAutomationSmallCapApprovalPreflightLinkageStatus {
    if (!input.candidateCount) return 'blocked_no_small_cap_candidate';
    if (input.mismatchCandidates) return 'blocked_campaignBudgetId_mismatch';
    if (input.missingEvidenceCandidates || !input.fullyLinkedCandidates) {
      return 'blocked_missing_evidence';
    }
    return 'linked_blocked_before_execution';
  }

  private candidateNextAction(
    status: AdsAutomationSmallCapApprovalPreflightCandidateLinkStatus,
  ): AdsAutomationSmallCapApprovalPreflightCandidateLink['next_required_action'] {
    if (status === 'linked_blocked_before_execution') {
      return 'review_linked_preflight_packet';
    }
    if (status === 'linked_campaignBudgetId_mismatch') {
      return 'resolve_campaignBudgetId_linkage';
    }
    if (status === 'not_linked_to_approval_evidence') {
      return 'link_pending_approval_to_simulator_candidate';
    }
    return 'attach_missing_validateOnly_policy_or_preflight_evidence';
  }

  private validateOnlySafetyBlockers(
    records: AdsAutomationValidateOnlyEvidenceRecord[],
  ): string[] {
    return records.flatMap((record) => [
      ...(record.provider_api_called === false ? [] : ['validateOnly.provider_api_called']),
      ...(record.google_ads_api_called === false ? [] : ['validateOnly.google_ads_api_called']),
      ...(record.validateOnly_called === false ? [] : ['validateOnly.validateOnly_called']),
      ...(record.live_ads_execution_used === false ? [] : ['validateOnly.live_ads_execution_used']),
      ...(record.execution_allowed_now === false ? [] : ['validateOnly.execution_allowed_now_not_false']),
    ]);
  }

  private policySafetyBlockers(
    records: AdsAutomationPolicyDecisionEvidenceRecord[],
  ): string[] {
    return records.flatMap((record) => [
      ...(record.provider_api_called === false ? [] : ['policy.provider_api_called']),
      ...(record.google_ads_api_called === false ? [] : ['policy.google_ads_api_called']),
      ...(record.validateOnly_called === false ? [] : ['policy.validateOnly_called']),
      ...(record.live_ads_execution_used === false ? [] : ['policy.live_ads_execution_used']),
      ...(record.execution_allowed_now === false ? [] : ['policy.execution_allowed_now_not_false']),
      ...((record.blockers || []).map((blocker) => `policy.${blocker}`)),
    ]);
  }

  private preflightSafetyBlockers(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
  ): string[] {
    return records.flatMap((record) => [
      ...(record.provider_api_called === false ? [] : ['preflight.provider_api_called']),
      ...(record.google_ads_api_called === false ? [] : ['preflight.google_ads_api_called']),
      ...(record.validateOnly_called === false ? [] : ['preflight.validateOnly_called']),
      ...(record.live_ads_execution_used === false ? [] : ['preflight.live_ads_execution_used']),
      ...(record.execution_allowed_now === false ? [] : ['preflight.execution_allowed_now_not_false']),
      ...(record.future_live_execution_allowed === false ? [] : ['preflight.future_live_execution_allowed_not_false']),
      ...(record.campaignBudgetId_fallback_used === false ? [] : ['preflight.campaignBudgetId_fallback_used']),
    ]);
  }

  private markdownPreview(input: {
    reportDate: string;
    status: AdsAutomationSmallCapApprovalPreflightLinkageStatus;
    candidateLinks: AdsAutomationSmallCapApprovalPreflightCandidateLink[];
    blockers: string[];
  }): string {
    return [
      '# Ads Automation Small-cap Approval Preflight Linkage',
      `Report date: ${input.reportDate}`,
      `Status: ${input.status}`,
      `Small-cap candidates: ${input.candidateLinks.length}`,
      `Fully linked candidates: ${input.candidateLinks.filter((link) => link.status === 'linked_blocked_before_execution').length}`,
      `Approval links: ${input.candidateLinks.filter((link) => Boolean(link.approval_id)).length}`,
      `ValidateOnly evidence links: ${input.candidateLinks.filter((link) => link.evidenceCounts.validateOnly_evidence_records > 0).length}`,
      `Policy evidence links: ${input.candidateLinks.filter((link) => link.evidenceCounts.policy_decision_records > 0).length}`,
      `Preflight evidence links: ${input.candidateLinks.filter((link) => link.evidenceCounts.execution_preflight_records > 0).length}`,
      `Blockers: ${this.joinOrNone(input.blockers)}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
      'Live execution remains blocked even when all local evidence is linked.',
    ].join('\n');
  }

  private assertPayload(input: AdsAutomationSmallCapApprovalPreflightLinkageInput): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('small-cap approval/preflight linkage payload is required');
    }
    if (
      !input.simulatorResponse
      || input.simulatorResponse.schemaVersion !== 'ads_automation_small_cap_readiness_simulator.v1'
      || !Array.isArray(input.simulatorResponse.budgetCandidates)
    ) {
      throw new BadRequestException('simulatorResponse must be ads_automation_small_cap_readiness_simulator.v1');
    }
    if (
      input.approvalEvidenceIndexes !== undefined
      && !Array.isArray(input.approvalEvidenceIndexes)
    ) {
      throw new BadRequestException('approvalEvidenceIndexes must be an array');
    }
    for (const evidenceIndex of input.approvalEvidenceIndexes || []) {
      if (
        !evidenceIndex
        || evidenceIndex.schemaVersion !== 'ads_automation_approval_evidence_index.v1'
      ) {
        throw new BadRequestException('approvalEvidenceIndexes entries must be ads_automation_approval_evidence_index.v1');
      }
    }
  }

  private approvalIds(indexes: AdsAutomationApprovalEvidenceIndexResponse[]): string[] {
    return this.uniqueText(indexes.flatMap((index) => [
      index.query.approval_id,
      index.pendingApproval?.approval_id,
      ...index.executionPreflightDryRunRecords.map((record) => record.approval_id),
    ]));
  }

  private validateOnlyValidationIds(indexes: AdsAutomationApprovalEvidenceIndexResponse[]): string[] {
    return this.uniqueText(indexes.flatMap((index) => [
      ...index.validateOnlyEvidenceRecords.map((record) => record.validation_id),
      ...index.executionPreflightDryRunRecords.map((record) => record.validateOnly_validation_id),
    ]));
  }

  private policyDecisionIds(indexes: AdsAutomationApprovalEvidenceIndexResponse[]): string[] {
    return this.uniqueText(indexes.flatMap((index) => [
      ...index.policyDecisionEvidenceRecords.map((record) => record.policy_decision_id),
      ...index.executionPreflightDryRunRecords.map((record) => record.policy_decision_id),
    ]));
  }

  private executionRecordIds(indexes: AdsAutomationApprovalEvidenceIndexResponse[]): string[] {
    return this.uniqueText(indexes.flatMap((index) =>
      index.executionPreflightDryRunRecords.map((record) => record.execution_record_id)));
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

  private uniqueText(values: unknown[]): string[] {
    return [...new Set(values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value)))]
      .sort();
  }

  private text(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  private joinOrNone(values: string[]): string {
    return values.length ? values.join(', ') : 'none';
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
