import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Route, Router, RouterOutlet } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthGuard } from '../../core/guards/auth.guard';
import { User, UserRole } from '../../core/models/auth.interface';
import {
  AdsActionPlan,
  AdsDecisionDraftApprovalQueueResponse,
  AiMarketingOverview,
  CreativePerformanceResponse,
  LeadFunnelResponse,
} from './ai-marketing.service';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
class BrowserSmokeHostComponent {}

@Component({
  standalone: true,
  template: '<p>RBAC blocked</p>',
})
class BrowserSmokeBlockedComponent {}

describe('AiMarketing approval evidence deeplink browser smoke', () => {
  const aiMarketingRoute = requiredRoute('ai-marketing');
  const reviewerRoute = requiredRoute('ai/ads-approval-evidence-reviewer');
  const sourceSyncStatusRoute = requiredRoute('ai/ads-platform-source-sync-status-reviewer');
  const smokeRoutes: Route[] = [
    aiMarketingRoute,
    reviewerRoute,
    sourceSyncStatusRoute,
    { path: 'login', component: BrowserSmokeBlockedComponent },
    { path: 'unauthorized', component: BrowserSmokeBlockedComponent },
    { path: 'upgrade-plan', component: BrowserSmokeBlockedComponent },
  ];

  let fixture: ComponentFixture<BrowserSmokeHostComponent>;
  let router: Router;
  let http: HttpTestingController | null = null;

  afterEach(() => {
    http?.verify();
    http = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
  });

  it('clicks the rendered plan approval evidence link into the reviewer with approval_id query params', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);

    expect(aiMarketingRoute.canActivate).toContain(AuthGuard);
    expect(aiMarketingRoute.data?.['permissions']).toEqual(['google-ads.read']);
    expect(reviewerRoute.canActivate).toContain(AuthGuard);
    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(reviewerRoute.data?.['featureModule']).toBe('ai-marketing');
    expect(sourceSyncStatusRoute.canActivate).toContain(AuthGuard);
    expect(sourceSyncStatusRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);
    expect(sourceSyncStatusRoute.data?.['featureModule']).toBe('ai-marketing');

    const routed = await navigateWithValidatedToken('/ai-marketing', manager);
    expect(routed).toBeTrue();
    flushAiMarketingReadModel();
    await settle();

    const planLink = planEvidenceLink();
    expect(planLink.textContent?.trim()).toBe('Review evidence');
    expect(planLink.getAttribute('href')).toBe(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-queue-budget-001',
    );

    planLink.click();
    fixture.detectChanges();
    await flushNextTokenValidation(manager);
    await waitForRouterUrl(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-queue-budget-001',
    );

    expect(pageText()).toContain('Approval evidence reviewer');
    expect(approvalIdInput().value).toBe('ADSAPPROVAL-queue-budget-001');
    expectNoReviewerDocsReadback();
  });

  it('clicks the rendered plan source-sync link into the status reviewer with report date and sources', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);

    const routed = await navigateWithValidatedToken('/ai-marketing', manager);
    expect(routed).toBeTrue();
    flushAiMarketingReadModel();
    await settle();

    const sourceSyncLink = planSourceSyncLink();
    expectSourceSyncHref(sourceSyncLink.getAttribute('href'), {
      reportDate: '2026-07-04',
      sourceKeys: 'google_ads,advertising_costs,product_mapping',
      now: '2026-07-04T05:00:00.000Z',
    });

    sourceSyncLink.click();
    fixture.detectChanges();
    await flushNextTokenValidation(manager);
    await waitForRouterPath('/ai/ads-platform-source-sync-status-reviewer');

    expect(routerQueryParam('reportDate')).toBe('2026-07-04');
    expect(routerQueryParam('sourceKeys')).toBe('google_ads,advertising_costs,product_mapping');
    expect(routerQueryParam('now')).toBe('2026-07-04T05:00:00.000Z');
    expect(pageText()).toContain('Platform source-sync status');
    expect(sourceSyncReportDateInput().value).toBe('2026-07-04');
    expect(sourceCheckbox('google_ads').checked).toBeTrue();
    expect(sourceCheckbox('advertising_costs').checked).toBeTrue();
    expect(sourceCheckbox('product_mapping').checked).toBeTrue();
    expectNoSourceSyncStatusReadback();
  });

  it('clicks the durable approval queue evidence link into the same guarded reviewer route', async () => {
    const manager = userForRole(UserRole.MANAGER);
    await setup(manager);

    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);

    const routed = await navigateWithValidatedToken('/ai-marketing', manager);
    expect(routed).toBeTrue();
    flushAiMarketingReadModel();
    await settle();

    const durableLink = durableEvidenceLink();
    expect(durableLink.getAttribute('href')).toBe(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-durable-budget-001',
    );

    durableLink.click();
    fixture.detectChanges();
    await flushNextTokenValidation(manager);
    await waitForRouterUrl(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-durable-budget-001',
    );

    expect(pageText()).toContain('Approval evidence reviewer');
    expect(approvalIdInput().value).toBe('ADSAPPROVAL-durable-budget-001');
    expectNoReviewerDocsReadback();
  });

  it('blocks token-valid users without ai-data-pack marketer-read permission from reviewer deeplinks', async () => {
    const employee = userForRole(UserRole.EMPLOYEE);
    await setup(employee);

    expect(reviewerRoute.canActivate).toContain(AuthGuard);
    expect(reviewerRoute.data?.['permissions']).toEqual(['ai-data-pack.marketer.read']);

    const routed = await navigateWithValidatedToken(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-queue-budget-001',
      employee,
    );

    expect(routed).toBeFalse();
    await waitForRouterUrl('/unauthorized');
    expect(pageText()).toContain('RBAC blocked');
    expect(pageText()).not.toContain('Approval evidence reviewer');
    expectNoReviewerDocsReadback();
  });

  async function setup(user: User): Promise<void> {
    localStorage.setItem('access_token', `ai-marketing-deeplink-smoke-${user.role}`);
    localStorage.setItem('current_user', JSON.stringify(user));

    await TestBed.configureTestingModule({
      imports: [BrowserSmokeHostComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(smokeRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrowserSmokeHostComponent);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  async function navigateWithValidatedToken(url: string, user: User): Promise<boolean> {
    const navigation = router.navigateByUrl(url);
    await flushNextTokenValidation(user);
    const routed = await navigation;
    fixture.detectChanges();
    return routed;
  }

  async function flushNextTokenValidation(user: User): Promise<void> {
    const validateRequest = await waitForHttpRequest((request) => (
      request.method === 'POST' && request.url === '/api/auth/validate-token'
    ));
    expect(validateRequest.request.body).toEqual({});
    validateRequest.flush({ valid: true, user });
  }

  function flushAiMarketingReadModel(): void {
    const overviewRequest = expectGet('/api/ai-marketing/overview');
    expect(overviewRequest.request.params.get('lookbackDays')).toBe('7');
    overviewRequest.flush(overviewFixture());

    const funnelRequest = expectGet('/api/ai-marketing/leads/funnel');
    expect(funnelRequest.request.params.get('lookbackDays')).toBe('7');
    funnelRequest.flush(leadFunnelFixture());

    expectGet('/api/ai-marketing/plans').flush({
      success: true,
      total: 1,
      plans: [approvalPlanFixture()],
    });

    expectGet('/api/ai-marketing/actions/evaluations').flush({
      success: true,
      summary: {},
      evaluations: [],
    });

    const creativeRequest = expectGet('/api/ai-marketing/creatives/performance');
    expect(creativeRequest.request.params.get('lookbackDays')).toBe('7');
    creativeRequest.flush(creativePerformanceFixture());

    expectGet('/api/ai/ads-automation/decision-draft-approvals')
      .flush(decisionDraftApprovalQueueFixture());
  }

  function expectGet(url: string): TestRequest {
    return http!.expectOne((request) => (
      request.method === 'GET' && request.url === url
    ));
  }

  async function waitForHttpRequest(
    predicate: Parameters<HttpTestingController['match']>[0],
  ): Promise<TestRequest> {
    const deadline = Date.now() + 1000;

    while (Date.now() <= deadline) {
      const matches = http!.match(predicate);
      if (matches.length) {
        return matches[0];
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      fixture.detectChanges();
    }

    throw new Error('Timed out waiting for expected HTTP request');
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function planEvidenceLink(): HTMLAnchorElement {
    return requiredLink('.plan-detail a.evidence-link');
  }

  function planSourceSyncLink(): HTMLAnchorElement {
    return requiredLinkByText('.plan-detail a.evidence-link', 'Review source sync');
  }

  function durableEvidenceLink(): HTMLAnchorElement {
    return requiredLinkByText('.durable-queue a.evidence-link', 'Review evidence');
  }

  function requiredLink(selector: string): HTMLAnchorElement {
    const link = fixture.nativeElement.querySelector(selector) as HTMLAnchorElement | null;

    if (!link) {
      throw new Error(`Missing rendered evidence link: ${selector}`);
    }

    return link;
  }

  function requiredLinkByText(selector: string, text: string): HTMLAnchorElement {
    const link = (Array.from(
      fixture.nativeElement.querySelectorAll(selector),
    ) as HTMLAnchorElement[]).find((candidate) => candidate.textContent?.trim() === text) || null;

    if (!link) {
      throw new Error(`Missing rendered link "${text}": ${selector}`);
    }

    return link;
  }

  function approvalIdInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      'input[name="approvalId"]',
    ) as HTMLInputElement | null;

    if (!input) {
      throw new Error('Missing reviewer approval ID input');
    }

    return input;
  }

  function expectNoReviewerDocsReadback(): void {
    http!.expectNone((request) => (
      request.url.includes('/evidence-index/reviewer-docs')
    ));
  }

  function expectNoSourceSyncStatusReadback(): void {
    http!.expectNone((request) => (
      request.url.includes('/platform-source-sync-status')
    ));
  }

  function sourceSyncReportDateInput(): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      'input[name="reportDate"]',
    ) as HTMLInputElement | null;

    if (!input) {
      throw new Error('Missing source-sync reportDate input');
    }

    return input;
  }

  function sourceCheckbox(sourceKey: string): HTMLInputElement {
    const label = (Array.from(
      fixture.nativeElement.querySelectorAll('.source-picker label'),
    ) as HTMLLabelElement[]).find((candidate) => (
      candidate.textContent?.trim() === sourceLabel(sourceKey)
    )) || null;
    const input = label?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

    if (!input) {
      throw new Error(`Missing source checkbox: ${sourceKey}`);
    }

    return input;
  }

  function sourceLabel(sourceKey: string): string {
    if (sourceKey === 'google_ads') return 'Google Ads';
    if (sourceKey === 'advertising_costs') return 'Advertising costs';
    if (sourceKey === 'product_mapping') return 'Product mapping';
    return sourceKey;
  }

  function expectSourceSyncHref(
    href: string | null,
    expected: { reportDate: string; sourceKeys: string; now: string },
  ): void {
    expect(href).toContain('/ai/ads-platform-source-sync-status-reviewer?');
    const url = new URL(href || '', 'http://localhost');
    expect(url.pathname).toBe('/ai/ads-platform-source-sync-status-reviewer');
    expect(url.searchParams.get('reportDate')).toBe(expected.reportDate);
    expect(url.searchParams.get('sourceKeys')).toBe(expected.sourceKeys);
    expect(url.searchParams.get('now')).toBe(expected.now);
  }

  function routerQueryParam(name: string): string | null {
    return new URL(router.url, 'http://localhost').searchParams.get(name);
  }

  function pageText(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent || '';
  }

  async function waitForRouterUrl(expectedUrl: string): Promise<void> {
    const deadline = Date.now() + 1000;

    while (router.url !== expectedUrl) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for router URL ${expectedUrl}; current URL ${router.url}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
  }

  async function waitForRouterPath(expectedPath: string): Promise<void> {
    const deadline = Date.now() + 1000;

    while (!router.url.startsWith(`${expectedPath}?`) && router.url !== expectedPath) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for router path ${expectedPath}; current URL ${router.url}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
  }

  function userForRole(role: UserRole): User {
    return {
      id: `ai-marketing-deeplink-smoke-${role}`,
      email: `${role}@example.local`,
      fullName: `AI Marketing Deeplink Smoke ${role}`,
      role,
      isActive: true,
    };
  }

  function requiredRoute(path: string): Route {
    const route = routes.find((item) => item.path === path);

    if (!route) {
      throw new Error(`Missing app route: ${path}`);
    }

    return route;
  }
});

