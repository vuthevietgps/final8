import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GoogleAdsCampaignService } from './google-ads-campaign.service';

describe('GoogleAdsCampaignService', () => {
  let service: GoogleAdsCampaignService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GoogleAdsCampaignService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads sanitized capabilities and canonical lookups only from ERP', () => {
    service.getCapabilities('1234567890').subscribe();
    let request = http.expectOne((candidate) =>
      candidate.url === '/api/google-ads/capabilities'
      && candidate.params.get('customerId') === '1234567890');
    expect(request.request.method).toBe('GET');
    request.flush({ apiVersion: 'v24', channelTypes: ['SEARCH'] });

    service.getAccountOptions().subscribe();
    request = http.expectOne('/api/google-ads/lookups/ad-accounts');
    expect(request.request.method).toBe('GET');
    request.flush([{ customerId: '1234567890', name: 'ERP Google account' }]);

    service.getCampaignOptions('123/456').subscribe();
    request = http.expectOne('/api/google-ads/lookups/campaigns/123%2F456');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    service.getAdGroupOptions('123/456', 'CAM/1').subscribe();
    request = http.expectOne('/api/google-ads/lookups/ad-groups/123%2F456/CAM%2F1');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    service.getKeywordOptions('123/456', 'ADG/1').subscribe();
    request = http.expectOne('/api/google-ads/lookups/keywords/123%2F456/ADG%2F1');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    service.getResponsiveSearchAdOptions('123/456', 'ADG/1').subscribe();
    request = http.expectOne('/api/google-ads/lookups/responsive-search-ads/123%2F456/ADG%2F1');
    expect(request.request.method).toBe('GET');
    request.flush([]);

    service.getSearchReadiness('123/456', 'CAM/1').subscribe();
    request = http.expectOne('/api/google-ads/lookups/readiness/123%2F456/CAM%2F1');
    expect(request.request.method).toBe('GET');
    request.flush({ ready: false, blockers: ['conversion_missing'] });

    http.expectNone((candidate) => candidate.url.includes('googleads.googleapis.com'));
  });

  it('creates a typed browser DTO without provider credentials or raw operations', () => {
    const body = {
      planName: 'Tạo Search campaign - Mùa vụ tháng 8',
      actions: [{
        actionType: 'create_search_campaign' as const,
        customerId: '1234567890',
        reason: 'Ngân sách đã được phê duyệt',
        idempotencyKey: 'GOOGLE-ERP-UI-1',
        payload: {
          campaignName: 'Mùa vụ tháng 8',
          budgetName: 'Budget mùa vụ tháng 8',
          dailyBudgetVnd: 500_000,
          biddingStrategyType: 'MAXIMIZE_CONVERSIONS' as const,
          startDate: '2026-08-01',
          searchPartnersEnabled: false,
          geoTargetConstantIds: ['2704'],
          languageConstantIds: ['1040'],
          positiveGeoTargetType: 'PRESENCE' as const,
          doesNotContainEuPoliticalAdvertising: true as const,
        },
      }],
    };

    let createdPlanId = '';
    service.createPlan(body).subscribe((plan) => createdPlanId = plan.planId);

    const request = http.expectOne('/api/google-ads/action-plans');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    const serialized = JSON.stringify(request.request.body);
    expect(serialized).not.toContain('accessToken');
    expect(serialized).not.toContain('developerToken');
    expect(serialized).not.toContain('refreshToken');
    expect(serialized).not.toContain('mutateOperations');
    expect(serialized).not.toContain('googleads.googleapis.com');
    expect(serialized).not.toContain('typedPayload');
    expect(serialized).not.toContain('source');
    request.flush({ plan: { planId: 'GOOGLE-PLAN-1', status: 'pending_approval', items: [] } });
    expect(createdPlanId).toBe('GOOGLE-PLAN-1');
  });

  it('loads, updates and evaluates the draft-only bidding lifecycle through ERP', () => {
    const policy = {
      enabled: true,
      clickThreshold: 50,
      clickWindowDays: 30,
      maxCpcBidCeilingVnd: 8_000,
      maximizeConversionsMinConversions: 15,
      conversionWindowDays: 30,
      targetCpaMinConversions: 30,
      targetCpaVnd: 120_000,
      cooldownHours: 168,
      minimumStageDwellHours: 168,
      draftOnly: true as const,
    };
    const response = {
      policy,
      state: {
        currentStage: 'MAXIMIZE_CLICKS' as const,
        observedClicks: 42,
        observedConversions: 4,
      },
    };

    service.getBiddingLifecycle('123/456', 'CAM/1').subscribe((value) => {
      expect(value).toEqual(response);
    });
    let request = http.expectOne('/api/google-ads/bidding-lifecycle/123%2F456/CAM%2F1');
    expect(request.request.method).toBe('GET');
    request.flush(response);

    service.updateBiddingLifecycle('123/456', 'CAM/1', policy).subscribe();
    request = http.expectOne('/api/google-ads/bidding-lifecycle/123%2F456/CAM%2F1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(policy);
    const serialized = JSON.stringify(request.request.body);
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('micros');
    expect(serialized).not.toContain('mutate');
    request.flush(response);

    service.evaluateBiddingLifecycle('123/456', 'CAM/1').subscribe();
    request = http.expectOne('/api/google-ads/bidding-lifecycle/123%2F456/CAM%2F1/evaluate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      ...response,
      state: {
        ...response.state,
        pendingDraft: {
          planId: 'GOOGLE-AUTO-BID-1',
          fromStage: 'MAXIMIZE_CLICKS',
          toStage: 'MAXIMIZE_CLICKS_CPC_CEILING',
          status: 'draft',
        },
      },
    });

    http.expectNone((candidate) => candidate.url.includes('googleads.googleapis.com'));
  });

  it('materializes automated pause drafts only through the ERP endpoint', () => {
    service.materializePauseReviewDrafts(7).subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === '/api/ads-automation/drafts/google/pause-review'
      && candidate.params.get('limit') === '7');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      platform: 'google_ads',
      created: 0,
      deduplicated: 0,
      rejected: 0,
      eligible: 0,
      drafts: [],
    });
    http.expectNone((candidate) => candidate.url.includes('googleads.googleapis.com'));
  });

  it('uses the guarded validation, item decision and execution transitions', () => {
    service.validatePlan('PLAN /1').subscribe();
    let request = http.expectOne('/api/google-ads/action-plans/PLAN%20%2F1/validate');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ validateOnly: true });
    request.flush({});
    request = http.expectOne('/api/google-ads/action-plans/PLAN%20%2F1');
    expect(request.request.method).toBe('GET');
    request.flush({ plan: { planId: 'PLAN /1', status: 'pending_approval', items: [] } });

    service.approveItem('PLAN-1', 'ACTION/1').subscribe();
    request = http.expectOne('/api/google-ads/action-plans/PLAN-1/items/ACTION%2F1/approve');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      approvedBySource: 'erp_ui',
      approvalText: 'Approved in ERP Google Search campaign control',
      requireExecutionConfirmation: true,
    });
    request.flush({});
    request = http.expectOne('/api/google-ads/action-plans/PLAN-1');
    request.flush({ plan: { planId: 'PLAN-1', status: 'approved', items: [] } });

    service.rejectItem('PLAN-1', 'ACTION-1', 'Thiếu bằng chứng').subscribe();
    request = http.expectOne('/api/google-ads/action-plans/PLAN-1/items/ACTION-1/reject');
    expect(request.request.body).toEqual({ rejectedBySource: 'erp_ui', reason: 'Thiếu bằng chứng' });
    request.flush({});
    request = http.expectOne('/api/google-ads/action-plans/PLAN-1');
    request.flush({ plan: { planId: 'PLAN-1', status: 'rejected', items: [] } });

    service.executePlan('PLAN-1', ['ACTION-1'], false).subscribe();
    request = http.expectOne('/api/google-ads/action-plans/PLAN-1/execute');
    expect(request.request.body).toEqual({
      actionIds: ['ACTION-1'],
      dryRun: false,
      validateOnly: false,
      source: 'erp_ui',
    });
    request.flush({ status: 'success', dryRun: false });

    http.expectNone((candidate) => candidate.url.includes('googleads.googleapis.com'));
  });
});
