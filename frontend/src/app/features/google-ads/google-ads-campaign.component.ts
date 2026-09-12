import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  CreateGoogleCampaignActionPlanRequest,
  GoogleAdsAdGroupLookupResponse,
  GoogleAdsAdGroupOption,
  GoogleAdsAccountLookupResponse,
  GoogleAdsAccountOption,
  GoogleAdsBiddingLifecyclePolicy,
  GoogleAdsBiddingLifecycleResponse,
  GoogleAdsBiddingLifecycleStage,
  GoogleAdsBiddingLifecycleState,
  GoogleAdsCampaignCapabilities,
  GoogleAdsCampaignCapabilitiesResponse,
  GoogleAdsCampaignLookupResponse,
  GoogleAdsCampaignOption,
  GoogleAdsCampaignService,
  GoogleAdsCapabilityOption,
  GoogleAdsKeywordLookupResponse,
  GoogleAdsKeywordOption,
  GoogleAdsResponsiveSearchAdLookupResponse,
  GoogleAdsResponsiveSearchAdOption,
  GoogleAdsSearchReadiness,
  GoogleAdsSearchReadinessResponse,
  GoogleCampaignActionPlan,
  GoogleCampaignActionPayload,
  GoogleCampaignActionType,
  GoogleCampaignBiddingStrategy,
  GoogleCampaignExecution,
  GoogleCampaignPlanItem,
  GooglePositiveGeoTargetType,
  GoogleKeywordMatchType,
  GoogleRsaDescriptionPinnedField,
  GoogleRsaHeadlinePinnedField,
  GoogleRsaAssetPin,
} from './google-ads-campaign.service';

type CampaignOperation = 'create' | 'update' | 'pause' | 'activate';
type SearchResourceScope = 'campaign' | 'ad_group' | 'keyword' | 'responsive_search_ad';

@Component({
  selector: 'app-google-ads-campaign',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './google-ads-campaign.component.html',
  styleUrl: './google-ads-campaign.component.css',
})
export class GoogleAdsCampaignComponent implements OnInit {
  private readonly api = inject(GoogleAdsCampaignService);
  private readonly auth = inject(AuthService);

  readonly canRead = computed(() => this.auth.hasPermission('google-ads.read'));
  readonly canPlan = computed(() => this.auth.hasPermission('google-ads.plan'));
  readonly canValidate = this.canPlan;
  readonly canApprove = computed(() => this.auth.hasPermission('google-ads.approve'));
  readonly canExecute = computed(() => this.auth.hasPermission('google-ads.execute'));

  resourceScope = signal<SearchResourceScope>('campaign');
  operation = signal<CampaignOperation>('create');
  capabilities = signal<GoogleAdsCampaignCapabilities | null>(null);
  accounts = signal<GoogleAdsAccountOption[]>([]);
  campaigns = signal<GoogleAdsCampaignOption[]>([]);
  adGroups = signal<GoogleAdsAdGroupOption[]>([]);
  keywords = signal<GoogleAdsKeywordOption[]>([]);
  responsiveSearchAds = signal<GoogleAdsResponsiveSearchAdOption[]>([]);
  readiness = signal<GoogleAdsSearchReadiness | null>(null);
  biddingLifecyclePolicy = signal<GoogleAdsBiddingLifecyclePolicy | null>(null);
  biddingLifecycleState = signal<GoogleAdsBiddingLifecycleState | null>(null);
  biddingLifecycleLoaded = signal(false);
  plan = signal<GoogleCampaignActionPlan | null>(null);
  executions = signal<GoogleCampaignExecution[]>([]);
  capabilitiesLoading = signal(false);
  accountsLoading = signal(false);
  campaignsLoading = signal(false);
  childResourcesLoading = signal(false);
  readinessLoading = signal(false);
  biddingLifecycleLoading = signal(false);
  capabilitiesWarning = signal('');
  accountsWarning = signal('');
  campaignsWarning = signal('');
  childResourcesWarning = signal('');
  readinessWarning = signal('');
  biddingLifecycleWarning = signal('');
  loadingAction = signal('');
  error = signal('');
  message = signal('');

  lookupPlanId = '';
  rejectionReason = '';
  liveConfirmation = '';
  geoTargetIdsInput = '';
  languageIdsInput = '';
  headlinesInput = '';
  descriptionsInput = '';
  private draftIdempotencyKey = this.newIdempotencyKey();

  form = {
    customerId: '',
    campaignId: '',
    campaignName: '',
    budgetName: '',
    dailyBudgetVnd: null as number | null,
    biddingStrategyType: 'MAXIMIZE_CLICKS' as GoogleCampaignBiddingStrategy,
    startDate: '',
    endDate: '',
    searchPartnersEnabled: false,
    geoTargetConstantIds: [] as string[],
    languageConstantIds: [] as string[],
    positiveGeoTargetType: 'PRESENCE' as GooglePositiveGeoTargetType,
    doesNotContainEuPoliticalAdvertising: false,
    reason: '',
  };

  resourceForm = {
    adGroupId: '',
    criterionId: '',
    adId: '',
    adGroupName: '',
    cpcBidVnd: null as number | null,
    keywordText: '',
    matchType: 'EXACT' as GoogleKeywordMatchType,
    negative: false,
    finalUrl: '',
    headlines: [] as string[],
    descriptions: [] as string[],
    path1: '',
    path2: '',
    trackingUrlTemplate: '',
    finalUrlSuffix: '',
    headlinePinFields: [] as Array<GoogleRsaHeadlinePinnedField | ''>,
    descriptionPinFields: [] as Array<GoogleRsaDescriptionPinnedField | ''>,
  };

  biddingLifecycleForm = {
    enabled: false,
    clickThreshold: 50,
    clickWindowDays: 30,
    maxCpcBidCeilingVnd: null as number | null,
    maximizeConversionsMinConversions: 15,
    conversionWindowDays: 30,
    targetCpaMinConversions: 30,
    targetCpaVnd: null as number | null,
    cooldownHours: 168,
    minimumStageDwellHours: 168,
    draftOnly: true as const,
  };

  readonly biddingStrategyOptions = computed(() =>
    this.capabilityOptions(this.capabilities()?.biddingStrategies),
  );
  readonly items = computed(() => this.plan()?.items || this.plan()?.actions || []);
  readonly planId = computed(() => String(this.plan()?.planId || this.plan()?.id || '').trim());
  readonly providerValidated = computed(() => {
    const items = this.items();
    return this.plan()?.providerValidationStatus === 'passed'
      && items.length > 0
      && items.every((item) => item.providerValidationStatus === 'provider_validate_passed');
  });
  readonly allItemsApproved = computed(() => {
    const items = this.items();
    return items.length > 0 && items.every((item) => ['approved', 'executed'].includes(item.status));
  });
  readonly currentUserId = computed(() => {
    const user = this.auth.user() as any;
    return String(user?._id || user?.id || '').trim();
  });
  readonly creatorConflict = computed(() => {
    const creatorId = String(this.plan()?.createdByUserId || '').trim();
    return !!creatorId && creatorId === this.currentUserId();
  });
  readonly approverConflict = computed(() => {
    const actorId = this.currentUserId();
    return !!actorId && this.items().some(
      (item) => String(item.approvedByUserId || '').trim() === actorId,
    );
  });
  readonly dryRunPassed = computed(() => this.executions().some((execution) =>
    execution.dryRun === true
      && ['success', 'succeeded', 'completed', 'eligible', 'dry_run_passed'].includes(
        String(execution.status || '').toLowerCase(),
      ),
  ));
  readonly liveExecuted = computed(() => this.executions().some((execution) =>
    execution.dryRun !== true
      && execution.reconciliationRequired !== true
      && ['success', 'succeeded', 'completed', 'executed', 'reconciled'].includes(
        String(execution.status || '').toLowerCase(),
      ),
  ));
  readonly configurationWarning = computed(() => [
    this.accountsWarning(),
    this.capabilitiesWarning(),
    this.campaignsWarning(),
    this.childResourcesWarning(),
    this.readinessWarning(),
    this.biddingLifecycleWarning(),
  ].filter(Boolean).join(' '));
  readonly readinessReady = computed(() => {
    const readiness = this.readiness();
    return readiness?.ready === true || readiness?.eligible === true;
  });
  readonly readinessBlockers = computed(() => Array.from(new Set([
    ...(this.readiness()?.blockers || []),
    ...(this.readiness()?.checks || [])
      .filter((check) => check.passed === false || String(check.status || '').toLowerCase() === 'failed')
      .map((check) => check.message || check.label || check.code || 'Readiness check chưa đạt'),
  ])));
  readonly activationEvidence = computed(() => this.readiness()?.activation || null);
  readonly activationEvidenceReady = computed(() => {
    const activation = this.activationEvidence();
    return activation?.ready === true || activation?.eligible === true;
  });
  readonly activationBlockers = computed(() => Array.from(new Set([
    ...(this.activationEvidence()?.blockers || []),
    ...Object.values(this.activationEvidence()?.stages || {})
      .flatMap((stage) => stage.blockers || []),
  ])));
  readonly biddingLifecycleBlockers = computed(() =>
    Array.from(new Set(this.biddingLifecycleState()?.blockers || [])),
  );
  readonly biddingLifecyclePendingDraftPlanId = computed(() =>
    String(this.biddingLifecycleState()?.pendingDraft?.planId || '').trim(),
  );
  readonly liveBlockers = computed(() => Array.from(new Set([
    ...(this.capabilities()?.productionEnabled === true
      ? []
      : ['GOOGLE_ADS_PRODUCTION_ENABLED chưa được ERP xác nhận là true.']),
    ...(this.planActionLiveGatesPassed()
      ? []
      : ['Live action gate cho loại thao tác này đang tắt.']),
    ...(this.plan()?.blockers || []),
    ...(this.plan()?.liveEligibility?.blockers || []),
    ...this.items().flatMap((item) => item.blockers || []),
    ...(!this.providerValidated() ? ['Provider validateOnly chưa đạt hoặc đã hết hạn.'] : []),
    ...(!this.allItemsApproved() ? ['Tất cả action chưa được duyệt.'] : []),
    ...(!this.dryRunPassed() ? ['Chưa có dry-run thành công cho plan này.'] : []),
    ...(this.approverConflict() ? ['Người duyệt không được thực thi live.'] : []),
  ])));

