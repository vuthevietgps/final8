import { Injectable } from '@nestjs/common';
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
import { GoogleAdsCampaign, GoogleAdsCampaignDocument } from './schemas/google-ads-campaign.schema';
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

    return { syncResult, resourceRefs: refs, evaluationJobs };
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
    if (actionType === 'create_keyword') return 'keyword';
    if (actionType === 'create_responsive_search_ad') return 'ad';
    if (['create_ad_group', 'pause_ad_group', 'resume_ad_group'].includes(actionType)) return 'ad_group';
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
}

