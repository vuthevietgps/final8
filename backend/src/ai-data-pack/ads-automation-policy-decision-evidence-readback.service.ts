import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import type {
  AdsAutomationPolicyDecisionEvidenceHistoryResponse,
  AdsAutomationPolicyDecisionEvidenceReadbackResponse,
  AdsAutomationPolicyDecisionEvidenceReadbackSafety,
  AdsAutomationPolicyDecisionEvidenceRecord,
} from './contracts/ads-automation-policy-decision-evidence.contract';

@Injectable()
export class AdsAutomationPolicyDecisionEvidenceReadbackService {
  constructor(
    private readonly policyDecisionEvidenceRepository: AdsAutomationPolicyDecisionEvidenceRepository,
  ) {}

  async readByPolicyDecisionId(
    policyDecisionId: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceReadbackResponse> {
    const normalizedPolicyDecisionId = this.requiredText(policyDecisionId, 'policyDecisionId');
    const policyDecisionEvidence = await this.policyDecisionEvidenceRepository
      .findByPolicyDecisionId(normalizedPolicyDecisionId);

    if (!policyDecisionEvidence) {
      throw new NotFoundException(`policy decision evidence not found: ${normalizedPolicyDecisionId}`);
    }

    return {
      schemaVersion: 'ads_automation_execution_policy_decision_evidence_readback.v1',
      generatedAt: new Date().toISOString(),
      query: { policy_decision_id: normalizedPolicyDecisionId },
      safety: this.readbackSafety(),
      summary: this.summary('found', [policyDecisionEvidence], false, 'inspect_policy_decision_evidence'),
      policyDecisionEvidence,
    };
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceHistoryResponse> {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const policyDecisionEvidenceRecords = await this.policyDecisionEvidenceRepository
      .listByApprovalId(normalizedApprovalId);

    return {
      schemaVersion: 'ads_automation_execution_policy_decision_evidence_history.v1',
      generatedAt: new Date().toISOString(),
      query: { approval_id: normalizedApprovalId },
      safety: this.readbackSafety(),
      summary: this.summary(
        policyDecisionEvidenceRecords.length ? 'listed' : 'not_found',
        policyDecisionEvidenceRecords,
        true,
        policyDecisionEvidenceRecords.length
          ? 'inspect_approval_policy_decision_history'
          : 'verify_policy_decision_id',
      ),
      policyDecisionEvidenceRecords,
    };
  }

  private summary(
    readbackStatus: 'found' | 'not_found' | 'listed',
    records: AdsAutomationPolicyDecisionEvidenceRecord[],
    approvalIdFilterApplied: boolean,
    nextRequiredAction:
      | 'inspect_policy_decision_evidence'
      | 'inspect_approval_policy_decision_history'
      | 'verify_policy_decision_id',
  ) {
    return {
      readback_status: readbackStatus,
      policy_decision_records_matched: records.length,
      approval_id_filter_applied: approvalIdFilterApplied,
      approval_required: true,
      execution_allowed_now: false,
      policy_decision_evidence_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      next_required_action: nextRequiredAction,
    } as const;
  }

  private readbackSafety(): AdsAutomationPolicyDecisionEvidenceReadbackSafety {
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
      policy_decision_evidence_readback: true,
      policy_decision_evidence_persistence_performed: false,
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