  ngOnInit(): void {
    if (!this.canRead()) return;
    this.loadAccounts();
    this.loadCapabilities();
  }

  selectResource(scope: SearchResourceScope): void {
    this.resourceScope.set(scope);
    this.operation.set('create');
    this.resetChildSelection();
    this.error.set('');
    this.message.set('');
    const customerId = this.normalizedCustomerId();
    const campaignId = this.normalizedCampaignId();
    if (scope !== 'campaign' && customerId && campaignId) {
      this.loadAdGroups(customerId, campaignId);
      this.loadReadiness(customerId, campaignId);
    }
  }

  selectOperation(operation: CampaignOperation): void {
    this.operation.set(operation);
    if (this.resourceScope() === 'campaign' && operation === 'create') {
      this.form.campaignId = '';
      this.adGroups.set([]);
      this.readiness.set(null);
      this.resetBiddingLifecycle();
    }
    if (operation === 'create') {
      this.resourceForm.criterionId = '';
      this.resourceForm.adId = '';
    }
    this.error.set('');
    this.message.set('');
  }

  onAccountChange(): void {
    this.form.campaignId = '';
    this.campaigns.set([]);
    this.adGroups.set([]);
    this.keywords.set([]);
    this.responsiveSearchAds.set([]);
    this.readiness.set(null);
    this.resetBiddingLifecycle();
    this.resetChildSelection();
    const customerId = this.normalizedCustomerId();
    this.loadCapabilities(customerId || undefined);
    if (customerId) this.loadCampaigns(customerId);
  }

  onCampaignChange(): void {
    const campaign = this.selectedCampaign();
    if (!campaign) {
      this.resetBiddingLifecycle();
      return;
    }
    if (this.resourceScope() === 'campaign' && this.operation() === 'update') {
      this.form.campaignName = campaign.name;
      this.form.endDate = campaign.endDate || '';
    }
    const canonicalBudget = campaign.dailyBudgetVnd
      ?? campaign.budget?.dailyBudgetVnd
      ?? (campaign.amountMicros === undefined ? undefined : campaign.amountMicros / 1_000_000);
    if (canonicalBudget !== undefined) this.form.dailyBudgetVnd = canonicalBudget;
    const customerId = this.normalizedCustomerId();
    const campaignId = this.normalizedCampaignId();
    if (customerId && campaignId) {
      this.loadAdGroups(customerId, campaignId);
      this.loadReadiness(customerId, campaignId);
      this.loadBiddingLifecycle(customerId, campaignId);
    }
  }

  onAdGroupChange(): void {
    this.resourceForm.criterionId = '';
    this.resourceForm.adId = '';
    this.keywords.set([]);
    this.responsiveSearchAds.set([]);
    const adGroup = this.selectedAdGroup();
    if (!adGroup) return;
    if (this.resourceScope() === 'ad_group' && this.operation() === 'update') {
      this.resourceForm.adGroupName = adGroup.adGroupName || adGroup.name || '';
      this.resourceForm.cpcBidVnd = this.microsToVnd(adGroup.cpcBidVnd, adGroup.cpcBidMicros);
    }
    const customerId = this.normalizedCustomerId();
    if (customerId) {
      if (this.resourceScope() === 'keyword') this.loadKeywords(customerId, adGroup.adGroupId);
      if (this.resourceScope() === 'responsive_search_ad') {
        this.loadResponsiveSearchAds(customerId, adGroup.adGroupId);
      }
    }
  }

  onKeywordChange(): void {
    const keyword = this.selectedKeyword();
    if (!keyword || this.operation() !== 'update') return;
    this.resourceForm.cpcBidVnd = this.microsToVnd(keyword.cpcBidVnd, keyword.cpcBidMicros);
    this.resourceForm.finalUrl = keyword.finalUrl || keyword.finalUrls?.[0] || '';
  }

  onResponsiveSearchAdChange(): void {
    const ad = this.selectedResponsiveSearchAd();
    if (!ad || this.operation() !== 'update') return;
    this.resourceForm.finalUrl = ad.finalUrl || ad.finalUrls?.[0] || '';
    this.resourceForm.headlines = this.assetTexts(ad.headlines);
    this.resourceForm.descriptions = this.assetTexts(ad.descriptions);
    this.headlinesInput = this.resourceForm.headlines.join('\n');
    this.descriptionsInput = this.resourceForm.descriptions.join('\n');
    this.resourceForm.path1 = ad.path1 || '';
    this.resourceForm.path2 = ad.path2 || '';
    this.resourceForm.trackingUrlTemplate = ad.trackingUrlTemplate || '';
    this.resourceForm.finalUrlSuffix = ad.finalUrlSuffix || '';
    this.resourceForm.headlinePinFields = this.pinFields(
      this.resourceForm.headlines.length,
      ad.headlinePins,
    ) as Array<GoogleRsaHeadlinePinnedField | ''>;
    this.resourceForm.descriptionPinFields = this.pinFields(
      this.resourceForm.descriptions.length,
      ad.descriptionPins,
    ) as Array<GoogleRsaDescriptionPinnedField | ''>;
  }

  onGeoTargetIdsInput(value: string): void {
    this.geoTargetIdsInput = value;
    this.form.geoTargetConstantIds = this.parseProviderIds(value);
  }

  onLanguageIdsInput(value: string): void {
    this.languageIdsInput = value;
    this.form.languageConstantIds = this.parseProviderIds(value);
  }

  onHeadlinesInput(value: string): void {
    this.headlinesInput = value;
    this.resourceForm.headlines = this.parseAssetLines(value);
    this.resourceForm.headlinePinFields = this.resizePins(
      this.resourceForm.headlinePinFields,
      this.resourceForm.headlines.length,
    );
  }

  onDescriptionsInput(value: string): void {
    this.descriptionsInput = value;
    this.resourceForm.descriptions = this.parseAssetLines(value);
    this.resourceForm.descriptionPinFields = this.resizePins(
      this.resourceForm.descriptionPinFields,
      this.resourceForm.descriptions.length,
    );
  }

  activationStageLabel(): string {
    if (this.resourceScope() === 'responsive_search_ad') return 'Bước 1/4 · kích hoạt RSA đã được policy APPROVED';
    if (this.resourceScope() === 'keyword') return 'Bước 2/4 · kích hoạt positive keyword sau RSA';
    if (this.resourceScope() === 'ad_group') return 'Bước 3/4 · kích hoạt Ad Group sau RSA và keyword';
    return 'Bước 4/4 · kích hoạt campaign sau cùng';
  }

  biddingLifecycleStageLabel(stage?: GoogleAdsBiddingLifecycleStage): string {
    if (!stage) return 'Chưa có trạng thái canonical';
    return BIDDING_LIFECYCLE_STAGE_LABELS[stage] || stage;
  }

  saveBiddingLifecycle(): void {
    if (!this.canPlan() || this.loadingAction()) return;
    const validationError = this.validateBiddingLifecycleForm();
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    const customerId = this.normalizedCustomerId();
    const campaignId = this.normalizedCampaignId();
    const policy = this.buildBiddingLifecyclePolicy();
    this.run(
      'save-bidding-lifecycle',
      this.api.updateBiddingLifecycle(customerId, campaignId, policy),
      (response) => {
        this.applyBiddingLifecycleResponse(response);
        this.message.set(
          'Đã lưu chính sách lifecycle trong ERP. Chính sách chỉ được tạo draft action plan, không tự execute live.',
        );
      },
    );
  }

