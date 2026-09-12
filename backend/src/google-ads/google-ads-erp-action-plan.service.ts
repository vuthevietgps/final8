import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import {
  AdsManagerAccount,
  AdsManagerAccountDocument,
} from '../ads-manager-account/schemas/ads-manager-account.schema';
import {
  CreateGoogleAdsActionDto,
  CreateGoogleAdsActionPlanDto,
  GOOGLE_ADS_BIDDING_STRATEGIES,
  GOOGLE_ADS_ERP_ACTION_TYPES,
  GOOGLE_ADS_KEYWORD_MATCH_TYPES,
  GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES,
} from './dto/create-google-ads-action-plan.dto';
import {
  GoogleAdsActionPlan,
  GoogleAdsActionPlanDocument,
} from './schemas/google-ads-action-plan.schema';
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetDocument,
} from './schemas/google-ads-campaign-budget.schema';
import {
  GoogleAdsCampaign,
  GoogleAdsCampaignDocument,
} from './schemas/google-ads-campaign.schema';
import {
  GoogleAdsAdGroup,
  GoogleAdsAdGroupDocument,
} from './schemas/google-ads-ad-group.schema';
import {
  GoogleAdsKeyword,
  GoogleAdsKeywordDocument,
} from './schemas/google-ads-keyword.schema';
import {
  GoogleAdsAd,
  GoogleAdsAdDocument,
} from './schemas/google-ads-ad.schema';
import {
  GoogleAdsCampaignCriterion,
  GoogleAdsCampaignCriterionDocument,
} from './schemas/google-ads-campaign-criterion.schema';
import {
  googleAdsManagerByLoginCustomerId,
  googleAdsMccReadinessBlockers,
} from './google-ads-mcc-readiness.util';
import { GoogleAdsConversionReadinessService } from './google-ads-conversion-readiness.service';

const PLAN_FIELDS = new Set(['planName', 'actions']);
const ACTION_FIELDS = new Set([
  'actionType',
  'customerId',
  'campaignId',
  'adGroupId',
  'criterionId',
  'adId',
  'reason',
  'idempotencyKey',
  'payload',
]);
const PAYLOAD_FIELDS = new Set([
  'campaignName',
  'budgetName',
  'dailyBudgetVnd',
  'biddingStrategyType',
  'maxCpcBidCeilingVnd',
  'targetCpaVnd',
  'startDate',
  'endDate',
  'searchPartnersEnabled',
  'positiveGeoTargetType',
  'geoTargetConstantIds',
  'languageConstantIds',
  'doesNotContainEuPoliticalAdvertising',
  'adGroupName',
  'cpcBidVnd',
  'keywordText',
  'matchType',
  'negative',
  'finalUrl',
  'headlines',
  'descriptions',
  'path1',
  'path2',
  'trackingUrlTemplate',
  'finalUrlSuffix',
  'headlinePins',
  'descriptionPins',
]);

type CanonicalAccount = AdAccount & { _id?: unknown };

type CanonicalBudgetReference = {
  campaignBudgetId: string;
  campaignBudgetResourceName: string;
  currentDailyBudgetVnd?: number;
};

@Injectable()
export class GoogleAdsErpActionPlanService {
  constructor(
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly actionPlanModel: Model<GoogleAdsActionPlanDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly campaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly campaignBudgetModel: Model<GoogleAdsCampaignBudgetDocument>,
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly adGroupModel: Model<GoogleAdsAdGroupDocument>,
    @InjectModel(GoogleAdsKeyword.name)
    private readonly keywordModel: Model<GoogleAdsKeywordDocument>,
    @InjectModel(GoogleAdsAd.name)
    private readonly adModel: Model<GoogleAdsAdDocument>,
    @InjectModel(AdsManagerAccount.name)
    private readonly managerAccountModel: Model<AdsManagerAccountDocument>,
    @Optional()
    @InjectModel(GoogleAdsCampaignCriterion.name)
    private readonly campaignCriterionModel?: Model<GoogleAdsCampaignCriterionDocument>,
    @Optional()
    private readonly conversionReadinessService?: GoogleAdsConversionReadinessService,
  ) {}

