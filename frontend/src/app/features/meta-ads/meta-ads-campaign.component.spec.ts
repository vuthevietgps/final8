import { provideZonelessChangeDetection, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MetaAdsCampaignComponent } from './meta-ads-campaign.component';
import {
  MetaAdsCampaignService,
  MetaCampaignActionPlan,
} from './meta-ads-campaign.service';

describe('MetaAdsCampaignComponent', () => {
  let fixture: ComponentFixture<MetaAdsCampaignComponent>;
  let component: MetaAdsCampaignComponent;
  let api: jasmine.SpyObj<MetaAdsCampaignService>;
  let permissions: Set<string>;
  let permissionRevision: WritableSignal<number>;
  const user = signal<any>({ _id: 'planner-1' });

  beforeEach(async () => {
    user.set({ _id: 'planner-1' });
    permissionRevision = signal(0);
    permissions = new Set([
      'meta-ads.read',
      'meta-ads.plan',
      'meta-ads.validate',
      'meta-ads.approve',
      'meta-ads.execute',
    ]);
    api = jasmine.createSpyObj<MetaAdsCampaignService>('MetaAdsCampaignService', [
      'getCapabilities',
      'getAdAccountOptions',
      'getCampaignOptions',
      'createPlan',
      'materializePauseReviewDrafts',
      'getPlan',
      'validatePlan',
      'approveAction',
      'rejectAction',
      'executePlan',
      'getExecutions',
    ]);
    api.getCapabilities.and.returnValue(of(capabilityFixture()));
    api.getAdAccountOptions.and.returnValue(of([{
      adAccountId: '123456789',
      name: 'ERP Meta Account',
      currency: 'VND',
      timezoneId: 'Asia/Ho_Chi_Minh',
      eligible: true,
      blockers: [],
    }]));
    api.getCampaignOptions.and.returnValue(of([]));
    api.getExecutions.and.returnValue(of([]));
    api.materializePauseReviewDrafts.and.returnValue(of({
      platform: 'meta_ads',
      created: 0,
      deduplicated: 0,
      rejected: 0,
      eligible: 0,
      drafts: [],
    }));

    await TestBed.configureTestingModule({
      imports: [MetaAdsCampaignComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MetaAdsCampaignService, useValue: api },
        {
          provide: AuthService,
          useValue: {
            user,
            hasPermission: (permission: string) => {
              permissionRevision();
              return permissions.has(permission);
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MetaAdsCampaignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads six ODAX objectives and immutable PAUSED/AUCTION policy from ERP capabilities', () => {
    const text = fixture.nativeElement.textContent;

    expect(api.getCapabilities).toHaveBeenCalledWith(undefined);
    expect(component.objectiveOptions()).toHaveSize(6);
    expect(text).toContain('Trạng thái ban đầu: PAUSED');
    expect(text).toContain('Buying type: AUCTION');
    expect(text).toContain('Live mặc định tắt');
    expect(text).toContain('Tạo tiếp Ad Set, Creative và Ad');
    expect(text).not.toContain('graph.facebook.com');
    expect(fixture.nativeElement.querySelector('input[name="accessToken"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[inputmode="numeric"][placeholder="123456789"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
  });

  it('creates only the canonical typed draft and leaves safety defaults to the server', () => {
    const response = planFixture({ createdByUserId: 'planner-1' });
    api.createPlan.and.returnValue(of(response));
    component.form.adAccountId = 'act_123456789';
    component.form.name = 'Doanh số tháng 8';
    component.form.objective = 'OUTCOME_SALES';
    component.form.budgetMode = 'CBO';
    component.form.budgetType = 'DAILY';
    component.form.dailyBudgetVnd = 750_000;
    component.form.bidStrategy = 'LOWEST_COST_WITHOUT_CAP';
    component.form.spendCapVnd = 5_000_000;
    component.form.startTime = '2026-08-01T08:00';
    component.form.stopTime = '2026-08-31T23:00';
    component.form.reason = 'Ngân sách đã qua Financial Control';

    component.createPlan();

    expect(api.createPlan).toHaveBeenCalledOnceWith({
      planName: 'Tạo campaign - Doanh số tháng 8',
      actions: [{
        actionType: 'create_campaign',
        adAccountId: '123456789',
        campaignId: undefined,
        idempotencyKey: jasmine.stringMatching(/^META-UI-/),
        reason: 'Ngân sách đã qua Financial Control',
        payload: {
          name: 'Doanh số tháng 8',
          objective: 'OUTCOME_SALES',
          budgetMode: 'CBO',
          budgetType: 'DAILY',
          bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
          dailyBudgetVnd: 750_000,
          spendCapVnd: 5_000_000,
          startTime: new Date('2026-08-01T08:00:00+07:00').toISOString(),
          stopTime: new Date('2026-08-31T23:00:00+07:00').toISOString(),
          specialAdCategories: ['NONE'],
        },
      }],
    });
    const serialized = JSON.stringify(api.createPlan.calls.mostRecent().args[0]);
    expect(serialized).not.toContain('status');
    expect(serialized).not.toContain('buyingType');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('providerUrl');
    expect(serialized).not.toContain('rawPayload');
    expect(serialized).not.toContain('productionEnabled');
    expect(component.planId()).toBe('META-PLAN-001');
  });

  it('builds update and pause as action-plan drafts instead of direct mutations', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.adAccountId = 'act_123456789';
    component.selectOperation('update');
    component.form.campaignId = '987654321';
    component.form.name = 'Tên campaign mới';
    component.form.dailyBudgetVnd = 900_000;
    component.form.spendCapVnd = 8_000_000;
    component.form.stopTime = '2026-09-30T23:00';
    component.form.reason = 'Giảm ngân sách theo phê duyệt kinh doanh';
    component.createPlan();

    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'update_campaign',
      campaignId: '987654321',
      payload: {
        name: 'Tên campaign mới',
        dailyBudgetVnd: 900_000,
        spendCapVnd: 8_000_000,
        stopTime: new Date('2026-09-30T23:00:00+07:00').toISOString(),
      },
    }));
    const updatePayload = api.createPlan.calls.mostRecent().args[0].actions[0].payload;
    expect(updatePayload.objective).toBeUndefined();
    expect(updatePayload.bidStrategy).toBeUndefined();
    expect(updatePayload.specialAdCategories).toBeUndefined();

    component.selectOperation('pause');
    component.createPlan();
    expect(api.createPlan.calls.mostRecent().args[0].actions[0]).toEqual(jasmine.objectContaining({
      actionType: 'pause_campaign',
      campaignId: '987654321',
      payload: {},
    }));
    expect(api.executePlan).not.toHaveBeenCalled();
  });

  it('builds pause_ad_set with exact Campaign and Ad Set IDs and an empty payload', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.adAccountId = 'act_123456789';
    component.selectResourceStage('ad_set');
    component.selectDeliveryOperation('pause');
    component.deliveryForm.campaignId = '987654321';
    component.deliveryForm.adSetId = '1122334455';
    component.form.reason = 'Tạm dừng Ad Set đang lỗ theo evidence ERP';

    component.createPlan();

    expect(api.createPlan).toHaveBeenCalled();
    expect(api.createPlan.calls.mostRecent().args[0]).toEqual({
      planName: 'Tạm dừng Ad Set - 1122334455',
      actions: [{
        actionType: 'pause_ad_set',
        adAccountId: '123456789',
        campaignId: '987654321',
        adSetId: '1122334455',
        reason: 'Tạm dừng Ad Set đang lỗ theo evidence ERP',
        idempotencyKey: jasmine.stringMatching(/^META-UI-/),
        payload: {},
      }],
    });
    expect(api.executePlan).not.toHaveBeenCalled();
  });

  it('requires App ID and ISO countries for conditional campaign fields', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.adAccountId = '123456789';
    component.form.name = 'App campaign';
    component.form.objective = 'OUTCOME_APP_PROMOTION';
    component.form.budgetMode = 'ABO';
    component.form.budgetType = 'NONE';
    component.form.appId = '';
    component.form.reason = 'Cấu hình campaign app đã được phê duyệt';

    component.createPlan();
    expect(component.error()).toContain('App ID');
    expect(api.createPlan).not.toHaveBeenCalled();

    component.form.appId = '778899';
    component.form.specialAdCategories = ['HOUSING'];
    component.onSpecialCountriesInput('Vietnam');
    component.createPlan();
    expect(component.error()).toContain('ISO alpha-2');

    component.onSpecialCountriesInput('vn, US');
    component.createPlan();
    expect(api.createPlan).toHaveBeenCalled();
    expect(api.createPlan.calls.mostRecent().args[0].actions[0].payload).toEqual(jasmine.objectContaining({
      appId: '778899',
      specialAdCategories: ['HOUSING'],
      specialAdCategoryCountries: ['VN', 'US'],
    }));
  });

  it('enforces ABO/CBO combinations and clears campaign budget when switching to ABO', () => {
    component.form.adAccountId = '123456789';
    component.form.name = 'Budget rules';
    component.form.budgetMode = 'ABO';
    component.form.budgetType = 'DAILY';
    component.form.dailyBudgetVnd = 100_000;
    component.form.reason = 'Kiểm tra quy tắc phân bổ ngân sách';

    component.createPlan();
    expect(component.error()).toContain('ABO');

    component.onBudgetModeChange();
    expect(component.form.budgetType).toBe('NONE');
    expect(component.form.dailyBudgetVnd).toBeNull();

    component.form.budgetMode = 'CBO';
    component.onBudgetModeChange();
    expect(component.form.budgetType).toBe('DAILY');
  });

  it('requires start and stop for a lifetime campaign budget', () => {
    component.form.adAccountId = '123456789';
    component.form.name = 'Lifetime campaign';
    component.form.budgetMode = 'CBO';
    component.form.budgetType = 'LIFETIME';
    component.form.lifetimeBudgetVnd = 5_000_000;
    component.form.stopTime = '2026-08-31T23:00';
    component.form.reason = 'Cấu hình ngân sách trọn đời theo kế hoạch';

    component.createPlan();

    expect(component.error()).toContain('phải đi cùng nhau');
    expect(api.createPlan).not.toHaveBeenCalled();
  });

  it('creates a typed ABO Ad Set draft with targeting, placements and ERP evidence mapping', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.adAccountId = '123456789';
    component.selectResourceStage('ad_set');
    component.deliveryForm.name = 'Ad Set chuyển đổi VN';
    component.deliveryForm.campaignId = '987654321';
    component.deliveryForm.budgetMode = 'ABO';
    component.deliveryForm.budgetType = 'DAILY';
    component.deliveryForm.dailyBudgetVnd = 350_000;
    component.deliveryForm.adSetBidStrategy = 'COST_CAP';
    component.deliveryForm.bidAmountVnd = 45_000;
    component.deliveryForm.optimizationGoal = 'OFFSITE_CONVERSIONS';
    component.deliveryForm.billingEvent = 'IMPRESSIONS';
    component.deliveryForm.destinationType = 'WEBSITE';
    component.onTargetingCountriesInput('vn, TH');
    component.deliveryForm.ageMin = 25;
    component.deliveryForm.ageMax = 55;
    component.deliveryForm.genders = [1, 2];
    component.deliveryForm.publisherPlatforms = ['FACEBOOK', 'INSTAGRAM'];
    component.deliveryForm.facebookPositions = ['FEED'];
    component.deliveryForm.instagramPositions = ['REELS'];
    component.deliveryForm.internalAdGroupId = '507f1f77bcf86cd799439011';
    component.deliveryForm.pixelId = '1122334455';
    component.deliveryForm.customEventType = 'PURCHASE';
    component.form.reason = 'Tạo Ad Set theo ngân sách đã được duyệt';

    component.createPlan();

    expect(component.error()).toBe('');
    const action = api.createPlan.calls.mostRecent().args[0].actions[0];
    expect(action).toEqual(jasmine.objectContaining({
      actionType: 'create_ad_set',
      adAccountId: '123456789',
      campaignId: '987654321',
      reason: 'Tạo Ad Set theo ngân sách đã được duyệt',
    }));
    expect(action.payload).toEqual({
      name: 'Ad Set chuyển đổi VN',
      budgetMode: 'ABO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 350_000,
      adSetBidStrategy: 'COST_CAP',
      bidAmountVnd: 45_000,
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      billingEvent: 'IMPRESSIONS',
      destinationType: 'WEBSITE',
      targetingCountries: ['VN', 'TH'],
      ageMin: 25,
      ageMax: 55,
      genders: [1, 2],
      publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
      facebookPositions: ['FEED'],
      instagramPositions: ['REELS'],
      internalAdGroupId: '507f1f77bcf86cd799439011',
      pixelId: '1122334455',
      customEventType: 'PURCHASE',
    });
    expect(JSON.stringify(action)).not.toContain('status');
  });

  it('creates Creative with copy, CTA, HTTPS destination, exactly one media and URL tags', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.adAccountId = '123456789';
    component.selectResourceStage('creative');
    component.deliveryForm.name = 'Creative mùa vụ';
    component.deliveryForm.pageId = '99887766';
    component.deliveryForm.instagramActorId = '55667788';
    component.deliveryForm.message = 'Nông sản sạch giao tận nơi';
    component.deliveryForm.headline = 'Đặt nông sản hôm nay';
    component.deliveryForm.description = 'Sản phẩm từ hợp tác xã';
    component.deliveryForm.callToActionType = 'SHOP_NOW';
    component.deliveryForm.destinationUrl = 'https://htxbachgia.shop/san-pham';
    component.deliveryForm.imageHash = 'a'.repeat(32);
    component.deliveryForm.urlTags = 'utm_source=meta&utm_campaign=seasonal';
    component.form.reason = 'Tạo nội dung quảng cáo đã được duyệt';

    component.createPlan();

    expect(component.error()).toBe('');
    const action = api.createPlan.calls.mostRecent().args[0].actions[0];
    expect(action).toEqual(jasmine.objectContaining({
      actionType: 'create_ad_creative',
      payload: {
        name: 'Creative mùa vụ',
        pageId: '99887766',
        instagramActorId: '55667788',
        message: 'Nông sản sạch giao tận nơi',
        headline: 'Đặt nông sản hôm nay',
        description: 'Sản phẩm từ hợp tác xã',
        callToActionType: 'SHOP_NOW',
        destinationUrl: 'https://htxbachgia.shop/san-pham',
        imageHash: 'a'.repeat(32),
        urlTags: 'utm_source=meta&utm_campaign=seasonal',
      },
    }));
    expect(action.campaignId).toBeUndefined();
    expect(action.adSetId).toBeUndefined();
    expect(action.creativeId).toBeUndefined();

    component.deliveryForm.videoId = '12345';
    component.createPlan();
    expect(component.error()).toContain('đúng một media');
  });

  it('creates a PAUSED-by-server Ad reference and fails closed when action capability is absent', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.form.adAccountId = '123456789';
    component.selectResourceStage('ad');
    component.deliveryForm.name = 'Ad liên kết creative';
    component.deliveryForm.adSetId = '1234567890';
    component.deliveryForm.creativeId = '9988776655';
    component.form.reason = 'Liên kết Ad Set và Creative đã validate';

    component.createPlan();

    const action = api.createPlan.calls.mostRecent().args[0].actions[0];
    expect(action).toEqual(jasmine.objectContaining({
      actionType: 'create_ad',
      adSetId: '1234567890',
      creativeId: '9988776655',
      payload: { name: 'Ad liên kết creative' },
    }));
    expect(JSON.stringify(action)).not.toContain('PAUSED');

    component.capabilities.set({ ...capabilityFixture(), actions: {} });
    component.createPlan();
    expect(component.error()).toContain('capabilities chưa công bố');
  });

  it('fails closed for new create when capabilities cannot be refreshed', () => {
    api.getCapabilities.and.returnValue(throwError(() => new Error('offline')));
    component.form.adAccountId = '123456789';
    component.onAccountChange();
    component.form.name = 'Blocked create';

    component.createPlan();

    expect(component.configurationWarning()).toContain('bị chặn an toàn');
    expect(component.error()).toContain('capability Meta');
    expect(api.createPlan).not.toHaveBeenCalled();
  });

  it('shows the flat canonical configuration and only enables approval after provider validation', () => {
    user.set({ _id: 'approver-2' });
    const plan = planFixture({
      createdByUserId: 'planner-1',
      actions: [{
        actionId: 'META-ACTION-001',
        actionType: 'create_campaign',
        adAccountId: '123456789',
        status: 'pending_approval',
        workflowStatus: 'pending_approval',
        providerValidationStatus: 'passed',
        name: 'Canonical campaign',
        objective: 'OUTCOME_SALES',
        budgetMode: 'CBO',
        budgetType: 'DAILY',
        dailyBudgetVnd: 750_000,
        bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
        specialAdCategories: ['NONE'],
      }],
    });
    component.plan.set(plan);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    const approveButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: any) => button.textContent?.trim() === 'Duyệt') as HTMLButtonElement;
    expect(text).toContain('Canonical campaign');
    expect(text).toContain('750,000 VND');
    expect(text).toContain('LOWEST_COST_WITHOUT_CAP');
    expect(approveButton.disabled).toBeFalse();

    plan.actions[0].providerValidationStatus = 'pending';
    component.plan.set({ ...plan, actions: [...plan.actions] });
    fixture.detectChanges();
    const blockedApprove = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: any) => button.textContent?.trim() === 'Duyệt') as HTMLButtonElement;
    expect(blockedApprove.disabled).toBeTrue();
  });

  it('blocks self-approval and blocks an approver from executing live', () => {
    const plan = planFixture({
      createdByUserId: 'planner-1',
      liveEligible: true,
      providerValidation: { passed: true },
    });
    component.plan.set(plan);
    component.approve(plan.actions[0]);
    expect(component.creatorConflict()).toBeTrue();
    expect(api.approveAction).not.toHaveBeenCalled();

    user.set({ _id: 'approver-1' });
    plan.actions[0].status = 'approved';
    plan.actions[0].approvedByUserId = 'approver-1';
    component.plan.set({ ...plan, actions: [...plan.actions] });
    component.liveConfirmation = plan.planName;
    component.execute(false);

    expect(component.approverConflict()).toBeTrue();
    expect(api.executePlan).not.toHaveBeenCalled();
  });

  it('requires server live eligibility and typed confirmation, then executes only through ERP service', () => {
    user.set({ _id: 'executor-1' });
    const plan = planFixture({
      createdByUserId: 'planner-1',
      liveEligible: true,
      providerValidation: { passed: true },
      actions: [{
        actionId: 'META-ACTION-001',
        actionType: 'create_campaign',
      adAccountId: '123456789',
        status: 'approved',
        approvedByUserId: 'approver-1',
      }],
    });
    component.plan.set(plan);
    api.executePlan.and.returnValue(of({ executionId: 'EXEC-001', status: 'success', dryRun: false }));
    api.getPlan.and.returnValue(of(plan));

    component.execute(false);
    expect(api.executePlan).not.toHaveBeenCalled();

    component.liveConfirmation = plan.planName;
    component.execute(false);
    expect(component.error()).toContain('dry-run');
    expect(api.executePlan).not.toHaveBeenCalled();

    component.executions.set([{ status: 'eligible', dryRun: true }]);
    component.execute(false);
    expect(api.executePlan).toHaveBeenCalledOnceWith('META-PLAN-001', ['META-ACTION-001'], false);
    expect(api.getPlan).toHaveBeenCalledWith('META-PLAN-001');
  });

  it('hydrates canonical update fields and sends only a non-increasing delta', () => {
    api.createPlan.and.returnValue(of(planFixture()));
    component.campaignOptions.set([{
      campaignId: '987654321',
      name: 'Canonical campaign',
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      budgetMode: 'CBO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 900_000,
      spendCapVnd: 8_000_000,
      stopTime: '2026-09-30T16:00:00.000Z',
      lastReadbackAt: '2026-07-17T10:00:00.000Z',
    }]);
    component.form.adAccountId = '123456789';
    component.selectOperation('update');
    component.form.campaignId = '987654321';
    component.onCampaignChange();

    expect(component.form.name).toBe('Canonical campaign');
    expect(component.form.dailyBudgetVnd).toBe(900_000);
    expect(component.form.lifetimeBudgetVnd).toBeNull();
    expect(component.form.spendCapVnd).toBe(8_000_000);
    expect(component.form.stopTime).toBe('2026-09-30T23:00');

    component.form.dailyBudgetVnd = 800_000;
    component.form.reason = 'Giảm ngân sách theo quyết định Financial Control';
    component.createPlan();

    expect(component.error()).toBe('');
    expect(api.createPlan.calls.mostRecent().args[0].actions[0].payload).toEqual({
      dailyBudgetVnd: 800_000,
    });
  });

  it('blocks canonical budget increases and requires an explicit business reason', () => {
    component.campaignOptions.set([{
      campaignId: '987654321',
      name: 'Canonical campaign',
      budgetMode: 'CBO',
      budgetType: 'DAILY',
      dailyBudgetVnd: 900_000,
    }]);
    component.form.adAccountId = '123456789';
    component.selectOperation('update');
    component.form.campaignId = '987654321';
    component.onCampaignChange();
    component.form.dailyBudgetVnd = 1_000_000;

    component.createPlan();
    expect(component.error()).toContain('lý do kinh doanh');

    component.form.reason = 'Tăng ngân sách theo yêu cầu kinh doanh';
    component.createPlan();
    expect(component.error()).toContain('chỉ cho giữ nguyên hoặc giảm');
    expect(api.createPlan).not.toHaveBeenCalled();
  });

  it('does not expose plan, approval or execute actions without their permissions', () => {
    permissions.delete('meta-ads.plan');
    permissions.delete('meta-ads.validate');
    permissions.delete('meta-ads.approve');
    permissions.delete('meta-ads.execute');
    permissionRevision.update((value) => value + 1);
    component.plan.set(planFixture({ providerValidation: { passed: true }, liveEligible: true }));
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.find((button) => button.textContent?.includes('Lưu bản nháp'))?.disabled).toBeTrue();
    expect(buttons.find((button) => button.textContent?.includes('Provider validate-only'))?.disabled).toBeTrue();
    expect(buttons.find((button) => button.textContent?.trim() === 'Duyệt')?.disabled).toBeTrue();
    expect(buttons.find((button) => button.textContent?.includes('Thực thi live'))?.disabled).toBeTrue();
  });

  function planFixture(overrides: Partial<MetaCampaignActionPlan> = {}): MetaCampaignActionPlan {
    return {
      planId: 'META-PLAN-001',
      planName: 'Tạo campaign - Doanh số tháng 8',
      status: 'draft',
      createdByUserId: 'another-planner',
      actions: [{
        actionId: 'META-ACTION-001',
        actionType: 'create_campaign',
        adAccountId: 'act_123456789',
        status: 'pending',
      }],
      ...overrides,
    };
  }

  function capabilityFixture() {
    return {
      graphApiVersion: 'v25.0',
      objectives: [
        { value: 'OUTCOME_AWARENESS' as const, label: 'Nhận biết' },
        { value: 'OUTCOME_TRAFFIC' as const, label: 'Lưu lượng' },
        { value: 'OUTCOME_ENGAGEMENT' as const, label: 'Tương tác' },
        { value: 'OUTCOME_LEADS' as const, label: 'Khách hàng tiềm năng' },
        { value: 'OUTCOME_SALES' as const, label: 'Doanh số' },
        { value: 'OUTCOME_APP_PROMOTION' as const, label: 'Ứng dụng' },
      ],
      budget: {
        modes: [
          { value: 'ABO' as const, ownerResource: 'ad_set' },
          { value: 'CBO' as const, ownerResource: 'campaign' },
        ],
        types: [
          { value: 'NONE' as const, campaignExecutionSupport: 'SUPPORTED' as const },
          { value: 'DAILY' as const, campaignExecutionSupport: 'SUPPORTED' as const },
          { value: 'LIFETIME' as const, campaignExecutionSupport: 'SUPPORTED' as const },
        ],
        currency: 'VND',
      },
      bidStrategies: [
        'LOWEST_COST_WITHOUT_CAP' as const,
        'COST_CAP' as const,
        'LOWEST_COST_WITH_BID_CAP' as const,
        'LOWEST_COST_WITH_MIN_ROAS' as const,
      ],
      specialAdCategories: {
        officialOptions: [
          'NONE' as const,
          'CREDIT' as const,
          'EMPLOYMENT' as const,
          'FINANCIAL_PRODUCTS_SERVICES' as const,
          'HOUSING' as const,
          'ISSUES_ELECTIONS_POLITICS' as const,
          'ONLINE_GAMBLING_AND_GAMING' as const,
        ],
        selectionRequired: true,
        defaultLiveExecutionAllowlist: ['NONE' as const],
      },
      actions: {
        create_campaign: {},
        update_campaign: {},
        pause_campaign: {},
        create_ad_set: {},
        pause_ad_set: {},
        create_ad_creative: {},
        create_ad: {},
      },
      delivery: {
        adSetBidStrategies: [
          'LOWEST_COST_WITHOUT_CAP' as const,
          'COST_CAP' as const,
          'LOWEST_COST_WITH_BID_CAP' as const,
        ],
        optimizationGoals: [
          'APP_INSTALLS' as const,
          'IMPRESSIONS' as const,
          'LANDING_PAGE_VIEWS' as const,
          'LEAD_GENERATION' as const,
          'LINK_CLICKS' as const,
          'OFFSITE_CONVERSIONS' as const,
          'POST_ENGAGEMENT' as const,
          'QUALITY_LEAD' as const,
          'REACH' as const,
          'THRUPLAY' as const,
        ],
        billingEvents: ['IMPRESSIONS' as const, 'LINK_CLICKS' as const],
        destinationTypes: ['APP' as const, 'MESSENGER' as const, 'ON_AD' as const, 'WEBSITE' as const, 'WHATSAPP' as const],
        publisherPlatforms: ['AUDIENCE_NETWORK' as const, 'FACEBOOK' as const, 'INSTAGRAM' as const, 'MESSENGER' as const],
        facebookPositions: ['FEED' as const, 'INSTREAM_VIDEO' as const, 'MARKETPLACE' as const, 'RIGHT_HAND_COLUMN' as const, 'SEARCH' as const, 'STORY' as const],
        instagramPositions: ['EXPLORE' as const, 'PROFILE_FEED' as const, 'REELS' as const, 'STORY' as const, 'STREAM' as const],
        callToActionTypes: ['APPLY_NOW' as const, 'BOOK_NOW' as const, 'CONTACT_US' as const, 'DOWNLOAD' as const, 'GET_QUOTE' as const, 'LEARN_MORE' as const, 'SEND_MESSAGE' as const, 'SHOP_NOW' as const, 'SIGN_UP' as const, 'WHATSAPP_MESSAGE' as const],
        customEventTypes: ['ADD_TO_CART' as const, 'COMPLETE_REGISTRATION' as const, 'CONTACT' as const, 'CONTENT_VIEW' as const, 'INITIATED_CHECKOUT' as const, 'LEAD' as const, 'PURCHASE' as const, 'SEARCH' as const, 'SUBMIT_APPLICATION' as const],
      },
      invariants: { buyingType: 'AUCTION' as const, createStatus: 'PAUSED' as const },
    };
  }
});
