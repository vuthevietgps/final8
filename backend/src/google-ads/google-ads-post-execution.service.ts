import { Injectable, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { GoogleAdsReadonlySyncService } from './google-ads-readonly-sync.service';
import {
  GoogleAdsActionEvaluation,
  GoogleAdsActionEvaluationDocument,
} from './schemas/google-ads-action-evaluation.schema';
import {
  GoogleAdsActionExecutionLogDocument,
} from './schemas/google-ads-action-execution-log.schema';
import { GoogleAdsActionPlanItem } from './schemas/google-ads-action-plan.schema';
import { GoogleAdsAdGroup, GoogleAdsAdGroupDocument } from './schemas/google-ads-ad-group.schema';
import { GoogleAdsKeyword, GoogleAdsKeywordDocument } from './schemas/google-ads-keyword.schema';
import { GoogleAdsAd, GoogleAdsAdDocument } from './schemas/google-ads-ad.schema';
import { GoogleAdsCampaign, GoogleAdsCampaignDocument } from './schemas/google-ads-campaign.schema';
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetDocument,
} from './schemas/google-ads-campaign-budget.schema';
import { GoogleAdsChangeLog, GoogleAdsChangeLogDocument } from './schemas/google-ads-change-log.schema';

type ResourceRefs = {
  campaignId?: string;
  campaignBudgetId?: string;
  adGroupId?: string;
  criterionId?: string;
  adId?: string;
};

@Injectable()
export class GoogleAdsPostExecutionService {
  constructor(
    private readonly readonlySyncService: GoogleAdsReadonlySyncService,
    @InjectModel(GoogleAdsChangeLog.name)
    private readonly changeLogModel: Model<GoogleAdsChangeLogDocument>,
    @InjectModel(GoogleAdsActionEvaluation.name)
    private readonly evaluationModel: Model<GoogleAdsActionEvaluationDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly campaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly adGroupModel: Model<GoogleAdsAdGroupDocument>,
    @Optional()
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly campaignBudgetModel?: Model<GoogleAdsCampaignBudgetDocument>,
    @Optional()
    @InjectModel(GoogleAdsKeyword.name)
    private readonly keywordModel?: Model<GoogleAdsKeywordDocument>,
    @Optional()
    @InjectModel(GoogleAdsAd.name)
    private readonly adModel?: Model<GoogleAdsAdDocument>,
  ) {}

  async handleSuccessfulExecution(params: {
    planId: string;
    action: GoogleAdsActionPlanItem;
    executionLog: GoogleAdsActionExecutionLogDocument;
  }) {
    const { planId, action, executionLog } = params;
    const executedAt = executionLog.executedAt || new Date();
    let syncResult: Record<string, any>;
    try {
      syncResult = await this.readonlySyncService.sync({ customerIds: [action.customerId] });
    } catch (error: any) {
      syncResult = {
        status: 'failed',
        errors: [{ step: 'post_execution_sync', message: redactSecretString(error?.message || String(error)) }],
      };
    }

    const refs = await this.resolveResourceRefs(action, executionLog);
    const readbackVerification = await this.verifyReadback(
      action,
      refs,
      syncResult,
      executedAt,
    );
    const evaluationDueAt = [3, 7].map((days) => this.addDays(executedAt, days));
    const executionLogId = (executionLog as any)._id;
    await this.changeLogModel.updateOne(
      { idempotencyKey: action.idempotencyKey },
      {
        $setOnInsert: {
          changeLogId: `GACL-${randomUUID()}`,
          executionLogId,
          planId,
          actionId: action.actionId,
          idempotencyKey: action.idempotencyKey,
          provider: 'google',
          customerId: action.customerId,
          actionType: action.actionType,
          resourceType: action.resourceType,
          ...refs,
          beforeValue: executionLog.beforeState,
          afterValue: executionLog.afterState,
          reason: action.reason,
          changedBy: executionLog.executedBy || action.approvedBy,
          providerRequestId: executionLog.providerRequestId,
          syncResult,
          evaluationDueAt,
          executedAt,
        },
      },
      { upsert: true },
    );

    const scopeLevel = this.scopeLevel(action.actionType);
    const evaluationJobs = [];
    for (const evaluationDays of [3, 7] as const) {
      const windows = this.windows(executedAt, evaluationDays);
      await this.evaluationModel.updateOne(
        { idempotencyKey: action.idempotencyKey, evaluationDays },
        {
          $setOnInsert: {
            evaluationId: `GAE-${randomUUID()}`,
            executionLogId,
            planId,
            actionId: action.actionId,
            idempotencyKey: action.idempotencyKey,
            actionType: action.actionType,
            customerId: action.customerId,
            evaluationDays,
            scopeLevel,
            ...refs,
            ...windows,
            dueAt: this.addDays(executedAt, evaluationDays),
            executedAt,
            status: 'pending',
          },
        },
        { upsert: true },
      );
      evaluationJobs.push({ evaluationDays, dueAt: this.addDays(executedAt, evaluationDays), ...windows });
    }

    return { syncResult, resourceRefs: refs, readbackVerification, evaluationJobs };
  }

