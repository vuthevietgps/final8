import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  CreateMetaCampaignActionPlanRequest,
  MetaAdsAdAccountLookupResponse,
  MetaAdsAdAccountOption,
  MetaAdsCampaignCapabilities,
  MetaAdsCampaignCapabilitiesResponse,
  MetaAdsCapabilityOption,
  MetaAdsCampaignService,
  MetaAdsResourceStage,
  MetaAdSetBidStrategy,
  MetaAdSetBillingEvent,
  MetaAdSetDestinationType,
  MetaAdSetOptimizationGoal,
  MetaCallToActionType,
  MetaCustomEventType,
  MetaFacebookPosition,
  MetaInstagramPosition,
  MetaPublisherPlatform,
  MetaCampaignActionPlan,
  MetaCampaignActionType,
  MetaCampaignBidStrategy,
  MetaCampaignBudgetMode,
  MetaCampaignBudgetType,
  MetaCampaignObjective,
  MetaAdsCampaignLookupOption,
  MetaCampaignActionPayload,
  MetaCampaignPlanAction,
  MetaCampaignSpecialAdCategory,
} from './meta-ads-campaign.service';

type CampaignOperation = 'create' | 'update' | 'pause';

@Component({
  selector: 'app-meta-ads-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meta-ads-campaign.component.html',
  styleUrl: './meta-ads-campaign.component.css',
})
export class MetaAdsCampaignComponent implements OnInit {
  private readonly api = inject(MetaAdsCampaignService);
  private readonly auth = inject(AuthService);

  readonly canRead = computed(() => this.auth.hasPermission('meta-ads.read'));
  readonly canPlan = computed(() => this.auth.hasPermission('meta-ads.plan'));
  readonly canValidate = computed(() => this.auth.hasPermission('meta-ads.validate'));
  readonly canApprove = computed(() => this.auth.hasPermission('meta-ads.approve'));
  readonly canExecute = computed(() => this.auth.hasPermission('meta-ads.execute'));

  operation = signal<CampaignOperation>('create');
  resourceStage = signal<MetaAdsResourceStage>('campaign');
  plan = signal<MetaCampaignActionPlan | null>(null);
  executions = signal<any[]>([]);
  capabilities = signal<MetaAdsCampaignCapabilities | null>(null);
  adAccounts = signal<MetaAdsAdAccountOption[]>([]);
  campaignOptions = signal<MetaAdsCampaignLookupOption[]>([]);
  capabilitiesLoading = signal(false);
  accountsLoading = signal(false);
  campaignsLoading = signal(false);
  capabilitiesWarning = signal('');
  accountsWarning = signal('');
  campaignsWarning = signal('');
  loadingAction = signal('');
  error = signal('');
  message = signal('');
  lookupPlanId = '';
  liveConfirmation = '';
  rejectionReason = '';
  specialCountriesInput = '';
  targetingCountriesInput = '';
  internalProductIdsInput = '';
  private draftIdempotencyKey = this.newIdempotencyKey();

  form = {
    adAccountId: '',
    campaignId: '',
    name: '',
    objective: 'OUTCOME_SALES' as MetaCampaignObjective,
    budgetMode: 'ABO' as MetaCampaignBudgetMode,
    budgetType: 'NONE' as MetaCampaignBudgetType,
    dailyBudgetVnd: null as number | null,
    lifetimeBudgetVnd: null as number | null,
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP' as MetaCampaignBidStrategy,
    spendCapVnd: null as number | null,
    startTime: '',
    stopTime: '',
    specialAdCategories: ['NONE'] as MetaCampaignSpecialAdCategory[],
    specialAdCategoryCountries: [] as string[],
    appId: '',
    reason: '',
  };

  deliveryForm = {
    name: '',
    campaignId: '',
    adSetId: '',
    creativeId: '',
    budgetMode: 'ABO' as MetaCampaignBudgetMode,
    budgetType: 'DAILY' as MetaCampaignBudgetType,
    dailyBudgetVnd: null as number | null,
    lifetimeBudgetVnd: null as number | null,
    adSetBidStrategy: 'LOWEST_COST_WITHOUT_CAP' as MetaAdSetBidStrategy,
    bidAmountVnd: null as number | null,
    startTime: '',
    stopTime: '',
    optimizationGoal: 'LINK_CLICKS' as MetaAdSetOptimizationGoal,
    billingEvent: 'IMPRESSIONS' as MetaAdSetBillingEvent,
    destinationType: 'WEBSITE' as MetaAdSetDestinationType,
    targetingCountries: [] as string[],
    ageMin: null as number | null,
    ageMax: null as number | null,
    genders: [] as Array<1 | 2>,
    publisherPlatforms: [] as MetaPublisherPlatform[],
    facebookPositions: [] as MetaFacebookPosition[],
    instagramPositions: [] as MetaInstagramPosition[],
    internalAdGroupId: '',
    internalProductIds: [] as string[],
    pageId: '',
    instagramActorId: '',
    pixelId: '',
    applicationId: '',
    objectStoreUrl: '',
    customEventType: 'PURCHASE' as MetaCustomEventType,
    message: '',
    headline: '',
    description: '',
    callToActionType: 'LEARN_MORE' as MetaCallToActionType,
    destinationUrl: '',
    imageHash: '',
    videoId: '',
    urlTags: '',
  };

  readonly objectiveOptions = computed(() => this.capabilityOptions<MetaCampaignObjective>(
    this.capabilities()?.objectives || this.capabilities()?.supportedObjectives,
    OBJECTIVE_LABELS,
  ));
  readonly budgetModeOptions = computed(() => this.capabilityOptions<MetaCampaignBudgetMode>(
    this.capabilities()?.budget?.modes || this.capabilities()?.budgetModes,
    BUDGET_MODE_LABELS,
  ));
  readonly budgetTypeOptions = computed(() => this.capabilityOptions<MetaCampaignBudgetType>(
    this.capabilities()?.budget?.types || this.capabilities()?.budgetTypes,
    BUDGET_TYPE_LABELS,
  ));
  readonly bidStrategyOptions = computed(() => this.capabilityOptions<MetaCampaignBidStrategy>(
    this.capabilities()?.bidStrategies,
    BID_STRATEGY_LABELS,
  ));
  readonly specialCategoryOptions = computed(() => this.capabilityOptions<MetaCampaignSpecialAdCategory>(
    this.specialCategoryCapabilityValues(),
    SPECIAL_CATEGORY_LABELS,
  ));
  readonly countryOptions = computed(() => this.capabilityOptions<string>(
    this.capabilities()?.specialAdCategoryCountries || this.capabilities()?.countries,
    COUNTRY_LABELS,
  ));
  readonly adSetBidStrategyOptions = computed(() => this.capabilityOptions<MetaAdSetBidStrategy>(
    this.deliveryCapabilityValues('adSetBidStrategies'),
    AD_SET_BID_STRATEGY_LABELS,
  ));
  readonly optimizationGoalOptions = computed(() => this.capabilityOptions<MetaAdSetOptimizationGoal>(
    this.deliveryCapabilityValues('optimizationGoals'),
    OPTIMIZATION_GOAL_LABELS,
  ));
  readonly billingEventOptions = computed(() => this.capabilityOptions<MetaAdSetBillingEvent>(
    this.deliveryCapabilityValues('billingEvents'),
    BILLING_EVENT_LABELS,
  ));
  readonly destinationTypeOptions = computed(() => this.capabilityOptions<MetaAdSetDestinationType>(
    this.deliveryCapabilityValues('destinationTypes'),
    DESTINATION_TYPE_LABELS,
  ));
  readonly publisherPlatformOptions = computed(() => this.capabilityOptions<MetaPublisherPlatform>(
    this.deliveryCapabilityValues('publisherPlatforms'),
    PUBLISHER_PLATFORM_LABELS,
  ));
  readonly facebookPositionOptions = computed(() => this.capabilityOptions<MetaFacebookPosition>(
    this.deliveryCapabilityValues('facebookPositions'),
    FACEBOOK_POSITION_LABELS,
  ));
  readonly instagramPositionOptions = computed(() => this.capabilityOptions<MetaInstagramPosition>(
    this.deliveryCapabilityValues('instagramPositions'),
    INSTAGRAM_POSITION_LABELS,
  ));
  readonly callToActionOptions = computed(() => this.capabilityOptions<MetaCallToActionType>(
    this.deliveryCapabilityValues('callToActionTypes'),
    CALL_TO_ACTION_LABELS,
  ));
  readonly customEventOptions = computed(() => this.capabilityOptions<MetaCustomEventType>(
    this.deliveryCapabilityValues('customEventTypes'),
    CUSTOM_EVENT_LABELS,
  ));
  readonly configurationWarning = computed(() => [
    this.accountsWarning(),
    this.capabilitiesWarning(),
    this.campaignsWarning(),
  ].filter(Boolean).join(' '));