  evaluateBiddingLifecycle(): void {
    if (!this.canPlan() || this.loadingAction()) return;
    if (!this.biddingLifecycleLoaded()) {
      this.error.set('Chưa tải được chính sách lifecycle canonical từ ERP.');
      return;
    }
    if (this.capabilities()?.biddingLifecycle?.supported !== true
      || this.capabilities()?.biddingLifecycle?.draftOnly !== true) {
      this.error.set('Backend ERP chưa công bố bidding lifecycle draft-only an toàn trong capabilities.');
      return;
    }
    if (!this.biddingLifecycleForm.enabled) {
      this.error.set('Bật lifecycle và lưu policy trước khi yêu cầu đánh giá.');
      return;
    }
    const customerId = this.normalizedCustomerId();
    const campaignId = this.normalizedCampaignId();
    if (!customerId || !campaignId || !this.selectedCampaign()) {
      this.error.set('Chọn campaign canonical trước khi đánh giá lifecycle.');
      return;
    }
    this.run(
      'evaluate-bidding-lifecycle',
      this.api.evaluateBiddingLifecycle(customerId, campaignId),
      (response) => {
        this.applyBiddingLifecycleResponse(response);
        this.message.set(
          response.state?.pendingDraft?.planId
            ? `ERP đã tạo draft ${response.state.pendingDraft.planId}; chưa có mutate live.`
            : 'ERP đã đánh giá lifecycle. Không có transition draft mới được tạo.',
        );
      },
    );
  }

  openBiddingLifecycleDraft(): void {
    const planId = this.biddingLifecyclePendingDraftPlanId();
    if (!planId || !this.canRead() || this.loadingAction()) return;
    this.lookupPlanId = planId;
    this.loadPlan();
  }

  selectedAccount(): GoogleAdsAccountOption | undefined {
    return this.accounts().find((account) => account.customerId === this.normalizedCustomerId());
  }

  selectedCampaign(): GoogleAdsCampaignOption | undefined {
    return this.campaigns().find((campaign) => campaign.campaignId === this.normalizedCampaignId());
  }

  selectedAdGroup(): GoogleAdsAdGroupOption | undefined {
    return this.adGroups().find((adGroup) => adGroup.adGroupId === this.resourceForm.adGroupId);
  }

  selectedKeyword(): GoogleAdsKeywordOption | undefined {
    return this.keywords().find((keyword) => keyword.criterionId === this.resourceForm.criterionId);
  }

  selectedResponsiveSearchAd(): GoogleAdsResponsiveSearchAdOption | undefined {
    return this.responsiveSearchAds().find((ad) => ad.adId === this.resourceForm.adId);
  }

  accountLabel(account: GoogleAdsAccountOption): string {
    const name = account.descriptiveName || account.name || 'Google Ads account';
    const context = [account.currencyCode || account.currency, account.timeZone || account.timezone]
      .filter(Boolean).join(' · ');
    return `${name} (${account.customerId})${context ? ` · ${context}` : ''}`;
  }

  campaignLabel(campaign: GoogleAdsCampaignOption): string {
    return `${campaign.name} (${campaign.campaignId}) · ${campaign.status || 'UNKNOWN'}`;
  }

  adGroupLabel(adGroup: GoogleAdsAdGroupOption): string {
    return `${adGroup.adGroupName || adGroup.name || 'Ad group'} (${adGroup.adGroupId}) · ${adGroup.status || 'UNKNOWN'}`;
  }

  keywordLabel(keyword: GoogleAdsKeywordOption): string {
    return `${keyword.negative ? 'NEGATIVE · ' : ''}${keyword.keywordText} [${keyword.matchType}] · ${keyword.status || 'UNKNOWN'}`;
  }

  responsiveSearchAdLabel(ad: GoogleAdsResponsiveSearchAdOption): string {
    const headline = this.assetTexts(ad.headlines)[0] || 'Responsive Search Ad';
    return `${headline} (${ad.adId}) · ${ad.status || 'UNKNOWN'}`;
  }

  accountBlockers(account: GoogleAdsAccountOption): string {
    return [
      ...(account.blockers || []),
      ...(account.readinessBlockers || []).map((blocker) =>
        typeof blocker === 'string' ? blocker : blocker.message),
    ].join('; ');
  }

  createPlan(): void {
    if (!this.canPlan() || this.loadingAction()) return;
    const validationError = this.validateForm();
    if (validationError) {
      this.error.set(validationError);
      return;
    }
    this.run('create', this.api.createPlan(this.buildRequest()), (plan) => {
      this.executions.set([]);
      this.setPlan(plan);
      this.draftIdempotencyKey = this.newIdempotencyKey();
      this.message.set('Đã lưu draft trong ERP. Chưa có thay đổi nào được gửi lên Google Ads.');
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
          `ERP đã tạo ${result.created} Google pause draft; `
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
      this.executions.set([]);
      this.setPlan(plan);
      this.loadExecutions();
    });
  }

  validatePlan(): void {
    const planId = this.planId();
    if (!this.canValidate() || !planId || this.loadingAction()) return;
    this.run('validate', this.api.validatePlan(planId), (plan) => {
      this.setPlan(plan);
      this.message.set('Google Ads validateOnly đã hoàn tất. Đây chưa phải thực thi live.');
    });
  }

  approve(item: GoogleCampaignPlanItem): void {
    const planId = this.planId();
    if (!this.canApproveItem(item) || !planId || this.loadingAction()) return;
    this.run('approve', this.api.approveItem(planId, item.actionId), (plan) => {
      this.setPlan(plan);
      this.message.set(`Đã duyệt action ${item.actionId}.`);
    });
  }

  reject(item: GoogleCampaignPlanItem): void {
    const planId = this.planId();
    const reason = this.rejectionReason.trim();
    if (!this.canApprove() || !planId || !item.actionId || reason.length < 5 || this.loadingAction()) {
      this.error.set('Nhập lý do từ chối ít nhất 5 ký tự.');
      return;
    }
    if (this.creatorConflict()) {
      this.error.set('Người tạo plan không được tự ra quyết định duyệt hoặc từ chối.');
      return;
    }
    this.run('reject', this.api.rejectItem(planId, item.actionId, reason), (plan) => {
      this.setPlan(plan);
      this.rejectionReason = '';
      this.message.set(`Đã từ chối action ${item.actionId}.`);
    });
  }

  execute(dryRun: boolean): void {
    const planId = this.planId();
    const actionIds = this.items().map((item) => item.actionId).filter(Boolean);
    if (!this.canExecute() || !planId || !actionIds.length || this.loadingAction()) return;
    if (!this.providerValidated() || !this.allItemsApproved()) {
      this.error.set('Plan phải validateOnly thành công và được duyệt đầy đủ trước khi execute.');
      return;
    }
    if (!dryRun) {
      if (!this.dryRunPassed()) {
        this.error.set('Phải dry-run thành công trước khi thực thi live.');
        return;
      }
      if (this.approverConflict()) {
        this.error.set('Người duyệt không được thực thi live.');
        return;
      }
      if (this.capabilities()?.productionEnabled !== true) {
        this.error.set('ERP chưa xác nhận GOOGLE_ADS_PRODUCTION_ENABLED=true.');
        return;
      }
      if (this.liveConfirmation.trim() !== planId) {
        this.error.set(`Nhập chính xác plan ID “${planId}” để xác nhận live.`);
        return;
      }
    }
    this.run(dryRun ? 'dry-run' : 'live', this.api.executePlan(planId, actionIds, dryRun), (execution) => {
      this.executions.update((current) => [execution, ...current]);
      this.message.set(dryRun
        ? 'Dry-run đã hoàn tất trong ERP; chưa gọi mutate live.'
        : 'ERP đã nhận yêu cầu thực thi live. Hãy kiểm tra execution log và canonical readback.');
      this.refreshPlan();
    });
  }

  canApproveItem(item: GoogleCampaignPlanItem): boolean {
    return this.canApprove()
      && !this.creatorConflict()
      && item.status === 'pending'
      && item.providerValidationStatus === 'provider_validate_passed';
  }

  itemPayload(item: GoogleCampaignPlanItem): Record<string, unknown> {
    return item.typedPayload || item.payload || {};
  }

  actionLabel(actionType: string): string {
    return ACTION_LABELS[actionType] || actionType;
  }

  formatVnd(value: unknown): string {
    const amount = Number(value);
    return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN')} VND` : '—';
  }

  private loadCapabilities(customerId?: string): void {
    this.capabilitiesLoading.set(true);
    this.capabilitiesWarning.set('');
    this.api.getCapabilities(customerId).subscribe({
      next: (response) => {
        const capabilities = this.unwrapCapabilities(response);
        this.capabilities.set(capabilities);
        this.applyCapabilityDefaults(capabilities);
        this.capabilitiesLoading.set(false);
      },
      error: () => {
        this.capabilities.set(null);
        this.capabilitiesLoading.set(false);
        this.capabilitiesWarning.set('Không tải được capability Google Ads; tạo draft bị chặn an toàn.');
      },
    });
  }

  private loadAccounts(): void {
    this.accountsLoading.set(true);
    this.accountsWarning.set('');
    this.api.getAccountOptions().subscribe({
      next: (response) => {
        this.accounts.set(this.unwrapAccounts(response));
        this.accountsLoading.set(false);
      },
      error: () => {
        this.accounts.set([]);
        this.accountsLoading.set(false);
        this.accountsWarning.set('Không tải được account canonical từ ERP; tạo draft bị chặn an toàn.');
      },
    });
  }