  private async verifyReadback(
    action: GoogleAdsActionPlanItem,
    refs: ResourceRefs,
    syncResult: Record<string, any>,
    executedAt: Date,
  ): Promise<{ verified: boolean; blockers: string[] }> {
    const blockers: string[] = [];
    if (syncResult?.status !== 'success') {
      blockers.push('Canonical Google Ads sync did not complete successfully after mutation.');
      return { verified: false, blockers };
    }

    const payload = action.typedPayload || {};
    if ([
      'create_search_campaign',
      'update_search_campaign',
      'update_campaign_bidding_strategy',
      'pause_campaign',
      'resume_campaign',
    ].includes(action.actionType)) {
      const campaignId = refs.campaignId || this.id(payload.campaignId);
      const campaign: any = campaignId
        ? await this.campaignModel.findOne({ customerId: action.customerId, campaignId }).lean()
        : null;
      if (!campaign) blockers.push('Mutated campaign was not found in canonical readback.');
      if (campaign) this.assertFreshReadback(campaign, 'Campaign', executedAt, blockers);
      if (campaign && action.actionType === 'create_search_campaign' && campaign.status !== 'PAUSED') {
        blockers.push('New campaign readback is not PAUSED.');
      }
      if (campaign && action.actionType === 'create_search_campaign') {
        if (campaign.advertisingChannelType !== 'SEARCH') {
          blockers.push('New campaign readback is not SEARCH.');
        }
        if (campaign.targetGoogleSearch !== true
          || campaign.targetSearchNetwork !== (payload.searchPartnersEnabled === true)
          || campaign.targetContentNetwork !== false
          || campaign.targetPartnerSearchNetwork !== false) {
          blockers.push('New campaign network settings were not confirmed by canonical readback.');
        }
        if (campaign.positiveGeoTargetType !== payload.positiveGeoTargetType) {
          blockers.push('New campaign geo target type was not confirmed by canonical readback.');
        }
        if (campaign.containsEuPoliticalAdvertising
          !== 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING') {
          blockers.push('New campaign EU political advertising declaration was not confirmed by canonical readback.');
        }
        if (refs.campaignBudgetId
          && String(campaign.campaignBudgetId || '') !== refs.campaignBudgetId) {
          blockers.push('New campaign budget mapping was not confirmed by canonical readback.');
        }
        if (String(campaign.biddingStrategyType || '').toUpperCase()
          !== String(payload.biddingStrategyType || '').toUpperCase()) {
          blockers.push('New campaign bidding strategy was not confirmed by canonical readback.');
        }
        const createdExpectedTarget = payload.biddingStrategyType === 'MAXIMIZE_CLICKS'
          ? Number(payload.maxCpcBidCeilingMicros || 0)
          : Number(payload.targetCpaMicros || 0);
        const createdActualTarget = payload.biddingStrategyType === 'MAXIMIZE_CLICKS'
          ? Number(campaign.targetSpendCpcBidCeilingMicros || 0)
          : Number(campaign.maximizeConversionsTargetCpaMicros || 0);
        if (createdActualTarget !== createdExpectedTarget) {
          blockers.push('New campaign bidding target was not confirmed by canonical readback.');
        }
      }
      if (campaign && action.actionType === 'pause_campaign' && campaign.status !== 'PAUSED') {
        blockers.push('Campaign pause was not confirmed by canonical readback.');
      }
      if (campaign && action.actionType === 'resume_campaign' && campaign.status !== 'ENABLED') {
        blockers.push('Campaign resume was not confirmed by canonical readback.');
      }
      if (campaign && action.actionType === 'update_search_campaign') {
        if (payload.campaignName && campaign.campaignName !== payload.campaignName) {
          blockers.push('Campaign name update was not confirmed by canonical readback.');
        }
        if (payload.endDate && campaign.endDate !== payload.endDate) {
          blockers.push('Campaign end date update was not confirmed by canonical readback.');
        }
      }
      if (campaign && action.actionType === 'update_campaign_bidding_strategy') {
        const expectedType = String(payload.biddingStrategyType || '').toUpperCase();
        if (String(campaign.biddingStrategyType || '').toUpperCase() !== expectedType) {
          blockers.push('Campaign bidding strategy update was not confirmed by canonical readback.');
        }
        if (String(campaign.biddingStrategyResourceName || '').trim()) {
          blockers.push('Campaign readback unexpectedly uses a portfolio bidding strategy.');
        }
        const expectedTarget = expectedType === 'MAXIMIZE_CLICKS'
          ? Number(payload.maxCpcBidCeilingMicros || 0)
          : Number(payload.targetCpaMicros || 0);
        const actualTarget = expectedType === 'MAXIMIZE_CLICKS'
          ? Number(campaign.targetSpendCpcBidCeilingMicros || 0)
          : Number(campaign.maximizeConversionsTargetCpaMicros || 0);
        if (actualTarget !== expectedTarget) {
          blockers.push('Campaign bidding target was not confirmed by canonical readback.');
        }
      }
    }

    if (action.actionType === 'create_search_campaign') {
      const campaignBudgetId = refs.campaignBudgetId;
      const budget: any = this.campaignBudgetModel && campaignBudgetId
        ? await this.campaignBudgetModel.findOne({
          customerId: action.customerId,
          campaignBudgetId,
        }).lean()
        : null;
      if (!budget) {
        blockers.push('New campaign budget was not found in canonical readback.');
      } else {
        this.assertFreshReadback(budget, 'Campaign budget', executedAt, blockers);
        const actual = budget.amountVnd !== undefined
          ? Number(budget.amountVnd)
          : Number(budget.amountMicros) / 1_000_000;
        if (actual !== Number(payload.dailyBudget)
          || budget.deliveryMethod !== 'STANDARD'
          || budget.explicitlyShared === true) {
          blockers.push('New campaign budget settings were not confirmed by canonical readback.');
        }
      }
    }

    if (action.actionType === 'update_campaign_budget') {
      const campaignBudgetId = refs.campaignBudgetId
        || this.id(payload.campaignBudgetId)
        || this.idFromResource(payload.campaignBudgetResourceName);
      const budget: any = this.campaignBudgetModel && campaignBudgetId
        ? await this.campaignBudgetModel.findOne({
          customerId: action.customerId,
          campaignBudgetId,
        }).lean()
        : null;
      if (!budget) {
        blockers.push('Mutated campaign budget was not found in canonical readback.');
      } else {
        this.assertFreshReadback(budget, 'Campaign budget', executedAt, blockers);
        const actual = budget.amountVnd !== undefined
          ? Number(budget.amountVnd)
          : Number(budget.amountMicros) / 1_000_000;
        if (!Number.isFinite(actual) || actual !== Number(payload.dailyBudget)) {
          blockers.push('Campaign budget update was not confirmed by canonical readback.');
        }
      }
    }

    if (['create_ad_group', 'update_ad_group', 'pause_ad_group', 'resume_ad_group'].includes(action.actionType)) {
      const adGroupId = refs.adGroupId || this.id(payload.adGroupId);
      const adGroup: any = adGroupId
        ? await this.adGroupModel.findOne({ customerId: action.customerId, adGroupId }).lean()
        : null;
      if (!adGroup) {
        blockers.push('Mutated ad group was not found in canonical readback.');
      } else {
        this.assertFreshReadback(adGroup, 'Ad group', executedAt, blockers);
        if (action.actionType === 'create_ad_group'
          && (adGroup.status !== 'PAUSED' || adGroup.type !== 'SEARCH_STANDARD')) {
          blockers.push('New Search ad group readback is not PAUSED SEARCH_STANDARD.');
        }
        if (action.actionType === 'pause_ad_group' && adGroup.status !== 'PAUSED') {
          blockers.push('Ad group pause was not confirmed by canonical readback.');
        }
        if (action.actionType === 'resume_ad_group' && adGroup.status !== 'ENABLED') {
          blockers.push('Ad group resume was not confirmed by canonical readback.');
        }
        if (action.actionType === 'update_ad_group') {
          if (payload.adGroupName !== undefined && adGroup.adGroupName !== payload.adGroupName) {
            blockers.push('Ad group name update was not confirmed by canonical readback.');
          }
          if (payload.cpcBidMicros !== undefined
            && Number(adGroup.cpcBidMicros) !== Number(payload.cpcBidMicros)) {
            blockers.push('Ad group CPC bid update was not confirmed by canonical readback.');
          }
        }
      }
    }

    if (['create_keyword', 'update_keyword', 'pause_keyword', 'resume_keyword'].includes(action.actionType)) {
      const criterionId = refs.criterionId || this.id(payload.criterionId);
      const keyword: any = this.keywordModel && criterionId
        ? await this.keywordModel.findOne({
          customerId: action.customerId,
          adGroupId: refs.adGroupId || this.id(payload.adGroupId),
          criterionId,
        }).lean()
        : null;
      if (!keyword) {
        blockers.push('Mutated keyword was not found in canonical readback.');
      } else {
        this.assertFreshReadback(keyword, 'Keyword', executedAt, blockers);
        if (action.actionType === 'create_keyword') {
          if (keyword.status !== 'PAUSED'
            || keyword.keywordText !== payload.keywordText
            || keyword.matchType !== payload.matchType
            || keyword.negative !== (payload.negative === true)) {
            blockers.push('New keyword settings were not confirmed by canonical readback.');
          }
        }
        if (action.actionType === 'pause_keyword' && keyword.status !== 'PAUSED') {
          blockers.push('Keyword pause was not confirmed by canonical readback.');
        }
        if (action.actionType === 'resume_keyword' && keyword.status !== 'ENABLED') {
          blockers.push('Keyword resume was not confirmed by canonical readback.');
        }
        if (payload.cpcBidMicros !== undefined
          && Number(keyword.cpcBidMicros) !== Number(payload.cpcBidMicros)) {
          blockers.push('Keyword CPC bid was not confirmed by canonical readback.');
        }
        if (payload.finalUrl !== undefined
          && (!Array.isArray(keyword.finalUrls) || keyword.finalUrls[0] !== payload.finalUrl)) {
          blockers.push('Keyword final URL was not confirmed by canonical readback.');
        }
      }
    }

    if ([
      'create_responsive_search_ad',
      'update_responsive_search_ad',
      'pause_responsive_search_ad',
      'resume_responsive_search_ad',
    ].includes(action.actionType)) {
      const adId = refs.adId || this.id(payload.adId);
      const ad: any = this.adModel && adId
        ? await this.adModel.findOne({
          customerId: action.customerId,
          adGroupId: refs.adGroupId || this.id(payload.adGroupId),
          adId,
        }).lean()
        : null;
      if (!ad) {
        blockers.push('Mutated Responsive Search Ad was not found in canonical readback.');
      } else {
        this.assertFreshReadback(ad, 'Responsive Search Ad', executedAt, blockers);
        if (action.actionType === 'create_responsive_search_ad'
          && (ad.status !== 'PAUSED' || ad.adType !== 'RESPONSIVE_SEARCH_AD')) {
          blockers.push('New Responsive Search Ad readback is not PAUSED RSA.');
        }
        if (action.actionType === 'pause_responsive_search_ad' && ad.status !== 'PAUSED') {
          blockers.push('Responsive Search Ad pause was not confirmed by canonical readback.');
        }
        if (action.actionType === 'resume_responsive_search_ad' && ad.status !== 'ENABLED') {
          blockers.push('Responsive Search Ad resume was not confirmed by canonical readback.');
        }
        const expectedFields: Array<[string, unknown, unknown]> = [
          ['final URL', payload.finalUrl, Array.isArray(ad.finalUrls) ? ad.finalUrls[0] : undefined],
          ['headlines', payload.headlines, this.assetTexts(ad.headlines)],
          ['descriptions', payload.descriptions, this.assetTexts(ad.descriptions)],
          ['headline pins', payload.headlinePins, this.assetPins(ad.headlines)],
          ['description pins', payload.descriptionPins, this.assetPins(ad.descriptions)],
          ['path1', payload.path1, ad.path1],
          ['path2', payload.path2, ad.path2],
          ['tracking URL template', payload.trackingUrlTemplate, ad.trackingUrlTemplate],
          ['final URL suffix', payload.finalUrlSuffix, ad.finalUrlSuffix],
        ];
        for (const [label, expected, actual] of expectedFields) {
          if (expected !== undefined && !this.sameValue(expected, actual)) {
            blockers.push(`Responsive Search Ad ${label} was not confirmed by canonical readback.`);
          }
        }
      }
    }
    return { verified: blockers.length === 0, blockers };
  }

