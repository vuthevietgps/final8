import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { redactSecrets, redactSecretString } from '../common/utils/secret-redaction.util';
import {
  MetaAdsExecutionPolicyService,
  MetaAdsExecutionPreflight,
} from './meta-ads-execution-policy.service';
import {
  MetaAdsCampaignSnapshot,
  MetaAdsAdCreativeSnapshot,
  MetaAdsAdSetSnapshot,
  MetaAdsAdSnapshot,
  MetaAdsProviderClientService,
  MetaAdsProviderError,
  MetaAdsResourceSnapshot,
} from './meta-ads-provider-client.service';
import {
  MetaAdsActionPlan,
  MetaAdsActionPlanDocument,
  MetaAdsCanonicalAction,
} from './schemas/meta-ads-action-plan.schema';
import {
  MetaAdsCampaign,
  MetaAdsCampaignDocument,
} from './schemas/meta-ads-campaign.schema';
import {
  MetaAdsExecutionLog,
  MetaAdsExecutionLogDocument,
  MetaAdsExecutionLogStatus,
} from './schemas/meta-ads-execution-log.schema';
import {
  MetaAdsExecutionReservation,
  MetaAdsExecutionReservationDocument,
  MetaAdsExecutionReservationStatus,
} from './schemas/meta-ads-execution-reservation.schema';
import {
  MetaAdsAdSet,
  MetaAdsAdSetDocument,
} from './schemas/meta-ads-ad-set.schema';
import {
  MetaAdsAdCreative,
  MetaAdsAdCreativeDocument,
} from './schemas/meta-ads-ad-creative.schema';
import { MetaAdsAd, MetaAdsAdDocument } from './schemas/meta-ads-ad.schema';

type ExecuteBody = {
  actionIds: string[];
  dryRun?: boolean;
  validateOnly?: boolean;
  source?: 'erp_ui' | 'codex_operator';
};

@Injectable()
export class MetaAdsExecutionService {
  constructor(
    @InjectModel(MetaAdsActionPlan.name)
    private readonly planModel: Model<MetaAdsActionPlanDocument>,
    @InjectModel(MetaAdsExecutionReservation.name)
    private readonly reservationModel: Model<MetaAdsExecutionReservationDocument>,
    @InjectModel(MetaAdsExecutionLog.name)
    private readonly executionLogModel: Model<MetaAdsExecutionLogDocument>,
    @InjectModel(MetaAdsCampaign.name)
    private readonly campaignModel: Model<MetaAdsCampaignDocument>,
    @InjectModel(MetaAdsAdSet.name)
    private readonly adSetModel: Model<MetaAdsAdSetDocument>,
    @InjectModel(MetaAdsAdCreative.name)
    private readonly creativeModel: Model<MetaAdsAdCreativeDocument>,
    @InjectModel(MetaAdsAd.name)
    private readonly adModel: Model<MetaAdsAdDocument>,
    private readonly policy: MetaAdsExecutionPolicyService,
    private readonly providerClient: MetaAdsProviderClientService,
  ) {}

  async execute(currentUser: any, planIdInput: string, body: ExecuteBody) {
    const planId = this.requiredText(planIdInput, 'planId');
    const actionIds = this.actionIds(body?.actionIds);
    if (!['erp_ui', 'codex_operator'].includes(String(body?.source || ''))) {
      throw new BadRequestException('Meta execution source must be erp_ui or codex_operator.');
    }
    if (body?.validateOnly === true) {
      throw new BadRequestException('Use the Meta provider validation endpoint for validate_only.');
    }
    const plan = await this.loadPlan(planId);
    const actions = actionIds.map((actionId) => this.findAction(plan, actionId));

    if (body?.dryRun === true) {
      const diagnostics = [];
      for (const action of actions) {
        diagnostics.push(
          await this.policy.dryRunDiagnostic(action, currentUser, plan.createdByUserId),
        );
      }
      return {
        success: diagnostics.every((item) => item.liveEligible),
        dryRun: true,
        status: diagnostics.every((item) => item.liveEligible) ? 'eligible' : 'blocked',
        planId,
        executed: 0,
        failed: 0,
        providerNetworkCalled: false,
        actions: diagnostics,
      };
    }
    if (body?.validateOnly !== false) {
      throw new BadRequestException('Meta live execution requires validateOnly=false explicitly.');
    }

    const results = [];
    for (const action of actions) {
      try {
        const preflight = await this.policy.preflightLive(plan, action, currentUser);
        results.push(await this.executeOne(preflight, currentUser));
      } catch (error: any) {
        results.push({
          actionId: action.actionId,
          status: 'blocked',
          success: false,
          error: redactSecretString(String(error?.message || 'Meta execution preflight failed.')),
        });
      }
    }
    const failed = results.filter((result) => result.success !== true).length;
    return {
      success: failed === 0,
      dryRun: false,
      status: failed === 0 ? 'executed' : failed === results.length ? 'failed' : 'partial',
      planId,
      executed: results.length - failed,
      failed,
      actions: results,
    };
  }

