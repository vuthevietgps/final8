import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import {
  CreateMetaAdsActionDto,
  CreateMetaAdsActionPlanDto,
} from './dto/create-meta-ads-action-plan.dto';
import { CompleteMetaAdsProviderValidationDto } from './dto/meta-ads-action-transition.dto';
import { metaAdsCanonicalHash } from './meta-ads-canonical.util';
import {
  META_ADS_ACTION_TYPES,
  META_ADS_AD_SET_BID_STRATEGIES,
  META_ADS_BILLING_EVENTS,
  META_ADS_BID_STRATEGIES,
  META_ADS_BUDGET_MODES,
  META_ADS_BUDGET_TYPES,
  META_ADS_CALL_TO_ACTION_TYPES,
  META_ADS_CUSTOM_EVENT_TYPES,
  META_ADS_DESTINATION_TYPES,
  META_ADS_FACEBOOK_POSITIONS,
  META_ADS_INSTAGRAM_POSITIONS,
  META_ADS_GRAPH_API_VERSION,
  META_ADS_ODAX_OBJECTIVES,
  META_ADS_OPTIMIZATION_GOALS,
  META_ADS_PUBLISHER_PLATFORMS,
  META_ADS_SPECIAL_AD_CATEGORIES,
  MetaAdsCanonicalActionData,
  MetaAdsPlanStatus,
} from './meta-ads.types';
import {
  MetaAdsActionPlan,
  MetaAdsActionPlanDocument,
  MetaAdsCanonicalAction,
} from './schemas/meta-ads-action-plan.schema';

const PLAN_FIELDS = new Set(['planName', 'actions']);
const ACTION_FIELDS = new Set([
  'actionType',
  'adAccountId',
  'campaignId',
  'adSetId',
  'creativeId',
  'adId',
  'reason',
  'idempotencyKey',
  'payload',
]);
const PAYLOAD_FIELDS = new Set([
  'name',
  'objective',
  'budgetMode',
  'budgetType',
  'dailyBudgetVnd',
  'lifetimeBudgetVnd',
  'bidStrategy',
  'spendCapVnd',
  'startTime',
  'stopTime',
  'specialAdCategories',
  'specialAdCategoryCountries',
  'appId',
  'internalAdGroupId',
  'internalProductIds',
  'adSetBidStrategy',
  'bidAmountVnd',
  'optimizationGoal',
  'billingEvent',
  'destinationType',
  'targetingCountries',
  'ageMin',
  'ageMax',
  'genders',
  'publisherPlatforms',
  'facebookPositions',
  'instagramPositions',
  'pageId',
  'instagramActorId',
  'pixelId',
  'applicationId',
  'objectStoreUrl',
  'customEventType',
  'message',
  'headline',
  'description',
  'callToActionType',
  'destinationUrl',
  'imageHash',
  'videoId',
  'urlTags',
]);

export interface MetaAdsActionPlanReadModel extends Omit<MetaAdsActionPlan, 'actions'> {
  status: MetaAdsPlanStatus;
  actions: MetaAdsCanonicalAction[];
}

@Injectable()
export class MetaAdsActionPlanService {
  constructor(
    @InjectModel(MetaAdsActionPlan.name)
    private readonly actionPlanModel: Model<MetaAdsActionPlanDocument>,
  ) {}

