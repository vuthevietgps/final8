import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ApproveMetaAdsActionPlanDto,
  RejectMetaAdsActionPlanDto,
} from './dto/meta-ads-action-transition.dto';
import { META_ADS_GRAPH_API_VERSION } from './meta-ads.types';
import {
  MetaAdsActionPlan,
  MetaAdsActionPlanDocument,
  MetaAdsCanonicalAction,
} from './schemas/meta-ads-action-plan.schema';

@Injectable()
export class MetaAdsApprovalService {
  constructor(
    @InjectModel(MetaAdsActionPlan.name)
    private readonly actionPlanModel: Model<MetaAdsActionPlanDocument>,
  ) {}

  async approve(
    planId: string,
    actionId: string,
    approverUserId: string,
    dto: ApproveMetaAdsActionPlanDto,
  ): Promise<{ plan: MetaAdsActionPlan; action: MetaAdsCanonicalAction }> {
    const normalizedPlanId = this.requiredText(planId, 'planId', 120);
    const normalizedActionId = this.requiredText(actionId, 'actionId', 120);
    const actorId = this.requiredText(approverUserId, 'approverUserId', 200);
    this.assertRevision(dto?.expectedActionRevision);

    const currentPlan: any = await this.actionPlanModel.findOne({
      planId: normalizedPlanId,
      actions: {
        $elemMatch: {
          actionId: normalizedActionId,
          revision: dto.expectedActionRevision,
        },
      },
    }).lean().exec();
    if (!currentPlan) {
      await this.throwTransitionFailure(normalizedPlanId, 'Approval revision conflicted.');
    }
    const currentAction = this.action(currentPlan, normalizedActionId);
    if (String(currentPlan.createdByUserId) === actorId) {
      throw new BadRequestException('Action creator cannot approve the same Meta Ads action.');
    }
    this.assertFreshProviderValidation(currentAction);
    if (currentAction.workflowStatus !== 'pending_approval') {
      throw new BadRequestException(
        `Meta Ads action cannot be approved from ${currentAction.workflowStatus}.`,
      );
    }

    const approvedAt = new Date();
    const note = this.optionalText(dto?.note, 500);
    const set: Record<string, unknown> = {
      'actions.$.workflowStatus': 'approved',
      'actions.$.approvedByUserId': actorId,
      'actions.$.approvedAt': approvedAt,
    };
    const unset: Record<string, 1> = {
      'actions.$.rejectedByUserId': 1,
      'actions.$.rejectedAt': 1,
      'actions.$.rejectionReason': 1,
    };
    if (note) set['actions.$.approvalNote'] = note;
    else unset['actions.$.approvalNote'] = 1;

    const updated: any = await this.actionPlanModel.findOneAndUpdate(
      {
        _id: currentPlan._id,
        createdByUserId: { $ne: actorId },
        actions: {
          $elemMatch: {
            actionId: normalizedActionId,
            revision: dto.expectedActionRevision,
            workflowStatus: 'pending_approval',
            providerValidationStatus: 'passed',
            payloadHash: currentAction.payloadHash,
            providerValidationPayloadHash: currentAction.payloadHash,
            providerValidationBeforeStateHash:
              currentAction.providerValidationBeforeStateHash,
            providerValidationGraphApiVersion: META_ADS_GRAPH_API_VERSION,
            providerValidationCredentialReferenceId:
              currentAction.providerValidationCredentialReferenceId,
            providerValidatedAt: currentAction.providerValidatedAt,
            providerValidationExpiresAt: {
              $gt: approvedAt,
            },
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

    if (!updated) {
      await this.throwTransitionFailure(normalizedPlanId, 'Approval conflicted or provider validation expired.');
    }
    return { plan: updated, action: this.action(updated, normalizedActionId) };
  }

  async reject(
    planId: string,
    actionId: string,
    rejectedByUserId: string,
    dto: RejectMetaAdsActionPlanDto,
  ): Promise<{ plan: MetaAdsActionPlan; action: MetaAdsCanonicalAction }> {
    const normalizedPlanId = this.requiredText(planId, 'planId', 120);
    const normalizedActionId = this.requiredText(actionId, 'actionId', 120);
    const actorId = this.requiredText(rejectedByUserId, 'rejectedByUserId', 200);
    const reason = this.requiredText(dto?.reason, 'reason', 500);
    this.assertRevision(dto?.expectedActionRevision);
    const rejectedAt = new Date();

    const updated: any = await this.actionPlanModel.findOneAndUpdate(
      {
        planId: normalizedPlanId,
        actions: {
          $elemMatch: {
            actionId: normalizedActionId,
            revision: dto.expectedActionRevision,
            workflowStatus: {
              $in: [
                'pending_validation',
                'validating',
                'validation_failed',
                'pending_approval',
                'approved',
              ],
            },
          },
        },
      },
      {
        $set: {
          'actions.$.workflowStatus': 'rejected',
          'actions.$.rejectedByUserId': actorId,
          'actions.$.rejectedAt': rejectedAt,
          'actions.$.rejectionReason': reason,
        },
        $unset: {
          'actions.$.approvedByUserId': 1,
          'actions.$.approvedAt': 1,
          'actions.$.approvalNote': 1,
        },
        $inc: { 'actions.$.revision': 1, revision: 1 },
      },
      { new: true, runValidators: true },
    ).lean().exec();

    if (!updated) {
      await this.throwTransitionFailure(normalizedPlanId, 'Rejection revision or status conflicted.');
    }
    return { plan: updated, action: this.action(updated, normalizedActionId) };
  }

  assertFreshProviderValidation(
    action: MetaAdsCanonicalAction,
    now = new Date(),
  ): void {
    if (action.providerValidationStatus !== 'passed') {
      throw new BadRequestException('Provider validate_only must pass before approval.');
    }
    if (!action.providerValidatedAt || !action.providerValidationExpiresAt) {
      throw new BadRequestException('Provider validation timestamps are incomplete.');
    }
    const validatedAt = new Date(action.providerValidatedAt);
    const expiresAt = new Date(action.providerValidationExpiresAt);
    if (!Number.isFinite(validatedAt.getTime()) || !Number.isFinite(expiresAt.getTime())) {
      throw new BadRequestException('Provider validation timestamps are invalid.');
    }
    if (validatedAt.getTime() > now.getTime() + 60_000) {
      throw new BadRequestException('Provider validation timestamp is in the future.');
    }
    if (expiresAt.getTime() <= now.getTime()) {
      throw new BadRequestException('Provider validation has expired.');
    }
    if (action.providerValidationPayloadHash !== action.payloadHash) {
      throw new BadRequestException('Provider validation is not bound to the canonical payload.');
    }
    if (!/^[a-f0-9]{64}$/.test(String(action.providerValidationBeforeStateHash || ''))) {
      throw new BadRequestException('Provider validation is missing the before-state hash.');
    }
    if (action.providerValidationGraphApiVersion !== META_ADS_GRAPH_API_VERSION) {
      throw new BadRequestException('Provider validation did not use Meta Graph API v25.0.');
    }
    if (!String(action.providerValidationCredentialReferenceId || '').trim()) {
      throw new BadRequestException('Provider validation is missing its credential reference.');
    }
  }

  private action(plan: MetaAdsActionPlan, actionId: string): MetaAdsCanonicalAction {
    const action = (plan.actions || []).find((item) => item.actionId === actionId);
    if (!action) throw new NotFoundException('Meta Ads action not found.');
    return action;
  }

  private async throwTransitionFailure(planId: string, conflictMessage: string): Promise<never> {
    const exists = await this.actionPlanModel.exists({ planId }).exec();
    if (!exists) throw new NotFoundException('Meta Ads action plan not found.');
    throw new ConflictException(conflictMessage);
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
    return this.requiredText(value, 'note', max);
  }

  private assertRevision(value: unknown): void {
    if (!Number.isInteger(value) || Number(value) < 0) {
      throw new BadRequestException('expectedActionRevision must be a non-negative integer.');
    }
  }
}