function approvalPlanFixture(): AdsActionPlan {
  return {
    _id: 'plan-001',
    title: 'Ads automation pending approvals',
    status: 'pending_approval',
    createdAt: '2026-07-04T05:00:00.000Z',
    items: [
      {
        _id: 'item-budget-001',
        actionType: 'update_campaign_budget',
        adGroupId: 'adgroup-001',
        adGroupName: 'Google Search winter herbs',
        targetValue: 1_200_000,
        currentValue: 1_000_000,
        confidence: 88,
        reason: 'Budget update requires evidence review before human decision.',
        status: 'pending',
        metadata: {
          approval_id: 'ADSAPPROVAL-queue-budget-001',
          executionMode: 'manual_or_dry_run_only',
          providerExecutionEnabled: false,
          execution_allowed_now: false,
          reportDate: '2026-07-04',
          sourceSyncEvaluatedAt: '2026-07-04T05:00:00.000Z',
          sourceKeys: ['google_ads', 'advertising_costs', 'product_mapping'],
        },
      },
      {
        _id: 'item-monitor-001',
        actionType: 'monitor_only',
        reason: 'No approval evidence link should render without an approval id.',
        status: 'pending',
      },
    ],
  };
}

function overviewFixture(): AiMarketingOverview {
  return {
    success: true,
    window: { from: '2026-07-01', to: '2026-07-05', lookbackDays: 7 },
    summary: {
      leads: 0,
      orders: 0,
      adsSpent: 0,
      netProfit: 0,
      roi: 0,
      saleIssueAdGroups: 0,
      pendingPlans: 1,
      approvedItemsWaitingApply: 0,
      pendingEvaluations: 0,
    },
    readiness: {
      status: 'manual_or_dry_run_only',
      providerExecutionEnabled: false,
      executionMode: 'manual_or_dry_run_only',
      canReadRealMoney: true,
      canDetectSalesIssues: 'yes',
      canGeneratePlan: true,
      canApplyWithApproval: false,
      canEvaluateAfterApply: true,
      missing: [],
      dataQuality: {
        totalRows: 0,
        highQualityRows: 0,
        mediumQualityRows: 0,
        lowQualityRows: 0,
        minScore: 0,
        avgScore: 0,
      },
    },
    assistantQuality: { score: 100, blockers: [] },
    creativeSummary: {
      totalCreatives: 0,
      creativesWithLeadAttribution: 0,
      totalLeads: 0,
      totalWon: 0,
      totalEstimatedSpend: 0,
      totalNetProfit: 0,
    },
  };
}