  async createPlan(
    dto: CreateGoogleAdsActionPlanDto,
    createdByUserId: string,
    source: 'erp_ui' | 'erp_automation' = 'erp_ui',
    automationEvidence?: {
      snapshotId: string;
      snapshotHash: string;
      capturedAt: string;
    },
  ) {
    this.assertOnlyKeys(dto, PLAN_FIELDS, 'plan');
    const planName = this.requiredText(dto?.planName, 'planName', 200);
    const actorId = this.requiredText(createdByUserId, 'createdByUserId', 200);
    const evidenceProvenance = automationEvidence
      ? {
        snapshotId: this.requiredText(
          automationEvidence.snapshotId,
          'automationEvidence.snapshotId',
          200,
        ),
        snapshotHash: this.sha256(
          automationEvidence.snapshotHash,
          'automationEvidence.snapshotHash',
        ),
        capturedAt: this.isoDateTime(
          automationEvidence.capturedAt,
          'automationEvidence.capturedAt',
        ),
      }
      : undefined;
    if (evidenceProvenance && source !== 'erp_automation') {
      throw new BadRequestException(
        'automationEvidence is allowed only for erp_automation plans.',
      );
    }
    if (!Array.isArray(dto?.actions) || dto.actions.length < 1 || dto.actions.length > 50) {
      throw new BadRequestException('actions must contain between 1 and 50 items.');
    }

    const accountDocuments: any[] = await this.adAccountModel
      .find({ accountType: 'google', isActive: true })
      .lean();
    const accounts = new Map<string, CanonicalAccount>();
    for (const account of accountDocuments || []) {
      const customerId = this.numericId(account?.accountId, 'accountId', false);
      if (customerId) accounts.set(customerId, account);
    }
    const managerAccounts: any[] = await this.managerAccountModel.find({
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      isActive: true,
    }).lean();

    const planId = `GADS-PLAN-${randomUUID()}`;
    const items: Array<Record<string, any>> = [];
    for (let index = 0; index < dto.actions.length; index += 1) {
      const input = dto.actions[index];
      this.assertOnlyKeys(input, ACTION_FIELDS, `actions[${index}]`);
      this.assertOnlyKeys(input?.payload, PAYLOAD_FIELDS, `actions[${index}].payload`);
      const builtItems = await this.buildItems(
        planId,
        input,
        accounts,
        managerAccounts,
        index,
      );
      if (source === 'erp_automation') {
        for (const item of builtItems) {
          item.evidence = { ...(item.evidence || {}), source };
          item.dataQuality = 'erp_automation_policy+canonical_lookup';
        }
      }
      items.push(...builtItems);
    }

    const idempotencyKeys = items.map((item) => item.idempotencyKey);
    if (new Set(idempotencyKeys).size !== idempotencyKeys.length) {
      throw new BadRequestException('idempotencyKey values must be unique within a plan.');
    }

    try {
      const created = await this.actionPlanModel.create({
        planId,
        planName,
        createdByUserId: actorId,
        sourceExportId: `ERP-${planId}`,
        schemaVersion: '2.0',
        targetProvider: 'google',
        currency: 'VND',
        timezone: 'Asia/Ho_Chi_Minh',
        executionMode: 'pending_approval',
        status: 'pending_approval',
        providerValidationStatus: 'pending',
        providerValidationErrors: [],
        analysisSummary: {
          planName,
          source,
          requestedActions: dto.actions.length,
          generatedActions: items.length,
          ...(evidenceProvenance
            ? { automationEvidence: evidenceProvenance }
            : {}),
        },
        items,
        actionIds: items.map((item) => item.actionId),
        idempotencyKeys,
        manifest: {
          schemaVersion: '2.0',
          planId,
          source,
          generatedBy: 'erp',
          ...(evidenceProvenance
            ? { automationEvidence: evidenceProvenance }
            : {}),
        },
        source,
      });
      return { success: true, plan: this.toPublicPlan(created) };
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Google Ads action plan or idempotencyKey already exists.');
      }
      throw error;
    }
  }

  private async buildItems(
    planId: string,
    input: CreateGoogleAdsActionDto,
    accounts: Map<string, CanonicalAccount>,
    managerAccounts: any[],
    requestIndex: number,
  ): Promise<Array<Record<string, any>>> {
    if (!GOOGLE_ADS_ERP_ACTION_TYPES.includes(input?.actionType as any)) {
      throw new BadRequestException('Unsupported Google Ads ERP actionType.');
    }
    const customerId = this.numericId(input?.customerId, 'customerId');
    const account = accounts.get(customerId);
    if (!account) {
      throw new BadRequestException('customerId is not an active canonical Google Ads account.');
    }
    this.assertAccountContract(account);
    this.assertCanonicalFreshness(account, 'Google Ads account');
    const loginCustomerId = this.derivedLoginCustomerId(account);
    let credentialReferenceId: string | undefined;
    if (loginCustomerId) {
      const manager = googleAdsManagerByLoginCustomerId(managerAccounts, loginCustomerId);
      const blockers = googleAdsMccReadinessBlockers(manager, customerId);
      if (blockers.length) {
        throw new BadRequestException(
          `Google Ads MCC readiness blocked this action: ${blockers.join(', ')}.`,
        );
      }
      credentialReferenceId = this.managerCredentialReference(manager);
    }
    const reason = this.requiredText(input?.reason, 'reason', 500);
    const payload = input?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('action.payload is required.');
    }

    if (input.actionType === 'create_search_campaign') {
      if (input.campaignId) {
        throw new BadRequestException('create_search_campaign must not include campaignId.');
      }
      const typedPayload = this.createPayload(payload as any);
      return [this.item(planId, input, requestIndex, {
        actionType: 'create_search_campaign',
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign',
        operation: 'create',
        typedPayload,
        reason,
        risk: 'high',
      })];
    }

    const campaignId = this.numericId(input.campaignId, 'campaignId');
    const campaign: any = await this.campaignModel
      .findOne({ customerId, campaignId })
      .lean();
    this.assertSearchCampaign(campaign);
    this.assertCanonicalFreshness(campaign, 'Google Search campaign');

    if (input.actionType === 'update_campaign_bidding_strategy') {
      this.assertAllowedPayloadKeys(
        payload,
        ['biddingStrategyType', 'maxCpcBidCeilingVnd', 'targetCpaVnd'],
        input.actionType,
      );
      if (String(campaign.biddingStrategyResourceName || '').trim()) {
        throw new BadRequestException(
          'Portfolio bidding strategies are not mutable through campaign lifecycle automation.',
        );
      }
      const biddingStrategyType = String((payload as any).biddingStrategyType || '').toUpperCase();
      if (!['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS'].includes(biddingStrategyType)) {
        throw new BadRequestException(
          'Campaign bidding updates support MAXIMIZE_CLICKS or MAXIMIZE_CONVERSIONS only.',
        );
      }
      if (biddingStrategyType === 'MAXIMIZE_CLICKS' && (payload as any).targetCpaVnd !== undefined) {
        throw new BadRequestException('targetCpaVnd is only valid for MAXIMIZE_CONVERSIONS.');
      }
      if (biddingStrategyType === 'MAXIMIZE_CONVERSIONS'
        && (payload as any).maxCpcBidCeilingVnd !== undefined) {
        throw new BadRequestException('maxCpcBidCeilingVnd is only valid for MAXIMIZE_CLICKS.');
      }
      const maxCpcBidCeilingMicros = (payload as any).maxCpcBidCeilingVnd === undefined
        ? undefined
        : this.positiveMoneyMicros(
          (payload as any).maxCpcBidCeilingVnd,
          'payload.maxCpcBidCeilingVnd',
          this.positiveEnv('GOOGLE_ADS_MAX_CPC_BID_VND', 1_000_000),
        );
      const targetCpaMicros = (payload as any).targetCpaVnd === undefined
        ? undefined
        : this.positiveMoneyMicros(
          (payload as any).targetCpaVnd,
          'payload.targetCpaVnd',
          this.positiveEnv('GOOGLE_ADS_MAX_TARGET_CPA_VND', 100_000_000),
        );
      const currentType = String(campaign.biddingStrategyType || '').toUpperCase();
      const currentTarget = biddingStrategyType === 'MAXIMIZE_CLICKS'
        ? Number(campaign.targetSpendCpcBidCeilingMicros || 0)
        : Number(campaign.maximizeConversionsTargetCpaMicros || 0);
      const requestedTarget = maxCpcBidCeilingMicros ?? targetCpaMicros ?? 0;
      if (currentType === biddingStrategyType && currentTarget === requestedTarget) {
        throw new BadRequestException('Requested bidding strategy already matches canonical state.');
      }
      return [this.item(planId, input, requestIndex, {
        actionType: input.actionType,
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign',
        operation: 'update',
        typedPayload: {
          campaignId,
          campaignResourceName: this.campaignResourceName(
            customerId,
            campaignId,
            campaign.resourceName,
          ),
          biddingStrategyType,
          biddingLifecycleStage: biddingStrategyType === 'MAXIMIZE_CLICKS'
            ? (maxCpcBidCeilingMicros === undefined
              ? 'MAXIMIZE_CLICKS'
              : 'MAXIMIZE_CLICKS_CPC_CEILING')
            : (targetCpaMicros === undefined
              ? 'MAXIMIZE_CONVERSIONS'
              : 'MAXIMIZE_CONVERSIONS_TARGET_CPA'),
          ...((payload as any).maxCpcBidCeilingVnd === undefined
            ? {}
            : {
              maxCpcBidCeilingVnd: Number(
                (payload as any).maxCpcBidCeilingVnd,
              ),
            }),
          ...((payload as any).targetCpaVnd === undefined
            ? {}
            : { targetCpaVnd: Number((payload as any).targetCpaVnd) }),
          ...(maxCpcBidCeilingMicros === undefined ? {} : { maxCpcBidCeilingMicros }),
          ...(targetCpaMicros === undefined ? {} : { targetCpaMicros }),
        },
        reason,
        risk: 'high',
      })];
    }

    if (input.actionType === 'resume_campaign') {
      if (Object.keys(payload).length) {
        throw new BadRequestException('resume_campaign payload must be empty.');
      }
      await this.assertCampaignActivationReady(account, customerId, campaignId, campaign);
      return [this.item(planId, input, requestIndex, {
        actionType: input.actionType,
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign',
        operation: 'resume',
        typedPayload: {
          campaignId,
          campaignResourceName: this.campaignResourceName(customerId, campaignId, campaign.resourceName),
        },
        reason,
        risk: 'high',
      })];
    }

    if (input.actionType === 'create_ad_group') {
      this.assertAllowedPayloadKeys(payload, ['adGroupName', 'cpcBidVnd'], input.actionType);
      const adGroupName = this.requiredText((payload as any).adGroupName, 'payload.adGroupName', 255);
      const cpcBidMicros = (payload as any).cpcBidVnd === undefined
        ? undefined
        : this.bidMicros((payload as any).cpcBidVnd);
      if (cpcBidMicros !== undefined) this.assertManualCpc(campaign);
      return [this.item(planId, input, requestIndex, {
        actionType: input.actionType,
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'ad_group',
        operation: 'create',
        typedPayload: {
          campaignId,
          campaignResourceName: this.campaignResourceName(customerId, campaignId, campaign.resourceName),
          adGroupName,
          status: 'PAUSED',
          type: 'SEARCH_STANDARD',
          ...(cpcBidMicros === undefined ? {} : { cpcBidMicros }),
        },
        reason,
        risk: 'medium',
      })];
    }

    if (['update_ad_group', 'pause_ad_group', 'resume_ad_group'].includes(input.actionType)) {
      const adGroupId = this.numericId(input.adGroupId, 'adGroupId');
      const adGroup = await this.canonicalAdGroup(customerId, campaignId, adGroupId);
      if (input.actionType === 'pause_ad_group') {
        if (Object.keys(payload).length) {
          throw new BadRequestException('pause_ad_group payload must be empty.');
        }
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'ad_group',
          operation: 'update',
          typedPayload: {
            campaignId,
            adGroupId,
            adGroupResourceName: this.adGroupResourceName(customerId, adGroupId, adGroup.resourceName),
          },
          reason,
          risk: 'low',
        })];
      }
      if (input.actionType === 'resume_ad_group') {
        if (Object.keys(payload).length) {
          throw new BadRequestException('resume_ad_group payload must be empty.');
        }
        this.assertPausedParentCampaign(campaign);
        this.assertPausedCanonical(adGroup, 'Ad group');
        await this.assertAdGroupDeliveryReady(customerId, campaignId, adGroupId);
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'ad_group',
          operation: 'resume',
          typedPayload: {
            campaignId,
            adGroupId,
            adGroupResourceName: this.adGroupResourceName(customerId, adGroupId, adGroup.resourceName),
          },
          reason,
          risk: 'high',
        })];
      }
      this.assertAllowedPayloadKeys(payload, ['adGroupName', 'cpcBidVnd'], input.actionType);
      const adGroupName = (payload as any).adGroupName === undefined
        ? undefined
        : this.requiredText((payload as any).adGroupName, 'payload.adGroupName', 255);
      const cpcBidMicros = (payload as any).cpcBidVnd === undefined
        ? undefined
        : this.bidMicros((payload as any).cpcBidVnd);
      if (cpcBidMicros !== undefined) {
        this.assertManualCpc(campaign);
        this.assertBidIncrease(cpcBidMicros, adGroup.cpcBidMicros, 'ad group');
      }
      if (adGroupName === undefined && cpcBidMicros === undefined) {
        throw new BadRequestException('update_ad_group requires adGroupName and/or cpcBidVnd.');
      }
      return [this.item(planId, input, requestIndex, {
        actionType: input.actionType,
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'ad_group',
        operation: 'update',
        typedPayload: {
          campaignId,
          adGroupId,
          adGroupResourceName: this.adGroupResourceName(customerId, adGroupId, adGroup.resourceName),
          ...(adGroupName === undefined ? {} : { adGroupName }),
          ...(cpcBidMicros === undefined ? {} : { cpcBidMicros }),
        },
        reason,
        risk: cpcBidMicros !== undefined && cpcBidMicros > Number(adGroup.cpcBidMicros || 0)
          ? 'high'
          : 'medium',
      })];
    }

    if (['create_keyword', 'update_keyword', 'pause_keyword', 'resume_keyword'].includes(input.actionType)) {
      const adGroupId = this.numericId(input.adGroupId, 'adGroupId');
      await this.canonicalAdGroup(customerId, campaignId, adGroupId);
      if (input.actionType === 'create_keyword') {
        this.assertAllowedPayloadKeys(
          payload,
          ['keywordText', 'matchType', 'negative', 'cpcBidVnd', 'finalUrl'],
          input.actionType,
        );
        const negative = (payload as any).negative === true;
        if (negative) {
          throw new BadRequestException(
            'Negative keyword creation is disabled because negative criteria cannot be safely updated, paused, or deleted in this ERP phase.',
          );
        }
        const matchType = String((payload as any).matchType || '').toUpperCase();
        if (!GOOGLE_ADS_KEYWORD_MATCH_TYPES.includes(matchType as any)) {
          throw new BadRequestException('payload.matchType must be EXACT, PHRASE, or BROAD.');
        }
        const keywordText = this.keywordText((payload as any).keywordText);
        if (negative && ((payload as any).cpcBidVnd !== undefined || (payload as any).finalUrl !== undefined)) {
          throw new BadRequestException('Negative keywords cannot configure a bid or final URL.');
        }
        const cpcBidMicros = (payload as any).cpcBidVnd === undefined
          ? undefined
          : this.bidMicros((payload as any).cpcBidVnd);
        if (cpcBidMicros !== undefined) this.assertManualCpc(campaign);
        const finalUrl = (payload as any).finalUrl === undefined
          ? undefined
          : this.httpsUrl((payload as any).finalUrl, 'payload.finalUrl');
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'keyword',
          operation: 'create',
          typedPayload: {
            campaignId,
            adGroupId,
            keywordText,
            matchType,
            negative,
            status: 'PAUSED',
            ...(cpcBidMicros === undefined ? {} : { cpcBidMicros }),
            ...(finalUrl === undefined ? {} : { finalUrl }),
          },
          reason,
          risk: negative ? 'low' : 'medium',
        })];
      }
      const criterionId = this.numericId(input.criterionId, 'criterionId');
      const keyword = await this.canonicalKeyword(customerId, campaignId, adGroupId, criterionId);
      if (keyword.negative === true) {
        throw new BadRequestException(
          'Google Ads does not allow updating negative ad-group criteria; delete is intentionally unsupported.',
        );
      }
      if (input.actionType === 'resume_keyword') {
        if (Object.keys(payload).length) {
          throw new BadRequestException('resume_keyword payload must be empty.');
        }
        this.assertPausedParentCampaign(campaign);
        this.assertPausedCanonical(keyword, 'Keyword');
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'keyword',
          operation: 'resume',
          typedPayload: {
            campaignId,
            adGroupId,
            criterionId,
            criterionResourceName: this.criterionResourceName(
              customerId,
              adGroupId,
              criterionId,
              keyword.resourceName,
            ),
          },
          reason,
          risk: 'high',
        })];
      }
      if (input.actionType === 'pause_keyword') {
        if (Object.keys(payload).length) {
          throw new BadRequestException('pause_keyword payload must be empty.');
        }
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'keyword',
          operation: 'update',
          typedPayload: {
            campaignId,
            adGroupId,
            criterionId,
            criterionResourceName: this.criterionResourceName(
              customerId,
              adGroupId,
              criterionId,
              keyword.resourceName,
            ),
          },
          reason,
          risk: 'low',
        })];
      }
      this.assertAllowedPayloadKeys(payload, ['cpcBidVnd', 'finalUrl'], input.actionType);
      const cpcBidMicros = (payload as any).cpcBidVnd === undefined
        ? undefined
        : this.bidMicros((payload as any).cpcBidVnd);
      if (cpcBidMicros !== undefined) {
        this.assertManualCpc(campaign);
        this.assertBidIncrease(cpcBidMicros, keyword.cpcBidMicros, 'keyword');
      }
      const finalUrl = (payload as any).finalUrl === undefined
        ? undefined
        : this.httpsUrl((payload as any).finalUrl, 'payload.finalUrl');
      if (cpcBidMicros === undefined && finalUrl === undefined) {
        throw new BadRequestException('update_keyword requires cpcBidVnd and/or finalUrl.');
      }
      return [this.item(planId, input, requestIndex, {
        actionType: input.actionType,
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'keyword',
        operation: 'update',
        typedPayload: {
          campaignId,
          adGroupId,
          criterionId,
          criterionResourceName: this.criterionResourceName(
            customerId,
            adGroupId,
            criterionId,
            keyword.resourceName,
          ),
          ...(cpcBidMicros === undefined ? {} : { cpcBidMicros }),
          ...(finalUrl === undefined ? {} : { finalUrl }),
        },
        reason,
        risk: cpcBidMicros !== undefined ? 'medium' : 'low',
      })];
    }

    if (['create_responsive_search_ad', 'update_responsive_search_ad', 'pause_responsive_search_ad', 'resume_responsive_search_ad']
      .includes(input.actionType)) {
      const adGroupId = this.numericId(input.adGroupId, 'adGroupId');
      await this.canonicalAdGroup(customerId, campaignId, adGroupId);
      if (input.actionType === 'create_responsive_search_ad') {
        const typedPayload = this.rsaPayload(payload as any, true);
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'ad',
          operation: 'create',
          typedPayload: {
            campaignId,
            adGroupId,
            status: 'PAUSED',
            ...typedPayload,
          },
          reason,
          risk: 'medium',
        })];
      }
      const adId = this.numericId(input.adId, 'adId');
      const ad = await this.canonicalResponsiveSearchAd(
        customerId,
        campaignId,
        adGroupId,
        adId,
      );
      if (input.actionType === 'resume_responsive_search_ad') {
        if (Object.keys(payload).length) {
          throw new BadRequestException('resume_responsive_search_ad payload must be empty.');
        }
        this.assertPausedParentCampaign(campaign);
        this.assertPausedCanonical(ad, 'Responsive Search Ad');
        this.assertPolicyApprovedAd(ad);
        this.assertAdDestinations(ad);
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'ad',
          operation: 'resume',
          typedPayload: {
            campaignId,
            adGroupId,
            adId,
            adGroupAdResourceName: this.adGroupAdResourceName(
              customerId,
              adGroupId,
              adId,
              ad.resourceName,
            ),
          },
          reason,
          risk: 'high',
        })];
      }
      if (input.actionType === 'pause_responsive_search_ad') {
        if (Object.keys(payload).length) {
          throw new BadRequestException('pause_responsive_search_ad payload must be empty.');
        }
        return [this.item(planId, input, requestIndex, {
          actionType: input.actionType,
          customerId,
          loginCustomerId,
          credentialReferenceId,
          resourceType: 'ad',
          operation: 'update',
          typedPayload: {
            campaignId,
            adGroupId,
            adId,
            adGroupAdResourceName: this.adGroupAdResourceName(
              customerId,
              adGroupId,
              adId,
              ad.resourceName,
            ),
          },
          reason,
          risk: 'low',
        })];
      }
      const typedPayload = this.rsaPayload(payload as any, false);
      return [this.item(planId, input, requestIndex, {
        actionType: input.actionType,
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'ad',
        operation: 'update',
        typedPayload: { campaignId, adGroupId, adId, ...typedPayload },
        reason,
        risk: 'medium',
      })];
    }

    if (input.actionType === 'pause_campaign') {
      if (Object.keys(payload).length) {
        throw new BadRequestException('pause_campaign payload must be empty.');
      }
      return [this.item(planId, input, requestIndex, {
        actionType: 'pause_campaign',
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign',
        operation: 'update',
        typedPayload: {
          campaignId,
          campaignResourceName: this.campaignResourceName(customerId, campaignId, campaign.resourceName),
        },
        reason,
        risk: 'low',
      })];
    }

    if (input.actionType === 'update_campaign_budget') {
      this.assertAllowedPayloadKeys(payload, ['dailyBudgetVnd'], 'update_campaign_budget');
      const dailyBudget = this.dailyBudget((payload as any).dailyBudgetVnd);
      const budget = await this.resolveBudgetReference(customerId, campaign);
      this.assertBudgetCreationPolicy(dailyBudget);
      return [this.item(planId, input, requestIndex, {
        actionType: 'update_campaign_budget',
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign_budget',
        operation: 'update',
        typedPayload: {
          campaignId,
          campaignBudgetId: budget.campaignBudgetId,
          campaignBudgetResourceName: budget.campaignBudgetResourceName,
          dailyBudget,
        },
        reason,
        risk: dailyBudget > Number(budget.currentDailyBudgetVnd || 0) ? 'high' : 'medium',
      })];
    }

    this.assertAllowedPayloadKeys(
      payload,
      ['campaignName', 'endDate', 'dailyBudgetVnd'],
      'update_search_campaign',
    );
    const campaignName = (payload as any).campaignName === undefined
      ? undefined
      : this.requiredText((payload as any).campaignName, 'payload.campaignName', 128);
    const endDate = (payload as any).endDate === undefined
      ? undefined
      : this.safeUpdateEndDate((payload as any).endDate, campaign);
    const requestedBudget = (payload as any).dailyBudgetVnd === undefined
      ? undefined
      : this.dailyBudget((payload as any).dailyBudgetVnd);
    if (campaignName === undefined && endDate === undefined && requestedBudget === undefined) {
      throw new BadRequestException(
        'update_search_campaign requires campaignName, endDate, and/or dailyBudgetVnd.',
      );
    }

    const split = requestedBudget !== undefined
      && (campaignName !== undefined || endDate !== undefined);
    const items: Array<Record<string, any>> = [];
    if (campaignName !== undefined || endDate !== undefined) {
      items.push(this.item(planId, input, requestIndex, {
        actionType: 'update_search_campaign',
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign',
        operation: 'update',
        typedPayload: {
          campaignId,
          campaignResourceName: this.campaignResourceName(customerId, campaignId, campaign.resourceName),
          ...(campaignName === undefined ? {} : { campaignName }),
          ...(endDate === undefined ? {} : { endDate }),
        },
        reason,
        risk: 'medium',
        idempotencySuffix: split ? 'campaign' : undefined,
      }));
    }
    if (requestedBudget !== undefined) {
      const budget = await this.resolveBudgetReference(customerId, campaign);
      this.assertBudgetCreationPolicy(requestedBudget);
      items.push(this.item(planId, input, requestIndex, {
        actionType: 'update_campaign_budget',
        customerId,
        loginCustomerId,
        credentialReferenceId,
        resourceType: 'campaign_budget',
        operation: 'update',
        typedPayload: {
          campaignId,
          campaignBudgetId: budget.campaignBudgetId,
          campaignBudgetResourceName: budget.campaignBudgetResourceName,
          dailyBudget: requestedBudget,
        },
        reason,
        risk: requestedBudget > Number(budget.currentDailyBudgetVnd || 0) ? 'high' : 'medium',
        idempotencySuffix: split ? 'budget' : undefined,
      }));
    }
    return items;
  }

  private createPayload(payload: Record<string, any>) {
    this.assertAllowedPayloadKeys(payload, [
      'campaignName',
      'budgetName',
      'dailyBudgetVnd',
      'biddingStrategyType',
      'maxCpcBidCeilingVnd',
      'targetCpaVnd',
      'startDate',
      'endDate',
      'searchPartnersEnabled',
      'positiveGeoTargetType',
      'geoTargetConstantIds',
      'languageConstantIds',
      'doesNotContainEuPoliticalAdvertising',
    ], 'create_search_campaign');
    const campaignName = this.requiredText(payload.campaignName, 'payload.campaignName', 128);
    const dailyBudget = this.dailyBudget(payload.dailyBudgetVnd);
    const biddingStrategyType = payload.biddingStrategyType || 'MAXIMIZE_CLICKS';
    if (!GOOGLE_ADS_BIDDING_STRATEGIES.includes(biddingStrategyType)) {
      throw new BadRequestException('Unsupported biddingStrategyType.');
    }
    const startDate = this.safeDate(payload.startDate, 'payload.startDate');
    const endDate = payload.endDate === undefined
      ? undefined
      : this.safeDate(payload.endDate, 'payload.endDate');
    const today = this.today();
    if (startDate < today) {
      throw new BadRequestException('payload.startDate cannot be in the past.');
    }
    if (endDate && endDate < startDate) {
      throw new BadRequestException('payload.endDate cannot be before payload.startDate.');
    }
    const geoTargetConstantIds = this.numericIdArray(
      payload.geoTargetConstantIds,
      'payload.geoTargetConstantIds',
      50,
    );
    const languageConstantIds = this.numericIdArray(
      payload.languageConstantIds,
      'payload.languageConstantIds',
      20,
    );
    const positiveGeoTargetType = payload.positiveGeoTargetType || 'PRESENCE';
    if (!GOOGLE_ADS_POSITIVE_GEO_TARGET_TYPES.includes(positiveGeoTargetType)) {
      throw new BadRequestException('Unsupported positiveGeoTargetType.');
    }
    if (payload.doesNotContainEuPoliticalAdvertising !== true) {
      throw new BadRequestException(
        'create_search_campaign requires doesNotContainEuPoliticalAdvertising=true.',
      );
    }
    this.assertBudgetCreationPolicy(dailyBudget);
    if (biddingStrategyType === 'MAXIMIZE_CLICKS' && payload.targetCpaVnd !== undefined) {
      throw new BadRequestException('payload.targetCpaVnd is only valid for MAXIMIZE_CONVERSIONS.');
    }
    if (biddingStrategyType === 'MAXIMIZE_CONVERSIONS'
      && payload.maxCpcBidCeilingVnd !== undefined) {
      throw new BadRequestException(
        'payload.maxCpcBidCeilingVnd is only valid for MAXIMIZE_CLICKS.',
      );
    }
    if (!['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS'].includes(biddingStrategyType)
      && (payload.maxCpcBidCeilingVnd !== undefined || payload.targetCpaVnd !== undefined)) {
      throw new BadRequestException('Bidding targets do not apply to the selected strategy.');
    }
    const maxCpcBidCeilingMicros = payload.maxCpcBidCeilingVnd === undefined
      ? undefined
      : this.positiveMoneyMicros(
        payload.maxCpcBidCeilingVnd,
        'payload.maxCpcBidCeilingVnd',
        this.positiveEnv('GOOGLE_ADS_MAX_CPC_BID_VND', 1_000_000),
      );
    const targetCpaMicros = payload.targetCpaVnd === undefined
      ? undefined
      : this.positiveMoneyMicros(
        payload.targetCpaVnd,
        'payload.targetCpaVnd',
        this.positiveEnv('GOOGLE_ADS_MAX_TARGET_CPA_VND', 100_000_000),
      );
    return {
      campaignName,
      budgetName: payload.budgetName === undefined
        ? `${campaignName} - Daily Budget`
        : this.requiredText(payload.budgetName, 'payload.budgetName', 255),
      dailyBudget,
      biddingStrategyType,
      ...(maxCpcBidCeilingMicros === undefined ? {} : { maxCpcBidCeilingMicros }),
      ...(targetCpaMicros === undefined ? {} : { targetCpaMicros }),
      startDate,
      ...(endDate ? { endDate } : {}),
      advertisingChannelType: 'SEARCH',
      status: 'PAUSED',
      searchPartnersEnabled: payload.searchPartnersEnabled === true,
      positiveGeoTargetType,
      geoTargetConstantIds,
      languageConstantIds,
      doesNotContainEuPoliticalAdvertising: true,
    };
  }

  private item(
    planId: string,
    input: CreateGoogleAdsActionDto,
    requestIndex: number,
    data: {
      actionType: string;
      customerId: string;
      loginCustomerId?: string;
      credentialReferenceId?: string;
      resourceType: string;
      operation: string;
      typedPayload: Record<string, any>;
      reason: string;
      risk: 'low' | 'medium' | 'high';
      idempotencySuffix?: string;
    },
  ) {
    const actionId = `GADS-ACT-${randomUUID()}`;
    const baseIdempotencyKey = input.idempotencyKey
      ? this.requiredIdempotencyKey(input.idempotencyKey)
      : `${planId}:${actionId}`;
    return {
      actionId,
      idempotencyKey: data.idempotencySuffix
        ? `${baseIdempotencyKey}:${data.idempotencySuffix}`
        : baseIdempotencyKey,
      provider: 'google',
      actionType: data.actionType,
      customerId: data.customerId,
      ...(data.loginCustomerId ? { loginCustomerId: data.loginCustomerId } : {}),
      ...(data.credentialReferenceId ? { credentialReferenceId: data.credentialReferenceId } : {}),
      resourceType: data.resourceType,
      operation: data.operation,
      typedPayload: data.typedPayload,
      reason: data.reason,
      evidence: { source: 'erp_ui', requestActionIndex: requestIndex },
      confidence: 1,
      risk: data.risk,
      dataQuality: 'erp_user_input+canonical_lookup',
      approvalRequired: true,
      rollbackIf: [],
      status: 'pending',
      providerValidationStatus: 'pending',
      providerValidationErrors: [],
      requireExecutionConfirmation: true,
    };
  }

  private async canonicalAdGroup(
    customerId: string,
    campaignId: string,
    adGroupId: string,
  ): Promise<any> {
    const adGroup: any = await this.adGroupModel
      .findOne({ customerId, campaignId, adGroupId })
      .lean();
    if (!adGroup) {
      throw new BadRequestException('Ad group is not present in canonical synced ERP data.');
    }
    if (String(adGroup.type || '').toUpperCase() !== 'SEARCH_STANDARD') {
      throw new BadRequestException('ERP-native mutations only support SEARCH_STANDARD ad groups.');
    }
    this.adGroupResourceName(customerId, adGroupId, adGroup.resourceName);
    this.assertCanonicalFreshness(adGroup, 'Google Search ad group');
    return adGroup;
  }

  private async canonicalKeyword(
    customerId: string,
    campaignId: string,
    adGroupId: string,
    criterionId: string,
  ): Promise<any> {
    const keyword: any = await this.keywordModel
      .findOne({ customerId, campaignId, adGroupId, criterionId })
      .lean();
    if (!keyword) {
      throw new BadRequestException('Keyword is not present in canonical synced ERP data.');
    }
    this.criterionResourceName(customerId, adGroupId, criterionId, keyword.resourceName);
    this.assertCanonicalFreshness(keyword, 'Google Search keyword');
    return keyword;
  }

  private async canonicalResponsiveSearchAd(
    customerId: string,
    campaignId: string,
    adGroupId: string,
    adId: string,
  ): Promise<any> {
    const ad: any = await this.adModel
      .findOne({ customerId, campaignId, adGroupId, adId })
      .lean();
    if (!ad) {
      throw new BadRequestException('Responsive Search Ad is not present in canonical synced ERP data.');
    }
    if (String(ad.adType || '').toUpperCase() !== 'RESPONSIVE_SEARCH_AD') {
      throw new BadRequestException('ERP-native mutations only support Responsive Search Ads.');
    }
    this.adGroupAdResourceName(customerId, adGroupId, adId, ad.resourceName);
    this.assertCanonicalFreshness(ad, 'Responsive Search Ad');
    return ad;
  }

  private assertPausedParentCampaign(campaign: any) {
    if (String(campaign?.status || '').toUpperCase() !== 'PAUSED') {
      throw new BadRequestException('Child resources may only resume while the canonical campaign is PAUSED.');
    }
  }

  private assertPausedCanonical(value: any, label: string) {
    if (String(value?.status || '').toUpperCase() !== 'PAUSED') {
      throw new BadRequestException(`${label} must be canonically PAUSED before resume.`);
    }
  }

  private assertPolicyApprovedAd(ad: any) {
    if (String(ad?.policyApprovalStatus || '').toUpperCase() !== 'APPROVED') {
      throw new BadRequestException('Responsive Search Ad must be policy APPROVED before resume.');
    }
  }

  private assertAdDestinations(ad: any) {
    const urls = Array.isArray(ad?.finalUrls) ? ad.finalUrls : [];
    if (!urls.length) throw new BadRequestException('RSA canonical final URL is required for activation.');
    const allowlist = [
      process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST,
      process.env.AI_MARKETING_LANDING_PAGE_ALLOWLIST,
    ].flatMap((entry) => String(entry || '').split(','))
      .map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    if (!allowlist.length) throw new BadRequestException('Landing page allowlist is empty.');
    for (const raw of urls) {
      const parsed = new URL(this.httpsUrl(raw, 'canonical RSA final URL'));
      const host = parsed.hostname.toLowerCase();
      if (!allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        throw new BadRequestException('RSA canonical final URL is not allowlisted.');
      }
    }
    if (ad?.trackingUrlTemplate) {
      const template = this.requiredText(ad.trackingUrlTemplate, 'canonical trackingUrlTemplate', 2048);
      this.assertNoSecretLikeData(template, 'canonical trackingUrlTemplate');
      this.assertTrackingTemplateHost(template);
    }
    if (ad?.finalUrlSuffix) {
      const suffix = this.requiredText(ad.finalUrlSuffix, 'canonical finalUrlSuffix', 2048);
      if (/^[?#]/.test(suffix) || suffix.includes('://') || suffix.includes('#')
        || suffix.split('&').some((part) => !part || !part.includes('='))) {
        throw new BadRequestException('Canonical RSA finalUrlSuffix is unsafe.');
      }
      this.assertNoSecretLikeData(suffix, 'canonical finalUrlSuffix');
    }
  }

  private async assertAdGroupDeliveryReady(
    customerId: string,
    campaignId: string,
    adGroupId: string,
  ) {
    const [keyword, ad]: any[] = await Promise.all([
      this.keywordModel.findOne({
        customerId,
        campaignId,
        adGroupId,
        negative: false,
        status: 'ENABLED',
      }).lean(),
      this.adModel.findOne({
        customerId,
        campaignId,
        adGroupId,
        adType: 'RESPONSIVE_SEARCH_AD',
        status: 'ENABLED',
        policyApprovalStatus: 'APPROVED',
      }).lean(),
    ]);
    if (!keyword || !ad) {
      throw new BadRequestException(
        'Ad group activation requires an ENABLED positive keyword and an ENABLED policy-approved RSA.',
      );
    }
    this.assertCanonicalFreshness(keyword, 'Enabled keyword');
    this.assertCanonicalFreshness(ad, 'Enabled Responsive Search Ad');
    this.assertAdDestinations(ad);
  }

  private async assertCampaignActivationReady(
    account: CanonicalAccount,
    customerId: string,
    campaignId: string,
    campaign: any,
  ) {
    this.assertPausedCanonical(campaign, 'Campaign');
    if (campaign.targetGoogleSearch !== true
      || campaign.targetContentNetwork !== false
      || campaign.targetPartnerSearchNetwork !== false) {
      throw new BadRequestException('Search campaign network invariants are not canonically confirmed.');
    }
    await this.assertCampaignTargetingEvidence(customerId, campaignId);
    const adGroups: any[] = await this.adGroupModel.find({
      customerId,
      campaignId,
      type: 'SEARCH_STANDARD',
      status: 'ENABLED',
    }).lean();
    if (!Array.isArray(adGroups) || !adGroups.length) {
      throw new BadRequestException('Campaign activation requires an ENABLED SEARCH_STANDARD ad group.');
    }
    let coherent = false;
    for (const adGroup of adGroups) {
      try {
        this.assertCanonicalFreshness(adGroup, 'Enabled Search ad group');
        await this.assertAdGroupDeliveryReady(customerId, campaignId, String(adGroup.adGroupId));
        coherent = true;
        break;
      } catch {
        // Continue checking other enabled ad groups; at least one graph must be coherent.
      }
    }
    if (!coherent) {
      throw new BadRequestException(
        'Campaign activation has no coherent enabled ad group, positive keyword, and policy-approved RSA graph.',
      );
    }
    if (['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE']
      .includes(String(campaign.biddingStrategyType || '').toUpperCase())) {
      const readiness = this.conversionReadinessService
        ? await this.conversionReadinessService.evaluate(customerId, campaignId)
        : {
          ready: false,
          blockers: ['CONVERSION_READINESS_SERVICE_UNAVAILABLE'],
        };
      if (!readiness.ready) {
        throw new BadRequestException(
          `Conversion-based campaign activation is blocked until canonical primary conversion actions and biddable campaign goals are synced; readiness: ${readiness.blockers.join(', ')}.`,
        );
      }
    }
    if (!['MANUAL_CPC', 'MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS']
      .includes(String(campaign.biddingStrategyType || '').toUpperCase())) {
      throw new BadRequestException(
        'Campaign activation supports canonical MANUAL_CPC, MAXIMIZE_CLICKS, or MAXIMIZE_CONVERSIONS.',
      );
    }
  }

  private async assertCampaignTargetingEvidence(customerId: string, campaignId: string) {
    if (!this.campaignCriterionModel) {
      throw new BadRequestException('Canonical campaign targeting evidence model is unavailable.');
    }
    const [locations, languages]: any[][] = await Promise.all([
      this.campaignCriterionModel.find({
        customerId,
        campaignId,
        criterionType: 'LOCATION',
        negative: false,
        status: 'ENABLED',
      }).lean(),
      this.campaignCriterionModel.find({
        customerId,
        campaignId,
        criterionType: 'LANGUAGE',
        negative: false,
        status: 'ENABLED',
      }).lean(),
    ]);
    if (!locations.length || !languages.length) {
      throw new BadRequestException(
        'Campaign activation requires canonical positive location and language targeting evidence.',
      );
    }
    for (const criterion of [...locations, ...languages]) {
      this.assertCanonicalFreshness(criterion, 'Campaign targeting criterion');
    }
  }

  private rsaPayload(payload: Record<string, any>, create: boolean) {
    const allowed = [
      'finalUrl',
      'headlines',
      'descriptions',
      'headlinePins',
      'descriptionPins',
      'path1',
      'path2',
      'trackingUrlTemplate',
      'finalUrlSuffix',
    ];
    this.assertAllowedPayloadKeys(
      payload,
      allowed,
      create ? 'create_responsive_search_ad' : 'update_responsive_search_ad',
    );
    const result: Record<string, any> = {};
    if (payload.finalUrl !== undefined) {
      result.finalUrl = this.httpsUrl(payload.finalUrl, 'payload.finalUrl');
    }
    if (payload.headlines !== undefined) {
      if (!create && payload.headlinePins === undefined) {
        throw new BadRequestException(
          'RSA headline replacement requires headlinePins explicitly; use [] to intentionally clear pins.',
        );
      }
      result.headlines = this.textArray(payload.headlines, 'payload.headlines', 3, 15, 30);
    }
    if (payload.descriptions !== undefined) {
      if (!create && payload.descriptionPins === undefined) {
        throw new BadRequestException(
          'RSA description replacement requires descriptionPins explicitly; use [] to intentionally clear pins.',
        );
      }
      result.descriptions = this.textArray(payload.descriptions, 'payload.descriptions', 2, 4, 90);
    }
    if (payload.headlinePins !== undefined) {
      if (!result.headlines && !create) {
        throw new BadRequestException('headlinePins require headlines in the same RSA update.');
      }
      result.headlinePins = this.pinArray(
        payload.headlinePins,
        'payload.headlinePins',
        (result.headlines || payload.headlines)?.length,
        ['HEADLINE_1', 'HEADLINE_2', 'HEADLINE_3'],
      );
    }
    if (payload.descriptionPins !== undefined) {
      if (!result.descriptions && !create) {
        throw new BadRequestException('descriptionPins require descriptions in the same RSA update.');
      }
      result.descriptionPins = this.pinArray(
        payload.descriptionPins,
        'payload.descriptionPins',
        (result.descriptions || payload.descriptions)?.length,
        ['DESCRIPTION_1', 'DESCRIPTION_2'],
      );
    }
    if (payload.path1 !== undefined) {
      result.path1 = this.requiredText(payload.path1, 'payload.path1', 15);
    }
    if (payload.path2 !== undefined) {
      result.path2 = this.requiredText(payload.path2, 'payload.path2', 15);
    }
    if (payload.trackingUrlTemplate !== undefined) {
      const trackingUrlTemplate = this.requiredText(
        payload.trackingUrlTemplate,
        'payload.trackingUrlTemplate',
        2048,
      );
      if (!trackingUrlTemplate.includes('{lpurl}')) {
        throw new BadRequestException('payload.trackingUrlTemplate must contain {lpurl}.');
      }
      this.assertNoSecretLikeData(trackingUrlTemplate, 'payload.trackingUrlTemplate');
      this.assertTrackingTemplateHost(trackingUrlTemplate);
      result.trackingUrlTemplate = trackingUrlTemplate;
    }
    if (payload.finalUrlSuffix !== undefined) {
      const suffix = this.requiredText(payload.finalUrlSuffix, 'payload.finalUrlSuffix', 2048);
      if (/^[?#]/.test(suffix)) {
        throw new BadRequestException('payload.finalUrlSuffix must not start with ? or #.');
      }
      if (suffix.includes('://') || suffix.includes('#')
        || suffix.split('&').some((part) => !part || !part.includes('='))) {
        throw new BadRequestException('payload.finalUrlSuffix must be query-string key=value pairs.');
      }
      this.assertNoSecretLikeData(suffix, 'payload.finalUrlSuffix');
      result.finalUrlSuffix = suffix;
    }
    if (create) {
      for (const required of ['finalUrl', 'headlines', 'descriptions']) {
        if (result[required] === undefined) {
          throw new BadRequestException(`create_responsive_search_ad requires payload.${required}.`);
        }
      }
    } else if (!Object.keys(result).length) {
      throw new BadRequestException('update_responsive_search_ad requires at least one mutable field.');
    }
    return result;
  }

  private textArray(
    value: unknown,
    field: string,
    minimum: number,
    maximum: number,
    itemMaximum: number,
  ) {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
      throw new BadRequestException(`${field} must contain between ${minimum} and ${maximum} values.`);
    }
    const result = value.map((item, index) =>
      this.requiredText(item, `${field}[${index}]`, itemMaximum));
    if (new Set(result.map((item) => item.toLocaleLowerCase('vi'))).size !== result.length) {
      throw new BadRequestException(`${field} must not contain duplicates.`);
    }
    return result;
  }

  private pinArray(
    value: unknown,
    field: string,
    assetCount: number,
    allowedFields: string[],
  ) {
    if (!Array.isArray(value) || value.length > assetCount) {
      throw new BadRequestException(`${field} has too many pin entries.`);
    }
    const indexes = new Set<number>();
    return value.map((item: any) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)
        || Object.keys(item).some((key) => !['index', 'pinnedField'].includes(key))
        || !Number.isInteger(item.index) || item.index < 0 || item.index >= assetCount
        || indexes.has(item.index) || !allowedFields.includes(item.pinnedField)) {
        throw new BadRequestException(`${field} contains an invalid or duplicate pin.`);
      }
      indexes.add(item.index);
      return { index: item.index, pinnedField: item.pinnedField };
    });
  }

  private keywordText(value: unknown) {
    const keyword = this.requiredText(value, 'payload.keywordText', 80);
    if (keyword.split(/\s+/).length > 10) {
      throw new BadRequestException('payload.keywordText must contain at most 10 words.');
    }
    return keyword;
  }

  private bidMicros(value: unknown) {
    const amount = Number(value);
    const maximum = this.positiveEnv('GOOGLE_ADS_MAX_CPC_BID_VND', 1_000_000);
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum) {
      throw new BadRequestException('payload.cpcBidVnd must be a safe integer within the configured CPC limit.');
    }
    const micros = amount * 1_000_000;
    if (!Number.isSafeInteger(micros)) {
      throw new BadRequestException('payload.cpcBidVnd cannot be represented safely as micros.');
    }
    return micros;
  }

  private positiveMoneyMicros(value: unknown, field: string, maximumVnd: number) {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > maximumVnd) {
      throw new BadRequestException(
        `${field} must be a positive safe integer within its configured limit.`,
      );
    }
    const micros = amount * 1_000_000;
    if (!Number.isSafeInteger(micros)) {
      throw new BadRequestException(`${field} cannot be represented safely as micros.`);
    }
    return micros;
  }

  private httpsUrl(value: unknown, field: string) {
    try {
      const url = new URL(this.requiredText(value, field, 2048));
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      this.assertNoSecretLikeData(url.toString(), field);
      return url.toString();
    } catch {
      throw new BadRequestException(
        `${field} must be a valid HTTPS URL without credentials or secret-like data.`,
      );
    }
  }

  private assertTrackingTemplateHost(template: string) {
    const allowlist = [
      process.env.GOOGLE_ADS_TRACKING_DOMAIN_ALLOWLIST,
      process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST,
      process.env.AI_MARKETING_LANDING_PAGE_ALLOWLIST,
    ].flatMap((entry) => String(entry || '').split(','))
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (!allowlist.length) {
      throw new BadRequestException('Tracking domain allowlist is empty.');
    }
    try {
      const url = new URL(template.replace(/\{[^{}]+\}/g, 'value'));
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || url.username || url.password
        || !allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        throw new Error();
      }
    } catch {
      throw new BadRequestException('payload.trackingUrlTemplate domain is invalid or not allowlisted.');
    }
  }

  private assertNoSecretLikeData(value: string, field: string) {
    const secretPattern = /(access_?token|refresh_?token|api_?key|client_?secret|password|authorization)/i;
    let decoded = value;
    try { decoded = decodeURIComponent(value); } catch { /* keep raw value */ }
    if (secretPattern.test(decoded)) {
      throw new BadRequestException(`${field} must not contain secret-like parameter names or values.`);
    }
  }

  private async resolveBudgetReference(
    customerId: string,
    campaign: any,
  ): Promise<CanonicalBudgetReference> {
    const campaignBudgetId = this.numericId(
      campaign?.campaignBudgetId,
      'canonical campaignBudgetId',
      false,
    );
    const suppliedResource = String(campaign?.campaignBudgetResourceName || '').trim();
    const validResource = new RegExp(`^customers/${customerId}/campaignBudgets/\\d+$`)
      .test(suppliedResource);
    if (!campaignBudgetId && !validResource) {
      throw new BadRequestException(
        'Canonical campaign budget mapping is required; campaignId is never used as a budget fallback.',
      );
    }
    if (campaignBudgetId && validResource && !suppliedResource.endsWith(`/${campaignBudgetId}`)) {
      throw new BadRequestException('Canonical campaign budget ID and resource name do not match.');
    }
    const filter: any = { customerId, $or: [] };
    if (campaignBudgetId) filter.$or.push({ campaignBudgetId });
    if (validResource) filter.$or.push({ resourceName: suppliedResource });
    const budget: any = await this.campaignBudgetModel.findOne(filter).lean();
    if (!budget) {
      throw new BadRequestException('Campaign budget is not present in canonical synced ERP data.');
    }
    this.assertCanonicalFreshness(budget, 'Google Ads campaign budget');
    const budgetId = this.numericId(budget.campaignBudgetId, 'campaignBudgetId');
    const budgetResourceName = String(budget.resourceName || '').trim();
    if (budgetResourceName !== `customers/${customerId}/campaignBudgets/${budgetId}`) {
      throw new BadRequestException('Canonical campaign budget resource name is invalid.');
    }
    const currentDailyBudgetVnd = budget.amountVnd !== undefined && budget.amountVnd !== null
      ? Number(budget.amountVnd)
      : Number(budget.amountMicros) / 1_000_000;
    return {
      campaignBudgetId: budgetId,
      campaignBudgetResourceName: budgetResourceName,
      ...(Number.isFinite(currentDailyBudgetVnd) ? { currentDailyBudgetVnd } : {}),
    };
  }

  private assertSearchCampaign(campaign: any) {
    if (!campaign) {
      throw new BadRequestException('Campaign is not present in canonical synced ERP data.');
    }
    if (String(campaign.advertisingChannelType || '').toUpperCase() !== 'SEARCH') {
      throw new BadRequestException('ERP-native mutations only support canonical Google Search campaigns.');
    }
  }

  private assertAccountContract(account: CanonicalAccount) {
    if (String(account.currency || '').trim() !== 'VND') {
      throw new BadRequestException('Canonical Google Ads account currency must be VND.');
    }
    if (String(account.timezoneId || '').trim() !== 'Asia/Ho_Chi_Minh') {
      throw new BadRequestException(
        'Canonical Google Ads account timezone must be Asia/Ho_Chi_Minh.',
      );
    }
  }

  private assertManualCpc(campaign: any) {
    if (String(campaign?.biddingStrategyType || '').toUpperCase() !== 'MANUAL_CPC') {
      throw new BadRequestException(
        'CPC bid fields are only supported for canonical MANUAL_CPC Search campaigns.',
      );
    }
  }

  private assertBidIncrease(requestedMicros: number, currentValue: unknown, label: string) {
    const currentMicros = Number(currentValue);
    if (!Number.isFinite(currentMicros) || currentMicros < 0) {
      throw new BadRequestException(`Canonical ${label} CPC bid is required for a bid update.`);
    }
    if (requestedMicros <= currentMicros) return;
    if (currentMicros === 0) {
      throw new BadRequestException(`Cannot increase ${label} CPC bid from an unset canonical baseline.`);
    }
    const maximumPercent = this.positiveEnv('GOOGLE_ADS_MAX_CPC_BID_INCREASE_PERCENT', 20);
    if (((requestedMicros - currentMicros) / currentMicros) * 100 > maximumPercent) {
      throw new BadRequestException(
        `${label} CPC bid increase violates GOOGLE_ADS_MAX_CPC_BID_INCREASE_PERCENT.`,
      );
    }
  }

  private assertCanonicalFreshness(value: any, label: string) {
    if (label === 'Google Ads account' && value?.lastSyncStatus !== 'ok') {
      throw new BadRequestException(`${label} does not have a successful canonical sync.`);
    }
    const timestamp = value?.lastSyncAt ? new Date(value.lastSyncAt) : null;
    const maximumAgeMs = this.positiveEnv(
      'GOOGLE_ADS_CANONICAL_SYNC_MAX_AGE_MS',
      15 * 60 * 1000,
    );
    if (!timestamp || Number.isNaN(timestamp.getTime())
      || timestamp.getTime() > Date.now() + 60_000
      || Date.now() - timestamp.getTime() > maximumAgeMs) {
      throw new BadRequestException(`${label} canonical sync is missing or stale.`);
    }
  }

  private derivedLoginCustomerId(account: CanonicalAccount): string | undefined {
    return this.numericId(account.loginCustomerId, 'loginCustomerId', false)
      || this.numericId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID, 'loginCustomerId', false);
  }

  private managerCredentialReference(manager: any): string {
    if (manager?.vaultProvider === 'env_reference') return 'env';
    if (manager?.vaultProvider === 'erp_secret_store') {
      return this.requiredText(
        manager?.credentialReferenceId,
        'MCC credentialReferenceId',
        160,
      );
    }
    throw new BadRequestException(
      'Google Ads MCC must use env_reference or erp_secret_store for exact credential binding.',
    );
  }

  private campaignResourceName(customerId: string, campaignId: string, value: unknown) {
    const expected = `customers/${customerId}/campaigns/${campaignId}`;
    if (String(value || '').trim() !== expected) {
      throw new BadRequestException('Canonical campaign resource name is invalid.');
    }
    return expected;
  }

  private adGroupResourceName(customerId: string, adGroupId: string, value: unknown) {
    const expected = `customers/${customerId}/adGroups/${adGroupId}`;
    if (String(value || '').trim() !== expected) {
      throw new BadRequestException('Canonical ad group resource name is invalid.');
    }
    return expected;
  }

  private criterionResourceName(
    customerId: string,
    adGroupId: string,
    criterionId: string,
    value: unknown,
  ) {
    const expected = `customers/${customerId}/adGroupCriteria/${adGroupId}~${criterionId}`;
    if (String(value || '').trim() !== expected) {
      throw new BadRequestException('Canonical keyword criterion resource name is invalid.');
    }
    return expected;
  }

  private adGroupAdResourceName(
    customerId: string,
    adGroupId: string,
    adId: string,
    value: unknown,
  ) {
    const expected = `customers/${customerId}/adGroupAds/${adGroupId}~${adId}`;
    if (String(value || '').trim() !== expected) {
      throw new BadRequestException('Canonical Responsive Search Ad resource name is invalid.');
    }
    return expected;
  }

  private safeUpdateEndDate(value: unknown, campaign: any) {
    const endDate = this.safeDate(value, 'payload.endDate');
    if (endDate < this.today()) {
      throw new BadRequestException('payload.endDate cannot be in the past.');
    }
    const startDate = campaign?.startDate
      ? this.safeDate(campaign.startDate, 'canonical campaign startDate')
      : undefined;
    if (startDate && endDate < startDate) {
      throw new BadRequestException('payload.endDate cannot be before the canonical campaign startDate.');
    }
    const currentEndDate = campaign?.endDate
      ? this.safeDate(campaign.endDate, 'canonical campaign endDate')
      : undefined;
    if (currentEndDate && endDate > currentEndDate) {
      throw new BadRequestException(
        'ERP-native update may only keep or shorten the canonical campaign endDate.',
      );
    }
    return endDate;
  }

  private assertBudgetCreationPolicy(dailyBudget: number) {
    const maximum = this.positiveEnv('GOOGLE_ADS_MAX_DAILY_BUDGET_VND', 5_000_000);
    if (dailyBudget > maximum) {
      throw new BadRequestException('Daily budget violates GOOGLE_ADS_MAX_DAILY_BUDGET_VND.');
    }
  }

  private dailyBudget(value: unknown) {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new BadRequestException('payload.dailyBudgetVnd must be a positive integer.');
    }
    return amount;
  }

  private numericIdArray(value: unknown, field: string, maximum: number) {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum) {
      throw new BadRequestException(`${field} must contain between 1 and ${maximum} numeric IDs.`);
    }
    const values = value.map((item) => this.numericId(item, field));
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`${field} must not contain duplicate IDs.`);
    }
    return values;
  }

  private numericId(value: unknown, field: string, required = true): string | undefined {
    const normalized = String(value || '').trim().replace(/[-\s]/g, '');
    if (!/^\d+$/.test(normalized)) {
      if (required) throw new BadRequestException(`${field} must be a numeric provider ID.`);
      return undefined;
    }
    return normalized;
  }

  private requiredText(value: unknown, field: string, maximum: number) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > maximum || /[\u0000-\u001F\u007F]/.test(normalized)) {
      throw new BadRequestException(
        `${field} is required and must be at most ${maximum} safe characters.`,
      );
    }
    return normalized;
  }

  private sha256(value: unknown, field: string) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a SHA-256 hash.`);
    }
    return normalized;
  }

  private isoDateTime(value: unknown, field: string) {
    const normalized = String(value || '').trim();
    const parsed = new Date(normalized);
    if (!normalized || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be an ISO date-time.`);
    }
    return parsed.toISOString();
  }

  private requiredIdempotencyKey(value: unknown) {
    const normalized = this.requiredText(value, 'idempotencyKey', 140);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)) {
      throw new BadRequestException('idempotencyKey contains unsupported characters.');
    }
    return normalized;
  }

  private safeDate(value: unknown, field: string) {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD.`);
    }
    const date = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
      throw new BadRequestException(`${field} is not a valid calendar date.`);
    }
    return normalized;
  }

  private today() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private assertAllowedPayloadKeys(
    payload: object,
    allowed: string[],
    actionType: string,
  ) {
    const unsupported = Object.keys(payload).filter((key) => !allowed.includes(key));
    if (unsupported.length) {
      throw new BadRequestException(
        `${actionType} cannot configure: ${unsupported.join(', ')}.`,
      );
    }
  }

  private assertOnlyKeys(value: unknown, allowed: Set<string>, label: string) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
    if (unsupported.length) {
      throw new BadRequestException(`${label} contains unsupported fields: ${unsupported.join(', ')}.`);
    }
  }

  private positiveEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private toPublicPlan(value: any) {
    const plan = value?.toObject ? value.toObject() : value;
    return {
      ...plan,
      items: (plan?.items || []).map((item: any) => {
        const {
          loginCustomerId: _loginCustomerId,
          credentialReferenceId: _credentialReferenceId,
          providerValidationCredentialReferenceId: _providerCredentialReferenceId,
          providerValidationCredentialBindingHash: _providerCredentialBindingHash,
          ...publicItem
        } = item;
        return publicItem;
      }),
    };
  }
}
