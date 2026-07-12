import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AiMarketingComponent } from './ai-marketing.component';
import { AdsActionPlan, AiMarketingService } from './ai-marketing.service';

describe('AiMarketingComponent approval evidence links', () => {
  let fixture: ComponentFixture<AiMarketingComponent>;
  let component: AiMarketingComponent;
  let service: jasmine.SpyObj<AiMarketingService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<AiMarketingService>('AiMarketingService', [
      'getOverview',
      'getLeadFunnel',
      'listPlans',
      'listDecisionDraftApprovals',
      'listEvaluations',
      'getCreativePerformance',
      'syncLeads',
      'generatePlan',
      'approveItem',
      'applyPlan',
      'runAdGroupAction',
    ]);

    service.getOverview.and.returnValue(of(overviewFixture()));
    service.getLeadFunnel.and.returnValue(of({
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
    }));
    service.listPlans.and.returnValue(of({
      success: true,
      total: 1,
      plans: [approvalPlanFixture()],
    }));
    service.listDecisionDraftApprovals.and.returnValue(of(decisionDraftApprovalQueueFixture()));
    service.listEvaluations.and.returnValue(of({ success: true, summary: {}, evaluations: [] }));
    service.getCreativePerformance.and.returnValue(of({
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
    }));

    await TestBed.configureTestingModule({
      imports: [AiMarketingComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AiMarketingService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiMarketingComponent);
    component = fixture.componentInstance;
  });

  it('renders a reviewer deep link for pending queue items with an approval id', () => {
    fixture.detectChanges();

    const links = planDetailLinks('Review evidence');

    expect(links.length).toBe(1);
    expect(links[0].textContent?.trim()).toBe('Review evidence');
    expect(links[0].getAttribute('href')).toBe(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-queue-budget-001',
    );
  });

  it('normalizes supported queue approval id field names into reviewer query params', () => {
    expect(component.approvalEvidenceQueryParams({
      _id: 'item-top-level',
      approvalId: ' ADSAPPROVAL-top-level ',
      actionType: 'update_campaign_budget',
      status: 'pending',
    })?.approval_id).toBe('ADSAPPROVAL-top-level');

    expect(component.approvalEvidenceQueryParams({
      _id: 'item-metadata',
      actionType: 'update_campaign_budget',
      status: 'pending',
      metadata: { adsAutomationApprovalId: ' ADSAPPROVAL-metadata ' },
    })?.approval_id).toBe('ADSAPPROVAL-metadata');

    expect(component.approvalEvidenceQueryParams({
      _id: 'item-without-approval',
      actionType: 'monitor_only',
      status: 'pending',
    })).toBeNull();
  });

  it('renders source-sync status links prefilled from draft-preview metadata and durable evidence', () => {
    fixture.detectChanges();

    const planLinks = planDetailLinks('Review source sync');
    const durableLinks = durableQueueLinks('Review source sync');

    expect(planLinks.length).toBe(1);
    expectSourceSyncHref(planLinks[0].getAttribute('href'), {
      reportDate: '2026-07-04',
      sourceKeys: 'google_ads,advertising_costs,product_mapping',
      now: '2026-07-04T05:00:00.000Z',
    });

    expect(durableLinks.length).toBe(1);
    expectSourceSyncHref(durableLinks[0].getAttribute('href'), {
      reportDate: '2026-07-04',
      sourceKeys: 'google_ads,advertising_costs,product_mapping',
      now: '2026-07-05T05:20:01+07:00',
    });
  });

  it('renders durable approval queue records with reviewer deep links', () => {
    fixture.detectChanges();

    const queue = fixture.nativeElement.querySelector('.durable-queue') as HTMLElement;
    const links = durableQueueLinks('Review evidence');

    expect(queue.textContent).toContain('1 pending');
    expect(queue.textContent).toContain('ADSAPPROVAL-durable-budget-001');
    expect(queue.textContent).toContain('Durable budget increase needs manager approval.');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe(
      '/ai/ads-approval-evidence-reviewer?approval_id=ADSAPPROVAL-durable-budget-001',
    );
  });

  function planDetailLinks(label: string): HTMLAnchorElement[] {
    return linksByText('.plan-detail a.evidence-link', label);
  }

  function durableQueueLinks(label: string): HTMLAnchorElement[] {
    return linksByText('.durable-queue a.evidence-link', label);
  }

  function linksByText(selector: string, label: string): HTMLAnchorElement[] {
    return (Array.from(
      fixture.nativeElement.querySelectorAll(selector),
    ) as HTMLAnchorElement[]).filter((link) => link.textContent?.trim() === label);
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

function overviewFixture() {
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

function decisionDraftApprovalQueueFixture() {
  return {
    schemaVersion: 'ads_automation_decision_draft_approval_queue.v1' as const,
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