  async createPlan(
    dto: CreateMetaAdsActionPlanDto,
    createdByUserId: string,
    source: 'erp_ui' | 'erp_automation' = 'erp_ui',
    automationEvidence?: {
      snapshotId: string;
      snapshotHash: string;
      capturedAt: string;
    },
  ): Promise<MetaAdsActionPlanReadModel> {
    this.assertOnlyKeys(dto, PLAN_FIELDS, 'plan');
    const actorId = this.requiredText(createdByUserId, 'createdByUserId', 200);
    const planName = this.requiredText(dto?.planName, 'planName', 200);
    const evidenceProvenance = automationEvidence
      ? {
        evidenceSnapshotId: this.requiredText(
          automationEvidence.snapshotId,
          'automationEvidence.snapshotId',
          200,
        ),
        evidenceSnapshotHash: this.sha256(
          automationEvidence.snapshotHash,
          'automationEvidence.snapshotHash',
        ),
        evidenceSnapshotCapturedAt: this.isoDateTime(
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

    const planId = `META-PLAN-${randomUUID()}`;
    const actions = dto.actions.map((input) =>
      this.buildAction(planId, input));
    const idempotencyKeys = actions.map((action) => action.idempotencyKey);
    if (new Set(idempotencyKeys).size !== idempotencyKeys.length) {
      throw new BadRequestException('idempotencyKey values must be unique within a plan.');
    }

    try {
      const created = await this.actionPlanModel.create({
        planId,
        planName,
        createdByUserId: actorId,
        source,
        ...(evidenceProvenance || {}),
        actions,
        revision: 0,
      });
      return this.toReadModel(this.toPlain(created));
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('A Meta Ads action or idempotency key already exists.');
      }
      throw error;
    }
  }

  async getPlan(planId: string): Promise<MetaAdsActionPlanReadModel> {
    const normalizedPlanId = this.requiredText(planId, 'planId', 120);
    const plan = await this.actionPlanModel
      .findOne({ planId: normalizedPlanId })
      .lean()
      .exec();
    if (!plan) throw new NotFoundException('Meta Ads action plan not found.');
    return this.toReadModel(plan as any);
  }

  async getAction(planId: string, actionId: string): Promise<MetaAdsCanonicalAction> {
    const plan = await this.getPlan(planId);
    const action = plan.actions.find((item) => item.actionId === this.requiredText(actionId, 'actionId', 120));
    if (!action) throw new NotFoundException('Meta Ads action not found.');
    return action;
  }

  async beginProviderValidation(
    planId: string,
    actionId: string,
    expectedActionRevision: number,
  ): Promise<{ plan: MetaAdsActionPlanReadModel; action: MetaAdsCanonicalAction }> {
    const normalizedPlanId = this.requiredText(planId, 'planId', 120);
    const normalizedActionId = this.requiredText(actionId, 'actionId', 120);
    this.assertRevision(expectedActionRevision);
    const startedAt = new Date();

    const updated = await this.actionPlanModel.findOneAndUpdate(
      {
        planId: normalizedPlanId,
        actions: {
          $elemMatch: {
            actionId: normalizedActionId,
            revision: expectedActionRevision,
            workflowStatus: {
              $in: ['pending_validation', 'validation_failed', 'pending_approval'],
            },
          },
        },
      },
      {
        $set: {
          'actions.$.workflowStatus': 'validating',
          'actions.$.providerValidationStatus': 'pending',
          'actions.$.providerValidationStartedAt': startedAt,
        },
        $unset: {
          'actions.$.providerValidatedAt': 1,
          'actions.$.providerValidationExpiresAt': 1,
          'actions.$.providerValidationPayloadHash': 1,
          'actions.$.providerValidationBeforeStateHash': 1,
          'actions.$.providerValidationGraphApiVersion': 1,
          'actions.$.providerValidationCredentialReferenceId': 1,
          'actions.$.providerRequestId': 1,
          'actions.$.providerValidationErrorCode': 1,
          'actions.$.providerValidationError': 1,
        },
        $inc: { 'actions.$.revision': 1, revision: 1 },
      },
      { new: true, runValidators: true },
    ).lean().exec();

    const plan = await this.transitionResult(normalizedPlanId, updated, 'Provider validation reservation conflicted.');
    return { plan, action: this.actionFromPlan(plan, normalizedActionId) };
  }

  async completeProviderValidation(
    planId: string,
    actionId: string,
    dto: CompleteMetaAdsProviderValidationDto,
  ): Promise<{ plan: MetaAdsActionPlanReadModel; action: MetaAdsCanonicalAction }> {
    const normalizedPlanId = this.requiredText(planId, 'planId', 120);
    const normalizedActionId = this.requiredText(actionId, 'actionId', 120);
    this.assertRevision(dto?.expectedActionRevision);

    const currentPlan = await this.actionPlanModel.findOne({
      planId: normalizedPlanId,
      actions: {
        $elemMatch: {
          actionId: normalizedActionId,
          revision: dto.expectedActionRevision,
          workflowStatus: 'validating',
        },
      },
    }).lean().exec();
    if (!currentPlan) {
      return this.transitionResult(
        normalizedPlanId,
        null,
        'Provider validation completion conflicted.',
      ) as never;
    }
    const currentAction = this.actionFromPlan(this.toReadModel(currentPlan as any), normalizedActionId);
    this.assertValidationEvidence(dto);

    const validatedAt = new Date();
    const set: Record<string, unknown> = {
      'actions.$.workflowStatus': dto.passed ? 'pending_approval' : 'validation_failed',
      'actions.$.providerValidationStatus': dto.passed ? 'passed' : 'failed',
      'actions.$.providerValidatedAt': validatedAt,
      'actions.$.providerValidationPayloadHash': currentAction.payloadHash,
    };
    const unset: Record<string, 1> = {
      'actions.$.providerValidationStartedAt': 1,
      'actions.$.approvedByUserId': 1,
      'actions.$.approvedAt': 1,
      'actions.$.approvalNote': 1,
    };

    if (dto.passed) {
      set['actions.$.providerValidationExpiresAt'] = new Date(
        validatedAt.getTime() + this.validationTtlMs(),
      );
      set['actions.$.providerValidationBeforeStateHash'] = dto.beforeStateHash;
      set['actions.$.providerValidationGraphApiVersion'] = META_ADS_GRAPH_API_VERSION;
      set['actions.$.providerValidationCredentialReferenceId'] =
        this.requiredText(dto.credentialReferenceId, 'credentialReferenceId', 160);
      unset['actions.$.providerValidationErrorCode'] = 1;
      unset['actions.$.providerValidationError'] = 1;
    } else {
      set['actions.$.providerValidationErrorCode'] = this.optionalText(dto.errorCode, 120);
      set['actions.$.providerValidationError'] = redactSecretString(
        this.optionalText(dto.errorMessage, 1000) || 'Meta provider validation failed.',
      );
      unset['actions.$.providerValidationExpiresAt'] = 1;
      unset['actions.$.providerValidationBeforeStateHash'] = 1;
      unset['actions.$.providerValidationGraphApiVersion'] = 1;
      unset['actions.$.providerValidationCredentialReferenceId'] = 1;
    }

    const providerRequestId = this.optionalText(dto.providerRequestId, 240);
    if (providerRequestId) set['actions.$.providerRequestId'] = redactSecretString(providerRequestId);
    else unset['actions.$.providerRequestId'] = 1;

    const updated = await this.actionPlanModel.findOneAndUpdate(
      {
        _id: (currentPlan as any)._id,
        actions: {
          $elemMatch: {
            actionId: normalizedActionId,
            revision: dto.expectedActionRevision,
            workflowStatus: 'validating',
            payloadHash: currentAction.payloadHash,
          },
        },
      },
      {
        $set: set,
        $unset: unset,
        $inc: { 'actions.$.revision': 1, revision: 1 },
      },
      { new: true, runValidators: true },
    ).lean().exec();

    const plan = await this.transitionResult(
      normalizedPlanId,
      updated,
      'Provider validation completion conflicted.',
    );
    return { plan, action: this.actionFromPlan(plan, normalizedActionId) };
  }

  buildCanonicalPayload(input: CreateMetaAdsActionDto): MetaAdsCanonicalActionData {
    this.assertOnlyKeys(input, ACTION_FIELDS, 'action');
    this.assertOnlyKeys(input?.payload, PAYLOAD_FIELDS, 'action.payload');
    const actionType = input?.actionType;
    if (!META_ADS_ACTION_TYPES.includes(actionType as any)) {
      throw new BadRequestException('Unsupported Meta Ads actionType.');
    }
    const adAccountId = this.numericId(input?.adAccountId, 'adAccountId');
    const campaignId = input?.campaignId
      ? this.numericId(input.campaignId, 'campaignId')
      : undefined;
    const adSetId = input?.adSetId
      ? this.numericId(input.adSetId, 'adSetId')
      : undefined;
    const creativeId = input?.creativeId
      ? this.numericId(input.creativeId, 'creativeId')
      : undefined;
    const adId = input?.adId
      ? this.numericId(input.adId, 'adId')
      : undefined;
    const payload = input?.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('action.payload is required.');
    }
    const name = payload.name === undefined
      ? undefined
      : this.requiredText(payload.name, 'payload.name', 200);
    const dailyBudgetVnd = this.optionalPositiveInteger(
      payload.dailyBudgetVnd,
      'dailyBudgetVnd',
    );
    const lifetimeBudgetVnd = this.optionalPositiveInteger(
      payload.lifetimeBudgetVnd,
      'lifetimeBudgetVnd',
    );
    const spendCapVnd = this.optionalPositiveInteger(
      payload.spendCapVnd,
      'spendCapVnd',
    );
    const startTime = this.optionalIsoDateTime(payload.startTime, 'startTime');
    const stopTime = this.optionalIsoDateTime(payload.stopTime, 'stopTime');

    if (actionType === 'create_ad_set') {
      if (!campaignId || adSetId || creativeId || adId) {
        throw new BadRequestException(
          'create_ad_set requires campaignId and forbids adSetId, creativeId, and adId.',
        );
      }
      if (!name) throw new BadRequestException('create_ad_set requires payload.name.');
      if (!META_ADS_BUDGET_MODES.includes(payload.budgetMode as any)) {
        throw new BadRequestException('create_ad_set requires payload.budgetMode (ABO or CBO).');
      }
      if (!META_ADS_BUDGET_TYPES.includes(payload.budgetType as any)) {
        throw new BadRequestException(
          'create_ad_set requires payload.budgetType (NONE, DAILY, or LIFETIME).',
        );
      }
      const adSetBidStrategy = (payload as any).adSetBidStrategy;
      const bidAmountVnd = this.optionalPositiveInteger(
        (payload as any).bidAmountVnd,
        'bidAmountVnd',
      );
      this.assertAdSetBudgetContract(
        payload.budgetMode,
        payload.budgetType,
        dailyBudgetVnd,
        lifetimeBudgetVnd,
        adSetBidStrategy,
        bidAmountVnd,
        startTime,
        stopTime,
      );
      if (!META_ADS_OPTIMIZATION_GOALS.includes((payload as any).optimizationGoal)) {
        throw new BadRequestException(
          'create_ad_set requires a supported payload.optimizationGoal.',
        );
      }
      if (!META_ADS_BILLING_EVENTS.includes((payload as any).billingEvent)) {
        throw new BadRequestException('create_ad_set requires a supported payload.billingEvent.');
      }
      if (!META_ADS_DESTINATION_TYPES.includes((payload as any).destinationType)) {
        throw new BadRequestException(
          'create_ad_set requires a supported payload.destinationType.',
        );
      }
      const targetingCountries = this.enumStringArray(
        (payload as any).targetingCountries,
        'targetingCountries',
        /^[A-Z]{2}$/,
        250,
      );
      if (!targetingCountries.length) {
        throw new BadRequestException(
          'create_ad_set requires at least one targetingCountries value.',
        );
      }
      const ageMin = this.optionalIntegerRange((payload as any).ageMin, 'ageMin', 18, 65);
      const ageMax = this.optionalIntegerRange((payload as any).ageMax, 'ageMax', 18, 65);
      if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
        throw new BadRequestException('create_ad_set ageMin must not exceed ageMax.');
      }
      const genders = this.numericEnumArray((payload as any).genders, 'genders', [1, 2], 2);
      const publisherPlatforms = this.enumArray(
        (payload as any).publisherPlatforms,
        'publisherPlatforms',
        META_ADS_PUBLISHER_PLATFORMS,
      );
      const facebookPositions = this.enumArray(
        (payload as any).facebookPositions,
        'facebookPositions',
        META_ADS_FACEBOOK_POSITIONS,
      );
      const instagramPositions = this.enumArray(
        (payload as any).instagramPositions,
        'instagramPositions',
        META_ADS_INSTAGRAM_POSITIONS,
      );
      if (facebookPositions.length && !publisherPlatforms.includes('FACEBOOK')) {
        throw new BadRequestException(
          'facebookPositions requires FACEBOOK in publisherPlatforms.',
        );
      }
      if (instagramPositions.length && !publisherPlatforms.includes('INSTAGRAM')) {
        throw new BadRequestException(
          'instagramPositions requires INSTAGRAM in publisherPlatforms.',
        );
      }
      const internalAdGroupId = this.optionalObjectId(
        (payload as any).internalAdGroupId,
        'internalAdGroupId',
      );
      const internalProductIds = this.objectIdArray(
        (payload as any).internalProductIds,
        'internalProductIds',
        100,
      );
      if (!internalAdGroupId && !internalProductIds.length) {
        throw new BadRequestException(
          'create_ad_set requires internalAdGroupId and/or internalProductIds for ERP evidence mapping.',
        );
      }
      const promoted = this.promotedObjectFields(payload as any);
      if ((payload as any).optimizationGoal === 'OFFSITE_CONVERSIONS'
        && (!promoted.pixelId || !promoted.customEventType)) {
        throw new BadRequestException(
          'OFFSITE_CONVERSIONS requires payload.pixelId and payload.customEventType.',
        );
      }
      if (((payload as any).optimizationGoal === 'APP_INSTALLS'
          || (payload as any).destinationType === 'APP')
        && (!promoted.applicationId || !promoted.objectStoreUrl)) {
        throw new BadRequestException(
          'APP delivery requires payload.applicationId and payload.objectStoreUrl.',
        );
      }
      if (['MESSENGER', 'WHATSAPP', 'ON_AD'].includes((payload as any).destinationType)
        && !promoted.pageId) {
        throw new BadRequestException(
          'MESSENGER, WHATSAPP, and ON_AD destinations require payload.pageId.',
        );
      }
      this.assertTimeWindow(startTime, stopTime, 'create_ad_set');
      return {
        actionType,
        adAccountId,
        campaignId,
        name,
        status: 'PAUSED',
        budgetMode: payload.budgetMode,
        budgetType: payload.budgetType,
        ...(dailyBudgetVnd === undefined ? {} : { dailyBudgetVnd }),
        ...(lifetimeBudgetVnd === undefined ? {} : { lifetimeBudgetVnd }),
        ...(adSetBidStrategy === undefined ? {} : { bidStrategy: adSetBidStrategy }),
        ...(bidAmountVnd === undefined ? {} : { bidAmountVnd }),
        optimizationGoal: (payload as any).optimizationGoal,
        billingEvent: (payload as any).billingEvent,
        destinationType: (payload as any).destinationType,
        targetingCountries,
        ...(ageMin === undefined ? {} : { ageMin }),
        ...(ageMax === undefined ? {} : { ageMax }),
        ...(genders.length ? { genders } : {}),
        ...(publisherPlatforms.length ? { publisherPlatforms } : {}),
        ...(facebookPositions.length ? { facebookPositions } : {}),
        ...(instagramPositions.length ? { instagramPositions } : {}),
        ...(startTime === undefined ? {} : { startTime }),
        ...(stopTime === undefined ? {} : { stopTime }),
        ...(internalAdGroupId ? { internalAdGroupId } : {}),
        ...(internalProductIds.length ? { internalProductIds } : {}),
        ...promoted,
      } as MetaAdsCanonicalActionData;
    }