  private loadCampaigns(customerId: string): void {
    this.campaignsLoading.set(true);
    this.campaignsWarning.set('');
    this.api.getCampaignOptions(customerId).subscribe({
      next: (response) => {
        this.campaigns.set(this.unwrapCampaigns(response));
        this.campaignsLoading.set(false);
      },
      error: () => {
        this.campaigns.set([]);
        this.campaignsLoading.set(false);
        this.campaignsWarning.set('Không tải được campaign canonical; update/pause bị chặn an toàn.');
      },
    });
  }

  private loadAdGroups(customerId: string, campaignId: string): void {
    this.childResourcesLoading.set(true);
    this.childResourcesWarning.set('');
    this.api.getAdGroupOptions(customerId, campaignId).subscribe({
      next: (response) => {
        this.adGroups.set(this.unwrapAdGroups(response));
        this.childResourcesLoading.set(false);
      },
      error: () => {
        this.adGroups.set([]);
        this.childResourcesLoading.set(false);
        this.childResourcesWarning.set('Không tải được Ad Group canonical; thao tác tài nguyên con bị chặn an toàn.');
      },
    });
  }

  private loadKeywords(customerId: string, adGroupId: string): void {
    this.childResourcesLoading.set(true);
    this.childResourcesWarning.set('');
    this.api.getKeywordOptions(customerId, adGroupId).subscribe({
      next: (response) => {
        this.keywords.set(this.unwrapKeywords(response));
        this.childResourcesLoading.set(false);
      },
      error: () => {
        this.keywords.set([]);
        this.childResourcesLoading.set(false);
        this.childResourcesWarning.set('Không tải được keyword canonical; update/pause bị chặn an toàn.');
      },
    });
  }

  private loadResponsiveSearchAds(customerId: string, adGroupId: string): void {
    this.childResourcesLoading.set(true);
    this.childResourcesWarning.set('');
    this.api.getResponsiveSearchAdOptions(customerId, adGroupId).subscribe({
      next: (response) => {
        this.responsiveSearchAds.set(this.unwrapResponsiveSearchAds(response));
        this.childResourcesLoading.set(false);
      },
      error: () => {
        this.responsiveSearchAds.set([]);
        this.childResourcesLoading.set(false);
        this.childResourcesWarning.set('Không tải được RSA canonical; update/pause bị chặn an toàn.');
      },
    });
  }

  private loadReadiness(customerId: string, campaignId: string): void {
    this.readinessLoading.set(true);
    this.readinessWarning.set('');
    this.api.getSearchReadiness(customerId, campaignId).subscribe({
      next: (response) => {
        this.readiness.set(this.unwrapReadiness(response));
        this.readinessLoading.set(false);
      },
      error: () => {
        this.readiness.set(null);
        this.readinessLoading.set(false);
        this.readinessWarning.set(
          'Không tải được bằng chứng cấu hình conversion/tracking; ERP hiển thị thiếu dữ liệu và không suy luận khả năng activation/serving.',
        );
      },
    });
  }

  private loadBiddingLifecycle(customerId: string, campaignId: string): void {
    this.biddingLifecycleLoading.set(true);
    this.biddingLifecycleLoaded.set(false);
    this.biddingLifecycleWarning.set('');
    this.api.getBiddingLifecycle(customerId, campaignId).subscribe({
      next: (response) => {
        this.applyBiddingLifecycleResponse(response);
        this.biddingLifecycleLoading.set(false);
      },
      error: () => {
        this.biddingLifecyclePolicy.set(null);
        this.biddingLifecycleState.set(null);
        this.biddingLifecycleLoaded.set(false);
        this.biddingLifecycleLoading.set(false);
        this.biddingLifecycleWarning.set(
          'Không tải được bidding lifecycle canonical; lưu policy và đánh giá tự động bị khóa an toàn.',
        );
      },
    });
  }

  private loadExecutions(): void {
    const planId = this.planId();
    if (!planId) return;
    this.api.getExecutions(planId).subscribe({
      next: (executions) => this.executions.set(executions || []),
      error: () => this.executions.set([]),
    });
  }

  private refreshPlan(): void {
    const planId = this.planId();
    if (!planId) return;
    this.api.getPlan(planId).subscribe({ next: (plan) => this.setPlan(plan) });
  }

  private buildRequest(): CreateGoogleCampaignActionPlanRequest {
    const customerId = this.normalizedCustomerId();
    const campaignId = this.normalizedCampaignId() || undefined;
    const operation = this.operation();
    const scope = this.resourceScope();
    let actionType: GoogleCampaignActionType;
    let payload: GoogleCampaignActionPayload;
    let subject = '';

    if (scope === 'campaign') {
      actionType = operation === 'create'
        ? 'create_search_campaign'
        : operation === 'update'
          ? 'update_search_campaign'
          : operation === 'pause' ? 'pause_campaign' : 'resume_campaign';
      payload = operation === 'create'
        ? {
            campaignName: this.form.campaignName.trim(),
            budgetName: this.form.budgetName.trim(),
            dailyBudgetVnd: Number(this.form.dailyBudgetVnd),
            biddingStrategyType: this.form.biddingStrategyType,
            startDate: this.form.startDate,
            ...(this.form.endDate ? { endDate: this.form.endDate } : {}),
            searchPartnersEnabled: this.form.searchPartnersEnabled,
            geoTargetConstantIds: this.form.geoTargetConstantIds,
            languageConstantIds: this.form.languageConstantIds,
            positiveGeoTargetType: this.form.positiveGeoTargetType,
            doesNotContainEuPoliticalAdvertising: true,
          }
        : operation === 'update' ? this.buildUpdatePayload() : {};
      subject = operation === 'create'
        ? this.form.campaignName.trim()
        : this.selectedCampaign()?.name || campaignId || '';
    } else if (scope === 'ad_group') {
      actionType = operation === 'create'
        ? 'create_ad_group'
        : operation === 'update'
          ? 'update_ad_group'
          : operation === 'pause' ? 'pause_ad_group' : 'resume_ad_group';
      payload = operation === 'create'
        ? {
            adGroupName: this.resourceForm.adGroupName.trim(),
            ...(this.optionalNonNegative(this.resourceForm.cpcBidVnd)
              ? { cpcBidVnd: Number(this.resourceForm.cpcBidVnd) } : {}),
          }
        : operation === 'update' ? this.buildAdGroupUpdatePayload() : {};
      subject = operation === 'create'
        ? this.resourceForm.adGroupName.trim()
        : this.selectedAdGroup()?.adGroupName || this.selectedAdGroup()?.name || this.resourceForm.adGroupId;
    } else if (scope === 'keyword') {
      actionType = operation === 'create'
        ? 'create_keyword'
        : operation === 'update'
          ? 'update_keyword'
          : operation === 'pause' ? 'pause_keyword' : 'resume_keyword';
      payload = operation === 'create'
        ? {
            keywordText: this.resourceForm.keywordText.trim(),
            matchType: this.resourceForm.matchType,
            negative: false,
            ...(this.optionalNonNegative(this.resourceForm.cpcBidVnd)
              ? { cpcBidVnd: Number(this.resourceForm.cpcBidVnd) } : {}),
            ...(this.resourceForm.finalUrl.trim()
              ? { finalUrl: this.resourceForm.finalUrl.trim() } : {}),
          }
        : operation === 'update' ? this.buildKeywordUpdatePayload() : {};
      subject = operation === 'create'
        ? this.resourceForm.keywordText.trim()
        : this.selectedKeyword()?.keywordText || this.resourceForm.criterionId;
    } else {
      actionType = operation === 'create'
        ? 'create_responsive_search_ad'
        : operation === 'update'
          ? 'update_responsive_search_ad'
          : operation === 'pause' ? 'pause_responsive_search_ad' : 'resume_responsive_search_ad';
      payload = operation === 'pause' || operation === 'activate'
        ? {}
        : this.buildResponsiveSearchAdPayload(operation === 'update');
      subject = operation === 'create'
        ? this.resourceForm.headlines[0] || 'Responsive Search Ad'
        : this.assetTexts(this.selectedResponsiveSearchAd()?.headlines)[0] || this.resourceForm.adId;
    }

    return {
      planName: `${this.operationLabel()} - ${subject}`,
      actions: [{
        actionType,
        customerId,
        campaignId: scope === 'campaign' && operation === 'create' ? undefined : campaignId,
        ...(scope === 'keyword' || scope === 'responsive_search_ad' || (scope === 'ad_group' && operation !== 'create')
          ? { adGroupId: this.resourceForm.adGroupId } : {}),
        ...(scope === 'keyword' && operation !== 'create'
          ? { criterionId: this.resourceForm.criterionId } : {}),
        ...(scope === 'responsive_search_ad' && operation !== 'create'
          ? { adId: this.resourceForm.adId } : {}),
        reason: this.form.reason.trim(),
        idempotencyKey: this.draftIdempotencyKey,
        payload,
      }],
    };
  }