  readonly planId = computed(() => this.planIdentifier(this.plan()));
  readonly allActionsApproved = computed(() => {
    const actions = this.plan()?.actions || [];
    return actions.length > 0 && actions.every((action) => action.status === 'approved');
  });
  readonly providerValidated = computed(() => this.plan()?.providerValidation?.passed === true);
  readonly liveEligible = computed(() => {
    const plan = this.plan();
    return plan?.liveEligibility?.eligible === true || plan?.liveEligible === true;
  });
  readonly liveBlockers = computed(() => Array.from(new Set([
    ...(this.plan()?.blockers || []),
    ...(this.plan()?.providerValidation?.blockers || []),
    ...(this.plan()?.liveEligibility?.blockers || []),
    ...((this.plan()?.actions || []).flatMap((action) => action.blockers || [])),
    ...(!this.dryRunPassed()
      ? ['Frontend ERP yêu cầu dry-run đạt trong phiên hiện tại trước khi cho phép gửi live.']
      : []),
  ])));
  readonly currentUserId = computed(() => {
    const user = this.auth.user() as any;
    return String(user?._id || user?.id || '');
  });
  readonly creatorConflict = computed(() => {
    const creatorId = String(this.plan()?.createdByUserId || '');
    return !!creatorId && creatorId === this.currentUserId();
  });
  readonly approverConflict = computed(() => {
    const actorId = this.currentUserId();
    return !!actorId && (this.plan()?.actions || []).some(
      (action) => String(action.approvedByUserId || '') === actorId,
    );
  });
  readonly dryRunPassed = computed(() => this.executions().some(
    (execution) => execution.dryRun === true
      && ['success', 'succeeded', 'completed', 'eligible'].includes(execution.status),
  ));
  readonly liveExecuted = computed(() => this.executions().some(
    (execution) => execution.dryRun !== true
      && ['success', 'succeeded', 'completed', 'executed', 'reconciled'].includes(execution.status),
  ));

  selectedAccount(): MetaAdsAdAccountOption | undefined {
    return this.adAccounts().find(
      (account) => this.accountId(account) === this.normalizedAccountId(),
    );
  }

  accountSelectionReady(): boolean {
    const account = this.selectedAccount();
    return !!account && account.eligible !== false && account.liveEligible !== false;
  }

  ngOnInit(): void {
    if (!this.canRead()) return;
    this.loadAdAccountOptions();
    this.loadCapabilities();
  }

  onAccountChange(): void {
    this.form.campaignId = '';
    this.deliveryForm.campaignId = '';
    if (this.operation() !== 'create') this.resetMutableCampaignFields();
    const adAccountId = this.normalizedAccountId();
    this.loadCapabilities(adAccountId || undefined);
    if (adAccountId) this.loadCampaignOptions(adAccountId);
    else this.campaignOptions.set([]);
  }

  selectResourceStage(stage: MetaAdsResourceStage): void {
    this.resourceStage.set(stage);
    this.operation.set('create');
    this.error.set('');
    this.message.set('');
    if (stage !== 'campaign') this.resetDeliveryForm(stage);
  }

  selectDeliveryOperation(operation: 'create' | 'pause'): void {
    if (this.resourceStage() !== 'ad_set' && operation === 'pause') return;
    this.operation.set(operation);
    this.error.set('');
    this.message.set('');
  }

  deliveryActionSupported(): boolean {
    const actionType = this.deliveryActionType();
    const actions = this.capabilities()?.actions;
    if (!actionType || !actions || !Object.prototype.hasOwnProperty.call(actions, actionType)) {
      return false;
    }
    const capability = actions[actionType] as any;
    return capability !== false && capability?.disabled !== true && capability?.supported !== false;
  }

  deliveryActionType(): MetaCampaignActionType | undefined {
    const stage = this.resourceStage();
    if (stage === 'ad_set') {
      return this.operation() === 'pause' ? 'pause_ad_set' : 'create_ad_set';
    }
    if (stage === 'creative') return 'create_ad_creative';
    if (stage === 'ad') return 'create_ad';
    return undefined;
  }

  onDeliveryCampaignChange(): void {
    const campaign = this.campaignOptions().find(
      (item) => item.campaignId === this.normalizedId(this.deliveryForm.campaignId),
    );
    if (!campaign?.budgetMode) return;
    this.deliveryForm.budgetMode = campaign.budgetMode;
    this.deliveryForm.budgetType = campaign.budgetMode === 'CBO' ? 'NONE' : 'DAILY';
    this.onAdSetBudgetModeChange();
  }

  onAdSetBudgetModeChange(): void {
    if (this.deliveryForm.budgetMode === 'CBO') {
      this.deliveryForm.budgetType = 'NONE';
      this.deliveryForm.dailyBudgetVnd = null;
      this.deliveryForm.lifetimeBudgetVnd = null;
      this.deliveryForm.bidAmountVnd = null;
      return;
    }
    if (this.deliveryForm.budgetType === 'NONE') this.deliveryForm.budgetType = 'DAILY';
  }

  onAdSetBudgetTypeChange(): void {
    if (this.deliveryForm.budgetType !== 'DAILY') this.deliveryForm.dailyBudgetVnd = null;
    if (this.deliveryForm.budgetType !== 'LIFETIME') this.deliveryForm.lifetimeBudgetVnd = null;
  }

  onAdSetBidStrategyChange(): void {
    if (this.deliveryForm.adSetBidStrategy === 'LOWEST_COST_WITHOUT_CAP') {
      this.deliveryForm.bidAmountVnd = null;
    }
  }

  onTargetingCountriesInput(value: string): void {
    this.targetingCountriesInput = value;
    this.deliveryForm.targetingCountries = this.splitUnique(value, true);
  }

  onInternalProductIdsInput(value: string): void {
    this.internalProductIdsInput = value;
    this.deliveryForm.internalProductIds = this.splitUnique(value, false);
  }

  onPublisherPlatformsChange(): void {
    if (!this.deliveryForm.publisherPlatforms.includes('FACEBOOK')) {
      this.deliveryForm.facebookPositions = [];
    }
    if (!this.deliveryForm.publisherPlatforms.includes('INSTAGRAM')) {
      this.deliveryForm.instagramPositions = [];
    }
  }

  onOptimizationGoalChange(): void {
    if (this.deliveryForm.optimizationGoal !== 'OFFSITE_CONVERSIONS') {
      this.deliveryForm.pixelId = '';
      this.deliveryForm.customEventType = this.enabledOrFirst(
        this.customEventOptions(),
        this.deliveryForm.customEventType,
      );
    }
  }

  onDestinationTypeChange(): void {
    if (this.deliveryForm.destinationType !== 'APP'
      && this.deliveryForm.optimizationGoal !== 'APP_INSTALLS') {
      this.deliveryForm.applicationId = '';
      this.deliveryForm.objectStoreUrl = '';
    }
  }

  onObjectiveChange(): void {
    if (this.form.objective !== 'OUTCOME_APP_PROMOTION') this.form.appId = '';
  }

  onBudgetModeChange(): void {
    if (this.form.budgetMode === 'ABO') {
      this.form.budgetType = 'NONE';
      this.form.dailyBudgetVnd = null;
      this.form.lifetimeBudgetVnd = null;
      return;
    }
    if (this.form.budgetType === 'NONE') this.form.budgetType = 'DAILY';
  }

  onBudgetTypeChange(): void {
    if (this.form.budgetType !== 'DAILY') this.form.dailyBudgetVnd = null;
    if (this.form.budgetType !== 'LIFETIME') this.form.lifetimeBudgetVnd = null;
  }

  onSpecialCategoriesChange(): void {
    const selected = Array.from(new Set(this.form.specialAdCategories || []));
    this.form.specialAdCategories = selected.length > 1
      ? selected.filter((category) => category !== 'NONE')
      : selected.length ? selected : ['NONE'];
    if (this.form.specialAdCategories.includes('NONE')) {
      this.form.specialAdCategoryCountries = [];
      this.specialCountriesInput = '';
    }
  }

  onSpecialCountriesInput(value: string): void {
    this.specialCountriesInput = value;
    this.form.specialAdCategoryCountries = Array.from(new Set(
      String(value || '').toUpperCase().split(/[\s,;]+/).map((country) => country.trim()).filter(Boolean),
    ));
  }

  accountId(account: MetaAdsAdAccountOption): string {
    return String(account.adAccountId || account.accountId || '').replace(/^act_/i, '');
  }

  accountLabel(account: MetaAdsAdAccountOption): string {
    const context = [account.currency, account.timezoneId || account.timezone].filter(Boolean).join(' · ');
    return `${account.name} (${this.accountId(account)})${context ? ` · ${context}` : ''}`;
  }

  accountBlocker(account: MetaAdsAdAccountOption): string {
    return (account.blockers || []).join('; ');
  }

  selectedCampaign(): MetaAdsCampaignLookupOption | undefined {
    return this.campaignOptions().find((campaign) => campaign.campaignId === this.normalizedCampaignId());
  }

  onCampaignChange(): void {
    if (this.operation() !== 'update') return;
    const campaign = this.selectedCampaign();
    this.resetMutableCampaignFields();
    if (!campaign) return;
    this.form.name = campaign.name || '';
    this.form.dailyBudgetVnd = campaign.budgetMode === 'CBO' && campaign.budgetType === 'DAILY'
      ? campaign.dailyBudgetVnd ?? null
      : null;
    this.form.lifetimeBudgetVnd = campaign.budgetMode === 'CBO' && campaign.budgetType === 'LIFETIME'
      ? campaign.lifetimeBudgetVnd ?? null
      : null;
    this.form.spendCapVnd = campaign.spendCapVnd ?? null;
    this.form.startTime = this.accountDateTimeInput(campaign.startTime);
    this.form.stopTime = this.accountDateTimeInput(campaign.stopTime);
  }

