import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { GoogleAdsCampaignComponent } from './google-ads-campaign.component';
import {
  GoogleAdsCampaignService,
  GoogleCampaignActionPlan,
} from './google-ads-campaign.service';

describe('GoogleAdsCampaignComponent', () => {
  let fixture: ComponentFixture<GoogleAdsCampaignComponent>;
  let component: GoogleAdsCampaignComponent;
  let api: jasmine.SpyObj<GoogleAdsCampaignService>;
  const user = signal<any>({ _id: 'planner-1' });
  const permissions = new Set([
    'google-ads.read',
    'google-ads.plan',
    'google-ads.approve',
    'google-ads.execute',
  ]);

  beforeEach(async () => {
    user.set({ _id: 'planner-1' });
    permissions.clear();
    [
      'google-ads.read',
      'google-ads.plan',
      'google-ads.approve',
      'google-ads.execute',
    ].forEach((permission) => permissions.add(permission));
    api = jasmine.createSpyObj<GoogleAdsCampaignService>('GoogleAdsCampaignService', [
      'getCapabilities',
      'getAccountOptions',
      'getCampaignOptions',
      'getAdGroupOptions',
      'getKeywordOptions',
      'getResponsiveSearchAdOptions',
      'getSearchReadiness',
      'getBiddingLifecycle',
      'updateBiddingLifecycle',
      'evaluateBiddingLifecycle',
      'createPlan',
      'materializePauseReviewDrafts',
      'getPlan',
      'validatePlan',
      'approveItem',
      'rejectItem',
      'executePlan',
      'getExecutions',
    ]);
    api.getCapabilities.and.returnValue(of(capabilityFixture()));
    api.getAccountOptions.and.returnValue(of([accountFixture()]));
    api.getCampaignOptions.and.returnValue(of([campaignFixture()]));
    api.getAdGroupOptions.and.returnValue(of([adGroupFixture()]));
    api.getKeywordOptions.and.returnValue(of([keywordFixture()]));
    api.getResponsiveSearchAdOptions.and.returnValue(of([responsiveSearchAdFixture()]));
    api.getSearchReadiness.and.returnValue(of({
      ready: true,
      conversionTrackingConfigured: true,
      conversionGoalsConfigured: true,
      trackingConfigured: true,
      landingPageAllowlisted: true,
    }));
    api.getBiddingLifecycle.and.returnValue(of(biddingLifecycleFixture()));
    api.updateBiddingLifecycle.and.returnValue(of(biddingLifecycleFixture()));
    api.evaluateBiddingLifecycle.and.returnValue(of(biddingLifecycleFixture()));
    api.materializePauseReviewDrafts.and.returnValue(of({
      platform: 'google_ads',
      created: 0,
      deduplicated: 0,
      rejected: 0,
      eligible: 0,
      drafts: [],
    }));
    api.getExecutions.and.returnValue(of([]));
    api.getPlan.and.returnValue(of(planFixture()));

    await TestBed.configureTestingModule({
      imports: [GoogleAdsCampaignComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: GoogleAdsCampaignService, useValue: api },
        {
          provide: AuthService,
          useValue: {
            user,
            hasPermission: (permission: string) => permissions.has(permission),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleAdsCampaignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the server-owned Search/PAUSED policy without secret inputs', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('SEARCH only');
    expect(text).toContain('New = PAUSED');
    expect(text).toContain('Trình duyệt không gọi Google Ads');
    expect(fixture.nativeElement.querySelector('input[name="accessToken"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="developerToken"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="refreshToken"]')).toBeNull();
    component.selectResource('keyword');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="negativeKeyword"]')).toBeNull();
    expect(api.getCapabilities).toHaveBeenCalledWith(undefined);
  });

  it('creates only the browser DTO while ERP owns source, resource names and forced fields', () => {
    api.createPlan.and.returnValue(of(planFixture({ createdByUserId: 'planner-1' })));
    populateCreateForm();

    component.createPlan();

    const request = api.createPlan.calls.mostRecent().args[0];
    expect(request).toEqual({
      planName: 'Tạo Search campaign - Tìm kiếm tháng 8',
      actions: [{
        actionType: 'create_search_campaign',
        customerId: '1234567890',
        campaignId: undefined,
        reason: 'Ngân sách đã qua Financial Control',
        idempotencyKey: jasmine.stringMatching(/^GOOGLE-ERP-UI-/) as any,
        payload: {
          campaignName: 'Tìm kiếm tháng 8',
          budgetName: 'Budget tìm kiếm tháng 8',
          dailyBudgetVnd: 600_000,
          biddingStrategyType: 'MAXIMIZE_CLICKS',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          searchPartnersEnabled: false,
          geoTargetConstantIds: ['2704'],
          languageConstantIds: ['1040'],
          positiveGeoTargetType: 'PRESENCE',
          doesNotContainEuPoliticalAdvertising: true,
        },
      }],
    });
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('source');
    expect(serialized).not.toContain('loginCustomerId');
    expect(serialized).not.toContain('typedPayload');
    expect(serialized).not.toContain('resourceName');
    expect(serialized).not.toContain('status');
    expect(serialized).not.toContain('advertisingChannelType');
    expect(serialized).not.toContain('token');
  });

  it('builds campaign update and pause as drafts using a canonical campaign', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectOperation('update');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();
    component.form.campaignName = 'Search cập nhật';
    component.form.endDate = '2026-09-15';
    component.form.reason = 'Điều chỉnh theo ngân sách được duyệt';
    component.form.dailyBudgetVnd = 800_000;

    component.createPlan();

    expect(component.error()).toBe('');
    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'update_search_campaign',
      customerId: '1234567890',
      campaignId: '9876543210',
      payload: {
        campaignName: 'Search cập nhật',
        endDate: '2026-09-15',
        dailyBudgetVnd: 800_000,
      },
    }));

    component.selectOperation('pause');
    component.createPlan();
    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'pause_campaign',
      campaignId: '9876543210',
      payload: {},
    }));
    expect(api.executePlan).not.toHaveBeenCalled();
  });

  it('requires targeting, political declaration and a real campaign budget mapping', () => {
    populateCreateForm();
    component.form.geoTargetConstantIds = [];
    component.createPlan();
    expect(component.error()).toContain('geo target ID');

    component.form.geoTargetConstantIds = ['2704'];
    component.form.doesNotContainEuPoliticalAdvertising = false;
    component.createPlan();
    expect(component.error()).toContain('quảng cáo chính trị EU');

    api.getCampaignOptions.and.returnValue(of([{
      ...campaignFixture(),
      campaignBudgetId: undefined,
      campaignBudgetResourceName: undefined,
    }]));
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectOperation('update');
    component.form.campaignId = '9876543210';
    component.form.dailyBudgetVnd = 700_000;
    component.form.reason = 'Điều chỉnh ngân sách campaign';
    component.createPlan();
    expect(component.error()).toContain('không được fallback từ campaignId');
  });

  it('blocks self-approval and enforces a different approver for live execution', () => {
    const plan = planFixture({ createdByUserId: 'planner-1' });
    component.plan.set(plan);
    component.approve(plan.items[0]);
    expect(component.creatorConflict()).toBeTrue();
    expect(api.approveItem).not.toHaveBeenCalled();

    user.set({ _id: 'approver-1' });
    plan.createdByUserId = 'planner-1';
    plan.items[0].status = 'approved';
    plan.items[0].approvedByUserId = 'approver-1';
    component.plan.set({ ...plan, items: [...plan.items] });
    component.executions.set([{ status: 'success', dryRun: true }]);
    component.liveConfirmation = plan.planId;
    component.execute(false);
    expect(component.approverConflict()).toBeTrue();
    expect(api.executePlan).not.toHaveBeenCalled();
  });

  it('requires validate, approval, dry-run and typed confirmation before ERP live execution', () => {
    user.set({ _id: 'executor-1' });
    const plan = planFixture({
      createdByUserId: 'planner-1',
      items: [{
        ...planFixture().items[0],
        status: 'approved',
        approvedByUserId: 'approver-1',
      }],
    });
    component.plan.set(plan);
    api.executePlan.and.returnValue(of({ executionId: 'EXEC-1', status: 'success', dryRun: false }));

    component.execute(false);
    expect(api.executePlan).not.toHaveBeenCalled();

    component.executions.set([{ status: 'success', dryRun: true }]);
    component.liveConfirmation = plan.planId;
    component.execute(false);

    expect(api.executePlan).toHaveBeenCalledOnceWith('GOOGLE-PLAN-1', ['GOOGLE-ACTION-1'], false);
  });

  it('creates staged typed Ad Group and keyword drafts from canonical parents', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.form.campaignId = '9876543210';

    component.selectResource('ad_group');
    component.onCampaignChange();
    component.resourceForm.adGroupName = 'Sản phẩm chủ lực';
    component.resourceForm.cpcBidVnd = 4_500;
    component.form.reason = 'Tạo nhóm quảng cáo theo ngân sách đã duyệt';
    component.createPlan();

    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'create_ad_group',
      customerId: '1234567890',
      campaignId: '9876543210',
      payload: { adGroupName: 'Sản phẩm chủ lực', cpcBidVnd: 4_500 },
    }));

    component.selectResource('keyword');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();
    component.resourceForm.adGroupId = '333444555';
    component.resourceForm.keywordText = 'nông sản sạch';
    component.resourceForm.matchType = 'PHRASE';
    component.resourceForm.negative = false;
    component.resourceForm.finalUrl = 'https://htxbachgia.shop/nong-san';
    component.form.reason = 'Bổ sung keyword theo kế hoạch tìm kiếm';
    component.createPlan();

    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'create_keyword',
      campaignId: '9876543210',
      adGroupId: '333444555',
      payload: jasmine.objectContaining({
        keywordText: 'nông sản sạch',
        matchType: 'PHRASE',
        negative: false,
        finalUrl: 'https://htxbachgia.shop/nong-san',
      }),
    }));
    expect(JSON.stringify(api.createPlan.calls.mostRecent().args[0])).not.toContain('resourceName');
  });

  it('validates and creates a PAUSED-safe Responsive Search Ad draft with tracking fields', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectResource('responsive_search_ad');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();
    component.resourceForm.adGroupId = '333444555';
    component.resourceForm.finalUrl = 'https://htxbachgia.shop/san-pham';
    component.onHeadlinesInput('Nông sản sạch\nGiao hàng nhanh\nNguồn gốc rõ ràng');
    component.onDescriptionsInput('Mua nông sản hợp tác xã chính hãng.\nĐặt hàng trực tuyến, giao hàng tận nơi.');
    component.resourceForm.path1 = 'nong-san';
    component.resourceForm.trackingUrlTemplate = 'https://tracker.example.com/click?url={lpurl}';
    component.resourceForm.finalUrlSuffix = 'utm_source=google&utm_medium=cpc';
    component.form.reason = 'Tạo RSA theo nội dung đã được phê duyệt';

    component.createPlan();

    expect(component.error()).toBe('');
    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'create_responsive_search_ad',
      adGroupId: '333444555',
      payload: jasmine.objectContaining({
        finalUrl: 'https://htxbachgia.shop/san-pham',
        headlines: ['Nông sản sạch', 'Giao hàng nhanh', 'Nguồn gốc rõ ràng'],
        descriptions: ['Mua nông sản hợp tác xã chính hãng.', 'Đặt hàng trực tuyến, giao hàng tận nơi.'],
        trackingUrlTemplate: 'https://tracker.example.com/click?url={lpurl}',
        finalUrlSuffix: 'utm_source=google&utm_medium=cpc',
      }),
    }));
  });

  it('resends unchanged RSA pins whenever headline or description text is replaced', () => {
    const current = {
      ...responsiveSearchAdFixture(),
      headlinePins: [{ index: 0, pinnedField: 'HEADLINE_1' as const }],
      descriptionPins: [{ index: 1, pinnedField: 'DESCRIPTION_2' as const }],
    };
    component.responsiveSearchAds.set([current]);
    component.resourceForm.adId = current.adId;
    component.operation.set('update');
    component.onResponsiveSearchAdChange();
    component.onHeadlinesInput([
      'NÃ´ng sáº£n sáº¡ch má»›i',
      'Giao hÃ ng nhanh',
      'Nguá»“n gá»‘c rÃµ rÃ ng',
    ].join('\n'));
    component.onDescriptionsInput([
      'Sáº£n pháº©m chÃ­nh hÃ£ng má»›i',
      'Giao hÃ ng táº­n nÆ¡i',
    ].join('\n'));

    const payload = (component as any).buildResponsiveSearchAdPayload(true);

    expect(payload.headlinePins).toEqual([{ index: 0, pinnedField: 'HEADLINE_1' }]);
    expect(payload.descriptionPins).toEqual([{ index: 1, pinnedField: 'DESCRIPTION_2' }]);
  });

  it('resends the full RSA asset list for a pin-only edit', () => {
    const current = {
      ...responsiveSearchAdFixture(),
      policyApprovalStatus: 'APPROVED',
      headlinePins: [] as any[],
      descriptionPins: [] as any[],
    };
    component.responsiveSearchAds.set([current]);
    component.resourceForm.adId = current.adId;
    component.operation.set('update');
    component.onResponsiveSearchAdChange();
    component.resourceForm.headlinePinFields[1] = 'HEADLINE_2';
    component.resourceForm.descriptionPinFields[0] = 'DESCRIPTION_1';

    const payload = (component as any).buildResponsiveSearchAdPayload(true);

    expect(payload.headlines).toEqual(component.resourceForm.headlines);
    expect(payload.descriptions).toEqual(component.resourceForm.descriptions);
    expect(payload.headlinePins).toEqual([{ index: 1, pinnedField: 'HEADLINE_2' }]);
    expect(payload.descriptionPins).toEqual([{ index: 0, pinnedField: 'DESCRIPTION_1' }]);
  });

  it('uses canonical IDs for child update/pause and blocks negative keyword mutation', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectResource('keyword');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();
    component.resourceForm.adGroupId = '333444555';
    component.onAdGroupChange();
    component.selectOperation('pause');
    component.resourceForm.criterionId = '777888999';
    component.form.reason = 'Dừng keyword do hiệu quả thấp kéo dài';

    component.createPlan();

    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'pause_keyword',
      customerId: '1234567890',
      campaignId: '9876543210',
      adGroupId: '333444555',
      criterionId: '777888999',
      payload: {},
    }));

    component.keywords.set([{
      ...keywordFixture(),
      criterionId: '999000111',
      keywordText: 'hàng giả',
      negative: true,
      mutable: false,
    }]);
    component.resourceForm.criterionId = '999000111';
    component.createPlan();
    expect(component.error()).toContain('negative keyword');
    expect(api.createPlan).toHaveBeenCalledTimes(1);
  });

  it('loads and saves the complete draft-only bidding lifecycle policy', () => {
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectOperation('update');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();

    expect(api.getBiddingLifecycle).toHaveBeenCalledWith('1234567890', '9876543210');
    expect(component.biddingLifecycleLoaded()).toBeTrue();
    expect(component.biddingLifecycleForm.clickThreshold).toBe(50);

    component.biddingLifecycleForm.maxCpcBidCeilingVnd = 9_000;
    component.biddingLifecycleForm.targetCpaVnd = 150_000;
    component.saveBiddingLifecycle();

    expect(component.error()).toBe('');
    expect(api.updateBiddingLifecycle).toHaveBeenCalledOnceWith(
      '1234567890',
      '9876543210',
      {
        enabled: true,
        clickThreshold: 50,
        clickWindowDays: 30,
        maxCpcBidCeilingVnd: 9_000,
        maximizeConversionsMinConversions: 15,
        conversionWindowDays: 30,
        targetCpaMinConversions: 30,
        targetCpaVnd: 150_000,
        cooldownHours: 168,
        minimumStageDwellHours: 168,
        draftOnly: true,
      },
    );
    expect(api.executePlan).not.toHaveBeenCalled();
  });

  it('blocks invalid lifecycle thresholds before the policy reaches ERP', () => {
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectOperation('update');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();
    component.biddingLifecycleForm.maximizeConversionsMinConversions = 40;
    component.biddingLifecycleForm.targetCpaMinConversions = 30;

    component.saveBiddingLifecycle();

    expect(component.error()).toContain('không được thấp hơn');
    expect(api.updateBiddingLifecycle).not.toHaveBeenCalled();
  });

  it('evaluates into a pending draft and reuses the guarded approval workflow', () => {
    api.evaluateBiddingLifecycle.and.returnValue(of({
      ...biddingLifecycleFixture(),
      state: {
        ...biddingLifecycleFixture().state,
        pendingDraft: {
          planId: 'GOOGLE-AUTO-BID-1',
          actionId: 'GOOGLE-AUTO-ACTION-1',
          fromStage: 'MAXIMIZE_CLICKS',
          toStage: 'MAXIMIZE_CLICKS_CPC_CEILING',
          status: 'draft',
        },
      },
    }));
    component.form.customerId = '1234567890';
    component.onAccountChange();
    component.selectOperation('update');
    component.form.campaignId = '9876543210';
    component.onCampaignChange();

    component.evaluateBiddingLifecycle();

    expect(api.evaluateBiddingLifecycle).toHaveBeenCalledOnceWith('1234567890', '9876543210');
    expect(component.biddingLifecyclePendingDraftPlanId()).toBe('GOOGLE-AUTO-BID-1');
    expect(api.executePlan).not.toHaveBeenCalled();

    component.openBiddingLifecycleDraft();
    expect(api.getPlan).toHaveBeenCalledWith('GOOGLE-AUTO-BID-1');
    expect(api.executePlan).not.toHaveBeenCalled();

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Maximize Clicks + CPC ceiling');
    expect(text).toContain('Không có chế độ auto execute');
  });

  function populateCreateForm(): void {
    component.form.customerId = '1234567890';
    component.form.campaignName = 'Tìm kiếm tháng 8';
    component.form.budgetName = 'Budget tìm kiếm tháng 8';
    component.form.dailyBudgetVnd = 600_000;
    component.form.biddingStrategyType = 'MAXIMIZE_CLICKS';
    component.form.startDate = '2026-08-01';
    component.form.endDate = '2026-08-31';
    component.form.searchPartnersEnabled = false;
    component.form.geoTargetConstantIds = ['2704'];
    component.form.languageConstantIds = ['1040'];
    component.form.positiveGeoTargetType = 'PRESENCE';
    component.form.doesNotContainEuPoliticalAdvertising = true;
    component.form.reason = 'Ngân sách đã qua Financial Control';
  }

  function biddingLifecycleFixture() {
    return {
      policy: {
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
      },
      state: {
        currentStage: 'MAXIMIZE_CLICKS' as const,
        canonicalBiddingStrategyType: 'MAXIMIZE_CLICKS' as const,
        observedClicks: 42,
        observedConversions: 4,
        observedCpaVnd: 110_000,
        metricsFrom: '2026-07-01',
        metricsTo: '2026-07-30',
        lastEvaluatedAt: '2026-07-30T09:00:00.000Z',
        blockers: [] as string[],
      },
    };
  }

  function capabilityFixture() {
    return {
      provider: 'google' as const,
      apiVersion: 'v24',
      channelTypes: ['SEARCH'],
      biddingStrategies: [
        'MANUAL_CPC' as const,
        'MAXIMIZE_CLICKS' as const,
        'MAXIMIZE_CONVERSIONS' as const,
        'MAXIMIZE_CONVERSION_VALUE' as const,
      ],
      invariants: { createStatus: 'PAUSED' as const, advertisingChannelType: 'SEARCH' as const, currency: 'VND' as const },
      defaults: {
        geoTargetConstantIds: ['2704'],
        languageConstantIds: ['1040'],
        positiveGeoTargetType: 'PRESENCE' as const,
        searchPartnersEnabled: false,
      },
      biddingLifecycle: {
        supported: true,
        draftOnly: true,
        defaultEnabled: false,
        defaultClickThreshold: 50,
        stages: [
          'MAXIMIZE_CLICKS' as const,
          'MAXIMIZE_CLICKS_CPC_CEILING' as const,
          'MAXIMIZE_CONVERSIONS' as const,
          'MAXIMIZE_CONVERSIONS_TARGET_CPA' as const,
        ],
      },
      productionEnabled: true,
      liveActionGates: { create: true, update: true, pause: true },
    };
  }

  function accountFixture() {
    return {
      customerId: '1234567890',
      descriptiveName: 'ERP Search Account',
      currencyCode: 'VND',
      timeZone: 'Asia/Ho_Chi_Minh',
      eligible: true,
      liveEligible: true,
    };
  }

  function campaignFixture() {
    return {
      campaignId: '9876543210',
      campaignResourceName: 'customers/1234567890/campaigns/9876543210',
      campaignBudgetId: '111222333',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/111222333',
      name: 'Search hiện tại',
      status: 'ENABLED',
      advertisingChannelType: 'SEARCH',
      dailyBudgetVnd: 500_000,
      endDate: '2026-09-30',
      eligible: true,
      liveEligible: true,
    };
  }

  function adGroupFixture() {
    return {
      campaignId: '9876543210',
      adGroupId: '333444555',
      resourceName: 'customers/1234567890/adGroups/333444555',
      adGroupName: 'Ad Group hiện tại',
      status: 'ENABLED',
      cpcBidVnd: 3_000,
      eligible: true,
      liveEligible: true,
    };
  }

  function keywordFixture() {
    return {
      campaignId: '9876543210',
      adGroupId: '333444555',
      criterionId: '777888999',
      resourceName: 'customers/1234567890/adGroupCriteria/333444555~777888999',
      keywordText: 'nông sản sạch',
      matchType: 'PHRASE' as const,
      negative: false,
      status: 'ENABLED',
    };
  }

  function responsiveSearchAdFixture() {
    return {
      campaignId: '9876543210',
      adGroupId: '333444555',
      adId: '123123123',
      resourceName: 'customers/1234567890/adGroupAds/333444555~123123123',
      status: 'ENABLED',
      finalUrls: ['https://htxbachgia.shop/san-pham'],
      headlines: ['Nông sản sạch', 'Giao hàng nhanh', 'Nguồn gốc rõ ràng'],
      descriptions: ['Sản phẩm chính hãng', 'Giao hàng tận nơi'],
    };
  }

  function planFixture(overrides: Partial<GoogleCampaignActionPlan> = {}): GoogleCampaignActionPlan {
    return {
      planId: 'GOOGLE-PLAN-1',
      planName: 'Tạo Search campaign - Tìm kiếm tháng 8',
      source: 'erp_ui',
      status: 'pending_approval',
      providerValidationStatus: 'passed',
      createdByUserId: 'another-planner',
      items: [{
        actionId: 'GOOGLE-ACTION-1',
        actionType: 'create_search_campaign',
        customerId: '1234567890',
        status: 'pending',
        providerValidationStatus: 'provider_validate_passed',
      }],
      ...overrides,
    };
  }
});
