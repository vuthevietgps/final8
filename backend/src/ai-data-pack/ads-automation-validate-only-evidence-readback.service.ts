import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';
import type {
  AdsAutomationValidateOnlyEvidenceHistoryResponse,
  AdsAutomationValidateOnlyEvidenceReadbackResponse,
  AdsAutomationValidateOnlyEvidenceReadbackSafety,
  AdsAutomationValidateOnlyEvidenceRecord,
} from './contracts/ads-automation-validate-only-evidence.contract';

@Injectable()
export class AdsAutomationValidateOnlyEvidenceReadbackService {
  constructor(
    private readonly validateOnlyEvidenceRepository: AdsAutomationValidateOnlyEvidenceRepository,
  ) {}

  async readByValidationId(
    validationId: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceReadbackResponse> {
    const normalizedValidationId = this.requiredText(validationId, 'validationId');
    const validateOnlyEvidence = await this.validateOnlyEvidenceRepository
      .findByValidationId(normalizedValidationId);

    if (!validateOnlyEvidence) {
      throw new NotFoundException(`validate-only evidence not found: ${normalizedValidationId}`);
    }

    return {
      schemaVersion: 'ads_automation_validate_only_evidence_readback.v1',
      generatedAt: new Date().toISOString(),
      query: { validation_id: normalizedValidationId },
      safety: this.readbackSafety(),
      summary: this.summary('found', [validateOnlyEvidence], false, 'inspect_validateOnly_evidence'),
      validateOnlyEvidence,
    };
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceHistoryResponse> {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const validateOnlyEvidenceRecords = await this.validateOnlyEvidenceRepository
      .listByApprovalId(normalizedApprovalId);

    return {
      schemaVersion: 'ads_automation_validate_only_evidence_history.v1',
      generatedAt: new Date().toISOString(),
      query: { approval_id: normalizedApprovalId },
      safety: this.readbackSafety(),
      summary: this.summary(
        validateOnlyEvidenceRecords.length ? 'listed' : 'not_found',
        validateOnlyEvidenceRecords,
        true,
        validateOnlyEvidenceRecords.length
          ? 'inspect_approval_validateOnly_history'
          : 'verify_validation_id',
      ),
      validateOnlyEvidenceRecords,
    };
  }

  private summary(
    readbackStatus: 'found' | 'not_found' | 'listed',
    records: AdsAutomationValidateOnlyEvidenceRecord[],
    approvalIdFilterApplied: boolean,
    nextRequiredAction:
      | 'inspect_validateOnly_evidence'
      | 'inspect_approval_validateOnly_history'
      | 'verify_validation_id',
  ) {
    return {
      readback_status: readbackStatus,
      validateOnly_evidence_records_matched: records.length,
      approval_id_filter_applied: approvalIdFilterApplied,
      approval_required: true,
      execution_allowed_now: false,
      validateOnly_evidence_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      next_required_action: nextRequiredAction,
    } as const;
  }

  private readbackSafety(): AdsAutomationValidateOnlyEvidenceReadbackSafety {
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
      validateOnly_evidence_readback: true,
      validateOnly_evidence_persistence_performed: false,
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