    if (actionType === 'pause_ad_set') {
      if (!campaignId || !adSetId || creativeId || adId) {
        throw new BadRequestException(
          'pause_ad_set requires campaignId and adSetId and forbids creativeId and adId.',
        );
      }
      if (Object.keys(payload).length) {
        throw new BadRequestException('pause_ad_set payload must be empty.');
      }
      return { actionType, adAccountId, campaignId, adSetId };
    }

    if (actionType === 'create_ad_creative') {
      if (campaignId || adSetId || creativeId || adId) {
        throw new BadRequestException(
          'create_ad_creative forbids campaignId, adSetId, creativeId, and adId.',
        );
      }
      if (!name) throw new BadRequestException('create_ad_creative requires payload.name.');
      const pageId = this.numericId((payload as any).pageId, 'payload.pageId');
      const instagramActorId = (payload as any).instagramActorId === undefined
        ? undefined
        : this.numericId((payload as any).instagramActorId, 'payload.instagramActorId');
      const message = this.requiredText((payload as any).message, 'payload.message', 5000);
      const headline = this.requiredText((payload as any).headline, 'payload.headline', 255);
      const description = this.requiredText(
        (payload as any).description,
        'payload.description',
        1000,
      );
      if (!META_ADS_CALL_TO_ACTION_TYPES.includes((payload as any).callToActionType)) {
        throw new BadRequestException(
          'create_ad_creative requires a supported payload.callToActionType.',
        );
      }
      const destinationUrl = this.httpsUrl((payload as any).destinationUrl, 'destinationUrl');
      const imageHash = (payload as any).imageHash === undefined
        ? undefined
        : this.imageHash((payload as any).imageHash);
      const videoId = (payload as any).videoId === undefined
        ? undefined
        : this.numericId((payload as any).videoId, 'payload.videoId');
      const urlTags = (payload as any).urlTags === undefined
        ? undefined
        : this.safeUrlTags((payload as any).urlTags);
      if (Boolean(imageHash) === Boolean(videoId)) {
        throw new BadRequestException(
          'create_ad_creative requires exactly one of payload.imageHash or payload.videoId.',
        );
      }
      return {
        actionType,
        adAccountId,
        name,
        pageId,
        ...(instagramActorId ? { instagramActorId } : {}),
        message,
        headline,
        description,
        callToActionType: (payload as any).callToActionType,
        destinationUrl,
        ...(imageHash ? { imageHash } : {}),
        ...(videoId ? { videoId } : {}),
        ...(urlTags ? { urlTags } : {}),
      } as MetaAdsCanonicalActionData;
    }

