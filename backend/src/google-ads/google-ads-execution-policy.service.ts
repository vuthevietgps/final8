import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import {
  GOOGLE_ADS_FINANCIAL_CONTROL,
  GoogleAdsFinancialControlReadModel,
} from './google-ads-financial-control.port';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';
import { GoogleAdsAdGroup, GoogleAdsAdGroupDocument } from './schemas/google-ads-ad-group.schema';
import { GoogleAdsActionPlan, GoogleAdsActionPlanItem } from './schemas/google-ads-action-plan.schema';
import {
  GoogleAdsActionExecutionLog,
  GoogleAdsActionExecutionLogDocument,
} from './schemas/google-ads-action-execution-log.schema';
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetDocument,
} from './schemas/google-ads-campaign-budget.schema';
import { GoogleAdsCampaign, GoogleAdsCampaignDocument } from './schemas/google-ads-campaign.schema';
import { GoogleAdsSyncRun, GoogleAdsSyncRunDocument } from './schemas/google-ads-sync-run.schema';

export type GoogleAdsExecutionPreflight = {
  action: GoogleAdsActionPlanItem;
  operations: Array<Record<string, any>>;
  beforeState?: Record<string, any>;
};

export type GoogleAdsExecutionPreflightOptions = {
  /**
   * Financial Control is a live-mutation gate. Dry-runs deliberately disable
   * this check so operators can diagnose a blocked plan without calling the
   * provider or reserving idempotency.
   */
  enforceFinancialControl?: boolean;
};

type FinancialBudgetExposure = {
  key: string;
  dailyBudget: number;
  actionId: string;
  customerId: string;
  syncTimestamps: unknown[];
};

export type GoogleAdsFinancialControlDiagnostic = {
  checked: true;
  required: boolean;
  allowed: boolean;
  reason?: string;
  proposedDailyBudget?: number;
  googleDailyEnvelope?: number;
  proposedWeeklyBudget?: number;
  googleWeeklyEnvelope?: number;
};

type AuthoritativeSyncState = Map<string, Date>;

const PORTFOLIO_STATE_MUTATIONS = [
  'update_campaign_budget',
  'resume_campaign',
];

const SUPPORTED_EXECUTION_ACTIONS = new Set([
  'create_search_campaign',
  'create_ad_group',
  'create_keyword',
  'create_responsive_search_ad',
  'update_campaign_budget',
  'pause_campaign',
  'resume_campaign',
  'pause_ad_group',
  'resume_ad_group',
]);