  selectOperation(operation: CampaignOperation): void {
    this.resourceStage.set('campaign');
    this.operation.set(operation);
    if (operation === 'create') {
      this.form.campaignId = '';
      this.resetMutableCampaignFields();
    } else if (operation === 'update') {
      this.onCampaignChange();
    } else {
      this.resetMutableCampaignFields();
    }
    this.error.set('');
    this.message.set('');
  }

  updateBudgetFieldVisible(type: 'DAILY' | 'LIFETIME'): boolean {
    const campaign = this.selectedCampaign();
    if (!campaign) return true;
    return campaign.budgetMode === 'CBO' && campaign.budgetType === type;
  }

  currentCampaignEvidence(): string {
    const campaign = this.selectedCampaign();
    if (!campaign) return 'Chưa có canonical campaign snapshot; ERP/provider sẽ xác minh lại ID khi validate-only.';
    const values = [
      `Tên: ${campaign.name}`,
      `Budget: ${this.campaignBudgetLabel(campaign)}`,
      campaign.spendCapVnd === undefined
        ? undefined
        : `Spend cap: ${this.formatVnd(campaign.spendCapVnd)}`,
      campaign.stopTime ? `Kết thúc: ${campaign.stopTime}` : undefined,
      campaign.lastReadbackAt ? `Readback: ${campaign.lastReadbackAt}` : undefined,
    ].filter(Boolean);
    return values.join(' · ');
  }

  proposedCampaignEvidence(): string {
    const payload = this.buildUpdatePayload();
    const values = [
      payload.name === undefined ? undefined : `Tên mới: ${payload.name}`,
      payload.dailyBudgetVnd === undefined
        ? undefined
        : `Budget ngày mới: ${this.formatVnd(payload.dailyBudgetVnd)}`,
      payload.lifetimeBudgetVnd === undefined
        ? undefined
        : `Budget trọn đời mới: ${this.formatVnd(payload.lifetimeBudgetVnd)}`,
      payload.spendCapVnd === undefined
        ? undefined
        : `Spend cap mới: ${this.formatVnd(payload.spendCapVnd)}`,
      payload.stopTime === undefined ? undefined : `Kết thúc mới: ${payload.stopTime}`,
    ].filter(Boolean);
    return values.length ? values.join(' · ') : 'Chưa có thay đổi so với canonical snapshot.';
  }

  formatVnd(value: number): string {
    return `${Number(value).toLocaleString('vi-VN')} VND`;
  }

  shortHash(value?: string): string {
    const normalized = String(value || '').trim();
    return normalized.length > 16 ? `${normalized.slice(0, 16)}…` : normalized || '—';
  }

  createPlan(): void {
    if (!this.canPlan() || this.loadingAction()) return;
    const error = this.validateForm();
    if (error) {
      this.error.set(error);
      return;
    }

    this.run('create', this.api.createPlan(this.buildRequest()), (plan) => {
      this.setPlan(plan);
      this.draftIdempotencyKey = this.newIdempotencyKey();
      this.message.set('Đã tạo bản nháp trong ERP. Chưa có thay đổi nào được gửi lên Meta.');
    });
  }

  materializeAutomatedPauseDrafts(): void {
    if (!this.canPlan() || this.loadingAction()) return;
    this.run(
      'auto-pause-drafts',
      this.api.materializePauseReviewDrafts(),
      (result) => {
        const firstPlanId = result.drafts[0]?.planId;
        if (firstPlanId) this.lookupPlanId = firstPlanId;
        this.message.set(
          `ERP đã tạo ${result.created} Meta pause draft; `
          + `${result.deduplicated} action đã được chống trùng, ${result.rejected} action bị policy từ chối. `
          + (firstPlanId
            ? `Plan đầu tiên ${firstPlanId} đã được điền để tải và duyệt.`
            : 'Không có plan mới để tải.'),
        );
      },
    );
  }

  loadPlan(): void {
    const planId = this.lookupPlanId.trim();
    if (!this.canRead() || !planId || this.loadingAction()) return;
    this.run('load', this.api.getPlan(planId), (plan) => {
      this.setPlan(plan);
      this.loadExecutions();
    });
  }

  validatePlan(): void {
    const planId = this.planId();
    if (!this.canValidate() || !planId || this.loadingAction()) return;
    this.run('validate', this.api.validatePlan(planId), (plan) => {
      this.setPlan(plan);
      this.message.set('Provider validate-only đã hoàn tất. Đây chưa phải là thực thi live.');
    });
  }

  approve(action: MetaCampaignPlanAction): void {
    const planId = this.planId();
    const actionId = this.actionIdentifier(action);
    if (!this.canApproveAction(action) || !planId || !actionId || this.loadingAction()) return;
    this.run(`approve-${actionId}`, this.api.approveAction(
      planId,
      actionId,
      Number(action.revision || 0),
    ), (plan) => {
      this.setPlan(plan);
      this.message.set('Đã ghi nhận phê duyệt trong ERP. Chưa thực thi live.');
    });
  }

  reject(action: MetaCampaignPlanAction): void {
    const planId = this.planId();
    const actionId = this.actionIdentifier(action);
    const reason = this.rejectionReason.trim();
    if (!this.canApprove() || !planId || !actionId || !reason || this.loadingAction()) return;
    this.run(`reject-${actionId}`, this.api.rejectAction(
      planId,
      actionId,
      reason,
      Number(action.revision || 0),
    ), (plan) => {
      this.setPlan(plan);
      this.rejectionReason = '';
      this.message.set('Đã từ chối action trong ERP.');
    });
  }

  execute(dryRun: boolean): void {
    const plan = this.plan();
    const planId = this.planId();
    const actionIds = (plan?.actions || []).map((action) => this.actionIdentifier(action)).filter(Boolean);
    if (!this.canExecute() || !planId || !actionIds.length || this.loadingAction()) return;
    if (!dryRun && !this.dryRunPassed()) {
      this.error.set('Phải chạy dry-run đạt trong phiên ERP hiện tại trước khi gửi live.');
      return;
    }
    if (!dryRun && (!this.liveEligible() || this.approverConflict() || this.liveConfirmation !== plan?.planName)) return;

    this.run(dryRun ? 'dry-run' : 'live', this.api.executePlan(planId, actionIds, dryRun), (execution) => {
      this.liveConfirmation = '';
      this.message.set(dryRun
        ? 'Dry-run đã hoàn tất qua ERP; chưa thay đổi Meta.'
        : 'ERP đã nhận yêu cầu live. Hãy kiểm tra execution log và provider readback.');
      if (dryRun) this.executions.update((items) => [execution, ...items]);
      else this.refreshPlan();
    });
  }

  refreshPlan(): void {
    const planId = this.planId();
    if (!planId || this.loadingAction()) return;
    this.run('refresh', this.api.getPlan(planId), (plan) => {
      this.setPlan(plan);
      this.loadExecutions();
    });
  }

  actionIdentifier(action: MetaCampaignPlanAction): string {
    return String(action.actionId || action.id || action._id || '');
  }

  actionWorkflowStatus(action: MetaCampaignPlanAction): string {
    return String(action.workflowStatus || action.status || '');
  }

  canApproveAction(action: MetaCampaignPlanAction): boolean {
    return this.canApprove()
      && !this.creatorConflict()
      && this.actionWorkflowStatus(action) === 'pending_approval'
      && action.providerValidationStatus === 'passed';
  }

  operationLabel(actionType: string): string {
    const labels: Record<string, string> = {
      create_campaign: 'Tạo campaign',
      update_campaign: 'Sửa campaign',
      pause_campaign: 'Tạm dừng campaign',
      create_ad_set: 'Tạo Ad Set',
      pause_ad_set: 'Tạm dừng Ad Set',
      create_ad_creative: 'Tạo Creative',
      create_ad: 'Tạo Ad',
    };
    return labels[actionType] || actionType;
  }

  private buildRequest(): CreateMetaCampaignActionPlanRequest {
    if (this.resourceStage() !== 'campaign') return this.buildDeliveryRequest();
    const operation = this.operation();
    const payload: CreateMetaCampaignActionPlanRequest['actions'][number]['payload'] = {};
    if (operation === 'create' && this.form.name.trim()) payload.name = this.form.name.trim();

    if (operation === 'create') {
      payload.objective = this.form.objective;
      payload.budgetMode = this.form.budgetMode;
      payload.budgetType = this.form.budgetType;
      payload.bidStrategy = this.form.bidStrategy;
      payload.specialAdCategories = [...this.form.specialAdCategories];
      if (!this.form.specialAdCategories.includes('NONE')) {
        payload.specialAdCategoryCountries = [...this.form.specialAdCategoryCountries];
      }
      if (this.form.objective === 'OUTCOME_APP_PROMOTION') payload.appId = this.form.appId.trim();
      if (this.form.startTime) payload.startTime = this.isoDateTime(this.form.startTime);
    }

    if (operation === 'create') {
      const dailyBudgetVnd = this.optionalPositiveInteger(this.form.dailyBudgetVnd);
      const lifetimeBudgetVnd = this.optionalPositiveInteger(this.form.lifetimeBudgetVnd);
      const spendCapVnd = this.optionalPositiveInteger(this.form.spendCapVnd);
      if (dailyBudgetVnd !== undefined) payload.dailyBudgetVnd = dailyBudgetVnd;
      if (lifetimeBudgetVnd !== undefined) payload.lifetimeBudgetVnd = lifetimeBudgetVnd;
      if (spendCapVnd !== undefined) payload.spendCapVnd = spendCapVnd;
      if (this.form.stopTime) payload.stopTime = this.isoDateTime(this.form.stopTime);
    } else if (operation === 'update') {
      Object.assign(payload, this.buildUpdatePayload());
    }

    const actionType = operation === 'create'
      ? 'create_campaign'
      : operation === 'update' ? 'update_campaign' : 'pause_campaign';
    const planName = `${this.operationLabel(actionType)} - ${this.form.name.trim() || this.form.campaignId.trim()}`
      .slice(0, 200);

    return {
      planName,
      actions: [{
        actionType,
        adAccountId: this.normalizedAccountId(),
        campaignId: operation === 'create' ? undefined : this.normalizedCampaignId(),
        reason: this.form.reason.trim(),
        idempotencyKey: this.draftIdempotencyKey,
        payload,
      }],
    };
  }

