import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { MetaAdsExecutionPolicyService } from './meta-ads-execution-policy.service';
import {
  MetaAdsProviderClientService,
  MetaAdsProviderError,
} from './meta-ads-provider-client.service';
import {
  MetaAdsActionPlan,
  MetaAdsActionPlanDocument,
  MetaAdsCanonicalAction,
} from './schemas/meta-ads-action-plan.schema';

@Injectable()
export class MetaAdsProviderValidationService {
  constructor(
    @InjectModel(MetaAdsActionPlan.name)
    private readonly planModel: Model<MetaAdsActionPlanDocument>,
    private readonly policy: MetaAdsExecutionPolicyService,
    private readonly providerClient: MetaAdsProviderClientService,
  ) {}

  async validateActions(planIdInput: string, actionIdsInput: string[]) {
    const planId = this.requiredText(planIdInput, 'planId');
    const actionIds = this.actionIds(actionIdsInput);
    const exists = await this.planModel.exists({ planId });
    if (!exists) throw new NotFoundException('Meta Ads action plan not found.');

    const results = [];
    for (const actionId of actionIds) {
      const claimed: any = await this.planModel.findOneAndUpdate(
        {
          planId,
          actions: {
            $elemMatch: {
              actionId,
              workflowStatus: { $in: ['pending_validation', 'validation_failed'] },
            },
          },
        },
        {
          $set: {
            'actions.$.workflowStatus': 'validating',
            'actions.$.providerValidationStatus': 'pending',
            'actions.$.providerValidationStartedAt': new Date(),
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
            'actions.$.approvedByUserId': 1,
            'actions.$.approvedAt': 1,
            'actions.$.approvalNote': 1,
          },
          $inc: { 'actions.$.revision': 1, revision: 1 },
        },
        { new: true },
      );
      if (!claimed) {
        throw new BadRequestException(
          `Meta action ${actionId} is missing or is not eligible for provider validation.`,
        );
      }
      const action = this.findAction(claimed, actionId);

      try {
        const preflight = await this.policy.preflightValidation(claimed, action);
        const provider = await this.providerClient.validateOnly(
          preflight.providerAction,
          preflight.credentialReferenceId,
        );
        if (provider.credentialReferenceId !== preflight.credentialReferenceId) {
          throw new BadRequestException('Meta exact credential changed during provider validation.');
        }
        const validatedAt = new Date();
        const expiresAt = new Date(validatedAt.getTime() + this.validationTtlMs());
        await this.updateClaimedAction(planId, actionId, {
          workflowStatus: 'pending_approval',
          providerValidationStatus: 'passed',
          providerValidatedAt: validatedAt,
          providerValidationExpiresAt: expiresAt,
          providerValidationPayloadHash: preflight.payloadHash,
          providerValidationBeforeStateHash: preflight.beforeStateHash,
          providerValidationGraphApiVersion: preflight.graphApiVersion,
          providerValidationCredentialReferenceId: preflight.credentialReferenceId,
          providerRequestId: provider.providerRequestId,
        });
        results.push({
          actionId,
          providerValidationStatus: 'passed',
          providerValidatedAt: validatedAt,
          providerValidationExpiresAt: expiresAt,
          providerRequestId: provider.providerRequestId,
        });
      } catch (error: any) {
        const providerError = error instanceof MetaAdsProviderError ? error : undefined;
        const message = redactSecretString(String(error?.message || 'Meta provider validation failed.'))
          .slice(0, 1000);
        await this.updateClaimedAction(planId, actionId, {
          workflowStatus: 'validation_failed',
          providerValidationStatus: 'failed',
          providerValidatedAt: new Date(),
          providerRequestId: providerError?.providerRequestId,
          providerValidationErrorCode: providerError?.providerCode,
          providerValidationError: message,
        });
        results.push({
          actionId,
          providerValidationStatus: 'failed',
          providerRequestId: providerError?.providerRequestId,
          errorCode: providerError?.providerCode,
          error: message,
        });
      }
    }

    const passed = results.filter((result) => result.providerValidationStatus === 'passed').length;
    return {
      success: passed === results.length,
      planId,
      actionsTotal: results.length,
      actionsPassed: passed,
      actionsFailed: results.length - passed,
      actions: results,
    };
  }

  private async updateClaimedAction(
    planId: string,
    actionId: string,
    values: Record<string, unknown>,
  ) {
    const set = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [`actions.$.${key}`, value]),
    );
    const updated = await this.planModel.updateOne(
      { planId, actions: { $elemMatch: { actionId, workflowStatus: 'validating' } } },
      { $set: set, $inc: { 'actions.$.revision': 1, revision: 1 } },
    );
    if (updated.matchedCount !== 1) {
      throw new BadRequestException(`Meta action ${actionId} validation state changed concurrently.`);
    }
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

  private validationTtlMs(): number {
    const value = Number(process.env.META_ADS_PROVIDER_VALIDATION_TTL_MS);
    if (!Number.isFinite(value)) return 15 * 60 * 1000;
    return Math.min(24 * 60 * 60 * 1000, Math.max(60_000, Math.floor(value)));
  }
}