    if (actionType === 'create_ad') {
      if (!adSetId || !creativeId || campaignId || adId) {
        throw new BadRequestException(
          'create_ad requires adSetId and creativeId and forbids campaignId and adId.',
        );
      }
      if (!name) throw new BadRequestException('create_ad requires payload.name.');
      return {
        actionType,
        adAccountId,
        adSetId,
        creativeId,
        name,
        status: 'PAUSED',
      };
    }

    if (actionType === 'create_campaign') {
      if (campaignId || adSetId || creativeId || adId) {
        throw new BadRequestException(
          'create_campaign must not include campaignId, adSetId, creativeId, or adId.',
        );
      }
      if (!name) throw new BadRequestException('create_campaign requires payload.name.');
      if (!META_ADS_ODAX_OBJECTIVES.includes(payload.objective as any)) {
        throw new BadRequestException('create_campaign requires a supported ODAX objective.');
      }
      if (!META_ADS_BUDGET_MODES.includes(payload.budgetMode as any)) {
        throw new BadRequestException('create_campaign requires payload.budgetMode (ABO or CBO).');
      }
      if (!META_ADS_BUDGET_TYPES.includes(payload.budgetType as any)) {
        throw new BadRequestException(
          'create_campaign requires payload.budgetType (NONE, DAILY, or LIFETIME).',
        );
      }
      if (payload.budgetMode === 'CBO'
        && !META_ADS_BID_STRATEGIES.includes(payload.bidStrategy as any)) {
        throw new BadRequestException(
          'CBO create_campaign requires a supported payload.bidStrategy.',
        );
      }
      if (payload.budgetMode === 'ABO' && payload.bidStrategy !== undefined) {
        throw new BadRequestException(
          'ABO campaign bid strategy belongs to create_ad_set and must not be set on Campaign.',
        );
      }

      this.assertCreateBudgetContract(
        payload.budgetMode,
        payload.budgetType,
        dailyBudgetVnd,
        lifetimeBudgetVnd,
        startTime,
        stopTime,
      );
      this.assertTimeWindow(startTime, stopTime);

      const specialAdCategories = this.specialAdCategories(
        payload.specialAdCategories,
      );
      const specialAdCategoryCountries = this.specialAdCategoryCountries(
        payload.specialAdCategoryCountries,
      );
      if (specialAdCategories.includes('NONE')) {
        if (specialAdCategories.length !== 1) {
          throw new BadRequestException(
            'specialAdCategories NONE is exclusive and cannot be combined with another category.',
          );
        }
        if (specialAdCategoryCountries.length) {
          throw new BadRequestException(
            'specialAdCategoryCountries must be omitted when specialAdCategories is NONE.',
          );
        }
      } else if (!specialAdCategoryCountries.length) {
        throw new BadRequestException(
          'Non-NONE specialAdCategories require specialAdCategoryCountries.',
        );
      }

      const appId = payload.appId === undefined
        ? undefined
        : this.numericId(payload.appId, 'payload.appId');
      if (payload.objective === 'OUTCOME_APP_PROMOTION' && !appId) {
        throw new BadRequestException('OUTCOME_APP_PROMOTION requires payload.appId.');
      }
      if (payload.objective !== 'OUTCOME_APP_PROMOTION' && appId) {
        throw new BadRequestException(
          'payload.appId is only allowed for OUTCOME_APP_PROMOTION.',
        );
      }

      return {
        actionType,
        adAccountId,
        name,
        objective: payload.objective,
        status: 'PAUSED',
        buyingType: 'AUCTION',
        specialAdCategories,
        ...(specialAdCategoryCountries.length
          ? { specialAdCategoryCountries }
          : {}),
        budgetMode: payload.budgetMode,
        budgetType: payload.budgetType,
        ...(dailyBudgetVnd === undefined ? {} : { dailyBudgetVnd }),
        ...(lifetimeBudgetVnd === undefined ? {} : { lifetimeBudgetVnd }),
        ...(payload.bidStrategy === undefined ? {} : { bidStrategy: payload.bidStrategy }),
        ...(spendCapVnd === undefined ? {} : { spendCapVnd }),
        ...(startTime === undefined ? {} : { startTime }),
        ...(stopTime === undefined ? {} : { stopTime }),
        ...(appId === undefined ? {} : { appId }),
      };
    }