  private validateForm(): string {
    if (!this.accountSelectionReady()) {
      return 'Hãy chọn tài khoản Meta đủ điều kiện từ danh sách ERP đã xác minh.';
    }
    if (this.resourceStage() !== 'campaign') return this.validateDeliveryForm();
    if (this.operation() === 'create' && !this.capabilities()) {
      return 'ERP chưa tải được capability Meta; tạo campaign bị chặn an toàn.';
    }
    if (this.operation() === 'create' && this.capabilities()?.blockers?.length) {
      return this.capabilities()!.blockers!.join(' ');
    }
    if (this.operation() === 'create' && !this.form.name.trim()) return 'Tên campaign là bắt buộc.';
    if (this.operation() !== 'create' && !/^\d{1,32}$/.test(this.normalizedCampaignId())) {
      return 'Campaign ID phải có từ 1 đến 32 chữ số.';
    }
    if (this.form.reason.trim().length < 10) {
      return 'Nhập lý do kinh doanh cụ thể ít nhất 10 ký tự.';
    }

    const numericError = this.validateOptionalAmounts();
    if (numericError) return numericError;
    if (this.form.dailyBudgetVnd !== null && this.form.lifetimeBudgetVnd !== null) {
      return 'Chỉ được cấu hình một loại ngân sách: ngày hoặc trọn đời.';
    }

    const timeError = this.validateSchedule();
    if (timeError) return timeError;

    if (this.operation() === 'create') {
      if (!!this.form.startTime !== !!this.form.stopTime) {
        return 'Khi cấu hình lịch create, thời điểm bắt đầu và kết thúc phải đi cùng nhau.';
      }
      if (!this.optionEnabled(this.objectiveOptions(), this.form.objective)) {
        return 'Mục tiêu campaign không được capability ERP hiện tại hỗ trợ.';
      }
      if (!this.optionEnabled(this.budgetModeOptions(), this.form.budgetMode)
        || !this.optionEnabled(this.budgetTypeOptions(), this.form.budgetType)
        || !this.optionEnabled(this.bidStrategyOptions(), this.form.bidStrategy)) {
        return 'Cấu hình ngân sách hoặc chiến lược giá thầu không được ERP hỗ trợ.';
      }
      if (this.form.budgetMode === 'ABO'
        && (this.form.budgetType !== 'NONE'
          || this.form.dailyBudgetVnd !== null
          || this.form.lifetimeBudgetVnd !== null)) {
        return 'ABO phải dùng budgetType NONE; ngân sách sẽ được cấu hình ở Ad Set.';
      }
      if (this.form.budgetMode === 'CBO' && this.form.budgetType === 'NONE') {
        return 'CBO phải chọn ngân sách ngày hoặc trọn đời.';
      }
      if (this.form.budgetMode === 'CBO' && this.form.budgetType === 'DAILY'
        && this.form.dailyBudgetVnd === null) {
        return 'CBO ngân sách ngày cần dailyBudgetVnd.';
      }
      if (this.form.budgetMode === 'CBO' && this.form.budgetType === 'LIFETIME'
        && this.form.lifetimeBudgetVnd === null) {
        return 'CBO ngân sách trọn đời cần lifetimeBudgetVnd.';
      }
      if (this.form.budgetType === 'LIFETIME' && (!this.form.startTime || !this.form.stopTime)) {
        return 'Ngân sách trọn đời cần cả thời điểm bắt đầu và kết thúc.';
      }
      if (this.form.objective === 'OUTCOME_APP_PROMOTION' && !/^\d{1,32}$/.test(this.form.appId.trim())) {
        return 'App ID dạng số là bắt buộc cho campaign quảng bá ứng dụng.';
      }
      if (!this.form.specialAdCategories.length) return 'Phải chọn Special Ad Category.';
      if (this.form.specialAdCategories.some(
        (category) => !this.optionEnabled(this.specialCategoryOptions(), category),
      )) return 'Special Ad Category không được capability ERP hỗ trợ.';
      if (!this.form.specialAdCategories.includes('NONE')
        && !this.form.specialAdCategoryCountries.length) {
        return 'Campaign thuộc Special Ad Category phải chọn quốc gia áp dụng.';
      }
      if (this.form.specialAdCategoryCountries.some((country) => !/^[A-Z]{2}$/.test(country))) {
        return 'Quốc gia Special Ad Category phải dùng mã ISO alpha-2 viết hoa, ví dụ VN.';
      }
    }

    if (this.operation() === 'update') {
      const updateError = this.validateUpdateAgainstCanonical();
      if (updateError) return updateError;
      if (!Object.keys(this.buildUpdatePayload()).length) {
        return 'Cập nhật cần ít nhất một giá trị khác canonical: tên, ngân sách, spend cap hoặc thời điểm kết thúc.';
      }
    }
    return '';
  }

  private buildDeliveryRequest(): CreateMetaCampaignActionPlanRequest {
    const actionType = this.deliveryActionType()!;
    const payload: MetaCampaignActionPayload = actionType === 'pause_ad_set'
      ? {}
      : { name: this.deliveryForm.name.trim() };
    const action: CreateMetaCampaignActionPlanRequest['actions'][number] = {
      actionType,
      adAccountId: this.normalizedAccountId(),
      reason: this.form.reason.trim(),
      idempotencyKey: this.draftIdempotencyKey,
      payload,
    };

    if (actionType === 'pause_ad_set') {
      action.campaignId = this.normalizedId(this.deliveryForm.campaignId);
      action.adSetId = this.normalizedId(this.deliveryForm.adSetId);
    } else if (actionType === 'create_ad_set') {
      action.campaignId = this.normalizedId(this.deliveryForm.campaignId);
      payload.budgetMode = this.deliveryForm.budgetMode;
      payload.budgetType = this.deliveryForm.budgetType;
      payload.optimizationGoal = this.deliveryForm.optimizationGoal;
      payload.billingEvent = this.deliveryForm.billingEvent;
      payload.destinationType = this.deliveryForm.destinationType;
      payload.targetingCountries = [...this.deliveryForm.targetingCountries];
      if (this.deliveryForm.budgetMode === 'ABO') {
        payload.adSetBidStrategy = this.deliveryForm.adSetBidStrategy;
        const daily = this.optionalPositiveInteger(this.deliveryForm.dailyBudgetVnd);
        const lifetime = this.optionalPositiveInteger(this.deliveryForm.lifetimeBudgetVnd);
        const bid = this.optionalPositiveInteger(this.deliveryForm.bidAmountVnd);
        if (daily !== undefined) payload.dailyBudgetVnd = daily;
        if (lifetime !== undefined) payload.lifetimeBudgetVnd = lifetime;
        if (bid !== undefined) payload.bidAmountVnd = bid;
      }
      if (this.deliveryForm.startTime) payload.startTime = this.isoDateTime(this.deliveryForm.startTime);
      if (this.deliveryForm.stopTime) payload.stopTime = this.isoDateTime(this.deliveryForm.stopTime);
      if (this.deliveryForm.ageMin !== null) payload.ageMin = Number(this.deliveryForm.ageMin);
      if (this.deliveryForm.ageMax !== null) payload.ageMax = Number(this.deliveryForm.ageMax);
      if (this.deliveryForm.genders.length) payload.genders = [...this.deliveryForm.genders];
      if (this.deliveryForm.publisherPlatforms.length) {
        payload.publisherPlatforms = [...this.deliveryForm.publisherPlatforms];
      }
      if (this.deliveryForm.facebookPositions.length) {
        payload.facebookPositions = [...this.deliveryForm.facebookPositions];
      }
      if (this.deliveryForm.instagramPositions.length) {
        payload.instagramPositions = [...this.deliveryForm.instagramPositions];
      }
      if (this.deliveryForm.internalAdGroupId.trim()) {
        payload.internalAdGroupId = this.deliveryForm.internalAdGroupId.trim().toLowerCase();
      }
      if (this.deliveryForm.internalProductIds.length) {
        payload.internalProductIds = [...this.deliveryForm.internalProductIds];
      }
      if (this.deliveryForm.pageId.trim()) payload.pageId = this.deliveryForm.pageId.trim();
      if (this.deliveryForm.pixelId.trim()) {
        payload.pixelId = this.deliveryForm.pixelId.trim();
        payload.customEventType = this.deliveryForm.customEventType;
      }
      if (this.deliveryForm.applicationId.trim()) {
        payload.applicationId = this.deliveryForm.applicationId.trim();
        payload.objectStoreUrl = this.deliveryForm.objectStoreUrl.trim();
      }
    } else if (actionType === 'create_ad_creative') {
      payload.pageId = this.deliveryForm.pageId.trim();
      if (this.deliveryForm.instagramActorId.trim()) {
        payload.instagramActorId = this.deliveryForm.instagramActorId.trim();
      }
      payload.message = this.deliveryForm.message.trim();
      payload.headline = this.deliveryForm.headline.trim();
      payload.description = this.deliveryForm.description.trim();
      payload.callToActionType = this.deliveryForm.callToActionType;
      payload.destinationUrl = this.deliveryForm.destinationUrl.trim();
      if (this.deliveryForm.imageHash.trim()) payload.imageHash = this.deliveryForm.imageHash.trim();
      if (this.deliveryForm.videoId.trim()) payload.videoId = this.deliveryForm.videoId.trim();
      if (this.deliveryForm.urlTags.trim()) payload.urlTags = this.deliveryForm.urlTags.trim();
    } else {
      action.adSetId = this.normalizedId(this.deliveryForm.adSetId);
      action.creativeId = this.normalizedId(this.deliveryForm.creativeId);
    }

    return {
      planName: `${this.operationLabel(actionType)} - ${
        actionType === 'pause_ad_set'
          ? this.normalizedId(this.deliveryForm.adSetId)
          : this.deliveryForm.name.trim()
      }`.slice(0, 200),
      actions: [action],
    };
  }

