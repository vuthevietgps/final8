import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import {
  GoogleAdsCampaignConversionGoal,
  GoogleAdsCampaignConversionGoalDocument,
} from './schemas/google-ads-campaign-conversion-goal.schema';
import {
  GoogleAdsConversionAction,
  GoogleAdsConversionActionDocument,
} from './schemas/google-ads-conversion-action.schema';
import {
  GoogleAdsConversionGoalCampaignConfig,
  GoogleAdsConversionGoalCampaignConfigDocument,
} from './schemas/google-ads-conversion-goal-campaign-config.schema';

export type GoogleAdsConversionReadiness = {
  ready: boolean;
  blockers: string[];
  evidence: {
    conversionCustomerId?: string;
    conversionTrackingStatus?: string;
    goalConfigLevel?: string;
    primaryActionCount: number;
    biddableGoalCount: number;
    matchedGoalCount: number;
    observedAt: string;
  };
};

@Injectable()
export class GoogleAdsConversionReadinessService {
  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(GoogleAdsConversionAction.name)
    private readonly conversionActionModel: Model<GoogleAdsConversionActionDocument>,
    @InjectModel(GoogleAdsCampaignConversionGoal.name)
    private readonly campaignConversionGoalModel:
      Model<GoogleAdsCampaignConversionGoalDocument>,
    @InjectModel(GoogleAdsConversionGoalCampaignConfig.name)
    private readonly conversionGoalCampaignConfigModel:
      Model<GoogleAdsConversionGoalCampaignConfigDocument>,
  ) {}

  async evaluate(customerId: string, campaignId: string): Promise<GoogleAdsConversionReadiness> {
    const blockers: string[] = [];
    const [account, config, actions, goals]: any[] = await Promise.all([
      this.adAccountModel.findOne({
        accountType: 'google',
        isActive: true,
        $or: [
          { accountId: customerId },
          { accountId: this.hyphenated(customerId) },
        ],
      }).lean(),
      this.conversionGoalCampaignConfigModel.findOne({
        customerId,
        campaignId,
      }).lean(),
      this.conversionActionModel.find({
        customerId,
        status: 'ENABLED',
        primaryForGoal: true,
      }).lean(),
      this.campaignConversionGoalModel.find({
        customerId,
        campaignId,
        biddable: true,
      }).lean(),
    ]);
    const conversionCustomerId = this.idFromResourceName(
      account?.googleAdsConversionCustomer,
    );
    const conversionTrackingStatus = String(
      account?.conversionTrackingStatus || '',
    ).toUpperCase();
    if (!account) blockers.push('CANONICAL_GOOGLE_ADS_ACCOUNT_NOT_FOUND');
    if (!conversionCustomerId) blockers.push('CONVERSION_CUSTOMER_NOT_CONFIRMED');
    if (![
      'CONVERSION_TRACKING_MANAGED_BY_SELF',
      'CONVERSION_TRACKING_MANAGED_BY_THIS_MANAGER',
      'CONVERSION_TRACKING_MANAGED_BY_ANOTHER_MANAGER',
    ].includes(conversionTrackingStatus)) {
      blockers.push('CONVERSION_TRACKING_NOT_ENABLED_OR_UNCONFIRMED');
    }
    if (!config) {
      blockers.push('CONVERSION_GOAL_CAMPAIGN_CONFIG_NOT_SYNCED');
    } else {
      this.assertFresh(config, 'CONVERSION_GOAL_CAMPAIGN_CONFIG_STALE', blockers);
      if (String(config.customConversionGoalResourceName || '').trim()) {
        blockers.push('CUSTOM_CONVERSION_GOAL_EVIDENCE_NOT_SUPPORTED');
      }
    }
    const primaryActions = (actions || []).filter((action: any) => {
      this.assertFresh(action, 'PRIMARY_CONVERSION_ACTION_EVIDENCE_STALE', blockers);
      if (!action.category || !action.origin) return false;
      return Boolean(
        conversionCustomerId
        && action.ownerCustomerId
        && String(action.ownerCustomerId) === conversionCustomerId,
      );
    });
    if (!primaryActions.length) {
      blockers.push('PRIMARY_CONVERSION_ACTION_NOT_FOUND');
      if ((actions || []).length && conversionCustomerId) {
        blockers.push('CONVERSION_ACTION_OWNER_MISMATCH');
      }
    }
    for (const goal of goals || []) {
      this.assertFresh(goal, 'BIDDABLE_CAMPAIGN_GOAL_EVIDENCE_STALE', blockers);
    }
    if (!(goals || []).length) blockers.push('BIDDABLE_CAMPAIGN_GOAL_NOT_FOUND');
    const goalKeys = new Set((goals || []).map(
      (goal: any) => this.goalKey(goal.category, goal.origin),
    ));
    const matchedGoalCount = primaryActions.filter(
      (action: any) => goalKeys.has(this.goalKey(action.category, action.origin)),
    ).length;
    if (!matchedGoalCount) {
      blockers.push('PRIMARY_ACTION_AND_BIDDABLE_GOAL_DO_NOT_MATCH');
    }
    const uniqueBlockers = [...new Set(blockers)];
    return {
      ready: uniqueBlockers.length === 0,
      blockers: uniqueBlockers,
      evidence: {
        ...(conversionCustomerId ? { conversionCustomerId } : {}),
        ...(conversionTrackingStatus ? { conversionTrackingStatus } : {}),
        ...(config?.goalConfigLevel
          ? { goalConfigLevel: String(config.goalConfigLevel) }
          : {}),
        primaryActionCount: primaryActions.length,
        biddableGoalCount: (goals || []).length,
        matchedGoalCount,
        observedAt: new Date().toISOString(),
      },
    };
  }

  private assertFresh(value: any, blocker: string, blockers: string[]) {
    const at = value?.lastSyncAt ? new Date(value.lastSyncAt) : null;
    const maxAgeMinutes = this.positiveEnv(
      'GOOGLE_ADS_CANONICAL_MAX_AGE_MINUTES',
      180,
    );
    if (!at
      || Number.isNaN(at.getTime())
      || Date.now() - at.getTime() > maxAgeMinutes * 60_000) {
      blockers.push(blocker);
    }
  }

  private goalKey(category: unknown, origin: unknown) {
    return `${String(category || '').toUpperCase()}::${String(origin || '').toUpperCase()}`;
  }

  private idFromResourceName(value: unknown) {
    return String(value || '').match(/\/(\d+)$/)?.[1];
  }

  private hyphenated(value: string) {
    return /^\d{10}$/.test(value)
      ? `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`
      : value;
  }

  private positiveEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