    if (adSetId || creativeId || adId) {
      throw new BadRequestException(
        `${actionType} does not accept adSetId, creativeId, or adId.`,
      );
    }
    if (!campaignId) throw new BadRequestException(`${actionType} requires campaignId.`);
    if (actionType === 'update_campaign') {
      const forbiddenUpdateFields = [
        'objective',
        'budgetMode',
        'budgetType',
        'bidStrategy',
        'startTime',
        'specialAdCategories',
        'specialAdCategoryCountries',
        'appId',
      ].filter((field) => (payload as any)[field] !== undefined);
      if (forbiddenUpdateFields.length) {
        throw new BadRequestException(
          `update_campaign cannot mutate: ${forbiddenUpdateFields.join(', ')}.`,
        );
      }
      if (dailyBudgetVnd !== undefined && lifetimeBudgetVnd !== undefined) {
        throw new BadRequestException(
          'update_campaign accepts only one campaign budget candidate at a time.',
        );
      }
      if (name === undefined
        && dailyBudgetVnd === undefined
        && lifetimeBudgetVnd === undefined
        && spendCapVnd === undefined
        && stopTime === undefined) {
        throw new BadRequestException(
          'update_campaign requires name, dailyBudgetVnd, lifetimeBudgetVnd, spendCapVnd, and/or stopTime.',
        );
      }
      return {
        actionType,
        adAccountId,
        campaignId,
        ...(name === undefined ? {} : { name }),
        ...(dailyBudgetVnd === undefined
          ? {}
          : {
            budgetMode: 'CBO' as const,
            budgetType: 'DAILY' as const,
            dailyBudgetVnd,
          }),
        ...(lifetimeBudgetVnd === undefined
          ? {}
          : {
            budgetMode: 'CBO' as const,
            budgetType: 'LIFETIME' as const,
            lifetimeBudgetVnd,
          }),
        ...(spendCapVnd === undefined ? {} : { spendCapVnd }),
        ...(stopTime === undefined ? {} : { stopTime }),
      };
    }