  private validateDeliveryForm(): string {
    const actionType = this.deliveryActionType();
    if (!this.capabilities()) return 'ERP chưa tải được capability Meta; tạo tài nguyên bị chặn an toàn.';
    if (this.capabilities()?.blockers?.length) return this.capabilities()!.blockers!.join(' ');
    if (!actionType || !this.deliveryActionSupported()) {
      return 'Backend capabilities chưa công bố action tạo tài nguyên này; ERP chặn an toàn.';
    }
    if (this.form.reason.trim().length < 10) {
      return 'Nhập lý do kinh doanh cụ thể ít nhất 10 ký tự.';
    }

    if (actionType === 'pause_ad_set') {
      if (!this.numericProviderId(this.deliveryForm.campaignId)) {
        return 'Campaign ID phải có từ 1 đến 32 chữ số.';
      }
      if (!this.numericProviderId(this.deliveryForm.adSetId)) {
        return 'Ad Set ID phải có từ 1 đến 32 chữ số.';
      }
      return '';
    }
    if (!this.deliveryForm.name.trim()) return 'Tên tài nguyên là bắt buộc.';
    if (this.deliveryForm.name.trim().length > 200) return 'Tên tài nguyên không được quá 200 ký tự.';
    if (actionType === 'create_ad_set') return this.validateAdSetForm();
    if (actionType === 'create_ad_creative') return this.validateCreativeForm();
    if (!this.numericProviderId(this.deliveryForm.adSetId)) return 'Ad Set ID phải có từ 1 đến 32 chữ số.';
    if (!this.numericProviderId(this.deliveryForm.creativeId)) return 'Creative ID phải có từ 1 đến 32 chữ số.';
    return '';
  }

  private validateAdSetForm(): string {
    if (!this.numericProviderId(this.deliveryForm.campaignId)) {
      return 'Campaign ID phải có từ 1 đến 32 chữ số.';
    }
    if (!this.optionEnabled(this.optimizationGoalOptions(), this.deliveryForm.optimizationGoal)
      || !this.optionEnabled(this.billingEventOptions(), this.deliveryForm.billingEvent)
      || !this.optionEnabled(this.destinationTypeOptions(), this.deliveryForm.destinationType)) {
      return 'Optimization, billing hoặc destination chưa được backend capabilities hỗ trợ.';
    }
    const amountError = this.validateDeliveryAmounts();
    if (amountError) return amountError;
    if (this.deliveryForm.budgetMode === 'CBO') {
      if (this.deliveryForm.budgetType !== 'NONE'
        || this.deliveryForm.dailyBudgetVnd !== null
        || this.deliveryForm.lifetimeBudgetVnd !== null
        || this.deliveryForm.bidAmountVnd !== null) {
        return 'CBO Ad Set phải dùng NONE và không mang ngân sách hoặc bid amount riêng.';
      }
    } else {
      if (!this.optionEnabled(this.adSetBidStrategyOptions(), this.deliveryForm.adSetBidStrategy)) {
        return 'Chiến lược giá thầu Ad Set chưa được backend capabilities hỗ trợ.';
      }
      if (this.deliveryForm.budgetType === 'DAILY') {
        if (this.deliveryForm.dailyBudgetVnd === null || this.deliveryForm.lifetimeBudgetVnd !== null) {
          return 'ABO DAILY cần ngân sách ngày và không được có ngân sách trọn đời.';
        }
      } else if (this.deliveryForm.budgetType === 'LIFETIME') {
        if (this.deliveryForm.lifetimeBudgetVnd === null || this.deliveryForm.dailyBudgetVnd !== null
          || !this.deliveryForm.startTime || !this.deliveryForm.stopTime) {
          return 'ABO LIFETIME cần ngân sách trọn đời, thời điểm bắt đầu và kết thúc.';
        }
      } else {
        return 'ABO Ad Set phải chọn ngân sách DAILY hoặc LIFETIME.';
      }
      const capped = ['COST_CAP', 'LOWEST_COST_WITH_BID_CAP'].includes(
        this.deliveryForm.adSetBidStrategy,
      );
      if (capped !== (this.deliveryForm.bidAmountVnd !== null)) {
        return 'Bid amount chỉ bắt buộc cho COST_CAP hoặc LOWEST_COST_WITH_BID_CAP.';
      }
    }
    const timeError = this.validateDeliverySchedule();
    if (timeError) return timeError;
    if (!this.deliveryForm.targetingCountries.length
      || this.deliveryForm.targetingCountries.length > 250
      || this.deliveryForm.targetingCountries.some((country) => !/^[A-Z]{2}$/.test(country))) {
      return 'Targeting countries cần 1–250 mã ISO alpha-2 viết hoa.';
    }
    const ageMin = this.deliveryForm.ageMin;
    const ageMax = this.deliveryForm.ageMax;
    if ((ageMin !== null && (!Number.isSafeInteger(Number(ageMin)) || Number(ageMin) < 18 || Number(ageMin) > 65))
      || (ageMax !== null && (!Number.isSafeInteger(Number(ageMax)) || Number(ageMax) < 18 || Number(ageMax) > 65))
      || (ageMin !== null && ageMax !== null && Number(ageMin) > Number(ageMax))) {
      return 'Độ tuổi phải là số nguyên 18–65 và tuổi tối thiểu không vượt tuổi tối đa.';
    }
    if (this.deliveryForm.genders.some((gender) => ![1, 2].includes(Number(gender)))) {
      return 'Giới tính chỉ nhận 1 (nam) hoặc 2 (nữ).';
    }
    if (this.deliveryForm.publisherPlatforms.some(
      (value) => !this.optionEnabled(this.publisherPlatformOptions(), value),
    )) return 'Publisher platform chưa được backend capabilities hỗ trợ.';
    if (this.deliveryForm.facebookPositions.length
      && (!this.deliveryForm.publisherPlatforms.includes('FACEBOOK')
        || this.deliveryForm.facebookPositions.some(
          (value) => !this.optionEnabled(this.facebookPositionOptions(), value),
        ))) return 'Facebook positions yêu cầu platform FACEBOOK và option được capabilities hỗ trợ.';
    if (this.deliveryForm.instagramPositions.length
      && (!this.deliveryForm.publisherPlatforms.includes('INSTAGRAM')
        || this.deliveryForm.instagramPositions.some(
          (value) => !this.optionEnabled(this.instagramPositionOptions(), value),
        ))) return 'Instagram positions yêu cầu platform INSTAGRAM và option được capabilities hỗ trợ.';

    const internalAdGroupId = this.deliveryForm.internalAdGroupId.trim();
    if (!internalAdGroupId && !this.deliveryForm.internalProductIds.length) {
      return 'Cần internal Ad Group ID và/hoặc Product IDs để map evidence ERP.';
    }
    if (internalAdGroupId && !/^[a-fA-F0-9]{24}$/.test(internalAdGroupId)) {
      return 'Internal Ad Group ID phải là Mongo ObjectId 24 ký tự hex.';
    }
    if (this.deliveryForm.internalProductIds.length > 100
      || this.deliveryForm.internalProductIds.some((id) => !/^[a-fA-F0-9]{24}$/.test(id))) {
      return 'Product IDs phải là tối đa 100 Mongo ObjectId hợp lệ.';
    }

    const numericFields = [
      [this.deliveryForm.pageId, 'Page ID'],
      [this.deliveryForm.pixelId, 'Pixel ID'],
      [this.deliveryForm.applicationId, 'Application ID'],
    ];
    for (const [value, label] of numericFields) {
      if (value && !this.numericProviderId(value)) return `${label} phải có từ 1 đến 32 chữ số.`;
    }
    if (this.deliveryForm.pixelId.trim()
      && !this.optionEnabled(this.customEventOptions(), this.deliveryForm.customEventType)) {
      return 'Custom event chưa được backend capabilities hỗ trợ.';
    }
    if (this.deliveryForm.optimizationGoal === 'OFFSITE_CONVERSIONS'
      && (!this.deliveryForm.pixelId.trim() || !this.deliveryForm.customEventType)) {
      return 'OFFSITE_CONVERSIONS cần Pixel ID và custom event.';
    }
    const requiresApp = this.deliveryForm.optimizationGoal === 'APP_INSTALLS'
      || this.deliveryForm.destinationType === 'APP';
    if (!!this.deliveryForm.applicationId.trim() !== !!this.deliveryForm.objectStoreUrl.trim()
      || (requiresApp && (!this.deliveryForm.applicationId.trim()
        || !this.deliveryForm.objectStoreUrl.trim()))) {
      return 'App delivery cần đồng thời Application ID và HTTPS store URL.';
    }
    if (this.deliveryForm.objectStoreUrl.trim()
      && !this.isCredentialFreeHttps(this.deliveryForm.objectStoreUrl)) {
      return 'Store URL phải là HTTPS hợp lệ và không chứa credential.';
    }
    if (['MESSENGER', 'WHATSAPP', 'ON_AD'].includes(this.deliveryForm.destinationType)
      && !this.deliveryForm.pageId.trim()) {
      return 'Destination MESSENGER, WHATSAPP hoặc ON_AD cần Page ID.';
    }
    return '';
  }