  private validateForm(): string {
    if (!this.capabilities()) return 'Không có capability Google Ads mới nhất từ ERP.';
    const supportedActionTypes = this.capabilities()?.supportedActionTypes;
    if (supportedActionTypes?.length && !supportedActionTypes.includes(this.currentDraftActionType())) {
      return 'Backend ERP chưa công bố hỗ trợ action này trong capabilities; UI khóa fail-closed.';
    }
    const account = this.selectedAccount();
    if (!account || !/^\d+$/.test(this.normalizedCustomerId())) {
      return 'Chọn một Google Ads customer account canonical từ ERP.';
    }
    if (account.eligible === false || account.liveEligible === false) {
      return this.accountBlockers(account) || 'Account chưa đủ điều kiện tạo action plan.';
    }
    if (this.form.reason.trim().length < 10) return 'Nhập lý do kinh doanh ít nhất 10 ký tự.';

    if (this.resourceScope() === 'campaign' && this.operation() === 'create') {
      if (this.form.campaignName.trim().length < 3) return 'Tên campaign phải có ít nhất 3 ký tự.';
      if (this.form.budgetName.trim().length < 3) return 'Tên budget phải có ít nhất 3 ký tự.';
      if (!this.validPositiveAmount(this.form.dailyBudgetVnd)) return 'Daily budget VND phải lớn hơn 0.';
      if (!this.biddingStrategyOptions().some((option) =>
        option.value === this.form.biddingStrategyType && option.disabled !== true)) {
        return 'Bidding strategy chưa được capability ERP cho phép.';
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(this.form.startDate)) return 'Chọn ngày bắt đầu hợp lệ.';
      if (this.form.endDate && this.form.endDate < this.form.startDate) {
        return 'Ngày kết thúc không được trước ngày bắt đầu.';
      }
      if (!this.form.geoTargetConstantIds.length) return 'Nhập ít nhất một geo target ID.';
      if (!this.form.languageConstantIds.length) return 'Nhập ít nhất một language constant ID.';
      if (!this.form.doesNotContainEuPoliticalAdvertising) {
        return 'Phải xác nhận campaign không chứa quảng cáo chính trị EU.';
      }
    } else if (this.resourceScope() === 'campaign') {
      const campaign = this.selectedCampaign();
      if (!campaign || !/^\d+$/.test(this.normalizedCampaignId())) {
        return 'Chọn campaign Search canonical từ ERP.';
      }
      if (campaign.advertisingChannelType && campaign.advertisingChannelType !== 'SEARCH') {
        return 'MVP chỉ hỗ trợ Google Search campaign.';
      }
      if (campaign.eligible === false || campaign.liveEligible === false) {
        return (campaign.blockers || []).join('; ') || 'Campaign chưa đủ điều kiện thao tác.';
      }
      if (this.operation() === 'update') {
        const payload = this.buildUpdatePayload();
        if (!Object.keys(payload).length) {
          return 'Thay đổi ít nhất một trường: tên, ngày kết thúc hoặc daily budget.';
        }
        if (payload.campaignName !== undefined && String(payload.campaignName).length < 3) {
          return 'Tên campaign mới phải có ít nhất 3 ký tự.';
        }
        if (payload.endDate !== undefined
          && campaign.endDate
          && String(payload.endDate) > campaign.endDate) {
          return 'MVP chỉ cho phép giữ nguyên hoặc rút ngắn ngày kết thúc.';
        }
        if (payload.dailyBudgetVnd !== undefined
          && !campaign.campaignBudgetId
          && !campaign.campaignBudgetResourceName
          && !campaign.budget?.campaignBudgetId) {
          return 'Canonical campaign chưa có campaignBudgetId; không được fallback từ campaignId.';
        }
        if (payload.dailyBudgetVnd !== undefined && !this.validPositiveAmount(payload.dailyBudgetVnd)) {
          return 'Daily budget VND phải lớn hơn 0.';
        }
      }
      if (this.operation() === 'pause' && campaign.status === 'PAUSED') {
        return 'Campaign đã ở trạng thái PAUSED.';
      }
      if (this.operation() === 'activate' && campaign.status !== 'PAUSED') {
        return 'Chỉ campaign canonical PAUSED mới có thể lập plan kích hoạt.';
      }
    } else {
      const hierarchyError = this.validateCanonicalHierarchy();
      if (hierarchyError) return hierarchyError;
      if (this.resourceScope() === 'ad_group') return this.validateAdGroupForm();
      if (this.resourceScope() === 'keyword') return this.validateKeywordForm();
      return this.validateResponsiveSearchAdForm();
    }
    return '';
  }

  private setPlan(plan: GoogleCampaignActionPlan): void {
    this.plan.set({
      ...plan,
      items: plan.items || plan.actions || [],
    });
    this.lookupPlanId = String(plan.planId || '');
    this.liveConfirmation = '';
    this.error.set('');
  }

  private applyCapabilityDefaults(capabilities: GoogleAdsCampaignCapabilities): void {
    const defaults = capabilities.defaults || capabilities.defaultTargeting;
    if (!this.form.geoTargetConstantIds.length && defaults?.geoTargetConstantIds?.length) {
      this.form.geoTargetConstantIds = [...defaults.geoTargetConstantIds];
      this.geoTargetIdsInput = defaults.geoTargetConstantIds.join(', ');
    }
    if (!this.form.languageConstantIds.length && defaults?.languageConstantIds?.length) {
      this.form.languageConstantIds = [...defaults.languageConstantIds];
      this.languageIdsInput = defaults.languageConstantIds.join(', ');
    }
    if (defaults?.positiveGeoTargetType) {
      this.form.positiveGeoTargetType = defaults.positiveGeoTargetType;
    }
    if (defaults?.searchPartnersEnabled !== undefined) {
      this.form.searchPartnersEnabled = defaults.searchPartnersEnabled;
    }
  }

  private capabilityOptions(
    values?: Array<GoogleCampaignBiddingStrategy | GoogleAdsCapabilityOption<GoogleCampaignBiddingStrategy>>,
  ): Array<GoogleAdsCapabilityOption<GoogleCampaignBiddingStrategy>> {
    return (values || []).map((option) => typeof option === 'string'
      ? { value: option, label: BIDDING_LABELS[option] || option }
      : { ...option, label: option.label || BIDDING_LABELS[option.value] || option.value });
  }

  private unwrapCapabilities(response: GoogleAdsCampaignCapabilitiesResponse): GoogleAdsCampaignCapabilities {
    return 'data' in response ? response.data : response;
  }

  private unwrapAccounts(response: GoogleAdsAccountLookupResponse): GoogleAdsAccountOption[] {
    if (Array.isArray(response)) return response;
    if ('accounts' in response) return response.accounts || [];
    return response.data || [];
  }

  private unwrapCampaigns(response: GoogleAdsCampaignLookupResponse): GoogleAdsCampaignOption[] {
    if (Array.isArray(response)) return response;
    if ('campaigns' in response) return response.campaigns || [];
    return response.data || [];
  }

  private unwrapAdGroups(response: GoogleAdsAdGroupLookupResponse): GoogleAdsAdGroupOption[] {
    if (Array.isArray(response)) return response;
    if ('adGroups' in response) return response.adGroups || [];
    return response.data || [];
  }

  private unwrapKeywords(response: GoogleAdsKeywordLookupResponse): GoogleAdsKeywordOption[] {
    if (Array.isArray(response)) return response;
    if ('keywords' in response) return response.keywords || [];
    return response.data || [];
  }

  private unwrapResponsiveSearchAds(
    response: GoogleAdsResponsiveSearchAdLookupResponse,
  ): GoogleAdsResponsiveSearchAdOption[] {
    if (Array.isArray(response)) return response;
    if ('ads' in response) return response.ads || [];
    return response.data || [];
  }

  private unwrapReadiness(response: GoogleAdsSearchReadinessResponse): GoogleAdsSearchReadiness {
    if ('readiness' in response) return response.readiness;
    if ('data' in response) return response.data;
    return response;
  }

  private parseProviderIds(value: string): string[] {
    return Array.from(new Set(String(value || '').split(/[\s,;]+/)
      .map((item) => item.trim()).filter((item) => /^\d+$/.test(item))));
  }

  private normalizedCustomerId(): string {
    return String(this.form.customerId || '').replace(/[^\d]/g, '');
  }

  private normalizedCampaignId(): string {
    return String(this.form.campaignId || '').trim();
  }

  private operationLabel(): string {
    const resource = RESOURCE_LABELS[this.resourceScope()];
    const operation = this.operation() === 'create'
      ? 'Tạo'
      : this.operation() === 'update'
        ? 'Cập nhật'
        : this.operation() === 'pause' ? 'Dừng' : 'Kích hoạt';
    return `${operation} ${resource}`;
  }

