import { BadRequestException, Injectable } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from './ads-automation-decision-draft-approval-decision-audit.repository';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import { AdsAutomationDecisionDraftApprovalQueueService } from './ads-automation-decision-draft-approval-queue.service';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAction,
  AdsAutomationDecisionDraftApprovalDecisionMutationResponse,
  AdsAutomationDecisionDraftApprovalDecisionValidationInput,
  AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
} from './contracts/ads-automation-decision-draft-approval.contract';

@Injectable()
export class AdsAutomationDecisionDraftApprovalDecisionMutationService {
  constructor(
    private readonly queueService: AdsAutomationDecisionDraftApprovalQueueService,
    private readonly approvalRepository: AdsAutomationDecisionDraftApprovalRepository,
    private readonly auditRepository: AdsAutomationDecisionDraftApprovalDecisionAuditRepository,
  ) {}

  async decidePendingApproval(
    approvalId: string,
    input: AdsAutomationDecisionDraftApprovalDecisionValidationInput = {},
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionMutationResponse> {
    const auditPreview = await this.queueService.previewPendingApprovalDecisionAuditRecord(approvalId, input);
    const decision = auditPreview.proposedDecision.decision;
    if (decision !== 'approve' && decision !== 'reject') {
      throw new BadRequestException('decision must be approve or reject');
    }

    const statusChangePerformed = auditPreview.decisionValidation.summary.validation_status === 'eligible_for_human_decision';
    const finalStatus = this.finalStatus(decision);
    const auditRecord = statusChangePerformed
      ? await this.auditRepository.createFromDecision(auditPreview.auditRecordPreview, true)
      : await this.auditRepository.createFromPreview(auditPreview.auditRecordPreview);
    const approvalAfter = statusChangePerformed
      ? await this.approvalRepository.transitionPendingApprovalStatus(auditPreview.pendingApproval.approval_id, finalStatus)
      : null;

    if (statusChangePerformed && !approvalAfter) {
      throw new BadRequestException(`pending approval could not be transitioned: ${auditPreview.pendingApproval.approval_id}`);
    }

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_mutation.v1',
      generatedAt: new Date().toISOString(),
      safety: {
        read_only: false,
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        execution_allowed_now: false,
        audit_record_persisted: true,
        status_change_performed: statusChangePerformed,
        approval_status_mutation_used: statusChangePerformed,
        approved_record_executable: false,
        rejected_record_executable: false,
        duplicate_decision_rejected: true,
      },
      summary: {
        mutation_status: statusChangePerformed ? finalStatus : 'blocked',
        proposed_decision: decision,
        validation_status: auditPreview.decisionValidation.summary.validation_status,
        previous_status: 'pending_approval',
        resulting_status: statusChangePerformed ? finalStatus : null,
        approval_required: true,
        execution_allowed_now: false,
        audit_record_persisted: true,
        status_change_performed: statusChangePerformed,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        blockers_count: auditPreview.summary.blockers_count,
        next_required_action: statusChangePerformed
          ? decision === 'approve'
            ? 'future_validateOnly_before_execution'
            : 'decision_complete_no_execution'
          : 'fix_blockers_before_decision',
      },
      decisionValidation: auditPreview.decisionValidation,
      auditRecord,
      approvalBefore: auditPreview.pendingApproval,
      approvalAfter,
    };
  }

  private finalStatus(
    decision: AdsAutomationDecisionDraftApprovalDecisionAction,
  ): AdsAutomationDecisionDraftApprovalFinalDecisionStatus {
    return decision === 'approve' ? 'approved' : 'rejected';
  }
}