  private validateCreativeForm(): string {
    if (!this.numericProviderId(this.deliveryForm.pageId)) return 'Page ID phải có từ 1 đến 32 chữ số.';
    if (this.deliveryForm.instagramActorId.trim()
      && !this.numericProviderId(this.deliveryForm.instagramActorId)) {
      return 'Instagram Actor ID phải có từ 1 đến 32 chữ số.';
    }
    if (!this.deliveryForm.message.trim() || this.deliveryForm.message.trim().length > 5000) {
      return 'Message là bắt buộc và không được quá 5.000 ký tự.';
    }
    if (!this.deliveryForm.headline.trim() || this.deliveryForm.headline.trim().length > 255) {
      return 'Headline là bắt buộc và không được quá 255 ký tự.';
    }
    if (!this.deliveryForm.description.trim() || this.deliveryForm.description.trim().length > 1000) {
      return 'Description là bắt buộc và không được quá 1.000 ký tự.';
    }
    if (!this.optionEnabled(this.callToActionOptions(), this.deliveryForm.callToActionType)) {
      return 'Call to action chưa được backend capabilities hỗ trợ.';
    }
    if (!this.isCredentialFreeHttps(this.deliveryForm.destinationUrl)) {
      return 'Destination URL phải là HTTPS hợp lệ và không chứa credential.';
    }
    const hasImage = !!this.deliveryForm.imageHash.trim();
    const hasVideo = !!this.deliveryForm.videoId.trim();
    if (hasImage === hasVideo) return 'Creative cần đúng một media: imageHash hoặc videoId.';
    if (hasImage && !/^[a-fA-F0-9]{32}$/.test(this.deliveryForm.imageHash.trim())) {
      return 'Image hash phải có đúng 32 ký tự hex.';
    }
    if (hasVideo && !this.numericProviderId(this.deliveryForm.videoId)) {
      return 'Video ID phải có từ 1 đến 32 chữ số.';
    }
    if (this.deliveryForm.urlTags.length > 2048
      || /[\u0000-\u001F\u007F]/.test(this.deliveryForm.urlTags)) {
      return 'URL tags không hợp lệ hoặc vượt quá 2.048 ký tự.';
    }
    return '';
  }

  private buildUpdatePayload(): MetaCampaignActionPayload {
    const campaign = this.selectedCampaign();
    const payload: MetaCampaignActionPayload = {};
    const name = this.form.name.trim();
    if (name && (!campaign || name !== campaign.name)) payload.name = name;

    const dailyBudgetVnd = this.optionalPositiveInteger(this.form.dailyBudgetVnd);
    if (dailyBudgetVnd !== undefined
      && (!campaign || dailyBudgetVnd !== campaign.dailyBudgetVnd)) {
      payload.dailyBudgetVnd = dailyBudgetVnd;
    }
    const lifetimeBudgetVnd = this.optionalPositiveInteger(this.form.lifetimeBudgetVnd);
    if (lifetimeBudgetVnd !== undefined
      && (!campaign || lifetimeBudgetVnd !== campaign.lifetimeBudgetVnd)) {
      payload.lifetimeBudgetVnd = lifetimeBudgetVnd;
    }
    const spendCapVnd = this.optionalPositiveInteger(this.form.spendCapVnd);
    if (spendCapVnd !== undefined
      && (!campaign || spendCapVnd !== campaign.spendCapVnd)) {
      payload.spendCapVnd = spendCapVnd;
    }
    if (this.form.stopTime) {
      const stopTime = this.isoDateTime(this.form.stopTime);
      if (!campaign?.stopTime
        || new Date(stopTime).getTime() !== new Date(campaign.stopTime).getTime()) {
        payload.stopTime = stopTime;
      }
    }
    return payload;
  }

  private validateUpdateAgainstCanonical(): string {
    const campaign = this.selectedCampaign();
    if (!campaign) return '';
    const payload = this.buildUpdatePayload();
    if (payload.dailyBudgetVnd !== undefined) {
      if (campaign.budgetMode !== 'CBO' || campaign.budgetType !== 'DAILY') {
        return 'Chỉ canonical CBO DAILY mới được cập nhật ngân sách ngày.';
      }
      if (campaign.dailyBudgetVnd !== undefined
        && payload.dailyBudgetVnd > campaign.dailyBudgetVnd) {
        return 'Phase an toàn hiện tại chỉ cho giữ nguyên hoặc giảm ngân sách ngày.';
      }
    }
    if (payload.lifetimeBudgetVnd !== undefined) {
      if (campaign.budgetMode !== 'CBO' || campaign.budgetType !== 'LIFETIME') {
        return 'Chỉ canonical CBO LIFETIME mới được cập nhật ngân sách trọn đời.';
      }
      if (campaign.lifetimeBudgetVnd !== undefined
        && payload.lifetimeBudgetVnd > campaign.lifetimeBudgetVnd) {
        return 'Phase an toàn hiện tại chỉ cho giữ nguyên hoặc giảm ngân sách trọn đời.';
      }
    }
    if (payload.spendCapVnd !== undefined
      && campaign.spendCapVnd !== undefined
      && payload.spendCapVnd > campaign.spendCapVnd) {
      return 'Phase an toàn hiện tại không cho tăng spend cap.';
    }
    if (payload.stopTime && campaign.stopTime
      && new Date(payload.stopTime).getTime() > new Date(campaign.stopTime).getTime()) {
      return 'Phase an toàn hiện tại không cho kéo dài thời điểm kết thúc.';
    }
    return '';
  }

  private loadAdAccountOptions(): void {
    this.accountsLoading.set(true);
    this.accountsWarning.set('');
    this.api.getAdAccountOptions().subscribe({
      next: (response) => {
        const accounts = this.unwrapAccounts(response)
          .map((account) => this.sanitizeAccountOption(account))
          .filter((account) => /^\d{1,32}$/.test(this.accountId(account)));
        this.adAccounts.set(accounts);
        this.accountsLoading.set(false);
        if (!accounts.length) {
          this.accountsWarning.set('ERP không trả tài khoản Meta đủ điều kiện; tạo action mới bị chặn.');
        }
      },
      error: () => {
        this.adAccounts.set([]);
        this.accountsLoading.set(false);
        this.accountsWarning.set('Không tải được danh sách tài khoản Meta đã xác minh; tạo action mới bị chặn.');
      },
    });
  }

  private loadCapabilities(adAccountId?: string): void {
    this.capabilitiesLoading.set(true);
    this.capabilitiesWarning.set('');
    this.api.getCapabilities(adAccountId).subscribe({
      next: (response) => {
        const capabilities = this.unwrapCapabilities(response);
        this.capabilities.set(capabilities);
        this.capabilitiesLoading.set(false);
        this.applyCapabilityDefaults();
      },
      error: () => {
        this.capabilities.set(null);
        this.capabilitiesLoading.set(false);
        this.capabilitiesWarning.set(
          'Không tải được capability Meta. Plan đã có vẫn xem được; tạo campaign mới bị chặn an toàn.',
        );
      },
    });
  }

  private loadCampaignOptions(adAccountId: string): void {
    this.campaignsLoading.set(true);
    this.campaignsWarning.set('');
    this.api.getCampaignOptions(adAccountId).subscribe({
      next: (campaigns) => {
        this.campaignOptions.set((Array.isArray(campaigns) ? campaigns : []).filter(
          (campaign) => /^\d{1,32}$/.test(String(campaign?.campaignId || '')),
        ));
        this.campaignsLoading.set(false);
      },
      error: () => {
        this.campaignOptions.set([]);
        this.campaignsLoading.set(false);
        this.campaignsWarning.set(
          'Không tải được campaign canonical; có thể nhập Campaign ID để ERP xác minh lại.',
        );
      },
    });
  }

  private unwrapCapabilities(
    response: MetaAdsCampaignCapabilitiesResponse,
  ): MetaAdsCampaignCapabilities {
    const raw = response as any;
    return (raw?.data?.campaign || raw?.data || raw?.campaign || raw || {}) as MetaAdsCampaignCapabilities;
  }