  private buildUpdatePayload(): {
    campaignName?: string;
    endDate?: string;
    dailyBudgetVnd?: number;
  } {
    const campaign = this.selectedCampaign();
    if (!campaign) return {};
    const currentBudget = campaign.dailyBudgetVnd ?? campaign.budget?.dailyBudgetVnd
      ?? (campaign.amountMicros === undefined ? undefined : campaign.amountMicros / 1_000_000);
    const campaignName = this.form.campaignName.trim();
    const payload: { campaignName?: string; endDate?: string; dailyBudgetVnd?: number } = {};
    if (campaignName && campaignName !== campaign.name) payload.campaignName = campaignName;
    if (this.form.endDate && this.form.endDate !== (campaign.endDate || '')) {
      payload.endDate = this.form.endDate;
    }
    if (this.validPositiveAmount(this.form.dailyBudgetVnd)
      && Number(this.form.dailyBudgetVnd) !== Number(currentBudget)) {
      payload.dailyBudgetVnd = Number(this.form.dailyBudgetVnd);
    }
    return payload;
  }

  private buildAdGroupUpdatePayload(): { adGroupName?: string; cpcBidVnd?: number } {
    const adGroup = this.selectedAdGroup();
    if (!adGroup) return {};
    const payload: { adGroupName?: string; cpcBidVnd?: number } = {};
    const name = this.resourceForm.adGroupName.trim();
    const currentBid = this.microsToVnd(adGroup.cpcBidVnd, adGroup.cpcBidMicros);
    if (name && name !== (adGroup.adGroupName || adGroup.name || '')) payload.adGroupName = name;
    if (this.optionalNonNegative(this.resourceForm.cpcBidVnd)
      && Number(this.resourceForm.cpcBidVnd) !== Number(currentBid)) {
      payload.cpcBidVnd = Number(this.resourceForm.cpcBidVnd);
    }
    return payload;
  }

  private buildKeywordUpdatePayload(): { cpcBidVnd?: number; finalUrl?: string } {
    const keyword = this.selectedKeyword();
    if (!keyword) return {};
    const payload: { cpcBidVnd?: number; finalUrl?: string } = {};
    const currentBid = this.microsToVnd(keyword.cpcBidVnd, keyword.cpcBidMicros);
    const currentUrl = keyword.finalUrl || keyword.finalUrls?.[0] || '';
    if (this.optionalNonNegative(this.resourceForm.cpcBidVnd)
      && Number(this.resourceForm.cpcBidVnd) !== Number(currentBid)) {
      payload.cpcBidVnd = Number(this.resourceForm.cpcBidVnd);
    }
    const finalUrl = this.resourceForm.finalUrl.trim();
    if (finalUrl && finalUrl !== currentUrl) payload.finalUrl = finalUrl;
    return payload;
  }

  private buildResponsiveSearchAdPayload(updateOnly: boolean): GoogleCampaignActionPayload {
    const payload: GoogleCampaignActionPayload = {};
    const current = this.selectedResponsiveSearchAd();
    const add = (key: keyof GoogleCampaignActionPayload, value: string | string[], currentValue?: string | string[]) => {
      if ((Array.isArray(value) ? value.length : value.length) === 0) return;
      if (!updateOnly || JSON.stringify(value) !== JSON.stringify(currentValue ?? (Array.isArray(value) ? [] : ''))) {
        (payload as any)[key] = value;
      }
    };
    add('finalUrl', this.resourceForm.finalUrl.trim(), current?.finalUrl || current?.finalUrls?.[0]);
    add('headlines', this.resourceForm.headlines, this.assetTexts(current?.headlines));
    add('descriptions', this.resourceForm.descriptions, this.assetTexts(current?.descriptions));
    add('path1', this.resourceForm.path1.trim(), current?.path1);
    add('path2', this.resourceForm.path2.trim(), current?.path2);
    add('trackingUrlTemplate', this.resourceForm.trackingUrlTemplate.trim(), current?.trackingUrlTemplate);
    add('finalUrlSuffix', this.resourceForm.finalUrlSuffix.trim(), current?.finalUrlSuffix);
    const headlinePins = this.buildPins(this.resourceForm.headlinePinFields);
    const descriptionPins = this.buildPins(this.resourceForm.descriptionPinFields);
    const currentHeadlinePins = this.normalizePins(current?.headlinePins);
    const currentDescriptionPins = this.normalizePins(current?.descriptionPins);
    const headlinePinsChanged = updateOnly
      && JSON.stringify(headlinePins) !== JSON.stringify(currentHeadlinePins);
    const descriptionPinsChanged = updateOnly
      && JSON.stringify(descriptionPins) !== JSON.stringify(currentDescriptionPins);
    if (headlinePinsChanged && payload.headlines === undefined) {
      payload.headlines = [...this.resourceForm.headlines];
    }
    if (descriptionPinsChanged && payload.descriptions === undefined) {
      payload.descriptions = [...this.resourceForm.descriptions];
    }
    if (payload.headlines !== undefined || (!updateOnly && headlinePins.length) || headlinePinsChanged) {
      payload.headlinePins = headlinePins as Array<GoogleRsaAssetPin<GoogleRsaHeadlinePinnedField>>;
    }
    if (payload.descriptions !== undefined || (!updateOnly && descriptionPins.length) || descriptionPinsChanged) {
      payload.descriptionPins = descriptionPins as Array<GoogleRsaAssetPin<GoogleRsaDescriptionPinnedField>>;
    }
    return payload;
  }

  private validateCanonicalHierarchy(): string {
    const campaign = this.selectedCampaign();
    if (!campaign || !/^\d+$/.test(this.normalizedCampaignId())) {
      return 'Chọn Search campaign canonical đã sync về ERP.';
    }
    if (campaign.advertisingChannelType && campaign.advertisingChannelType !== 'SEARCH') {
      return 'ERP chỉ quản lý Google Search campaign.';
    }
    if (campaign.eligible === false || campaign.liveEligible === false) {
      return (campaign.blockers || []).join('; ') || 'Campaign canonical chưa đủ điều kiện thao tác.';
    }
    if (this.operation() === 'activate' && campaign.status !== 'PAUSED') {
      return 'Activation tài nguyên con chỉ được lập khi campaign canonical vẫn PAUSED.';
    }
    if (this.resourceScope() === 'ad_group' && this.operation() === 'create') return '';
    const adGroup = this.selectedAdGroup();
    if (!adGroup || !/^\d+$/.test(this.resourceForm.adGroupId)) {
      return 'Chọn Ad Group canonical đã sync về ERP.';
    }
    if (adGroup.eligible === false || adGroup.liveEligible === false) {
      return (adGroup.blockers || []).join('; ') || 'Ad Group canonical chưa đủ điều kiện thao tác.';
    }
    return '';
  }

  private validateAdGroupForm(): string {
    if (this.operation() === 'create') {
      if (this.resourceForm.adGroupName.trim().length < 3) return 'Tên Ad Group phải có ít nhất 3 ký tự.';
      if (this.resourceForm.cpcBidVnd !== null && !this.optionalNonNegative(this.resourceForm.cpcBidVnd)) {
        return 'CPC bid VND phải là số không âm.';
      }
      return '';
    }
    const adGroup = this.selectedAdGroup();
    if (!adGroup) return 'Chọn Ad Group canonical.';
    if (this.operation() === 'pause') {
      return adGroup.status === 'PAUSED' ? 'Ad Group đã ở trạng thái PAUSED.' : '';
    }
    if (this.operation() === 'activate') {
      return adGroup.status !== 'PAUSED' ? 'Chỉ Ad Group PAUSED mới có thể lập plan kích hoạt.' : '';
    }
    const payload = this.buildAdGroupUpdatePayload();
    if (!Object.keys(payload).length) return 'Thay đổi tên hoặc CPC bid của Ad Group.';
    if (payload.adGroupName !== undefined && payload.adGroupName.length < 3) {
      return 'Tên Ad Group mới phải có ít nhất 3 ký tự.';
    }
    return '';
  }

  private validateKeywordForm(): string {
    if (this.operation() === 'create') {
      if (this.resourceForm.negative) {
        return 'Tạo negative keyword đang bị khóa fail-closed vì criterion PAUSED không thể được cập nhật để kích hoạt sau đó.';
      }
      if (!this.resourceForm.keywordText.trim()) return 'Nhập nội dung keyword.';
      if (!['EXACT', 'PHRASE', 'BROAD'].includes(this.resourceForm.matchType)) {
        return 'Chọn match type EXACT, PHRASE hoặc BROAD.';
      }
      if (this.resourceForm.cpcBidVnd !== null
        && !this.optionalNonNegative(this.resourceForm.cpcBidVnd)) {
        return 'CPC bid VND phải là số không âm.';
      }
      if (this.resourceForm.finalUrl.trim()
        && !this.validHttpsUrl(this.resourceForm.finalUrl)) {
        return 'Keyword final URL phải dùng HTTPS.';
      }
      return '';
    }
    const keyword = this.selectedKeyword();
    if (!keyword) return 'Chọn keyword canonical.';
    if (keyword.negative || keyword.mutable === false) {
      return 'Google không hỗ trợ update/pause negative keyword theo policy ERP; tạo mới hoặc xử lý ngoài phạm vi delete.';
    }
    if (this.operation() === 'pause') {
      return keyword.status === 'PAUSED' ? 'Keyword đã ở trạng thái PAUSED.' : '';
    }
    if (this.operation() === 'activate') {
      return keyword.status !== 'PAUSED' ? 'Chỉ positive keyword PAUSED mới có thể lập plan kích hoạt.' : '';
    }
    const payload = this.buildKeywordUpdatePayload();
    if (!Object.keys(payload).length) return 'Thay đổi CPC bid hoặc final URL của keyword.';
    if (payload.finalUrl && !this.validHttpsUrl(payload.finalUrl)) return 'Keyword final URL phải dùng HTTPS.';
    return '';
  }

