import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { createHash, randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { UpsertGoogleAdsBiddingLifecycleDto } from './dto/upsert-google-ads-bidding-lifecycle.dto';
import { GoogleAdsErpActionPlanService } from './google-ads-erp-action-plan.service';
import { GoogleAdsConversionReadinessService } from './google-ads-conversion-readiness.service';
import { GoogleAdsReadonlySyncService } from './google-ads-readonly-sync.service';
import {
  GoogleAdsActionPlan,
  GoogleAdsActionPlanDocument,
} from './schemas/google-ads-action-plan.schema';
import {
  GoogleAdsBiddingLifecycle,
  GoogleAdsBiddingLifecycleDecision,
  GoogleAdsBiddingLifecycleDocument,
  GoogleAdsBiddingLifecycleStage,
} from './schemas/google-ads-bidding-lifecycle.schema';
import {
  GoogleAdsCampaign,
  GoogleAdsCampaignDocument,
} from './schemas/google-ads-campaign.schema';
import {
  GoogleAdsDailyMetric,
  GoogleAdsDailyMetricDocument,
} from './schemas/google-ads-daily-metric.schema';

const ACTIVE_PLAN_STATUSES = [
  'pending_approval',
  'partially_approved',
  'approved',
  'executing',
] as const;

const DEFAULT_POLICY = Object.freeze({
  enabled: false,
  clickThreshold: 50,
  clickWindowDays: 30,
  maxCpcBidCeilingVnd: 0,
  maximizeConversionsMinConversions: 15,
  conversionWindowDays: 30,
  targetCpaMinConversions: 30,
  targetCpaVnd: 0,
  cooldownHours: 168,
  minimumStageDwellHours: 168,
  draftOnly: true as const,
});

type PublicStage = Exclude<GoogleAdsBiddingLifecycleStage, 'UNMANAGED'>;

type LifecycleMetrics = {
  observedClicks: number;
  observedConversions: number;
  observedCpaVnd: number | null;
  clickSpendVnd: number;
  conversionSpendVnd: number;
  averageCpcVnd: number | null;
  clickFrom: string;
  conversionFrom: string;
  to: string;
  rowCount: number;
  latestMetricSyncAt: string | null;
};

@Injectable()
export class GoogleAdsBiddingLifecycleService {
  private readonly logger = new Logger(GoogleAdsBiddingLifecycleService.name);

  constructor(
    @InjectModel(GoogleAdsBiddingLifecycle.name)
    private readonly lifecycleModel: Model<GoogleAdsBiddingLifecycleDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly campaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsDailyMetric.name)
    private readonly dailyMetricModel: Model<GoogleAdsDailyMetricDocument>,
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly actionPlanModel: Model<GoogleAdsActionPlanDocument>,
    private readonly erpActionPlanService: GoogleAdsErpActionPlanService,
    @Optional()
    private readonly conversionReadinessService?: GoogleAdsConversionReadinessService,
    @Optional()
    private readonly readonlySyncService?: GoogleAdsReadonlySyncService,
  ) {}

  async get(customerId: string, campaignId: string) {
    const ids = this.ids(customerId, campaignId);
    const policy: any = await this.lifecycleModel.findOne(ids).lean();
    if (!policy) {
      return this.response(
        { ...ids, ...DEFAULT_POLICY },
        {
          observedStage: 'UNMANAGED',
          blockers: ['POLICY_NOT_CONFIGURED'],
          lastDecision: 'NOT_EVALUATED',
        },
      );
    }
    return this.response(policy);
  }

  async upsert(
    customerId: string,
    campaignId: string,
    dto: UpsertGoogleAdsBiddingLifecycleDto,
    actorId?: string,
  ) {
    const ids = this.ids(customerId, campaignId);
    if ((dto as any)?.draftOnly === false) {
      throw new BadRequestException('Google Ads bidding lifecycle requires draftOnly=true.');
    }
    const existing: any = await this.lifecycleModel.findOne(ids).lean();
    const config = this.normalizePolicy(dto || {}, existing);
    const actor = this.actor(actorId);
    const updated: any = await this.lifecycleModel.findOneAndUpdate(
      ids,
      {
        $set: {
          ...config,
          draftOnly: true,
          updatedByUserId: actor,
        },
        $setOnInsert: {
          ...ids,
          observedStage: 'UNMANAGED',
          lastDecision: 'NOT_EVALUATED',
          blockers: [],
        },
        $inc: { policyVersion: 1 },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: false,
      },
    ).lean();
    return this.response(updated);
  }

  async evaluate(customerId: string, campaignId: string, actorId?: string) {
    const ids = this.ids(customerId, campaignId);
    const existing: any = await this.lifecycleModel.findOne(ids).lean();
    if (!existing) {
      return this.response(
        { ...ids, ...DEFAULT_POLICY },
        {
          observedStage: 'UNMANAGED',
          blockers: ['POLICY_NOT_CONFIGURED'],
          lastDecision: 'BLOCKED',
          lastDecisionReason: 'Bidding lifecycle policy is not configured.',
        },
      );
    }
    if (existing.enabled !== true) {
      return this.response(existing, {
        blockers: ['AUTOMATION_DISABLED'],
        lastDecision: 'BLOCKED',
        lastDecisionReason: 'Bidding lifecycle automation is disabled.',
      });
    }
    if (existing.draftOnly !== true) {
      return this.response(existing, {
        blockers: ['DRAFT_ONLY_INVARIANT_FAILED'],
        lastDecision: 'BLOCKED',
        lastDecisionReason: 'Bidding lifecycle may only create approval-pending drafts.',
      });
    }

    const now = new Date();
    const leaseToken = randomUUID();
    const leaseOwner = this.actor(actorId);
    const leaseExpiresAt = new Date(now.getTime() + this.leaseTtlMs());
    const leased: any = await this.lifecycleModel.findOneAndUpdate(
      {
        ...ids,
        enabled: true,
        draftOnly: true,
        $or: [
          { leaseExpiresAt: { $exists: false } },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          leaseOwner,
          leaseToken,
          leaseExpiresAt,
        },
      },
      { new: true },
    ).lean();
    if (!leased) {
      return this.response(existing, {
        blockers: ['EVALUATION_LEASE_BUSY'],
        lastDecision: 'BLOCKED',
        lastDecisionReason: 'Another worker is evaluating this campaign.',
      });
    }

    try {
      return await this.evaluateLeased(leased, leaseToken, leaseOwner, now);
    } catch (error: any) {
      const message = redactSecretString(error?.message || String(error));
      await this.finishLease(leased, leaseToken, {
        lastEvaluatedAt: now,
        lastDecision: 'FAILED',
        lastDecisionReason: message,
        blockers: ['EVALUATION_FAILED'],
      });
      return this.response(
        {
          ...leased,
          lastEvaluatedAt: now,
          lastDecision: 'FAILED',
          lastDecisionReason: message,
          blockers: ['EVALUATION_FAILED'],
        },
      );
    }
  }

  @Cron('0 35 * * * *', {
    name: 'google-ads-bidding-lifecycle-draft-evaluation',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async runEvaluationCron() {
    const limit = this.positiveIntegerEnv(
      'GOOGLE_ADS_BIDDING_LIFECYCLE_BATCH_SIZE',
      20,
      100,
    );
    const policies: any[] = await this.lifecycleModel
      .find({ enabled: true, draftOnly: true })
      .sort({ lastEvaluatedAt: 1, updatedAt: 1 })
      .limit(limit)
      .lean();
    if (policies.length && this.readonlySyncService) {
      const dateTo = this.yesterdayDateKey(new Date());
      const maximumWindowDays = Math.max(
        ...policies.map((policy) => Math.max(
          Number(policy.clickWindowDays || DEFAULT_POLICY.clickWindowDays),
          Number(policy.conversionWindowDays || DEFAULT_POLICY.conversionWindowDays),
        )),
      );
      try {
        await this.readonlySyncService.sync({
          customerIds: [...new Set(
            policies.map((policy) => String(policy.customerId)),
          )],
          dateFrom: this.addIsoDays(dateTo, -(maximumWindowDays - 1)),
          dateTo,
        });
      } catch (error: any) {
        this.logger.warn(
          `Google Ads bidding lifecycle canonical sync failed: ${
            redactSecretString(error?.message || String(error))
          }`,
        );
      }
    }
    let evaluated = 0;
    let draftsCreated = 0;
    let failed = 0;
    for (const policy of policies) {
      try {
        const result = await this.evaluate(
          String(policy.customerId),
          String(policy.campaignId),
          'google-ads-bidding-lifecycle',
        );
        evaluated += 1;
        if (result?.state?.pendingDraft?.planId
          && result?.state?.blockers?.length === 0) {
          draftsCreated += 1;
        }
        if (result?.state?.blockers?.includes('EVALUATION_FAILED')) failed += 1;
      } catch (error: any) {
        failed += 1;
        this.logger.warn(
          `Google Ads bidding lifecycle evaluation failed: ${
            redactSecretString(error?.message || String(error))
          }`,
        );
      }
    }
    if (evaluated || failed) {
      this.logger.log(
        `Google Ads bidding lifecycle evaluated=${evaluated} drafts=${draftsCreated} failed=${failed}`,
      );
    }
    return {
      selected: policies.length,
      evaluated,
      draftsCreated,
      failed,
    };
  }

  private async evaluateLeased(
    policy: any,
    leaseToken: string,
    leaseOwner: string,
    now: Date,
  ) {
    const customerId = String(policy.customerId);
    const campaignId = String(policy.campaignId);
    const campaign: any = await this.campaignModel.findOne({
      customerId,
      campaignId,
    }).lean();
    const blockers: string[] = [];
    const canonicalType = String(campaign?.biddingStrategyType || '').toUpperCase();
    const currentStage = this.canonicalStage(campaign);

    if (!campaign) blockers.push('CANONICAL_CAMPAIGN_NOT_FOUND');
    if (campaign && String(campaign.advertisingChannelType || '').toUpperCase() !== 'SEARCH') {
      blockers.push('CAMPAIGN_IS_NOT_SEARCH');
    }
    if (campaign && String(campaign.status || '').toUpperCase() !== 'ENABLED') {
      blockers.push('CAMPAIGN_IS_NOT_ENABLED');
    }
    if (campaign && String(campaign.biddingStrategyResourceName || '').trim()) {
      blockers.push('PORTFOLIO_BIDDING_STRATEGY_NOT_SUPPORTED');
    }
    if (campaign && this.isStale(campaign.lastSyncAt, this.canonicalMaximumAgeMs())) {
      blockers.push('CANONICAL_CAMPAIGN_STALE');
    }
    const biddingSystemStatus = String(campaign?.biddingStrategySystemStatus || '').toUpperCase();
    if (['LEARNING', 'LIMITED', 'MISCONFIGURED'].includes(biddingSystemStatus)) {
      blockers.push(`BIDDING_SYSTEM_STATUS_${biddingSystemStatus}`);
    }
    if (currentStage === 'UNMANAGED') {
      blockers.push('UNSUPPORTED_CANONICAL_BIDDING_STRATEGY');
    }

    const dateTo = this.yesterdayDateKey(now);
    const clickFrom = this.addIsoDays(dateTo, -(Number(policy.clickWindowDays) - 1));
    const conversionFrom = this.addIsoDays(
      dateTo,
      -(Number(policy.conversionWindowDays) - 1),
    );
    const dateFrom = clickFrom < conversionFrom ? clickFrom : conversionFrom;
    const rows: any[] = campaign
      ? await this.dailyMetricModel.find({
        customerId,
        campaignId,
        level: 'campaign',
        date: { $gte: dateFrom, $lte: dateTo },
      }).sort({ date: 1 }).lean()
      : [];
    const metrics = this.metrics(rows, clickFrom, conversionFrom, dateTo);
    if (!rows.length) blockers.push('CANONICAL_CAMPAIGN_METRICS_MISSING');
    if (rows.length
      && this.isStale(metrics.latestMetricSyncAt, this.metricMaximumAgeMs())) {
      blockers.push('CANONICAL_CAMPAIGN_METRICS_STALE');
    }

    const stageChanged = currentStage !== policy.observedStage;
    const stageEnteredAt = stageChanged || !this.validDate(policy.stageEnteredAt)
      ? now
      : new Date(policy.stageEnteredAt);
    let proposedStage: PublicStage | undefined;
    if (currentStage === 'MAXIMIZE_CLICKS') {
      if (metrics.observedClicks >= Number(policy.clickThreshold)) {
        proposedStage = 'MAXIMIZE_CLICKS_CPC_CEILING';
        if (!(Number(policy.maxCpcBidCeilingVnd) > 0)) {
          blockers.push('MAX_CPC_BID_CEILING_REQUIRED');
        }
      } else {
        blockers.push('CLICK_THRESHOLD_NOT_REACHED');
      }
    } else if (currentStage === 'MAXIMIZE_CLICKS_CPC_CEILING') {
      if (metrics.observedConversions >= Number(policy.maximizeConversionsMinConversions)) {
        proposedStage = 'MAXIMIZE_CONVERSIONS';
        const readiness = this.conversionReadinessService
          ? await this.conversionReadinessService.evaluate(customerId, campaignId)
          : {
            ready: false,
            blockers: ['CONVERSION_READINESS_SERVICE_UNAVAILABLE'],
          };
        if (!readiness.ready) {
          blockers.push(
            'CANONICAL_CONVERSION_ACTION_AND_GOAL_EVIDENCE_NOT_READY',
            ...readiness.blockers,
          );
        }
      } else {
        blockers.push('MAXIMIZE_CONVERSIONS_THRESHOLD_NOT_REACHED');
      }
    } else if (currentStage === 'MAXIMIZE_CONVERSIONS') {
      if (metrics.observedConversions >= Number(policy.targetCpaMinConversions)) {
        proposedStage = 'MAXIMIZE_CONVERSIONS_TARGET_CPA';
        if (!(Number(policy.targetCpaVnd) > 0)) {
          blockers.push('TARGET_CPA_REQUIRED');
        }
        const readiness = this.conversionReadinessService
          ? await this.conversionReadinessService.evaluate(customerId, campaignId)
          : {
            ready: false,
            blockers: ['CONVERSION_READINESS_SERVICE_UNAVAILABLE'],
          };
        if (!readiness.ready) {
          blockers.push(
            'CANONICAL_CONVERSION_ACTION_AND_GOAL_EVIDENCE_NOT_READY',
            ...readiness.blockers,
          );
        }
      } else {
        blockers.push('TARGET_CPA_THRESHOLD_NOT_REACHED');
      }
    }

    if (proposedStage && Number(policy.minimumStageDwellHours) > 0) {
      const dwellUntil = new Date(
        stageEnteredAt.getTime() + Number(policy.minimumStageDwellHours) * 60 * 60 * 1000,
      );
      if (dwellUntil.getTime() > now.getTime()) {
        blockers.push('MINIMUM_STAGE_DWELL_NOT_MET');
      }
    }
    const cooldownUntil = this.nextEligibleDate(policy.lastDraftAt, policy.cooldownHours);
    if (proposedStage && cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
      blockers.push('DRAFT_COOLDOWN_ACTIVE');
    }

    const activePlan = await this.activeBiddingPlan(customerId, campaignId);
    if (activePlan) blockers.push('PENDING_BIDDING_DRAFT_EXISTS');

    const metricsHash = this.metricsHash(rows);
    const commonState: Record<string, any> = {
      observedStage: currentStage,
      proposedStage,
      canonicalBiddingStrategyType: canonicalType,
      stageEnteredAt,
      observedAt: now,
      lastEvaluatedAt: now,
      lastMetrics: metrics,
      lastMetricsWindow: {
        clickFrom,
        conversionFrom,
        to: dateTo,
      },
      lastMetricsHash: metricsHash,
      blockers: this.unique(blockers),
      pendingPlanId: activePlan?.planId,
      pendingActionId: this.biddingAction(activePlan)?.actionId,
      pendingPlanStatus: activePlan?.status,
      pendingPlanCreatedAt: activePlan?.createdAt,
      ...(stageChanged ? { lastDraftIdempotencyKey: undefined } : {}),
    };

    if (!proposedStage && currentStage === 'MAXIMIZE_CONVERSIONS_TARGET_CPA') {
      const finished = {
        ...commonState,
        blockers: this.unique(blockers),
        lastDecision: blockers.length ? 'BLOCKED' : 'NO_ACTION',
        lastDecisionReason: blockers.length
          ? 'Canonical safety or data gates blocked evaluation.'
          : 'Campaign already uses the final configured bidding lifecycle stage.',
      };
      await this.finishLease(policy, leaseToken, finished);
      return this.response({ ...policy, ...finished });
    }

    if (!proposedStage || blockers.length) {
      const blocked = {
        ...commonState,
        lastDecision: 'BLOCKED',
        lastDecisionReason: proposedStage
          ? 'The next lifecycle transition is blocked by canonical safety gates.'
          : 'The next lifecycle threshold has not been reached.',
      };
      await this.finishLease(policy, leaseToken, blocked);
      return this.response({ ...policy, ...blocked });
    }

    const idempotencyKey = this.idempotencyKey(
      customerId,
      campaignId,
      proposedStage,
      dateTo,
      metricsHash,
      Number(policy.policyVersion || 1),
    );
    const payload = this.transitionPayload(proposedStage, policy);
    let createdPlan: any;
    let decision: GoogleAdsBiddingLifecycleDecision = 'DRAFT_CREATED';
    try {
      const created: any = await this.erpActionPlanService.createPlan(
        {
          planName: `Auto bidding draft ${customerId}/${campaignId} ${proposedStage}`,
          actions: [{
            actionType: 'update_campaign_bidding_strategy',
            customerId,
            campaignId,
            reason: `Draft-only lifecycle proposal from ${currentStage} to ${proposedStage}; canonical metrics hash ${metricsHash.slice(0, 16)}.`,
            idempotencyKey,
            payload,
          }],
        } as any,
        leaseOwner,
        'erp_automation',
      );
      createdPlan = created?.plan || created;
    } catch (error: any) {
      if (!this.isIdempotencyConflict(error)) throw error;
      createdPlan = await this.actionPlanModel.findOne({
        idempotencyKeys: idempotencyKey,
      }).lean();
      if (!createdPlan) throw error;
      decision = 'DRAFT_ALREADY_EXISTS';
    }
    const action = this.biddingAction(createdPlan);
    const completed = {
      ...commonState,
      blockers: [],
      pendingPlanId: createdPlan?.planId,
      pendingActionId: action?.actionId,
      pendingPlanStatus: createdPlan?.status || 'pending_approval',
      pendingPlanCreatedAt: createdPlan?.createdAt || now,
      lastDraftIdempotencyKey: idempotencyKey,
      lastDraftAt: now,
      lastDecision: decision,
      lastDecisionReason: decision === 'DRAFT_CREATED'
        ? 'A draft-only bidding transition plan was created and awaits validateOnly and approval.'
        : 'The deterministic draft already exists; no duplicate was created.',
    };
    await this.finishLease(policy, leaseToken, completed);
    return this.response({ ...policy, ...completed });
  }

  private async finishLease(
    policy: any,
    leaseToken: string,
    state: Record<string, any>,
  ) {
    const $set = Object.fromEntries(
      Object.entries(state).filter(([, value]) => value !== undefined),
    );
    const $unset: Record<string, 1> = {
      leaseOwner: 1,
      leaseToken: 1,
      leaseExpiresAt: 1,
    };
    for (const key of [
      'proposedStage',
      'pendingPlanId',
      'pendingActionId',
      'pendingPlanStatus',
      'pendingPlanCreatedAt',
      'lastDraftIdempotencyKey',
    ]) {
      if (Object.prototype.hasOwnProperty.call(state, key) && state[key] === undefined) {
        $unset[key] = 1;
      }
    }
    await this.lifecycleModel.updateOne(
      {
        customerId: String(policy.customerId),
        campaignId: String(policy.campaignId),
        leaseToken,
      },
      {
        $set,
        $unset,
      },
    );
  }

  private async activeBiddingPlan(customerId: string, campaignId: string) {
    const plan: any = await this.actionPlanModel.findOne({
      status: { $in: ACTIVE_PLAN_STATUSES },
      items: {
        $elemMatch: {
          customerId,
          actionType: 'update_campaign_bidding_strategy',
          'typedPayload.campaignId': campaignId,
        },
      },
    }).sort({ createdAt: -1 }).lean();
    return plan;
  }

  private metrics(
    rows: any[],
    clickFrom: string,
    conversionFrom: string,
    to: string,
  ): LifecycleMetrics {
    const clickRows = rows.filter((row) => row.date >= clickFrom && row.date <= to);
    const conversionRows = rows.filter(
      (row) => row.date >= conversionFrom && row.date <= to,
    );
    const observedClicks = clickRows.reduce(
      (sum, row) => sum + this.nonNegative(row.clicks),
      0,
    );
    const observedConversions = conversionRows.reduce(
      (sum, row) => sum + this.nonNegative(row.conversions),
      0,
    );
    const clickSpendVnd = clickRows.reduce(
      (sum, row) => sum + this.nonNegative(row.costVnd),
      0,
    );
    const conversionSpendVnd = conversionRows.reduce(
      (sum, row) => sum + this.nonNegative(row.costVnd),
      0,
    );
    const syncDates = rows
      .map((row) => this.validDate(row.lastSyncAt))
      .filter(Boolean) as Date[];
    const latest = syncDates.sort((left, right) => right.getTime() - left.getTime())[0];
    return {
      observedClicks,
      observedConversions,
      observedCpaVnd: observedConversions > 0
        ? conversionSpendVnd / observedConversions
        : null,
      clickSpendVnd,
      conversionSpendVnd,
      averageCpcVnd: observedClicks > 0 ? clickSpendVnd / observedClicks : null,
      clickFrom,
      conversionFrom,
      to,
      rowCount: rows.length,
      latestMetricSyncAt: latest ? latest.toISOString() : null,
    };
  }

  private canonicalStage(campaign: any): GoogleAdsBiddingLifecycleStage {
    const type = String(campaign?.biddingStrategyType || '').toUpperCase();
    if (type === 'MAXIMIZE_CLICKS') {
      return Number(campaign?.targetSpendCpcBidCeilingMicros || 0) > 0
        ? 'MAXIMIZE_CLICKS_CPC_CEILING'
        : 'MAXIMIZE_CLICKS';
    }
    if (type === 'MAXIMIZE_CONVERSIONS') {
      return Number(campaign?.maximizeConversionsTargetCpaMicros || 0) > 0
        ? 'MAXIMIZE_CONVERSIONS_TARGET_CPA'
        : 'MAXIMIZE_CONVERSIONS';
    }
    return 'UNMANAGED';
  }

  private transitionPayload(stage: PublicStage, policy: any) {
    if (stage === 'MAXIMIZE_CLICKS_CPC_CEILING') {
      return {
        biddingStrategyType: 'MAXIMIZE_CLICKS',
        maxCpcBidCeilingVnd: Number(policy.maxCpcBidCeilingVnd),
      };
    }
    if (stage === 'MAXIMIZE_CONVERSIONS') {
      return { biddingStrategyType: 'MAXIMIZE_CONVERSIONS' };
    }
    if (stage === 'MAXIMIZE_CONVERSIONS_TARGET_CPA') {
      return {
        biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
        targetCpaVnd: Number(policy.targetCpaVnd),
      };
    }
    throw new BadRequestException('Unsupported bidding lifecycle transition.');
  }

  private response(policy: any, override: Record<string, any> = {}) {
    const storedBlockers = Array.isArray(policy?.blockers) ? policy.blockers : [];
    const blockers = override.blockers || storedBlockers;
    const currentStage = this.publicStage(
      override.observedStage || policy?.observedStage,
    );
    const proposedStage = this.publicStage(
      override.proposedStage || policy?.proposedStage,
    );
    const metrics = override.lastMetrics || policy?.lastMetrics || {};
    const metricsWindow = override.lastMetricsWindow || policy?.lastMetricsWindow || {};
    const pendingPlanId = override.pendingPlanId || policy?.pendingPlanId;
    const pendingActionId = override.pendingActionId || policy?.pendingActionId;
    const pendingPlanStatus =
      override.pendingPlanStatus || policy?.pendingPlanStatus;
    const pendingPlanCreatedAt =
      override.pendingPlanCreatedAt || policy?.pendingPlanCreatedAt;
    const lastDecision = override.lastDecision || policy?.lastDecision;
    const lastDecisionReason =
      override.lastDecisionReason || policy?.lastDecisionReason;
    const lastDraftAt = override.lastDraftAt || policy?.lastDraftAt;
    const stageEnteredAt = override.stageEnteredAt || policy?.stageEnteredAt;
    const nextEligibleAt = this.maximumDate(
      this.nextEligibleDate(lastDraftAt, policy?.cooldownHours),
      stageEnteredAt
        ? new Date(
          new Date(stageEnteredAt).getTime()
          + Number(policy?.minimumStageDwellHours || 0) * 60 * 60 * 1000,
        )
        : undefined,
    );
    return {
      policy: {
        enabled: policy?.enabled === true,
        clickThreshold: Number(policy?.clickThreshold ?? DEFAULT_POLICY.clickThreshold),
        clickWindowDays: Number(policy?.clickWindowDays ?? DEFAULT_POLICY.clickWindowDays),
        maxCpcBidCeilingVnd: Number(policy?.maxCpcBidCeilingVnd || 0),
        maximizeConversionsMinConversions: Number(
          policy?.maximizeConversionsMinConversions
          ?? DEFAULT_POLICY.maximizeConversionsMinConversions,
        ),
        conversionWindowDays: Number(
          policy?.conversionWindowDays ?? DEFAULT_POLICY.conversionWindowDays,
        ),
        targetCpaMinConversions: Number(
          policy?.targetCpaMinConversions
          ?? DEFAULT_POLICY.targetCpaMinConversions,
        ),
        targetCpaVnd: Number(policy?.targetCpaVnd || 0),
        cooldownHours: Number(
          policy?.cooldownHours ?? DEFAULT_POLICY.cooldownHours,
        ),
        minimumStageDwellHours: Number(
          policy?.minimumStageDwellHours
          ?? DEFAULT_POLICY.minimumStageDwellHours,
        ),
        draftOnly: true as const,
      },
      state: {
        ...(currentStage ? { currentStage } : {}),
        ...(policy?.canonicalBiddingStrategyType
          ? { canonicalBiddingStrategyType: policy.canonicalBiddingStrategyType }
          : {}),
        ...(metrics.observedClicks !== undefined
          ? { observedClicks: Number(metrics.observedClicks) }
          : {}),
        ...(metrics.observedConversions !== undefined
          ? { observedConversions: Number(metrics.observedConversions) }
          : {}),
        ...(metrics.observedCpaVnd !== undefined
          && metrics.observedCpaVnd !== null
          ? { observedCpaVnd: Number(metrics.observedCpaVnd) }
          : {}),
        ...(metricsWindow.clickFrom || metricsWindow.conversionFrom
          ? {
            metricsFrom: [metricsWindow.clickFrom, metricsWindow.conversionFrom]
              .filter(Boolean)
              .sort()[0],
          }
          : {}),
        ...(metricsWindow.to ? { metricsTo: metricsWindow.to } : {}),
        ...this.isoField('lastEvaluatedAt', override.lastEvaluatedAt || policy?.lastEvaluatedAt),
        ...this.isoField('lastTransitionAt', stageEnteredAt),
        ...this.isoField('nextEligibleAt', nextEligibleAt),
        ...(lastDecision ? { lastDecision: String(lastDecision) } : {}),
        ...(lastDecisionReason
          ? { lastDecisionReason: String(lastDecisionReason) }
          : {}),
        blockers: this.unique(blockers),
        ...(pendingPlanId ? {
          pendingDraft: {
            planId: String(pendingPlanId),
            ...(pendingActionId ? { actionId: String(pendingActionId) } : {}),
            ...(currentStage ? { fromStage: currentStage } : {}),
            ...(proposedStage ? { toStage: proposedStage } : {}),
            status: String(pendingPlanStatus || 'pending_approval'),
            ...this.isoField('createdAt', pendingPlanCreatedAt || lastDraftAt),
          },
        } : {}),
      },
    };
  }

  private normalizePolicy(dto: UpsertGoogleAdsBiddingLifecycleDto, existing: any) {
    const value = {
      enabled: dto.enabled ?? existing?.enabled ?? DEFAULT_POLICY.enabled,
      clickThreshold: dto.clickThreshold
        ?? existing?.clickThreshold
        ?? DEFAULT_POLICY.clickThreshold,
      clickWindowDays: dto.clickWindowDays
        ?? existing?.clickWindowDays
        ?? DEFAULT_POLICY.clickWindowDays,
      maxCpcBidCeilingVnd: dto.maxCpcBidCeilingVnd
        ?? existing?.maxCpcBidCeilingVnd
        ?? DEFAULT_POLICY.maxCpcBidCeilingVnd,
      maximizeConversionsMinConversions: dto.maximizeConversionsMinConversions
        ?? existing?.maximizeConversionsMinConversions
        ?? DEFAULT_POLICY.maximizeConversionsMinConversions,
      conversionWindowDays: dto.conversionWindowDays
        ?? existing?.conversionWindowDays
        ?? DEFAULT_POLICY.conversionWindowDays,
      targetCpaMinConversions: dto.targetCpaMinConversions
        ?? existing?.targetCpaMinConversions
        ?? DEFAULT_POLICY.targetCpaMinConversions,
      targetCpaVnd: dto.targetCpaVnd
        ?? existing?.targetCpaVnd
        ?? DEFAULT_POLICY.targetCpaVnd,
      cooldownHours: dto.cooldownHours
        ?? existing?.cooldownHours
        ?? DEFAULT_POLICY.cooldownHours,
      minimumStageDwellHours: dto.minimumStageDwellHours
        ?? existing?.minimumStageDwellHours
        ?? DEFAULT_POLICY.minimumStageDwellHours,
    };
    this.integer(value.clickThreshold, 'clickThreshold', 1, 1_000_000);
    this.integer(value.clickWindowDays, 'clickWindowDays', 1, 90);
    this.integer(
      value.maximizeConversionsMinConversions,
      'maximizeConversionsMinConversions',
      1,
      1_000_000,
    );
    this.integer(value.conversionWindowDays, 'conversionWindowDays', 1, 90);
    this.integer(
      value.targetCpaMinConversions,
      'targetCpaMinConversions',
      1,
      1_000_000,
    );
    this.integer(value.cooldownHours, 'cooldownHours', 0, 24 * 365);
    this.integer(
      value.minimumStageDwellHours,
      'minimumStageDwellHours',
      0,
      24 * 365,
    );
    if (value.targetCpaMinConversions < value.maximizeConversionsMinConversions) {
      throw new BadRequestException(
        'targetCpaMinConversions cannot be lower than maximizeConversionsMinConversions.',
      );
    }
    if (value.enabled) {
      this.integer(
        value.maxCpcBidCeilingVnd,
        'maxCpcBidCeilingVnd',
        1,
        this.positiveIntegerEnv(
          'GOOGLE_ADS_MAX_CPC_BID_VND',
          1_000_000,
          2_000_000_000,
        ),
      );
      this.integer(
        value.targetCpaVnd,
        'targetCpaVnd',
        1,
        this.positiveIntegerEnv(
          'GOOGLE_ADS_MAX_TARGET_CPA_VND',
          100_000_000,
          2_000_000_000,
        ),
      );
    } else {
      if (value.maxCpcBidCeilingVnd) {
        this.integer(
          value.maxCpcBidCeilingVnd,
          'maxCpcBidCeilingVnd',
          1,
          this.positiveIntegerEnv(
            'GOOGLE_ADS_MAX_CPC_BID_VND',
            1_000_000,
            2_000_000_000,
          ),
        );
      }
      if (value.targetCpaVnd) {
        this.integer(
          value.targetCpaVnd,
          'targetCpaVnd',
          1,
          this.positiveIntegerEnv(
            'GOOGLE_ADS_MAX_TARGET_CPA_VND',
            100_000_000,
            2_000_000_000,
          ),
        );
      }
    }
    return value;
  }

  private ids(customerId: string, campaignId: string) {
    const customer = String(customerId || '').trim();
    const campaign = String(campaignId || '').trim();
    if (!/^\d+$/.test(customer) || !/^\d+$/.test(campaign)) {
      throw new BadRequestException('Numeric customerId and campaignId are required.');
    }
    return { customerId: customer, campaignId: campaign };
  }

  private idempotencyKey(
    customerId: string,
    campaignId: string,
    stage: PublicStage,
    dateTo: string,
    metricsHash: string,
    policyVersion: number,
  ) {
    const stageCode: Record<PublicStage, string> = {
      MAXIMIZE_CLICKS: 'MC',
      MAXIMIZE_CLICKS_CPC_CEILING: 'MCC',
      MAXIMIZE_CONVERSIONS: 'MV',
      MAXIMIZE_CONVERSIONS_TARGET_CPA: 'MVCPA',
    };
    return [
      'GADS',
      'BID',
      customerId,
      campaignId,
      stageCode[stage],
      dateTo.replace(/-/g, ''),
      `V${Math.max(1, Math.floor(policyVersion))}`,
      metricsHash.slice(0, 16).toUpperCase(),
    ].join(':');
  }

  private metricsHash(rows: any[]) {
    const normalized = rows
      .map((row) => ({
        date: String(row.date || ''),
        costVnd: this.nonNegative(row.costVnd),
        clicks: this.nonNegative(row.clicks),
        conversions: this.nonNegative(row.conversions),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private biddingAction(plan: any) {
    return (plan?.items || plan?.actions || []).find(
      (item: any) => item?.actionType === 'update_campaign_bidding_strategy',
    );
  }

  private isIdempotencyConflict(error: any) {
    return Number(error?.status || error?.statusCode) === 409
      || /idempotency|already exists|duplicate key/i.test(
        String(error?.message || ''),
      );
  }

  private publicStage(value: unknown): PublicStage | undefined {
    const stage = String(value || '') as GoogleAdsBiddingLifecycleStage;
    return stage && stage !== 'UNMANAGED' ? stage as PublicStage : undefined;
  }

  private nextEligibleDate(value: unknown, cooldownHours: unknown) {
    const date = this.validDate(value);
    if (!date) return undefined;
    return new Date(
      date.getTime() + Number(cooldownHours || 0) * 60 * 60 * 1000,
    );
  }

  private maximumDate(...values: Array<Date | undefined>) {
    const valid = values.filter(
      (value): value is Date => Boolean(value && !Number.isNaN(value.getTime())),
    );
    return valid.sort((left, right) => right.getTime() - left.getTime())[0];
  }

  private validDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value as any);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private isStale(value: unknown, maximumAgeMs: number) {
    const date = this.validDate(value);
    if (!date) return true;
    const now = Date.now();
    return date.getTime() > now + 60_000 || now - date.getTime() > maximumAgeMs;
  }

  private canonicalMaximumAgeMs() {
    return this.positiveIntegerEnv(
      'GOOGLE_ADS_CANONICAL_SYNC_MAX_AGE_MS',
      15 * 60 * 1000,
      24 * 60 * 60 * 1000,
    );
  }

  private metricMaximumAgeMs() {
    return this.positiveIntegerEnv(
      'GOOGLE_ADS_BIDDING_METRICS_MAX_AGE_HOURS',
      48,
      24 * 31,
    ) * 60 * 60 * 1000;
  }

  private leaseTtlMs() {
    return this.positiveIntegerEnv(
      'GOOGLE_ADS_BIDDING_LIFECYCLE_LEASE_MS',
      5 * 60 * 1000,
      30 * 60 * 1000,
    );
  }

  private positiveIntegerEnv(name: string, fallback: number, maximum: number) {
    const value = Number(process.env[name]);
    if (!Number.isInteger(value) || value <= 0) return fallback;
    return Math.min(value, maximum);
  }

  private integer(
    value: unknown,
    field: string,
    minimum: number,
    maximum: number,
  ) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new BadRequestException(
        `${field} must be an integer between ${minimum} and ${maximum}.`,
      );
    }
  }

  private nonNegative(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private yesterdayDateKey(now: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private addIsoDays(value: string, days: number) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private actor(value?: string) {
    const normalized = String(value || 'google-ads-bidding-lifecycle').trim();
    return normalized.slice(0, 200) || 'google-ads-bidding-lifecycle';
  }

  private unique(values: unknown[]) {
    return [...new Set(
      (values || []).map((value) => String(value || '').trim()).filter(Boolean),
    )];
  }

  private isoField(key: string, value: unknown) {
    const date = this.validDate(value);
    return date ? { [key]: date.toISOString() } : {};
  }
}
