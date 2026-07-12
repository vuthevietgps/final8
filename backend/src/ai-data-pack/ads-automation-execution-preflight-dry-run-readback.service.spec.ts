import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdsAutomationExecutionPreflightDryRunReadbackService } from './ads-automation-execution-preflight-dry-run-readback.service';
import { AdsAutomationExecutionPreflightDryRunRepository } from './ads-automation-execution-preflight-dry-run.repository';
import type { AdsAutomationExecutionPreflightDryRunRecord } from './contracts/ads-automation-execution-preflight-dry-run.contract';

function executionRecord(
  overrides: Partial<AdsAutomationExecutionPreflightDryRunRecord> = {},
): AdsAutomationExecutionPreflightDryRunRecord {
  return {
    execution_record_id: 'ADSEXEC-DRYRUN-ADSAPPROVAL-2001-REQ-PREFLIGHT',
    idempotency_key: 'ads-execution-preflight:ADSAPPROVAL-2001:REQ-PREFLIGHT',
    approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
    source_draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    accountId: '1234567890',
    platform: 'google',
    approval_status: 'approved',
    approval_decision_audit_id: 'ADSAUDIT-ADSAPPROVAL-2001-approve',
    approval_decision_audit_persisted: true,
    source_readiness_safe: true,
    kill_switch_active: false,
    kill_switch_reason: null,
    validateOnly_validation_id: 'ADSPROVIDERVALIDATE-ADSAPPROVAL-2001-REQ-PREFLIGHT',
    validateOnly_evidence_persisted: true,
    validateOnly_status: 'validate_only_passed',
    policy_decision_id: 'ADSPOLICY-ADSAPPROVAL-2001-REQ-PREFLIGHT',
    policy_decision_evidence_persisted: true,
    policy_allowed: true,
    google_ads_production_enabled: false,
    preflight_status: 'blocked_before_future_live_execution',
    dry_run_record_status: 'recorded_local_only',
    future_live_execution_allowed: false,
    execution_allowed_now: false,
    provider_api_called: false,
    google_ads_api_called: false,
    validateOnly_called: false,
    live_ads_execution_used: false,
    erp_mutation_used: false,
    payment_mutation_used: false,
    direct_google_ads_api_call: false,
    provider_mutation_used: false,
    live_path_implemented: false,
    campaignBudgetId_fallback_used: false,
    preflight_record_persisted: true,
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requested_change: {
      action_type: 'update_campaign_budget',
      campaignBudgetId: '3001',
      dailyBudget: 1200000,
    },
    identifiers: {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
    },
    gates: [],
    blockers: ['GOOGLE_ADS_PRODUCTION_ENABLED'],
    next_required_action: 'fix_preflight_blockers_before_future_execution',
    source_pending_approval: {} as any,
    source_validateOnly_plan: null,
    policy_decision: {
      approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
      policy_allowed: true,
      policy_source: 'erp_ads_policy',
      blockers: [],
    },
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-PREFLIGHT',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:11:00.000Z',
    ...overrides,
  };
}

describe('AdsAutomationExecutionPreflightDryRunReadbackService', () => {
  let repository: jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
  let service: AdsAutomationExecutionPreflightDryRunReadbackService;

  beforeEach(() => {
    repository = {
      findByExecutionRecordId: jest.fn(),
      listByApprovalId: jest.fn(),
      createManyIdempotent: jest.fn(),
      toPersistableRecord: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationExecutionPreflightDryRunRepository>;
    service = new AdsAutomationExecutionPreflightDryRunReadbackService(repository);
  });

  it('wraps execution_record_id readback in a read-only safety envelope', async () => {
    const record = executionRecord();
    repository.findByExecutionRecordId.mockResolvedValueOnce(record);

    const response = await service.readByExecutionRecordId(` ${record.execution_record_id} `);

    expect(repository.findByExecutionRecordId).toHaveBeenCalledWith(record.execution_record_id);
    expect(repository.listByApprovalId).not.toHaveBeenCalled();
    expect(repository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_execution_preflight_dry_run_record_readback.v1');
    expect(response.query).toEqual({ execution_record_id: record.execution_record_id });
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
      preflight_record_readback: true,
      preflight_persistence_performed: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'found',
      execution_records_matched: 1,
      approval_id_filter_applied: false,
      approval_required: true,
      execution_allowed_now: false,
      preflight_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_execution_preflight_record',
    }));
    expect(response.executionRecord).toEqual(expect.objectContaining({
      execution_record_id: record.execution_record_id,
      approval_id: record.approval_id,
      preflight_record_persisted: true,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    }));
  });

  it('raises not found for a missing execution_record_id and rejects blank ids', async () => {
    repository.findByExecutionRecordId.mockResolvedValueOnce(null);

    await expect(service.readByExecutionRecordId('ADSEXEC-missing')).rejects.toThrow(NotFoundException);
    expect(repository.findByExecutionRecordId).toHaveBeenCalledWith('ADSEXEC-missing');

    repository.findByExecutionRecordId.mockClear();
    await expect(service.readByExecutionRecordId('   ')).rejects.toThrow(BadRequestException);
    expect(repository.findByExecutionRecordId).not.toHaveBeenCalled();
  });

  it('wraps approval_id history readback without performing persistence', async () => {
    const first = executionRecord();
    const second = executionRecord({
      execution_record_id: 'ADSEXEC-DRYRUN-ADSAPPROVAL-2001-REQ-PREFLIGHT-RETRY',
      idempotency_key: 'ads-execution-preflight:ADSAPPROVAL-2001:REQ-PREFLIGHT-RETRY',
      requestId: 'REQ-PREFLIGHT-RETRY',
      createdAt: '2026-07-04T06:20:00.000Z',
    });
    repository.listByApprovalId.mockResolvedValueOnce([second, first]);

    const response = await service.listByApprovalId(` ${first.approval_id} `);

    expect(repository.listByApprovalId).toHaveBeenCalledWith(first.approval_id);
    expect(repository.findByExecutionRecordId).not.toHaveBeenCalled();
    expect(repository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_execution_preflight_dry_run_record_history.v1');
    expect(response.query).toEqual({ approval_id: first.approval_id });
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      execution_records_matched: 2,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      preflight_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_approval_execution_preflight_history',
    }));
    expect(response.executionRecords.map((record) => record.approval_id)).toEqual([
      first.approval_id,
      first.approval_id,
    ]);
  });

  it('returns an empty approval history envelope when no preflight records exist', async () => {
    repository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.listByApprovalId('ADSAPPROVAL-without-preflight');

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'not_found',
      execution_records_matched: 0,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      preflight_persistence_performed: false,
      next_required_action: 'verify_execution_record_id',
    }));
    expect(response.executionRecords).toEqual([]);
  });
});