  private validateResponsiveSearchAdForm(): string {
    const ad = this.selectedResponsiveSearchAd();
    if (this.operation() !== 'create' && !ad) return 'Chọn Responsive Search Ad canonical.';
    if (this.operation() === 'pause') {
      return ad?.status === 'PAUSED' ? 'Responsive Search Ad đã ở trạng thái PAUSED.' : '';
    }
    if (this.operation() === 'activate') {
      if (ad?.status !== 'PAUSED') return 'Chỉ RSA PAUSED mới có thể lập plan kích hoạt.';
      if (ad.policyApprovalStatus !== 'APPROVED') {
        return 'RSA phải có policyApprovalStatus=APPROVED trước khi kích hoạt.';
      }
      return '';
    }
    const payload = this.buildResponsiveSearchAdPayload(this.operation() === 'update');
    if (this.operation() === 'update' && !Object.keys(payload).length) {
      return 'Thay đổi ít nhất một trường của Responsive Search Ad.';
    }
    const finalUrl = String(payload['finalUrl'] ?? this.resourceForm.finalUrl).trim();
    if (this.operation() === 'create' && !this.validHttpsUrl(finalUrl)) {
      return 'Responsive Search Ad cần final URL HTTPS.';
    }
    const headlines = (payload['headlines'] ?? this.resourceForm.headlines) as string[];
    const descriptions = (payload['descriptions'] ?? this.resourceForm.descriptions) as string[];
    if (this.operation() === 'create' || payload['headlines']) {
      if (headlines.length < 3 || headlines.length > 15) return 'RSA cần từ 3 đến 15 headline.';
      if (headlines.some((value) => value.length > 30)) return 'Mỗi headline tối đa 30 ký tự.';
    }
    if (this.operation() === 'create' || payload['descriptions']) {
      if (descriptions.length < 2 || descriptions.length > 4) return 'RSA cần từ 2 đến 4 description.';
      if (descriptions.some((value) => value.length > 90)) return 'Mỗi description tối đa 90 ký tự.';
    }
    if (this.resourceForm.headlinePinFields.some((field) =>
      field && !['HEADLINE_1', 'HEADLINE_2', 'HEADLINE_3'].includes(field))) {
      return 'Headline pin không hợp lệ.';
    }
    if (this.resourceForm.descriptionPinFields.some((field) =>
      field && !['DESCRIPTION_1', 'DESCRIPTION_2'].includes(field))) {
      return 'Description pin không hợp lệ.';
    }
    if (this.resourceForm.path1.trim().length > 15 || this.resourceForm.path2.trim().length > 15) {
      return 'Path 1 và Path 2 tối đa 15 ký tự.';
    }
    const trackingTemplate = this.resourceForm.trackingUrlTemplate.trim();
    if (trackingTemplate
      && (!/^https:\/\//i.test(trackingTemplate) || !trackingTemplate.includes('{lpurl}'))) {
      return 'Tracking template phải là URL HTTPS có {lpurl}; hostname còn phải thuộc allowlist của ERP.';
    }
    if (this.resourceForm.finalUrlSuffix.trim().startsWith('?')) {
      return 'Final URL suffix không bắt đầu bằng dấu ?.';
    }
    return '';
  }

  private applyBiddingLifecycleResponse(response: GoogleAdsBiddingLifecycleResponse): void {
    this.biddingLifecyclePolicy.set(response.policy);
    this.biddingLifecycleState.set(response.state || {});
    this.biddingLifecycleLoaded.set(true);
    this.biddingLifecycleWarning.set('');
    this.biddingLifecycleForm.enabled = response.policy.enabled === true;
    this.biddingLifecycleForm.clickThreshold = Number(response.policy.clickThreshold);
    this.biddingLifecycleForm.clickWindowDays = Number(response.policy.clickWindowDays);
    this.biddingLifecycleForm.maxCpcBidCeilingVnd = Number(response.policy.maxCpcBidCeilingVnd);
    this.biddingLifecycleForm.maximizeConversionsMinConversions =
      Number(response.policy.maximizeConversionsMinConversions);
    this.biddingLifecycleForm.conversionWindowDays = Number(response.policy.conversionWindowDays);
    this.biddingLifecycleForm.targetCpaMinConversions = Number(response.policy.targetCpaMinConversions);
    this.biddingLifecycleForm.targetCpaVnd = Number(response.policy.targetCpaVnd);
    this.biddingLifecycleForm.cooldownHours = Number(response.policy.cooldownHours);
    this.biddingLifecycleForm.minimumStageDwellHours = Number(response.policy.minimumStageDwellHours);
    this.biddingLifecycleForm.draftOnly = true;
  }

  private resetBiddingLifecycle(): void {
    this.biddingLifecyclePolicy.set(null);
    this.biddingLifecycleState.set(null);
    this.biddingLifecycleLoaded.set(false);
    this.biddingLifecycleLoading.set(false);
    this.biddingLifecycleWarning.set('');
    this.biddingLifecycleForm.enabled = false;
    this.biddingLifecycleForm.clickThreshold = 50;
    this.biddingLifecycleForm.clickWindowDays = 30;
    this.biddingLifecycleForm.maxCpcBidCeilingVnd = null;
    this.biddingLifecycleForm.maximizeConversionsMinConversions = 15;
    this.biddingLifecycleForm.conversionWindowDays = 30;
    this.biddingLifecycleForm.targetCpaMinConversions = 30;
    this.biddingLifecycleForm.targetCpaVnd = null;
    this.biddingLifecycleForm.cooldownHours = 168;
    this.biddingLifecycleForm.minimumStageDwellHours = 168;
    this.biddingLifecycleForm.draftOnly = true;
  }

  private buildBiddingLifecyclePolicy(): GoogleAdsBiddingLifecyclePolicy {
    return {
      enabled: this.biddingLifecycleForm.enabled,
      clickThreshold: Number(this.biddingLifecycleForm.clickThreshold),
      clickWindowDays: Number(this.biddingLifecycleForm.clickWindowDays),
      maxCpcBidCeilingVnd: Number(this.biddingLifecycleForm.maxCpcBidCeilingVnd),
      maximizeConversionsMinConversions:
        Number(this.biddingLifecycleForm.maximizeConversionsMinConversions),
      conversionWindowDays: Number(this.biddingLifecycleForm.conversionWindowDays),
      targetCpaMinConversions: Number(this.biddingLifecycleForm.targetCpaMinConversions),
      targetCpaVnd: Number(this.biddingLifecycleForm.targetCpaVnd),
      cooldownHours: Number(this.biddingLifecycleForm.cooldownHours),
      minimumStageDwellHours: Number(this.biddingLifecycleForm.minimumStageDwellHours),
      draftOnly: true,
    };
  }

  private validateBiddingLifecycleForm(): string {
    if (!this.selectedCampaign() || !this.normalizedCustomerId() || !this.normalizedCampaignId()) {
      return 'Chọn campaign canonical trước khi cấu hình bidding lifecycle.';
    }
    if (!this.biddingLifecycleLoaded()) {
      return 'Chưa tải được bidding lifecycle canonical từ ERP; UI khóa fail-closed.';
    }
    if (this.capabilities()?.biddingLifecycle?.supported !== true
      || this.capabilities()?.biddingLifecycle?.draftOnly !== true) {
      return 'Backend ERP chưa công bố bidding lifecycle draft-only an toàn trong capabilities.';
    }
    if (!this.validPositiveInteger(this.biddingLifecycleForm.clickThreshold)) {
      return 'Ngưỡng click phải là số nguyên lớn hơn 0.';
    }
    if (!this.validPositiveInteger(this.biddingLifecycleForm.clickWindowDays)) {
      return 'Cửa sổ click phải là số ngày nguyên lớn hơn 0.';
    }
    if (this.biddingLifecycleForm.enabled
      && !this.validPositiveAmount(this.biddingLifecycleForm.maxCpcBidCeilingVnd)) {
      return 'CPC ceiling VND phải lớn hơn 0.';
    }
    if (!this.validPositiveInteger(this.biddingLifecycleForm.maximizeConversionsMinConversions)) {
      return 'Ngưỡng chuyển sang Maximize Conversions phải là số nguyên lớn hơn 0.';
    }
    if (!this.validPositiveInteger(this.biddingLifecycleForm.conversionWindowDays)) {
      return 'Cửa sổ conversion phải là số ngày nguyên lớn hơn 0.';
    }
    if (!this.validPositiveInteger(this.biddingLifecycleForm.targetCpaMinConversions)) {
      return 'Ngưỡng bật target CPA phải là số nguyên lớn hơn 0.';
    }
    if (Number(this.biddingLifecycleForm.targetCpaMinConversions)
      < Number(this.biddingLifecycleForm.maximizeConversionsMinConversions)) {
      return 'Ngưỡng target CPA không được thấp hơn ngưỡng Maximize Conversions.';
    }
    if (this.biddingLifecycleForm.enabled
      && !this.validPositiveAmount(this.biddingLifecycleForm.targetCpaVnd)) {
      return 'Target CPA VND phải lớn hơn 0.';
    }
    if (!this.validNonNegativeInteger(this.biddingLifecycleForm.cooldownHours)) {
      return 'Cooldown phải là số giờ nguyên không âm.';
    }
    if (!this.validNonNegativeInteger(this.biddingLifecycleForm.minimumStageDwellHours)) {
      return 'Thời gian tối thiểu ở mỗi stage phải là số giờ nguyên không âm.';
    }
    if (this.biddingLifecycleForm.draftOnly !== true) {
      return 'Bidding lifecycle bắt buộc draftOnly=true.';
    }
    return '';
  }

  private resetChildSelection(): void {
    this.resourceForm.adGroupId = '';
    this.resourceForm.criterionId = '';
    this.resourceForm.adId = '';
    this.resourceForm.adGroupName = '';
    this.resourceForm.cpcBidVnd = null;
    this.resourceForm.keywordText = '';
    this.resourceForm.negative = false;
    this.resourceForm.finalUrl = '';
    this.resourceForm.headlines = [];
    this.resourceForm.descriptions = [];
    this.resourceForm.path1 = '';
    this.resourceForm.path2 = '';
    this.resourceForm.trackingUrlTemplate = '';
    this.resourceForm.finalUrlSuffix = '';
    this.resourceForm.headlinePinFields = [];
    this.resourceForm.descriptionPinFields = [];
    this.headlinesInput = '';
    this.descriptionsInput = '';
  }

  private parseAssetLines(value: string): string[] {
    return Array.from(new Set(String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)));
  }