  private unwrapAccounts(response: MetaAdsAdAccountLookupResponse): MetaAdsAdAccountOption[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray((response as any)?.data)) return (response as any).data;
    if (Array.isArray((response as any)?.accounts)) return (response as any).accounts;
    return [];
  }

  private sanitizeAccountOption(account: MetaAdsAdAccountOption): MetaAdsAdAccountOption {
    const readinessBlockers = Array.isArray(account?.readinessBlockers)
      ? account.readinessBlockers.map((blocker) => String(blocker?.message || '')).filter(Boolean)
      : [];
    return {
      adAccountId: this.accountId(account),
      name: String(account?.name || this.accountId(account)),
      currency: account?.currency ? String(account.currency) : undefined,
      timezone: account?.timezone ? String(account.timezone) : undefined,
      timezoneId: account?.timezoneId ? String(account.timezoneId) : undefined,
      eligible: account?.eligible,
      liveEligible: account?.liveEligible,
      blockers: [
        ...(Array.isArray(account?.blockers) ? account.blockers.map(String) : []),
        ...readinessBlockers,
      ],
      accountStatus: account?.accountStatus,
      lastSyncAt: account?.lastSyncAt,
      lastSyncStatus: account?.lastSyncStatus,
    };
  }

  private specialCategoryCapabilityValues(): Array<
    MetaCampaignSpecialAdCategory | MetaAdsCapabilityOption<MetaCampaignSpecialAdCategory>
  > {
    const special = this.capabilities()?.specialAdCategories;
    if (Array.isArray(special)) return special;
    return special?.officialOptions || [];
  }

  private applyCapabilityDefaults(): void {
    this.form.objective = this.enabledOrFirst(this.objectiveOptions(), this.form.objective);
    this.form.budgetMode = this.enabledOrFirst(this.budgetModeOptions(), this.form.budgetMode);
    this.form.budgetType = this.enabledOrFirst(this.budgetTypeOptions(), this.form.budgetType);
    this.form.bidStrategy = this.enabledOrFirst(this.bidStrategyOptions(), this.form.bidStrategy);
    const specialDefault = this.enabledOrFirst(this.specialCategoryOptions(), 'NONE');
    if (!this.form.specialAdCategories.every(
      (category) => this.optionEnabled(this.specialCategoryOptions(), category),
    )) this.form.specialAdCategories = specialDefault ? [specialDefault] : [];
    this.onObjectiveChange();
    this.onBudgetModeChange();
    this.onSpecialCategoriesChange();
    this.deliveryForm.adSetBidStrategy = this.enabledOrFirst(
      this.adSetBidStrategyOptions(),
      this.deliveryForm.adSetBidStrategy,
    );
    this.deliveryForm.optimizationGoal = this.enabledOrFirst(
      this.optimizationGoalOptions(),
      this.deliveryForm.optimizationGoal,
    );
    this.deliveryForm.billingEvent = this.enabledOrFirst(
      this.billingEventOptions(),
      this.deliveryForm.billingEvent,
    );
    this.deliveryForm.destinationType = this.enabledOrFirst(
      this.destinationTypeOptions(),
      this.deliveryForm.destinationType,
    );
    this.deliveryForm.callToActionType = this.enabledOrFirst(
      this.callToActionOptions(),
      this.deliveryForm.callToActionType,
    );
    this.deliveryForm.customEventType = this.enabledOrFirst(
      this.customEventOptions(),
      this.deliveryForm.customEventType,
    );
  }

  private deliveryCapabilityValues<T extends string>(
    key: string,
  ): Array<T | MetaAdsCapabilityOption<T>> | undefined {
    const capabilities = this.capabilities() as any;
    if (!capabilities) return undefined;
    const aliases: Record<string, string> = {
      adSetBidStrategies: 'bidStrategies',
      optimizationGoals: 'optimizationGoals',
      billingEvents: 'billingEvents',
      destinationTypes: 'destinationTypes',
      publisherPlatforms: 'publisherPlatforms',
      facebookPositions: 'facebookPositions',
      instagramPositions: 'instagramPositions',
      callToActionTypes: 'callToActionTypes',
      customEventTypes: 'customEventTypes',
    };
    const values = capabilities.delivery?.[key]
      || capabilities[key]
      || capabilities.adSet?.[key]
      || capabilities.adSet?.[aliases[key]]
      || capabilities.creative?.[key]
      || capabilities.creative?.[aliases[key]];
    return Array.isArray(values) ? values : undefined;
  }

  private capabilityOptions<T extends string>(
    values: Array<T | MetaAdsCapabilityOption<T>> | undefined,
    labels: Record<string, string>,
  ): Array<MetaAdsCapabilityOption<T> & { label: string }> {
    return (values || []).map((item) => {
      if (typeof item === 'string') {
        return { value: item as T, label: labels[item] || item };
      }
      return {
        value: item.value,
        label: item.label || labels[item.value] || item.value,
        disabled: item.disabled === true,
        blockers: Array.isArray(item.blockers) ? item.blockers : [],
      };
    });
  }

  private optionEnabled<T extends string>(
    options: Array<MetaAdsCapabilityOption<T>>,
    value: T,
  ): boolean {
    return options.some((option) => option.value === value && option.disabled !== true);
  }

  private enabledOrFirst<T extends string>(
    options: Array<MetaAdsCapabilityOption<T>>,
    current: T,
  ): T {
    if (this.optionEnabled(options, current)) return current;
    return (options.find((option) => option.disabled !== true)?.value || current) as T;
  }

  private validateOptionalAmounts(): string {
    const fields: Array<[number | null, string]> = [
      [this.form.dailyBudgetVnd, 'Ngân sách ngày'],
      [this.form.lifetimeBudgetVnd, 'Ngân sách trọn đời'],
      [this.form.spendCapVnd, 'Spend cap'],
    ];
    for (const [value, label] of fields) {
      if (value === null) continue;
      if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        return `${label} phải là số nguyên dương an toàn.`;
      }
    }
    return '';
  }

  private validateDeliveryAmounts(): string {
    const fields: Array<[number | null, string]> = [
      [this.deliveryForm.dailyBudgetVnd, 'Ngân sách ngày'],
      [this.deliveryForm.lifetimeBudgetVnd, 'Ngân sách trọn đời'],
      [this.deliveryForm.bidAmountVnd, 'Bid amount'],
    ];
    for (const [value, label] of fields) {
      if (value === null) continue;
      if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
        return `${label} phải là số nguyên dương an toàn.`;
      }
    }
    return '';
  }

  private validateSchedule(): string {
    const start = this.form.startTime ? this.accountDateTime(this.form.startTime) : undefined;
    const stop = this.form.stopTime ? this.accountDateTime(this.form.stopTime) : undefined;
    if (start && Number.isNaN(start.getTime())) return 'Thời điểm bắt đầu không hợp lệ.';
    if (stop && Number.isNaN(stop.getTime())) return 'Thời điểm kết thúc không hợp lệ.';
    if (start && stop && start.getTime() >= stop.getTime()) {
      return 'Thời điểm kết thúc phải sau thời điểm bắt đầu.';
    }
    return '';
  }

  private validateDeliverySchedule(): string {
    const start = this.deliveryForm.startTime
      ? this.accountDateTime(this.deliveryForm.startTime)
      : undefined;
    const stop = this.deliveryForm.stopTime
      ? this.accountDateTime(this.deliveryForm.stopTime)
      : undefined;
    if (start && Number.isNaN(start.getTime())) return 'Thời điểm bắt đầu Ad Set không hợp lệ.';
    if (stop && Number.isNaN(stop.getTime())) return 'Thời điểm kết thúc Ad Set không hợp lệ.';
    if (start && stop && start.getTime() >= stop.getTime()) {
      return 'Thời điểm kết thúc Ad Set phải sau thời điểm bắt đầu.';
    }
    return '';
  }

  private resetMutableCampaignFields(): void {
    this.form.name = '';
    this.form.dailyBudgetVnd = null;
    this.form.lifetimeBudgetVnd = null;
    this.form.spendCapVnd = null;
    this.form.startTime = '';
    this.form.stopTime = '';
  }

  private resetDeliveryForm(stage: MetaAdsResourceStage): void {
    this.deliveryForm.name = '';
    this.deliveryForm.campaignId = '';
    this.deliveryForm.adSetId = '';
    this.deliveryForm.creativeId = '';
    this.deliveryForm.dailyBudgetVnd = null;
    this.deliveryForm.lifetimeBudgetVnd = null;
    this.deliveryForm.bidAmountVnd = null;
    this.deliveryForm.startTime = '';
    this.deliveryForm.stopTime = '';
    this.deliveryForm.targetingCountries = [];
    this.deliveryForm.ageMin = null;
    this.deliveryForm.ageMax = null;
    this.deliveryForm.genders = [];
    this.deliveryForm.publisherPlatforms = [];
    this.deliveryForm.facebookPositions = [];
    this.deliveryForm.instagramPositions = [];
    this.deliveryForm.internalAdGroupId = '';
    this.deliveryForm.internalProductIds = [];
    this.deliveryForm.pageId = '';
    this.deliveryForm.instagramActorId = '';
    this.deliveryForm.pixelId = '';
    this.deliveryForm.applicationId = '';
    this.deliveryForm.objectStoreUrl = '';
    this.deliveryForm.message = '';
    this.deliveryForm.headline = '';
    this.deliveryForm.description = '';
    this.deliveryForm.destinationUrl = '';
    this.deliveryForm.imageHash = '';
    this.deliveryForm.videoId = '';
    this.deliveryForm.urlTags = '';
    this.targetingCountriesInput = '';
    this.internalProductIdsInput = '';
    if (stage === 'ad_set') this.onAdSetBudgetModeChange();
  }

  private splitUnique(value: string, uppercase: boolean): string[] {
    const normalized = String(value || '').split(/[\s,;]+/)
      .map((item) => uppercase ? item.trim().toUpperCase() : item.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }

  private numericProviderId(value: string): boolean {
    return /^\d{1,32}$/.test(this.normalizedId(value));
  }

  private normalizedId(value: string): string {
    return String(value || '').trim().replace(/[\s-]/g, '');
  }

  private isCredentialFreeHttps(value: string): boolean {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  private campaignBudgetLabel(campaign: MetaAdsCampaignLookupOption): string {
    if (campaign.budgetMode !== 'CBO') return `${campaign.budgetMode || 'ABO'} / NONE`;
    if (campaign.budgetType === 'DAILY' && campaign.dailyBudgetVnd !== undefined) {
      return `CBO / DAILY / ${this.formatVnd(campaign.dailyBudgetVnd)}`;
    }
    if (campaign.budgetType === 'LIFETIME' && campaign.lifetimeBudgetVnd !== undefined) {
      return `CBO / LIFETIME / ${this.formatVnd(campaign.lifetimeBudgetVnd)}`;
    }
    return `CBO / ${campaign.budgetType || 'UNKNOWN'}`;
  }

  private accountDateTimeInput(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() + 7 * 60 * 60_000).toISOString().slice(0, 16);
  }

  private optionalPositiveInteger(value: number | null): number | undefined {
    return value === null ? undefined : Number(value);
  }

  private isoDateTime(value: string): string {
    return this.accountDateTime(value).toISOString();
  }

  private accountDateTime(value: string): Date {
    const normalized = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
      const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
      return new Date(`${withSeconds}+07:00`);
    }
    return new Date(normalized);
  }

  private planIdentifier(plan: MetaCampaignActionPlan | null): string {
    return String(plan?.planId || plan?.id || plan?._id || '');
  }

  private normalizedAccountId(): string {
    return String(this.form.adAccountId || '').trim().replace(/^act_/i, '').replace(/[\s-]/g, '');
  }

  private normalizedCampaignId(): string {
    return String(this.form.campaignId || '').trim().replace(/[\s-]/g, '');
  }

  private setPlan(plan: MetaCampaignActionPlan): void {
    this.plan.set(plan);
    this.lookupPlanId = this.planIdentifier(plan);
    this.error.set('');
  }

  private loadExecutions(): void {
    const planId = this.planId();
    if (!planId) return;
    this.api.getExecutions(planId).subscribe({
      next: (executions) => this.executions.set(Array.isArray(executions) ? executions : []),
      error: () => this.executions.set([]),
    });
  }

  private run<T>(key: string, request: Observable<T>, success: (value: T) => void): void {
    this.loadingAction.set(key);
    this.error.set('');
    this.message.set('');
    request.subscribe({
      next: (value: T) => {
        this.loadingAction.set('');
        success(value);
      },
      error: (error: any) => {
        this.loadingAction.set('');
        const responseMessage = error?.error?.message;
        this.error.set(Array.isArray(responseMessage)
          ? responseMessage.join(' ')
          : responseMessage || error?.message || 'Thao tác Meta campaign thất bại.');
      },
    });
  }

  private newIdempotencyKey(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return `META-UI-${uuid || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  }
}

const OBJECTIVE_LABELS: Record<MetaCampaignObjective, string> = {
  OUTCOME_AWARENESS: 'Nhận biết',
  OUTCOME_TRAFFIC: 'Lưu lượng truy cập',
  OUTCOME_ENGAGEMENT: 'Tương tác',
  OUTCOME_LEADS: 'Khách hàng tiềm năng',
  OUTCOME_SALES: 'Doanh số',
  OUTCOME_APP_PROMOTION: 'Quảng bá ứng dụng',
};

const BUDGET_MODE_LABELS: Record<MetaCampaignBudgetMode, string> = {
  ABO: 'ABO — ngân sách ở Ad Set',
  CBO: 'CBO — ngân sách ở Campaign',
};

const BUDGET_TYPE_LABELS: Record<MetaCampaignBudgetType, string> = {
  NONE: 'Không đặt ở Campaign',
  DAILY: 'Ngân sách ngày',
  LIFETIME: 'Ngân sách trọn đời',
};

const BID_STRATEGY_LABELS: Record<MetaCampaignBidStrategy, string> = {
  LOWEST_COST_WITHOUT_CAP: 'Chi phí thấp nhất — không giới hạn giá thầu',
  COST_CAP: 'Giới hạn chi phí',
  LOWEST_COST_WITH_BID_CAP: 'Chi phí thấp nhất — giới hạn giá thầu',
  LOWEST_COST_WITH_MIN_ROAS: 'ROAS tối thiểu',
};

const SPECIAL_CATEGORY_LABELS: Record<MetaCampaignSpecialAdCategory, string> = {
  NONE: 'Không thuộc danh mục đặc biệt',
  CREDIT: 'Tín dụng',
  EMPLOYMENT: 'Việc làm',
  FINANCIAL_PRODUCTS_SERVICES: 'Sản phẩm và dịch vụ tài chính',
  HOUSING: 'Nhà ở',
  ISSUES_ELECTIONS_POLITICS: 'Vấn đề xã hội, bầu cử hoặc chính trị',
  ONLINE_GAMBLING_AND_GAMING: 'Cờ bạc và trò chơi trực tuyến',
};

const COUNTRY_LABELS: Record<string, string> = {
  VN: 'Việt Nam',
  US: 'Hoa Kỳ',
  SG: 'Singapore',
  TH: 'Thái Lan',
};

const AD_SET_BID_STRATEGY_LABELS: Record<MetaAdSetBidStrategy, string> = {
  LOWEST_COST_WITHOUT_CAP: 'Chi phí thấp nhất — không giới hạn',
  COST_CAP: 'Giới hạn chi phí',
  LOWEST_COST_WITH_BID_CAP: 'Chi phí thấp nhất — giới hạn giá thầu',
};

const OPTIMIZATION_GOAL_LABELS: Record<MetaAdSetOptimizationGoal, string> = {
  APP_INSTALLS: 'Lượt cài đặt ứng dụng',
  IMPRESSIONS: 'Lượt hiển thị',
  LANDING_PAGE_VIEWS: 'Lượt xem trang đích',
  LEAD_GENERATION: 'Khách hàng tiềm năng',
  LINK_CLICKS: 'Lượt nhấp liên kết',
  OFFSITE_CONVERSIONS: 'Chuyển đổi ngoài Meta',
  POST_ENGAGEMENT: 'Tương tác bài viết',
  QUALITY_LEAD: 'Lead chất lượng',
  REACH: 'Số người tiếp cận',
  THRUPLAY: 'ThruPlay',
};

const BILLING_EVENT_LABELS: Record<MetaAdSetBillingEvent, string> = {
  IMPRESSIONS: 'Lượt hiển thị',
  LINK_CLICKS: 'Lượt nhấp liên kết',
};

const DESTINATION_TYPE_LABELS: Record<MetaAdSetDestinationType, string> = {
  APP: 'Ứng dụng',
  MESSENGER: 'Messenger',
  ON_AD: 'Trên quảng cáo',
  WEBSITE: 'Website',
  WHATSAPP: 'WhatsApp',
};

const PUBLISHER_PLATFORM_LABELS: Record<MetaPublisherPlatform, string> = {
  AUDIENCE_NETWORK: 'Audience Network',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  MESSENGER: 'Messenger',
};

const FACEBOOK_POSITION_LABELS: Record<MetaFacebookPosition, string> = {
  FEED: 'Feed',
  INSTREAM_VIDEO: 'In-stream video',
  MARKETPLACE: 'Marketplace',
  RIGHT_HAND_COLUMN: 'Cột bên phải',
  SEARCH: 'Kết quả tìm kiếm',
  STORY: 'Story',
};

const INSTAGRAM_POSITION_LABELS: Record<MetaInstagramPosition, string> = {
  EXPLORE: 'Explore',
  PROFILE_FEED: 'Profile feed',
  REELS: 'Reels',
  STORY: 'Story',
  STREAM: 'Feed',
};

const CALL_TO_ACTION_LABELS: Record<MetaCallToActionType, string> = {
  APPLY_NOW: 'Ứng tuyển ngay',
  BOOK_NOW: 'Đặt ngay',
  CONTACT_US: 'Liên hệ',
  DOWNLOAD: 'Tải xuống',
  GET_QUOTE: 'Nhận báo giá',
  LEARN_MORE: 'Tìm hiểu thêm',
  SEND_MESSAGE: 'Gửi tin nhắn',
  SHOP_NOW: 'Mua ngay',
  SIGN_UP: 'Đăng ký',
  WHATSAPP_MESSAGE: 'Nhắn WhatsApp',
};

const CUSTOM_EVENT_LABELS: Record<MetaCustomEventType, string> = {
  ADD_TO_CART: 'Thêm vào giỏ',
  COMPLETE_REGISTRATION: 'Hoàn tất đăng ký',
  CONTACT: 'Liên hệ',
  CONTENT_VIEW: 'Xem nội dung',
  INITIATED_CHECKOUT: 'Bắt đầu thanh toán',
  LEAD: 'Lead',
  PURCHASE: 'Mua hàng',
  SEARCH: 'Tìm kiếm',
  SUBMIT_APPLICATION: 'Gửi đơn',
};
