import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdsAutomationEvidenceSnapshotStoreService, bangkokDateKey } from '../ads-automation-evidence/ads-automation-evidence-snapshot-store.service';
import {
  AdsAutomationAdGroupEvidence,
  AdsAutomationEvidenceSnapshot,
} from '../ads-automation-evidence/dto/ads-automation-evidence.dto';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import { GoogleAdsErpActionPlanService } from '../google-ads/google-ads-erp-action-plan.service';
import { MetaAdsActionPlanService } from '../meta-ads/meta-ads-action-plan.service';

type DraftPlatform = 'google_ads' | 'meta_ads';

type SnapshotProvenance = {
  snapshotId: string;
  snapshotHash: string;
  capturedAt: string;
};

type EligiblePauseCandidate = {
  platform: DraftPlatform;
  accountId: string;
  campaignId: string;
  resourceId: string;
  resourceName?: string;
  netProfitAfterAds: number;
  productIds: string[];
};

export interface AdsAutomationDraftPreview {
  platform: DraftPlatform;
  snapshot: SnapshotProvenance;
  evaluated: number;
  eligible: number;
  skippedByReason: Record<string, number>;
  candidates: EligiblePauseCandidate[];
}

export interface AdsAutomationDraftMaterialization extends AdsAutomationDraftPreview {
  created: number;
  deduplicated: number;
  rejected: number;
  drafts: Array<{
    planId: string;
    actionId?: string;
    accountId: string;
    campaignId: string;
    resourceId: string;
    status: string;
  }>;
}

@Injectable()
export class AdsAutomationDraftService {
  private readonly logger = new Logger(AdsAutomationDraftService.name);

  constructor(
    private readonly snapshotStore: AdsAutomationEvidenceSnapshotStoreService,
    private readonly googlePlanService: GoogleAdsErpActionPlanService,
    private readonly metaPlanService: MetaAdsActionPlanService,
  ) {}

  async previewPauseReviewDrafts(
    platform: DraftPlatform,
    options: { limit?: number } = {},
  ): Promise<AdsAutomationDraftPreview> {
    const { payload, provenance } = await this.loadTrustedSnapshot();
    const limit = clamp(options.limit, 1, 50, 20);
    const candidates: EligiblePauseCandidate[] = [];
    const skippedByReason: Record<string, number> = {};
    const platformRows = payload.adGroups.filter(
      (candidate) => candidate.platform === platform,
    );

    for (const candidate of platformRows) {
      const eligibility = this.pauseEligibility(candidate, platform);
      if ('reason' in eligibility) {
        increment(skippedByReason, eligibility.reason);
        continue;
      }
      if (candidates.length >= limit) {
        increment(skippedByReason, 'BATCH_LIMIT_REACHED');
        continue;
      }
      candidates.push(eligibility.candidate);
    }

    return {
      platform,
      snapshot: provenance,
      evaluated: platformRows.length,
      eligible: candidates.length,
      skippedByReason,
      candidates,
    };
  }

  async materializePauseReviewDrafts(
    platform: DraftPlatform,
    createdByUserId: string,
    options: { limit?: number } = {},
  ): Promise<AdsAutomationDraftMaterialization> {
    const actorId = safeText(createdByUserId, 200);
    if (!actorId) {
      throw new BadRequestException('A valid ERP creator user ID is required.');
    }
    const preview = await this.previewPauseReviewDrafts(platform, options);
    const result: AdsAutomationDraftMaterialization = {
      ...preview,
      created: 0,
      deduplicated: 0,
      rejected: 0,
      drafts: [],
    };

    for (const candidate of preview.candidates) {
      try {
        const draft = platform === 'google_ads'
          ? await this.createGooglePauseDraft(candidate, actorId, preview.snapshot)
          : await this.createMetaPauseDraft(candidate, actorId, preview.snapshot);
        result.created += 1;
        result.drafts.push(draft);
      } catch (error: any) {
        const status = Number(error?.getStatus?.());
        if (error instanceof ConflictException || status === 409 || Number(error?.code) === 11000) {
          result.deduplicated += 1;
          continue;
        }
        if ([400, 404, 422].includes(status)) {
          result.rejected += 1;
          this.logger.warn(
            `Ads automation draft rejected by canonical plan policy: ${redactSecretString(
              error instanceof Error ? error.message : String(error),
            )}`,
          );
          continue;
        }
        throw error;
      }
    }

    return result;
  }