  private assetTexts(values?: Array<string | { text?: string }>): string[] {
    return (values || []).map((value) => typeof value === 'string' ? value : String(value?.text || ''))
      .map((value) => value.trim()).filter(Boolean);
  }

  private buildPins<T extends string>(fields: Array<T | ''>): Array<GoogleRsaAssetPin<T>> {
    return fields.flatMap((pinnedField, index) => pinnedField ? [{ index, pinnedField }] : []);
  }

  private normalizePins<T extends string>(pins?: Array<GoogleRsaAssetPin<T>>): Array<GoogleRsaAssetPin<T>> {
    return [...(pins || [])].sort((left, right) => left.index - right.index);
  }

  private pinFields<T extends string>(
    length: number,
    pins?: Array<GoogleRsaAssetPin<T>>,
  ): Array<T | ''> {
    const fields = Array.from({ length }, () => '' as T | '');
    for (const pin of pins || []) {
      if (Number.isInteger(pin.index) && pin.index >= 0 && pin.index < length) {
        fields[pin.index] = pin.pinnedField;
      }
    }
    return fields;
  }

  private resizePins<T extends string>(fields: Array<T | ''>, length: number): Array<T | ''> {
    return Array.from({ length }, (_, index) => fields[index] || '');
  }

  private microsToVnd(vnd?: number, micros?: number): number | null {
    const value = vnd ?? (micros === undefined ? undefined : micros / 1_000_000);
    return value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
  }

  private optionalNonNegative(value: number | null): boolean {
    return value !== null && Number.isFinite(Number(value)) && Number(value) >= 0;
  }

  private validHttpsUrl(value: string): boolean {
    try {
      return new URL(value.trim()).protocol === 'https:';
    } catch {
      return false;
    }
  }

  private validPositiveAmount(value: number | null): boolean {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  private validPositiveInteger(value: number | null): boolean {
    return Number.isInteger(Number(value)) && Number(value) > 0;
  }

  private validNonNegativeInteger(value: number | null): boolean {
    return Number.isInteger(Number(value)) && Number(value) >= 0;
  }

  private planActionLiveGatesPassed(): boolean {
    const gates = this.capabilities()?.liveActionGates;
    if (!gates) return false;
    const actionTypes = this.items().length
      ? this.items().map((item) => item.actionType)
      : [this.currentDraftActionType()];
    return actionTypes.every((actionType) => {
      const operation = String(actionType).startsWith('create_')
        ? 'create'
        : String(actionType).startsWith('pause_')
          ? 'pause'
          : String(actionType).startsWith('resume_') ? 'resume' : 'update';
      if (String(actionType).includes('ad_group')) return gates.adGroup?.[operation] === true;
      if (String(actionType).includes('keyword')) return gates.keyword?.[operation] === true;
      if (String(actionType).includes('responsive_search_ad')) {
        return gates.responsiveSearchAd?.[operation] === true;
      }
      return gates[operation] === true;
    });
  }

  private currentDraftActionType(): GoogleCampaignActionType {
    const prefix = this.operation() === 'create'
      ? 'create'
      : this.operation() === 'update'
        ? 'update'
        : this.operation() === 'pause' ? 'pause' : 'resume';
    if (this.resourceScope() === 'campaign') {
      return prefix === 'create'
        ? 'create_search_campaign'
        : prefix === 'update'
          ? 'update_search_campaign'
          : prefix === 'pause' ? 'pause_campaign' : 'resume_campaign';
    }
    const suffix = this.resourceScope();
    return `${prefix}_${suffix}` as GoogleCampaignActionType;
  }

  private newIdempotencyKey(): string {
    const random = globalThis.crypto?.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `GOOGLE-ERP-UI-${random}`;
  }

  private run<T>(key: string, request: Observable<T>, onSuccess: (value: T) => void): void {
    this.loadingAction.set(key);
    this.error.set('');
    this.message.set('');
    request.subscribe({
      next: (value) => {
        this.loadingAction.set('');
        onSuccess(value);
      },
      error: (error) => {
        this.loadingAction.set('');
        const message = error?.error?.message || error?.message || 'Yêu cầu ERP thất bại.';
        this.error.set(Array.isArray(message) ? message.join('; ') : String(message));
      },
    });
  }
}

const BIDDING_LABELS: Record<string, string> = {
  MANUAL_CPC: 'Manual CPC',
  MAXIMIZE_CLICKS: 'Tối đa hóa lượt nhấp',
  MAXIMIZE_CONVERSIONS: 'Tối đa hóa lượt chuyển đổi',
  MAXIMIZE_CONVERSION_VALUE: 'Tối đa hóa giá trị chuyển đổi',
};

const BIDDING_LIFECYCLE_STAGE_LABELS: Record<GoogleAdsBiddingLifecycleStage, string> = {
  MAXIMIZE_CLICKS: '1/4 · Tối đa hóa lượt nhấp',
  MAXIMIZE_CLICKS_CPC_CEILING: '2/4 · Tối đa hóa lượt nhấp + giới hạn CPC',
  MAXIMIZE_CONVERSIONS: '3/4 · Tối đa hóa lượt chuyển đổi',
  MAXIMIZE_CONVERSIONS_TARGET_CPA: '4/4 · Tối đa hóa lượt chuyển đổi + target CPA',
};

const ACTION_LABELS: Record<string, string> = {
  create_search_campaign: 'Tạo Google Search campaign (PAUSED)',
  update_campaign_bidding_strategy: 'Cập nhật chiến lược giá thầu campaign',
  update_campaign_budget: 'Cập nhật daily budget',
  update_search_campaign: 'Cập nhật Search campaign',
  pause_campaign: 'Dừng campaign',
  resume_campaign: 'Kích hoạt campaign (bước 4/4)',
  create_ad_group: 'Tạo Ad Group (PAUSED)',
  update_ad_group: 'Cập nhật Ad Group',
  pause_ad_group: 'Dừng Ad Group',
  resume_ad_group: 'Kích hoạt Ad Group (bước 3/4)',
  create_keyword: 'Tạo positive keyword (PAUSED)',
  update_keyword: 'Cập nhật keyword',
  pause_keyword: 'Dừng keyword',
  resume_keyword: 'Kích hoạt positive keyword (bước 2/4)',
  create_responsive_search_ad: 'Tạo Responsive Search Ad (PAUSED)',
  update_responsive_search_ad: 'Cập nhật Responsive Search Ad',
  pause_responsive_search_ad: 'Dừng Responsive Search Ad',
  resume_responsive_search_ad: 'Kích hoạt Responsive Search Ad (bước 1/4)',
};

const RESOURCE_LABELS: Record<SearchResourceScope, string> = {
  campaign: 'Search campaign',
  ad_group: 'Ad Group',
  keyword: 'keyword',
  responsive_search_ad: 'Responsive Search Ad',
};