  async evaluateEligibility(currentUser: any, planIdInput: string, actionIdsInput?: string[]) {
    const planId = this.requiredText(planIdInput, 'planId');
    const plan = await this.loadPlan(planId);
    const actions = actionIdsInput?.length
      ? this.actionIds(actionIdsInput).map((actionId) => this.findAction(plan, actionId))
      : plan.actions;
    const diagnostics = [];
    for (const action of actions) {
      diagnostics.push(
        await this.policy.dryRunDiagnostic(action, currentUser, plan.createdByUserId),
      );
    }
    return {
      success: true,
      dryRun: true,
      status: diagnostics.every((item) => item.liveEligible) ? 'eligible' : 'blocked',
      planId,
      providerNetworkCalled: false,
      actions: diagnostics.map((item) => ({ ...item, status: item.liveEligible ? 'eligible' : 'blocked' })),
    };
  }

  async getExecutions(planIdInput: string, limitInput?: number) {
    const planId = this.requiredText(planIdInput, 'planId');
    const exists = await this.planModel.exists({ planId });
    if (!exists) throw new NotFoundException('Meta Ads action plan not found.');
    const requested = Number(limitInput);
    const limit = Number.isFinite(requested)
      ? Math.min(500, Math.max(1, Math.floor(requested)))
      : 100;
    const records: any[] = await this.executionLogModel
      .find({ planId })
      .sort({ executedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    const executions = records.map((record) => {
      const safe: any = redactSecrets(record);
      delete safe.credentialReferenceId;
      return safe;
    });
    return { success: true, planId, total: executions.length, limit, executions };
  }

  /**
   * Read-only reconciliation for a reserved mutation. It never issues POST and
   * therefore cannot duplicate a create/update when the original outcome was unknown.
   */
  async reconcile(idempotencyKeyInput: string) {
    const idempotencyKey = this.requiredText(idempotencyKeyInput, 'idempotencyKey');
    const reservation: any = await this.reservationModel.findOne({ idempotencyKey });
    if (!reservation) throw new NotFoundException('Meta execution reservation not found.');
    if (reservation.status === 'reconciled') {
      return {
        success: true,
        status: 'reconciled',
        idempotencyKey,
        resourceId: reservation.resourceId,
        campaignId: reservation.campaignId,
        adSetId: reservation.adSetId,
        creativeId: reservation.creativeId,
        adId: reservation.adId,
      };
    }
    const plan = await this.loadPlan(reservation.planId);
    const action = this.findAction(plan, reservation.actionId);
    const resourceId = this.reservationResourceId(reservation, action);
    if (!resourceId) {
      throw new ConflictException(
        'Unknown Meta create outcome has no resource ID; automatic mutation retry is forbidden.',
      );
    }
    const snapshot = await this.readAfter(
      action,
      resourceId,
      reservation.credentialReferenceId,
      3,
    );
    this.assertReadback({ action } as MetaAdsExecutionPreflight, snapshot);
    await this.persistSnapshot(
      snapshot,
      action,
      reservation.planId,
      reservation.idempotencyKey,
    );
    await this.reservationModel.updateOne(
      { _id: reservation._id, status: { $ne: 'reconciled' } },
      { $set: { status: 'reconciled', reconciledAt: new Date() } },
    );
    await this.executionLogModel.updateOne(
      { reservationId: reservation._id },
      { $set: { status: 'reconciled', afterState: snapshot, reconciledAt: new Date() } },
    );
    await this.planModel.updateOne(
      {
        planId: reservation.planId,
        actions: {
          $elemMatch: {
            actionId: reservation.actionId,
            workflowStatus: { $in: ['executing', 'failed'] },
          },
        },
      },
      {
        $set: { 'actions.$.workflowStatus': 'executed' },
        $inc: { 'actions.$.revision': 1, revision: 1 },
      },
    );
    return {
      success: true,
      status: 'reconciled',
      idempotencyKey,
      resourceId,
      ...this.snapshotIds(snapshot),
    };
  }

  private async executeOne(preflight: MetaAdsExecutionPreflight, currentUser: any) {
    const { plan, action } = preflight;
    const executedByUserId = this.policy.userId(currentUser);
    const reservation = await this.reserve(preflight, executedByUserId);
    try {
      await this.claimAction(plan.planId, action);
    } catch (error) {
      // The provider boundary has not been reached yet, so this is not an
      // unknown outcome. Release only the still-unused reservation; once its
      // status advances, the idempotency key remains immutable.
      await this.reservationModel.deleteOne({
        _id: reservation._id,
        status: 'reserved',
      });
      throw error;
    }
    let log: any = await this.executionLogModel.create({
      planId: plan.planId,
      actionId: action.actionId,
      idempotencyKey: action.idempotencyKey,
      reservationId: reservation._id,
      actionType: action.actionType,
      adAccountId: action.adAccountId,
      campaignId: action.campaignId,
      adSetId: action.adSetId,
      creativeId: action.creativeId,
      adId: action.adId,
      status: 'executing',
      payloadHash: preflight.payloadHash,
      validationBeforeStateHash: action.providerValidationBeforeStateHash,
      executionBeforeStateHash: preflight.beforeStateHash,
      graphApiVersion: preflight.graphApiVersion,
      credentialReferenceId: preflight.credentialReferenceId,
      approvedByUserId: action.approvedByUserId,
      executedByUserId,
      beforeState: preflight.beforeState,
      providerErrors: [],
      executedAt: new Date(),
    });

    try {
      const started = await this.reservationModel.updateOne(
        { _id: reservation._id, status: 'reserved' },
        { $set: { status: 'provider_call_started', providerCallStartedAt: new Date() } },
      );
      if (started.matchedCount !== 1) {
        throw new MetaAdsProviderError(
          'Meta execution reservation changed before provider call; no mutation was attempted.',
          'definitive_failure',
        );
      }
      const provider = await this.providerClient.mutate(
        preflight.providerAction,
        preflight.credentialReferenceId,
      );
      const resourceId = provider.resourceId || this.actionResourceId(action);
      const ids = {
        campaignId: provider.campaignId || action.campaignId,
        adSetId: provider.adSetId || action.adSetId,
        creativeId: provider.creativeId || action.creativeId,
        adId: provider.adId || action.adId,
      };
      const accepted = await this.reservationModel.updateOne(
        { _id: reservation._id, status: 'provider_call_started' },
        {
          $set: {
            status: 'provider_mutation_succeeded',
            resourceId,
            ...ids,
            providerRespondedAt: new Date(),
            providerRequestId: provider.providerRequestId,
          },
        },
      );
      if (accepted.matchedCount !== 1) {
        throw new MetaAdsProviderError(
          'Meta provider accepted the mutation but its reservation could not be advanced.',
          'unknown',
          provider.providerRequestId,
        );
      }
      log.status = 'provider_mutation_succeeded';
      log.resourceId = resourceId;
      Object.assign(log, ids);
      log.providerRequestId = provider.providerRequestId;
      log.providerResponse = provider.response;
      await log.save();

      if (!resourceId) {
        throw new MetaAdsProviderError(
          'Meta mutation has no resource ID for readback.',
          'unknown',
        );
      }
      const afterState = await this.readAfter(
        action,
        resourceId,
        preflight.credentialReferenceId,
        3,
      );
      this.assertReadback(preflight, afterState);
      await this.persistSnapshot(afterState, action, plan.planId, action.idempotencyKey);
      await this.reservationModel.updateOne(
        { _id: reservation._id, status: 'provider_mutation_succeeded' },
        { $set: { status: 'reconciled', reconciledAt: new Date() } },
      );
      log.status = 'reconciled';
      log.afterState = afterState;
      log.reconciledAt = new Date();
      await log.save();
      await this.transitionAction(plan.planId, action.actionId, 'executing', 'executed');
      return {
        actionId: action.actionId,
        success: true,
        status: 'reconciled',
        resourceId,
        ...this.snapshotIds(afterState),
        providerRequestId: provider.providerRequestId,
      };
    } catch (error: any) {
      const providerError = error instanceof MetaAdsProviderError ? error : undefined;
      const reservationStatus: MetaAdsExecutionReservationStatus = providerError?.outcome === 'definitive_failure'
        ? 'provider_failed_definitive'
        : (log.status === 'provider_mutation_succeeded'
          ? 'provider_mutation_succeeded'
          : 'provider_outcome_unknown');
      const logStatus: MetaAdsExecutionLogStatus = reservationStatus === 'provider_failed_definitive'
        ? 'provider_failed_definitive'
        : (reservationStatus === 'provider_mutation_succeeded'
          ? 'provider_mutation_succeeded'
          : 'provider_outcome_unknown');
      const message = redactSecretString(String(error?.message || 'Meta provider execution failed.'));
      await this.reservationModel.updateOne(
        { _id: reservation._id, status: { $ne: 'reconciled' } },
        {
          $set: {
            status: reservationStatus,
            providerRespondedAt: new Date(),
            providerRequestId: providerError?.providerRequestId || log.providerRequestId,
          },
        },
      );
      log.status = logStatus;
      log.providerRequestId = providerError?.providerRequestId || log.providerRequestId;
      log.providerErrors = [{ code: providerError?.providerCode, message }];
      await log.save();
      await this.transitionAction(plan.planId, action.actionId, 'executing', 'failed');
      return {
        actionId: action.actionId,
        success: false,
        status: logStatus,
        resourceId: log.resourceId,
        campaignId: log.campaignId,
        adSetId: log.adSetId,
        creativeId: log.creativeId,
        adId: log.adId,
        providerRequestId: log.providerRequestId,
        error: message,
        retryMutationAllowed: false,
      };
    }
  }

  private async reserve(preflight: MetaAdsExecutionPreflight, executedByUserId: string) {
    try {
      return await this.reservationModel.create({
        idempotencyKey: preflight.action.idempotencyKey,
        planId: preflight.plan.planId,
        actionId: preflight.action.actionId,
        actionType: preflight.action.actionType,
        adAccountId: preflight.action.adAccountId,
        campaignId: preflight.action.campaignId,
        adSetId: preflight.action.adSetId,
        creativeId: preflight.action.creativeId,
        adId: preflight.action.adId,
        resourceId: this.actionResourceId(preflight.action),
        status: 'reserved',
        payloadHash: preflight.payloadHash,
        validationBeforeStateHash: preflight.beforeStateHash,
        executedByUserId,
        approvedByUserId: preflight.action.approvedByUserId,
        credentialReferenceId: preflight.credentialReferenceId,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException(
          `Meta idempotencyKey is already reserved and will not be retried: ${preflight.action.idempotencyKey}`,
        );
      }
      throw error;
    }
  }

  private async claimAction(planId: string, action: MetaAdsCanonicalAction) {
    const updated = await this.planModel.updateOne(
      {
        planId,
        actions: {
          $elemMatch: {
            actionId: action.actionId,
            workflowStatus: 'approved',
            revision: action.revision,
          },
        },
      },
      {
        $set: { 'actions.$.workflowStatus': 'executing' },
        $inc: { 'actions.$.revision': 1, revision: 1 },
      },
    );
    if (updated.matchedCount !== 1) {
      throw new ConflictException(
        `Meta action ${action.actionId} changed concurrently; immutable reservation remains in place.`,
      );
    }
  }

  private async transitionAction(
    planId: string,
    actionId: string,
    from: string,
    to: string,
  ) {
    await this.planModel.updateOne(
      { planId, actions: { $elemMatch: { actionId, workflowStatus: from } } },
      {
        $set: { 'actions.$.workflowStatus': to },
        $inc: { 'actions.$.revision': 1, revision: 1 },
      },
    );
  }

  private assertReadback(
    preflight: MetaAdsExecutionPreflight,
    snapshot: MetaAdsResourceSnapshot,
  ) {
    const action = preflight.action;
    if (snapshot.adAccountId !== action.adAccountId) {
      throw new MetaAdsProviderError('Meta readback account mismatch.', 'unknown');
    }
    if (action.actionType === 'create_campaign') {
      const campaign = snapshot as MetaAdsCampaignSnapshot;
      if (campaign.status !== 'PAUSED'
        || campaign.name !== action.name
        || campaign.objective !== action.objective
        || campaign.buyingType !== 'AUCTION'
        || campaign.budgetMode !== action.budgetMode
        || campaign.budgetType !== action.budgetType
        || !this.sameStrings(campaign.specialAdCategories, action.specialAdCategories)
        || !this.sameStrings(
          campaign.specialAdCategoryCountries,
          action.specialAdCategoryCountries || [],
        )
        || (action.dailyBudgetVnd !== undefined
          && campaign.dailyBudgetVnd !== action.dailyBudgetVnd)
        || (action.lifetimeBudgetVnd !== undefined
          && campaign.lifetimeBudgetVnd !== action.lifetimeBudgetVnd)
        || (action.bidStrategy !== undefined && campaign.bidStrategy !== action.bidStrategy)
        || (action.spendCapVnd !== undefined && campaign.spendCapVnd !== action.spendCapVnd)
        || !this.sameInstant(campaign.startTime, action.startTime)
        || !this.sameInstant(campaign.stopTime, action.stopTime)
        || (action.appId !== undefined && campaign.appId !== action.appId)) {
        throw new MetaAdsProviderError('Created Meta campaign readback does not match the approved action.', 'unknown');
      }
    }
    if (action.actionType === 'create_ad_set') {
      const adSet = snapshot as MetaAdsAdSetSnapshot;
      if (adSet.resourceType !== 'AD_SET'
        || adSet.campaignId !== action.campaignId
        || adSet.status !== 'PAUSED'
        || adSet.name !== action.name
        || adSet.budgetMode !== action.budgetMode
        || adSet.budgetType !== action.budgetType
        || adSet.optimizationGoal !== action.optimizationGoal
        || adSet.billingEvent !== action.billingEvent
        || adSet.destinationType !== action.destinationType
        || (action.dailyBudgetVnd !== undefined
          && adSet.dailyBudgetVnd !== action.dailyBudgetVnd)
        || (action.lifetimeBudgetVnd !== undefined
          && adSet.lifetimeBudgetVnd !== action.lifetimeBudgetVnd)
        || (action.bidStrategy !== undefined && adSet.bidStrategy !== action.bidStrategy)
        || (action.bidAmountVnd !== undefined && adSet.bidAmountVnd !== action.bidAmountVnd)
        || !this.sameStrings(adSet.targetingCountries, action.targetingCountries)
        || !this.sameStrings(adSet.publisherPlatforms, action.publisherPlatforms)
        || !this.sameStrings(adSet.facebookPositions, action.facebookPositions)
        || !this.sameStrings(adSet.instagramPositions, action.instagramPositions)
        || !this.sameNumbers(adSet.genders, action.genders)
        || (action.ageMin !== undefined && adSet.ageMin !== action.ageMin)
        || (action.ageMax !== undefined && adSet.ageMax !== action.ageMax)
        || (action.pageId !== undefined && adSet.pageId !== action.pageId)
        || (action.pixelId !== undefined && adSet.pixelId !== action.pixelId)
        || (action.applicationId !== undefined
          && adSet.applicationId !== action.applicationId)
        || (action.objectStoreUrl !== undefined
          && adSet.objectStoreUrl !== action.objectStoreUrl)
        || (action.customEventType !== undefined
          && adSet.customEventType !== action.customEventType)
        || !this.sameInstant(adSet.startTime, action.startTime)
        || !this.sameInstant(adSet.stopTime, action.stopTime)) {
        throw new MetaAdsProviderError(
          'Created Meta Ad Set readback does not match the approved action.',
          'unknown',
        );
      }
    }
    if (action.actionType === 'pause_ad_set'
      && ((snapshot as MetaAdsAdSetSnapshot).resourceType !== 'AD_SET'
        || (snapshot as MetaAdsAdSetSnapshot).campaignId !== action.campaignId
        || (snapshot as MetaAdsAdSetSnapshot).adSetId !== action.adSetId
        || (snapshot as MetaAdsAdSetSnapshot).status !== 'PAUSED')) {
      throw new MetaAdsProviderError(
        'Paused Meta Ad Set readback is not PAUSED.',
        'unknown',
      );
    }
    if (action.actionType === 'create_ad_creative') {
      const creative = snapshot as MetaAdsAdCreativeSnapshot;
      if (creative.resourceType !== 'AD_CREATIVE'
        || creative.name !== action.name
        || creative.pageId !== action.pageId
        || (action.instagramActorId !== undefined
          && creative.instagramActorId !== action.instagramActorId)
        || creative.message !== action.message
        || creative.headline !== action.headline
        || creative.description !== action.description
        || creative.callToActionType !== action.callToActionType
        || creative.destinationUrl !== action.destinationUrl
        || creative.imageHash !== action.imageHash
        || creative.videoId !== action.videoId
        || creative.urlTags !== action.urlTags) {
        throw new MetaAdsProviderError(
          'Created Meta Ad Creative readback does not match the approved action.',
          'unknown',
        );
      }
    }
    if (action.actionType === 'create_ad') {
      const ad = snapshot as MetaAdsAdSnapshot;
      if (ad.resourceType !== 'AD'
        || ad.adSetId !== action.adSetId
        || ad.creativeId !== action.creativeId
        || ad.name !== action.name
        || ad.status !== 'PAUSED') {
        throw new MetaAdsProviderError(
          'Created Meta Ad readback does not match the approved action.',
          'unknown',
        );
      }
    }
    if (action.actionType === 'update_campaign') {
      const campaign = snapshot as MetaAdsCampaignSnapshot;
      if ((action.name !== undefined && campaign.name !== action.name)
        || (action.dailyBudgetVnd !== undefined
          && campaign.dailyBudgetVnd !== action.dailyBudgetVnd)
        || (action.lifetimeBudgetVnd !== undefined
          && campaign.lifetimeBudgetVnd !== action.lifetimeBudgetVnd)
        || (action.spendCapVnd !== undefined
          && campaign.spendCapVnd !== action.spendCapVnd)
        || !this.sameInstant(campaign.stopTime, action.stopTime)) {
        throw new MetaAdsProviderError('Updated Meta campaign readback does not match the approved action.', 'unknown');
      }
    }
    if (action.actionType === 'pause_campaign'
      && (snapshot as MetaAdsCampaignSnapshot).status !== 'PAUSED') {
      throw new MetaAdsProviderError('Paused Meta campaign readback is not PAUSED.', 'unknown');
    }
  }

  private async persistCampaign(
    snapshot: MetaAdsCampaignSnapshot,
    planId: string,
    idempotencyKey: string,
  ) {
    await this.campaignModel.updateOne(
      { adAccountId: snapshot.adAccountId, campaignId: snapshot.campaignId },
      {
        $set: {
          name: snapshot.name,
          objective: snapshot.objective,
          status: snapshot.status,
          effectiveStatus: snapshot.effectiveStatus,
          buyingType: snapshot.buyingType,
          specialAdCategories: snapshot.specialAdCategories,
          specialAdCategoryCountries: snapshot.specialAdCategoryCountries,
          budgetMode: snapshot.budgetMode,
          budgetType: snapshot.budgetType,
          dailyBudgetVnd: snapshot.dailyBudgetVnd,
          lifetimeBudgetVnd: snapshot.lifetimeBudgetVnd,
          bidStrategy: snapshot.bidStrategy,
          spendCapVnd: snapshot.spendCapVnd,
          startTime: snapshot.startTime ? new Date(snapshot.startTime) : undefined,
          stopTime: snapshot.stopTime ? new Date(snapshot.stopTime) : undefined,
          appId: snapshot.appId,
          providerUpdatedAt: snapshot.providerUpdatedAt
            ? new Date(snapshot.providerUpdatedAt)
            : undefined,
          lastReadbackAt: new Date(),
          sourcePlanId: planId,
          sourceIdempotencyKey: idempotencyKey,
        },
        $setOnInsert: {
          adAccountId: snapshot.adAccountId,
          campaignId: snapshot.campaignId,
        },
      },
      { upsert: true },
    );
  }

  private async persistSnapshot(
    snapshot: MetaAdsResourceSnapshot,
    action: MetaAdsCanonicalAction,
    planId: string,
    idempotencyKey: string,
  ): Promise<void> {
    if ((snapshot as any).resourceType === 'AD_SET') {
      const adSet = snapshot as MetaAdsAdSetSnapshot;
      await this.adSetModel.updateOne(
        { adAccountId: adSet.adAccountId, adSetId: adSet.adSetId },
        {
          $set: {
            campaignId: adSet.campaignId,
            name: adSet.name,
            status: adSet.status,
            effectiveStatus: adSet.effectiveStatus,
            budgetMode: adSet.budgetMode,
            budgetType: adSet.budgetType,
            dailyBudgetVnd: adSet.dailyBudgetVnd,
            lifetimeBudgetVnd: adSet.lifetimeBudgetVnd,
            bidStrategy: adSet.bidStrategy,
            bidAmountVnd: adSet.bidAmountVnd,
            optimizationGoal: adSet.optimizationGoal,
            billingEvent: adSet.billingEvent,
            destinationType: adSet.destinationType,
            targetingCountries: adSet.targetingCountries,
            ageMin: adSet.ageMin,
            ageMax: adSet.ageMax,
            genders: adSet.genders,
            publisherPlatforms: adSet.publisherPlatforms,
            facebookPositions: adSet.facebookPositions,
            instagramPositions: adSet.instagramPositions,
            pageId: adSet.pageId,
            pixelId: adSet.pixelId,
            applicationId: adSet.applicationId,
            objectStoreUrl: adSet.objectStoreUrl,
            customEventType: adSet.customEventType,
            startTime: adSet.startTime ? new Date(adSet.startTime) : undefined,
            stopTime: adSet.stopTime ? new Date(adSet.stopTime) : undefined,
            ...(action.actionType === 'create_ad_set'
              ? {
                internalAdGroupId: action.internalAdGroupId,
                internalProductIds: action.internalProductIds || [],
              }
              : {}),
            providerUpdatedAt: adSet.providerUpdatedAt
              ? new Date(adSet.providerUpdatedAt)
              : undefined,
            lastReadbackAt: new Date(),
            sourcePlanId: planId,
            sourceIdempotencyKey: idempotencyKey,
          },
          $setOnInsert: {
            adAccountId: adSet.adAccountId,
            adSetId: adSet.adSetId,
          },
        },
        { upsert: true },
      );
      return;
    }
    if ((snapshot as any).resourceType === 'AD_CREATIVE') {
      const creative = snapshot as MetaAdsAdCreativeSnapshot;
      await this.creativeModel.updateOne(
        { adAccountId: creative.adAccountId, creativeId: creative.creativeId },
        {
          $set: {
            name: creative.name,
            pageId: creative.pageId,
            instagramActorId: creative.instagramActorId,
            message: creative.message,
            headline: creative.headline,
            description: creative.description,
            callToActionType: creative.callToActionType,
            destinationUrl: creative.destinationUrl,
            imageHash: creative.imageHash,
            videoId: creative.videoId,
            urlTags: creative.urlTags,
            lastReadbackAt: new Date(),
            sourcePlanId: planId,
            sourceIdempotencyKey: idempotencyKey,
          },
          $setOnInsert: {
            adAccountId: creative.adAccountId,
            creativeId: creative.creativeId,
          },
        },
        { upsert: true },
      );
      return;
    }
    if ((snapshot as any).resourceType === 'AD') {
      const ad = snapshot as MetaAdsAdSnapshot;
      await this.adModel.updateOne(
        { adAccountId: ad.adAccountId, adId: ad.adId },
        {
          $set: {
            adSetId: ad.adSetId,
            creativeId: ad.creativeId,
            name: ad.name,
            status: ad.status,
            effectiveStatus: ad.effectiveStatus,
            providerUpdatedAt: ad.providerUpdatedAt
              ? new Date(ad.providerUpdatedAt)
              : undefined,
            lastReadbackAt: new Date(),
            sourcePlanId: planId,
            sourceIdempotencyKey: idempotencyKey,
          },
          $setOnInsert: {
            adAccountId: ad.adAccountId,
            adId: ad.adId,
          },
        },
        { upsert: true },
      );
      return;
    }
    await this.persistCampaign(
      snapshot as MetaAdsCampaignSnapshot,
      planId,
      idempotencyKey,
    );
  }

  private async readAfter(
    action: MetaAdsCanonicalAction,
    resourceId: string,
    credentialReferenceId: string,
    attempts: number,
  ): Promise<MetaAdsResourceSnapshot> {
    const options = {
      attempts,
      expectedCredentialReferenceId: credentialReferenceId,
    };
    switch (action.actionType) {
      case 'create_ad_set':
      case 'pause_ad_set':
        return this.providerClient.readAdSet(action.adAccountId, resourceId, options);
      case 'create_ad_creative':
        return this.providerClient.readAdCreative(action.adAccountId, resourceId, options);
      case 'create_ad':
        return this.providerClient.readAd(action.adAccountId, resourceId, options);
      default:
        return this.providerClient.readCampaign(action.adAccountId, resourceId, options);
    }
  }

  private actionResourceId(action: MetaAdsCanonicalAction): string | undefined {
    switch (action.actionType) {
      case 'update_campaign':
      case 'pause_campaign':
        return action.campaignId;
      case 'pause_ad_set':
        return action.adSetId;
      default:
        return undefined;
    }
  }

  private reservationResourceId(
    reservation: any,
    action: MetaAdsCanonicalAction,
  ): string | undefined {
    return reservation.resourceId
      || (action.actionType === 'create_campaign' ? reservation.campaignId : undefined)
      || (action.actionType === 'create_ad_set' ? reservation.adSetId : undefined)
      || (action.actionType === 'create_ad_creative' ? reservation.creativeId : undefined)
      || (action.actionType === 'create_ad' ? reservation.adId : undefined)
      || this.actionResourceId(action);
  }

  private snapshotIds(snapshot: MetaAdsResourceSnapshot): Record<string, string> {
    const value = snapshot as any;
    return Object.fromEntries(
      ['campaignId', 'adSetId', 'creativeId', 'adId']
        .filter((key) => value[key])
        .map((key) => [key, value[key]]),
    );
  }

  private async loadPlan(planId: string): Promise<MetaAdsActionPlanDocument> {
    const plan = await this.planModel.findOne({ planId });
    if (!plan) throw new NotFoundException('Meta Ads action plan not found.');
    return plan;
  }

  private findAction(plan: MetaAdsActionPlan, actionId: string): MetaAdsCanonicalAction {
    const action = plan.actions.find((item) => item.actionId === actionId);
    if (!action) throw new NotFoundException(`Meta Ads action not found: ${actionId}.`);
    return action;
  }

  private actionIds(value: string[]): string[] {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException('actionIds must explicitly select at least one Meta action.');
    }
    const normalized = value.map((item) => this.requiredText(item, 'actionId'));
    if (normalized.length > 50 || new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('actionIds must be unique and contain at most 50 actions.');
    }
    return normalized;
  }

  private requiredText(value: unknown, field: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) throw new BadRequestException(`${field} is required.`);
    return normalized;
  }

  private sameStrings(actual: string[] | undefined, expected: string[] | undefined): boolean {
    const left = [...(actual || [])].map((item) => String(item).toUpperCase()).sort();
    const right = [...(expected || [])].map((item) => String(item).toUpperCase()).sort();
    return left.length === right.length && left.every((item, index) => item === right[index]);
  }

  private sameNumbers(actual: number[] | undefined, expected: number[] | undefined): boolean {
    const left = [...(actual || [])].map(Number).sort((a, b) => a - b);
    const right = [...(expected || [])].map(Number).sort((a, b) => a - b);
    return left.length === right.length
      && left.every((item, index) => item === right[index]);
  }

  private sameInstant(actual: string | undefined, expected: string | undefined): boolean {
    if (expected === undefined) return true;
    if (actual === undefined) return false;
    return new Date(actual).getTime() === new Date(expected).getTime();
  }
}
