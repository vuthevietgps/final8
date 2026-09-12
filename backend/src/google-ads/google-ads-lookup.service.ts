import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import {
  AdsManagerAccount,
  AdsManagerAccountDocument,
} from '../ads-manager-account/schemas/ads-manager-account.schema';
import {
  googleAdsManagerByLoginCustomerId,
  googleAdsMccReadinessBlockers,
} from './google-ads-mcc-readiness.util';
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetDocument,
} from './schemas/google-ads-campaign-budget.schema';
import {
  GoogleAdsCampaign,
  GoogleAdsCampaignDocument,
} from './schemas/google-ads-campaign.schema';
import { GoogleAdsAdGroup, GoogleAdsAdGroupDocument } from './schemas/google-ads-ad-group.schema';
import { GoogleAdsKeyword, GoogleAdsKeywordDocument } from './schemas/google-ads-keyword.schema';
import { GoogleAdsAd, GoogleAdsAdDocument } from './schemas/google-ads-ad.schema';
import {
  GoogleAdsCampaignCriterion,
  GoogleAdsCampaignCriterionDocument,
} from './schemas/google-ads-campaign-criterion.schema';

@Injectable()
export class GoogleAdsLookupService {
  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly campaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly campaignBudgetModel: Model<GoogleAdsCampaignBudgetDocument>,
    @InjectModel(AdsManagerAccount.name)
    private readonly managerAccountModel: Model<AdsManagerAccountDocument>,
    @Optional()
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly adGroupModel?: Model<GoogleAdsAdGroupDocument>,
    @Optional()
    @InjectModel(GoogleAdsKeyword.name)
    private readonly keywordModel?: Model<GoogleAdsKeywordDocument>,
    @Optional()
    @InjectModel(GoogleAdsAd.name)
    private readonly adModel?: Model<GoogleAdsAdDocument>,
    @Optional()
    @InjectModel(GoogleAdsCampaignCriterion.name)
    private readonly campaignCriterionModel?: Model<GoogleAdsCampaignCriterionDocument>,
  ) {}

  async listAdAccounts() {
    const accounts: any[] = await this.adAccountModel.find(
      { accountType: 'google', isActive: true },
      {
        _id: 0,
        accountId: 1,
        name: 1,
        currency: 1,
        timezoneId: 1,
        loginCustomerId: 1,
        lastSyncAt: 1,
        lastSyncStatus: 1,
      },
    ).lean();
    const managers: any[] = await this.managerAccountModel.find({
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      isActive: true,
    }).lean();
    return (accounts || []).flatMap((account) => {
      const customerId = this.numericId(account.accountId);
      if (!customerId) return [];
      const blockers: string[] = [];
      if (String(account.currency || '').trim() !== 'VND') blockers.push('CURRENCY_NOT_VND');
      if (String(account.timezoneId || '').trim() !== 'Asia/Ho_Chi_Minh') {
        blockers.push('TIMEZONE_NOT_ASIA_HO_CHI_MINH');
      }
      if (account.lastSyncStatus !== 'ok') {
        blockers.push('LAST_SYNC_FAILED');
      }
      const loginCustomerId = this.numericId(account.loginCustomerId)
        || this.numericId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
      if (loginCustomerId) {
        blockers.push(...googleAdsMccReadinessBlockers(
          googleAdsManagerByLoginCustomerId(managers, loginCustomerId),
          customerId,
        ));
      }
      const lastSyncAt = this.validDate(account.lastSyncAt);
      const maximumAge = this.positiveEnv(
        'GOOGLE_ADS_CANONICAL_SYNC_MAX_AGE_MS',
        15 * 60 * 1000,
      );
      if (!lastSyncAt || lastSyncAt.getTime() > Date.now() + 60_000
        || Date.now() - lastSyncAt.getTime() > maximumAge) {
        blockers.push('LAST_SYNC_MISSING_OR_STALE');
      }
      return [{
        customerId,
        name: String(account.name || customerId).trim(),
        ...(account.currency ? { currency: String(account.currency).trim() } : {}),
        ...(account.timezoneId ? { timezone: String(account.timezoneId).trim() } : {}),
        ...(lastSyncAt ? { lastSyncAt: lastSyncAt.toISOString() } : {}),
        ...(account.lastSyncStatus ? { lastSyncStatus: account.lastSyncStatus } : {}),
        eligible: blockers.length === 0,
        readinessBlockers: blockers,
      }];
    }).sort((left, right) =>
      left.name.localeCompare(right.name, 'vi')
      || left.customerId.localeCompare(right.customerId));
  }

  async listCampaigns(customerIdInput: string) {
    const customerId = this.numericId(customerIdInput);
    if (!customerId) {
      throw new BadRequestException('customerId must be a numeric Google Ads customer ID.');
    }
    const account: any = await this.findAccount(customerId);
    if (!account) {
      throw new BadRequestException('customerId is not an active canonical Google Ads account.');
    }
    const loginCustomerId = this.numericId(account.loginCustomerId)
      || this.numericId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    if (loginCustomerId) {
      const managers: any[] = await this.managerAccountModel.find({
        provider: 'google',
        managerAccountType: 'google_ads_mcc',
        isActive: true,
      }).lean();
      const blockers = googleAdsMccReadinessBlockers(
        googleAdsManagerByLoginCustomerId(managers, loginCustomerId),
        customerId,
      );
      if (blockers.length) {
        throw new BadRequestException(
          `Google Ads MCC readiness blocks campaign lookup: ${blockers.join(', ')}.`,
        );
      }
    }
    const campaigns: any[] = await this.campaignModel.find(
      {
        customerId,
        advertisingChannelType: 'SEARCH',
        status: { $nin: ['REMOVED'] },
      },
      {
        _id: 0,
        campaignId: 1,
        campaignName: 1,
        status: 1,
        advertisingChannelType: 1,
        biddingStrategyType: 1,
        biddingStrategySystemStatus: 1,
        biddingStrategyResourceName: 1,
        targetSpendCpcBidCeilingMicros: 1,
        maximizeConversionsTargetCpaMicros: 1,
        campaignBudgetId: 1,
        campaignBudgetResourceName: 1,
        startDate: 1,
        endDate: 1,
        lastSyncAt: 1,
      },
    ).sort({ lastSyncAt: -1, campaignId: 1 }).limit(500).lean();

    const budgetIds = new Set<string>();
    const budgetResources = new Set<string>();
    for (const campaign of campaigns || []) {
      if (/^\d+$/.test(String(campaign.campaignBudgetId || ''))) {
        budgetIds.add(String(campaign.campaignBudgetId));
      }
      if (new RegExp(`^customers/${customerId}/campaignBudgets/\\d+$`)
        .test(String(campaign.campaignBudgetResourceName || ''))) {
        budgetResources.add(String(campaign.campaignBudgetResourceName));
      }
    }
    const or: Record<string, any>[] = [];
    if (budgetIds.size) or.push({ campaignBudgetId: { $in: [...budgetIds] } });
    if (budgetResources.size) or.push({ resourceName: { $in: [...budgetResources] } });
    const budgets: any[] = or.length
      ? await this.campaignBudgetModel.find(
        { customerId, $or: or },
        {
          _id: 0,
          campaignBudgetId: 1,
          resourceName: 1,
          name: 1,
          amountVnd: 1,
          amountMicros: 1,
          deliveryMethod: 1,
          explicitlyShared: 1,
          lastSyncAt: 1,
        },
      ).lean()
      : [];
    const budgetsById = new Map((budgets || []).map((budget) => [budget.campaignBudgetId, budget]));
    const budgetsByResource = new Map((budgets || []).map((budget) => [budget.resourceName, budget]));

    return (campaigns || []).map((campaign) => {
      const budget = budgetsById.get(campaign.campaignBudgetId)
        || budgetsByResource.get(campaign.campaignBudgetResourceName);
      const amountVnd = budget?.amountVnd !== undefined && budget?.amountVnd !== null
        ? Number(budget.amountVnd)
        : Number(budget?.amountMicros) / 1_000_000;
      const lastSyncAt = this.validDate(campaign.lastSyncAt);
      return {
        campaignId: String(campaign.campaignId),
        name: String(campaign.campaignName || campaign.campaignId).trim(),
        status: String(campaign.status || '').trim().toUpperCase(),
        advertisingChannelType: 'SEARCH',
        ...(campaign.biddingStrategyType
          ? { biddingStrategyType: String(campaign.biddingStrategyType) }
          : {}),
        ...(campaign.biddingStrategySystemStatus
          ? { biddingStrategySystemStatus: String(campaign.biddingStrategySystemStatus) }
          : {}),
        ...(campaign.biddingStrategyResourceName
          ? { biddingStrategyResourceName: String(campaign.biddingStrategyResourceName) }
          : {}),
        maxCpcBidCeilingVnd:
          Number(campaign.targetSpendCpcBidCeilingMicros || 0) / 1_000_000,
        targetCpaVnd:
          Number(campaign.maximizeConversionsTargetCpaMicros || 0) / 1_000_000,
        ...(campaign.startDate ? { startDate: campaign.startDate } : {}),
        ...(campaign.endDate ? { endDate: campaign.endDate } : {}),
        ...(budget ? {
          budget: {
            campaignBudgetId: String(budget.campaignBudgetId),
            name: String(budget.name || budget.campaignBudgetId).trim(),
            ...(Number.isFinite(amountVnd) ? { dailyBudgetVnd: amountVnd } : {}),
            deliveryMethod: budget.deliveryMethod,
            explicitlyShared: budget.explicitlyShared === true,
          },
        } : {}),
        ...(lastSyncAt ? { lastSyncAt: lastSyncAt.toISOString() } : {}),
      };
    });
  }

  async listAdGroups(customerIdInput: string, campaignIdInput: string) {
    const { customerId, campaignId } = await this.canonicalSearchCampaign(
      customerIdInput,
      campaignIdInput,
    );
    const rows: any[] = await this.adGroupModel.find({
      customerId,
      campaignId,
      type: 'SEARCH_STANDARD',
      status: { $nin: ['REMOVED'] },
    }, {
      _id: 0,
      adGroupId: 1,
      adGroupName: 1,
      status: 1,
      type: 1,
      cpcBidMicros: 1,
      lastSyncAt: 1,
    }).sort({ adGroupName: 1, adGroupId: 1 }).limit(1000).lean();
    return (rows || []).map((row) => ({
      adGroupId: String(row.adGroupId),
      campaignId,
      name: String(row.adGroupName || row.adGroupId).trim(),
      status: String(row.status || '').toUpperCase(),
      type: 'SEARCH_STANDARD',
      ...(Number.isFinite(Number(row.cpcBidMicros))
        ? { cpcBidVnd: Number(row.cpcBidMicros) / 1_000_000 }
        : {}),
      ...(this.validDate(row.lastSyncAt)
        ? { lastSyncAt: this.validDate(row.lastSyncAt)!.toISOString() }
        : {}),
    }));
  }

  async listKeywords(customerIdInput: string, adGroupIdInput: string) {
    const { customerId, adGroup } = await this.canonicalSearchAdGroup(
      customerIdInput,
      adGroupIdInput,
    );
    const rows: any[] = await this.keywordModel.find({
      customerId,
      adGroupId: adGroup.adGroupId,
      status: { $nin: ['REMOVED'] },
    }, {
      _id: 0,
      campaignId: 1,
      adGroupId: 1,
      criterionId: 1,
      keywordText: 1,
      matchType: 1,
      negative: 1,
      status: 1,
      cpcBidMicros: 1,
      finalUrls: 1,
      qualityScore: 1,
      lastSyncAt: 1,
    }).sort({ negative: -1, keywordText: 1, criterionId: 1 }).limit(5000).lean();
    return (rows || []).map((row) => ({
      campaignId: String(row.campaignId),
      adGroupId: String(row.adGroupId),
      criterionId: String(row.criterionId),
      keywordText: row.keywordText,
      matchType: row.matchType,
      negative: row.negative === true,
      status: String(row.status || '').toUpperCase(),
      mutable: row.negative !== true,
      ...(Number.isFinite(Number(row.cpcBidMicros))
        ? { cpcBidVnd: Number(row.cpcBidMicros) / 1_000_000 }
        : {}),
      ...(Array.isArray(row.finalUrls) && row.finalUrls[0] ? { finalUrl: row.finalUrls[0] } : {}),
      ...(Number.isFinite(Number(row.qualityScore)) ? { qualityScore: Number(row.qualityScore) } : {}),
      ...(this.validDate(row.lastSyncAt)
        ? { lastSyncAt: this.validDate(row.lastSyncAt)!.toISOString() }
        : {}),
    }));
  }

  async listResponsiveSearchAds(customerIdInput: string, adGroupIdInput: string) {
    const { customerId, adGroup } = await this.canonicalSearchAdGroup(
      customerIdInput,
      adGroupIdInput,
    );
    const rows: any[] = await this.adModel.find({
      customerId,
      adGroupId: adGroup.adGroupId,
      adType: 'RESPONSIVE_SEARCH_AD',
      status: { $nin: ['REMOVED'] },
    }, {
      _id: 0,
      campaignId: 1,
      adGroupId: 1,
      adId: 1,
      status: 1,
      headlines: 1,
      descriptions: 1,
      finalUrls: 1,
      path1: 1,
      path2: 1,
      trackingUrlTemplate: 1,
      finalUrlSuffix: 1,
      policyApprovalStatus: 1,
      policyReviewStatus: 1,
      lastSyncAt: 1,
    }).sort({ adId: 1 }).limit(1000).lean();
    return (rows || []).map((row) => ({
      campaignId: String(row.campaignId),
      adGroupId: String(row.adGroupId),
      adId: String(row.adId),
      status: String(row.status || '').toUpperCase(),
      headlines: this.assetTexts(row.headlines),
      descriptions: this.assetTexts(row.descriptions),
      headlinePins: this.assetPins(row.headlines),
      descriptionPins: this.assetPins(row.descriptions),
      finalUrls: Array.isArray(row.finalUrls) ? row.finalUrls : [],
      ...(row.path1 ? { path1: row.path1 } : {}),
      ...(row.path2 ? { path2: row.path2 } : {}),
      ...(row.trackingUrlTemplate ? { trackingUrlTemplate: row.trackingUrlTemplate } : {}),
      ...(row.finalUrlSuffix ? { finalUrlSuffix: row.finalUrlSuffix } : {}),
      policyApprovalStatus: row.policyApprovalStatus,
      policyReviewStatus: row.policyReviewStatus,
      ...(this.validDate(row.lastSyncAt)
        ? { lastSyncAt: this.validDate(row.lastSyncAt)!.toISOString() }
        : {}),
    }));
  }

  async getSearchReadiness(customerIdInput: string, campaignIdInput: string) {
    const { customerId, campaignId, account, campaign } = await this.canonicalSearchCampaign(
      customerIdInput,
      campaignIdInput,
    );
    const [adGroups, positiveKeywords, responsiveSearchAds] = await Promise.all([
      this.adGroupModel.countDocuments({
        customerId, campaignId, type: 'SEARCH_STANDARD', status: { $nin: ['REMOVED'] },
      }),
      this.keywordModel.countDocuments({
        customerId, campaignId, negative: false, status: { $nin: ['REMOVED'] },
      }),
      this.adModel.countDocuments({
        customerId, campaignId, adType: 'RESPONSIVE_SEARCH_AD', status: { $nin: ['REMOVED'] },
      }),
    ]);
    const [positiveLocations, positiveLanguages] = this.campaignCriterionModel
      ? await Promise.all([
        this.campaignCriterionModel.countDocuments({
          customerId, campaignId, criterionType: 'LOCATION', negative: false,
          status: 'ENABLED',
        }),
        this.campaignCriterionModel.countDocuments({
          customerId, campaignId, criterionType: 'LANGUAGE', negative: false,
          status: 'ENABLED',
        }),
      ])
      : [0, 0];
    const conversionStatus = String(account.conversionTrackingStatus || '').toUpperCase();
    const conversionReady = [
      'CONVERSION_TRACKING_MANAGED_BY_SELF',
      'CONVERSION_TRACKING_MANAGED_BY_THIS_MANAGER',
    ].includes(conversionStatus)
      && /^customers\/\d+$/.test(String(account.googleAdsConversionCustomer || ''));
    const trackingDomains = this.csvEnv(
      'GOOGLE_ADS_TRACKING_DOMAIN_ALLOWLIST',
      'GOOGLE_ADS_LANDING_PAGE_ALLOWLIST',
      'AI_MARKETING_LANDING_PAGE_ALLOWLIST',
    );
    const blockers: string[] = [];
    const bidding = String(campaign.biddingStrategyType || '').toUpperCase();
    if (['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE'].includes(bidding)) {
      blockers.push('CANONICAL_CONVERSION_ACTION_AND_GOAL_EVIDENCE_NOT_SYNCED');
    }
    if (!adGroups) blockers.push('NO_SEARCH_AD_GROUP');
    if (!positiveKeywords) blockers.push('NO_POSITIVE_KEYWORD');
    if (!responsiveSearchAds) blockers.push('NO_RESPONSIVE_SEARCH_AD');
    if (!trackingDomains.length) blockers.push('TRACKING_AND_LANDING_DOMAIN_ALLOWLIST_EMPTY');
    if (!positiveLocations || !positiveLanguages) {
      blockers.push('CANONICAL_LOCATION_LANGUAGE_EVIDENCE_MISSING');
    }
    if (campaign.targetGoogleSearch !== true || campaign.targetContentNetwork !== false) {
      blockers.push('SEARCH_NETWORK_INVARIANT_NOT_CONFIRMED');
    }
    const activationBlockers = [...blockers];
    if (String(campaign.status || '').toUpperCase() !== 'PAUSED') {
      activationBlockers.push('CAMPAIGN_NOT_PAUSED');
    }
    if (bidding !== 'MANUAL_CPC') {
      activationBlockers.push('ACTIVATION_BIDDING_NOT_SUPPORTED_WITHOUT_GOAL_EVIDENCE');
    }
    const enabledAdGroups: any[] = await this.adGroupModel!.find({
      customerId, campaignId, type: 'SEARCH_STANDARD', status: 'ENABLED',
    }).lean();
    let coherentGraph = false;
    for (const adGroup of enabledAdGroups || []) {
      const [keyword, ad] = await Promise.all([
        this.keywordModel!.findOne({
          customerId,
          campaignId,
          adGroupId: String(adGroup.adGroupId),
          negative: false,
          status: 'ENABLED',
        }).lean(),
        this.adModel!.findOne({
          customerId,
          campaignId,
          adGroupId: String(adGroup.adGroupId),
          adType: 'RESPONSIVE_SEARCH_AD',
          status: 'ENABLED',
          policyApprovalStatus: 'APPROVED',
        }).lean(),
      ]);
      if (keyword && ad) {
        coherentGraph = true;
        break;
      }
    }
    if (!coherentGraph) activationBlockers.push('NO_COHERENT_ENABLED_DELIVERY_GRAPH');
    return {
      customerId,
      campaignId,
      ready: blockers.length === 0,
      blockers,
      conversion: {
        ready: conversionReady,
        status: conversionStatus || 'NOT_SYNCED',
        ownerCustomer: account.googleAdsConversionCustomer || null,
        acceptedCustomerDataTerms: account.acceptedCustomerDataTerms === true,
        enhancedConversionsForLeadsEnabled:
          account.enhancedConversionsForLeadsEnabled === true,
        source: 'canonical_google_ads_readonly_sync',
      },
      tracking: {
        httpsRequired: true,
        trackingTemplateRequiresLpurl: true,
        configuredDomainCount: new Set(trackingDomains.map((value) => value.toLowerCase())).size,
      },
      deliveryStack: {
        adGroups,
        positiveKeywords,
        responsiveSearchAds,
        positiveLocations,
        positiveLanguages,
      },
      activation: {
        ready: activationBlockers.length === 0,
        blockers: [...new Set(activationBlockers)],
        stagedOrder: [
          'resume_responsive_search_ad',
          'resume_keyword',
          'resume_ad_group',
          'resume_campaign',
        ],
        campaignStatusRequired: 'PAUSED',
        supportedBiddingStrategy: 'MANUAL_CPC',
      },
    };
  }

  private async canonicalSearchCampaign(customerIdInput: string, campaignIdInput: string) {
    const customerId = this.requiredNumericId(customerIdInput, 'customerId');
    const campaignId = this.requiredNumericId(campaignIdInput, 'campaignId');
    const account: any = await this.findAccount(customerId);
    if (!account) throw new BadRequestException('customerId is not an active canonical Google Ads account.');
    if (account.lastSyncStatus !== 'ok') {
      throw new BadRequestException('Canonical Google Ads account sync is not successful.');
    }
    const accountSync = this.validDate(account.lastSyncAt);
    const maximumAge = this.positiveEnv(
      'GOOGLE_ADS_CANONICAL_SYNC_MAX_AGE_MS',
      15 * 60 * 1000,
    );
    if (!accountSync || accountSync.getTime() > Date.now() + 60_000
      || Date.now() - accountSync.getTime() > maximumAge) {
      throw new BadRequestException('Canonical Google Ads account sync is missing or stale.');
    }
    const campaign: any = await this.campaignModel.findOne({
      customerId,
      campaignId,
      advertisingChannelType: 'SEARCH',
      status: { $nin: ['REMOVED'] },
    }).lean();
    if (!campaign) throw new BadRequestException('Campaign is not a canonical Google Search campaign.');
    this.assertFreshResource(campaign, 'Campaign');
    return { customerId, campaignId, account, campaign };
  }

  private async canonicalSearchAdGroup(customerIdInput: string, adGroupIdInput: string) {
    const customerId = this.requiredNumericId(customerIdInput, 'customerId');
    const adGroupId = this.requiredNumericId(adGroupIdInput, 'adGroupId');
    const adGroup: any = await this.adGroupModel.findOne({
      customerId,
      adGroupId,
      type: 'SEARCH_STANDARD',
      status: { $nin: ['REMOVED'] },
    }).lean();
    if (!adGroup) throw new BadRequestException('Ad group is not a canonical SEARCH_STANDARD ad group.');
    this.assertFreshResource(adGroup, 'Ad group');
    await this.canonicalSearchCampaign(customerId, String(adGroup.campaignId));
    return { customerId, adGroupId, adGroup };
  }

  private requiredNumericId(value: unknown, field: string) {
    const id = this.numericId(value);
    if (!id) throw new BadRequestException(`${field} must be a numeric Google Ads provider ID.`);
    return id;
  }

  private assetTexts(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => typeof item === 'string' ? item : item?.text)
      .filter((item) => typeof item === 'string' && item.trim());
  }

  private assetPins(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: any, index) => {
      const pinnedField = item?.pinnedField || item?.pinned_field;
      return pinnedField ? [{ index, pinnedField }] : [];
    });
  }

  private csvEnv(...names: string[]) {
    return names.flatMap((name) => String(process.env[name] || '').split(','))
      .map((value) => value.trim()).filter(Boolean);
  }

  private positiveEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private assertFreshResource(value: any, label: string) {
    const sync = this.validDate(value?.lastSyncAt);
    const maximumAge = this.positiveEnv(
      'GOOGLE_ADS_CANONICAL_SYNC_MAX_AGE_MS',
      15 * 60 * 1000,
    );
    if (!sync || sync.getTime() > Date.now() + 60_000
      || Date.now() - sync.getTime() > maximumAge) {
      throw new BadRequestException(`${label} canonical sync is missing or stale.`);
    }
  }

  private async findAccount(customerId: string) {
    const accounts: any[] = await this.adAccountModel.find({
      accountType: 'google',
      isActive: true,
    }).lean();
    return (accounts || []).find((account) => this.numericId(account.accountId) === customerId);
  }

  private numericId(value: unknown) {
    const normalized = String(value || '').trim().replace(/[-\s]/g, '');
    return /^\d+$/.test(normalized) ? normalized : undefined;
  }

  private validDate(value: unknown) {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value as any);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
