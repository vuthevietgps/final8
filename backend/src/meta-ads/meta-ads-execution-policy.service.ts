import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { readBooleanEnv } from '../common/ads-safety-config';
import {
  MetaAdsActionPlan,
  MetaAdsCanonicalAction,
} from './schemas/meta-ads-action-plan.schema';
import {
  MetaAdsCampaignSnapshot,
  MetaAdsProviderClientService,
  MetaAdsResourceSnapshot,
} from './meta-ads-provider-client.service';

export type MetaAdsExecutionPreflight = {
  plan: MetaAdsActionPlan;
  action: MetaAdsCanonicalAction;
  providerAction: ReturnType<MetaAdsProviderClientService['canonicalPayload']>;
  payloadHash: string;
  beforeState?: MetaAdsResourceSnapshot | Record<string, unknown>;
  beforeStateHash: string;
  credentialReferenceId: string;
  graphApiVersion: 'v25.0';
};

export type MetaAdsDryRunDiagnostic = {
  actionId: string;
  liveEligible: boolean;
  blockers: string[];
  payloadHash?: string;
  validationExpiresAt?: Date;
  providerNetworkCalled: false;
};

@Injectable()
export class MetaAdsExecutionPolicyService {
  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    private readonly providerClient: MetaAdsProviderClientService,
  ) {}

  async preflightValidation(
    plan: MetaAdsActionPlan,
    action: MetaAdsCanonicalAction,
  ): Promise<MetaAdsExecutionPreflight> {
    if (!['pending_validation', 'validation_failed', 'validating'].includes(action.workflowStatus)) {
      throw new BadRequestException(
        `Meta Ads action cannot be validated when status is ${action.workflowStatus}.`,
      );
    }
    await this.assertAccountAllowed(action);
    const providerAction = this.providerClient.canonicalPayload(action);
    const payloadHash = this.assertPayloadHash(action, providerAction);
    const context = await this.providerClient.executionContext(action.adAccountId);
    const beforeState = await this.beforeState(action, context.credentialReferenceId);
    this.assertBusinessRules(action, beforeState);
    return {
      plan,
      action,
      providerAction,
      payloadHash,
      beforeState,
      beforeStateHash: this.providerClient.stateHash(beforeState),
      credentialReferenceId: context.credentialReferenceId,
      graphApiVersion: context.graphApiVersion,
    };
  }

  async preflightLive(
    plan: MetaAdsActionPlan,
    action: MetaAdsCanonicalAction,
    currentUser: any,
  ): Promise<MetaAdsExecutionPreflight> {
    this.assertLiveFlags(action.actionType);
    if (action.workflowStatus !== 'approved') {
      throw new BadRequestException('Meta Ads live execution requires an approved action.');
    }
    await this.assertAccountAllowed(action);
    const providerAction = this.providerClient.canonicalPayload(action);
    const payloadHash = this.assertPayloadHash(action, providerAction);
    this.assertFreshProviderValidation(action, payloadHash);
    this.assertSeparationOfDuties(action, currentUser, plan.createdByUserId);

    const context = await this.providerClient.executionContext(action.adAccountId);
    if (context.graphApiVersion !== action.providerValidationGraphApiVersion
      || context.credentialReferenceId !== action.providerValidationCredentialReferenceId) {
      throw new BadRequestException('Meta provider version or exact credential changed after validation; validate and approve again.');
    }
    const beforeState = await this.beforeState(action, context.credentialReferenceId);
    const beforeStateHash = this.providerClient.stateHash(beforeState);
    if (beforeStateHash !== action.providerValidationBeforeStateHash) {
      throw new BadRequestException('Meta campaign state changed after validate_only; validate and approve again.');
    }
    this.assertBusinessRules(action, beforeState);
    return {
      plan,
      action,
      providerAction,
      payloadHash,
      beforeState,
      beforeStateHash,
      credentialReferenceId: context.credentialReferenceId,
      graphApiVersion: context.graphApiVersion,
    };
  }

  async dryRunDiagnostic(
    action: MetaAdsCanonicalAction,
    currentUser: any,
    createdByUserId?: string,
  ): Promise<MetaAdsDryRunDiagnostic> {
    const blockers: string[] = [];
    let payloadHash: string | undefined;
    if (action.workflowStatus !== 'approved') {
      blockers.push(`Meta action is not approved (status=${action.workflowStatus}).`);
    }
    try {
      await this.assertAccountAllowed(action);
    } catch (error: any) {
      blockers.push(String(error?.message || 'Meta account gate failed.'));
    }
    try {
      const providerAction = this.providerClient.canonicalPayload(action);
      payloadHash = this.assertPayloadHash(action, providerAction);
      this.providerClient.buildMutation(providerAction);
      this.assertStaticBusinessRules(action);
      this.assertFreshProviderValidation(action, payloadHash);
    } catch (error: any) {
      blockers.push(String(error?.message || 'Meta action policy failed.'));
    }
    const sod = this.evaluateSeparationOfDuties(action, currentUser, createdByUserId);
    if (!sod.allowed && sod.reason) blockers.push(sod.reason);
    blockers.push(...this.liveFlagBlockers(action.actionType));
    return {
      actionId: action.actionId,
      liveEligible: blockers.length === 0,
      blockers: [...new Set(blockers)],
      payloadHash,
      validationExpiresAt: action.providerValidationExpiresAt,
      providerNetworkCalled: false,
    };
  }

  evaluateSeparationOfDuties(
    action: MetaAdsCanonicalAction,
    currentUser: any,
    createdByUserId?: string,
  ): {
    allowed: boolean;
    reason?: string;
  } {
    const executorUserId = this.userId(currentUser);
    const approverUserId = String(action.approvedByUserId || '').trim();
    const creatorUserId = String(createdByUserId || '').trim();
    if (!executorUserId) return { allowed: false, reason: 'Authenticated executor user ID is required.' };
    if (!approverUserId) return { allowed: false, reason: 'Canonical approver user ID is required.' };
    if (!creatorUserId) return { allowed: false, reason: 'Canonical plan creator user ID is required.' };
    if (executorUserId === approverUserId) {
      return { allowed: false, reason: 'Meta Ads executor must be different from the approver.' };
    }
    if (executorUserId === creatorUserId) {
      return { allowed: false, reason: 'Meta Ads executor must be different from the plan creator.' };
    }
    return { allowed: true };
  }

  userId(currentUser: any): string {
    const value = currentUser?.id || currentUser?._id || currentUser?.sub;
    return value ? String(value).trim() : '';
  }

  private async assertAccountAllowed(action: MetaAdsCanonicalAction): Promise<void> {
    const adAccountId = String(action.adAccountId || '').trim();
    const allowlist = this.csvEnv('META_ADS_ACCOUNT_ID_ALLOWLIST')
      .map((value) => value.replace(/^act_/i, ''));
    if (!allowlist.length || !allowlist.includes(adAccountId)) {
      throw new BadRequestException('Meta ad account is not in META_ADS_ACCOUNT_ID_ALLOWLIST.');
    }
    const account: any = await this.adAccountModel.findOne({
      accountType: 'facebook',
      accountId: { $in: [adAccountId, `act_${adAccountId}`] },
      isActive: true,
    }).lean();
    if (!account) throw new BadRequestException('Meta ad account is not an active canonical ERP account.');
    if (account.currency !== 'VND') throw new BadRequestException('Meta ad account currency must be VND.');
    if (account.timezoneId !== 'Asia/Ho_Chi_Minh') {
      throw new BadRequestException('Meta ad account timezone must be Asia/Ho_Chi_Minh.');
    }
    if (Number(account.accountStatus) !== 1) {
      throw new BadRequestException('Meta ad account provider status is not active.');
    }
    const lastSyncAt = account.lastSyncAt ? new Date(account.lastSyncAt) : null;
    const now = Date.now();
    if (account.lastSyncStatus !== 'ok'
      || !lastSyncAt
      || Number.isNaN(lastSyncAt.getTime())
      || lastSyncAt.getTime() > now + 60_000
      || now - lastSyncAt.getTime() > this.accountSyncMaxAgeMs()) {
      throw new BadRequestException('Meta ad account canonical sync is missing, stale, or unsuccessful.');
    }
  }

  private assertPayloadHash(
    action: MetaAdsCanonicalAction,
    providerAction: ReturnType<MetaAdsProviderClientService['canonicalPayload']>,
  ): string {
    const calculated = this.providerClient.payloadHash(providerAction);
    if (!action.payloadHash || calculated !== action.payloadHash) {
      throw new BadRequestException('Meta canonical action payload hash mismatch.');
    }
    return calculated;
  }

  private async beforeState(
    action: MetaAdsCanonicalAction,
    credentialReferenceId: string,
  ): Promise<MetaAdsResourceSnapshot | Record<string, unknown> | undefined> {
    const options = {
      attempts: 1,
      expectedCredentialReferenceId: credentialReferenceId,
    };
    if (action.actionType === 'create_campaign'
      || action.actionType === 'create_ad_creative') {
      return undefined;
    }
    if (action.actionType === 'create_ad_set') {
      if (!action.campaignId) throw new BadRequestException('campaignId is required.');
      return {
        dependencyType: 'CAMPAIGN',
        campaign: await this.providerClient.readCampaign(
          action.adAccountId,
          action.campaignId,
          options,
        ),
      };
    }
    if (action.actionType === 'pause_ad_set') {
      if (!action.campaignId || !action.adSetId) {
        throw new BadRequestException('campaignId and adSetId are required.');
      }
      return this.providerClient.readAdSet(
        action.adAccountId,
        action.adSetId,
        options,
      );
    }
    if (action.actionType === 'create_ad') {
      if (!action.adSetId || !action.creativeId) {
        throw new BadRequestException('create_ad requires adSetId and creativeId.');
      }
      return {
        dependencyType: 'AD_SET_AND_CREATIVE',
        adSet: await this.providerClient.readAdSet(
          action.adAccountId,
          action.adSetId,
          options,
        ),
        creative: await this.providerClient.readAdCreative(
          action.adAccountId,
          action.creativeId,
          options,
        ),
      };
    }
    if (!action.campaignId) throw new BadRequestException('campaignId is required.');
    return this.providerClient.readCampaign(action.adAccountId, action.campaignId, options);
  }

  private assertBusinessRules(
    action: MetaAdsCanonicalAction,
    beforeState?: MetaAdsResourceSnapshot | Record<string, unknown>,
  ): void {
    // Never pass the persisted workflow envelope (approval evidence, hashes,
    // actor IDs, revision) to the provider boundary. Only the typed canonical
    // provider projection is eligible for mutation construction.
    this.providerClient.buildMutation(this.providerClient.canonicalPayload(action));
    this.assertStaticBusinessRules(action);
    if (action.actionType === 'create_ad_set') {
      const campaign = (beforeState as any)?.campaign as MetaAdsCampaignSnapshot | undefined;
      if (!campaign
        || campaign.adAccountId !== action.adAccountId
        || campaign.campaignId !== action.campaignId
        || campaign.status !== 'PAUSED') {
        throw new BadRequestException(
          'create_ad_set requires an exact PAUSED parent Campaign readback.',
        );
      }
      if (campaign.budgetMode !== action.budgetMode) {
        throw new BadRequestException(
          'Ad Set budgetMode must match the exact parent Campaign budget ownership.',
        );
      }
    }
    if (action.actionType === 'pause_ad_set') {
      const adSet = beforeState as any;
      if (!adSet
        || adSet.resourceType !== 'AD_SET'
        || adSet.adAccountId !== action.adAccountId
        || adSet.campaignId !== action.campaignId
        || adSet.adSetId !== action.adSetId) {
        throw new BadRequestException(
          'pause_ad_set requires an exact same-account Campaign and Ad Set readback.',
        );
      }
      if (adSet.status === 'PAUSED') {
        throw new BadRequestException('Meta Ad Set is already PAUSED.');
      }
      if (['ARCHIVED', 'DELETED'].includes(String(adSet.status || '').toUpperCase())) {
        throw new BadRequestException('Archived or deleted Meta Ad Sets cannot be paused.');
      }
    }
    if (action.actionType === 'create_ad') {
      const adSet = (beforeState as any)?.adSet;
      const creative = (beforeState as any)?.creative;
      if (!adSet || !creative
        || adSet.adAccountId !== action.adAccountId
        || creative.adAccountId !== action.adAccountId
        || adSet.adSetId !== action.adSetId
        || creative.creativeId !== action.creativeId
        || adSet.status !== 'PAUSED') {
        throw new BadRequestException(
          'create_ad requires exact same-account Creative and PAUSED Ad Set readbacks.',
        );
      }
    }
    const campaignBeforeState = beforeState as MetaAdsCampaignSnapshot | undefined;
    if (action.actionType === 'update_campaign' && action.dailyBudgetVnd !== undefined) {
      if (!campaignBeforeState || campaignBeforeState.budgetMode !== 'CBO'
        || campaignBeforeState.budgetType !== 'DAILY'
        || !Number.isSafeInteger(campaignBeforeState.dailyBudgetVnd)
        || Number(campaignBeforeState.dailyBudgetVnd) <= 0) {
        throw new BadRequestException('Meta campaign budget update requires a current canonical CBO daily budget.');
      }
      if (action.dailyBudgetVnd > Number(campaignBeforeState.dailyBudgetVnd)) {
        throw new BadRequestException('Meta campaign budget increases are not supported in this phase.');
      }
    }
    if (action.actionType === 'update_campaign' && action.lifetimeBudgetVnd !== undefined) {
      if (!campaignBeforeState || campaignBeforeState.budgetMode !== 'CBO'
        || campaignBeforeState.budgetType !== 'LIFETIME'
        || !Number.isSafeInteger(campaignBeforeState.lifetimeBudgetVnd)
        || Number(campaignBeforeState.lifetimeBudgetVnd) <= 0) {
        throw new BadRequestException('Meta campaign budget update requires a current canonical CBO lifetime budget.');
      }
      if (action.lifetimeBudgetVnd > Number(campaignBeforeState.lifetimeBudgetVnd)) {
        throw new BadRequestException('Meta campaign lifetime budget increases are not supported in this phase.');
      }
    }
    if (action.actionType === 'update_campaign' && action.spendCapVnd !== undefined
      && campaignBeforeState?.spendCapVnd !== undefined
      && action.spendCapVnd > campaignBeforeState.spendCapVnd) {
      throw new BadRequestException('Meta campaign spend-cap increases are not supported in this phase.');
    }
    if (action.actionType === 'update_campaign' && action.stopTime !== undefined) {
      if (!campaignBeforeState) throw new BadRequestException('Meta campaign stop-time update requires provider readback.');
      const nextStop = new Date(action.stopTime).getTime();
      const currentStop = campaignBeforeState.stopTime ? new Date(campaignBeforeState.stopTime).getTime() : undefined;
      const currentStart = campaignBeforeState.startTime ? new Date(campaignBeforeState.startTime).getTime() : undefined;
      if (currentStart !== undefined && nextStop <= currentStart) {
        throw new BadRequestException('Meta campaign stopTime must be after its provider startTime.');
      }
      if (currentStop !== undefined && nextStop > currentStop) {
        throw new BadRequestException('Meta campaign schedule extensions are not supported in this phase.');
      }
    }
  }

  private assertStaticBusinessRules(action: MetaAdsCanonicalAction): void {
    if (action.dailyBudgetVnd !== undefined
      && action.dailyBudgetVnd > this.requiredPositiveEnv('META_ADS_MAX_DAILY_BUDGET_VND')) {
      throw new BadRequestException('Meta campaign daily budget exceeds the configured maximum.');
    }
    if (action.lifetimeBudgetVnd !== undefined
      && action.lifetimeBudgetVnd > this.requiredPositiveEnv('META_ADS_MAX_LIFETIME_BUDGET_VND')) {
      throw new BadRequestException('Meta campaign lifetime budget exceeds the configured maximum.');
    }
    if (action.spendCapVnd !== undefined
      && action.spendCapVnd > this.requiredPositiveEnv('META_ADS_MAX_SPEND_CAP_VND')) {
      throw new BadRequestException('Meta campaign spend cap exceeds the configured maximum.');
    }

    if (action.actionType === 'create_campaign') {
      const requestedCategories = (action.specialAdCategories || []).map((item) => String(item).toUpperCase());
      const allowedCategories = this.csvEnv('META_ADS_SPECIAL_CATEGORY_ALLOWLIST')
        .map((item) => item.toUpperCase());
      const effectiveAllowlist = allowedCategories.length ? allowedCategories : ['NONE'];
      if (!requestedCategories.length
        || requestedCategories.some((item) => !effectiveAllowlist.includes(item))) {
        throw new BadRequestException(
          'Meta special ad category is not enabled by META_ADS_SPECIAL_CATEGORY_ALLOWLIST.',
        );
      }
    }
    if (action.actionType === 'create_ad_creative') {
      this.assertAllowedHttpsUrl(action.destinationUrl, 'destinationUrl');
    }
    if (action.actionType === 'create_ad_set' && action.objectStoreUrl) {
      this.assertAllowedHttpsUrl(
        action.objectStoreUrl,
        'objectStoreUrl',
        'META_ADS_APP_STORE_HOST_ALLOWLIST',
      );
    }

    if (action.startTime !== undefined && action.stopTime !== undefined) {
      const start = new Date(action.startTime).getTime();
      const stop = new Date(action.stopTime).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(stop) || start >= stop) {
        throw new BadRequestException('Meta campaign startTime must be before stopTime.');
      }
      const maxDurationMs = this.scheduleMaxDays() * 24 * 60 * 60 * 1000;
      if (stop - start > maxDurationMs) {
        throw new BadRequestException('Meta campaign schedule exceeds the configured maximum duration.');
      }
    }
    if (action.stopTime !== undefined && new Date(action.stopTime).getTime() <= Date.now()) {
      throw new BadRequestException('Meta campaign stopTime must be in the future.');
    }
  }

  private assertFreshProviderValidation(action: MetaAdsCanonicalAction, payloadHash: string): void {
    const validatedAt = action.providerValidatedAt ? new Date(action.providerValidatedAt) : null;
    const expiresAt = action.providerValidationExpiresAt ? new Date(action.providerValidationExpiresAt) : null;
    const now = Date.now();
    if (action.providerValidationStatus !== 'passed'
      || !validatedAt || Number.isNaN(validatedAt.getTime())
      || validatedAt.getTime() > now + 60_000
      || !expiresAt || Number.isNaN(expiresAt.getTime())
      || expiresAt.getTime() <= now
      || action.providerValidationPayloadHash !== payloadHash
      || !action.providerValidationBeforeStateHash
      || action.providerValidationGraphApiVersion !== 'v25.0'
      || !action.providerValidationCredentialReferenceId) {
      throw new BadRequestException('Meta provider validate_only evidence is missing, stale, or not bound to this action.');
    }
  }

  private assertSeparationOfDuties(
    action: MetaAdsCanonicalAction,
    currentUser: any,
    createdByUserId: string,
  ): void {
    const result = this.evaluateSeparationOfDuties(action, currentUser, createdByUserId);
    if (!result.allowed) throw new BadRequestException(result.reason);
  }

  private assertLiveFlags(actionType: MetaAdsCanonicalAction['actionType']): void {
    const blocker = this.liveFlagBlockers(actionType)[0];
    if (blocker) throw new BadRequestException(blocker);
  }

  private liveFlagBlockers(actionType: MetaAdsCanonicalAction['actionType']): string[] {
    const blockers: string[] = [];
    if (!readBooleanEnv('AI_MARKETING_REQUIRE_APPROVAL', true)) {
      blockers.push('Meta live execution is blocked when approval enforcement is disabled.');
    }
    if (!readBooleanEnv('META_ADS_PRODUCTION_ENABLED', false)) {
      blockers.push('Meta production execution is disabled by META_ADS_PRODUCTION_ENABLED.');
    }
    if (!readBooleanEnv('AI_MARKETING_PROVIDER_EXECUTION_ENABLED', false)) {
      blockers.push('Provider execution is disabled by AI_MARKETING_PROVIDER_EXECUTION_ENABLED.');
    }
    if (!readBooleanEnv('META_ADS_PROVIDER_EXECUTION_ENABLED', false)) {
      blockers.push('Meta provider execution is disabled by META_ADS_PROVIDER_EXECUTION_ENABLED.');
    }
    if (readBooleanEnv('AI_MARKETING_DRY_RUN', true)) {
      blockers.push('Meta live execution is disabled while AI_MARKETING_DRY_RUN=true.');
    }
    const flagByAction = {
      create_campaign: 'META_ADS_CAMPAIGN_CREATE_ENABLED',
      update_campaign: 'META_ADS_CAMPAIGN_UPDATE_ENABLED',
      pause_campaign: 'META_ADS_CAMPAIGN_PAUSE_ENABLED',
      create_ad_set: 'META_ADS_AD_SET_CREATE_ENABLED',
      pause_ad_set: 'META_ADS_AD_SET_PAUSE_ENABLED',
      create_ad_creative: 'META_ADS_AD_CREATIVE_CREATE_ENABLED',
      create_ad: 'META_ADS_AD_CREATE_ENABLED',
    } as const;
    const actionFlag = flagByAction[actionType];
    if (!readBooleanEnv(actionFlag, false)) {
      blockers.push(`Meta action is disabled by ${actionFlag}.`);
    }
    if (actionType === 'create_ad_set'
      && !readBooleanEnv('META_ADS_INTERNAL_MAPPING_VERIFIED_ENABLED', false)) {
      blockers.push(
        'Meta Ad Set live create is blocked until META_ADS_INTERNAL_MAPPING_VERIFIED_ENABLED=true.',
      );
    }
    return blockers;
  }

  private assertAllowedHttpsUrl(
    value: unknown,
    field: string,
    allowlistEnv = 'META_ADS_LANDING_PAGE_ALLOWLIST',
  ): void {
    const raw = String(value || '');
    if (/[\u0000-\u001F\u007F]/.test(raw)) {
      throw new BadRequestException(`Meta ${field} must not contain control characters.`);
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException(`Meta ${field} must be a valid HTTPS URL.`);
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new BadRequestException(`Meta ${field} must be a credential-free HTTPS URL.`);
    }
    const allowlist = this.csvEnv(allowlistEnv)
      .map((item) => item.toLowerCase().replace(/^\./, ''));
    const host = url.hostname.toLowerCase();
    if (!allowlist.length
      || !allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      throw new BadRequestException(
        `Meta ${field} host is not in ${allowlistEnv}.`,
      );
    }
  }

  private csvEnv(name: string): string[] {
    return String(process.env[name] || '').split(',').map((value) => value.trim()).filter(Boolean);
  }

  private requiredPositiveEnv(name: string): number {
    const value = Number(process.env[name]);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new BadRequestException(`${name} must be configured as a positive integer.`);
    }
    return value;
  }

  private accountSyncMaxAgeMs(): number {
    const value = Number(process.env.META_ADS_ACCOUNT_SYNC_MAX_AGE_MS);
    if (!Number.isFinite(value)) return 15 * 60 * 1000;
    return Math.min(24 * 60 * 60 * 1000, Math.max(60_000, Math.floor(value)));
  }

  private scheduleMaxDays(): number {
    const value = Number(process.env.META_ADS_CAMPAIGN_SCHEDULE_MAX_DAYS);
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new BadRequestException(
        'META_ADS_CAMPAIGN_SCHEDULE_MAX_DAYS must be configured as a positive integer.',
      );
    }
    return Math.min(3650, value);
  }
}
