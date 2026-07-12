import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdsAutomationValidateOnlyEvidenceReadbackService } from './ads-automation-validate-only-evidence-readback.service';
import { AdsAutomationValidateOnlyEvidenceRepository } from './ads-automation-validate-only-evidence.repository';
import type { AdsAutomationValidateOnlyEvidenceRecord } from './contracts/ads-automation-validate-only-evidence.contract';

function validateOnlyEvidence(
  overrides: Partial<AdsAutomationValidateOnlyEvidenceRecord> = {},
): AdsAutomationValidateOnlyEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_validate_only_evidence.v1',
    validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001',
    idempotency_key: 'ads-validate-only-evidence:ADSAPPROVAL-2001:REQ-VALIDATE',
    pending_action_id: 'ADSPENDINGACTION-ADSAPPROVAL-2001',
    approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
    source_pending_action_status: 'pending_validation',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    customerId: '1234567890',
    campaignId: '1001',
    adGroupId: '2001',
    campaignBudgetId: '3001',
    campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    requested_change: { campaignBudgetId: '3001', dailyBudget: 1200000 },
    status: 'validate_only_passed',
    providerValidationStatus: 'provider_validate_passed',
    providerRequestId: 'REQ-VALIDATE-MOCK',
    providerValidatedAt: '2026-07-04T06:00:00.000Z',
    providerValidationErrors: [],
    before_state_snapshot: {
      snapshot_status: 'mocked_boundary_snapshot',
      required_before_future_execution: true,
      source: 'erp_synced_google_ads_read_model',
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      snapshot: { syncedAt: '2026-07-04T05:55:00.000Z' },
    },
    provider_boundary_evidence: {
      boundary_mode: 'erp_local_mock_only',
      status_source: 'mock_provider_result',
      mocked_provider_result_used: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      direct_google_ads_api_call: false,
      operation_builder_called: false,
      raw_provider_request_included: false,
      evidence: ['Mocked validate-only evidence stayed ERP-local.'],
    },
    blockers: [],
    approval_can_be_considered_executable: true,
    executable_now: false,
    execution_allowed_now: false,
    validate_only_required_before_execution: true,
    next_required_action: 'continue_human_approval_flow',
    source_pending_action: {} as any,
    validateOnly_evidence_persisted: true,
    future_live_execution_allowed: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-VALIDATE',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:10:01.000Z',
    ...overrides,
  };
}

describe('AdsAutomationValidateOnlyEvidenceReadbackService', () => {
  let repository: jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
  let service: AdsAutomationValidateOnlyEvidenceReadbackService;

  beforeEach(() => {
    repository = {
      findByValidationId: jest.fn(),
      findByValidationIds: jest.fn(),
      listByApprovalId: jest.fn(),
      createManyIdempotent: jest.fn(),
      toPersistableRecord: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationValidateOnlyEvidenceRepository>;
    service = new AdsAutomationValidateOnlyEvidenceReadbackService(repository);
  });

  it('wraps validation_id readback in a read-only safety envelope', async () => {
    const record = validateOnlyEvidence();
    repository.findByValidationId.mockResolvedValueOnce(record);

    const response = await service.readByValidationId(` ${record.validation_id} `);

    expect(repository.findByValidationId).toHaveBeenCalledWith(record.validation_id);
    expect(repository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_validate_only_evidence_readback.v1');
    expect(response.query).toEqual({ validation_id: record.validation_id });
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
      validateOnly_evidence_readback: true,
      validateOnly_evidence_persistence_performed: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'found',
      validateOnly_evidence_records_matched: 1,
      approval_id_filter_applied: false,
      approval_required: true,
      execution_allowed_now: false,
      validateOnly_evidence_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_validateOnly_evidence',
    }));
    expect(response.validateOnlyEvidence).toEqual(expect.objectContaining({
      validation_id: record.validation_id,
      approval_id: record.approval_id,
      validateOnly_evidence_persisted: true,
      execution_allowed_now: false,
    }));
  });

  it('raises not found for a missing validation_id and rejects blank ids', async () => {
    repository.findByValidationId.mockResolvedValueOnce(null);

    await expect(service.readByValidationId('ADSPROVIDERVALIDATE-missing')).rejects.toThrow(NotFoundException);
    expect(repository.findByValidationId).toHaveBeenCalledWith('ADSPROVIDERVALIDATE-missing');

    repository.findByValidationId.mockClear();
    await expect(service.readByValidationId('   ')).rejects.toThrow(BadRequestException);
    expect(repository.findByValidationId).not.toHaveBeenCalled();
  });

  it('wraps approval_id validate-only evidence history without performing persistence', async () => {
    const passed = validateOnlyEvidence();
    const failed = validateOnlyEvidence({
      validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001-FAILED',
      idempotency_key: 'ads-validate-only-evidence:ADSAPPROVAL-2001:REQ-FAILED',
      status: 'validate_only_failed',
      providerValidationStatus: 'provider_validate_failed',
      approval_can_be_considered_executable: false,
      blockers: ['provider_validation_error'],
      requestId: 'REQ-FAILED',
      createdAt: '2026-07-04T06:20:00.000Z',
    });
    repository.listByApprovalId.mockResolvedValueOnce([failed, passed]);

    const response = await service.listByApprovalId(` ${passed.approval_id} `);

    expect(repository.listByApprovalId).toHaveBeenCalledWith(passed.approval_id);
    expect(repository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_validate_only_evidence_history.v1');
    expect(response.query).toEqual({ approval_id: passed.approval_id });
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      validateOnly_evidence_records_matched: 2,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      validateOnly_evidence_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_approval_validateOnly_history',
    }));
    expect(response.validateOnlyEvidenceRecords.map((record) => record.approval_id)).toEqual([
      passed.approval_id,
      passed.approval_id,
    ]);
  });

  it('returns an empty approval history envelope when no validate-only evidence exists', async () => {
    repository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.listByApprovalId('ADSAPPROVAL-without-validate-only-evidence');

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'not_found',
      validateOnly_evidence_records_matched: 0,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      validateOnly_evidence_persistence_performed: false,
      next_required_action: 'verify_validation_id',
    }));
    expect(response.validateOnlyEvidenceRecords).toEqual([]);
  });
});