@Injectable()
export class GoogleAdsExecutionPolicyService {
  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly campaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly campaignBudgetModel: Model<GoogleAdsCampaignBudgetDocument>,
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly adGroupModel: Model<GoogleAdsAdGroupDocument>,
    @InjectModel(AdGroup.name)
    private readonly legacyAdGroupModel: Model<AdGroupDocument>,
    @InjectModel(GoogleAdsSyncRun.name)
    private readonly syncRunModel: Model<GoogleAdsSyncRunDocument>,
    @InjectModel(GoogleAdsActionExecutionLog.name)
    private readonly executionLogModel: Model<GoogleAdsActionExecutionLogDocument>,
    private readonly operationBuilder: GoogleAdsOperationBuilderService,
    @Inject(GOOGLE_ADS_FINANCIAL_CONTROL)
    private readonly financialControlService: GoogleAdsFinancialControlReadModel,
  ) {}

  async preflight(
    plan: GoogleAdsActionPlan,
    actions: GoogleAdsActionPlanItem[],
    options: GoogleAdsExecutionPreflightOptions = {},
  ): Promise<GoogleAdsExecutionPreflight[]> {
    if (plan.currency !== 'VND') throw new BadRequestException('Google Ads execution requires plan currency VND.');
    if (plan.timezone !== 'Asia/Ho_Chi_Minh') {
      throw new BadRequestException('Google Ads execution requires timezone Asia/Ho_Chi_Minh.');
    }

    const accounts = new Map<string, any>();
    const results: GoogleAdsExecutionPreflight[] = [];
    for (const action of actions) {
      this.assertActionState(action);
      this.rejectRawExecutionPayload(action.typedPayload);
      this.validateTypedPayload(action);
      await this.validateAccount(action, accounts);
      await this.validateBudgetPolicy(action);
      const beforeState = await this.loadAndValidateBeforeState(action);
      const operations = this.operationBuilder.build(action);
      if (!operations.length) throw new BadRequestException(`No executable operation for action ${action.actionId}.`);
      results.push({ action, operations, beforeState });
    }
    if (options.enforceFinancialControl !== false) {
      await this.assertFinancialControlEnvelope(results);
    }
    return results;
  }

  async hasSpendIncreasingExposure(preflight: GoogleAdsExecutionPreflight[]): Promise<boolean> {
    for (const item of preflight) {
      if (await this.financialBudgetExposure(item)) return true;
    }
    return false;
  }

  async evaluateFinancialControl(
    preflight: GoogleAdsExecutionPreflight[],
  ): Promise<GoogleAdsFinancialControlDiagnostic> {
    const required = await this.hasSpendIncreasingExposure(preflight);
    if (!required) {
      return { checked: true, required: false, allowed: true };
    }
    try {
      const envelope = await this.assertFinancialControlEnvelope(preflight);
      return {
        checked: true,
        required: true,
        allowed: true,
        ...envelope,
      };
    } catch (error: any) {
      return {
        checked: true,
        required: true,
        allowed: false,
        reason: String(error?.message || 'Financial Control evaluation failed.'),
      };
    }
  }

  private assertActionState(action: GoogleAdsActionPlanItem) {
    if (!SUPPORTED_EXECUTION_ACTIONS.has(action.actionType)) {
      throw new BadRequestException(`Unsupported execution action type: ${action.actionType}.`);
    }
    if (action.status !== 'approved') throw new BadRequestException(`Action ${action.actionId} is not approved.`);
    if (action.providerValidationStatus !== 'provider_validate_passed') {
      throw new BadRequestException(`Action ${action.actionId} has not passed provider validateOnly.`);
    }
    const providerValidatedAt = action.providerValidatedAt
      ? new Date(action.providerValidatedAt)
      : null;
    const now = Date.now();
    if (!providerValidatedAt
      || Number.isNaN(providerValidatedAt.getTime())
      || providerValidatedAt.getTime() > now + 60_000
      || now - providerValidatedAt.getTime() > this.providerValidationTtlMs()) {
      throw new BadRequestException(
        `Action ${action.actionId} provider validateOnly evidence is missing or stale.`,
      );
    }
    if (action.requireExecutionConfirmation !== true) {
      throw new BadRequestException(`Action ${action.actionId} is missing execution confirmation.`);
    }
  }

  private validateTypedPayload(action: GoogleAdsActionPlanItem) {
    const payload = action.typedPayload || {};
    if (action.actionType === 'create_search_campaign') {
      if (payload.status !== 'PAUSED' || payload.advertisingChannelType !== 'SEARCH') {
        throw new BadRequestException(`New campaign action ${action.actionId} must be a PAUSED Search campaign.`);
      }
    }
    if (action.actionType === 'update_campaign_budget') {
      const validId = /^\d+$/.test(String(payload.campaignBudgetId || ''));
      const validResource = new RegExp(`^customers/${action.customerId}/campaignBudgets/\\d+$`)
        .test(String(payload.campaignBudgetResourceName || ''));
      if (!validId && !validResource) {
        throw new BadRequestException(`Campaign budget identifier is required for action ${action.actionId}.`);
      }
    }
    if (action.actionType === 'create_keyword') {
      if (!['EXACT', 'PHRASE', 'BROAD'].includes(String(payload.matchType || '').toUpperCase())) {
        throw new BadRequestException(`Invalid keyword matchType for action ${action.actionId}.`);
      }
      if (!String(payload.keywordText || '').trim()) {
        throw new BadRequestException(`Keyword text is required for action ${action.actionId}.`);
      }
    }
    if (action.actionType === 'create_responsive_search_ad') {
      if (!Array.isArray(payload.headlines) || payload.headlines.length < 3) {
        throw new BadRequestException(`RSA requires at least 3 headlines for action ${action.actionId}.`);
      }
      if (!Array.isArray(payload.descriptions) || payload.descriptions.length < 2) {
        throw new BadRequestException(`RSA requires at least 2 descriptions for action ${action.actionId}.`);
      }
      if (!String(payload.finalUrl || '').trim()) {
        throw new BadRequestException(`RSA finalUrl is required for action ${action.actionId}.`);
      }
    }
    this.validateLandingPages(action);
  }

  private async validateAccount(action: GoogleAdsActionPlanItem, cache: Map<string, any>) {
    let account = cache.get(action.customerId);
    if (account === undefined) {
      account = await this.adAccountModel.findOne({
        accountType: 'google',
        isActive: true,
        accountId: action.customerId,
      }).lean();
      cache.set(action.customerId, account || null);
    }
    const envAllowlist = this.csvEnv('GOOGLE_ADS_CUSTOMER_ID_ALLOWLIST').map((value) => this.digits(value));
    if (!account && !envAllowlist.includes(action.customerId)) {
      throw new BadRequestException(`customerId is not allowlisted for action ${action.actionId}.`);
    }
    if (account?.currency && account.currency !== 'VND') {
      throw new BadRequestException(`Google Ads account currency mismatch for action ${action.actionId}.`);
    }
    if (account?.timezoneId && account.timezoneId !== 'Asia/Ho_Chi_Minh') {
      throw new BadRequestException(`Google Ads account timezone mismatch for action ${action.actionId}.`);
    }
    if (action.loginCustomerId && account?.loginCustomerId
      && this.digits(account.loginCustomerId) !== action.loginCustomerId) {
      throw new BadRequestException(`loginCustomerId mismatch for action ${action.actionId}.`);
    }
  }

  private validateLandingPages(action: GoogleAdsActionPlanItem) {
    const urls = this.collectUrls(action.typedPayload);
    if (!urls.length) return;
    const allowlist = this.csvEnv('GOOGLE_ADS_LANDING_PAGE_ALLOWLIST', 'AI_MARKETING_LANDING_PAGE_ALLOWLIST')
      .map((value) => value.toLowerCase());
    if (!allowlist.length) throw new BadRequestException('Landing page allowlist is empty.');
    for (const raw of urls) {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        throw new BadRequestException(`Invalid landing page URL for action ${action.actionId}.`);
      }
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || !allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        throw new BadRequestException(`Landing page is not allowlisted for action ${action.actionId}.`);
      }
    }
  }

  private async validateBudgetPolicy(action: GoogleAdsActionPlanItem) {
    if (!['create_search_campaign', 'update_campaign_budget'].includes(action.actionType)) return;
    const requested = Number(action.typedPayload?.dailyBudget);
    const maxDaily = this.positiveEnv('GOOGLE_ADS_MAX_DAILY_BUDGET_VND', 5_000_000);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new BadRequestException(`Daily budget violates policy for action ${action.actionId}.`);
    }
    if (action.actionType !== 'update_campaign_budget') {
      if (requested > maxDaily) {
        throw new BadRequestException(`Daily budget violates policy for action ${action.actionId}.`);
      }
      return;
    }
    const syncedBudget: any = await this.findBudget(action);
    if (!syncedBudget) throw new BadRequestException(`Campaign budget is not present in synced ERP data for action ${action.actionId}.`);
    const current = this.budgetAmount(syncedBudget);
    if (!Number.isFinite(current) || current <= 0) {
      throw new BadRequestException(`Current synced budget is required for action ${action.actionId}.`);
    }
    // Never let a stale/unavailable financial envelope prevent an emergency
    // reduction. Environment and percentage caps apply only to increases.
    if (requested <= current) return;
    if (requested > maxDaily) {
      throw new BadRequestException(`Daily budget violates policy for action ${action.actionId}.`);
    }
    const maxIncreasePercent = this.positiveEnv('GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT', 20);
    if (requested > current * (1 + maxIncreasePercent / 100)) {
      throw new BadRequestException(`Budget increase exceeds policy for action ${action.actionId}.`);
    }
  }

  /**
   * Final ERP-side financial gate for live mutations that create or increase
   * spend. Pause actions and budget reductions intentionally bypass this gate,
   * because they reduce financial risk. Provider validateOnly has a separate
   * route and dry-runs call preflight with enforcement disabled.
   */
  private async assertFinancialControlEnvelope(preflight: GoogleAdsExecutionPreflight[]): Promise<{
    proposedDailyBudget: number;
    googleDailyEnvelope: number;
    proposedWeeklyBudget: number;
    googleWeeklyEnvelope: number;
  }> {
    const exposures: FinancialBudgetExposure[] = [];
    let proposedPortfolio: Map<string, number>;
    try {
      for (const item of preflight) {
        const exposure = await this.financialBudgetExposure(item);
        if (exposure) exposures.push(exposure);
      }
      if (!exposures.length) {
        return {
          proposedDailyBudget: 0,
          googleDailyEnvelope: 0,
          proposedWeeklyBudget: 0,
          googleWeeklyEnvelope: 0,
        };
      }
      const authoritativeSync = await this.assertAuthoritativePortfolio(preflight);
      this.assertExposureFreshness(exposures, authoritativeSync);
      proposedPortfolio = await this.loadActiveBudgetPortfolio(authoritativeSync);
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Synced Google Ads budget portfolio is unavailable; spend-increasing actions are blocked.',
      );
    }

    let metrics: any;
    try {
      // Live execution must not rely on the 30-second dashboard cache.
      metrics = await this.financialControlService.getFullMetrics(true);
    } catch {
      throw new BadRequestException(
        'Financial Control is unavailable; spend-increasing Google Ads actions are blocked.',
      );
    }

    const quality = metrics?.dataQuality;
    if (!quality || quality.isDecisionLocked !== false || quality.status === 'blocked') {
      throw new BadRequestException(
        'Financial Control decision is locked; spend-increasing Google Ads actions are blocked.',
      );
    }

    const adsBudgetApproved = Number(metrics?.adsBudgetApproved);
    const maxDailyAds = Number(metrics?.maxDailyAds);
    if (!Number.isFinite(adsBudgetApproved) || adsBudgetApproved <= 0
      || !Number.isFinite(maxDailyAds) || maxDailyAds <= 0) {
      throw new BadRequestException(
        'Financial Control returned an invalid Ads budget envelope; spend-increasing actions are blocked.',
      );
    }

    const providerEnvelope = await this.getGoogleProviderEnvelope(metrics, {
      adsBudgetApproved,
      maxDailyAds,
    });

    // Start with every currently ENABLED synced campaign budget across all
    // Google accounts. Then apply the proposed changes. This prevents an
    // untouched campaign from being omitted when checking the portfolio cap.
    for (const exposure of exposures) {
      proposedPortfolio.set(
        exposure.key,
        Math.max(proposedPortfolio.get(exposure.key) || 0, exposure.dailyBudget),
      );
    }
    const proposedDailyBudget = [...proposedPortfolio.values()]
      .reduce((sum, dailyBudget) => sum + dailyBudget, 0);
    const proposedWeeklyBudget = proposedDailyBudget * 7;
    if (!Number.isFinite(proposedDailyBudget)
      || proposedDailyBudget > providerEnvelope.googleDailyEnvelope
      || proposedWeeklyBudget > providerEnvelope.googleWeeklyEnvelope) {
      const actionIds = [...new Set(exposures.map((exposure) => exposure.actionId))].join(', ');
      throw new BadRequestException(
        `Proposed Google Ads budget exceeds the Financial Control envelope for actions: ${actionIds}.`,
      );
    }
    return {
      proposedDailyBudget,
      proposedWeeklyBudget,
      ...providerEnvelope,
    };
  }

  private async assertAuthoritativePortfolio(
    preflight: GoogleAdsExecutionPreflight[],
  ): Promise<AuthoritativeSyncState> {
    const activeAccounts: any[] = await (this.adAccountModel as any)
      .find({ accountType: 'google', isActive: true })
      .lean();
    if (!Array.isArray(activeAccounts) || !activeAccounts.length) {
      throw new BadRequestException(
        'No active canonical Google Ads account is available; spend-increasing actions are blocked.',
      );
    }

    const activeCustomerIds = new Set(
      activeAccounts.map((account) => String(account?.accountId || '')).filter((id) => /^\d+$/.test(id)),
    );
    if (activeCustomerIds.size !== activeAccounts.length) {
      throw new BadRequestException(
        'An active Google Ads account has an invalid provider ID; spend-increasing actions are blocked.',
      );
    }
    const actionCustomerIds = new Set(preflight.map((item) => String(item.action.customerId || '')));
    for (const customerId of actionCustomerIds) {
      if (!activeCustomerIds.has(customerId)) {
        throw new BadRequestException(
          `Google Ads account ${customerId} has no canonical active synced account; spend-increasing actions are blocked.`,
        );
      }
    }

    const now = Date.now();
    const maxAgeMs = this.financialSyncMaxAgeMs();
    const syncState: AuthoritativeSyncState = new Map();
    const completedAtValues: number[] = [];
    for (const customerId of activeCustomerIds) {
      const run: any = await (this.syncRunModel as any)
        .findOne({ customerIds: customerId })
        .sort({ startedAt: -1 })
        .lean();
      const startedAt = run?.startedAt ? new Date(run.startedAt) : null;
      const completedAt = run?.completedAt ? new Date(run.completedAt) : null;
      if (run?.status !== 'success'
        || !startedAt || Number.isNaN(startedAt.getTime())
        || !completedAt || Number.isNaN(completedAt.getTime())
        || completedAt.getTime() > now
        || now - completedAt.getTime() > maxAgeMs) {
        throw new BadRequestException(
          `Google Ads sync for account ${customerId} is missing, stale, or not successful; spend-increasing actions are blocked.`,
        );
      }
      const account = activeAccounts.find((item) => String(item?.accountId || '') === customerId);
      if (account?.lastSyncStatus !== 'ok') {
        throw new BadRequestException(
          `Google Ads account ${customerId} is not in a successful sync state; spend-increasing actions are blocked.`,
        );
      }
      this.assertFreshTimestamp(
        account?.lastSyncAt,
        startedAt,
        `Google Ads account ${customerId} is stale; spend-increasing actions are blocked.`,
      );
      syncState.set(customerId, startedAt);
      completedAtValues.push(completedAt.getTime());
    }

    const oldestCompletedAt = new Date(Math.min(...completedAtValues));
    const unreconciled = await this.executionLogModel.findOne({
      actionType: { $in: PORTFOLIO_STATE_MUTATIONS },
      executedAt: { $gt: oldestCompletedAt },
      $or: [
        { status: 'executing' },
        {
          status: 'success',
          $or: [
            { 'postExecutionErrors.0': { $exists: true } },
            { 'syncedRemoteState.syncResult.status': { $ne: 'success' } },
          ],
        },
      ],
    }).lean();
    if (unreconciled) {
      throw new BadRequestException(
        'A prior Google Ads portfolio mutation is not reconciled by a successful sync; spend-increasing actions are blocked.',
      );
    }
    return syncState;
  }

  private assertExposureFreshness(
    exposures: FinancialBudgetExposure[],
    authoritativeSync: AuthoritativeSyncState,
  ) {
    for (const exposure of exposures) {
      const threshold = authoritativeSync.get(exposure.customerId);
      for (const timestamp of exposure.syncTimestamps) {
        this.assertFreshTimestamp(
          timestamp,
          threshold,
          `Synced state for spend-increasing action ${exposure.actionId} is stale; action is blocked.`,
        );
      }
    }
  }

  private async getGoogleProviderEnvelope(
    metrics: any,
    envelope: { adsBudgetApproved: number; maxDailyAds: number },
  ): Promise<{ googleDailyEnvelope: number; googleWeeklyEnvelope: number }> {
    let suggestion: any;
    try {
      suggestion = await this.financialControlService.getOptimalAdsSuggestion();
    } catch {
      throw new BadRequestException(
        'Google Ads provider allocation is unavailable from Financial Control; spend-increasing actions are blocked.',
      );
    }
    const totalOptimalDaily = Number(suggestion?.totalOptimalDaily);
    const totalOptimalWeekly = Number(suggestion?.totalOptimalWeekly);
    const metricOptimalWeekly = Number(metrics?.optimalAdsSuggestion);
    const items = suggestion?.adGroups;
    if (!Number.isFinite(totalOptimalDaily) || totalOptimalDaily <= 0
      || !Number.isFinite(totalOptimalWeekly) || totalOptimalWeekly <= 0
      || !Number.isFinite(metricOptimalWeekly) || metricOptimalWeekly <= 0
      || !Array.isArray(items) || !items.length
      || Math.abs(totalOptimalWeekly - metricOptimalWeekly) > Math.max(1, metricOptimalWeekly * 0.001)) {
      throw new BadRequestException(
        'Financial Control provider allocation is inconsistent; spend-increasing Google Ads actions are blocked.',
      );
    }

    const itemIds = [...new Set(items.map((item: any) => String(item?.adGroupId || '')).filter(Boolean))];
    const adGroups: any[] = await (this.legacyAdGroupModel as any)
      .find({ adGroupId: { $in: itemIds } })
      .lean();
    if (!Array.isArray(adGroups)) {
      throw new BadRequestException(
        'Ads provider mapping is unavailable; spend-increasing Google Ads actions are blocked.',
      );
    }
    const platformByAdGroup = new Map(
      adGroups.map((adGroup) => [String(adGroup?.adGroupId || ''), String(adGroup?.platform || '')]),
    );
    let googleOptimalDaily = 0;
    let recomputedTotalDaily = 0;
    for (const item of items) {
      const adGroupId = String(item?.adGroupId || '');
      const platform = platformByAdGroup.get(adGroupId);
      const optimalSuggested = Number(item?.optimalSuggested);
      if (!['facebook', 'google', 'tiktok'].includes(String(platform))
        || !Number.isFinite(optimalSuggested) || optimalSuggested < 0) {
        throw new BadRequestException(
          `Ads provider mapping is incomplete for ad group ${adGroupId || 'unknown'}; spend-increasing actions are blocked.`,
        );
      }
      recomputedTotalDaily += optimalSuggested;
      if (platform === 'google') googleOptimalDaily += optimalSuggested;
    }
    if (Math.abs(recomputedTotalDaily - totalOptimalDaily) > Math.max(1, totalOptimalDaily * 0.001)
      || googleOptimalDaily <= 0) {
      throw new BadRequestException(
        'No reliable Google-specific share exists in the Financial Control Ads envelope; spend-increasing actions are blocked.',
      );
    }
    const googleShare = googleOptimalDaily / totalOptimalDaily;
    return {
      googleDailyEnvelope: envelope.maxDailyAds * googleShare,
      googleWeeklyEnvelope: envelope.adsBudgetApproved * googleShare,
    };
  }

  private assertFreshTimestamp(value: unknown, threshold: Date | undefined, message: string) {
    const timestamp = value ? new Date(value as any) : null;
    if (!threshold || !timestamp || Number.isNaN(timestamp.getTime()) || timestamp < threshold) {
      throw new BadRequestException(message);
    }
  }

  private financialSyncMaxAgeMs(): number {
    const configured = Number(process.env.GOOGLE_ADS_FINANCIAL_SYNC_MAX_AGE_MS);
    if (!Number.isFinite(configured)) return 15 * 60 * 1000;
    return Math.min(24 * 60 * 60 * 1000, Math.max(60 * 1000, Math.floor(configured)));
  }

  private async loadActiveBudgetPortfolio(
    authoritativeSync: AuthoritativeSyncState,
  ): Promise<Map<string, number>> {
    const campaigns: any[] = await (this.campaignModel as any)
      .find({
        status: 'ENABLED',
        customerId: { $in: [...authoritativeSync.keys()] },
      })
      .lean();
    if (!Array.isArray(campaigns)) {
      throw new BadRequestException(
        'Synced Google Ads campaign portfolio is unavailable; spend-increasing actions are blocked.',
      );
    }
    if (!campaigns.length) return new Map<string, number>();

    const referencesByCustomer = new Map<string, {
      ids: Set<string>;
      resources: Set<string>;
    }>();
    for (const campaign of campaigns) {
      const customerId = String(campaign?.customerId || '');
      const campaignBudgetId = String(campaign?.campaignBudgetId || '');
      const resourceName = String(campaign?.campaignBudgetResourceName || '');
      if (!/^\d+$/.test(customerId)
        || (!/^\d+$/.test(campaignBudgetId)
          && !new RegExp(`^customers/${customerId}/campaignBudgets/\\d+$`).test(resourceName))) {
        throw new BadRequestException(
          'An enabled synced campaign has no canonical campaign budget mapping; spend-increasing actions are blocked.',
        );
      }
      this.assertFreshTimestamp(
        campaign?.lastSyncAt,
        authoritativeSync.get(customerId),
        'An enabled synced campaign is stale; spend-increasing actions are blocked.',
      );
      const references = referencesByCustomer.get(customerId) || {
        ids: new Set<string>(),
        resources: new Set<string>(),
      };
      if (/^\d+$/.test(campaignBudgetId)) references.ids.add(campaignBudgetId);
      if (resourceName) references.resources.add(resourceName);
      referencesByCustomer.set(customerId, references);
    }

    const budgetsByKey = new Map<string, any>();
    for (const [customerId, references] of referencesByCustomer) {
      const or: Record<string, any>[] = [];
      if (references.ids.size) or.push({ campaignBudgetId: { $in: [...references.ids] } });
      if (references.resources.size) or.push({ resourceName: { $in: [...references.resources] } });
      const budgets: any[] = await (this.campaignBudgetModel as any)
        .find({ customerId, $or: or })
        .lean();
      if (!Array.isArray(budgets)) {
        throw new BadRequestException(
          'Synced Google Ads campaign budgets are unavailable; spend-increasing actions are blocked.',
        );
      }
      for (const budget of budgets) {
        this.assertFreshTimestamp(
          budget?.lastSyncAt,
          authoritativeSync.get(customerId),
          'A synced Google Ads campaign budget is stale; spend-increasing actions are blocked.',
        );
        budgetsByKey.set(this.budgetKey(customerId, budget), budget);
        if (budget?.campaignBudgetId) {
          budgetsByKey.set(`${customerId}:${String(budget.campaignBudgetId)}`, budget);
        }
      }
    }

    const portfolio = new Map<string, number>();
    for (const campaign of campaigns) {
      const customerId = String(campaign.customerId);
      const resourceKey = String(campaign.campaignBudgetResourceName || '');
      const idKey = `${customerId}:${String(campaign.campaignBudgetId || '')}`;
      const budget = budgetsByKey.get(resourceKey) || budgetsByKey.get(idKey);
      const dailyBudget = this.budgetAmount(budget);
      if (!budget || !Number.isFinite(dailyBudget) || dailyBudget <= 0) {
        throw new BadRequestException(
          'An enabled synced campaign has no valid current budget; spend-increasing actions are blocked.',
        );
      }
      portfolio.set(this.budgetKey(customerId, budget), dailyBudget);
    }
    return portfolio;
  }

  private async financialBudgetExposure(
    item: GoogleAdsExecutionPreflight,
  ): Promise<FinancialBudgetExposure | null> {
    const { action, beforeState } = item;
    const requested = Number(action.typedPayload?.dailyBudget);
    if (action.actionType === 'create_search_campaign') {
      return {
        key: `new:${action.actionId}`,
        dailyBudget: requested,
        actionId: action.actionId,
        customerId: action.customerId,
        syncTimestamps: [],
      };
    }
    if (action.actionType === 'update_campaign_budget') {
      const current = this.budgetAmount(beforeState);
      if (requested <= current) return null;
      return {
        key: this.budgetKey(action.customerId, beforeState),
        dailyBudget: requested,
        actionId: action.actionId,
        customerId: action.customerId,
        syncTimestamps: [beforeState?.lastSyncAt],
      };
    }
    if (action.actionType === 'resume_campaign') {
      const budget = await this.findCampaignBudget(action.customerId, beforeState);
      return this.resumeExposure(action, budget, [beforeState?.lastSyncAt, budget?.lastSyncAt]);
    }
    if (action.actionType === 'resume_ad_group') {
      const campaignId = String(beforeState?.campaignId || '');
      const campaign = campaignId
        ? await this.campaignModel.findOne({ customerId: action.customerId, campaignId }).lean()
        : null;
      if (!campaign) {
        throw new BadRequestException(
          `Campaign budget cannot be resolved for spend-increasing action ${action.actionId}.`,
        );
      }
      const budget = await this.findCampaignBudget(action.customerId, campaign);
      return this.resumeExposure(action, budget, [
        beforeState?.lastSyncAt,
        campaign?.lastSyncAt,
        budget?.lastSyncAt,
      ]);
    }
    return null;
  }

  private resumeExposure(
    action: GoogleAdsActionPlanItem,
    budget: any,
    syncTimestamps: unknown[],
  ): FinancialBudgetExposure {
    const dailyBudget = this.budgetAmount(budget);
    if (!budget || !Number.isFinite(dailyBudget) || dailyBudget <= 0) {
      throw new BadRequestException(
        `Current synced campaign budget is required for spend-increasing action ${action.actionId}.`,
      );
    }
    return {
      key: this.budgetKey(action.customerId, budget),
      dailyBudget,
      actionId: action.actionId,
      customerId: action.customerId,
      syncTimestamps,
    };
  }

  private async findCampaignBudget(customerId: string, campaign: any) {
    const or: Record<string, string>[] = [];
    if (/^\d+$/.test(String(campaign?.campaignBudgetId || ''))) {
      or.push({ campaignBudgetId: String(campaign.campaignBudgetId) });
    }
    if (new RegExp(`^customers/${customerId}/campaignBudgets/\\d+$`)
      .test(String(campaign?.campaignBudgetResourceName || ''))) {
      or.push({ resourceName: String(campaign.campaignBudgetResourceName) });
    }
    if (!or.length) return null;
    return this.campaignBudgetModel.findOne({ customerId, $or: or }).lean();
  }

  private budgetAmount(budget: any) {
    if (budget?.amountVnd !== undefined && budget?.amountVnd !== null) {
      return Number(budget.amountVnd);
    }
    return Number(budget?.amountMicros) / 1_000_000;
  }

  private budgetKey(customerId: string, budget: any) {
    const resourceName = String(budget?.resourceName || '');
    if (resourceName) return resourceName;
    return `${customerId}:${String(budget?.campaignBudgetId || '')}`;
  }

  private async loadAndValidateBeforeState(action: GoogleAdsActionPlanItem) {
    const payload = action.typedPayload || {};
    switch (action.actionType) {
      case 'create_search_campaign':
        return undefined;
      case 'create_ad_group':
        return this.requiredLean(
          this.campaignModel.findOne({ customerId: action.customerId, campaignId: payload.campaignId }),
          `Campaign is not present in synced ERP data for action ${action.actionId}.`,
        );
      case 'create_keyword':
      case 'create_responsive_search_ad':
        return this.requiredLean(
          this.adGroupModel.findOne({ customerId: action.customerId, adGroupId: payload.adGroupId }),
          `Ad group is not present in synced ERP data for action ${action.actionId}.`,
        );
      case 'update_campaign_budget':
        return this.findBudget(action);
      case 'pause_campaign':
      case 'resume_campaign':
        return this.requiredLean(
          this.campaignModel.findOne({ customerId: action.customerId, campaignId: payload.campaignId }),
          `Campaign is not present in synced ERP data for action ${action.actionId}.`,
        );
      case 'pause_ad_group':
      case 'resume_ad_group':
        return this.requiredLean(
          this.adGroupModel.findOne({ customerId: action.customerId, adGroupId: payload.adGroupId }),
          `Ad group is not present in synced ERP data for action ${action.actionId}.`,
        );
      default:
        return undefined;
    }
  }

  private async findBudget(action: GoogleAdsActionPlanItem) {
    const payload = action.typedPayload || {};
    const filter: any = { customerId: action.customerId, $or: [] };
    if (/^\d+$/.test(String(payload.campaignBudgetId || ''))) {
      filter.$or.push({ campaignBudgetId: String(payload.campaignBudgetId) });
    }
    if (new RegExp(`^customers/${action.customerId}/campaignBudgets/\\d+$`).test(String(payload.campaignBudgetResourceName || ''))) {
      filter.$or.push({ resourceName: String(payload.campaignBudgetResourceName) });
    }
    if (!filter.$or.length) return null;
    return this.campaignBudgetModel.findOne(filter).lean();
  }

  private async requiredLean(query: any, message: string) {
    const value = await query.lean();
    if (!value) throw new BadRequestException(message);
    return value;
  }

  private rejectRawExecutionPayload(value: any) {
    const blockedKeys = new Set(['api_execution_queue', 'rawApiRequest', 'rawPayload', 'mutateOperation', 'providerRequest']);
    const walk = (input: any): boolean => {
      if (Array.isArray(input)) return input.some(walk);
      if (!input || typeof input !== 'object') return false;
      return Object.entries(input).some(([key, child]) => blockedKeys.has(key) || walk(child));
    };
    if (walk(value)) throw new BadRequestException('Raw provider execution payload is forbidden.');
  }

  private collectUrls(value: any, key = ''): string[] {
    if (typeof value === 'string' && /^(finalUrl|finalUrls|landingPageUrl)$/i.test(key)) return [value];
    if (Array.isArray(value)) return value.flatMap((item) => this.collectUrls(item, key));
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([childKey, child]) => this.collectUrls(child, childKey));
    }
    return [];
  }

  private csvEnv(...names: string[]) {
    return names.flatMap((name) => String(process.env[name] || '').split(','))
      .map((value) => value.trim()).filter(Boolean);
  }

  private digits(value: any) {
    return String(value || '').replace(/\D/g, '');
  }

  private positiveEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private providerValidationTtlMs() {
    const configured = Number(process.env.GOOGLE_ADS_PROVIDER_VALIDATION_TTL_MS);
    if (!Number.isFinite(configured)) return 15 * 60 * 1000;
    return Math.min(24 * 60 * 60 * 1000, Math.max(60 * 1000, Math.floor(configured)));
  }
}