function leadFunnelFixture(): LeadFunnelResponse {
  return {
    success: true,
    summary: {
      totalAdGroups: 0,
      totalLeads: 0,
      totalOrders: 0,
      adsSpent: 0,
      netProfit: 0,
      roi: 0,
      closeRate: 0,
      saleIssueAdGroups: 0,
    },
    rows: [],
  };
}

function creativePerformanceFixture(): CreativePerformanceResponse {
  return {
    success: true,
    summary: {
      totalCreatives: 0,
      creativesWithLeadAttribution: 0,
      totalLeads: 0,
      totalWon: 0,
      totalEstimatedSpend: 0,
      totalNetProfit: 0,
    },
    rows: [],
    notes: [],
  };
}

function decisionDraftApprovalQueueFixture(): AdsDecisionDraftApprovalQueueResponse {
  return {
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
        approval_id: 'ADSAPPROVAL-durable-budget-001',
        source_draft_id: 'draft-budget-001',
        source_decision_id: 'decision-budget-001',
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
        typedPayload: { title: 'Durable budget increase needs manager approval.' },
        sourceSyncDecisionEvidence: [
          {
            sourceKey: 'google_ads',
            reportDate: '2026-07-04',
            freshnessStatus: 'stale',
            coverageStatus: 'covered',
            lastSuccessfulSyncAt: '2026-07-03T20:00:00.000Z',
            latestRecordDate: '2026-07-04',
            blockingReason: 'google_ads_not_ready_for_ads_automation_decision',
            blockingReasons: ['freshness_stale', 'google_ads_not_ready_for_ads_automation_decision'],
            canUseForAdsAutomationDecision: false,
          },
          {
            sourceKey: 'advertising_costs',
            reportDate: '2026-07-04',
            freshnessStatus: 'fresh',
            coverageStatus: 'covered',
            lastSuccessfulSyncAt: null,
            latestRecordDate: '2026-07-04',
            blockingReason: null,
            blockingReasons: [],
            canUseForAdsAutomationDecision: true,
          },
          {
            sourceKey: 'product_mapping',
            reportDate: '2026-07-04',
            freshnessStatus: 'fresh',
            coverageStatus: 'not_applicable',
            lastSuccessfulSyncAt: null,
            latestRecordDate: null,
            blockingReason: null,
            blockingReasons: [],
            canUseForAdsAutomationDecision: true,
          },
        ],
        sourceSyncDecisionGates: {
          canGenerateActionDraft: false,
          canUseGoogleAdsDataClaim: false,
          canDryRun: false,
          canExecuteLive: false,
        },
        blockers: [],
        missing_data_blockers: [],
        idempotency_key: 'approval-idempotency-001',
        rationale: 'Budget increase is blocked until manager reviews evidence.',
        createdAt: '2026-07-05T05:20:00+07:00',
        persistedAt: '2026-07-05T05:20:01+07:00',
      },
    ],
  };
}