    if (Object.keys(payload).length) {
      throw new BadRequestException('pause_campaign payload must be empty.');
    }
    return { actionType, adAccountId, campaignId };
  }

  private buildAction(planId: string, input: CreateMetaAdsActionDto): MetaAdsCanonicalAction {
    const canonical = this.buildCanonicalPayload(input);
    const actionId = `META-ACT-${randomUUID()}`;
    const idempotencyKey = input.idempotencyKey === undefined
      ? `${planId}:${actionId}`
      : this.idempotencyKey(input.idempotencyKey);
    return {
      actionId,
      idempotencyKey,
      reason: this.requiredText(input.reason, 'reason', 500),
      ...canonical,
      payloadHash: metaAdsCanonicalHash(canonical),
      workflowStatus: 'pending_validation',
      providerValidationStatus: 'pending',
      revision: 0,
    };
  }

  private assertValidationEvidence(dto: CompleteMetaAdsProviderValidationDto): void {
    if (!dto?.passed) return;
    if (!/^[a-f0-9]{64}$/.test(String(dto.beforeStateHash || ''))) {
      throw new BadRequestException('beforeStateHash is required for passed provider validation.');
    }
    if (dto.graphApiVersion !== META_ADS_GRAPH_API_VERSION) {
      throw new BadRequestException('Passed provider validation must use Meta Graph API v25.0.');
    }
    this.requiredText(dto.credentialReferenceId, 'credentialReferenceId', 160);
  }

  private actionFromPlan(
    plan: MetaAdsActionPlanReadModel,
    actionId: string,
  ): MetaAdsCanonicalAction {
    const action = plan.actions.find((item) => item.actionId === actionId);
    if (!action) throw new NotFoundException('Meta Ads action not found.');
    return action;
  }

  private async transitionResult(
    planId: string,
    result: any,
    conflictMessage: string,
  ): Promise<MetaAdsActionPlanReadModel> {
    if (result) return this.toReadModel(result);
    const exists = await this.actionPlanModel.exists({ planId }).exec();
    if (!exists) throw new NotFoundException('Meta Ads action plan not found.');
    throw new ConflictException(conflictMessage);
  }

  private toReadModel(plan: any): MetaAdsActionPlanReadModel {
    const plain = this.toPlain(plan) as any;
    return {
      ...plain,
      status: deriveMetaAdsPlanStatus(plain.actions || []),
    };
  }

  private toPlain(value: any): any {
    return value?.toObject ? value.toObject() : value;
  }

  private validationTtlMs(): number {
    const configured = Number(process.env.META_ADS_PROVIDER_VALIDATION_TTL_MS || 15 * 60_000);
    if (!Number.isFinite(configured)) return 15 * 60_000;
    return Math.min(24 * 60 * 60_000, Math.max(60_000, Math.trunc(configured)));
  }

  private sha256(value: unknown, field: string): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a SHA-256 hash.`);
    }
    return normalized;
  }

  private isoDateTime(value: unknown, field: string): Date {
    const normalized = String(value || '').trim();
    const parsed = new Date(normalized);
    if (!normalized || Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be an ISO date-time.`);
    }
    return parsed;
  }

  private assertOnlyKeys(value: unknown, allowed: Set<string>, path: string): void {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(`${path} must be an object.`);
    }
    const unknown = Object.keys(value as Record<string, unknown>)
      .filter((key) => !allowed.has(key));
    if (unknown.length) {
      throw new BadRequestException(`${path} contains unsupported fields: ${unknown.sort().join(', ')}.`);
    }
  }

  private numericId(value: unknown, field: string): string {
    const normalized = String(value || '').trim();
    if (!/^\d{1,32}$/.test(normalized)) {
      throw new BadRequestException(`${field} must contain digits only.`);
    }
    return normalized;
  }

  private idempotencyKey(value: unknown): string {
    const normalized = this.requiredText(value, 'idempotencyKey', 160);
    if (normalized.length < 8 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)) {
      throw new BadRequestException('idempotencyKey has an invalid format.');
    }
    return normalized;
  }

  private optionalPositiveInteger(value: unknown, field: string): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isSafeInteger(value) || Number(value) <= 0) {
      throw new BadRequestException(`${field} must be a positive safe integer.`);
    }
    return Number(value);
  }

  private assertCreateBudgetContract(
    budgetMode: unknown,
    budgetType: unknown,
    dailyBudgetVnd?: number,
    lifetimeBudgetVnd?: number,
    startTime?: string,
    stopTime?: string,
  ): void {
    if (budgetMode === 'ABO') {
      if (budgetType !== 'NONE'
        || dailyBudgetVnd !== undefined
        || lifetimeBudgetVnd !== undefined) {
        throw new BadRequestException(
          'ABO campaigns require budgetType=NONE and forbid campaign-level daily/lifetime budgets.',
        );
      }
      return;
    }

    if (budgetMode !== 'CBO') return;
    if (budgetType === 'DAILY') {
      if (dailyBudgetVnd === undefined || lifetimeBudgetVnd !== undefined) {
        throw new BadRequestException(
          'CBO DAILY campaigns require dailyBudgetVnd and forbid lifetimeBudgetVnd.',
        );
      }
      return;
    }
    if (budgetType === 'LIFETIME') {
      if (lifetimeBudgetVnd === undefined || dailyBudgetVnd !== undefined) {
        throw new BadRequestException(
          'CBO LIFETIME campaigns require lifetimeBudgetVnd and forbid dailyBudgetVnd.',
        );
      }
      if (!startTime || !stopTime) {
        throw new BadRequestException(
          'CBO LIFETIME campaigns require valid startTime and stopTime.',
        );
      }
      return;
    }
    throw new BadRequestException(
      'CBO campaigns require budgetType DAILY or LIFETIME with exactly one matching budget.',
    );
  }

  private optionalIsoDateTime(value: unknown, field: string): string | undefined {
    if (value === undefined) return undefined;
    const normalized = this.requiredText(value, `payload.${field}`, 64);
    if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) {
      throw new BadRequestException(`${field} must be an ISO-8601 datetime with timezone.`);
    }
    const timestamp = Date.parse(normalized);
    if (!Number.isFinite(timestamp)) {
      throw new BadRequestException(`${field} must be a valid ISO-8601 datetime.`);
    }
    return new Date(timestamp).toISOString();
  }

  private assertTimeWindow(
    startTime?: string,
    stopTime?: string,
    resourceName = 'create_campaign',
  ): void {
    if ((startTime && !stopTime) || (!startTime && stopTime)) {
      throw new BadRequestException(
        `${resourceName} startTime and stopTime must be supplied together.`,
      );
    }
    if (startTime && stopTime
      && new Date(stopTime).getTime() <= new Date(startTime).getTime()) {
      throw new BadRequestException(`${resourceName} stopTime must be after startTime.`);
    }
  }

  private assertAdSetBudgetContract(
    budgetMode: unknown,
    budgetType: unknown,
    dailyBudgetVnd: number | undefined,
    lifetimeBudgetVnd: number | undefined,
    bidStrategy: unknown,
    bidAmountVnd: number | undefined,
    startTime?: string,
    stopTime?: string,
  ): void {
    if (budgetMode === 'CBO') {
      if (budgetType !== 'NONE'
        || dailyBudgetVnd !== undefined
        || lifetimeBudgetVnd !== undefined
        || bidStrategy !== undefined
        || bidAmountVnd !== undefined) {
        throw new BadRequestException(
          'CBO Ad Sets require budgetType=NONE and no Ad Set budget or bid fields.',
        );
      }
      return;
    }
    if (budgetMode !== 'ABO') return;
    if (!META_ADS_AD_SET_BID_STRATEGIES.includes(bidStrategy as any)) {
      throw new BadRequestException(
        'ABO create_ad_set requires a supported payload.adSetBidStrategy.',
      );
    }
    if (budgetType === 'DAILY') {
      if (dailyBudgetVnd === undefined || lifetimeBudgetVnd !== undefined) {
        throw new BadRequestException(
          'ABO DAILY Ad Sets require dailyBudgetVnd and forbid lifetimeBudgetVnd.',
        );
      }
    } else if (budgetType === 'LIFETIME') {
      if (lifetimeBudgetVnd === undefined || dailyBudgetVnd !== undefined
        || !startTime || !stopTime) {
        throw new BadRequestException(
          'ABO LIFETIME Ad Sets require lifetimeBudgetVnd, startTime, and stopTime.',
        );
      }
    } else {
      throw new BadRequestException('ABO Ad Sets require budgetType DAILY or LIFETIME.');
    }
    const requiresBidAmount = ['COST_CAP', 'LOWEST_COST_WITH_BID_CAP'].includes(
      String(bidStrategy),
    );
    if (requiresBidAmount !== (bidAmountVnd !== undefined)) {
      throw new BadRequestException(
        'ABO bidAmountVnd is required only for COST_CAP or LOWEST_COST_WITH_BID_CAP.',
      );
    }
  }

  private optionalIntegerRange(
    value: unknown,
    field: string,
    min: number,
    max: number,
  ): number | undefined {
    if (value === undefined) return undefined;
    if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) {
      throw new BadRequestException(`${field} must be an integer between ${min} and ${max}.`);
    }
    return Number(value);
  }

  private enumArray<T extends string>(
    value: unknown,
    field: string,
    allowed: readonly T[],
  ): T[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.length || value.length > allowed.length) {
      throw new BadRequestException(`${field} must be a non-empty bounded array.`);
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !allowed.includes(item as T))) {
      throw new BadRequestException(`${field} contains an unsupported or duplicate value.`);
    }
    return [...normalized].sort() as T[];
  }

  private enumStringArray(
    value: unknown,
    field: string,
    pattern: RegExp,
    max: number,
  ): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.length || value.length > max) {
      throw new BadRequestException(`${field} must be a non-empty bounded array.`);
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !pattern.test(item))) {
      throw new BadRequestException(`${field} contains an invalid or duplicate value.`);
    }
    return [...normalized].sort();
  }

  private numericEnumArray(
    value: unknown,
    field: string,
    allowed: number[],
    max: number,
  ): Array<1 | 2> {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.length || value.length > max) {
      throw new BadRequestException(`${field} must be a non-empty bounded array.`);
    }
    const normalized = value.map((item) => Number(item));
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !Number.isSafeInteger(item) || !allowed.includes(item))) {
      throw new BadRequestException(`${field} contains an invalid or duplicate value.`);
    }
    return normalized.sort() as Array<1 | 2>;
  }

  private optionalObjectId(value: unknown, field: string): string | undefined {
    if (value === undefined) return undefined;
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{24}$/.test(normalized)) {
      throw new BadRequestException(`${field} must be a Mongo ObjectId string.`);
    }
    return normalized;
  }

  private objectIdArray(value: unknown, field: string, max: number): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.length || value.length > max) {
      throw new BadRequestException(`${field} must be a non-empty bounded array.`);
    }
    const normalized = value.map((item) => String(item || '').trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length
      || normalized.some((item) => !/^[a-f0-9]{24}$/.test(item))) {
      throw new BadRequestException(`${field} contains an invalid or duplicate ObjectId.`);
    }
    return [...normalized].sort();
  }

  private promotedObjectFields(
    payload: Record<string, unknown>,
  ): Partial<MetaAdsCanonicalActionData> {
    const pageId = payload.pageId === undefined
      ? undefined
      : this.numericId(payload.pageId, 'payload.pageId');
    const pixelId = payload.pixelId === undefined
      ? undefined
      : this.numericId(payload.pixelId, 'payload.pixelId');
    const applicationId = payload.applicationId === undefined
      ? undefined
      : this.numericId(payload.applicationId, 'payload.applicationId');
    const objectStoreUrl = payload.objectStoreUrl === undefined
      ? undefined
      : this.httpsUrl(payload.objectStoreUrl, 'objectStoreUrl');
    const customEventType = payload.customEventType;
    if (customEventType !== undefined
      && !META_ADS_CUSTOM_EVENT_TYPES.includes(customEventType as any)) {
      throw new BadRequestException('payload.customEventType is unsupported.');
    }
    if (Boolean(pixelId) !== Boolean(customEventType)) {
      throw new BadRequestException(
        'payload.pixelId and payload.customEventType must be supplied together.',
      );
    }
    if (Boolean(applicationId) !== Boolean(objectStoreUrl)) {
      throw new BadRequestException(
        'payload.applicationId and payload.objectStoreUrl must be supplied together.',
      );
    }
    return {
      ...(pageId ? { pageId } : {}),
      ...(pixelId ? { pixelId } : {}),
      ...(applicationId ? { applicationId } : {}),
      ...(objectStoreUrl ? { objectStoreUrl } : {}),
      ...(customEventType ? { customEventType: customEventType as any } : {}),
    };
  }

  private httpsUrl(value: unknown, field: string): string {
    const text = this.requiredText(value, `payload.${field}`, 2048);
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new BadRequestException(`${field} must be a valid HTTPS URL.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) {
      throw new BadRequestException(`${field} must be a credential-free HTTPS URL.`);
    }
    url.hash = '';
    return url.toString();
  }

  private safeUrlTags(value: unknown): string {
    const normalized = this.requiredText(value, 'payload.urlTags', 2048)
      .replace(/^\?/, '');
    const secretLike = /(?:access[_-]?token|refresh[_-]?token|app[_-]?secret|client[_-]?secret|authorization|bearer)/i;
    if (secretLike.test(normalized)) {
      throw new BadRequestException(
        'payload.urlTags must not contain credential or authorization material.',
      );
    }
    const params = new URLSearchParams(normalized);
    for (const [key, item] of params.entries()) {
      if (!key || secretLike.test(key) || secretLike.test(item)) {
        throw new BadRequestException(
          'payload.urlTags must contain only non-secret tracking parameters.',
        );
      }
    }
    return normalized;
  }

  private imageHash(value: unknown): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(normalized)) {
      throw new BadRequestException('payload.imageHash must be a 32-character hex hash.');
    }
    return normalized;
  }

  private specialAdCategories(value: unknown): MetaAdsCanonicalActionData['specialAdCategories'] {
    if (value === undefined) return ['NONE'];
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException('specialAdCategories must be a non-empty array.');
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('specialAdCategories must not contain duplicates.');
    }
    if (normalized.some((item) => !META_ADS_SPECIAL_AD_CATEGORIES.includes(item as any))) {
      throw new BadRequestException('specialAdCategories contains an unsupported Graph API v25 value.');
    }
    return META_ADS_SPECIAL_AD_CATEGORIES
      .filter((item) => normalized.includes(item));
  }

  private specialAdCategoryCountries(value: unknown): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.length || value.length > 250) {
      throw new BadRequestException(
        'specialAdCategoryCountries must be a non-empty ISO alpha-2 array.',
      );
    }
    const normalized = value.map((item) => String(item || '').trim().toUpperCase());
    if (normalized.some((item) => !/^[A-Z]{2}$/.test(item))) {
      throw new BadRequestException(
        'specialAdCategoryCountries must contain uppercase ISO alpha-2 codes.',
      );
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('specialAdCategoryCountries must not contain duplicates.');
    }
    return [...normalized].sort();
  }

  private requiredText(value: unknown, field: string, max: number): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) {
      throw new BadRequestException(`${field} is required and must be at most ${max} safe characters.`);
    }
    return normalized;
  }

  private optionalText(value: unknown, max: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    return this.requiredText(value, 'value', max);
  }

  private assertRevision(value: unknown): void {
    if (!Number.isInteger(value) || Number(value) < 0) {
      throw new BadRequestException('expectedActionRevision must be a non-negative integer.');
    }
  }
}

export function deriveMetaAdsPlanStatus(actions: MetaAdsCanonicalAction[]): MetaAdsPlanStatus {
  const statuses = (actions || []).map((action) => action.workflowStatus);
  if (!statuses.length) return 'pending_validation';
  if (statuses.some((status) => status === 'executing')) return 'executing';
  if (statuses.every((status) => status === 'executed')) return 'executed';
  if (statuses.some((status) => status === 'failed')) return 'failed';
  if (statuses.every((status) => status === 'rejected')) return 'rejected';
  if (statuses.every((status) => status === 'approved' || status === 'rejected')) {
    return statuses.some((status) => status === 'approved') ? 'approved' : 'rejected';
  }
  if (statuses.some((status) => status === 'validating')) return 'validating';
  if (statuses.some((status) => status === 'pending_approval' || status === 'approved')) {
    return 'pending_approval';
  }
  if (statuses.some((status) => status === 'validation_failed')) return 'validation_failed';
  return 'pending_validation';
}