  private assertFreshReadback(
    value: any,
    label: string,
    executedAt: Date,
    blockers: string[],
  ) {
    const lastSyncAt = value?.lastSyncAt ? new Date(value.lastSyncAt) : null;
    if (!lastSyncAt || Number.isNaN(lastSyncAt.getTime())
      || lastSyncAt.getTime() < executedAt.getTime()) {
      blockers.push(`${label} canonical readback is older than the live execution.`);
    }
  }

  private async resolveResourceRefs(action: GoogleAdsActionPlanItem, log: GoogleAdsActionExecutionLogDocument) {
    const payload = action.typedPayload || {};
    const before = log.beforeState || {};
    const refs: ResourceRefs = {
      campaignId: this.id(payload.campaignId) || this.id((before as any).campaignId),
      campaignBudgetId: this.id(payload.campaignBudgetId) || this.idFromResource(payload.campaignBudgetResourceName),
      adGroupId: this.id(payload.adGroupId) || this.id((before as any).adGroupId),
      criterionId: this.id(payload.criterionId),
      adId: this.id(payload.adId),
    };
    this.collectResourceRefs(log.providerResponse || log.afterState, refs);

    if (!refs.campaignId && refs.campaignBudgetId) {
      const campaign: any = await this.campaignModel.findOne({
        customerId: action.customerId,
        $or: [
          { campaignBudgetId: refs.campaignBudgetId },
          { campaignBudgetResourceName: `customers/${action.customerId}/campaignBudgets/${refs.campaignBudgetId}` },
        ],
      }).lean();
      refs.campaignId = this.id(campaign?.campaignId);
    }
    if (!refs.campaignId && refs.adGroupId) {
      const adGroup: any = await this.adGroupModel.findOne({
        customerId: action.customerId,
        adGroupId: refs.adGroupId,
      }).lean();
      refs.campaignId = this.id(adGroup?.campaignId);
    }
    return Object.fromEntries(Object.entries(refs).filter(([, value]) => Boolean(value)));
  }

