import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AiMarketingService } from './ai-marketing.service';

describe('AiMarketingService approval queue readback', () => {
  let service: AiMarketingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AiMarketingService,
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AiMarketingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('reads durable approval queue records through the read-only ads automation endpoint', () => {
    let approvalId = '';

    service.listDecisionDraftApprovals().subscribe((response) => {
      approvalId = response.pendingApprovals[0].approval_id;
      expect(response.safety.read_only).toBeTrue();
      expect(response.safety.provider_api_called).toBeFalse();
      expect(response.safety.google_ads_api_called).toBeFalse();
      expect(response.safety.live_ads_execution_used).toBeFalse();
      expect(response.safety.execution_allowed_now).toBeFalse();
    });

    const request = http.expectOne('/api/ai/ads-automation/decision-draft-approvals');

    expect(request.request.method).toBe('GET');

    request.flush({
      schemaVersion: 'ads_automation_decision_draft_approval_queue.v1',
      generatedAt: '2026-07-05T05:30:00+07:00',
      query: { status: 'pending' },
      safety: {
        read_only: true,
        dry_run: true,
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
      },
      summary: {
        total_pending_approvals: 1,
        pending_approvals_listed: 1,
        provider_action_approvals: 1,
        internal_task_approvals: 0,
        monitoring_approvals: 0,
      },
      pendingApprovals: [
        {
          approval_id: 'ADSAPPROVAL-readonly-001',
          source_draft_id: 'draft-001',
          source_decision_id: 'decision-001',
          action_type: 'update_campaign_budget',
          action_family: 'provider_action',
          provider: 'google_ads',
          resource_type: 'campaign_budget',
          entity_type: 'campaign',
          entity_id: 'campaign-001',
          accountId: 'account-001',
          productId: 'product-001',
          supplierId: null,
          platform: 'google_ads',
          status: 'pending',
          approval_required: true,
          execution_allowed_now: false,
          validate_only_required: true,
          future_provider_validateOnly_required: true,
          provider_api_called: false,
          google_ads_api_called: false,
          live_ads_execution_used: false,
          erp_mutation_used: false,
          payment_mutation_used: false,
          persistence_used: true,
          durable_storage_used: true,
          erp_local_persistence_used: true,
          provider_persistence_used: false,
          storage: 'erp_local_mongo',
          typedPayload: {},
          blockers: [],
          missing_data_blockers: [],
          idempotency_key: 'approval-idempotency-001',
          rationale: 'Manager must review evidence before any future execution.',
          createdAt: '2026-07-05T05:20:00+07:00',
          persistedAt: '2026-07-05T05:20:01+07:00',
        },
      ],
    });

    expect(approvalId).toBe('ADSAPPROVAL-readonly-001');
  });
});
