import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdsAutomationPolicyDecisionEvidenceReadbackService } from './ads-automation-policy-decision-evidence-readback.service';
import { AdsAutomationPolicyDecisionEvidenceRepository } from './ads-automation-policy-decision-evidence.repository';
import type { AdsAutomationPolicyDecisionEvidenceRecord } from './contracts/ads-automation-policy-decision-evidence.contract';

function policyEvidence(
  overrides: Partial<AdsAutomationPolicyDecisionEvidenceRecord> = {},
): AdsAutomationPolicyDecisionEvidenceRecord {
  return {
    schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
    policy_decision_id: 'ADSPOLICY-ADSAPPROVAL-2001-REQ-POLICY',
    idempotency_key: 'ads-policy-decision:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-POLICY',
    approval_id: 'ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001',
    policy_allowed: true,
    policy_source: 'erp_cashflow_ads_policy',
    blockers: [],
    evaluatedAt: '2026-07-04T06:00:00.000Z',
    policy_decision_record_persisted: true,
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
    persistence_used: true,
    durable_storage_used: true,
    erp_local_persistence_used: true,
    provider_persistence_used: false,
    storage: 'erp_local_mongo',
    requestedByUserId: 'director-1',
    requestedByRole: 'director',
    requestId: 'REQ-POLICY',
    createdAt: '2026-07-04T06:10:00.000Z',
    persistedAt: '2026-07-04T06:10:01.000Z',
    ...overrides,
  };
}

describe('AdsAutomationPolicyDecisionEvidenceReadbackService', () => {
  let repository: jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
  let service: AdsAutomationPolicyDecisionEvidenceReadbackService;

  beforeEach(() => {
    repository = {
      findByPolicyDecisionId: jest.fn(),
      findByPolicyDecisionIds: jest.fn(),
      listByApprovalId: jest.fn(),
      createManyIdempotent: jest.fn(),
      toPersistableRecord: jest.fn(),
    } as unknown as jest.Mocked<AdsAutomationPolicyDecisionEvidenceRepository>;
    service = new AdsAutomationPolicyDecisionEvidenceReadbackService(repository);
  });

  it('wraps policy_decision_id readback in a read-only safety envelope', async () => {
    const record = policyEvidence();
    repository.findByPolicyDecisionId.mockResolvedValueOnce(record);

    const response = await service.readByPolicyDecisionId(` ${record.policy_decision_id} `);

    expect(repository.findByPolicyDecisionId).toHaveBeenCalledWith(record.policy_decision_id);
    expect(repository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_execution_policy_decision_evidence_readback.v1');
    expect(response.query).toEqual({ policy_decision_id: record.policy_decision_id });
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
      policy_decision_evidence_readback: true,
      policy_decision_evidence_persistence_performed: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'found',
      policy_decision_records_matched: 1,
      approval_id_filter_applied: false,
      approval_required: true,
      execution_allowed_now: false,
      policy_decision_evidence_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_policy_decision_evidence',
    }));
    expect(response.policyDecisionEvidence).toEqual(expect.objectContaining({
      policy_decision_id: record.policy_decision_id,
      approval_id: record.approval_id,
      policy_decision_record_persisted: true,
      execution_allowed_now: false,
    }));
  });

  it('raises not found for a missing policy_decision_id and rejects blank ids', async () => {
    repository.findByPolicyDecisionId.mockResolvedValueOnce(null);

    await expect(service.readByPolicyDecisionId('ADSPOLICY-missing')).rejects.toThrow(NotFoundException);
    expect(repository.findByPolicyDecisionId).toHaveBeenCalledWith('ADSPOLICY-missing');

    repository.findByPolicyDecisionId.mockClear();
    await expect(service.readByPolicyDecisionId('   ')).rejects.toThrow(BadRequestException);
    expect(repository.findByPolicyDecisionId).not.toHaveBeenCalled();
  });

  it('wraps approval_id policy evidence history without performing persistence', async () => {
    const allowed = policyEvidence();
    const blocked = policyEvidence({
      policy_decision_id: 'ADSPOLICY-ADSAPPROVAL-2001-REQ-BLOCKED',
      idempotency_key: 'ads-policy-decision:ADSAPPROVAL-ads-draft_2026-07-04_update_campaign_budget_2001:REQ-BLOCKED',
      policy_allowed: false,
      blockers: ['daily_cap_exceeded'],
      requestId: 'REQ-BLOCKED',
      createdAt: '2026-07-04T06:20:00.000Z',
    });
    repository.listByApprovalId.mockResolvedValueOnce([blocked, allowed]);

    const response = await service.listByApprovalId(` ${allowed.approval_id} `);

    expect(repository.listByApprovalId).toHaveBeenCalledWith(allowed.approval_id);
    expect(repository.createManyIdempotent).not.toHaveBeenCalled();
    expect(response.schemaVersion).toBe('ads_automation_execution_policy_decision_evidence_history.v1');
    expect(response.query).toEqual({ approval_id: allowed.approval_id });
    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'listed',
      policy_decision_records_matched: 2,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      policy_decision_evidence_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      next_required_action: 'inspect_approval_policy_decision_history',
    }));
    expect(response.policyDecisionEvidenceRecords.map((record) => record.approval_id)).toEqual([
      allowed.approval_id,
      allowed.approval_id,
    ]);
  });

  it('returns an empty approval history envelope when no policy evidence exists', async () => {
    repository.listByApprovalId.mockResolvedValueOnce([]);

    const response = await service.listByApprovalId('ADSAPPROVAL-without-policy-evidence');

    expect(response.summary).toEqual(expect.objectContaining({
      readback_status: 'not_found',
      policy_decision_records_matched: 0,
      approval_id_filter_applied: true,
      execution_allowed_now: false,
      policy_decision_evidence_persistence_performed: false,
      next_required_action: 'verify_policy_decision_id',
    }));
    expect(response.policyDecisionEvidenceRecords).toEqual([]);
  });
});