  private collectResourceRefs(value: any, refs: ResourceRefs) {
    if (typeof value === 'string') {
      const campaign = value.match(/\/campaigns\/(\d+)$/);
      const budget = value.match(/\/campaignBudgets\/(\d+)$/);
      const adGroup = value.match(/\/adGroups\/(\d+)$/);
      const criterion = value.match(/\/adGroupCriteria\/(\d+)~(\d+)$/);
      const ad = value.match(/\/adGroupAds\/(\d+)~(\d+)$/);
      if (campaign) refs.campaignId = campaign[1];
      if (budget) refs.campaignBudgetId = budget[1];
      if (adGroup) refs.adGroupId = adGroup[1];
      if (criterion) {
        refs.adGroupId = criterion[1];
        refs.criterionId = criterion[2];
      }
      if (ad) {
        refs.adGroupId = ad[1];
        refs.adId = ad[2];
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectResourceRefs(item, refs));
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach((item) => this.collectResourceRefs(item, refs));
    }
  }

  private scopeLevel(actionType: string): 'campaign' | 'ad_group' | 'keyword' | 'ad' {
    if (['create_keyword', 'update_keyword', 'pause_keyword', 'resume_keyword'].includes(actionType)) return 'keyword';
    if ([
      'create_responsive_search_ad',
      'update_responsive_search_ad',
      'pause_responsive_search_ad',
      'resume_responsive_search_ad',
    ].includes(actionType)) return 'ad';
    if (['create_ad_group', 'update_ad_group', 'pause_ad_group', 'resume_ad_group'].includes(actionType)) return 'ad_group';
    return 'campaign';
  }