  @Cron('0 20 8 * * *', { timeZone: 'Asia/Bangkok' })
  async materializeScheduledDrafts(): Promise<void> {
    if (!readBooleanEnv('ADS_AUTOMATION_DRAFTS_ENABLED', false)) return;
    const actorId = safeText(process.env.ADS_AUTOMATION_ACTOR_USER_ID, 200);
    if (!actorId) {
      this.logger.error(
        'ADS_AUTOMATION_DRAFTS_ENABLED requires ADS_AUTOMATION_ACTOR_USER_ID; no drafts were created.',
      );
      return;
    }

    for (const platform of ['google_ads', 'meta_ads'] as const) {
      try {
        const result = await this.materializePauseReviewDrafts(platform, actorId);
        this.logger.log(
          `Materialized ${platform} pause-review drafts created=${result.created} deduplicated=${result.deduplicated} rejected=${result.rejected}.`,
        );
      } catch (error) {
        this.logger.error(
          `${platform} pause-review materialization failed: ${redactSecretString(
            error instanceof Error ? error.message : String(error),
          )}`,
        );
      }
    }
  }

  private async createGooglePauseDraft(
    candidate: EligiblePauseCandidate,
    actorId: string,
    provenance: SnapshotProvenance,
  ) {
    const created: any = await this.googlePlanService.createPlan({
      planName: planName('Google', candidate),
      actions: [{
        actionType: 'pause_ad_group',
        customerId: candidate.accountId,
        campaignId: candidate.campaignId,
        adGroupId: candidate.resourceId,
        reason: pauseReason(candidate, provenance),
        idempotencyKey: idempotencyKey('google', candidate),
        payload: {},
      }],
    }, actorId, 'erp_automation', provenance);
    const plan = created?.plan || created;
    const action = plan?.items?.[0];
    return {
      planId: String(plan?.planId || ''),
      actionId: action?.actionId ? String(action.actionId) : undefined,
      accountId: candidate.accountId,
      campaignId: candidate.campaignId,
      resourceId: candidate.resourceId,
      status: String(action?.status || plan?.status || 'pending'),
    };
  }

  private async createMetaPauseDraft(
    candidate: EligiblePauseCandidate,
    actorId: string,
    provenance: SnapshotProvenance,
  ) {
    const plan: any = await this.metaPlanService.createPlan({
      planName: planName('Meta', candidate),
      actions: [{
        actionType: 'pause_ad_set',
        adAccountId: candidate.accountId,
        campaignId: candidate.campaignId,
        adSetId: candidate.resourceId,
        reason: pauseReason(candidate, provenance),
        idempotencyKey: idempotencyKey('meta', candidate),
        payload: {},
      }],
    }, actorId, 'erp_automation', provenance);
    const action = plan?.actions?.[0];
    return {
      planId: String(plan?.planId || ''),
      actionId: action?.actionId ? String(action.actionId) : undefined,
      accountId: candidate.accountId,
      campaignId: candidate.campaignId,
      resourceId: candidate.resourceId,
      status: String(action?.workflowStatus || plan?.status || 'pending_validation'),
    };
  }

  private async loadTrustedSnapshot(): Promise<{
    payload: AdsAutomationEvidenceSnapshot;
    provenance: SnapshotProvenance;
  }> {
    const record: any = await this.snapshotStore.latest();
    if (!record?.payload || !record?.hash || !record?.capturedAt) {
      throw new ConflictException(
        'No immutable Ads automation evidence snapshot is available.',
      );
    }
    const payload = record.payload as AdsAutomationEvidenceSnapshot;
    const expectedHash = this.snapshotStore.hashPayload(payload);
    if (String(record.hash) !== expectedHash) {
      throw new ConflictException('Ads automation evidence snapshot hash mismatch.');
    }
    if (payload.schemaVersion !== 'ads_automation_evidence_snapshot.v1') {
      throw new ConflictException('Unsupported Ads automation evidence snapshot schema.');
    }
    const capturedAt = new Date(record.capturedAt);
    const now = new Date();
    const maxAgeMinutes = clamp(
      process.env.ADS_AUTOMATION_DRAFT_MAX_SNAPSHOT_AGE_MINUTES,
      5,
      2_880,
      1_440,
    );
    if (
      Number.isNaN(capturedAt.getTime())
      || capturedAt.getTime() > now.getTime() + 5 * 60_000
      || now.getTime() - capturedAt.getTime() > maxAgeMinutes * 60_000
      || String(record.dateKey || '') !== bangkokDateKey(now)
    ) {
      throw new ConflictException(
        'Ads automation evidence snapshot is stale or not from the current Bangkok business date.',
      );
    }
    if (payload.killSwitchActive) {
      throw new ConflictException(
        'Ads automation kill switch is active; no automated drafts were created.',
      );
    }
    if (
      payload.safety?.providerApiCalled !== false
      || payload.safety?.googleAdsApiCalled !== false
      || payload.safety?.metaAdsApiCalled !== false
      || payload.safety?.liveExecutionUsed !== false
      || payload.safety?.secretsRedacted !== true
    ) {
      throw new ConflictException(
        'Ads automation accepts only redacted ERP snapshots without provider calls.',
      );
    }

    return {
      payload,
      provenance: {
        snapshotId: safeText(payload.snapshotId, 200)
          || `ads-evidence-${record.dateKey}`,
        snapshotHash: expectedHash,
        capturedAt: capturedAt.toISOString(),
      },
    };
  }

