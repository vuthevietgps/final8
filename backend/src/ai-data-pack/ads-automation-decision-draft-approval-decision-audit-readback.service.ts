import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from './ads-automation-decision-draft-approval-decision-audit.repository';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSafety,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordHistoryResponse,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordReadbackResponse,
} from './contracts/ads-automation-decision-draft-approval.contract';

@Injectable()
export class AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService {
  constructor(
    private readonly auditRepository: AdsAutomationDecisionDraftApprovalDecisionAuditRepository,
  ) {}

  async readByAuditId(auditId: string): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecordReadbackResponse> {
    const normalizedAuditId = this.requiredText(auditId, 'auditId');
    const auditRecord = await this.auditRepository.findByAuditId(normalizedAuditId);

    if (!auditRecord) {
      throw new NotFoundException(`decision audit record not found: ${normalizedAuditId}`);
    }

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record_readback.v1',
      generatedAt: new Date().toISOString(),
      query: { audit_id: normalizedAuditId },
      safety: this.readbackSafety(),
      summary: this.summary('found', [auditRecord], false, 'future_human_review'),
      auditRecord,
    };
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecordHistoryResponse> {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const auditRecords = await this.auditRepository.listByApprovalId(normalizedApprovalId);

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record_history.v1',
      generatedAt: new Date().toISOString(),
      query: { approval_id: normalizedApprovalId },
      safety: this.readbackSafety(),
      summary: this.summary(
        auditRecords.length ? 'listed' : 'not_found',
        auditRecords,
        true,
        auditRecords.length ? 'inspect_approval_audit_history' : 'verify_audit_id',
      ),
      auditRecords,
    };
  }

  private summary(
    readbackStatus: 'found' | 'not_found' | 'listed',
    auditRecords: AdsAutomationDecisionDraftApprovalDecisionAuditRecord[],
    approvalIdFilterApplied: boolean,
    nextRequiredAction: 'future_human_review' | 'inspect_approval_audit_history' | 'verify_audit_id',
  ) {
    return {
      readback_status: readbackStatus,
      audit_records_matched: auditRecords.length,
      approval_id_filter_applied: approvalIdFilterApplied,
      approval_required: true,
      execution_allowed_now: false,
      status_change_performed: false,
      audit_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      next_required_action: nextRequiredAction,
    } as const;
  }

  private readbackSafety(): AdsAutomationDecisionDraftApprovalDecisionAuditReadbackSafety {
    return {
      read_only: true,
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
      audit_record_readback: true,
      status_change_performed: false,
      audit_persistence_performed: false,
      public_endpoint_added: false,
    };
  }

  private requiredText(value: unknown, field: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      throw new BadRequestException(`${field} is required`);
    }
    return normalized;
  }
}