  private windows(executedAt: Date, days: 3 | 7) {
    return {
      baselineWindow: {
        from: this.isoDate(this.addDays(executedAt, -days)),
        to: this.isoDate(this.addDays(executedAt, -1)),
      },
      evaluationWindow: {
        from: this.isoDate(this.addDays(executedAt, 1)),
        to: this.isoDate(this.addDays(executedAt, days)),
      },
    };
  }

  private addDays(value: Date, days: number) {
    const result = new Date(value);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private isoDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private id(value: any) {
    const normalized = String(value || '').trim();
    return /^\d+$/.test(normalized) ? normalized : undefined;
  }

  private idFromResource(value: any) {
    return this.id(String(value || '').split('/').pop());
  }

  private assetTexts(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => typeof item === 'string' ? item : item?.text)
      .filter((item) => typeof item === 'string');
  }

  private assetPins(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item: any, index) => {
      const pinnedField = item?.pinnedField || item?.pinned_field;
      return pinnedField ? [{ index, pinnedField }] : [];
    });
  }

  private sameValue(expected: unknown, actual: unknown) {
    if (Array.isArray(expected) || Array.isArray(actual)) {
      return JSON.stringify(this.normalizedArray(expected)) === JSON.stringify(this.normalizedArray(actual));
    }
    return expected === actual;
  }

  private normalizedArray(value: unknown) {
    if (!Array.isArray(value)) return value;
    const items = [...value];
    if (items.every((item: any) => item
      && Number.isInteger(item.index)
      && typeof item.pinnedField === 'string')) {
      return items.sort((left: any, right: any) =>
        left.index - right.index || left.pinnedField.localeCompare(right.pinnedField));
    }
    return items;
  }
}
