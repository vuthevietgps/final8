import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
  AdsAutomationExecutionPreflightReadbackSafety,
  AdsAutomationExecutionPreflightRecordHistoryResponse,
  AdsAutomationExecutionPreflightRecordReadbackResponse,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';

@Injectable()
export class AdsAutomationExecutionPreflightDryRunReadbackService {
  constructor(
    private readonly preflightRepository: AdsAutomationExecutionPreflightDryRunRepository,
  ) {}

  async readByExecutionRecordId(
    executionRecordId: string,
  ): Promise<AdsAutomationExecutionPreflightRecordReadbackResponse> {
    const normalizedExecutionRecordId = this.requiredText(executionRecordId, 'executionRecordId');
    const executionRecord = await this.preflightRepository.findByExecutionRecordId(normalizedExecutionRecordId);

    if (!executionRecord) {
      throw new NotFoundException(`execution preflight record not found: ${normalizedExecutionRecordId}`);
    }

    return {
      schemaVersion: 'ads_automation_execution_preflight_dry_run_record_readback.v1',
      generatedAt: new Date().toISOString(),
      query: { execution_record_id: normalizedExecutionRecordId },
      safety: this.readbackSafety(),
      summary: this.summary('found', [executionRecord], false, 'inspect_execution_preflight_record'),
      executionRecord,
    };
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationExecutionPreflightRecordHistoryResponse> {
    const normalizedApprovalId = this.requiredText(approvalId, 'approvalId');
    const executionRecords = await this.preflightRepository.listByApprovalId(normalizedApprovalId);

    return {
      schemaVersion: 'ads_automation_execution_preflight_dry_run_record_history.v1',
      generatedAt: new Date().toISOString(),
      query: { approval_id: normalizedApprovalId },
      safety: this.readbackSafety(),
      summary: this.summary(
        executionRecords.length ? 'listed' : 'not_found',
        executionRecords,
        true,
        executionRecords.length
          ? 'inspect_approval_execution_preflight_history'
          : 'verify_execution_record_id',
      ),
      executionRecords,
    };
  }

  private summary(
    readbackStatus: 'found' | 'not_found' | 'listed',
    executionRecords: AdsAutomationExecutionPreflightDryRunRecord[],
    approvalIdFilterApplied: boolean,
    nextRequiredAction: 'inspect_execution_preflight_record' | 'inspect_approval_execution_preflight_history' | 'verify_execution_record_id',
  ) {
    return {
      readback_status: readbackStatus,
      execution_records_matched: executionRecords.length,
      approval_id_filter_applied: approvalIdFilterApplied,
      approval_required: true,
      execution_allowed_now: false,
      preflight_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      next_required_action: nextRequiredAction,
    } as const;
  }

  private readbackSafety(): AdsAutomationExecutionPreflightReadbackSafety {
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
      preflight_record_readback: true,
      preflight_persistence_performed: false,
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
