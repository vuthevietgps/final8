import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MetaAdsCampaignService } from './meta-ads-campaign.service';

describe('MetaAdsCampaignService', () => {
  let service: MetaAdsCampaignService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MetaAdsCampaignService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads campaign capabilities and sanitized account options only from ERP', () => {
    service.getCapabilities('123456789').subscribe();
    let request = http.expectOne((candidate) =>
      candidate.url === '/api/meta-ads/capabilities'
      && candidate.params.get('adAccountId') === '123456789');
    expect(request.request.method).toBe('GET');
    request.flush({ objectives: [] });

    service.getAdAccountOptions().subscribe();
    request = http.expectOne('/api/meta-ads/lookups/ad-accounts');
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush([{ adAccountId: '123456789', name: 'ERP Meta Account', eligible: true }]);

    service.getCampaignOptions('123/456').subscribe();
    request = http.expectOne('/api/meta-ads/lookups/campaigns/123%2F456');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    http.expectNone((candidate) => candidate.url.includes('facebook.com'));
  });

  it('creates a typed ERP action plan without provider credentials or Graph input', () => {
    const body = {
      planName: 'Tạo campaign - Mùa vụ tháng 8',
      actions: [{
        actionType: 'create_campaign' as const,
        adAccountId: '123456789',
        reason: 'Thử nghiệm có giới hạn',
        payload: {
          name: 'Mùa vụ tháng 8',
          objective: 'OUTCOME_SALES' as const,
          budgetMode: 'CBO' as const,
          budgetType: 'DAILY' as const,
          bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as const,
          dailyBudgetVnd: 500_000,
          specialAdCategories: ['NONE' as const],
        },
      }],
    };

    service.createPlan(body).subscribe();

    const request = http.expectOne('/api/meta-ads/action-plans');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(JSON.stringify(request.request.body)).not.toContain('accessToken');
    expect(JSON.stringify(request.request.body)).not.toContain('graph.facebook.com');
    expect(JSON.stringify(request.request.body)).not.toContain('productionEnabled');
    expect(JSON.stringify(request.request.body)).not.toContain('providerUrl');
    expect(JSON.stringify(request.request.body)).not.toContain('rawPayload');
    request.flush({ planId: 'META-PLAN-001', planName: body.planName, status: 'draft', actions: [] });
  });

  it('materializes automated pause drafts only through the ERP endpoint', () => {
    service.materializePauseReviewDrafts(9).subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === '/api/ads-automation/drafts/meta/pause-review'
      && candidate.params.get('limit') === '9');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      platform: 'meta_ads',
      created: 0,
      deduplicated: 0,
      rejected: 0,
      eligible: 0,
      drafts: [],
    });
    http.expectNone((candidate) => candidate.url.includes('graph.facebook.com'));
  });

  it('uses explicit validate, approval, rejection, execution and history transitions', () => {
    service.validatePlan('META PLAN/001').subscribe();
    let request = http.expectOne('/api/meta-ads/action-plans/META%20PLAN%2F001/validate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ validateOnly: true });
    request.flush({});

    service.approveAction('PLAN-1', 'ACTION/1', 2).subscribe();
    request = http.expectOne('/api/meta-ads/action-plans/PLAN-1/actions/ACTION%2F1/approve');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.note).toBe('Approved in ERP Meta campaign control');
    expect(request.request.body.expectedActionRevision).toBe(2);
    request.flush({});

    service.rejectAction('PLAN-1', 'ACTION-1', 'Thiếu bằng chứng', 3).subscribe();
    request = http.expectOne('/api/meta-ads/action-plans/PLAN-1/actions/ACTION-1/reject');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      reason: 'Thiếu bằng chứng',
      expectedActionRevision: 3,
    });
    request.flush({});

    service.executePlan('PLAN-1', ['ACTION-1'], false).subscribe();
    request = http.expectOne('/api/meta-ads/action-plans/PLAN-1/execute');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      actionIds: ['ACTION-1'],
      dryRun: false,
      validateOnly: false,
      source: 'erp_ui',
    });
    request.flush({ executionId: 'EXEC-1', status: 'success', dryRun: false });

    service.getExecutions('PLAN-1').subscribe();
    request = http.expectOne('/api/meta-ads/action-plans/PLAN-1/executions');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    http.expectNone((candidate) => candidate.url.includes('facebook.com'));
  });
});