  private pauseEligibility(
    candidate: AdsAutomationAdGroupEvidence,
    platform: DraftPlatform,
  ): {
    eligible: true;
    candidate: EligiblePauseCandidate;
  } | {
    eligible: false;
    reason: string;
  } {
    if (candidate.recommendedActionFamily !== 'pause_review') {
      return { eligible: false, reason: 'NOT_PAUSE_REVIEW' };
    }
    if (!candidate.decisionBlockers.some(
      (blocker) => blocker.code === 'COMMERCE_NET_PROFIT_AFTER_ADS_NEGATIVE',
    )) {
      return { eligible: false, reason: 'NEGATIVE_PROFIT_EVIDENCE_MISSING' };
    }
    if (
      candidate.mappingHealth.status !== 'mapped'
      || candidate.mappingHealth.confidence !== 'high'
      || candidate.productIds.length < 1
    ) {
      return { eligible: false, reason: 'ERP_MAPPING_NOT_EXACT' };
    }
    if (candidate.commerceEvidence.dataFreshness !== 'fresh') {
      return { eligible: false, reason: 'COMMERCE_EVIDENCE_NOT_FRESH' };
    }
    if (!['ACTIVE', 'ENABLED'].includes(String(candidate.status || '').toUpperCase())) {
      return { eligible: false, reason: 'RESOURCE_NOT_ACTIVE' };
    }

    const accountId = numericId(candidate.childAccountId);
    const campaignId = numericId(candidate.campaignId);
    const resourceId = numericId(candidate.adGroupId);
    if (!accountId || !campaignId || !resourceId) {
      return { eligible: false, reason: 'CANONICAL_PROVIDER_ID_MISSING' };
    }
    if (candidate.platform !== platform) {
      return { eligible: false, reason: 'PLATFORM_MISMATCH' };
    }

    return {
      eligible: true,
      candidate: {
        platform,
        accountId,
        campaignId,
        resourceId,
        resourceName: safeText(candidate.name, 120),
        netProfitAfterAds: Number(candidate.commerceEvidence.netProfitAfterAds),
        productIds: candidate.productIds.map((value) => String(value)),
      },
    };
  }
}

function planName(provider: 'Google' | 'Meta', candidate: EligiblePauseCandidate): string {
  const resource = candidate.resourceName || candidate.resourceId;
  return safeText(`ERP auto pause review - ${provider} - ${resource}`, 200)
    || `ERP auto pause review - ${provider}`;
}

function pauseReason(
  candidate: EligiblePauseCandidate,
  provenance: SnapshotProvenance,
): string {
  const value = [
    'ERP draft-only pause review.',
    `netProfitAfterAds=${Math.trunc(candidate.netProfitAfterAds)} VND.`,
    `snapshot=${provenance.snapshotId}.`,
    `hash=${provenance.snapshotHash.slice(0, 16)}.`,
    'Provider validation and independent approval remain required.',
  ].join(' ');
  return safeText(value, 500) || 'ERP draft-only pause review.';
}

function idempotencyKey(
  provider: 'google' | 'meta',
  candidate: EligiblePauseCandidate,
): string {
  return `ads:auto:v1:pause:${provider}:${candidate.accountId}:${candidate.resourceId}`;
}

function numericId(value: unknown): string | undefined {
  const normalized = String(value || '').trim().replace(/[-\s]/g, '');
  return /^\d{1,32}$/.test(normalized) ? normalized : undefined;
}

function safeText(value: unknown, maximum: number): string | undefined {
  const normalized = String(value || '').trim();
  if (
    !normalized
    || normalized.length > maximum
    || /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] || 0) + 1;
}

function clamp(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = String(process.env[name] || '').trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}
